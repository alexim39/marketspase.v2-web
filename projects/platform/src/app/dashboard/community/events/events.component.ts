import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { environment } from '../../../../environments/environment';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { forkJoin } from 'rxjs';
import { EventService } from '../../../core/events/event.service';
import { PresenceService, PresenceStatus } from '../../../core/presence/presence.service';
import { AuthService } from '../../../core/auth/auth.service';
import { AvatarComponent } from '../../../_common/avatar.component';
import { AudienceScope, CommunityEvent, EventAttendee, EventComment, RsvpStatus } from '../../../core/events/event.models';
import { ApiError, validationDetail } from '../../../core/http/api-error';

const toInputDateTime = (d: Date): string => {
  const pad = (v: number): string => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Tomorrow at 09:00 local — sensible default start. */
const defaultStart = (): Date => {
  const d = new Date(Date.now() + 86400000);
  d.setHours(9, 0, 0, 0);
  return d;
};

/** Merge a picker date with a picker time into one local Date. */
const mergeDateTime = (date: Date, time: Date): Date => {
  const out = new Date(date);
  out.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return out;
};

/** End is valid only as a complete pair (or fully empty). */
const endsPairValidator = (group: AbstractControl): ValidationErrors | null => {
  const date = group.get('endsDate')?.value;
  const time = group.get('endsTime')?.value;
  return (date == null) === (time == null) ? null : { endsIncomplete: true };
};

/** Backend message plus the exact rejected field, so a 400 names its cause. */
const withDetail = (err: ApiError): string => {
  const detail = validationDetail(err);
  return detail ? `${err.message} — ${detail}` : err.message;
};

/**
 * @title Events — group gatherings with RSVP headcounts.
 *
 * Upcoming (visible to you) plus your own, with per-status counts and
 * one-tap RSVP. Visibility is enforced server-side like the feed.
 * OnPush + signals, fully typed.
 */
@Component({
  selector: 'async-community-events',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AvatarComponent, DatePipe, MatButtonModule, MatButtonToggleModule, MatDatepickerModule, MatNativeDateModule,
    MatTimepickerModule, MatIconModule, MatInputModule, MatProgressBarModule, MatSelectModule, MatSnackBarModule,
    PageSkeletonComponent, ReactiveFormsModule, RouterModule,
  ],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a routerLink="../">Community</a> &gt;
        <span>Events</span>
      </div>
    </section>

    <section class="events-page">
      <header class="page-head">
        <div>
          <p class="eyebrow">Community · Gatherings</p>
          <h1>Events</h1>
          <p class="subtitle">Meetups, trainings and team gatherings worth showing up for. RSVP, invite your network and keep the conversation going.</p>
        </div>
        <div class="head-actions">
          <mat-button-toggle-group [value]="tab()" (change)="tab.set($event.value)" aria-label="Event list">
            <mat-button-toggle value="upcoming">Upcoming <span class="toggle-count">{{ upcoming().length }}</span></mat-button-toggle>
            <mat-button-toggle value="mine">My events <span class="toggle-count">{{ mine().length }}</span></mat-button-toggle>
          </mat-button-toggle-group>
          <button mat-flat-button color="primary" type="button" (click)="toggleCompose()">
            <mat-icon>{{ showCompose() ? 'close' : 'add' }}</mat-icon>
            {{ showCompose() ? 'Close composer' : 'New event' }}
          </button>
        </div>
      </header>

      @if (loading()) {
        <async-page-skeleton layout="cards" [rows]="4" label="community events" [showHeader]="false" />
      }

      @if (error(); as err) {
        <div class="alert" role="alert">
          <mat-icon>error_outline</mat-icon>
          <p>{{ err }}</p>
          <button mat-stroked-button type="button" (click)="reload()">Retry</button>
        </div>
      }

      @if (!loading() && !error() && (upcoming().length > 0 || mine().length > 0)) {
        <section class="summary-strip" role="status" aria-label="Events summary">
          <div class="summary-item">
            <span class="summary-icon"><mat-icon>event_upcoming</mat-icon></span>
            <div><strong>{{ upcoming().length }}</strong><span>Upcoming events</span></div>
          </div>
          <div class="summary-item">
            <span class="summary-icon summary-icon--ok"><mat-icon>groups</mat-icon></span>
            <div><strong>{{ totalGoing() }}</strong><span>Going across events</span></div>
          </div>
          <div class="summary-item">
            <span class="summary-icon summary-icon--info"><mat-icon>event_note</mat-icon></span>
            <div><strong>{{ mine().length }}</strong><span>Events I created</span></div>
          </div>
          <div class="summary-item">
            <span class="summary-icon summary-icon--warn"><mat-icon>star</mat-icon></span>
            <div><strong>{{ featuredCount() }}</strong><span>Featured gatherings</span></div>
          </div>
        </section>
      }

      @if (showCompose()) {
        <form class="compose-card" [formGroup]="form" (ngSubmit)="publish()">
          <div class="compose-head">
            <span class="compose-icon"><mat-icon>{{ editingId() ? 'edit_calendar' : 'add_task' }}</mat-icon></span>
            <div>
              <h2>{{ editingId() ? 'Edit event' : 'Create an event' }}</h2>
              <p>Set the schedule and audience. Members RSVP from this page and get a reminder.</p>
            </div>
            <button mat-icon-button type="button" (click)="toggleCompose()" aria-label="Close event composer">
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <section class="form-section">
            <h3>Event details</h3>
            <mat-form-field appearance="outline">
              <mat-label>Title</mat-label>
              <input matInput formControlName="title" maxlength="120" placeholder="e.g. Saturday cell meeting" />
              @if (form.get('title')?.hasError('required') || form.get('title')?.hasError('minlength')) {
                <mat-error>Give the event a clear title.</mat-error>
              }
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Details</mat-label>
              <textarea matInput rows="3" formControlName="body" maxlength="2000" placeholder="What will happen, who should come and what should they bring?"></textarea>
              @if (form.get('body')?.hasError('required')) {
                <mat-error>Add a short description.</mat-error>
              }
            </mat-form-field>
          </section>

          <section class="form-section">
            <h3>Schedule</h3>
            <div class="two-col">
              <mat-form-field appearance="outline">
                <mat-label>Starts date</mat-label>
                <input matInput [matDatepicker]="startsDatePicker" formControlName="startsDate" />
                <mat-datepicker-toggle matSuffix [for]="startsDatePicker" />
                <mat-datepicker #startsDatePicker />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Starts time</mat-label>
                <input matInput [matTimepicker]="startsTimePicker" formControlName="startsTime" />
                <mat-timepicker-toggle matSuffix [for]="startsTimePicker" />
                <mat-timepicker #startsTimePicker interval="30m" />
              </mat-form-field>
            </div>
            <div class="two-col">
              <mat-form-field appearance="outline">
                <mat-label>Ends date (optional)</mat-label>
                <input
                  matInput
                  [matDatepicker]="endsDatePicker"
                  formControlName="endsDate"
                  [min]="form.controls.startsDate.value"
                />
                <mat-datepicker-toggle matSuffix [for]="endsDatePicker" />
                <mat-datepicker #endsDatePicker />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Ends time (optional)</mat-label>
                <input matInput [matTimepicker]="endsTimePicker" formControlName="endsTime" />
                <mat-timepicker-toggle matSuffix [for]="endsTimePicker" />
                <mat-timepicker #endsTimePicker interval="30m" />
                @if (form.hasError('endsIncomplete')) {
                  <mat-error>Pick both an end date and time.</mat-error>
                }
              </mat-form-field>
            </div>
          </section>

          <section class="form-section">
            <h3>Venue &amp; audience</h3>
            <div class="two-col">
              <mat-form-field appearance="outline">
                <mat-label>Venue (optional)</mat-label>
                <input matInput formControlName="location" maxlength="200" placeholder="e.g. Ikeja hall or Zoom" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Audience</mat-label>
                <mat-select formControlName="scope">
                  <mat-option value="global">Everyone</mat-option>
                  <mat-option value="team">My team</mat-option>
                  <mat-option value="leadership">Leadership</mat-option>
                  @if (teamId()) {
                    <mat-option value="members">Team members only{{ teamName() ? ' — ' + teamName() : '' }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            </div>
          </section>

          <div class="form-actions">
            <p class="muted">Events are visible to the audience you choose and appear in Upcoming for them.</p>
            <div class="action-buttons">
              <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || publishing()">
                {{ publishing() ? 'Saving…' : (editingId() ? 'Save changes' : 'Create event') }}
              </button>
              @if (editingId()) {
                <button mat-stroked-button type="button" (click)="cancelEdit()" [disabled]="publishing()">Cancel edit</button>
              }
            </div>
            @if (publishError(); as err) {
              <span class="error" role="alert">{{ err }}</span>
            }
          </div>
        </form>
      }

      @if (featureError(); as ferr) {
        <div class="alert alert--inline" role="alert">
          <mat-icon>error_outline</mat-icon>
          <p>{{ ferr }}</p>
        </div>
      }

      @if (visible().length > 0) {
        <ol class="event-list">
          @for (event of visible(); track event.id) {
            <li class="event-card" [class.event-card--featured]="event.featured">
              <div class="event-date" aria-hidden="true">
                <span class="date-month">{{ event.startsAt | date:'MMM' }}</span>
                <span class="date-day">{{ event.startsAt | date:'d' }}</span>
                <span class="date-weekday">{{ event.startsAt | date:'EEE' }}</span>
              </div>

              <div class="event-main">
                <div class="event-top">
                  <div class="event-title">
                    <div class="event-chips">
                      @if (event.featured) {
                        <span class="chip chip--featured"><mat-icon>star</mat-icon>Featured</span>
                      }
                      @if (isPast(event)) {
                        <span class="chip chip--past"><mat-icon>history</mat-icon>Past</span>
                      } @else {
                        <span class="chip chip--upcoming"><mat-icon>event_available</mat-icon>Upcoming</span>
                      }
                      <span class="chip chip--scope">{{ scopeLabel(event.scope) }}</span>
                    </div>
                    <h2>{{ event.title }}</h2>
                    <div class="byline">
                      <async-avatar [photo]="event.author?.profileImage" [name]="event.author?.name ?? 'Teammate'" size="xs" [presence]="presenceOf(event.authorId)" />
                      <span>Hosted by <strong>{{ event.author?.name ?? 'Teammate' }}</strong></span>
                    </div>
                  </div>
                </div>

                <div class="event-meta">
                  <span><mat-icon>schedule</mat-icon>{{ event.startsAt | date:'EEE, MMM d · h:mm a' }}@if (event.endsAt) {<span class="meta-end"> – {{ event.endsAt | date:'h:mm a' }}</span>}</span>
                  @if (event.location) {
                    <span><mat-icon>place</mat-icon>{{ event.location }}</span>
                  }
                </div>

                <p class="event-body">{{ event.body }}</p>

                <div class="rsvp-row" role="group" aria-label="RSVP">
                  <span class="rsvp-label">Will you attend?</span>
                  @for (opt of rsvpOptions; track opt.value) {
                    <button
                      type="button"
                      class="rsvp-btn"
                      [class.rsvp-btn--active]="event.myRsvp === opt.value"
                      (click)="rsvp(event, opt.value)"
                      [disabled]="actingId() === event.id"
                    >
                      <mat-icon>{{ opt.icon }}</mat-icon>
                      {{ opt.label }}
                      <span class="rsvp-count">{{ event.rsvps?.[opt.value] ?? 0 }}</span>
                    </button>
                  }
                </div>

                <div class="event-actions">
                  <button mat-button type="button" (click)="toggleShare(event)" [attr.aria-expanded]="shareEventId() === event.id" title="Invite others to this event">
                    <mat-icon>share</mat-icon>Invite
                  </button>
                  <button mat-button type="button" (click)="toggleThread(event)" [attr.aria-expanded]="openThreadId() === event.id">
                    <mat-icon>comment</mat-icon>
                    Discussion{{ event.commentCount ? ' (' + event.commentCount + ')' : '' }}
                  </button>
                  @if (event.teamId) {
                    <a mat-button routerLink="/dashboard/messages" [queryParams]="{ teamGroup: event.teamId }" title="Discuss in the team group chat">
                      <mat-icon>forum</mat-icon>Team chat
                    </a>
                  }
                  @if (canManageAttendees(event) && isPast(event)) {
                    <button mat-button type="button" (click)="toggleAttendees(event)" [attr.aria-expanded]="attendeesOpenId() === event.id">
                      <mat-icon>how_to_reg</mat-icon>
                      Attendance{{ recap(event.id).going > 0 ? ' (' + recap(event.id).attended + '/' + recap(event.id).going + ' here)' : '' }}
                    </button>
                  }
                  <span class="spacer"></span>
                  @if (canFeature(event)) {
                    <button mat-button type="button" (click)="toggleFeature(event)" [disabled]="actingId() === event.id" [title]="event.featured ? 'Remove highlight' : 'Highlight at top'">
                      <mat-icon>{{ event.featured ? 'star' : 'star_border' }}</mat-icon>
                      {{ event.featured ? 'Unfeature' : 'Feature' }}
                    </button>
                  }
                  @if (isMine(event)) {
                    <button mat-button type="button" (click)="startEdit(event)" [disabled]="actingId() === event.id" title="Edit event">
                      <mat-icon>edit</mat-icon>Edit
                    </button>
                    @if (confirmingCancelId() === event.id) {
                      <span class="delete-confirm" role="alertdialog" aria-label="Confirm event deletion">
                        <strong>Delete this event?</strong> RSVPs go with it — this cannot be undone.
                        <span class="delete-actions">
                          <button mat-button type="button" (click)="confirmingCancelId.set(null)" [disabled]="actingId() === event.id">Keep</button>
                          <button mat-flat-button color="warn" type="button" (click)="confirmCancel(event)" [disabled]="actingId() === event.id">
                            {{ actingId() === event.id ? 'Deleting…' : 'Yes, delete' }}
                          </button>
                        </span>
                      </span>
                    } @else {
                      <button mat-button color="warn" type="button" (click)="confirmingCancelId.set(event.id)" [disabled]="actingId() === event.id">Cancel event</button>
                    }
                  }
                </div>

                @if (shareEventId() === event.id) {
                  <div class="share-panel" role="region" aria-label="Invite to this event">
                    <div class="panel-head">
                      <span class="panel-icon"><mat-icon>share</mat-icon></span>
                      <div><h3>Invite your network</h3><p>Copy the invite or share it where your people already are.</p></div>
                    </div>
                    <p class="invite-text">{{ inviteText(event) }}</p>
                    <div class="share-actions">
                      <button mat-stroked-button type="button" (click)="copyInvite(event)"><mat-icon>content_copy</mat-icon>Copy invite</button>
                      <button mat-stroked-button type="button" (click)="copyEventLink()"><mat-icon>link</mat-icon>Copy my link</button>
                      <button mat-stroked-button type="button" (click)="whatsAppInvite(event)"><mat-icon>chat</mat-icon>WhatsApp</button>
                      <button mat-stroked-button type="button" (click)="facebookInvite()"><mat-icon>public</mat-icon>Facebook</button>
                    </div>
                  </div>
                }

                @if (attendeesOpenId() === event.id) {
                  <div class="attend-panel" role="region" aria-label="Attendance">
                    <div class="panel-head">
                      <span class="panel-icon"><mat-icon>how_to_reg</mat-icon></span>
                      <div><h3>Attendance</h3><p>Mark who showed up to keep the recap accurate.</p></div>
                    </div>
                    @if (attendeesLoading()) {
                      <mat-progress-bar mode="indeterminate" aria-label="Loading" />
                    } @else if (attendeeList(event.id).length > 0) {
                      <ul class="attend-list">
                        @for (a of attendeeList(event.id); track a.partnerId) {
                          <li>
                            <span class="who"><strong>{{ a.name }}</strong><span class="muted">&#64;{{ a.username ?? '—' }} · {{ a.status }}</span></span>
                            <span class="spacer"></span>
                            <button mat-button type="button" [disabled]="markingId() !== null" (click)="setAttendance(event, a, true)" [class.active]="a.attended === true" [attr.aria-pressed]="a.attended === true">Here</button>
                            <button mat-button type="button" [disabled]="markingId() !== null" (click)="setAttendance(event, a, false)" [class.active-warn]="a.attended === false" [attr.aria-pressed]="a.attended === false">Absent</button>
                          </li>
                        }
                      </ul>
                      <div class="recap-row">
                        <span class="muted">{{ recap(event.id).attended }} attended · {{ recap(event.id).noShow }} no-show</span>
                      </div>
                    } @else {
                      <p class="muted">No RSVPs yet.</p>
                    }
                  </div>
                }

                @if (openThreadId() === event.id) {
                  <div class="thread">
                    <div class="panel-head">
                      <span class="panel-icon"><mat-icon>forum</mat-icon></span>
                      <div><h3>Discussion</h3><p>Ask the host or coordinate with other attendees.</p></div>
                    </div>
                    @if (threadLoading()) {
                      <mat-progress-bar mode="indeterminate" aria-label="Loading" />
                    }
                    @if (threadError(); as err) {
                      <p class="error" role="alert">{{ err }}</p>
                    }
                    @for (c of topComments(event.id); track c.id) {
                      <div class="comment">
                        <div class="comment-head">
                          <async-avatar [photo]="c.author?.profileImage" [name]="c.author?.name ?? 'Teammate'" size="xs" [presence]="presenceOf(c.authorId)" />
                          <strong>{{ c.author?.name ?? 'Teammate' }}</strong>
                          <span class="muted">{{ c.createdAt | date:'short' }}</span>
                        </div>
                        <p>{{ c.body }}</p>
                        <div class="comment-foot">
                          <button mat-button type="button" (click)="replyTo.set({ id: c.id, name: c.author?.name ?? 'teammate' })">Reply</button>
                          @if (canDelete(event, c)) {
                            <button mat-button color="warn" type="button" (click)="deleteThreadComment(event, c)">Delete</button>
                          }
                        </div>
                        @for (r of replies(event.id, c.id); track r.id) {
                          <div class="comment comment--reply">
                            <div class="comment-head">
                              <async-avatar [photo]="r.author?.profileImage" [name]="r.author?.name ?? 'Teammate'" size="xs" [presence]="presenceOf(r.authorId)" />
                              <strong>{{ r.author?.name ?? 'Teammate' }}</strong>
                              <span class="muted">{{ r.createdAt | date:'short' }}</span>
                            </div>
                            <p>{{ r.body }}</p>
                            <div class="comment-foot">
                              @if (canDelete(event, r)) {
                                <button mat-button color="warn" type="button" (click)="deleteThreadComment(event, r)">Delete</button>
                              }
                            </div>
                          </div>
                        }
                      </div>
                    } @empty {
                      @if (!threadLoading()) {
                        <p class="muted">No questions yet — ask the host anything below.</p>
                      }
                    }
                    <div class="comment-box">
                      <mat-form-field appearance="outline" subscriptSizing="dynamic">
                        <mat-label>@if (replyTo(); as rt) { Reply to {{ rt.name }}… } @else { Ask a question… }</mat-label>
                        <input matInput [value]="threadDraft()" (input)="threadDraft.set($any($event.target).value)" maxlength="1000" (keydown.enter)="sendThreadComment(event)" />
                      </mat-form-field>
                      @if (replyTo()) {
                        <button mat-button type="button" (click)="replyTo.set(null)">Cancel reply</button>
                      }
                      <button mat-flat-button color="primary" type="button" (click)="sendThreadComment(event)" [disabled]="!threadDraft().trim() || threadSending()">
                        <mat-icon>send</mat-icon>
                        {{ threadSending() ? 'Posting…' : 'Post' }}
                      </button>
                    </div>
                  </div>
                }
              </div>
            </li>
          }
        </ol>
      } @else if (!loading() && !error()) {
        <div class="empty-card">
          <span class="empty-icon"><mat-icon>{{ tab() === 'upcoming' ? 'event_available' : 'event_note' }}</mat-icon></span>
          <h2>{{ tab() === 'upcoming' ? 'Nothing scheduled yet' : 'No events created yet' }}</h2>
          <p>{{ tab() === 'upcoming' ? 'Check back soon, or create a gathering for your team and network.' : 'Create your first event and invite your team — it only takes a minute.' }}</p>
          <button mat-flat-button color="primary" type="button" (click)="toggleCompose()">Create an event</button>
        </div>
      }
    </section>
`,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 16px; }
    .breadcrumb a { text-decoration: none; }
    .events-page { display: flex; flex-direction: column; gap: 24px; max-width: 1160px; margin: 0 auto; padding-bottom: 32px; }
    .page-head { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 24px; }
    .page-head h1 { margin: 4px 0 8px; font-size: clamp(2rem, 3vw, 2.5rem); letter-spacing: -0.03em; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
    .subtitle { margin: 0; max-width: 62em; color: var(--ms-text-muted); line-height: 1.6; }
    .head-actions { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    .head-actions button mat-icon { margin-right: 6px; }
    .toggle-count { display: inline-grid; place-items: center; min-width: 20px; height: 20px; padding: 0 5px; margin-left: 6px; border-radius: 999px; background: var(--ms-canvas); color: var(--ms-text-muted); font-size: 0.6875rem; font-weight: 700; font-variant-numeric: tabular-nums; }
    .mat-button-toggle-checked .toggle-count { background: var(--ms-surface); color: var(--ms-primary-strong); }

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

    .compose-card { display: flex; flex-direction: column; gap: 24px; padding: 24px; background: var(--ms-surface); border: 1px solid var(--ms-primary); border-radius: var(--ms-radius-lg); box-shadow: var(--ms-shadow-md); }
    .compose-head { display: flex; align-items: center; gap: 16px; }
    .compose-icon { flex: none; width: 48px; height: 48px; border-radius: var(--ms-radius-lg); display: grid; place-items: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .compose-icon mat-icon { font-size: 24px; width: 24px; height: 24px; }
    .compose-head > div { flex: 1; min-width: 0; }
    .compose-head h2 { margin: 0 0 2px; font-size: 1.25rem; }
    .compose-head p { margin: 0; color: var(--ms-text-muted); font-size: 0.875rem; line-height: 1.5; }
    .form-section { display: flex; flex-direction: column; gap: 8px; }
    .form-section h3 { margin: 0 0 4px; font-size: 0.9375rem; }
    .two-col { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 16px; }
    .form-actions { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; border-top: 1px solid var(--ms-line); padding-top: 16px; }
    .form-actions .muted { flex: 1; min-width: 220px; margin: 0; color: var(--ms-text-muted); font-size: 0.75rem; line-height: 1.5; }
    .action-buttons { display: flex; gap: 8px; flex-wrap: wrap; }
    .action-buttons button { min-height: 44px; }

    .event-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 16px; }
    .event-card { display: grid; grid-template-columns: 88px minmax(0, 1fr); gap: 24px; padding: 24px; background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); box-shadow: var(--ms-shadow-sm); }
    .event-card--featured { border-left: 3px solid var(--ms-primary); }
    .event-date { display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 2px; align-self: start; padding: 12px 8px; border-radius: var(--ms-radius-lg); background: var(--ms-primary-soft); color: var(--ms-primary-strong); border: 1px solid var(--ms-line); }
    .date-month { font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
    .date-day { font-family: var(--ms-font-display); font-size: 2rem; line-height: 1; font-weight: 700; font-variant-numeric: tabular-nums; }
    .date-weekday { font-size: 0.6875rem; font-weight: 600; color: var(--ms-text-muted); }
    .event-main { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
    .event-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
    .event-title { min-width: 0; }
    .event-chips { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
    .chip { display: inline-flex; align-items: center; gap: 4px; border-radius: 999px; padding: 4px 10px; font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.02em; white-space: nowrap; }
    .chip mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .chip--featured { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .chip--past { background: var(--ms-canvas); color: var(--ms-text-muted); }
    .chip--upcoming { background: var(--ms-success-soft); color: var(--ms-success); }
    .chip--scope { background: var(--ms-info-soft); color: var(--ms-primary-strong); }
    .event-title h2 { margin: 0 0 4px; font-size: 1.375rem; line-height: 1.3; }
    .byline { display: inline-flex; align-items: center; gap: 8px; color: var(--ms-text-muted); font-size: 0.8125rem; }
    .byline strong { color: var(--ms-text); font-weight: 600; }
    .event-meta { display: flex; align-items: center; gap: 8px 20px; flex-wrap: wrap; color: var(--ms-text-muted); font-size: 0.8125rem; }
    .event-meta span { display: inline-flex; align-items: center; gap: 6px; }
    .event-meta mat-icon { font-size: 16px; width: 16px; height: 16px; color: var(--ms-primary-strong); }
    .meta-end { color: var(--ms-text-muted); }
    .event-body { margin: 0; color: var(--ms-text-muted); line-height: 1.65; white-space: pre-wrap; }

    .rsvp-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 12px 16px; background: var(--ms-canvas); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); }
    .rsvp-label { color: var(--ms-text-muted); font-size: 0.75rem; font-weight: 600; margin-right: 4px; }
    .rsvp-btn { display: inline-flex; align-items: center; gap: 6px; min-height: 40px; padding: 6px 14px; border: 1px solid var(--ms-line); border-radius: 999px; background: var(--ms-surface); color: var(--ms-text); font: inherit; font-size: 0.8125rem; font-weight: 500; cursor: pointer; transition: border-color 160ms ease, background 160ms ease; }
    .rsvp-btn:hover:not(:disabled) { border-color: var(--ms-primary); }
    .rsvp-btn mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .rsvp-btn--active { border-color: var(--ms-primary); background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-weight: 600; }
    .rsvp-count { display: inline-grid; place-items: center; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 999px; background: var(--ms-canvas); color: var(--ms-text-muted); font-size: 0.6875rem; font-weight: 700; }
    .rsvp-btn--active .rsvp-count { background: var(--ms-surface); color: var(--ms-primary-strong); }

    .event-actions { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; border-top: 1px solid var(--ms-line); padding-top: 8px; }
    .event-actions .spacer { flex: 1; }
    .event-actions button, .event-actions a { min-height: 40px; }
    .event-actions mat-icon { font-size: 18px; width: 18px; height: 18px; margin-right: 4px; }
    .delete-confirm { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; background: var(--ms-error-soft); border: 1px solid var(--ms-error); border-radius: var(--ms-radius-md); padding: 8px 12px; font-size: 0.8125rem; }
    .delete-actions { display: inline-flex; gap: 8px; }
    .delete-actions button { min-height: 36px; }

    .share-panel, .attend-panel, .thread { display: flex; flex-direction: column; gap: 12px; border-top: 1px solid var(--ms-line); padding-top: 16px; }
    .panel-head { display: flex; align-items: flex-start; gap: 12px; }
    .panel-icon { flex: none; width: 36px; height: 36px; border-radius: var(--ms-radius-md); display: grid; place-items: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .panel-icon mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .panel-head h3 { margin: 0 0 2px; font-size: 0.9375rem; }
    .panel-head p { margin: 0; color: var(--ms-text-muted); font-size: 0.75rem; line-height: 1.5; }
    .invite-text { margin: 0; background: var(--ms-canvas); border: 1px dashed var(--ms-line); border-radius: var(--ms-radius-md); padding: 12px 16px; overflow-wrap: anywhere; font-size: 0.8125rem; line-height: 1.6; }
    .share-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .share-actions button { min-height: 40px; }
    .share-actions mat-icon { margin-right: 4px; }

    .attend-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
    .attend-list li { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-top: 1px solid var(--ms-line); flex-wrap: wrap; }
    .attend-list li:first-child { border-top: 0; }
    .attend-list .who { display: flex; flex-direction: column; min-width: 0; }
    .attend-list .who strong { font-size: 0.8125rem; font-weight: 600; }
    .attend-list .who .muted { font-size: 0.75rem; }
    .attend-list .spacer { flex: 1; }
    .attend-list button { min-height: 36px; }
    .attend-list button.active { background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .attend-list button.active-warn { background: var(--ms-error-soft); color: var(--ms-error); }
    .recap-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

    .comment { display: flex; flex-direction: column; gap: 6px; background: var(--ms-canvas); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-md); padding: 12px 16px; }
    .comment p { margin: 0; white-space: pre-wrap; line-height: 1.55; font-size: 0.875rem; }
    .comment--reply { margin-left: 24px; border-left: 2px solid var(--ms-line); }
    .comment-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .comment-head strong { font-size: 0.8125rem; font-weight: 600; }
    .comment-head .muted { font-size: 0.75rem; }
    .comment-foot { display: flex; align-items: center; gap: 8px; }
    .comment-foot button { min-height: 36px; }
    .comment-box { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .comment-box mat-form-field { flex: 1; min-width: 220px; }
    .comment-box button { min-height: 44px; }
    .comment-box button mat-icon { margin-right: 4px; }

    .alert { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: var(--ms-radius-lg); background: var(--ms-error-soft); color: var(--ms-error); }
    .alert p { flex: 1; margin: 0; }
    .alert--inline { font-size: 0.875rem; }
    .muted { color: var(--ms-text-muted); font-size: 0.875rem; }
    .error { color: var(--ms-error); display: flex; align-items: center; gap: 8px; }
    .empty-card { display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center; padding: 48px 24px; background: var(--ms-surface); border: 1px dashed var(--ms-line); border-radius: var(--ms-radius-lg); color: var(--ms-text-muted); }
    .empty-card h2 { margin: 0; color: var(--ms-text); font-size: 1.25rem; }
    .empty-card p { margin: 0; max-width: 44em; line-height: 1.6; }
    .empty-icon { width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .empty-icon mat-icon { font-size: 28px; width: 28px; height: 28px; }

    @media (max-width: 900px) {
      .summary-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .event-card { grid-template-columns: 72px minmax(0, 1fr); gap: 16px; padding: 16px; }
      .date-day { font-size: 1.625rem; }
    }
    @media (max-width: 640px) {
      .events-page { gap: 16px; }
      .compose-card { padding: 16px; }
      .two-col { grid-template-columns: minmax(0, 1fr); }
      .event-card { grid-template-columns: minmax(0, 1fr); }
      .event-date { flex-direction: row; align-items: baseline; gap: 6px; align-self: start; padding: 8px 12px; width: fit-content; }
      .date-day { font-size: 1.25rem; }
      .rsvp-label { width: 100%; }
      .rsvp-btn { flex: 1; justify-content: center; }
      .event-actions .spacer { display: none; }
      .comment--reply { margin-left: 16px; }
      .delete-confirm { display: flex; width: 100%; }
    }
`],
})
export class CommunityEventsComponent implements OnInit {
  private readonly events = inject(EventService);
  private readonly presence = inject(PresenceService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snack = inject(MatSnackBar);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly publishing = signal(false);
  protected readonly actingId = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly publishError = signal<string | null>(null);
  protected readonly showCompose = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly confirmingCancelId = signal<string | null>(null);
  protected readonly teamId = signal<string | null>(null);
  protected readonly teamName = signal('');
  protected readonly tab = signal<'upcoming' | 'mine'>('upcoming');
  protected readonly upcoming = signal<CommunityEvent[]>([]);
  protected readonly mine = signal<CommunityEvent[]>([]);
  protected readonly featureError = signal<string | null>(null);
  /** authorId → lastSeenAt (null = offline/stranger); drives avatar dots. */
  protected readonly presenceMap = signal<Record<string, string | null>>({});
  /** Discussion state per event (opened thread, rows, draft, reply target). */
  protected readonly openThreadId = signal<string | null>(null);
  /** Share sheet + organizer attendance desk, keyed by event id. */
  protected readonly shareEventId = signal<string | null>(null);
  protected readonly attendeesOpenId = signal<string | null>(null);
  protected readonly attendees = signal<Record<string, EventAttendee[]>>({});
  protected readonly attendeesLoading = signal(false);
  protected readonly markingId = signal<string | null>(null);
  protected readonly threadComments = signal<Record<string, EventComment[]>>({});
  protected readonly threadLoading = signal(false);
  protected readonly threadError = signal<string | null>(null);
  protected readonly threadSending = signal(false);
  protected readonly threadDraft = signal('');
  protected readonly replyTo = signal<{ id: string; name: string } | null>(null);

  /** Presence dot for an event author id (null hides it). */
  protected presenceOf(authorId: string | null | undefined): PresenceStatus {
    if (!authorId) return null;
    return this.presence.statusOf(this.presenceMap()[String(authorId)] ?? null);
  }

  /** Refresh presence for visible event authors (single bulk call). */
  private refreshPresence(extraIds: string[] = []): void {
    const ids = [...[...this.upcoming(), ...this.mine()].map((e) => e.authorId), ...extraIds];
    if (ids.length === 0) return;
    this.presence
      .lookup(ids)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((map) => this.presenceMap.set({ ...this.presenceMap(), ...map }));
  }

  protected myId(): string {
    return String(this.auth.currentUser()?.id ?? '');
  }

  /** Top-level comments for an open thread (replies nest under their parent). */
  protected topComments(eventId: string): EventComment[] {
    return (this.threadComments()[eventId] ?? []).filter((c) => !c.parentId);
  }

  /** Replies to one comment, oldest first. */
  protected replies(eventId: string, parentId: string): EventComment[] {
    return (this.threadComments()[eventId] ?? []).filter((c) => String(c.parentId) === String(parentId));
  }

  protected toggleThread(event: CommunityEvent): void {
    const open = this.openThreadId() === event.id ? null : event.id;
    this.openThreadId.set(open);
    this.threadError.set(null);
    this.replyTo.set(null);
    if (open) this.loadThread(event.id);
  }

  private loadThread(eventId: string): void {
    this.threadLoading.set(true);
    this.threadError.set(null);
    this.events
      .comments(eventId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const rows = res.data ?? [];
          this.threadComments.set({ ...this.threadComments(), [eventId]: rows });
          this.threadLoading.set(false);
          this.refreshPresence(rows.map((c) => c.authorId));
        },
        error: (err: ApiError) => {
          this.threadLoading.set(false);
          this.threadError.set(err.message);
        },
      });
  }

  protected sendThreadComment(event: CommunityEvent): void {
    const body = this.threadDraft().trim();
    if (!body || this.threadSending()) return;
    const reply = this.replyTo();
    this.threadSending.set(true);
    this.threadError.set(null);
    this.events
      .addComment(event.id, body, reply?.id ?? null)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.threadSending.set(false);
          this.threadDraft.set('');
          this.replyTo.set(null);
          if (res.data) {
            const rows = [...(this.threadComments()[event.id] ?? []), res.data];
            this.threadComments.set({ ...this.threadComments(), [event.id]: rows });
            this.refreshPresence([res.data.authorId]);
          }
          this.bumpCount(event.id, 1);
        },
        error: (err: ApiError) => {
          this.threadSending.set(false);
          this.threadError.set(err.message);
        },
      });
  }

  protected deleteThreadComment(event: CommunityEvent, comment: EventComment): void {
    if (!window.confirm('Delete this comment? Replies under it go too.')) return;
    this.events
      .deleteComment(event.id, comment.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const ids = new Set([comment.id, ...this.replies(event.id, comment.id).map((r) => r.id)]);
          const rows = (this.threadComments()[event.id] ?? []).filter((c) => !ids.has(c.id));
          this.threadComments.set({ ...this.threadComments(), [event.id]: rows });
          this.bumpCount(event.id, -1 * (comment.parentId ? 1 : ids.size));
        },
        error: (err: ApiError) => this.threadError.set(err.message),
      });
  }

  /** A comment is removable by its author or the event host. */
  protected canDelete(event: CommunityEvent, comment: EventComment): boolean {
    const me = this.myId();
    return !!me && (String(comment.authorId) === me || String(event.authorId) === me);
  }

  /** Keep the card's discussion count truthful without a reload. */
  private bumpCount(eventId: string, delta: number): void {
    const bump = (list: CommunityEvent[]) =>
      list.map((e) => e.id === eventId ? { ...e, commentCount: Math.max(0, (e.commentCount ?? 0) + delta) } : e);
    this.upcoming.set(bump(this.upcoming()));
    this.mine.set(bump(this.mine()));
  }

  protected readonly rsvpOptions: Array<{ label: string; value: RsvpStatus; icon: string }> = [
    { label: 'Going', value: 'going', icon: 'check_circle' },
    { label: 'Interested', value: 'interested', icon: 'star_border' },
    { label: 'Declined', value: 'declined', icon: 'cancel' },
  ];

  protected readonly totalGoing = computed(() => this.upcoming().reduce((sum, event) => sum + (event.rsvps?.going ?? 0), 0));

  protected readonly featuredCount = computed(() => {
    const featured = new Map<string, boolean>();
    for (const event of [...this.upcoming(), ...this.mine()]) featured.set(event.id, !!event.featured);
    return [...featured.values()].filter(Boolean).length;
  });

  protected scopeLabel(scope: AudienceScope): string {
    switch (scope) {
      case 'team': return 'My team';
      case 'leadership': return 'Leadership';
      case 'members': return 'Team members';
      default: return 'Everyone';
    }
  }

  protected readonly form = this.fb.group(
    {
      title: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
      body: ['', [Validators.required, Validators.maxLength(2000)]],
      startsDate: [defaultStart(), Validators.required],
      startsTime: [defaultStart(), Validators.required],
      endsDate: [null as Date | null],
      endsTime: [null as Date | null],
      location: ['', Validators.maxLength(200)],
      scope: ['global' as AudienceScope, Validators.required],
    },
    { validators: endsPairValidator },
  );

  protected visible(): CommunityEvent[] {
    return this.tab() === 'upcoming' ? this.upcoming() : this.mine();
  }

  /** Feature-eligible: own event or admin (past events excluded server-side). */
  protected canFeature(event: CommunityEvent): boolean {
    if (this.isMine(event)) return true;
    try {
      return this.auth.isAdmin();
    } catch {
      return false;
    }
  }

  /** Optimistic feature toggle — rolls back on cap/perm errors. */
  protected toggleFeature(event: CommunityEvent): void {
    if (this.actingId() === event.id) return;
    const want = !event.featured;
    const prevUpcoming = this.upcoming();
    const prevMine = this.mine();
    this.actingId.set(event.id);
    this.featureError.set(null);
    const patch = (list: CommunityEvent[]): CommunityEvent[] =>
      list.map((e) => (e.id === event.id ? { ...e, featured: want } : e));
    this.upcoming.set(patch(prevUpcoming));
    this.mine.set(patch(prevMine));
    this.events
      .feature(event.id, want)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.actingId.set(null);
          const updated = res.data ?? null;
          if (updated) {
            const apply = (list: CommunityEvent[]): CommunityEvent[] =>
              list.map((e) => (e.id === event.id ? { ...e, ...updated } : e));
            this.upcoming.set(apply(this.upcoming()));
            this.mine.set(apply(this.mine()));
          } else {
            this.reload();
          }
        },
        error: (err: ApiError) => {
          this.actingId.set(null);
          this.upcoming.set(prevUpcoming);
          this.mine.set(prevMine);
          this.featureError.set(err.message);
        },
      });
  }

  ngOnInit(): void {
    this.reload();
    // Team handoff (?team=&teamName=): open the composer scoped to team
    // members only. Other audiences keep their downline meaning.
    const team = this.route.snapshot.queryParamMap.get('team')?.trim() ?? '';
    const teamName = this.route.snapshot.queryParamMap.get('teamName')?.trim() ?? '';
    if (team && teamName) {
      this.teamId.set(team);
      this.teamName.set(teamName);
      this.form.patchValue({
        title: `${teamName} — `,
        body: `For the ${teamName} team. `,
        scope: 'members' as AudienceScope,
      });
      this.showCompose.set(true);
      this.publishError.set(null);
    }
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({ upcoming: this.events.upcoming(), mine: this.events.mine() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ upcoming, mine }) => {
          this.upcoming.set(upcoming.data?.items ?? []);
          this.mine.set(mine.data?.items ?? []);
          this.loading.set(false);
          this.refreshPresence();
        },
        error: (err: ApiError) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
  }

  protected toggleCompose(): void {
    const opening = !this.showCompose();
    this.showCompose.set(opening);
    this.publishError.set(null);
    if (opening) this.cancelEdit();
  }

  protected startEdit(event: CommunityEvent): void {
    const start = new Date(event.startsAt);
    const end = event.endsAt ? new Date(event.endsAt) : null;
    this.form.reset({
      title: event.title, body: event.body,
      startsDate: start, startsTime: start,
      endsDate: end, endsTime: end,
      location: event.location ?? '', scope: event.scope,
    });
    // Keep team context so a team event stays team-scoped on save.
    this.teamId.set(event.teamId ?? this.teamId());
    this.editingId.set(event.id);
    this.showCompose.set(true);
    this.publishError.set(null);
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
    this.form.reset({
      title: '', body: '', startsDate: defaultStart(), startsTime: defaultStart(),
      endsDate: null, endsTime: null, location: '', scope: 'global',
    });
  }

  protected isMine(event: CommunityEvent): boolean {
    return this.mine().some((m) => m.id === event.id);
  }

  protected publish(): void {
    if (this.form.invalid) return;
    this.publishing.set(true);
    this.publishError.set(null);
    const v = this.form.getRawValue();
    const startsAt = toInputDateTime(mergeDateTime(v.startsDate!, v.startsTime!));
    const endsAt = v.endsDate && v.endsTime ? toInputDateTime(mergeDateTime(v.endsDate, v.endsTime)) : null;
    const scope = v.scope ?? 'global';
    if (scope === 'members' && !this.teamId()) {
      this.publishError.set('Team context is missing — reopen from the team page.');
      this.publishing.set(false);
      return;
    }
    const payload = {
      title: (v.title ?? '').trim(),
      body: (v.body ?? '').trim(),
      startsAt,
      ...(endsAt ? { endsAt } : {}),
      location: (v.location ?? '').trim(),
      scope,
      ...(scope === 'members' && this.teamId() ? { teamId: this.teamId() as string } : {}),
    };
    const editing = this.editingId();
    const request = editing ? this.events.update(editing, payload) : this.events.create(payload);
    request
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.publishing.set(false);
          this.showCompose.set(false);
          this.editingId.set(null);
          this.form.reset({
            title: '', body: '', startsDate: defaultStart(), startsTime: defaultStart(),
            endsDate: null, endsTime: null, location: '', scope: 'global',
          });
          this.tab.set('mine');
          this.reload();
        },
        error: (err: ApiError) => {
          this.publishing.set(false);
          this.publishError.set(withDetail(err));
        },
      });
  }

  protected rsvp(event: CommunityEvent, status: RsvpStatus): void {
    this.actingId.set(event.id);
    this.events
      .rsvp(event.id, status)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.actingId.set(null);
          const counts = res.data?.counts;
          const patch = (list: CommunityEvent[]): CommunityEvent[] => list.map((e) =>
            e.id === event.id ? { ...e, myRsvp: status, ...(counts ? { rsvps: counts } : {}) } : e,
          );
          this.upcoming.set(patch(this.upcoming()));
          this.mine.set(patch(this.mine()));
        },
        error: (err: ApiError) => {
          this.actingId.set(null);
          this.error.set(err.message);
        },
      });
  }

  protected cancel(event: CommunityEvent): void {
    this.confirmingCancelId.set(event.id);
  }

  /** Past start (attendance + recap unlock; reminders stop mattering). */
  protected isPast(event: CommunityEvent): boolean {
    const t = new Date(event.startsAt).getTime();
    return !Number.isNaN(t) && t <= Date.now();
  }

  protected canManageAttendees(event: CommunityEvent): boolean {
    return this.isMine(event) || this.auth.isAdmin();
  }

  protected toggleShare(event: CommunityEvent): void {
    this.shareEventId.set(this.shareEventId() === event.id ? null : event.id);
  }

  protected personalLink(): string {
    const base = (environment as { publicSiteUrl?: string }).publicSiteUrl ?? 'https://marketspase.com';
    const me = this.auth.currentUser();
    const handle = String(me?.storeSlug ?? me?.username ?? '').trim().toLowerCase();
    return `${String(base).replace(/\/+$/, '')}/${handle}`;
  }

  protected whenLabel(event: CommunityEvent): string {
    const at = new Date(event.startsAt);
    const when = Number.isNaN(at.getTime())
      ? 'date to be confirmed'
      : at.toLocaleString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
    return event.location ? `${when} · ${event.location}` : when;
  }

  protected inviteText(event: CommunityEvent): string {
    return `You're invited: ${event.title} — ${this.whenLabel(event)}. Join me here: ${this.personalLink()}`;
  }

  protected copyInvite(event: CommunityEvent): void {
    navigator.clipboard.writeText(this.inviteText(event)).then(() => {
      this.snack.open('Invite copied — paste it anywhere.', 'Close', { duration: 2500 });
    }).catch(() => {
      this.snack.open('Could not copy — long-press the text instead.', 'Close', { duration: 4000 });
    });
  }

  protected copyEventLink(): void {
    navigator.clipboard.writeText(this.personalLink()).then(() => {
      this.snack.open('Your invite link copied.', 'Close', { duration: 2500 });
    }).catch(() => {
      this.snack.open('Could not copy — long-press the link instead.', 'Close', { duration: 4000 });
    });
  }

  protected whatsAppInvite(event: CommunityEvent): void {
    window.open(`https://wa.me/?text=${encodeURIComponent(this.inviteText(event))}`, '_blank', 'noopener');
  }

  protected facebookInvite(): void {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(this.personalLink())}`,
      '_blank', 'noopener',
    );
  }

  protected toggleAttendees(event: CommunityEvent): void {
    const open = this.attendeesOpenId() === event.id ? null : event.id;
    this.attendeesOpenId.set(open);
    if (open && !this.attendees()[event.id]) this.loadAttendees(event.id);
  }

  protected attendeeList(eventId: string): EventAttendee[] {
    return this.attendees()[eventId] ?? [];
  }

  protected recap(eventId: string): { going: number; attended: number; noShow: number } {
    const rows = this.attendeeList(eventId);
    const going = rows.filter((r) => r.status === 'going').length;
    const attended = rows.filter((r) => r.attended === true).length;
    return { going, attended, noShow: Math.max(0, going - attended) };
  }

  private loadAttendees(eventId: string): void {
    this.attendeesLoading.set(true);
    this.events
      .attendees(eventId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.attendees.set({ ...this.attendees(), [eventId]: res.data?.attendees ?? [] });
          this.attendeesLoading.set(false);
        },
        error: (err: ApiError) => {
          this.attendeesLoading.set(false);
          this.error.set(err.message);
        },
      });
  }

  protected setAttendance(event: CommunityEvent, attendee: EventAttendee, attended: boolean): void {
    const key = `${event.id}:${attendee.partnerId}`;
    if (this.markingId()) return;
    this.markingId.set(key);
    this.events
      .markAttendance(event.id, attendee.partnerId, attended)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.markingId.set(null);
          const rows = this.attendeeList(event.id).map((r) =>
            r.partnerId === attendee.partnerId ? { ...r, attended } : r,
          );
          this.attendees.set({ ...this.attendees(), [event.id]: rows });
        },
        error: (err: ApiError) => {
          this.markingId.set(null);
          this.error.set(err.message);
        },
      });
  }

  protected confirmCancel(event: CommunityEvent): void {
    this.actingId.set(event.id);
    this.events
      .cancel(event.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.actingId.set(null);
          this.confirmingCancelId.set(null);
          this.reload();
        },
        error: (err: ApiError) => {
          this.actingId.set(null);
          this.error.set(err.message);
        },
      });
  }
}
