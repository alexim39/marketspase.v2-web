import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe, DOCUMENT } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { RouterModule } from '@angular/router';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { CommunityService } from '../../../core/community/community.service';
import { PresenceService, PresenceStatus } from '../../../core/presence/presence.service';
import { AuthService } from '../../../core/auth/auth.service';
import { AvatarComponent } from '../../../_common/avatar.component';
import { API_BASE_URL } from '../../../core/config/api-tokens';
import { AudienceScope, DirectoryEntry, FeedComment, FeedPost, POST_KIND_LABELS, PostAttachment, PostKind } from '../../../core/community/community.models';
import { ApiError } from '../../../core/http/api-error';

const MAX_ATTACHMENTS = 4;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

interface StagedMedia {
  key: string;
  kind: 'image' | 'video';
  previewUrl: string;
  attachment: PostAttachment | null;
  uploading: boolean;
  error: string | null;
}

const KIND_STYLES: Record<PostKind, string> = {
  standard: 'dp-status--info',
  announcement: 'dp-status--warn',
  recognition: 'dp-status--ok',
  training: 'dp-status--info',
  event: 'dp-status--warn',
};

/**
 * @title Community — team feed, recognition and announcements.
 *
 * Compose by kind + audience, like, thread comments, save, report.
 * Visibility is enforced server-side (team = downline, leadership = ECL+).
 * OnPush + signals, fully typed.
 */
@Component({
  selector: 'async-community-feed',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AvatarComponent, DatePipe, MatButtonModule, MatChipsModule, MatIconModule, MatInputModule,
    MatProgressBarModule, MatSelectModule, PageSkeletonComponent, ReactiveFormsModule, RouterModule,
  ],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <span>Community</span>
      </div>
    </section>

    <section class="community-page">
      <header class="page-head">
        <div>
          <p class="eyebrow">Community · Team feed</p>
          <h1>Community</h1>
          <p class="subtitle">Recognition, announcements and the conversations that move your team forward. Share a win, ask a question or celebrate someone.</p>
        </div>
        <button mat-flat-button color="primary" type="button" (click)="toggleCompose()">
          <mat-icon>{{ showCompose() ? 'close' : 'edit' }}</mat-icon>
          {{ showCompose() ? 'Close composer' : 'Write post' }}
        </button>
      </header>

      @if (loading() && posts().length === 0) {
        <async-page-skeleton layout="list" [rows]="4" label="community feed" [showHeader]="false" />
      }

      @if (error(); as err) {
        <div class="alert" role="alert">
          <mat-icon>error_outline</mat-icon>
          <p>{{ err }}</p>
          <button mat-stroked-button type="button" (click)="reload()">Retry</button>
        </div>
      }

      @if (posts().length > 0) {
        <section class="summary-strip" role="status" aria-label="Community summary">
          <div class="summary-item">
            <span class="summary-icon"><mat-icon>dynamic_feed</mat-icon></span>
            <div><strong>{{ posts().length }}</strong><span>Posts in feed</span></div>
          </div>
          <div class="summary-item">
            <span class="summary-icon summary-icon--ok"><mat-icon>favorite</mat-icon></span>
            <div><strong>{{ totalLikes() }}</strong><span>Reactions</span></div>
          </div>
          <div class="summary-item">
            <span class="summary-icon summary-icon--info"><mat-icon>forum</mat-icon></span>
            <div><strong>{{ totalComments() }}</strong><span>Conversations</span></div>
          </div>
          <div class="summary-item">
            <span class="summary-icon summary-icon--warn"><mat-icon>push_pin</mat-icon></span>
            <div><strong>{{ pinnedCount() }}</strong><span>Pinned updates</span></div>
          </div>
        </section>
      }

      <div class="feed-layout">
        <div class="feed-main">
          @if (showCompose()) {
            <form class="compose-card" [formGroup]="form" (ngSubmit)="publish()">
              <div class="compose-head">
                <span class="compose-icon"><mat-icon>edit_note</mat-icon></span>
                <div>
                  <h2>Share with your community</h2>
                  <p>Pick the audience and post type — type &#64; to mention a teammate.</p>
                </div>
                <button mat-icon-button type="button" (click)="toggleCompose()" aria-label="Close composer">
                  <mat-icon>close</mat-icon>
                </button>
              </div>

              <div class="compose-grid">
                <mat-form-field appearance="outline">
                  <mat-label>Post type</mat-label>
                  <mat-select formControlName="kind">
                    @for (k of kinds; track k) {
                      <mat-option [value]="k">{{ kindLabel(k) }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Audience</mat-label>
                  <mat-select formControlName="scope">
                    <mat-option value="global">Everyone</mat-option>
                    <mat-option value="team">My team</mat-option>
                    <mat-option value="leadership">Leadership</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>

              <mat-form-field appearance="outline">
                <mat-label>Title (optional)</mat-label>
                <input matInput formControlName="title" maxlength="120" placeholder="Give your post a headline" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>What is happening? (type @ to mention)</mat-label>
                <textarea matInput rows="4" formControlName="body" maxlength="2000" placeholder="Share an update, a win or a question…" (input)="onComposerBodyInput($any($event.target).value)"></textarea>
                <mat-hint>Keep it clear and encouraging — this is your team's shared space.</mat-hint>
              </mat-form-field>

              @if (mentionTarget() === 'post' && mentionSuggestions().length > 0) {
                <div class="suggestions" role="listbox" aria-label="Mention suggestions">
                  @for (u of mentionSuggestions(); track u.username) {
                    <button type="button" mat-button (click)="insertMention(u.username)">
                      <strong>{{ '@' + u.username }}</strong>&nbsp;<span class="muted">{{ u.name }}</span>
                    </button>
                  }
                </div>
              }

              <mat-form-field appearance="outline">
                <mat-label>Link (optional)</mat-label>
                <input matInput formControlName="link" maxlength="500" placeholder="https://…" />
              </mat-form-field>

              <div class="media-row">
                <label class="media-pick">
                  <mat-icon>perm_media</mat-icon>
                  <span>Add photos or video ({{ staged().length }}/{{ maxAttachments() }})</span>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    hidden
                    (change)="onFiles($any($event.target).files); $any($event.target).value = ''"
                  />
                </label>
                @if (uploadError(); as err) {
                  <span class="error" role="alert">{{ err }}</span>
                }
              </div>

              @if (staged().length > 0) {
                <div class="staged-grid">
                  @for (s of staged(); track s.key) {
                    <div class="staged">
                      @if (s.kind === 'video') {
                        <video [src]="s.previewUrl" preload="metadata" muted playsinline></video>
                      } @else {
                        <img [src]="s.previewUrl" alt="Photo to post" />
                      }
                      @if (s.uploading) {
                        <mat-progress-bar mode="indeterminate" aria-label="Loading" />
                      }
                      @if (s.error) {
                        <span class="error">{{ s.error }}</span>
                      }
                      <button type="button" mat-icon-button (click)="removeStaged(s.key)" aria-label="Remove media">
                        <mat-icon>close</mat-icon>
                      </button>
                    </div>
                  }
                </div>
              }

              <div class="compose-actions">
                <p class="muted">Posts are visible to the audience you choose. Be kind and specific.</p>
                <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || publishing() || uploadingCount() > 0">
                  <mat-icon>send</mat-icon>
                  {{ publishing() ? 'Posting…' : 'Publish post' }}
                </button>
                @if (publishError(); as err) {
                  <span class="error" role="alert">{{ err }}</span>
                }
              </div>
            </form>
          }

          @if (posts().length > 0) {
            @if (pinError(); as perr) {
              <div class="alert alert--inline" role="alert">
                <mat-icon>error_outline</mat-icon>
                <p>{{ perr }}</p>
              </div>
            }
            <ol class="feed">
              @for (post of posts(); track post.id) {
                <li class="post" [class.post--recognition]="post.kind === 'recognition'" [class.post--pinned]="post.pinned">
                  <header class="post-head">
                    <async-avatar [photo]="post.author?.profileImage" [name]="post.author?.name ?? 'Teammate'" size="sm" [presence]="presenceOf(post.authorId)" />
                    <div class="post-author">
                      <strong>{{ post.author?.name ?? 'Teammate' }}</strong>
                      <span>{{ post.createdAt | date:'medium' }} · {{ scopeLabel(post.scope) }}</span>
                    </div>
                    <span class="kind-chip kind-chip--{{ post.kind }}">{{ kindLabel(post.kind) }}</span>
                    @if (post.auto) {
                      <span class="auto-chip">Automatic</span>
                    }
                    @if (post.pinned) {
                      <span class="pin-chip"><mat-icon>push_pin</mat-icon>Pinned</span>
                    }
                    <span class="spacer"></span>
                    @if (isMine(post)) {
                      @if (canPin(post)) {
                        <button mat-icon-button type="button" (click)="togglePin(post)" [disabled]="actingId() === post.id" [title]="post.pinned ? 'Unpin from top' : 'Pin to top'" [aria-label]="post.pinned ? 'Unpin from top' : 'Pin to top'">
                          <mat-icon>{{ post.pinned ? 'push_pin' : 'pin_drop' }}</mat-icon>
                        </button>
                      }
                      @if (!post.auto) {
                        <button mat-icon-button type="button" (click)="startEdit(post)" [disabled]="savingEdit()" title="Edit post" aria-label="Edit post">
                          <mat-icon>edit</mat-icon>
                        </button>
                      }
                      <button mat-icon-button type="button" (click)="confirmingDeleteId.set(post.id)" [disabled]="deleting()" title="Delete post" aria-label="Delete post">
                        <mat-icon>delete</mat-icon>
                      </button>
                    }
                  </header>

                  @if (confirmingDeleteId() === post.id) {
                    <div class="delete-confirm" role="alertdialog" aria-label="Confirm delete">
                      <span><strong>Delete this post?</strong> Comments and likes go with it — this cannot be undone.</span>
                      <span class="delete-actions">
                        <button mat-button type="button" (click)="confirmingDeleteId.set(null)" [disabled]="deleting()">Keep</button>
                        <button mat-flat-button color="warn" type="button" (click)="confirmDelete(post)" [disabled]="deleting()">
                          {{ deleting() ? 'Deleting…' : 'Yes, delete' }}
                        </button>
                      </span>
                    </div>
                  }

                  @if (editingId() === post.id) {
                    <div class="edit-form">
                      <mat-form-field appearance="outline">
                        <mat-label>Title (optional)</mat-label>
                        <input matInput [value]="editTitle()" (input)="editTitle.set($any($event.target).value)" maxlength="120" />
                      </mat-form-field>
                      <mat-form-field appearance="outline">
                        <mat-label>Post text</mat-label>
                        <textarea matInput rows="3" [value]="editBody()" (input)="editBody.set($any($event.target).value)" maxlength="2000"></textarea>
                      </mat-form-field>
                      <mat-form-field appearance="outline">
                        <mat-label>Link (optional)</mat-label>
                        <input matInput [value]="editLink()" (input)="editLink.set($any($event.target).value)" maxlength="500" />
                      </mat-form-field>
                      <div class="edit-actions">
                        <button mat-flat-button color="primary" type="button" (click)="saveEdit(post)" [disabled]="savingEdit() || !editBody().trim()">
                          {{ savingEdit() ? 'Saving…' : 'Save changes' }}
                        </button>
                        <button mat-button type="button" (click)="cancelEdit()" [disabled]="savingEdit()">Cancel</button>
                        @if (editError(); as err) {
                          <span class="error" role="alert">{{ err }}</span>
                        }
                      </div>
                    </div>
                  } @else {
                    @if (post.title) {
                      <h2 class="post-title">{{ post.title }}</h2>
                    }
                    <div class="post-body">@for (seg of segments(post.body); track $index) {<span [class.mention]="seg.mention">{{ seg.text }}</span>}</div>
                    @if (post.link) {
                      <a class="link-row" [href]="post.link" target="_blank" rel="noopener">
                        <mat-icon>link</mat-icon><span>{{ post.link }}</span>
                      </a>
                    }
                  }

                  @if (post.attachments; as attachments) {
                    @if (attachments.length > 0) {
                      <div
                        class="attach-grid"
                        [class.attach-grid--single]="attachments.length === 1"
                        [class.attach-grid--trio]="attachments.length === 3"
                      >
                        @for (att of attachments; track att.url; let i = $index) {
                          <button
                            type="button"
                            class="attach-thumb"
                            (click)="openViewer(attachments, i)"
                            [attr.aria-label]="isVideoAttachment(att) ? 'Play post video ' + (i + 1) : 'View post image ' + (i + 1)"
                          >
                            @if (isVideoAttachment(att)) {
                              <video [src]="resolveAttachment(att.url)" preload="metadata" playsinline></video>
                              <span class="attach-play" aria-hidden="true"><mat-icon>play_arrow</mat-icon></span>
                            } @else {
                              <img [src]="resolveAttachment(att.url)" alt="Post image" loading="lazy" />
                            }
                          </button>
                        }
                      </div>
                    }
                  }

                  <footer class="post-actions">
                    <button mat-button type="button" class="action-btn" (click)="toggleLike(post)" [disabled]="actingId() === post.id" [color]="post.likedByMe ? 'primary' : undefined" [title]="post.likedByMe ? 'Unlike' : 'Like'">
                      <mat-icon>{{ post.likedByMe ? 'favorite' : 'favorite_border' }}</mat-icon>
                      {{ post.likeCount ?? 0 }}
                    </button>
                    <button mat-button type="button" class="action-btn" (click)="toggleComments(post)" title="Comments">
                      <mat-icon>comment</mat-icon>
                      {{ post.commentCount ?? 0 }}
                    </button>
                    <button mat-button type="button" class="action-btn" (click)="toggleSave(post)" [disabled]="actingId() === post.id" [title]="post.savedByMe ? 'Unsave' : 'Save'">
                      <mat-icon>{{ post.savedByMe ? 'bookmark' : 'bookmark_border' }}</mat-icon>
                      {{ post.saveCount ?? 0 }}
                    </button>
                    <span class="spacer"></span>
                    @if (!isMine(post) && canPin(post)) {
                      <button mat-button type="button" class="action-btn" (click)="togglePin(post)" [disabled]="actingId() === post.id" [title]="post.pinned ? 'Unpin from top' : 'Pin to top'">
                        <mat-icon>{{ post.pinned ? 'push_pin' : 'pin_drop' }}</mat-icon>
                        {{ post.pinned ? 'Unpin' : 'Pin' }}
                      </button>
                    }
                    <button mat-button type="button" class="action-btn action-btn--muted" (click)="report(post)" [disabled]="actingId() === post.id" title="Hide this post">Hide</button>
                  </footer>

                  @if (openThread() === post.id) {
                    <div class="thread">
                      <div class="thread-head">
                        <h3>Conversation</h3>
                        <span class="muted">{{ post.commentCount ?? 0 }} comment{{ (post.commentCount ?? 0) === 1 ? '' : 's' }}</span>
                      </div>
                      @if (loadingComments()) {
                        <mat-progress-bar mode="indeterminate" aria-label="Loading" />
                      }
                      @for (comment of comments(); track comment.id) {
                        <div class="comment" [class.comment--reply]="!!comment.parentId">
                          <div class="comment-head">
                            <async-avatar [photo]="comment.author?.profileImage" [name]="comment.author?.name ?? 'Teammate'" size="xs" [presence]="presenceOf(comment.authorId)" />
                            <strong>{{ comment.author?.name ?? 'Teammate' }}</strong>
                            <span class="muted">{{ comment.createdAt | date:'short' }}</span>
                          </div>
                          <div class="comment-body">@for (seg of segments(comment.body); track $index) {<span [class.mention]="seg.mention">{{ seg.text }}</span>}</div>
                          <div class="comment-foot">
                            <button mat-button type="button" (click)="toggleCommentLike(comment)" [disabled]="actingId() === comment.id" [color]="comment.likedByMe ? 'primary' : undefined" [title]="comment.likedByMe ? 'Unlike' : 'Like'">
                              <mat-icon>{{ comment.likedByMe ? 'favorite' : 'favorite_border' }}</mat-icon>
                              {{ comment.likeCount ?? 0 }}
                            </button>
                            <button mat-button type="button" (click)="replyTo.set({ postId: post.id, parentId: comment.parentId ?? comment.id, name: comment.author?.name ?? 'teammate' })">Reply</button>
                          </div>
                        </div>
                      }
                      @if (replyingToPost() === post.id) {
                        <p class="muted replying">Replying to {{ replyTo()?.name }} <button mat-button type="button" (click)="replyTo.set(null)">cancel</button></p>
                      }
                      <div class="comment-box">
                        <mat-form-field appearance="outline" subscriptSizing="dynamic">
                          <mat-label>Write a comment… (&#64; to mention)</mat-label>
                          <input matInput [value]="draft()" (input)="onDraftInput($any($event.target).value)" maxlength="1000" (keydown.enter)="sendComment(post)" />
                        </mat-form-field>
                        <button mat-flat-button color="primary" type="button" (click)="sendComment(post)" [disabled]="!draft().trim() || sendingComment()">
                          <mat-icon>send</mat-icon>
                          Send
                        </button>
                      </div>
                      @if (mentionTarget() === 'comment' && mentionSuggestions().length > 0 && openThread() === post.id) {
                        <div class="suggestions" role="listbox" aria-label="Mention suggestions">
                          @for (u of mentionSuggestions(); track u.username) {
                            <button type="button" mat-button (click)="insertMention(u.username)">
                              <strong>{{ '@' + u.username }}</strong>&nbsp;<span class="muted">{{ u.name }}</span>
                            </button>
                          }
                        </div>
                      }
                      @if (commentError(); as err) {
                        <span class="error" role="alert">{{ err }}</span>
                      }
                    </div>
                  }
                </li>
              }
            </ol>
            @if (nextCursor()) {
              <div class="load-more">
                <button mat-stroked-button type="button" (click)="loadMore()" [disabled]="loadingMore()">
                  {{ loadingMore() ? 'Loading…' : 'Load more posts' }}
                </button>
              </div>
            }
          } @else if (!loading() && !error()) {
            <div class="empty-card">
              <span class="empty-icon"><mat-icon>forum</mat-icon></span>
              <h2>Quiet here — be the first to post</h2>
              <p>Share a win, an announcement or a question. Your team is waiting to hear from you.</p>
              <button mat-flat-button color="primary" type="button" (click)="toggleCompose()">Write the first post</button>
            </div>
          }
        </div>

        <aside class="feed-aside">
          <section class="aside-card">
            <div class="aside-head">
              <span class="aside-icon"><mat-icon>volunteer_activism</mat-icon></span>
              <div><h2>Community guidelines</h2><p>Keep the space useful for everyone.</p></div>
            </div>
            <ul class="guidelines">
              <li><strong>Celebrate generously.</strong> Recognition costs nothing and compounds.</li>
              <li><strong>Be specific.</strong> Share what worked so others can repeat it.</li>
              <li><strong>Protect privacy.</strong> Never post phone numbers, passwords or payment details.</li>
              <li><strong>Stay on purpose.</strong> No spam, recruitment pressure or off-topic promotion.</li>
            </ul>
          </section>

          <section class="aside-card">
            <div class="aside-head">
              <span class="aside-icon"><mat-icon>explore</mat-icon></span>
              <div><h2>Explore community</h2><p>More ways to connect with your team.</p></div>
            </div>
            <div class="quick-links">
              <a mat-stroked-button routerLink="/dashboard/community">
                <mat-icon>hub</mat-icon>
                Community hub
              </a>
              <a mat-stroked-button routerLink="/dashboard/community/events">
                <mat-icon>event</mat-icon>
                Events &amp; meetups
              </a>
            </div>
          </section>

          <section class="aside-card aside-card--accent">
            <div class="aside-head">
              <span class="aside-icon aside-icon--accent"><mat-icon>tips_and_updates</mat-icon></span>
              <div><h2>Posting tip</h2><p>Great posts get more engagement.</p></div>
            </div>
            <p class="aside-copy">Lead with the outcome, tag the people involved and add one clear next step. A photo or short video lifts replies further.</p>
            <button mat-flat-button color="primary" type="button" (click)="toggleCompose()">
              <mat-icon>edit</mat-icon>
              Write a post
            </button>
          </section>
        </aside>
      </div>

      @if (viewer(); as v) {
        <div
          class="viewer-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Media viewer"
          tabindex="0"
          (click)="closeViewer()"
          (keydown)="onViewerKey($event)"
        >
          <div class="viewer-shell" (click)="$event.stopPropagation()">
            <div class="viewer-bar">
              <span class="viewer-count">{{ v.index + 1 }} / {{ v.items.length }}</span>
              <span class="spacer"></span>
              @if (v.items.length > 1) {
                <button mat-icon-button (click)="stepViewer(-1)" aria-label="Previous media">
                  <mat-icon>chevron_left</mat-icon>
                </button>
                <button mat-icon-button (click)="stepViewer(1)" aria-label="Next media">
                  <mat-icon>chevron_right</mat-icon>
                </button>
              }
              <button mat-icon-button (click)="closeViewer()" aria-label="Close viewer" autofocus>
                <mat-icon>close</mat-icon>
              </button>
            </div>
            @if (viewerItem(); as item) {
              <div
                class="viewer-media"
                (touchstart)="onSwipeStart($event)"
                (touchend)="onSwipeEnd($event)"
              >
                @if (isVideoAttachment(item)) {
                  <video [src]="resolveAttachment(item.url)" controls playsinline></video>
                } @else {
                  <img [src]="resolveAttachment(item.url)" alt="Post media enlarged" />
                }
              </div>
            }
            @if (v.items.length > 1) {
              <div class="viewer-strip" role="tablist" aria-label="Attachments">
                @for (item of v.items; track item.url; let i = $index) {
                  <button
                    type="button"
                    [class.active]="i === v.index"
                    (click)="viewerGo(i)"
                    [attr.aria-label]="'Show attachment ' + (i + 1)"
                    [attr.aria-selected]="i === v.index"
                    role="tab"
                  >
                    @if (isVideoAttachment(item)) {
                      <video [src]="resolveAttachment(item.url)" preload="metadata" playsinline muted></video>
                    } @else {
                      <img [src]="resolveAttachment(item.url)" alt="" loading="lazy" />
                    }
                  </button>
                }
              </div>
            }
          </div>
        </div>
      }
    </section>
`,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 16px; }
    .breadcrumb a { text-decoration: none; }
    .community-page { display: flex; flex-direction: column; gap: 24px; max-width: 1200px; margin: 0 auto; padding-bottom: 32px; }
    .page-head { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 24px; }
    .page-head h1 { margin: 4px 0 8px; font-size: clamp(2rem, 3vw, 2.5rem); letter-spacing: -0.03em; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
    .subtitle { margin: 0; max-width: 62em; color: var(--ms-text-muted); line-height: 1.6; }
    .page-head button mat-icon { margin-right: 6px; }

    .summary-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; padding: 8px; background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); }
    .summary-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: var(--ms-radius-md); }
    .summary-icon { flex: none; width: 40px; height: 40px; border-radius: var(--ms-radius-md); display: grid; place-items: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .summary-icon--ok { background: var(--ms-success-soft); color: var(--ms-success); }
    .summary-icon--info { background: var(--ms-info-soft); color: var(--ms-primary-strong); }
    .summary-icon--warn { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .summary-icon mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .summary-item div { display: flex; flex-direction: column; gap: 1px; }
    .summary-item strong { font-family: var(--ms-font-display); font-size: 1.5rem; line-height: 1.1; font-variant-numeric: tabular-nums; }
    .summary-item span:last-child { color: var(--ms-text-muted); font-size: 0.75rem; font-weight: 600; }

    .feed-layout { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(0, 0.8fr); gap: 24px; align-items: start; }
    .feed-main { display: flex; flex-direction: column; gap: 16px; min-width: 0; }

    .compose-card { display: flex; flex-direction: column; gap: 16px; padding: 24px; background: var(--ms-surface); border: 1px solid var(--ms-primary); border-radius: var(--ms-radius-lg); box-shadow: var(--ms-shadow-md); }
    .compose-head { display: flex; align-items: center; gap: 12px; }
    .compose-icon { flex: none; width: 44px; height: 44px; border-radius: var(--ms-radius-lg); display: grid; place-items: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .compose-icon mat-icon { font-size: 22px; width: 22px; height: 22px; }
    .compose-head > div { flex: 1; min-width: 0; }
    .compose-head h2 { margin: 0 0 2px; font-size: 1.125rem; }
    .compose-head p { margin: 0; color: var(--ms-text-muted); font-size: 0.8125rem; line-height: 1.5; }
    .compose-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 16px; }
    .compose-actions { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; border-top: 1px solid var(--ms-line); padding-top: 16px; }
    .compose-actions .muted { margin: 0; color: var(--ms-text-muted); font-size: 0.75rem; }
    .compose-actions button { min-height: 44px; }
    .compose-actions button mat-icon { margin-right: 6px; }

    .feed { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 16px; }
    .post { display: flex; flex-direction: column; gap: 16px; padding: 24px; background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); box-shadow: var(--ms-shadow-sm); }
    .post--pinned { border-left: 3px solid var(--ms-primary); }
    .post--recognition { border-left: 3px solid var(--ms-success); }
    .post-head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .post-head .spacer { flex: 1; }
    .post-author { flex: 1; min-width: 160px; display: flex; flex-direction: column; gap: 1px; }
    .post-author strong { font-size: 0.9375rem; font-weight: 600; }
    .post-author span { color: var(--ms-text-muted); font-size: 0.75rem; }
    .post-head mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .kind-chip { border-radius: 999px; padding: 4px 10px; font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.03em; white-space: nowrap; }
    .kind-chip--standard { background: var(--ms-info-soft); color: var(--ms-primary-strong); }
    .kind-chip--announcement { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .kind-chip--recognition { background: var(--ms-success-soft); color: var(--ms-success); }
    .kind-chip--training { background: var(--ms-info-soft); color: var(--ms-primary-strong); }
    .kind-chip--event { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .auto-chip { color: var(--ms-text-muted); font-size: 0.6875rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; }
    .pin-chip { display: inline-flex; align-items: center; gap: 4px; border-radius: 999px; padding: 4px 10px; background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-size: 0.6875rem; font-weight: 700; }
    .post-title { margin: 0; font-size: 1.125rem; line-height: 1.4; }
    .post-body { white-space: pre-wrap; line-height: 1.65; }
    .mention { color: var(--ms-primary-strong); font-weight: 600; }
    .link-row { display: inline-flex; align-items: center; gap: 8px; color: var(--ms-primary-strong); font-size: 0.875rem; word-break: break-all; }
    .link-row mat-icon { font-size: 16px; height: 16px; width: 16px; }
    .suggestions { display: flex; flex-wrap: wrap; gap: 4px; background: var(--ms-canvas); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-md); padding: 8px; }
    .media-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .media-pick { display: inline-flex; align-items: center; gap: 8px; min-height: 48px; cursor: pointer; color: var(--ms-primary-strong); font-weight: 500; font-size: 0.875rem; }
    .staged-grid { display: flex; gap: 8px; flex-wrap: wrap; }
    .staged { position: relative; width: 96px; }
    .staged img, .staged video { width: 96px; height: 96px; object-fit: cover; border-radius: var(--ms-radius-md); border: 1px solid var(--ms-line); display: block; background: #000; }
    .staged button { position: absolute; top: -8px; right: -8px; background: var(--ms-surface); }
    .staged .error { font-size: 0.75rem; }
    .attach-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 2px; border-radius: var(--ms-radius-lg); overflow: hidden; border: 1px solid var(--ms-line); background: #000; }
    .attach-grid--single { grid-template-columns: 1fr; }
    .attach-grid--trio { grid-template-columns: repeat(3, 1fr); }
    .attach-grid--trio .attach-thumb { aspect-ratio: 1 / 1; }
    .attach-thumb { position: relative; border: none; padding: 0; margin: 0; background: #000; cursor: zoom-in; overflow: hidden; aspect-ratio: 16 / 10; min-height: 96px; max-height: 280px; }
    .attach-grid--single .attach-thumb { aspect-ratio: 16 / 9; max-height: 420px; min-height: 180px; }
    .attach-thumb img, .attach-thumb video { width: 100%; height: 100%; object-fit: cover; display: block; }
    .attach-thumb img { transition: transform 0.25s ease; }
    .attach-thumb:hover img { transform: scale(1.03); }
    .attach-thumb:focus-visible { outline: 2px solid var(--ms-primary); outline-offset: -2px; }
    .attach-play { position: absolute; inset: 0; margin: auto; width: 56px; height: 56px; border-radius: 50%; background: rgba(0, 0, 0, 0.55); border: 1.5px solid rgba(255, 255, 255, 0.85); display: inline-flex; align-items: center; justify-content: center; pointer-events: none; }
    .attach-play mat-icon { color: #fff; font-size: 32px; height: 32px; width: 32px; }

    .post-actions { display: flex; align-items: center; gap: 2px; flex-wrap: wrap; border-top: 1px solid var(--ms-line); padding-top: 8px; margin-top: -4px; }
    .post-actions .spacer { flex: 1; }
    .action-btn { min-height: 40px; }
    .action-btn mat-icon { font-size: 18px; width: 18px; height: 18px; margin-right: 4px; }
    .action-btn--muted { color: var(--ms-text-muted); }

    .delete-confirm { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; background: var(--ms-error-soft); border: 1px solid var(--ms-error); border-radius: var(--ms-radius-md); padding: 12px 16px; font-size: 0.8125rem; }
    .delete-actions { display: inline-flex; gap: 8px; margin-left: auto; }
    .delete-confirm button { min-height: 40px; }

    .edit-form { display: flex; flex-direction: column; gap: 8px; padding: 16px; background: var(--ms-canvas); border-radius: var(--ms-radius-lg); }
    .edit-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .edit-actions button { min-height: 40px; }

    .thread { display: flex; flex-direction: column; gap: 12px; border-top: 1px solid var(--ms-line); padding-top: 16px; }
    .thread-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
    .thread-head h3 { margin: 0; font-size: 0.9375rem; }
    .comment { display: flex; flex-direction: column; gap: 6px; background: var(--ms-canvas); border-radius: var(--ms-radius-md); padding: 12px 16px; }
    .comment--reply { margin-left: 24px; border-left: 2px solid var(--ms-line); }
    .comment-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .comment-head strong { font-size: 0.8125rem; font-weight: 600; }
    .comment-head .muted { font-size: 0.75rem; }
    .comment-body { white-space: pre-wrap; line-height: 1.55; font-size: 0.875rem; }
    .comment-foot { display: flex; align-items: center; gap: 8px; }
    .comment-foot button { min-height: 36px; }
    .comment-foot mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
    .replying { display: flex; align-items: center; gap: 8px; margin: 0; }
    .comment-box { display: flex; gap: 8px; align-items: center; }
    .comment-box mat-form-field { flex: 1; }
    .comment-box button { min-height: 44px; }
    .comment-box button mat-icon { margin-right: 4px; }

    .feed-aside { display: flex; flex-direction: column; gap: 16px; position: sticky; top: 96px; }
    .aside-card { display: flex; flex-direction: column; gap: 12px; padding: 16px; background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); }
    .aside-card--accent { background: linear-gradient(135deg, var(--ms-primary-soft), var(--ms-surface)); border-color: var(--ms-primary); }
    .aside-head { display: flex; align-items: flex-start; gap: 12px; }
    .aside-head h2 { margin: 0 0 2px; font-size: 0.9375rem; }
    .aside-head p { margin: 0; color: var(--ms-text-muted); font-size: 0.75rem; }
    .aside-icon { flex: none; width: 36px; height: 36px; border-radius: var(--ms-radius-md); display: grid; place-items: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .aside-icon--accent { background: var(--ms-surface); }
    .aside-icon mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .guidelines { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; }
    .guidelines li { position: relative; padding-left: 16px; color: var(--ms-text-muted); font-size: 0.8125rem; line-height: 1.5; }
    .guidelines li::before { content: ''; position: absolute; left: 0; top: 7px; width: 6px; height: 6px; border-radius: 50%; background: var(--ms-primary); }
    .guidelines strong { color: var(--ms-text); font-weight: 600; }
    .quick-links { display: flex; flex-direction: column; gap: 8px; }
    .quick-links a { justify-content: flex-start; min-height: 44px; }
    .quick-links mat-icon { margin-right: 6px; }
    .aside-copy { margin: 0; color: var(--ms-text-muted); font-size: 0.8125rem; line-height: 1.6; }
    .aside-card > button { min-height: 44px; }
    .aside-card > button mat-icon { margin-right: 6px; }

    .alert { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: var(--ms-radius-lg); background: var(--ms-error-soft); color: var(--ms-error); }
    .alert p { flex: 1; margin: 0; }
    .alert--inline { font-size: 0.875rem; }
    .muted { color: var(--ms-text-muted); font-size: 0.875rem; }
    .error { color: var(--ms-error); display: flex; align-items: center; gap: 8px; }
    .empty-card { display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center; padding: 48px 24px; background: var(--ms-surface); border: 1px dashed var(--ms-line); border-radius: var(--ms-radius-lg); color: var(--ms-text-muted); }
    .empty-card h2 { margin: 0; color: var(--ms-text); font-size: 1.25rem; }
    .empty-card p { margin: 0; max-width: 42em; line-height: 1.6; }
    .empty-icon { width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .empty-icon mat-icon { font-size: 28px; width: 28px; height: 28px; }
    .load-more { display: flex; justify-content: center; padding-top: 8px; }
    .load-more button { min-height: 44px; min-width: 200px; }

    .viewer-backdrop { position: fixed; inset: 0; z-index: 1200; background: rgba(0, 0, 0, 0.9); display: flex; align-items: center; justify-content: center; padding: 16px; animation: viewer-fade 0.18s ease; }
    @keyframes viewer-fade { from { opacity: 0; } to { opacity: 1; } }
    .viewer-shell { width: min(960px, 100%); display: flex; flex-direction: column; gap: 8px; animation: viewer-pop 0.18s ease; }
    @keyframes viewer-pop { from { transform: scale(0.97); opacity: 0; } to { transform: none; opacity: 1; } }
    @media (prefers-reduced-motion: reduce) {
      .attach-thumb img { transition: none; }
      .viewer-backdrop, .viewer-shell { animation: none; }
    }
    .viewer-bar { display: flex; align-items: center; gap: 4px; color: #fff; }
    .viewer-bar .spacer { flex: 1; }
    .viewer-bar button { color: #fff; min-height: 44px; min-width: 44px; }
    .viewer-count { font-size: 0.875rem; opacity: 0.85; }
    .viewer-media { display: flex; align-items: center; justify-content: center; background: #000; border-radius: var(--ms-radius-lg); overflow: hidden; }
    .viewer-media img { max-width: 100%; max-height: 78vh; object-fit: contain; display: block; }
    .viewer-media video { width: 100%; max-height: 78vh; display: block; }
    .viewer-strip { display: flex; gap: 8px; overflow-x: auto; padding: 2px; }
    .viewer-strip button { flex: none; width: 64px; height: 64px; border-radius: var(--ms-radius-md); overflow: hidden; border: 2px solid transparent; background: #000; padding: 0; margin: 0; cursor: pointer; }
    .viewer-strip button.active { border-color: var(--ms-primary); }
    .viewer-strip button:focus-visible { outline: 2px solid #fff; outline-offset: 1px; }
    .viewer-strip img, .viewer-strip video { width: 100%; height: 100%; object-fit: cover; display: block; }

    @media only screen and (max-width: 1000px) {
      .feed-layout { grid-template-columns: minmax(0, 1fr); }
      .feed-aside { position: static; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .feed-aside .aside-card--accent { grid-column: 1 / -1; }
    }
    @media only screen and (max-width: 720px) {
      .community-page { gap: 16px; }
      .summary-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .compose-card, .post { padding: 16px; }
      .compose-grid { grid-template-columns: minmax(0, 1fr); }
      .feed-aside { grid-template-columns: minmax(0, 1fr); }
      .feed-aside .aside-card--accent { grid-column: auto; }
      .comment--reply { margin-left: 16px; }
      .post-actions .spacer { display: none; }
      .action-btn { flex: 1 1 auto; }
      .viewer-backdrop { padding: 8px; }
      .viewer-media img, .viewer-media video { max-height: 72vh; }
      .attach-thumb { min-height: 84px; max-height: 220px; }
      .attach-grid--single .attach-thumb { max-height: 260px; min-height: 160px; }
      .attach-grid--trio { grid-template-columns: repeat(2, 1fr); }
      .attach-grid--trio .attach-thumb { aspect-ratio: 16 / 10; }
      .attach-grid--trio .attach-thumb:last-child { grid-column: 1 / 3; aspect-ratio: 21 / 9; max-height: 180px; min-height: 120px; }
    }
`],
})
export class CommunityFeedComponent implements OnInit, OnDestroy {
  private readonly community = inject(CommunityService);
  private readonly auth = inject(AuthService);
  private readonly presence = inject(PresenceService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly apiBase = inject(API_BASE_URL);
  private readonly document = inject(DOCUMENT);
  private stagedSeq = 0;
  /** authorId → lastSeenAt (null = offline/stranger); drives avatar dots. */
  protected readonly presenceMap = signal<Record<string, string | null>>({});

  protected readonly loading = signal(true);
  protected readonly loadingMore = signal(false);
  protected readonly loadingComments = signal(false);
  protected readonly publishing = signal(false);
  protected readonly sendingComment = signal(false);
  protected readonly actingId = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly publishError = signal<string | null>(null);
  protected readonly commentError = signal<string | null>(null);
  protected readonly showCompose = signal(false);
  protected readonly posts = signal<FeedPost[]>([]);
  protected readonly totalLikes = computed(() => this.posts().reduce((sum, p) => sum + (p.likeCount ?? 0), 0));
  protected readonly totalComments = computed(() => this.posts().reduce((sum, p) => sum + (p.commentCount ?? 0), 0));
  protected readonly pinnedCount = computed(() => this.posts().filter((p) => p.pinned).length);
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly openThread = signal<string | null>(null);
  protected readonly comments = signal<FeedComment[]>([]);
  protected readonly draft = signal('');
  protected readonly replyTo = signal<{ postId: string; parentId: string; name: string } | null>(null);
  protected readonly mentionSuggestions = signal<DirectoryEntry[]>([]);
  protected readonly mentionTarget = signal<'post' | 'comment' | null>(null);
  private lastMentionQuery = '';
  protected readonly staged = signal<StagedMedia[]>([]);
  protected readonly uploadError = signal<string | null>(null);
  protected readonly editingId = signal<string | null>(null);
  protected readonly editTitle = signal('');
  protected readonly editBody = signal('');
  protected readonly editLink = signal('');
  protected readonly savingEdit = signal(false);
  protected readonly editError = signal<string | null>(null);
  protected readonly confirmingDeleteId = signal<string | null>(null);
  protected readonly deleting = signal(false);
  protected readonly pinError = signal<string | null>(null);
  /** In-page media viewer (lightbox) — null when closed. */
  protected readonly viewer = signal<{ items: PostAttachment[]; index: number } | null>(null);
  private swipeStartX: number | null = null;

  protected readonly kinds: PostKind[] = ['standard', 'announcement', 'recognition', 'training', 'event'];

  protected readonly form = this.fb.nonNullable.group({
    kind: ['standard' as PostKind, Validators.required],
    scope: ['global' as AudienceScope, Validators.required],
    title: ['', Validators.maxLength(120)],
    body: ['', [Validators.required, Validators.maxLength(2000)]],
    link: ['', Validators.maxLength(500)],
  });

  ngOnInit(): void {
    this.reload();
  }

  ngOnDestroy(): void {
    try {
      this.document.body.style.overflow = '';
    } catch { /* viewer simply stays closed */ }
  }

  /** Presence dot for an author id (null hides it). */
  protected presenceOf(authorId: string | null | undefined): PresenceStatus {
    if (!authorId) return null;
    return this.presence.statusOf(this.presenceMap()[String(authorId)] ?? null);
  }

  /** Refresh presence for visible post + comment authors (single bulk call). */
  private refreshPresence(): void {
    const ids = [
      ...this.posts().map((p) => p.authorId),
      ...this.comments().map((c) => c.authorId),
    ];
    if (ids.length === 0) return;
    this.presence
      .lookup(ids)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((map) => this.presenceMap.set({ ...this.presenceMap(), ...map }));
  }

  protected kindLabel(kind: PostKind): string {
    return POST_KIND_LABELS[kind] ?? kind;
  }

  protected scopeLabel(scope: AudienceScope): string {
    switch (scope) {
      case 'team': return 'My team';
      case 'leadership': return 'Leadership';
      default: return 'Everyone';
    }
  }

  protected kindStyle(kind: PostKind): string {
    return KIND_STYLES[kind] ?? 'dp-status--info';
  }

  /** Split body into plain/mention runs for highlighted rendering. */
  protected segments(text: string): Array<{ text: string; mention: boolean }> {
    const parts = String(text ?? '').split(/(@[A-Za-z0-9_.]{2,40})/g);
    return parts
      .filter((p) => p.length > 0)
      .map((p) => ({ text: p, mention: /^@[A-Za-z0-9_.]{2,40}$/.test(p) }));
  }

  protected onComposerBodyInput(value: string): void {
    this.lookupMentions(value, 'post');
  }

  protected onDraftInput(value: string): void {
    this.draft.set(value);
    this.lookupMentions(value, 'comment');
  }

  /** Trailing @query → directory lookup (2+ chars, deduped). */
  private lookupMentions(value: string, target: 'post' | 'comment'): void {
    const m = String(value ?? '').match(/@([A-Za-z0-9_.]{2,40})$/);
    const query = m ? m[1] : '';
    if (!query || query === this.lastMentionQuery) {
      if (!query) {
        this.mentionSuggestions.set([]);
        this.mentionTarget.set(null);
      }
      return;
    }
    this.lastMentionQuery = query;
    this.community
      .directory(query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.mentionSuggestions.set(res.data ?? []);
          this.mentionTarget.set(target);
        },
        error: () => {
          this.mentionSuggestions.set([]);
          this.mentionTarget.set(null);
        },
      });
  }

  protected insertMention(username: string): void {
    const target = this.mentionTarget();
    if (target === 'post') {
      const current = this.form.getRawValue().body ?? '';
      this.form.patchValue({ body: current.replace(/@[A-Za-z0-9_.]{2,40}$/, `@${username} `) });
    } else if (target === 'comment') {
      this.draft.set(this.draft().replace(/@[A-Za-z0-9_.]{2,40}$/, `@${username} `));
    }
    this.lastMentionQuery = '';
    this.mentionSuggestions.set([]);
    this.mentionTarget.set(null);
  }

  protected replyingToPost(): string | null {
    const r = this.replyTo();
    return r && this.openThread() === r.postId ? r.postId : null;
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.community
      .feed(undefined, 20)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.posts.set(res.data?.items ?? []);
          this.nextCursor.set(res.data?.nextCursor ?? null);
          this.loading.set(false);
          this.refreshPresence();
        },
        error: (err: ApiError) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
  }

  protected loadMore(): void {
    const cursor = this.nextCursor();
    if (!cursor) return;
    this.loadingMore.set(true);
    this.community
      .feed(cursor, 20)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.loadingMore.set(false);
          // Pinned-first server sort breaks chronological cursors: an old
          // pinned post can rank on both pages. Dedupe by id as the guard.
          const seen = new Set(this.posts().map((p) => p.id));
          const fresh = (res.data?.items ?? []).filter((p) => !seen.has(p.id));
          this.posts.set([...this.posts(), ...fresh]);
          this.nextCursor.set(res.data?.nextCursor ?? null);
          this.refreshPresence();
        },
        error: (err: ApiError) => {
          this.loadingMore.set(false);
          this.error.set(err.message);
        },
      });
  }

  protected toggleCompose(): void {
    this.showCompose.set(!this.showCompose());
    this.publishError.set(null);
  }

  protected maxAttachments(): number {
    return MAX_ATTACHMENTS;
  }

  protected uploadingCount(): number {
    return this.staged().filter((s) => s.uploading).length;
  }

  /** Relative upload paths resolve against the API origin. */
  protected resolveAttachment(url: string): string {
    const u = String(url ?? '');
    if (/^https?:\/\//i.test(u)) return u;
    return `${this.apiBase}${u.startsWith('/') ? '' : '/'}${u}`;
  }

  protected isVideoAttachment(attachment: PostAttachment): boolean {
    return String(attachment?.mime ?? '').startsWith('video/');
  }

  /** Open the in-page viewer on one attachment (images enlarge, videos play). */
  protected openViewer(attachments: PostAttachment[] | undefined, index: number): void {
    const items = (attachments ?? []).filter((a) => !!a?.url);
    if (items.length === 0) return;
    this.viewer.set({ items, index: Math.min(Math.max(index, 0), items.length - 1) });
    try {
      this.document.body.style.overflow = 'hidden';
    } catch { /* viewer still renders without the scroll lock */ }
  }

  protected closeViewer(): void {
    if (!this.viewer()) return;
    this.viewer.set(null);
    try {
      this.document.body.style.overflow = '';
    } catch { /* viewer simply stays closed */ }
  }

  protected stepViewer(dir: 1 | -1): void {
    const v = this.viewer();
    if (!v || v.items.length === 0) return;
    const next = (v.index + dir + v.items.length) % v.items.length;
    this.viewer.set({ items: v.items, index: next });
  }

  protected viewerGo(index: number): void {
    const v = this.viewer();
    if (!v || index < 0 || index >= v.items.length) return;
    this.viewer.set({ items: v.items, index });
  }

  protected onSwipeStart(event: TouchEvent): void {
    this.swipeStartX = event.touches[0]?.clientX ?? null;
  }

  protected onSwipeEnd(event: TouchEvent): void {
    if (this.swipeStartX === null) return;
    const endX = event.changedTouches[0]?.clientX ?? this.swipeStartX;
    const dx = endX - this.swipeStartX;
    this.swipeStartX = null;
    if (Math.abs(dx) < 48) return;
    this.stepViewer(dx < 0 ? 1 : -1);
  }

  protected viewerItem(): PostAttachment | null {
    const v = this.viewer();
    return v ? v.items[v.index] ?? null : null;
  }

  protected onViewerKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.closeViewer();
      event.preventDefault();
    } else if (event.key === 'ArrowRight') {
      this.stepViewer(1);
      event.preventDefault();
    } else if (event.key === 'ArrowLeft') {
      this.stepViewer(-1);
      event.preventDefault();
    }
  }

  protected onFiles(files: FileList | null): void {
    if (!files || files.length === 0) return;
    this.uploadError.set(null);
    const room = MAX_ATTACHMENTS - this.staged().length;
    if (room <= 0) {
      this.uploadError.set(`At most ${MAX_ATTACHMENTS} photos or videos per post.`);
      return;
    }
    [...files].slice(0, room).forEach((file) => {
      const name = String(file.name ?? '').toLowerCase();
      const isVideo = file.type.startsWith('video/') || (!file.type && /\.(mp4|webm|mov)$/.test(name));
      const isImage = file.type.startsWith('image/') || (!file.type && /\.(jpe?g|png|webp|gif)$/.test(name));
      if (!isImage && !isVideo) {
        this.uploadError.set(`${file.name} is not a supported image or video.`);
        return;
      }
      const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
      if (file.size > maxBytes) {
        this.uploadError.set(`${file.name} is too large (max ${Math.round(maxBytes / 1024 / 1024)}MB).`);
        return;
      }
      const key = `staged-${++this.stagedSeq}`;
      const previewUrl = URL.createObjectURL(file);
      this.staged.set([...this.staged(), { key, kind: isVideo ? 'video' : 'image', previewUrl, attachment: null, uploading: true, error: null }]);
      this.community
        .uploadMedia(file)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => {
            this.staged.set(this.staged().map((s) =>
              s.key === key ? { ...s, attachment: res.data ?? null, uploading: false } : s,
            ));
          },
          error: (err: ApiError) => {
            this.staged.set(this.staged().map((s) =>
              s.key === key ? { ...s, uploading: false, error: err.message } : s,
            ));
          },
        });
    });
    if (files.length > room) {
      this.uploadError.set(`At most ${MAX_ATTACHMENTS} photos or videos per post.`);
    }
  }

  protected removeStaged(key: string): void {
    const found = this.staged().find((s) => s.key === key);
    if (found) URL.revokeObjectURL(found.previewUrl);
    this.staged.set(this.staged().filter((s) => s.key !== key));
  }

  private clearStaged(): void {
    for (const s of this.staged()) URL.revokeObjectURL(s.previewUrl);
    this.staged.set([]);
    this.uploadError.set(null);
  }

  protected publish(): void {
    if (this.form.invalid) return;
    this.publishing.set(true);
    this.publishError.set(null);
    const v = this.form.getRawValue();
    const attachments = this.staged()
      .filter((s) => s.attachment !== null)
      .map((s) => s.attachment as PostAttachment);
    this.community
      .create({ kind: v.kind, title: v.title.trim(), body: v.body.trim(), link: v.link.trim(), scope: v.scope, attachments })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.publishing.set(false);
          this.showCompose.set(false);
          this.form.reset({ kind: 'standard', scope: 'global', title: '', body: '', link: '' });
          this.clearStaged();
          this.mentionSuggestions.set([]);
          this.mentionTarget.set(null);
          this.lastMentionQuery = '';
          // POST returns the raw row — normalize enrichment fields locally.
          if (res.data) {
            const fresh: FeedPost = {
              ...(res.data as object) as FeedPost,
              author: null, likeCount: 0, commentCount: 0, likedByMe: false, savedByMe: false, saveCount: 0,
            };
            this.posts.set([fresh, ...this.posts()]);
          }
        },
        error: (err: ApiError) => {
          this.publishing.set(false);
          this.publishError.set(err.message);
        },
      });
  }

  protected toggleLike(post: FeedPost): void {
    this.actingId.set(post.id);
    this.community
      .toggleLike(post.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.actingId.set(null);
          this.posts.set(this.posts().map((p) => p.id === post.id
            ? { ...p, likedByMe: !p.likedByMe, likeCount: (p.likeCount ?? 0) + (p.likedByMe ? -1 : 1) }
            : p));
        },
        error: (err: ApiError) => {
          this.actingId.set(null);
          this.error.set(err.message);
        },
      });
  }

  protected toggleCommentLike(comment: FeedComment): void {
    this.actingId.set(comment.id);
    this.community
      .toggleCommentLike(comment.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.actingId.set(null);
          this.comments.set(this.comments().map((c) => c.id === comment.id
            ? { ...c, likedByMe: !c.likedByMe, likeCount: (c.likeCount ?? 0) + (c.likedByMe ? -1 : 1) }
            : c));
        },
        error: (err: ApiError) => {
          this.actingId.set(null);
          this.commentError.set(err.message);
        },
      });
  }

  protected toggleSave(post: FeedPost): void {
    this.actingId.set(post.id);
    this.community
      .toggleSave(post.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.actingId.set(null);
          this.posts.set(this.posts().map((p) => p.id === post.id
            ? { ...p, savedByMe: !p.savedByMe, saveCount: (p.saveCount ?? 0) + (p.savedByMe ? -1 : 1) }
            : p));
        },
        error: (err: ApiError) => {
          this.actingId.set(null);
          this.error.set(err.message);
        },
      });
  }

  protected isMine(post: FeedPost): boolean {
    const me = this.auth.currentUser()?.id;
    return !!me && String(post.authorId) === String(me);
  }

  /** Pin-eligible: own announcement/event (or admin), never auto posts. */
  protected canPin(post: FeedPost): boolean {
    if (post.auto) return false;
    if (post.kind !== 'announcement' && post.kind !== 'event') return false;
    if (this.isMine(post)) return true;
    try {
      return this.auth.isAdmin();
    } catch {
      return false;
    }
  }

  /** Optimistic pin toggle — rolls back on 403/409 so cap errors read plainly. */
  protected togglePin(post: FeedPost): void {
    if (this.actingId() === post.id) return;
    const want = !post.pinned;
    const prev = this.posts();
    this.actingId.set(post.id);
    this.pinError.set(null);
    this.posts.set(prev.map((p) => (p.id === post.id ? { ...p, pinned: want } : p)));
    this.community
      .pin(post.id, want)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.actingId.set(null);
          const updated = res.data ?? null;
          if (updated) {
            this.posts.set(this.posts().map((p) => (p.id === post.id ? { ...p, ...updated } : p)));
          }
        },
        error: (err: ApiError) => {
          this.actingId.set(null);
          this.posts.set(prev);
          this.pinError.set(err.message);
        },
      });
  }

  protected startEdit(post: FeedPost): void {
    this.editingId.set(post.id);
    this.editTitle.set(post.title ?? '');
    this.editBody.set(post.body ?? '');
    this.editLink.set(post.link ?? '');
    this.editError.set(null);
    this.confirmingDeleteId.set(null);
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
    this.editError.set(null);
  }

  protected saveEdit(post: FeedPost): void {
    const body = this.editBody().trim();
    if (!body || this.savingEdit()) return;
    this.savingEdit.set(true);
    this.editError.set(null);
    this.community
      .update(post.id, { title: this.editTitle().trim(), body, link: this.editLink().trim() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.savingEdit.set(false);
          this.editingId.set(null);
          const updated = res.data as FeedPost | undefined;
          this.posts.set(this.posts().map((p) => p.id === post.id
            ? { ...p, title: updated?.title ?? this.editTitle().trim(), body, link: updated?.link ?? this.editLink().trim(), mentions: updated?.mentions ?? p.mentions }
            : p));
        },
        error: (err: ApiError) => {
          this.savingEdit.set(false);
          this.editError.set(err.message);
        },
      });
  }

  protected confirmDelete(post: FeedPost): void {
    if (this.deleting()) return;
    this.deleting.set(true);
    this.community
      .remove(post.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deleting.set(false);
          this.confirmingDeleteId.set(null);
          if (this.openThread() === post.id) this.openThread.set(null);
          this.posts.set(this.posts().filter((p) => p.id !== post.id));
        },
        error: (err: ApiError) => {
          this.deleting.set(false);
          this.confirmingDeleteId.set(null);
          this.error.set(err.message);
        },
      });
  }

  protected report(post: FeedPost): void {    this.actingId.set(post.id);
    this.community
      .report(post.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.actingId.set(null);
          this.posts.set(this.posts().filter((p) => p.id !== post.id));
        },
        error: (err: ApiError) => {
          this.actingId.set(null);
          this.error.set(err.message);
        },
      });
  }

  protected toggleComments(post: FeedPost): void {
    if (this.openThread() === post.id) {
      this.openThread.set(null);
      return;
    }
    this.openThread.set(post.id);
    this.replyTo.set(null);
    this.draft.set('');
    this.commentError.set(null);
    this.mentionSuggestions.set([]);
    this.mentionTarget.set(null);
    this.lastMentionQuery = '';
    this.loadingComments.set(true);
    this.community
      .comments(post.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.loadingComments.set(false);
          this.comments.set(res.data ?? []);
          this.refreshPresence();
        },
        error: (err: ApiError) => {
          this.loadingComments.set(false);
          this.commentError.set(err.message);
        },
      });
  }

  protected sendComment(post: FeedPost): void {
    const body = this.draft().trim();
    if (!body) return;
    const reply = this.replyTo();
    this.sendingComment.set(true);
    this.commentError.set(null);
    this.community
      .addComment(post.id, body, reply && reply.postId === post.id ? reply.parentId : undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.sendingComment.set(false);
          this.draft.set('');
          this.replyTo.set(null);
          this.mentionSuggestions.set([]);
          this.mentionTarget.set(null);
          this.lastMentionQuery = '';
          if (res.data) this.comments.set([...this.comments(), res.data as FeedComment]);
          this.posts.set(this.posts().map((p) => p.id === post.id ? { ...p, commentCount: p.commentCount + 1 } : p));
        },
        error: (err: ApiError) => {
          this.sendingComment.set(false);
          this.commentError.set(err.message);
        },
      });
  }
}
