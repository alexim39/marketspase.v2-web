import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, inject, OnInit, signal, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { forkJoin, interval, fromEvent, Observable } from 'rxjs';
import { MessageService } from '../../../core/messaging/message.service';
import { CommunityService } from '../../../core/community/community.service';
import { ChatSocketService, RankGroupChangedEvent } from '../../../core/messaging/chat-socket.service';
import { PresenceService, PresenceStatus } from '../../../core/presence/presence.service';
import { AuthService } from '../../../core/auth/auth.service';
import { AvatarComponent } from '../../../_common/avatar.component';
import { AnnounceEnvelope, Contact, GroupAttachment, GroupBan, GroupDetail, GroupHit, GroupInvite, GroupJoinRequest, GroupMember, GroupMessage, GroupReport, GroupSummary, Message, MessageEnvelope, PersonHit, TeamAnnounceEnvelope } from '../../../core/messaging/message.models';
import { ApiError, userError } from '../../../core/http/api-error';

type ComposeKind = 'direct' | 'announcement' | 'team';
type ChatMsg = Message & { clientId?: string; pending?: boolean; failed?: boolean };

/** Official level groups stay visible first; everything else is newest-first. */
function sortGroupSummaries(rows: GroupSummary[]): GroupSummary[] {
  return [...rows].sort((a, b) => {
    const rank = Number(!a.rankGroup) - Number(!b.rankGroup);
    if (rank !== 0) return rank;
    return new Date(b.lastMessage?.createdAt ?? b.createdAt ?? 0).getTime()
      - new Date(a.lastMessage?.createdAt ?? a.createdAt ?? 0).getTime();
  });
}

const POLL_THREAD_MS = 8000;
const POLL_LISTS_MS = 24000;
const TYPING_CLEAR_MS = 3500;

/**
 * @title Messages — WhatsApp-style team chat.
 *
 * Two-pane chat (conversations left, thread right) over a live socket with
 * transparent REST fallback: every send, thread and read works offline-first
 * and upgrades to real-time when the socket connects. Announcements and
 * team broadcasts live in the Channels tab, unchanged. Brand tokens
 * throughout (gold ticks, dp surfaces) — WhatsApp interaction, MarketSpase look.
 */
@Component({
  selector: 'async-messages',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AvatarComponent, DatePipe, MatButtonModule, MatButtonToggleModule, MatChipsModule,
    MatDialogModule, MatIconModule, MatInputModule, MatProgressBarModule, MatSelectModule,
    PageSkeletonComponent, ReactiveFormsModule, RouterModule,
  ],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <span>Messages</span>
      </div>
    </section>

    <section class="messages-page">
      <div class="page-head">
        <div>
          <h2>Messages
            @if (totalUnread() > 0) {
              <span class="unread-count">{{ totalUnread() }} unread</span>
            }
          </h2>
          <p class="subtitle">
            <span class="conn" [class.conn--live]="chat.connected()">
              <span class="conn-dot" aria-hidden="true"></span>
              {{ chat.connected() ? 'Live' : 'Offline — messages still send, syncing on reconnect' }}
            </span>
          </p>
        </div>
        <div class="head-actions">
          <button mat-button [class.active-tab]="view() === 'chats'" (click)="switchView('chats')">Chats</button>
          <button mat-button [class.active-tab]="view() === 'groups'" (click)="switchView('groups')">Groups</button>
          <button mat-button [class.active-tab]="view() === 'channels'" (click)="switchView('channels')">Channels</button>
        </div>
      </div>

      @if (loading()) {
        <async-page-skeleton layout="inbox" [rows]="6" label="messages" [showHeader]="false" />
      }
      @if (error(); as err) {
        <p class="error" role="alert">
          {{ err }}
          <button mat-button (click)="reload()">Retry</button>
        </p>
      }

      @if (view() === 'chats') {
        <div class="chat-shell" [class.thread-open]="!!openThreadId()">
          <aside class="chat-side" aria-label="Conversations">
            <div class="side-tools">
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="side-search">
                <mat-label>Search chats</mat-label>
                <input matInput type="search" [value]="searchQuery()" (input)="searchQuery.set($any($event.target).value)" />
                <mat-icon matSuffix>search</mat-icon>
              </mat-form-field>
              @if (startingChat()) {
                  <mat-form-field appearance="outline" subscriptSizing="dynamic">
                    <mat-label>Message…</mat-label>
                    <mat-select [value]="''" (selectionChange)="startChat($event.value); startingChat.set(false)">
                      @for (c of contacts(); track c.id) {
                        <mat-option [value]="c.id">{{ c.name }} · {{ c.relation }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                  <mat-form-field appearance="outline" subscriptSizing="dynamic">
                    <mat-label>Find anyone…</mat-label>
                    <input matInput [value]="peopleQuery()" (input)="onPeopleSearch($any($event.target).value)" placeholder="Name or username, min 2 letters" />
                    <mat-icon matSuffix>person_search</mat-icon>
                  </mat-form-field>
                  @if (peopleLoading()) {
                    <mat-progress-bar mode="indeterminate" aria-label="Loading" />
                  }
                  @if (people().length > 0) {
                    <ul class="people-list">
                      @for (p of people(); track p.id) {
                        <li>
                          <async-avatar [name]="p.name" size="xs" [photo]="p.photo ?? null" />
                          <span class="people-name"><strong>{{ p.name }}</strong><span class="muted">@{{ p.username }}</span></span>
                          <button mat-button (click)="startChat(p.id); startingChat.set(false)">Chat</button>
                        </li>
                      }
                    </ul>
                  }
                } @else {
                  <button mat-stroked-button (click)="startingChat.set(true)">
                    <mat-icon>edit</mat-icon> New chat
                  </button>
                }
            </div>
            <ul class="convo-list">
              @for (c of conversations(); track c.id) {
                <li>
                  <button
                    type="button"
                    class="convo"
                    [class.active]="openThreadId() === c.id"
                    (click)="openChat(c.id)"
                    [attr.aria-current]="openThreadId() === c.id"
                  >
                    <async-avatar [name]="c.name" size="sm" [photo]="c.photo" [presence]="avatarPresence(c.id)" />
                    <span class="convo-main">
                      <span class="convo-top">
                        <strong>{{ c.name }}</strong>
                        <span class="muted">{{ listStamp(lastAt(c.messages)) }}</span>
                      </span>
                      <span class="convo-sub">
                        <span class="muted convo-snippet">
                          @if (typingFrom()[c.id]) {
                            <em class="typing">typing…</em>
                          } @else {
                            {{ lastSnippet(c.messages) }}
                          }
                        </span>
                        @if (c.unread > 0) {
                          <span class="unread-badge" aria-label="{{ c.unread }} unread">{{ c.unread }}</span>
                        }
                      </span>
                    </span>
                  </button>
                </li>
              }
            </ul>
            @if (conversations().length === 0 && !loading()) {
              <p class="empty side-empty">No chats yet — start one with your upline or downline.</p>
            }
          </aside>

          <div class="chat-main" aria-label="Conversation">
            @if (openThreadName(); as peer) {
              <header class="chat-head">
                <button mat-icon-button class="back-btn" (click)="openThreadId.set(null)" aria-label="Back to chats">
                  <mat-icon>arrow_back</mat-icon>
                </button>
                <async-avatar [name]="peer.name" size="sm" [photo]="photoOf(peer.id)" [presence]="avatarPresence(peer.id)" />
                <span class="chat-peer">
                  <strong>{{ peer.name }}</strong>
                  <span class="muted">{{ peerStatus(peer.id) }}</span>
                </span>
                <span class="spacer"></span>
                    <button mat-icon-button (click)="toggleFind()" [title]="findOpen() ? 'Close find' : 'Find in conversation'" aria-label="Find in conversation">
                      <mat-icon>search</mat-icon>
                    </button>
              </header>

              @if (findOpen()) {
                <div class="find-bar" role="search">
                  <mat-icon>search</mat-icon>
                  <input [value]="findQuery()" (input)="onFindInput($any($event.target).value)" (keydown.enter)="jumpFind(1)" (keydown.escape)="closeFind()" placeholder="Find in conversation…" aria-label="Find in conversation" />
                  <span class="muted">{{ findPosition() }}</span>
                  <button mat-icon-button (click)="jumpFind(-1)" [disabled]="findMatches().length === 0" aria-label="Previous match">
                    <mat-icon>arrow_upward</mat-icon>
                  </button>
                  <button mat-icon-button (click)="jumpFind(1)" [disabled]="findMatches().length === 0" aria-label="Next match">
                    <mat-icon>arrow_downward</mat-icon>
                  </button>
                  <button mat-icon-button (click)="closeFind()" aria-label="Close find">
                    <mat-icon>close</mat-icon>
                  </button>
                </div>
              }

              <div class="thread-scroll" #threadScroll>
                @if (threadLoadingMore()) {
                  <mat-progress-bar mode="indeterminate" aria-label="Loading" />
                } @else if (threadHasMore() && !threadLoading()) {
                  <button mat-button class="load-older" (click)="loadOlderThread()">Load older messages</button>
                }
                @if (threadLoading()) {
                  <mat-progress-bar mode="indeterminate" aria-label="Loading" />
                }
                @if (threadError(); as err) {
                  <p class="error" role="alert">{{ err }} <button mat-button (click)="openChat(openThreadId()!)">Retry</button></p>
                }
                @for (day of threadDays(); track day.key) {
                  <div class="day-chip" aria-hidden="true"><span>{{ day.label }}</span></div>
                  <ol class="bubble-list">
                    @for (m of day.msgs; track m.clientId ?? m.id) {
                      <li class="bubble" [class.bubble--mine]="m.senderId === myId()" [class.bubble--pending]="m.pending" [attr.data-mid]="m.clientId ?? m.id">
                        <p>{{ m.body }}</p>
                        <span class="bubble-meta">
                          <span class="muted">{{ m.createdAt | date:'shortTime' }}</span>
                          @if (m.senderId === myId()) {
                            @if (m.pending) {
                              <mat-icon class="ticks" aria-label="Sending">schedule</mat-icon>
                            } @else if (m.failed) {
                              <button mat-icon-button class="retry" (click)="retryTemp(m.clientId!)" title="Retry send" aria-label="Retry send">
                                <mat-icon>error_outline</mat-icon>
                              </button>
                            } @else if (m.readAt) {
                              <mat-icon class="ticks ticks--read" aria-label="Read">done_all</mat-icon>
                            } @else {
                              <mat-icon class="ticks" aria-label="Delivered">done_all</mat-icon>
                            }
                          }
                        </span>
                      </li>
                    }
                  </ol>
                }
                @if (typingFrom()[peer.id]) {
                  <div class="bubble typing-bubble" aria-live="polite"><span></span><span></span><span></span></div>
                }
                @if (threadSendError(); as err) {
                  <p class="error" role="alert">{{ err }}</p>
                }
              </div>

              <div class="composer">
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>Message {{ peer.name }}…</mat-label>
                  <textarea
                    matInput rows="2"
                    [value]="replyDraft()"
                    (input)="onDraftInput($any($event.target).value)"
                    (keydown.enter)="onComposerKey($any($event))"
                    (blur)="typingStop()"
                    maxlength="2000"
                  ></textarea>
                </mat-form-field>
                <button mat-fab color="primary" class="send-btn" (click)="sendThreadReply()" [disabled]="!replyDraft().trim() || threadSending()" aria-label="Send message">
                  <mat-icon>{{ threadSending() ? 'more_horiz' : 'send' }}</mat-icon>
                </button>
              </div>
            } @else {
              <div class="chat-empty">
                <mat-icon>forum</mat-icon>
                <p>Pick a conversation — or start one. Messages arrive live when you're online.</p>
              </div>
            }
          </div>
        </div>
      } @else if (view() === 'groups') {
        <div class="chat-shell group-shell" [class.thread-open]="!!openGroupId()" [class.panel-open]="showGroupPanel() && !!openGroup()">
          <aside class="chat-side" aria-label="Groups">
            <div class="side-tools">
              @if (creatingGroup()) {
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>Group name</mat-label>
                  <input matInput [value]="groupName()" (input)="groupName.set($any($event.target).value)" maxlength="80" placeholder="e.g. Lagos hustlers" />
                </mat-form-field>
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>What is it about? (optional)</mat-label>
                  <input matInput [value]="groupDescription()" (input)="groupDescription.set($any($event.target).value)" maxlength="500" />
                </mat-form-field>
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>Who can join</mat-label>
                  <mat-select [value]="groupPolicy()" (selectionChange)="groupPolicy.set($event.value)">
                    <mat-option value="approval">Approval — admins admit members</mat-option>
                    <mat-option value="open">Open — anyone can join instantly</mat-option>
                  </mat-select>
                </mat-form-field>
                @if (groupFormError(); as err) {
                  <p class="error" role="alert">{{ err }}</p>
                }
                <div class="row-actions">
                  <button mat-flat-button color="primary" (click)="createGroup()" [disabled]="groupCreating() || groupName().trim().length < 2">
                    {{ groupCreating() ? 'Creating…' : 'Create group' }}
                  </button>
                  <button mat-button (click)="creatingGroup.set(false)">Cancel</button>
                </div>
              } @else {
                <button mat-stroked-button (click)="creatingGroup.set(true)">
                  <mat-icon>group_add</mat-icon> New group
                </button>
              }
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="side-search">
                <mat-label>Discover groups</mat-label>
                <input matInput type="search" [value]="groupSearch()" (input)="onGroupSearch($any($event.target).value)" placeholder="Name, min 2 letters" />
                <mat-icon matSuffix>travel_explore</mat-icon>
              </mat-form-field>
              @if (groupSearching()) {
                <mat-progress-bar mode="indeterminate" aria-label="Loading" />
              }
              @if (groupHits().length > 0) {
                <ul class="people-list group-hits">
                  @for (h of groupHits(); track h.id) {
                    <li>
                      <async-avatar [name]="h.name" size="xs" [photo]="h.photo ?? null" />
                      <span class="people-name">
                        <strong>{{ h.name }}</strong>
                        <span class="muted">{{ h.memberCount ?? 0 }} members · {{ h.joinPolicy === 'open' ? 'Open' : 'Approval' }}</span>
                      </span>
                      <button mat-button (click)="joinGroup(h.id)" [disabled]="groupActionBusy() === h.id">
                        {{ groupActionBusy() === h.id ? '…' : 'Join' }}
                      </button>
                    </li>
                  }
                </ul>
              }
            </div>
            @if (groupsLoading()) {
              <mat-progress-bar mode="indeterminate" aria-label="Loading" />
            }
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="side-search">
              <mat-label>Filter my groups</mat-label>
              <input matInput type="search" [value]="groupFilter()" (input)="groupFilter.set($any($event.target).value)" placeholder="Group name" />
              <mat-icon matSuffix>filter_list</mat-icon>
            </mat-form-field>
            <ul class="convo-list">
              @for (g of filteredGroups(); track g.id) {
                <li>
                  <button
                    type="button"
                    class="convo"
                    [class.active]="openGroupId() === g.id"
                    (click)="openGroupChat(g.id)"
                    [attr.aria-current]="openGroupId() === g.id"
                  >
                    <async-avatar [name]="g.name" size="sm" [photo]="g.photo ?? null" />
                    <span class="convo-main">
                      <span class="convo-top">
                        <strong>{{ g.name }}</strong>
                        @if (g.rankGroup) {
                          <span class="rank-badge">Official</span>
                        }
                        <span class="muted">{{ listStamp(groupLastAt(g)) }}</span>
                      </span>
                      <span class="convo-sub">
                        <span class="muted convo-snippet">{{ groupSnippet(g) }}</span>
                        @if (g.muted) {
                          <mat-icon class="muted-ic" aria-label="Muted">notifications_off</mat-icon>
                        }
                        @if ((g.unread ?? 0) > 0) {
                          <span class="unread-badge" aria-label="{{ g.unread }} unread">{{ g.unread }}</span>
                        }
                      </span>
                    </span>
                  </button>
                </li>
              }
            </ul>
            @if (filteredGroups().length === 0 && !groupsLoading()) {
              <p class="empty side-empty">{{ groups().length === 0 ? 'No groups yet — create one or discover communities to join.' : 'No groups match that filter.' }}</p>
            }
            @if (groupNotice(); as note) {
              <p class="notice side-empty" role="status">{{ note }}</p>
            }
            @if (groupsError(); as err) {
              <p class="error side-empty" role="alert">{{ err }} <button mat-button (click)="loadGroups()">Retry</button></p>
            }
          </aside>

          <div class="chat-main" aria-label="Group conversation">
            @if (openGroup(); as grp) {
              <header class="chat-head">
                <button mat-icon-button class="back-btn" (click)="closeGroupChat()" aria-label="Back to groups">
                  <mat-icon>arrow_back</mat-icon>
                </button>
                <async-avatar [name]="grp.name" size="sm" [photo]="grp.photo ?? null" />
                <span class="chat-peer group-peer" (click)="toggleGroupPanel(true)" role="button" tabindex="0" title="Group info">
                  <strong>{{ grp.name }}</strong>
                  <span class="muted">
                    @if (grp.rankGroup) { Official level group · }
                    {{ grp.members.length }} member{{ grp.members.length === 1 ? '' : 's' }}{{ grp.muted ? ' · Muted' : '' }}
                  </span>
                </span>
                <span class="spacer"></span>
                <button mat-icon-button (click)="toggleFind()" [title]="findOpen() ? 'Close find' : 'Find in conversation'" aria-label="Find in conversation">
                  <mat-icon>search</mat-icon>
                </button>
                <button mat-icon-button (click)="toggleMuteGroup()" [title]="grp.muted ? 'Unmute' : 'Mute'" [attr.aria-label]="grp.muted ? 'Unmute group' : 'Mute group'">
                  <mat-icon>{{ grp.muted ? 'notifications_off' : 'notifications' }}</mat-icon>
                </button>
                <button mat-icon-button (click)="toggleGroupPanel()" title="Group info" aria-label="Group info">
                  <mat-icon>info</mat-icon>
                </button>
              </header>

              @if (findOpen()) {
                <div class="find-bar" role="search">
                  <mat-icon>search</mat-icon>
                  <input [value]="findQuery()" (input)="onFindInput($any($event.target).value)" (keydown.enter)="jumpFind(1)" (keydown.escape)="closeFind()" placeholder="Find in conversation…" aria-label="Find in conversation" />
                  <span class="muted">{{ findPosition() }}</span>
                  <button mat-icon-button (click)="jumpFind(-1)" [disabled]="findMatches().length === 0" aria-label="Previous match">
                    <mat-icon>arrow_upward</mat-icon>
                  </button>
                  <button mat-icon-button (click)="jumpFind(1)" [disabled]="findMatches().length === 0" aria-label="Next match">
                    <mat-icon>arrow_downward</mat-icon>
                  </button>
                  <button mat-icon-button (click)="closeFind()" aria-label="Close find">
                    <mat-icon>close</mat-icon>
                  </button>
                </div>
              }

              @if (grp.pinnedMessage; as pinned) {
                <div class="pinned-bar" role="note">
                  <mat-icon>push_pin</mat-icon>
                  <span class="convo-snippet">{{ senderNameOf(pinned.senderId, pinned.senderLabel) }}: {{ snippet(pinned.body) }}</span>
                  @if (isGroupAdmin()) {
                    <button mat-icon-button (click)="unpinMessage()" title="Unpin" aria-label="Unpin message">
                      <mat-icon>close</mat-icon>
                    </button>
                  }
                </div>
              }

              <div class="thread-scroll" #groupScroll>
                @if (groupLoadingMore()) {
                  <mat-progress-bar mode="indeterminate" aria-label="Loading" />
                } @else if (groupHasMore() && !groupLoading()) {
                  <button mat-button class="load-older" (click)="loadOlderGroupMessages()">Load older messages</button>
                }
                @if (groupLoading()) {
                  <mat-progress-bar mode="indeterminate" aria-label="Loading" />
                }
                @if (groupError(); as err) {
                  <p class="error" role="alert">{{ err }} <button mat-button (click)="openGroupChat(openGroupId()!)">Retry</button></p>
                }
                @for (day of groupDays(); track day.key) {
                  <div class="day-chip" aria-hidden="true"><span>{{ day.label }}</span></div>
                  <ol class="bubble-list">
                    @for (m of day.msgs; track m.clientId ?? m.id) {
                      <li class="bubble" [class.bubble--mine]="m.senderId === myId()" [class.bubble--pending]="m.pending" [attr.data-mid]="m.clientId ?? m.id">
                        @if (m.senderId !== myId()) {
                          <span class="bubble-sender">{{ senderNameOf(m.senderId, m.senderLabel) }}
                            @if (memberRoleOf(m.senderId) === 'admin') {
                              <span class="admin-badge">admin</span>
                            }
                          </span>
                        }
                        @if (editingGroupMsg() === m.id) {
                          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="edit-field">
                            <input matInput [value]="editDraft()" (input)="editDraft.set($any($event.target).value)" maxlength="2000" aria-label="Edit message" />
                          </mat-form-field>
                          <span class="msg-actions">
                            <button mat-button (click)="saveEditGroupMsg()">Save</button>
                            <button mat-button (click)="editingGroupMsg.set(null)">Cancel</button>
                          </span>
                        } @else {
                          @if (m.attachments?.length) {
                            <span class="attach-grid">
                              @for (a of m.attachments!; track a.url) {
                                @if (a.mime.startsWith('image/')) {
                                  <a [href]="a.url" target="_blank" rel="noopener"><img [src]="a.url" alt="Shared photo" loading="lazy" /></a>
                                } @else {
                                  <video [src]="a.url" controls preload="metadata"></video>
                                }
                              }
                            </span>
                          }
                          @if (m.body?.trim()) {
                            <p>{{ m.body }}</p>
                          }
                          @if (m.editedAt) {
                            <span class="muted edited-tag">(edited)</span>
                          }
                        }
                        <span class="bubble-meta">
                          <span class="muted">{{ m.createdAt | date:'shortTime' }}</span>
                          @if (m.senderId === myId()) {
                            @if (m.pending) {
                              <mat-icon class="ticks" aria-label="Sending">schedule</mat-icon>
                            } @else if (m.failed) {
                              <button mat-icon-button class="retry" (click)="retryGroupTemp(m.clientId!)" title="Retry send" aria-label="Retry send">
                                <mat-icon>error_outline</mat-icon>
                              </button>
                            } @else {
                              <mat-icon class="ticks" [class.ticks--read]="isSeenByAll(m)" [title]="seenTitle(m)" aria-label="Delivered">done_all</mat-icon>
                            }
                          }
                          @if (canModifyGroupMsg(m)) {
                            <button mat-icon-button class="mini-btn" (click)="startEditGroupMsg(m)" title="Edit" aria-label="Edit message">
                              <mat-icon>edit</mat-icon>
                            </button>
                          }
                          @if (canDeleteGroupMsg(m)) {
                            <button mat-icon-button class="mini-btn" (click)="deleteGroupMsg(m.id)" title="Delete" aria-label="Delete message">
                              <mat-icon>delete_outline</mat-icon>
                            </button>
                          }
                          @if (isGroupAdmin() && m.senderId !== myId()) {
                            <button mat-icon-button class="mini-btn" (click)="pinMessage(m.id)" title="Pin" aria-label="Pin message">
                              <mat-icon>push_pin</mat-icon>
                            </button>
                          }
                          @if (m.senderId !== myId()) {
                            <button mat-icon-button class="mini-btn" (click)="toggleReportGroupMsg(m.id)" title="Report" aria-label="Report message">
                              <mat-icon>flag</mat-icon>
                            </button>
                          }
                          @if (!m.pending && !m.failed) {
                            <button mat-icon-button class="mini-btn" (click)="startForward(m)" title="Forward to another group" aria-label="Forward message">
                              <mat-icon>forward</mat-icon>
                            </button>
                          }
                        </span>
                        @if (reportingGroupMsg() === m.id) {
                          <span class="report-row">
                            <input [value]="reportReason()" (input)="reportReason.set($any($event.target).value)" maxlength="300" placeholder="Reason (optional)" aria-label="Report reason" />
                            <button mat-button (click)="reportGroupMsg(m.id)">Report</button>
                            <button mat-button (click)="reportingGroupMsg.set(null)">Cancel</button>
                          </span>
                        }
                      </li>
                    }
                  </ol>
                }
                @if (groupSendError(); as err) {
                  <p class="error" role="alert">{{ err }}</p>
                }
              </div>

              @if (groupTypingText(); as typingText) {
                <div class="typing-bar" aria-live="polite">
                  <span class="typing-dots" aria-hidden="true"><span></span><span></span><span></span></span>
                  <span class="typing-text">{{ typingText }}</span>
                </div>
              }

              <div class="composer">
                @if (groupFiles().length > 0 || groupUploading()) {
                  <div class="attach-preview" aria-label="Attachments to send">
                    @for (f of groupFiles(); track f.url; let i = $index) {
                      <span class="attach-thumb">
                        @if (f.mime.startsWith('image/')) {
                          <img [src]="f.url" [alt]="f.name" />
                        } @else {
                          <mat-icon>movie</mat-icon>
                        }
                        <button mat-icon-button class="attach-remove" (click)="removeGroupFile(i)" aria-label="Remove attachment">
                          <mat-icon>close</mat-icon>
                        </button>
                      </span>
                    }
                    @if (groupUploading()) {
                      <mat-progress-bar mode="indeterminate" class="attach-progress" aria-label="Loading" />
                    }
                  </div>
                }
                <input
                  #groupFileInput hidden type="file" multiple accept="image/*,video/*"
                  (change)="onGroupFilesSelected($any($event.target).files); $any($event.target).value = ''"
                  aria-label="Attach photos or videos"
                />
                <button mat-icon-button (click)="groupFileInput.click()" [disabled]="groupFiles().length >= 4 || groupUploading()" title="Attach photos or videos" aria-label="Attach photos or videos">
                  <mat-icon>attach_file</mat-icon>
                </button>
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>Message {{ grp.name }}…</mat-label>
                  <textarea
                    matInput rows="2"
                    [value]="groupDraft()"
                    (input)="onGroupDraftInput($any($event.target).value)"
                    (keydown.enter)="onGroupComposerKey($any($event))"
                    (blur)="groupTypingStop()"
                    maxlength="2000"
                  ></textarea>
                </mat-form-field>
                <button mat-fab color="primary" class="send-btn" (click)="sendGroupReply()" [disabled]="(!groupDraft().trim() && groupFiles().length === 0) || groupSending() || groupUploading()" aria-label="Send message">
                  <mat-icon>{{ groupSending() ? 'more_horiz' : 'send' }}</mat-icon>
                </button>
              </div>

              @if (forwardingMsg(); as fwd) {
                <div class="forward-bar" role="region" aria-label="Forward message">
                  <span class="muted">Forward to:</span>
                  <mat-form-field appearance="outline" subscriptSizing="dynamic">
                    <mat-label>Group</mat-label>
                    <mat-select [value]="''" (selectionChange)="sendForward($event.value)" aria-label="Target group">
                      @for (g of groups(); track g.id) {
                        @if (g.id !== openGroupId()) {
                          <mat-option [value]="g.id">{{ g.name }}</mat-option>
                        }
                      }
                    </mat-select>
                  </mat-form-field>
                  <span class="muted forward-preview">{{ snippet(fwd.body) }}</span>
                  <button mat-button (click)="cancelForward()">Cancel</button>
                </div>
              }
            } @else if (groupInvite(); as inv) {
              <div class="invite-card" role="region" aria-label="Group invite">
                <async-avatar [name]="inv.name" size="md" [photo]="inv.photo ?? null" />
                <h3>{{ inv.name }}</h3>
                <p class="muted">{{ inv.memberCount ?? 0 }} member{{ (inv.memberCount ?? 0) === 1 ? '' : 's' }} · {{ inv.joinPolicy === 'open' ? 'Open group' : 'Approval required' }}</p>
                @if (inv.description) {
                  <p>{{ inv.description }}</p>
                }
                <div class="row-actions">
                  <button mat-flat-button color="primary" (click)="joinInvite()">Join group</button>
                  <button mat-button (click)="dismissInvite()">Dismiss</button>
                </div>
              </div>
            } @else {
              @if (inviteLoading()) {
                <div class="chat-empty">
                  <mat-progress-bar mode="indeterminate" aria-label="Loading" />
                </div>
              } @else {
                <div class="chat-empty">
                  <mat-icon>groups</mat-icon>
                  <p>Pick a group — or create one. Approvals land with the admins.</p>
                </div>
              }
            }
          </div>

          @if (showGroupPanel() && openGroup(); as grp) {
            <aside class="group-panel" aria-label="Group info">
              <div class="panel-head">
                <strong>Group info</strong>
                <button mat-icon-button (click)="toggleGroupPanel(false)" aria-label="Close panel">
                  <mat-icon>close</mat-icon>
                </button>
              </div>
              <div class="panel-tabs" role="tablist">
                <button mat-button [class.active-tab]="groupPanel() === 'members'" (click)="groupPanel.set('members')">Members</button>
                @if (isGroupAdmin()) {
                  @if (!grp.rankGroup) {
                    <button mat-button [class.active-tab]="groupPanel() === 'requests'" (click)="switchGroupPanel('requests')">
                      Requests @if ((grp.pendingRequests?.length ?? 0) > 0) { ({{ grp.pendingRequests!.length }}) }
                    </button>
                  }
                  <button mat-button [class.active-tab]="groupPanel() === 'reports'" (click)="switchGroupPanel('reports')">Reports</button>
                }
                <button mat-button [class.active-tab]="groupPanel() === 'settings'" (click)="groupPanel.set('settings')">Settings</button>
              </div>

              @if (groupPanel() === 'members') {
                @if (isGroupAdmin() && !grp.rankGroup) {
                  <p class="muted add-hint">Add anyone on the platform — search by name or username.</p>
                  <mat-form-field appearance="outline" subscriptSizing="dynamic">
                    <mat-label>Find anyone…</mat-label>
                    <input matInput [value]="memberSearch()" (input)="onMemberSearch($any($event.target).value)" placeholder="Name or username, min 2 letters" />
                    <mat-icon matSuffix>person_search</mat-icon>
                  </mat-form-field>
                  @if (memberSearching()) {
                    <mat-progress-bar mode="indeterminate" aria-label="Loading" />
                  }
                  @if (memberHits().length > 0) {
                    <ul class="people-list">
                      @for (p of memberHits(); track p.id) {
                        <li>
                          <async-avatar [name]="p.name" size="xs" [photo]="p.photo ?? null" />
                          <span class="people-name">
                            <strong>{{ p.name }}</strong>
                            <span class="muted">@{{ p.username }}</span>
                          </span>
                          <button mat-button (click)="addMember(p.id)">Add</button>
                        </li>
                      }
                    </ul>
                  }
                }
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>Filter members</mat-label>
                  <input matInput [value]="groupMemberFilter()" (input)="groupMemberFilter.set($any($event.target).value)" />
                </mat-form-field>
                <ul class="member-list">
                  @for (m of filteredGroupMembers(); track m.id) {
                    <li>
                      <async-avatar [name]="m.name" size="xs" [photo]="m.photo ?? null" [presence]="avatarPresence(m.id)" />
                      <span class="people-name">
                        <strong>{{ m.name }}</strong>
                        <span class="muted">{{ memberRoleOf(m.id) === 'admin' ? 'Admin' : 'Member' }}</span>
                      </span>
                      @if (isGroupAdmin() && m.id !== myId() && m.id !== grp.createdBy) {
                        <button mat-icon-button [title]="memberRoleOf(m.id) === 'admin' ? 'Demote' : 'Make admin'" (click)="toggleAdmin(m)">
                          <mat-icon>{{ memberRoleOf(m.id) === 'admin' ? 'star' : 'star_outline' }}</mat-icon>
                        </button>
                        @if (!grp.rankGroup) {
                          <button mat-icon-button title="Remove" aria-label="Remove member" (click)="removeMember(m.id)">
                            <mat-icon>person_remove</mat-icon>
                          </button>
                        }
                        <button mat-icon-button title="Ban" aria-label="Ban member" (click)="banMember(m.id)">
                          <mat-icon>block</mat-icon>
                        </button>
                      }
                    </li>
                  }
                </ul>
                @if (isGroupAdmin()) {
                  <div class="banned-block">
                    <p class="muted banned-title">Banned ({{ groupBansList().length }}) — bans block re-entry until lifted.</p>
                    @if (groupBansList().length === 0) {
                      <p class="empty">Nobody banned.</p>
                    } @else {
                      <ul class="member-list">
                        @for (b of groupBansList(); track b.partnerId) {
                          <li>
                            <async-avatar [name]="b.name ?? 'Member'" size="xs" [photo]="b.photo ?? null" />
                            <span class="people-name">
                              <strong>{{ b.name ?? 'Former member' }}</strong>
                              <span class="muted">{{ b.reason || 'No reason given' }}</span>
                            </span>
                            <button mat-button (click)="unbanMember(b.partnerId)">Unban</button>
                          </li>
                        }
                      </ul>
                    }
                  </div>
                }
              }

              @if (groupPanel() === 'requests' && isGroupAdmin()) {
                @if ((grp.pendingRequests?.length ?? 0) === 0) {
                  <p class="empty">No pending requests.</p>
                } @else {
                  <ul class="member-list">
                    @for (r of grp.pendingRequests!; track requestKey(r)) {
                      <li>
                        <async-avatar [name]="r.requester?.name ?? 'Teammate'" size="xs" [photo]="r.requester?.photo ?? null" />
                        <span class="people-name">
                          <strong>{{ r.requester?.name ?? 'Teammate' }}</strong>
                          <span class="muted">@{{ r.requester?.username ?? 'member' }}</span>
                        </span>
                        <button mat-button (click)="decideRequest(requestKey(r), 'approve')">Approve</button>
                        <button mat-button (click)="decideRequest(requestKey(r), 'reject')">Decline</button>
                      </li>
                    }
                  </ul>
                }
              }

              @if (groupPanel() === 'reports' && isGroupAdmin()) {
                @if (groupReportsList().length === 0) {
                  <p class="empty">No open reports. @if (!reportsLoaded()) { <button mat-button (click)="loadReports()">Check now</button> }</p>
                } @else {
                  <ul class="report-list">
                    @for (r of groupReportsList(); track reportKey(r)) {
                      <li>
                        <p class="report-body">{{ r.message?.body ?? '(message removed)' }}</p>
                        <p class="muted">Reason: {{ r.reason || '—' }}</p>
                        <span class="msg-actions">
                          <button mat-button (click)="decideReport(reportKey(r), 'dismiss')">Dismiss</button>
                          <button mat-button color="warn" (click)="decideReport(reportKey(r), 'remove')">Remove</button>
                          <button mat-button color="warn" (click)="decideReport(reportKey(r), 'remove', true)">Remove + ban</button>
                        </span>
                      </li>
                    }
                  </ul>
                }
              }

              @if (groupPanel() === 'settings') {
                @if (grp.rankGroup) {
                  <div class="settings-stack">
                    <p class="muted">
                      This is your official {{ grp.rankGroup }} level group. Membership is automatic —
                      you can mute it, but you cannot leave.
                    </p>
                    <button mat-stroked-button (click)="toggleMuteGroup()">{{ grp.muted ? 'Unmute this group' : 'Mute this group' }}</button>
                    @if (groupNotice(); as note) {
                      <p class="notice" role="status">{{ note }}</p>
                    }
                  </div>
                } @else {
                  <div class="settings-stack">
                    <button mat-stroked-button (click)="copyInviteLink()">
                      <mat-icon>link</mat-icon> Copy invite link
                    </button>
                    @if (isGroupAdmin()) {
                      <div class="photo-row">
                        <async-avatar [name]="grp.name" size="md" [photo]="grp.photo ?? null" />
                        <span class="photo-actions">
                          <input
                            #groupPhotoInput
                            type="file" accept="image/jpeg,image/png,image/webp" hidden
                            (change)="onGroupPhotoSelected($any($event.target).files?.[0]); $any($event.target).value = ''"
                            [disabled]="groupPhotoBusy()"
                            aria-label="Upload group photo"
                          />
                          <button mat-stroked-button type="button" (click)="groupPhotoInput.click()" [disabled]="groupPhotoBusy()">
                            {{ groupPhotoBusy() ? 'Uploading…' : 'Change photo' }}
                          </button>
                          @if (groupPhotoError(); as err) {
                            <span class="error" role="alert">{{ err }}</span>
                          }
                        </span>
                      </div>
                      <mat-form-field appearance="outline" subscriptSizing="dynamic">
                        <mat-label>Group name</mat-label>
                        <input matInput [value]="groupSettingsName()" (input)="groupSettingsName.set($any($event.target).value)" maxlength="80" />
                      </mat-form-field>
                      <mat-form-field appearance="outline" subscriptSizing="dynamic">
                        <mat-label>Description</mat-label>
                        <input matInput [value]="groupSettingsDesc()" (input)="groupSettingsDesc.set($any($event.target).value)" maxlength="500" />
                      </mat-form-field>
                      <mat-form-field appearance="outline" subscriptSizing="dynamic">
                        <mat-label>Join policy</mat-label>
                        <mat-select [value]="groupSettingsPolicy()" (selectionChange)="groupSettingsPolicy.set($event.value)">
                          <mat-option value="approval">Approval</mat-option>
                          <mat-option value="open">Open</mat-option>
                        </mat-select>
                      </mat-form-field>
                      <button mat-stroked-button (click)="saveGroupSettings()" [disabled]="groupActionBusy() === 'settings'">Save settings</button>
                    }
                    <button mat-stroked-button (click)="toggleMuteGroup()">{{ grp.muted ? 'Unmute this group' : 'Mute this group' }}</button>
                    <button mat-stroked-button color="warn" (click)="leaveGroup()">Leave group</button>
                    @if (isGroupCreator() || isGroupAdmin()) {
                      <button mat-stroked-button color="warn" (click)="deleteGroup()" [disabled]="groupActionBusy() === 'delete'">Delete group</button>
                    }
                    @if (groupNotice(); as note) {
                      <p class="notice" role="status">{{ note }}</p>
                    }
                  </div>
                }
              }
            </aside>
          }
        </div>
      } @else {
        <div class="compose-wrap">
          <button mat-button (click)="toggleCompose()">{{ showCompose() ? 'Cancel' : 'New announcement' }}</button>
          @if (showCompose()) {
            <form class="compose-form" [formGroup]="form" (ngSubmit)="send()">
              <mat-button-toggle-group [value]="composeKind()" (change)="setKind($event.value)" aria-label="Message type">
                <mat-button-toggle value="direct">Direct</mat-button-toggle>
                <mat-button-toggle value="announcement">Announcement</mat-button-toggle>
                @if (teamId()) {
                  <mat-button-toggle value="team">Team</mat-button-toggle>
                }
              </mat-button-toggle-group>
              @if (composeKind() === 'team' && teamName()) {
                <p class="muted" role="note">To every member of {{ teamName() }} — teammates only.</p>
              }
              @if (composeKind() === 'direct') {
                <mat-form-field appearance="outline">
                  <mat-label>To</mat-label>
                  <mat-select formControlName="to">
                    @for (c of contacts(); track c.id) {
                      <mat-option [value]="c.id">{{ c.name }} ({{ c.username }}) · {{ c.relation }}{{ presenceSuffix(c.id) }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
              } @else {
                <mat-form-field appearance="outline">
                  <mat-label>Title</mat-label>
                  <input matInput formControlName="title" maxlength="120" placeholder="e.g. Team call tonight" />
                </mat-form-field>
                @if (composeKind() === 'team' && teamName()) {
                  <p class="muted" role="note">Audience: {{ teamName() }} members only.</p>
                } @else {
                  <mat-form-field appearance="outline">
                    <mat-label>Audience</mat-label>
                    <mat-select formControlName="scope">
                      <mat-option value="direct">Direct team</mat-option>
                      <mat-option value="all">Entire downline (broadcast)</mat-option>
                    </mat-select>
                  </mat-form-field>
                }
              }
              @if (replyingTo(); as reply) {
                <div class="reply-context" role="note">
                  <span class="muted">Replying to {{ reply.sender?.name ?? 'teammate' }}</span>
                  <blockquote>{{ snippet(reply.body) }}</blockquote>
                </div>
              }
              <mat-form-field appearance="outline">
                <mat-label>Message</mat-label>
                <textarea matInput rows="3" formControlName="body" maxlength="2000"></textarea>
              </mat-form-field>
              <div class="form-actions">
                <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || sending()">
                  {{ sending() ? 'Sending…' : (composeKind() === 'direct' ? 'Send' : 'Announce') }}
                </button>
                @if (sendError(); as err) {
                  <span class="error" role="alert">{{ err }}</span>
                }
                @if (sentNotice(); as notice) {
                  <span class="notice" role="status">{{ notice }}</span>
                }
              </div>
            </form>
          }

          <h3>Team & announcements ({{ broadcasts().length }})</h3>
          @if (broadcasts().length > 0) {
            <ul class="message-list">
              @for (msg of broadcasts(); track msg.id) {
                <li class="message-card" [class.message-card--unread]="!msg.readAt" [class.message-card--team]="msg.kind === 'team'">
                  <div class="message-top">
                    <strong>{{ msg.sender?.name ?? 'Teammate' }}</strong>
                    <span class="dp-status {{ kindTone(msg.kind) }}">{{ kindLabel(msg) }}</span>
                    <span class="muted">{{ msg.createdAt | date:'short' }}</span>
                  </div>
                  @if (msg.title) {
                    <strong>{{ msg.title }}</strong>
                  }
                  <p>{{ msg.body }}</p>
                  <div class="message-actions">
                    @if (!msg.readAt) {
                      <button mat-button (click)="open(msg)">Mark as read</button>
                    }
                    @if (canReply(msg)) {
                      <button mat-button (click)="reply(msg)">Reply</button>
                    }
                  </div>
                </li>
              }
            </ul>
          } @else if (!loading()) {
            <p class="empty">Nothing here — team messages and announcements will appear in this feed.</p>
          }

          <h3>Sent ({{ sentBroadcasts().length }})</h3>
          @if (sentBroadcasts().length > 0) {
            <ul class="message-list">
              @for (msg of sentBroadcasts(); track msg.id) {
                <li class="message-card">
                  <div class="message-top">
                    <strong>To {{ msg.recipient?.name ?? 'teammate' }}</strong>
                    <span class="dp-status {{ kindTone(msg.kind) }}">{{ kindLabel(msg) }}</span>
                    <span class="muted">{{ msg.createdAt | date:'short' }}</span>
                  </div>
                  @if (msg.title) {
                    <strong>{{ msg.title }}</strong>
                  }
                  <p>{{ msg.body }}</p>
                </li>
              }
            </ul>
          } @else if (!loading()) {
            <p class="empty">Nothing sent yet.</p>
          }
        </div>
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    /* Chat suite styles (DM + groups + channels) live in global styles.scss,
       scoped under the page-unique .messages-page root. */
  `],
})
export class MessagesComponent implements OnInit {
  private readonly messages = inject(MessageService);
  private readonly community = inject(CommunityService);
  private readonly auth = inject(AuthService);
  private readonly presence = inject(PresenceService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);
  protected readonly chat = inject(ChatSocketService);
  /** counterpart/contact id → lastSeenAt (null = offline/stranger). */
  protected readonly presenceMap = signal<Record<string, string | null>>({});
  /** Live socket presence overrides (true/false); absent = fall back to presenceMap. */
  protected readonly livePresence = signal<Record<string, boolean>>({});
  /** counterparts currently typing. */
  protected readonly typingFrom = signal<Record<string, number>>({});

  protected readonly loading = signal(true);
  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly sendError = signal<string | null>(null);
  protected readonly sentNotice = signal<string | null>(null);
  protected readonly showCompose = signal(false);
  protected readonly composeKind = signal<ComposeKind>('direct');
  protected readonly teamId = signal<string | null>(null);
  protected readonly teamName = signal('');
  protected readonly replyingTo = signal<Message | null>(null);
  protected readonly view = signal<'chats' | 'channels' | 'groups'>('chats');
  protected readonly inbox = signal<Message[]>([]);
  protected readonly sent = signal<Message[]>([]);
  protected readonly contacts = signal<Contact[]>([]);
  protected readonly unread = signal(0);
  protected readonly searchQuery = signal('');
  protected readonly startingChat = signal(false);
  protected readonly openThreadId = signal<string | null>(null);
  protected readonly openThreadName = signal<{ id: string; name: string } | null>(null);
  /** Deep-link handoff from team pages: open this thread once contacts load. */
  private pendingDirectChat: { id: string; name: string } | null = null;
  /** Admin deep link (?group=) — open an official or ordinary group directly. */
  private pendingGroupId: string | null = null;
  protected readonly threadMsgs = signal<ChatMsg[]>([]);
  protected readonly threadLoading = signal(false);
  protected readonly threadError = signal<string | null>(null);
  protected readonly threadHasMore = signal(false);
  protected readonly threadLoadingMore = signal(false);
  protected readonly threadSending = signal(false);
  protected readonly threadSendError = signal<string | null>(null);
  protected readonly replyDraft = signal('');
  protected readonly peopleQuery = signal('');
  protected readonly people = signal<Array<{ id: string; username: string; name: string; photo: string | null }>>([]);
  protected readonly peopleLoading = signal(false);
  private lastTypingSent = 0;
  private peopleTimer: ReturnType<typeof setTimeout> | null = null;
  private typingTimers: Record<string, ReturnType<typeof setTimeout>> = {};

  /* ---------- Group chat state ---------- */
  protected readonly groups = signal<GroupSummary[]>([]);
  protected readonly groupsLoading = signal(false);
  protected readonly groupsError = signal<string | null>(null);
  protected readonly groupNotice = signal<string | null>(null);
  protected readonly openGroupId = signal<string | null>(null);
  protected readonly openGroup = signal<GroupDetail | null>(null);
  protected readonly groupMsgs = signal<GroupMessage[]>([]);
  protected readonly groupLoading = signal(false);
  protected readonly groupError = signal<string | null>(null);
  protected readonly groupSending = signal(false);
  protected readonly groupSendError = signal<string | null>(null);
  protected readonly groupDraft = signal('');
  protected readonly groupFiles = signal<Array<GroupAttachment & { name: string }>>([]);
  protected readonly groupUploading = signal(false);
  protected readonly groupHasMore = signal(false);
  protected readonly groupLoadingMore = signal(false);
  protected readonly creatingGroup = signal(false);
  protected readonly groupCreating = signal(false);
  protected readonly groupName = signal('');
  protected readonly groupDescription = signal('');
  protected readonly groupPolicy = signal<'open' | 'approval'>('approval');
  protected readonly groupFormError = signal<string | null>(null);
  protected readonly groupSearch = signal('');
  protected readonly groupHits = signal<GroupHit[]>([]);
  protected readonly groupSearching = signal(false);
  protected readonly groupActionBusy = signal<string | null>(null);
  protected readonly showGroupPanel = signal(false);
  protected readonly groupPanel = signal<'members' | 'requests' | 'reports' | 'settings'>('members');
  protected readonly groupMemberFilter = signal('');
  protected readonly groupReportsList = signal<GroupReport[]>([]);
  protected readonly reportsLoaded = signal(false);
  protected readonly groupBansList = signal<GroupBan[]>([]);
  protected readonly groupInvite = signal<GroupInvite | null>(null);
  protected readonly inviteLoading = signal(false);
  protected readonly editingGroupMsg = signal<string | null>(null);
  protected readonly editDraft = signal('');
  protected readonly reportingGroupMsg = signal<string | null>(null);
  protected readonly reportReason = signal('');
  /** Staged outgoing forward (picked from a bubble, target chosen below the composer). */
  protected readonly forwardingMsg = signal<GroupMessage | null>(null);
  protected readonly groupSettingsName = signal('');
  protected readonly groupSettingsDesc = signal('');
  protected readonly groupSettingsPolicy = signal<'open' | 'approval'>('approval');
  protected readonly groupPhotoBusy = signal(false);
  protected readonly groupPhotoError = signal<string | null>(null);
  /** In-thread find state (shared: only one thread visible at a time). */
  protected readonly findOpen = signal(false);
  protected readonly findQuery = signal('');
  protected readonly findMatches = signal<string[]>([]);
  protected readonly findIdx = signal(0);
  /** Composite `${groupId}:${senderId}` → last typing stamp. */
  protected readonly groupTyping = signal<Record<string, number>>({});
  /** Global platform search for adding members (admins) — not network-limited. */
  protected readonly memberSearch = signal('');
  protected readonly memberHits = signal<PersonHit[]>([]);
  protected readonly memberSearching = signal(false);
  private memberSearchTimer: ReturnType<typeof setTimeout> | null = null;
  /** Filter for my groups in the sidebar. */
  protected readonly groupFilter = signal('');
  private groupSearchTimer: ReturnType<typeof setTimeout> | null = null;
  private lastGroupTypingSent: Record<string, number> = {};

  @ViewChild('threadScroll') private threadScroll?: ElementRef<HTMLDivElement>;

  protected readonly form = this.fb.nonNullable.group({
    to: [''],
    title: [''],
    scope: ['direct' as 'direct' | 'all'],
    body: ['', [Validators.required, Validators.maxLength(2000)]],
  });

  ngOnInit(): void {
    const directChatId = this.route.snapshot.queryParamMap.get('chat')?.trim() ?? '';
    const directChatName = this.route.snapshot.queryParamMap.get('chatName')?.trim() ?? '';
    if (directChatId) this.pendingDirectChat = { id: directChatId, name: directChatName };
    const groupChatId = this.route.snapshot.queryParamMap.get('group')?.trim() ?? '';
    if (groupChatId) {
      this.pendingGroupId = groupChatId;
      this.view.set('groups');
    }
    this.reload();
    this.chat.connect();
    this.wireSocket();
    // Offline fallback polling: REST is the source of truth when the
    // socket is down, so the page never goes stale.
    interval(POLL_THREAD_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.chat.connected() || document.hidden) return;
        const id = this.openThreadId();
        if (id) this.loadThreadSilent(id);
        const gid = this.openGroupId();
        if (gid && this.view() === 'groups') this.loadGroupThreadSilent(gid);
      });
    interval(POLL_LISTS_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.chat.connected() || document.hidden) return;
        this.refreshListsSilent();
        if (this.view() === 'groups') this.loadGroupsSilent();
      });
    // Returning tabs catch up immediately instead of waiting for a poll.
    fromEvent(window, 'focus')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.chat.connected()) return;
        const id = this.openThreadId();
        if (id) this.loadThreadSilent(id);
        this.refreshListsSilent();
      });
    // Invite-link handoff (?joinGroup=): members land straight in, everyone
    // else gets a join card. Independent of the team handoffs below.
    const joinGroupId = this.route.snapshot.queryParamMap.get('joinGroup')?.trim() ?? '';
    // Team group handoff (?teamGroup=): open the team's group conversation,
    // creating it on first visit. Takes precedence over the ?team= channel
    // prefill below (different intent: chat vs broadcast).
    const teamGroupId = this.route.snapshot.queryParamMap.get('teamGroup')?.trim() ?? '';
    if (this.pendingDirectChat) {
      // Direct-chat handoff (?chat=&chatName=) is opened after reload loads contacts.
    } else if (teamGroupId) {
      this.openTeamGroupChat(teamGroupId);
    } else if (joinGroupId) {
      this.openJoinGroupCard(joinGroupId);
    } else {
      // Team handoff (?team=&teamName=): open the team channel prefilled.
      const team = this.route.snapshot.queryParamMap.get('team')?.trim() ?? '';
      const teamName = this.route.snapshot.queryParamMap.get('teamName')?.trim() ?? '';
      if (team && teamName) {
        this.teamId.set(team);
        this.teamName.set(teamName);
        this.composeKind.set('team');
        this.form.patchValue({ title: `[${teamName}] ` });
        this.view.set('channels');
        this.showCompose.set(true);
      }
    }
  }

  /** True when the user sits at the live edge (or layout unknown). */
  private scrollerPinned(el: HTMLElement | null | undefined): boolean {
    if (!el) return true;
    try {
      return el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    } catch {
      return true;
    }
  }

  /** Socket → view-state bridges (all guarded, never throw into the socket). */
  private wireSocket(): void {
    this.chat.message$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((m) => this.onSocketMessage(m));
    this.chat.groupMessage$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ message, groupId }) => this.onGroupSocketMessage(message, groupId));
    this.chat.rankGroupChanged$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => this.onRankGroupChanged(event));
    this.chat.groupTyping$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ from, typing, groupId }) => {
      const key = `${groupId}:${from}`;
      if (String(from) === this.myId()) return;
      if (typing) {
        this.groupTyping.set({ ...this.groupTyping(), [key]: Date.now() });
        clearTimeout(this.typingTimers[key]);
        this.typingTimers[key] = setTimeout(() => {
          this.groupTyping.set(Object.fromEntries(Object.entries(this.groupTyping()).filter(([k]) => k !== key)));
        }, TYPING_CLEAR_MS);
      } else {
        clearTimeout(this.typingTimers[key]);
        this.groupTyping.set(Object.fromEntries(Object.entries(this.groupTyping()).filter(([k]) => k !== key)));
      }
    });
    this.chat.read$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ messageId }) => {
      this.threadMsgs.set(this.threadMsgs().map((x) => (x.id === messageId ? { ...x, readAt: x.readAt ?? new Date().toISOString() } : x)));
    });
    this.chat.typing$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ from, typing }) => {
      const id = String(from);
      if (typing) {
        this.typingFrom.set({ ...this.typingFrom(), [id]: Date.now() });
        clearTimeout(this.typingTimers[id]);
        this.typingTimers[id] = setTimeout(() => {
          this.typingFrom.set(Object.fromEntries(Object.entries(this.typingFrom()).filter(([k]) => k !== id)));
        }, TYPING_CLEAR_MS);
      } else {
        clearTimeout(this.typingTimers[id]);
        this.typingFrom.set(Object.fromEntries(Object.entries(this.typingFrom()).filter(([k]) => k !== id)));
      }
    });
    this.chat.presence$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ userId, online }) => {
      const id = String(userId);
      this.livePresence.set({ ...this.livePresence(), [id]: !!online });
    });
    this.chat.reconnected$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.refreshListsSilent();
      const id = this.openThreadId();
      if (id) this.loadThreadSilent(id);
      if (this.view() === 'groups' || this.groups().length > 0) this.loadGroupsSilent();
      const gid = this.openGroupId();
      if (gid) {
        this.chat.joinGroupRoom(gid);
        this.loadGroupThreadSilent(gid);
      }
    });
  }

  /** Incoming live message: open thread absorbs it, others bump counts. */
  private onSocketMessage(m: Message): void {
    const me = this.myId();
    const counterpart = String(m.senderId) === me ? String(m.recipientId) : String(m.senderId);
    if (this.openThreadId() && counterpart === this.openThreadId()) {
      const pinned = this.scrollerPinned(this.threadScroll?.nativeElement);
      if (String(m.senderId) === me) {
        // Own echo: fold into the oldest pending bubble instead of duplicating.
        const tempIdx = this.threadMsgs().findIndex((x) => x.pending && String(x.recipientId) === counterpart);
        if (tempIdx >= 0) {
          const rows = [...this.threadMsgs()];
          rows[tempIdx] = { ...m };
          this.threadMsgs.set(rows.sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime()));
          if (pinned) this.scrollSoon();
          return;
        }
      }
      if (!this.threadMsgs().some((x) => x.id === m.id)) {
        this.threadMsgs.set([...this.threadMsgs(), m]);
        if (pinned) this.scrollSoon();
      }
      if (String(m.senderId) !== me && !m.readAt) this.markReadBoth(m);
    } else {
      if (String(m.senderId) !== me) this.unread.set(this.unread() + 1);
      this.refreshListsSilent();
    }
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      inbox: this.messages.inbox(),
      sent: this.messages.sent(),
      contacts: this.messages.contacts(),
      unread: this.messages.unreadCount(),
      groups: this.messages.myGroups(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ inbox, sent, contacts, unread, groups }) => {
          this.inbox.set(inbox.data ?? []);
          this.sent.set(sent.data ?? []);
          this.contacts.set(contacts.data ?? []);
          this.unread.set(unread.data?.unread ?? 0);
          this.groups.set(sortGroupSummaries(groups.data ?? []));
          this.loading.set(false);
          this.refreshPresence();
          this.openPendingDirectChat();
          this.openPendingGroupChat();
        },
        error: (err: ApiError) => {
          this.error.set(userError(err));
          this.loading.set(false);
        },
      });
  }

  /** Silent list refresh (socket events + offline polling) — no spinners. */
  private refreshListsSilent(): void {
    forkJoin({
      inbox: this.messages.inbox(),
      sent: this.messages.sent(),
      contacts: this.messages.contacts(),
      unread: this.messages.unreadCount(),
      groups: this.messages.myGroups(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ inbox, sent, contacts, unread, groups }) => {
          this.inbox.set(inbox.data ?? []);
          this.sent.set(sent.data ?? []);
          this.contacts.set(contacts.data ?? []);
          this.unread.set(unread.data?.unread ?? 0);
          this.groups.set(sortGroupSummaries(groups.data ?? []));
          this.refreshPresence();
        },
        error: () => {},
      });
  }

  /** Header badge: DM unreads plus per-group unreads. */
  protected readonly groupUnreadTotal = computed(() =>
    this.groups().reduce((sum, g) => sum + (g.unread ?? 0), 0));
  protected readonly totalUnread = computed(() => this.unread() + this.groupUnreadTotal());

  protected toggleCompose(): void {
    this.showCompose.set(!this.showCompose());
    if (!this.showCompose()) this.replyingTo.set(null);
    this.sendError.set(null);
    this.sentNotice.set(null);
  }

  protected setKind(kind: ComposeKind): void {
    this.composeKind.set(kind);
    this.sendError.set(null);
  }

  protected startChat(id: string): void {
    if (!id) return;
    this.searchQuery.set('');
    this.peopleQuery.set('');
    this.people.set([]);
    this.openChat(id);
  }

  protected kindLabel(msg: Message): string {
    if (msg.kind === 'broadcast') return 'Broadcast';
    if (msg.kind === 'announcement') return 'Announcement';
    if (msg.kind === 'team') return 'Team';
    return 'Direct';
  }

  protected kindTone(kind: Message['kind']): string {
    switch (kind) {
      case 'team': return 'dp-status--info';
      case 'announcement': return 'dp-status--warn';
      case 'broadcast': return 'dp-status--bad';
      default: return 'dp-status--ok';
    }
  }

  protected myId(): string {
    return String(this.auth.currentUser()?.id ?? '');
  }

  /** Presence dot for a counterpart id (null hides it). */
  protected presenceOf(id: string | null | undefined): PresenceStatus {
    if (!id) return null;
    return this.presence.statusOf(this.presenceMap()[String(id)] ?? null);
  }

  /** Avatar presence: live socket state wins, bulk presence is the fallback. */
  protected avatarPresence(id: string): PresenceStatus {
    const live = this.livePresence()[id];
    if (live === true) return 'online';
    if (live === false) return null;
    return this.presenceOf(id);
  }

  /** " · Online" suffix for the To picker (empty when offline). */
  protected presenceSuffix(id: string | null | undefined): string {
    const s = this.presenceOf(id);
    if (s === 'online') return ' · Online';
    if (s === 'recent') return ' · Active';
    return '';
  }

  /** Avatar photo for a counterpart id (null = initials fallback). */
  protected photoOf(id: string | null | undefined): string | null {
    if (!id) return null;
    const key = String(id);
    const fromContact = this.contacts().find((c) => String(c.id) === key)?.photo;
    if (fromContact) return fromContact;
    const fromPeople = this.people().find((p) => String(p.id) === key)?.photo;
    if (fromPeople) return fromPeople;
    return this.conversations().find((c) => String(c.id) === key)?.photo ?? null;
  }

  protected resolveName(counterpartId: string): string {
    const contact = this.contacts().find((c) => String(c.id) === String(counterpartId));
    if (contact) return contact.name;
    const found = this.people().find((p) => String(p.id) === String(counterpartId));
    if (found) return found.name;
    return this.conversations().find((c) => String(c.id) === String(counterpartId))?.name ?? 'Teammate';
  }

  /** Live people search for starting chats beyond the contact list. */
  protected onPeopleSearch(value: string): void {
    this.peopleQuery.set(value);
    const q = value.trim();
    if (q.length < 2) {
      if (this.peopleTimer) clearTimeout(this.peopleTimer);
      this.people.set([]);
      this.peopleLoading.set(false);
      return;
    }
    this.peopleTimer = setTimeout(() => {
      this.peopleLoading.set(true);
      this.messages
        .people(q)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => {
            const me = this.myId();
            this.people.set((res.data ?? []).filter((p) => String(p.id) !== me).slice(0, 10));
            this.peopleLoading.set(false);
          },
          error: () => this.peopleLoading.set(false),
        });
    }, 300);
  }

  /** Header status line: socket first, bulk presence last. */
  protected peerStatus(id: string): string {
    const live = this.livePresence()[id];
    if (live === true) return 'Online now';
    if (live === false) return 'Offline';
    const s = this.presenceOf(id);
    if (s === 'online') return 'Online now';
    if (s === 'recent') return 'Active recently';
    return 'Offline';
  }

  protected isOffline(id: string): boolean {
    const live = this.livePresence()[id];
    if (live !== undefined) return !live;
    return this.presenceOf(id) === null;
  }

  /** Refresh presence for conversation counterparts + messageable contacts. */
  private refreshPresence(): void {
    const me = this.myId();
    const ids = [
      ...this.contacts().map((c) => c.id),
      ...this.inbox().flatMap((m) => [m.senderId, m.recipientId]),
    ].filter((id) => String(id) !== me);
    if (ids.length === 0) return;
    this.presence
      .lookup(ids)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((map) => this.presenceMap.set({ ...this.presenceMap(), ...map }));
  }

  /** Direct threads (inbox + sent) grouped by counterpart — the chat list. */
  protected readonly conversations = computed(() => {
    const me = this.myId();
    const q = this.searchQuery().trim().toLowerCase();
    const photos = new Map<string, string>();
    for (const c of this.contacts()) {
      if (c.photo) photos.set(String(c.id), c.photo);
    }
    const groups = new Map<string, { id: string; name: string; photo: string | null; messages: Message[]; unread: number; lastAt: number }>();
    const absorb = (m: Message) => {
      if (m.kind !== 'direct') return;
      const cid = String(m.senderId) === me ? String(m.recipientId) : String(m.senderId);
      const name = String(m.senderId) === me
        ? (m.recipient?.name ?? 'Teammate')
        : (m.sender?.name ?? 'Teammate');
      if (!groups.has(cid)) groups.set(cid, { id: cid, name, photo: photos.get(cid) ?? null, messages: [], unread: 0, lastAt: 0 });
      const g = groups.get(cid) as { id: string; name: string; photo: string | null; messages: Message[]; unread: number; lastAt: number };
      g.messages.push(m);
      if (!m.readAt && String(m.senderId) !== me) g.unread += 1;
      const at = new Date(m.createdAt ?? 0).getTime();
      if (at > g.lastAt) g.lastAt = at;
      if (g.name === 'Teammate' && name !== 'Teammate') g.name = name;
      if (!g.photo && photos.has(cid)) g.photo = photos.get(cid) ?? null;
    };
    for (const m of this.inbox()) absorb(m);
    for (const m of this.sent()) absorb(m);
    let out = [...groups.values()];
    if (q) {
      out = out.filter((g) =>
        g.name.toLowerCase().includes(q)
        || g.messages.some((m) => `${m.title ?? ''} ${m.body ?? ''}`.toLowerCase().includes(q)));
    }
    out.sort((a, b) => b.lastAt - a.lastAt);
    return out;
  });

  /** Team + announcement inbox rows (flat cards, kind-distinct). */
  protected readonly broadcasts = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    return this.inbox().filter((m) => {
      if (m.kind === 'direct') return false;
      if (!q) return true;
      return `${m.sender?.name ?? ''} ${m.title ?? ''} ${m.body ?? ''}`.toLowerCase().includes(q);
    });
  });

  /** Sent rows that don't live in a thread (team announcements). */
  protected readonly sentBroadcasts = computed(() => this.sent().filter((m) => m.kind !== 'direct'));

  protected snippet(text: string | undefined, len = 140): string {
    const t = String(text ?? '').trim();
    return t.length > len ? `${t.slice(0, len - 1)}…` : t;
  }

  protected lastSnippet(messages: Message[]): string {
    const last = messages[messages.length - 1];
    return this.snippet(last ? `${last.title ? last.title + ' — ' : ''}${last.body ?? ''}` : '');
  }

  protected lastAt(messages: Message[]): string {
    const last = messages[messages.length - 1];
    return String(last?.createdAt ?? '');
  }

  /**
   * Compact timestamp for conversation and group lists:
   * today → time, yesterday → "Yesterday", this week → weekday,
   * older → "11 Nov" or "11 Nov 2026".
   */
  protected listStamp(value: string | null | undefined): string {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return '';
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const dayDiff = Math.round((startOfToday - startOfDate) / 86400000);
    if (dayDiff === 0) {
      return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })
        .replace(/\b(am|pm)\b/i, (m) => m.toUpperCase());
    }
    if (dayDiff === 1) return 'Yesterday';
    if (dayDiff > 1 && dayDiff < 7) {
      return date.toLocaleDateString(undefined, { weekday: 'short' });
    }
    if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    }
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  /** Group an open thread into day sections for dividers. */
  protected readonly threadDays = computed(() => {
    const days = new Map<string, { key: string; label: string; msgs: ChatMsg[] }>();
    for (const m of this.threadMsgs()) {
      const d = new Date(m.createdAt ?? 0);
      const key = Number.isNaN(d.getTime()) ? 'undated' : d.toDateString();
      if (!days.has(key)) {
        days.set(key, {
          key,
          label: key === 'undated' ? '' : d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' }),
          msgs: [],
        });
      }
      days.get(key)!.msgs.push(m);
    }
    return [...days.values()];
  });

  /** Reply is possible on directs; on team/announcements only when the
   * sender is messageable (upline/downline) — otherwise a send would 403. */
  protected canReply(msg: Message): boolean {
    if (msg.kind === 'direct') return true;
    return this.contacts().some((c) => String(c.id) === String(msg.senderId));
  }

  private openPendingDirectChat(): void {
    const pending = this.pendingDirectChat;
    if (!pending) return;
    this.pendingDirectChat = null;
    this.openChat(pending.id, pending.name);
  }

  private openPendingGroupChat(): void {
    const groupId = this.pendingGroupId;
    if (!groupId) return;
    this.pendingGroupId = null;
    if (this.groups().some((group) => String(group.id) === String(groupId))) {
      this.openGroupChat(groupId);
    }
  }

  protected openChat(counterpartId: string, preferredName = ''): void {
    this.searchQuery.set('');
    this.startingChat.set(false);
    const name = preferredName.trim() || this.resolveName(counterpartId);
    this.openThreadName.set({ id: counterpartId, name });
    this.openThreadId.set(counterpartId);
    this.threadMsgs.set([]);
    this.threadError.set(null);
    this.threadSendError.set(null);
    this.threadHasMore.set(false);
    this.threadLoadingMore.set(false);
    this.closeFind();
    this.replyDraft.set('');
    this.threadLoading.set(true);
    this.messages
      .thread(counterpartId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const rows = [...(res.data ?? [])].sort(
            (a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime());
          this.threadMsgs.set(rows);
          this.threadHasMore.set(rows.length >= 100);
          this.threadLoading.set(false);
          this.scrollSoon();
          // Reading the thread clears its unread flags (counts stay truthful).
          for (const m of rows) {
            if (!m.readAt && String(m.senderId) !== this.myId()) this.markReadBoth(m);
          }
          const resolved = this.resolveName(counterpartId);
          const current = this.openThreadName();
          this.openThreadName.set({
            id: counterpartId,
            name: resolved === 'Teammate' && current?.id === counterpartId ? current.name : resolved,
          });
        },
        error: (err: ApiError) => {
          this.threadLoading.set(false);
          this.threadError.set(userError(err));
        },
      });
  }

  private scrollSoon(): void {
    // Double rAF: the first frame lets Angular render the new rows,
    // the second runs after layout so scrollHeight is final.
    requestAnimationFrame(() => requestAnimationFrame(() => this.scrollNow()));
  }

  private scrollNow(): void {
    try {
      const el = this.threadScroll?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch { /* layout not ready yet */ }
  }

  protected onDraftInput(value: string): void {
    this.replyDraft.set(value);
    const to = this.openThreadId();
    if (!to || !this.chat.connected()) return;
    const now = Date.now();
    if (value.trim() && now - this.lastTypingSent > 3000) {
      this.lastTypingSent = now;
      this.chat.typing(to, true);
    }
    if (!value.trim()) this.typingStop();
  }

  protected typingStop(): void {
    const to = this.openThreadId();
    if (to) this.chat.typing(to, false);
  }

  protected onComposerKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendThreadReply();
    }
  }

  protected sendThreadReply(): void {
    const to = this.openThreadId();
    const body = this.replyDraft().trim();
    if (!to || !body || this.threadSending()) return;
    const clientId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const temp: ChatMsg = {
      id: `pending-${clientId}`,
      senderId: this.myId(),
      recipientId: to,
      kind: 'direct',
      title: '',
      body,
      readAt: null,
      createdAt: new Date().toISOString(),
      clientId,
      pending: true,
    };
    this.threadMsgs.set([...this.threadMsgs(), temp]);
    this.replyDraft.set('');
    this.typingStop();
    this.scrollSoon();
    this.deliver(to, body, clientId);
  }

  /** Socket-first delivery; REST fallback keeps the page working offline-first. */
  private deliver(to: string, body: string, clientId: string): void {
    if (this.chat.connected()) {
      this.threadSending.set(true);
      this.chat.send(to, body, clientId).then(
        ({ message }) => {
          this.threadSending.set(false);
          this.replaceTemp(clientId, message);
        },
        () => {
          this.threadSending.set(false);
          this.failTemp(clientId);
          this.threadSendError.set('Send failed — tap retry on the message.');
        },
      );
      return;
    }
    this.threadSending.set(true);
    this.threadSendError.set(null);
    this.messages
      .sendDirect(to, body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.threadSending.set(false);
          if (res.data) this.replaceTemp(clientId, res.data);
          else this.failTemp(clientId);
          this.refreshListsSilent();
        },
        error: (err: ApiError) => {
          this.threadSending.set(false);
          this.failTemp(clientId);
          this.threadSendError.set(userError(err));
        },
      });
  }

  protected retryTemp(clientId: string): void {
    const temp = this.threadMsgs().find((m) => m.clientId === clientId && m.failed);
    if (!temp || this.threadSending()) return;
    this.threadMsgs.set(this.threadMsgs().map((m) =>
      m.clientId === clientId ? { ...m, failed: false, pending: true } : m,
    ));
    this.threadSendError.set(null);
    this.deliver(String(temp.recipientId), temp.body, clientId);
  }

  private replaceTemp(clientId: string, message: Message): void {
    const rows = this.threadMsgs();
    if (rows.some((m) => m.clientId === clientId)) {
      this.threadMsgs.set(
        rows
          .map((m) => (m.clientId === clientId ? { ...message } : m))
          .sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime()),
      );
    } else if (!rows.some((m) => m.id === message.id)) {
      // Echo already landed first — fill the gap, never duplicate.
      this.threadMsgs.set(
        [...rows, { ...message }].sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime()),
      );
    }
    this.scrollSoon();
  }

  private failTemp(clientId: string): void {
    this.threadMsgs.set(this.threadMsgs().map((m) =>
      m.clientId === clientId ? { ...m, pending: false, failed: true } : m,
    ));
  }

  /** Refresh thread rows without collapsing the open conversation. */
  private loadThreadSilent(counterpartId: string): void {
    this.messages
      .thread(counterpartId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          if (String(this.openThreadId()) !== String(counterpartId)) return;
          const fresh = [...(res.data ?? [])].sort(
            (a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime());
          if (this.scrollerPinned(this.threadScroll?.nativeElement)) {
            // Watching live: full refresh heals edits/deletes too.
            const pending = this.threadMsgs().filter((m) => m.pending || m.failed);
            this.threadMsgs.set([...fresh, ...pending]);
          } else {
            // Reading history: merge so the viewport never collapses.
            const freshIds = new Set(fresh.map((m) => m.id));
            const keep = this.threadMsgs().filter((m) => m.pending || m.failed || !freshIds.has(m.id));
            this.threadMsgs.set([...fresh, ...keep].sort(
              (a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime()));
          }
          this.threadHasMore.set(fresh.length >= 100);
        },
        error: () => {},
      });
  }

  /** Paged history: fetch the window before the oldest loaded message and
   * pin the viewport so the first visible row stays put. */
  protected loadOlderThread(): void {
    const id = this.openThreadId();
    if (!id || this.threadLoadingMore() || !this.threadHasMore()) return;
    const settled = this.threadMsgs().filter((m) => !m.pending && !m.failed && m.createdAt);
    if (settled.length === 0) return;
    const oldest = settled.reduce((a, b) => (new Date(a.createdAt) <= new Date(b.createdAt) ? a : b));
    const el = this.threadScroll?.nativeElement;
    const prevHeight = el?.scrollHeight ?? 0;
    const prevTop = el?.scrollTop ?? 0;
    this.threadLoadingMore.set(true);
    this.messages
      .thread(id, 100, String(oldest.createdAt))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.threadLoadingMore.set(false);
          if (String(this.openThreadId()) !== String(id)) return;
          const existing = new Set(this.threadMsgs().map((m) => m.id));
          const older = [...(res.data ?? [])].filter((m) => !existing.has(m.id));
          this.threadMsgs.set([...older, ...this.threadMsgs()].sort(
            (a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime()));
          this.threadHasMore.set((res.data ?? []).length >= 100);
          requestAnimationFrame(() => requestAnimationFrame(() => {
            try {
              if (el) el.scrollTop = el.scrollHeight - prevHeight + prevTop;
            } catch { /* layout not ready yet */ }
          }));
        },
        error: () => this.threadLoadingMore.set(false),
      });
  }

  /** Socket-first read receipt; REST fallback keeps counts truthful. */
  private markReadBoth(m: Message): void {
    const stamp = new Date().toISOString();
    this.threadMsgs.set(this.threadMsgs().map((x) => (x.id === m.id ? { ...x, readAt: x.readAt ?? stamp } : x)));
    this.inbox.set(this.inbox().map((x) => (x.id === m.id ? { ...x, readAt: x.readAt ?? stamp } : x)));
    this.unread.set(Math.max(0, this.unread() - 1));
    if (this.chat.connected()) {
      this.chat.markRead(m.id);
    } else {
      this.messages.markRead(m.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ error: () => {} });
    }
  }

  protected open(msg: Message): void {
    this.messages
      .markRead(msg.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.inbox.set(this.inbox().map((m) => (m.id === msg.id ? { ...m, readAt: new Date().toISOString() } : m)));
          this.unread.set(Math.max(0, this.unread() - 1));
        },
        error: (err: ApiError) => this.error.set(userError(err)),
      });
  }

  protected reply(msg: Message): void {
    this.replyingTo.set(msg);
    this.composeKind.set('direct');
    this.form.patchValue({ to: msg.senderId, body: '' });
    this.view.set('channels');
    this.showCompose.set(true);
    this.sentNotice.set(null);
  }

  protected send(): void {
    const v = this.form.getRawValue();
    const body = v.body.trim();
    if (!body) return;
    if (this.composeKind() === 'direct' && !v.to) {
      this.sendError.set('Choose a recipient.');
      return;
    }
    if ((this.composeKind() === 'announcement' || this.composeKind() === 'team') && v.title.trim().length < 2) {
      this.sendError.set('Announcements need a title.');
      return;
    }
    if (this.composeKind() === 'team' && !this.teamId()) {
      this.sendError.set('Team context is missing — reopen from the team page.');
      return;
    }
    this.sending.set(true);
    this.sendError.set(null);
    this.sentNotice.set(null);
    const kind = this.composeKind();
    const request: Observable<MessageEnvelope | AnnounceEnvelope | TeamAnnounceEnvelope> = kind === 'direct'
      ? this.messages.sendDirect(v.to, body)
      : kind === 'team'
        ? this.messages.announceToTeam(this.teamId() as string, v.title.trim(), body)
        : this.messages.announce(v.title.trim(), body, v.scope);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.sending.set(false);
        this.replyingTo.set(null);
        this.form.reset({ to: '', title: '', scope: 'direct', body: '' });
        this.sentNotice.set(
          (kind === 'announcement' || kind === 'team') && 'inserted' in res.data
            ? kind === 'team'
              ? `Announced to ${res.data.inserted} teammate${res.data.inserted === 1 ? '' : 's'}.`
              : `Announced to ${res.data.inserted} partners.`
            : 'Message sent.',
        );
        this.reload();
      },
      error: (err: ApiError) => {
        this.sending.set(false);
        this.sendError.set(userError(err));
      },
    });
  }

  /* ================= Group chat ================= */

  protected switchView(v: 'chats' | 'channels' | 'groups'): void {
    this.view.set(v);
    if (v === 'groups' && this.groups().length === 0 && !this.groupsLoading()) this.loadGroups();
  }

  /** Sidebar rows filtered by name (discover search stays separate). */
  protected readonly filteredGroups = computed(() => {
    const q = this.groupFilter().trim().toLowerCase();
    if (!q) return this.groups();
    return this.groups().filter((g) => (g.name ?? '').toLowerCase().includes(q));
  });

  /** Sidebar rows (name + snippet + unread), most-recent-first. */
  protected loadGroups(): void {
    this.groupsLoading.set(true);
    this.groupsError.set(null);
    this.messages
      .myGroups()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.groups.set(sortGroupSummaries(res.data ?? []));
          this.groupsLoading.set(false);
        },
        error: (err: ApiError) => {
          this.groupsLoading.set(false);
          this.groupsError.set(userError(err));
        },
      });
  }

  private loadGroupsSilent(): void {
    this.messages
      .myGroups()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.groups.set(sortGroupSummaries(res.data ?? []));
        },
        error: () => {},
      });
  }

  protected groupSnippet(g: GroupSummary): string {
    const last = g.lastMessage;
    if (!last?.body) return `${g.memberCount ?? 0} member${(g.memberCount ?? 0) === 1 ? '' : 's'}`;
    const who = last.senderName ? `${last.senderName}: ` : '';
    return this.snippet(`${who}${last.body}`);
  }

  protected groupLastAt(g: GroupSummary): string {
    return String(g.lastMessage?.createdAt ?? g.createdAt ?? '');
  }

  protected openGroupChat(groupId: string): void {
    this.groupSearch.set('');
    this.groupHits.set([]);
    this.openGroupId.set(groupId);
    this.openGroup.set(null);
    this.groupMsgs.set([]);
    this.groupError.set(null);
    this.groupSendError.set(null);
    this.groupDraft.set('');
    this.groupFiles.set([]);
    this.groupHasMore.set(false);
    this.groupLoadingMore.set(false);
    this.closeFind();
    this.groupNotice.set(null);
    this.reportsLoaded.set(false);
    this.groupReportsList.set([]);
    this.groupLoading.set(true);
    this.showGroupPanel.set(false);
    this.groupPanel.set('members');
    this.chat.joinGroupRoom(groupId);
    this.messages
      .getGroup(groupId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          if (String(this.openGroupId()) !== String(groupId)) return;
          if (!res.data) {
            this.groupLoading.set(false);
            this.groupError.set('Group not found.');
            return;
          }
          this.openGroup.set(res.data);
          this.groupSettingsName.set(res.data.name ?? '');
          this.groupSettingsDesc.set(res.data.description ?? '');
          this.groupSettingsPolicy.set(res.data.joinPolicy ?? 'approval');
          this.loadGroupThreadSilent(groupId);
          this.groupLoading.set(false);
          this.markGroupRead(groupId);
        },
        error: (err: ApiError) => {
          if (String(this.openGroupId()) !== String(groupId)) return;
          this.groupLoading.set(false);
          this.groupError.set(userError(err));
        },
      });
  }

  protected closeGroupChat(): void {
    const gid = this.openGroupId();
    if (gid) this.chat.leaveGroupRoom(gid);
    this.groupTypingStop();
    this.closeFind();
    this.openGroupId.set(null);
    this.openGroup.set(null);
    this.groupMsgs.set([]);
    this.showGroupPanel.set(false);
  }

  /** Team entry point (?teamGroup=): resolve-or-create the team's group chat
   * and land in it. Approval groups the clicker hasn't joined yet are
   * requested on their behalf — the click already expressed the intent. */
  protected openTeamGroupChat(teamId: string): void {
    this.switchView('groups');
    this.groupNotice.set(null);
    this.groupSearch.set('');
    this.groupHits.set([]);
    this.messages
      .teamGroup(teamId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const d = res.data;
          if (!d?.groupId) {
            this.groupNotice.set('Team chat is unavailable right now.');
            return;
          }
          this.loadGroups();
          if (d.joined) {
            if (d.teamGone) this.groupNotice.set('The team was deleted, but its group chat lives on.');
            else if (d.created) this.groupNotice.set('Team group chat created — teammates land here from the team page.');
            this.openGroupChat(String(d.groupId));
          } else if (d.pending) {
            this.groupNotice.set('Your request to join the team chat is pending review.');
          } else {
            this.joinGroup(String(d.groupId));
          }
        },
        error: (err: ApiError) => {
          this.switchView('groups');
          this.groupNotice.set(userError(err));
        },
      });
  }

  private loadGroupThreadSilent(groupId: string): void {
    this.messages
      .groupThread(groupId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          if (String(this.openGroupId()) !== String(groupId)) return;
          const fresh = [...(res.data ?? [])].sort(
            (a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime());
          const pinned = this.scrollerPinned(this.groupScroll?.nativeElement);
          if (pinned) {
            // Watching live: full refresh heals edits/deletes too.
            const pending = this.groupMsgs().filter((m) => m.pending || m.failed);
            this.groupMsgs.set([...fresh, ...pending]);
          } else {
            // Reading history: merge so the viewport never collapses.
            const freshIds = new Set(fresh.map((m) => m.id));
            const keep = this.groupMsgs().filter((m) => m.pending || m.failed || !freshIds.has(m.id));
            this.groupMsgs.set([...fresh, ...keep].sort(
              (a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime()));
          }
          this.groupHasMore.set(fresh.length >= 100);
          if (pinned) this.scrollGroupSoon();
        },
        error: () => {},
      });
  }

  /** Paged history: fetch the window before the oldest loaded message and
   * pin the viewport so the first visible row stays put. */
  protected loadOlderGroupMessages(): void {
    const gid = this.openGroupId();
    if (!gid || this.groupLoadingMore() || !this.groupHasMore()) return;
    const settled = this.groupMsgs().filter((m) => !m.pending && !m.failed && m.createdAt);
    if (settled.length === 0) return;
    const oldest = settled.reduce((a, b) => (new Date(a.createdAt) <= new Date(b.createdAt) ? a : b));
    const el = this.groupScroll?.nativeElement;
    const prevHeight = el?.scrollHeight ?? 0;
    const prevTop = el?.scrollTop ?? 0;
    this.groupLoadingMore.set(true);
    this.messages
      .groupThread(gid, 100, String(oldest.createdAt))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.groupLoadingMore.set(false);
          if (String(this.openGroupId()) !== String(gid)) return;
          const existing = new Set(this.groupMsgs().map((m) => m.id));
          const older = [...(res.data ?? [])].filter((m) => !existing.has(m.id));
          this.groupMsgs.set([...older, ...this.groupMsgs()].sort(
            (a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime()));
          this.groupHasMore.set((res.data ?? []).length >= 100);
          requestAnimationFrame(() => requestAnimationFrame(() => {
            try {
              if (el) el.scrollTop = el.scrollHeight - prevHeight + prevTop;
            } catch { /* layout not ready yet */ }
          }));
        },
        error: () => this.groupLoadingMore.set(false),
      });
  }

  /** Live group message: open thread absorbs it, otherwise bump the badge. */
  private onGroupSocketMessage(message: GroupMessage, groupId: string): void {
    const gid = String(message?.groupId ?? groupId ?? '');
    if (!gid) return;
    if (String(this.openGroupId()) === gid) {
      const pinned = this.scrollerPinned(this.groupScroll?.nativeElement);
      const me = this.myId();
      if (String(message.senderId) === me) {
        const tempIdx = this.groupMsgs().findIndex((x) => x.pending);
        if (tempIdx >= 0) {
          const rows = [...this.groupMsgs()];
          rows[tempIdx] = { ...message };
          this.groupMsgs.set(rows.sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime()));
          if (pinned) this.scrollGroupSoon();
          return;
        }
      }
      if (!this.groupMsgs().some((x) => x.id === message.id)) {
        this.groupMsgs.set([...this.groupMsgs(), message]);
        if (pinned) this.scrollGroupSoon();
      }
      this.markGroupRead(gid);
    } else {
      this.groups.set(this.groups().map((g) =>
        String(g.id) === gid ? { ...g, unread: (g.unread ?? 0) + 1 } : g));
    }
  }

  /**
   * The server moved this member to a new official circle. Refresh the group
   * list and, when the old circle was open, carry the conversation across to
   * the new one instead of leaving a dead room on screen.
   */
  private onRankGroupChanged(event: RankGroupChangedEvent): void {
    const groupId = String(event.groupId ?? '').trim();
    if (!groupId) return;
    const previousId = event.fromGroupId ? String(event.fromGroupId) : null;
    const groupName = String(event.groupName ?? '').trim()
      || `${event.rank ?? 'New'} Circle`;
    const previousName = event.fromRank ? `${event.fromRank} Circle` : 'your previous circle';
    const moved = !!previousId && previousId !== groupId;
    const openId = String(this.openGroupId() ?? '');
    const oldGroupOpen = !!previousId && openId === previousId;

    if (oldGroupOpen) {
      if (this.view() === 'groups') this.openGroupChat(groupId);
      else this.closeGroupChat();
    } else if (openId === groupId) {
      this.loadGroupThreadSilent(groupId);
    }

    this.loadGroupsSilent();
    this.groupNotice.set(moved
      ? `Your journey level changed. You moved from ${previousName} to ${groupName}.`
      : `You joined ${groupName}. Say hello — the group is ready.`);
  }

  /** Group an open group thread into day sections for dividers. */
  protected readonly groupDays = computed(() => {
    const days = new Map<string, { key: string; label: string; msgs: GroupMessage[] }>();
    for (const m of this.groupMsgs()) {
      const d = new Date(m.createdAt ?? 0);
      const key = Number.isNaN(d.getTime()) ? 'undated' : d.toDateString();
      if (!days.has(key)) {
        days.set(key, {
          key,
          label: key === 'undated' ? '' : d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' }),
          msgs: [],
        });
      }
      days.get(key)!.msgs.push(m);
    }
    return [...days.values()];
  });

  /** Names of other members currently typing in the open group. */
  protected readonly groupTypingNow = computed(() => {
    const gid = this.openGroupId();
    if (!gid) return [];
    const names = new Set<string>();
    for (const [key] of Object.entries(this.groupTyping())) {
      const [g, from] = key.split(':');
      if (g === String(gid) && from !== this.myId()) names.add(this.senderNameOf(from));
    }
    return [...names].slice(0, 3);
  });

  /** Professional typing line: "Ada is typing" / "Ada and Musa are typing" / "Ada, Musa and 2 others are typing". */
  protected readonly groupTypingText = computed(() => {
    const names = this.groupTypingNow();
    if (names.length === 0) return null;
    if (names.length === 1) return `${names[0]} is typing`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing`;
    const rest = names.length - 2;
    return `${names[0]}, ${names[1]} and ${rest} other${rest === 1 ? '' : 's'} are typing`;
  });

  protected senderNameOf(partnerId: string, senderLabel?: string | null): string {
    const label = String(senderLabel ?? '').trim();
    if (label) return label;
    const id = String(partnerId ?? '');
    const member = this.openGroup()?.members.find((m) => String(m.id) === id);
    if (member) return member.name || member.username || 'Teammate';
    if (id === this.myId()) return 'You';
    return 'Teammate';
  }

  protected memberRoleOf(partnerId: string): 'admin' | 'member' {
    const member = this.openGroup()?.members.find((m) => String(m.id) === String(partnerId));
    return member?.role ?? 'member';
  }

  protected filteredGroupMembers(): GroupMember[] {
    const q = this.groupMemberFilter().trim().toLowerCase();
    const members = this.openGroup()?.members ?? [];
    if (!q) return members;
    return members.filter((m) => `${m.name ?? ''} ${m.username ?? ''}`.toLowerCase().includes(q));
  }

  protected isGroupAdmin(): boolean {
    return this.openGroup()?.myRole === 'admin';
  }

  protected isGroupCreator(): boolean {
    return String(this.openGroup()?.createdBy ?? '') === this.myId();
  }

  protected canModifyGroupMsg(m: GroupMessage): boolean {
    return String(m.senderId) === this.myId() && !m.pending && !m.failed;
  }

  protected canDeleteGroupMsg(m: GroupMessage): boolean {
    if (m.pending || m.failed) return false;
    if (String(m.senderId) === this.myId()) return true;
    return this.isGroupAdmin();
  }

  protected reportKey(r: GroupReport): string {
    return String(r.id ?? r._id ?? '');
  }

  /** Other member ids of the open group (read-tick audience). */
  protected otherMemberIds(): string[] {
    const me = this.myId();
    return (this.openGroup()?.members ?? []).map((m) => String(m.id)).filter((id) => id !== me);
  }

  /** Gold ticks only when every other member's read watermark passed the message. */
  protected isSeenByAll(m: GroupMessage): boolean {
    const others = this.otherMemberIds();
    if (others.length === 0) return true;
    const seen = new Set((m.seenBy ?? []).map(String));
    return others.every((id) => seen.has(id));
  }

  protected seenTitle(m: GroupMessage): string {
    const names = (m.seenBy ?? [])
      .map((id) => this.senderNameOf(String(id)))
      .filter((n) => !!n && n !== 'Teammate');
    if (names.length === 0) return 'Sent — not seen yet';
    if (this.isSeenByAll(m)) return 'Seen by everyone';
    return `Seen by ${names.slice(0, 3).join(', ')}${names.length > 3 ? ` and ${names.length - 3} others` : ''}`;
  }

  /* ---------- In-thread find (DM + group) ---------- */

  /** "2/7" position readout, empty unless searching with matches. */
  protected readonly findPosition = computed(() => {
    const len = this.findMatches().length;
    if (len === 0) return '';
    return `${this.findIdx() + 1}/${len}`;
  });

  protected toggleFind(): void {
    if (this.findOpen()) {
      this.closeFind();
    } else {
      this.findOpen.set(true);
      this.refreshFindMatches();
    }
  }

  protected closeFind(): void {
    this.findOpen.set(false);
    this.findQuery.set('');
    this.findMatches.set([]);
    this.findIdx.set(0);
    this.clearFindHit();
  }

  protected onFindInput(value: string): void {
    this.findQuery.set(value);
    this.refreshFindMatches();
  }

  protected jumpFind(dir: 1 | -1): void {
    const len = this.findMatches().length;
    if (len === 0) return;
    this.findIdx.set((this.findIdx() + dir + len) % len);
    this.applyFindHit();
  }

  private findRows(): Array<{ clientId?: string | null; id: string; body?: string | null }> {
    const rows = this.openGroupId() ? [...this.groupMsgs()] : [...this.threadMsgs()];
    return rows as Array<{ clientId?: string | null; id: string; body?: string | null }>;
  }

  private refreshFindMatches(): void {
    const q = this.findQuery().trim().toLowerCase();
    const matches = !q
      ? []
      : this.findRows()
        .filter((m) => (m.body ?? '').toLowerCase().includes(q))
        .map((m) => String(m.clientId ?? m.id));
    this.findMatches.set(matches);
    this.findIdx.set(0);
    this.clearFindHit();
    if (matches.length > 0) this.applyFindHit();
  }

  private findContainer(): HTMLElement | null {
    try {
      return (this.openGroupId() ? this.groupScroll : this.threadScroll)?.nativeElement ?? null;
    } catch {
      return null;
    }
  }

  private clearFindHit(): void {
    try {
      this.findContainer()?.querySelectorAll('.find-hit').forEach((el) => el.classList.remove('find-hit'));
    } catch { /* ephemeral — never fail */ }
  }

  private applyFindHit(): void {
    const id = this.findMatches()[this.findIdx()];
    if (id == null) return;
    const el = this.findContainer();
    if (!el) return;
    let node: Element | null = null;
    try {
      node = el.querySelector(`[data-mid="${id.replace(/["\\]/g, '')}"]`);
    } catch { /* bad selector — skip */ }
    if (!node) return;
    this.clearFindHit();
    node.classList.add('find-hit');
    try {
      node.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } catch {
      try { node.scrollIntoView(); } catch { /* layout not ready yet */ }
    }
  }

  /** Request key tolerant of raw store shapes (backend now maps `id`, this is belt-and-braces). */
  protected requestKey(r: GroupJoinRequest): string {
    return String(r.id ?? r._id ?? '');
  }

  /** Global platform search for adding members — any partner, not just the network. */
  protected onMemberSearch(value: string): void {
    this.memberSearch.set(value);
    const q = value.trim();
    if (this.memberSearchTimer) clearTimeout(this.memberSearchTimer);
    if (q.length < 2) {
      this.memberHits.set([]);
      this.memberSearching.set(false);
      return;
    }
    this.memberSearching.set(true);
    this.memberSearchTimer = setTimeout(() => {
      this.messages
        .people(q)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => {
            const me = this.myId();
            const memberIds = new Set((this.openGroup()?.members ?? []).map((m) => String(m.id)));
            this.memberHits.set(
              (res.data ?? [])
                .filter((p) => String(p.id) !== me && !memberIds.has(String(p.id)))
                .slice(0, 10),
            );
            this.memberSearching.set(false);
          },
          error: () => this.memberSearching.set(false),
        });
    }, 300);
  }

  /* ---------- Group send flow (socket-first, REST fallback) ---------- */

  @ViewChild('groupScroll') private groupScroll?: ElementRef<HTMLDivElement>;

  private scrollGroupSoon(): void {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      try {
        const el = this.groupScroll?.nativeElement;
        if (el) el.scrollTop = el.scrollHeight;
      } catch { /* layout not ready yet */ }
    }));
  }

  protected onGroupDraftInput(value: string): void {
    this.groupDraft.set(value);
    const gid = this.openGroupId();
    if (!gid || !this.chat.connected()) return;
    const now = Date.now();
    if (value.trim() && now - (this.lastGroupTypingSent[gid] ?? 0) > 3000) {
      this.lastGroupTypingSent[gid] = now;
      this.chat.groupTyping(gid, true);
    }
    if (!value.trim()) this.groupTypingStop();
  }

  protected groupTypingStop(): void {
    const gid = this.openGroupId();
    if (gid) this.chat.groupTyping(gid, false);
  }

  protected onGroupComposerKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendGroupReply();
    }
  }

  protected sendGroupReply(): void {
    const gid = this.openGroupId();
    const body = this.groupDraft().trim();
    const files = this.groupFiles().map(({ url, mime, size }) => ({ url, mime, size }));
    if (!gid || (!body && files.length === 0) || this.groupSending() || this.groupUploading()) return;
    const clientId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const temp: GroupMessage = {
      id: `pending-${clientId}`,
      groupId: gid,
      senderId: this.myId(),
      body,
      attachments: files,
      createdAt: new Date().toISOString(),
      clientId,
      pending: true,
    };
    this.groupMsgs.set([...this.groupMsgs(), temp]);
    this.groupDraft.set('');
    this.groupFiles.set([]);
    this.groupTypingStop();
    this.scrollGroupSoon();
    this.deliverGroup(gid, body, clientId, files);
  }

  /** Staged attachments: validated server-side on upload, capped at 4 per message. */
  protected onGroupFilesSelected(files: FileList | null | undefined): void {
    if (!files || files.length === 0) return;
    const room = 4 - this.groupFiles().length;
    if (room <= 0) {
      this.groupSendError.set('At most 4 photos or videos per message.');
      return;
    }
    const picked = [...files].slice(0, room);
    for (const f of picked) {
      const isVideo = f.type.startsWith('video/');
      const max = isVideo ? 100 * 1024 * 1024 : 5 * 1024 * 1024;
      if (f.size > max) {
        this.groupSendError.set(`"${f.name}" is too large (max ${isVideo ? '100MB' : '5MB'}).`);
        return;
      }
    }
    this.groupSendError.set(null);
    this.groupUploading.set(true);
    const staged: Array<GroupAttachment & { name: string }> = [];
    const queue = [...picked];
    const pump = (): void => {
      const file = queue.shift();
      if (!file) {
        this.groupUploading.set(false);
        this.groupFiles.set([...this.groupFiles(), ...staged]);
        return;
      }
      this.community
        .uploadMedia(file)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => {
            if (res.data?.url) staged.push({ url: res.data.url, mime: res.data.mime, size: res.data.size, name: file.name });
            pump();
          },
          error: (err: ApiError) => {
            this.groupUploading.set(false);
            this.groupSendError.set(userError(err));
          },
        });
    };
    pump();
  }

  protected removeGroupFile(index: number): void {
    this.groupFiles.set(this.groupFiles().filter((_, i) => i !== index));
  }

  private deliverGroup(groupId: string, body: string, clientId: string, attachments: GroupAttachment[] = []): void {
    if (this.chat.connected()) {
      this.groupSending.set(true);
      this.chat.sendGroup(groupId, body, clientId, attachments).then(
        ({ message }) => {
          this.groupSending.set(false);
          this.replaceGroupTemp(clientId, message);
        },
        () => {
          this.groupSending.set(false);
          this.failGroupTemp(clientId);
          this.groupSendError.set('Send failed — tap retry on the message.');
        },
      );
      return;
    }
    this.groupSending.set(true);
    this.groupSendError.set(null);
    this.messages
      .sendGroupMessage(groupId, body, attachments)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.groupSending.set(false);
          if (res.data) this.replaceGroupTemp(clientId, res.data);
          else this.failGroupTemp(clientId);
          this.loadGroupsSilent();
        },
        error: (err: ApiError) => {
          this.groupSending.set(false);
          this.failGroupTemp(clientId);
          this.groupSendError.set(userError(err));
        },
      });
  }

  private replaceGroupTemp(clientId: string, message: GroupMessage): void {
    const rows = this.groupMsgs();
    if (rows.some((m) => m.clientId === clientId)) {
      this.groupMsgs.set(
        rows
          .map((m) => (m.clientId === clientId ? { ...message } : m))
          .sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime()),
      );
    } else if (!rows.some((m) => m.id === message.id)) {
      this.groupMsgs.set(
        [...rows, { ...message }].sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime()),
      );
    }
    this.scrollGroupSoon();
  }

  private failGroupTemp(clientId: string): void {
    this.groupMsgs.set(this.groupMsgs().map((m) =>
      m.clientId === clientId ? { ...m, pending: false, failed: true } : m,
    ));
  }

  protected retryGroupTemp(clientId: string): void {
    const temp = this.groupMsgs().find((m) => m.clientId === clientId && m.failed);
    if (!temp || this.groupSending()) return;
    this.groupMsgs.set(this.groupMsgs().map((m) =>
      m.clientId === clientId ? { ...m, failed: false, pending: true } : m,
    ));
    this.groupSendError.set(null);
    this.deliverGroup(String(temp.groupId), temp.body, clientId, temp.attachments ?? []);
  }

  /** Group reads are REST-only — fire, forget, and fix the badge locally. */
  private markGroupRead(groupId: string): void {
    this.groups.set(this.groups().map((g) => (String(g.id) === String(groupId) ? { ...g, unread: 0 } : g)));
    this.messages.markGroupRead(groupId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ error: () => {} });
  }

  /* ---------- Discover / create / join ---------- */

  /** Shared-link handoff (?joinGroup=): members land straight in, everyone
   * else gets a join card with directory-safe basics (no roster leak). */
  protected openJoinGroupCard(groupId: string): void {
    this.switchView('groups');
    this.groupNotice.set(null);
    this.groupInvite.set(null);
    this.messages
      .getGroup(groupId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          if (res.data) {
            this.loadGroups();
            this.openGroupChat(String(res.data.id ?? groupId));
          } else {
            this.loadInviteCard(groupId);
          }
        },
        error: () => this.loadInviteCard(groupId),
      });
  }

  private loadInviteCard(groupId: string): void {
    this.inviteLoading.set(true);
    this.messages
      .groupInvite(groupId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.inviteLoading.set(false);
          this.groupInvite.set(res.data ?? null);
          if (!res.data) this.groupNotice.set('This invite link is no longer valid.');
        },
        error: (err: ApiError) => {
          this.inviteLoading.set(false);
          this.groupNotice.set(userError(err));
        },
      });
  }

  protected joinInvite(): void {
    const inv = this.groupInvite();
    if (!inv) return;
    this.groupInvite.set(null);
    this.joinGroup(String(inv.id));
  }

  protected dismissInvite(): void {
    this.groupInvite.set(null);
  }

  protected copyInviteLink(): void {
    const gid = this.openGroupId();
    if (!gid) return;
    const url = `${window.location.origin}/dashboard/messages?joinGroup=${encodeURIComponent(gid)}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(
        () => this.groupNotice.set('Invite link copied — share it with anyone on the platform.'),
        () => this.groupNotice.set(url),
      );
    } else {
      this.groupNotice.set(url);
    }
  }

  protected onGroupSearch(value: string): void {
    this.groupSearch.set(value);
    const q = value.trim();
    if (this.groupSearchTimer) clearTimeout(this.groupSearchTimer);
    if (q.length < 2) {
      this.groupHits.set([]);
      this.groupSearching.set(false);
      return;
    }
    this.groupSearching.set(true);
    this.groupSearchTimer = setTimeout(() => {
      this.messages
        .searchGroups(q)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => {
            const mine = new Set(this.groups().map((g) => String(g.id)));
            this.groupHits.set((res.data ?? []).filter((h) => !mine.has(String(h.id))).slice(0, 10));
            this.groupSearching.set(false);
          },
          error: () => this.groupSearching.set(false),
        });
    }, 300);
  }

  protected createGroup(): void {
    const name = this.groupName().trim();
    if (name.length < 2) {
      this.groupFormError.set('Give the group a name (2+ characters).');
      return;
    }
    this.groupCreating.set(true);
    this.groupFormError.set(null);
    this.messages
      .createGroup({ name, description: this.groupDescription().trim(), joinPolicy: this.groupPolicy() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.groupCreating.set(false);
          this.creatingGroup.set(false);
          this.groupName.set('');
          this.groupDescription.set('');
          this.loadGroups();
          if (res.data?.id) this.openGroupChat(String(res.data.id));
          else this.groupNotice.set('Group created.');
        },
        error: (err: ApiError) => {
          this.groupCreating.set(false);
          this.groupFormError.set(userError(err));
        },
      });
  }

  protected joinGroup(groupId: string): void {
    this.groupActionBusy.set(groupId);
    this.groupNotice.set(null);
    this.messages
      .joinGroup(groupId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.groupActionBusy.set(null);
          const data = res.data;
          if (data?.joined) {
            this.groupHits.set(this.groupHits().filter((h) => String(h.id) !== String(groupId)));
            this.loadGroups();
            this.openGroupChat(groupId);
          } else {
            this.groupNotice.set('Request sent — an admin will review it.');
          }
        },
        error: (err: ApiError) => {
          this.groupActionBusy.set(null);
          this.groupNotice.set(userError(err));
        },
      });
  }

  protected leaveGroup(): void {
    const gid = this.openGroupId();
    if (!gid) return;
    this.groupActionBusy.set('leave');
    this.messages
      .leaveGroup(gid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.groupActionBusy.set(null);
          this.closeGroupChat();
          this.loadGroups();
          this.groupNotice.set(res.data?.dissolved ? 'Left — the group dissolved with no members left.' : 'Left the group.');
        },
        error: (err: ApiError) => {
          this.groupActionBusy.set(null);
          this.groupNotice.set(userError(err));
        },
      });
  }

  protected toggleMuteGroup(): void {
    const grp = this.openGroup();
    const gid = this.openGroupId();
    if (!grp || !gid) return;
    const muted = !grp.muted;
    this.messages
      .muteGroup(gid, muted)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.openGroup.set({ ...grp, muted });
          this.groups.set(this.groups().map((g) => (String(g.id) === String(gid) ? { ...g, muted } : g)));
        },
        error: (err: ApiError) => this.groupNotice.set(userError(err)),
      });
  }

  /* ---------- Members / moderation (admins) ---------- */

  private refreshOpenGroup(): void {
    const gid = this.openGroupId();
    if (!gid) return;
    this.messages
      .getGroup(gid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          if (res.data && String(this.openGroupId()) === String(gid)) {
            this.openGroup.set(res.data);
            this.groupSettingsName.set(res.data.name ?? '');
            this.groupSettingsDesc.set(res.data.description ?? '');
            this.groupSettingsPolicy.set(res.data.joinPolicy ?? 'approval');
          }
        },
        error: () => {},
      });
  }

  protected addMember(userId: string): void {
    const gid = this.openGroupId();
    if (!gid || !userId) return;
    this.messages
      .addGroupMember(gid, userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.groupNotice.set('Member added.');
          this.memberSearch.set('');
          this.memberHits.set([]);
          this.refreshOpenGroup();
          this.loadGroupsSilent();
        },
        error: (err: ApiError) => this.groupNotice.set(userError(err)),
      });
  }

  protected removeMember(userId: string): void {
    const gid = this.openGroupId();
    if (!gid) return;
    this.messages
      .removeGroupMember(gid, userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.groupNotice.set('Member removed.');
          this.refreshOpenGroup();
        },
        error: (err: ApiError) => this.groupNotice.set(userError(err)),
      });
  }

  protected toggleAdmin(member: GroupMember): void {
    const gid = this.openGroupId();
    if (!gid) return;
    const isAdmin = this.memberRoleOf(member.id) !== 'admin';
    this.messages
      .setGroupAdmin(gid, String(member.id), isAdmin)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.groupNotice.set(isAdmin ? `${member.name} is now an admin.` : `${member.name} is no longer an admin.`);
          this.refreshOpenGroup();
        },
        error: (err: ApiError) => this.groupNotice.set(userError(err)),
      });
  }

  protected banMember(userId: string): void {
    const gid = this.openGroupId();
    if (!gid) return;
    this.messages
      .banGroupMember(gid, userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.groupNotice.set('Member banned.');
          this.refreshOpenGroup();
          this.loadBans();
        },
        error: (err: ApiError) => this.groupNotice.set(userError(err)),
      });
  }

  protected loadBans(): void {
    const gid = this.openGroupId();
    if (!gid) return;
    this.messages
      .groupBans(gid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.groupBansList.set(res.data ?? []),
        error: () => this.groupBansList.set([]),
      });
  }

  protected unbanMember(userId: string): void {
    const gid = this.openGroupId();
    if (!gid) return;
    this.messages
      .unbanGroupMember(gid, userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.groupNotice.set('Member unbanned — they can join again.');
          this.loadBans();
        },
        error: (err: ApiError) => this.groupNotice.set(userError(err)),
      });
  }

  protected toggleGroupPanel(force?: boolean): void {
    const next = force ?? !this.showGroupPanel();
    this.showGroupPanel.set(next);
    if (next && this.groupPanel() === 'members' && this.isGroupAdmin()) this.loadBans();
  }

  protected switchGroupPanel(tab: 'members' | 'requests' | 'reports' | 'settings'): void {
    this.groupPanel.set(tab);
    if (tab === 'reports' && !this.reportsLoaded()) this.loadReports();
    if (tab === 'members' && this.isGroupAdmin()) this.loadBans();
  }

  protected loadReports(): void {
    const gid = this.openGroupId();
    if (!gid) return;
    this.messages
      .groupReports(gid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.groupReportsList.set(res.data ?? []);
          this.reportsLoaded.set(true);
        },
        error: (err: ApiError) => this.groupNotice.set(userError(err)),
      });
  }

  protected decideRequest(requestId: string, decision: 'approve' | 'reject'): void {
    const gid = this.openGroupId();
    if (!gid) return;
    this.messages
      .decideJoinRequest(gid, requestId, decision)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.groupNotice.set(decision === 'approve' ? 'Request approved.' : 'Request declined.');
          this.refreshOpenGroup();
          this.loadGroupsSilent();
        },
        error: (err: ApiError) => this.groupNotice.set(userError(err)),
      });
  }

  protected decideReport(reportId: string, decision: 'dismiss' | 'remove', banMember = false): void {
    const gid = this.openGroupId();
    if (!gid) return;
    this.messages
      .decideGroupReport(gid, reportId, decision, banMember)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.groupNotice.set(decision === 'remove' ? 'Message removed.' : 'Report dismissed.');
          this.loadReports();
          this.loadGroupThreadSilent(gid);
        },
        error: (err: ApiError) => this.groupNotice.set(userError(err)),
      });
  }

  /* ---------- Message edit / delete / pin / report ---------- */

  protected startEditGroupMsg(m: GroupMessage): void {
    this.editingGroupMsg.set(m.id);
    this.editDraft.set(m.body ?? '');
  }

  protected saveEditGroupMsg(): void {
    const gid = this.openGroupId();
    const mid = this.editingGroupMsg();
    const body = this.editDraft().trim();
    if (!gid || !mid || !body) return;
    this.messages
      .editGroupMessage(gid, mid, body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.editingGroupMsg.set(null);
          this.loadGroupThreadSilent(gid);
        },
        error: (err: ApiError) => this.groupNotice.set(userError(err)),
      });
  }

  protected deleteGroupMsg(messageId: string): void {
    const gid = this.openGroupId();
    if (!gid) return;
    this.messages
      .deleteGroupMessage(gid, messageId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.groupMsgs.set(this.groupMsgs().filter((m) => m.id !== messageId));
        },
        error: (err: ApiError) => this.groupNotice.set(userError(err)),
      });
  }

  protected pinMessage(messageId: string): void {
    const gid = this.openGroupId();
    if (!gid) return;
    this.messages
      .pinGroupMessage(gid, messageId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const pinned = this.groupMsgs().find((m) => m.id === messageId) ?? null;
          const grp = this.openGroup();
          if (grp) this.openGroup.set({ ...grp, pinnedMessage: pinned });
        },
        error: (err: ApiError) => this.groupNotice.set(userError(err)),
      });
  }

  protected unpinMessage(): void {
    const gid = this.openGroupId();
    if (!gid) return;
    this.messages
      .pinGroupMessage(gid, null)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const grp = this.openGroup();
          if (grp) this.openGroup.set({ ...grp, pinnedMessage: null });
        },
        error: (err: ApiError) => this.groupNotice.set(userError(err)),
      });
  }

  protected toggleReportGroupMsg(messageId: string): void {
    this.reportReason.set('');
    this.reportingGroupMsg.set(this.reportingGroupMsg() === messageId ? null : messageId);
  }

  protected startForward(m: GroupMessage): void {
    this.reportingGroupMsg.set(null);
    this.forwardingMsg.set(m);
  }

  protected cancelForward(): void {
    this.forwardingMsg.set(null);
  }

  protected sendForward(targetGroupId: string): void {
    const fwd = this.forwardingMsg();
    if (!targetGroupId || !fwd) return;
    const target = this.groups().find((g) => String(g.id) === String(targetGroupId));
    const files = (fwd.attachments ?? []).map(({ url, mime, size }) => ({ url, mime, size }));
    this.messages
      .sendGroupMessage(targetGroupId, fwd.body ?? '', files)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.forwardingMsg.set(null);
          this.groupNotice.set(`Forwarded to ${target?.name ?? 'group'}.`);
          this.loadGroupsSilent();
        },
        error: (err: ApiError) => this.groupNotice.set(userError(err)),
      });
  }

  protected reportGroupMsg(messageId: string): void {
    const gid = this.openGroupId();
    if (!gid) return;
    this.messages
      .reportGroupMessage(gid, messageId, this.reportReason().trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.reportingGroupMsg.set(null);
          this.groupNotice.set('Reported — group admins were notified.');
        },
        error: (err: ApiError) => this.groupNotice.set(userError(err)),
      });
  }

  /* ---------- Group settings (admins) ---------- */

  protected onGroupPhotoSelected(file: File | null | undefined): void {
    const gid = this.openGroupId();
    if (!gid || !file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      this.groupPhotoError.set('Only JPEG, PNG or WebP images are allowed.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.groupPhotoError.set('Photo is too large (max 5MB).');
      return;
    }
    this.groupPhotoBusy.set(true);
    this.groupPhotoError.set(null);
    this.messages
      .uploadGroupPhoto(gid, file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.groupPhotoBusy.set(false);
          const photo = res.data?.photo ?? null;
          const grp = this.openGroup();
          if (grp) this.openGroup.set({ ...grp, photo });
          this.groups.set(this.groups().map((g) => (String(g.id) === String(gid) ? { ...g, photo } : g)));
          this.groupNotice.set('Group photo updated.');
        },
        error: (err: ApiError) => {
          this.groupPhotoBusy.set(false);
          this.groupPhotoError.set(userError(err));
        },
      });
  }

  protected saveGroupSettings(): void {
    const gid = this.openGroupId();
    const grp = this.openGroup();
    if (!gid || !grp) return;
    const patch: { name?: string; description?: string; joinPolicy?: 'open' | 'approval' } = {};
    const name = this.groupSettingsName().trim();
    const desc = this.groupSettingsDesc().trim();
    if (name && name !== grp.name) patch.name = name;
    if (desc !== (grp.description ?? '')) patch.description = desc;
    if (this.groupSettingsPolicy() !== (grp.joinPolicy ?? 'approval')) patch.joinPolicy = this.groupSettingsPolicy();
    if (Object.keys(patch).length === 0) {
      this.groupNotice.set('Nothing to update.');
      return;
    }
    this.groupActionBusy.set('settings');
    this.messages
      .updateGroup(gid, patch)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.groupActionBusy.set(null);
          this.groupNotice.set('Group updated.');
          this.refreshOpenGroup();
          this.loadGroupsSilent();
        },
        error: (err: ApiError) => {
          this.groupActionBusy.set(null);
          this.groupNotice.set(userError(err));
        },
      });
  }

  protected deleteGroup(): void {
    const gid = this.openGroupId();
    if (!gid) return;
    this.groupActionBusy.set('delete');
    this.messages
      .deleteGroup(gid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.groupActionBusy.set(null);
          this.closeGroupChat();
          this.loadGroups();
          this.groupNotice.set('Group deleted.');
        },
        error: (err: ApiError) => {
          this.groupActionBusy.set(null);
          this.groupNotice.set(userError(err));
        },
      });
  }
}
