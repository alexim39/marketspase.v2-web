import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
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
      <div class="page-head">
        <div>
          <h2>Events</h2>
          <p class="subtitle">Gatherings worth showing up for.</p>
        </div>
        <div class="head-actions">
          <mat-button-toggle-group [value]="tab()" (change)="tab.set($event.value)" aria-label="Event list">
            <mat-button-toggle value="upcoming">Upcoming</mat-button-toggle>
            <mat-button-toggle value="mine">My events</mat-button-toggle>
          </mat-button-toggle-group>
          <button mat-button (click)="toggleCompose()">{{ showCompose() ? 'Cancel' : 'New event' }}</button>
        </div>
      </div>

      @if (loading()) {
        <async-page-skeleton layout="cards" [rows]="4" label="community events" [showHeader]="false" />
      }

      @if (error(); as err) {
        <p class="error" role="alert">
          {{ err }}
          <button mat-button (click)="reload()">Retry</button>
        </p>
      }

      @if (showCompose()) {
        <form class="compose-form dp-card" [formGroup]="form" (ngSubmit)="publish()">
          <mat-form-field appearance="outline">
            <mat-label>Title</mat-label>
            <input matInput formControlName="title" maxlength="120" placeholder="e.g. Saturday cell meeting" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Details</mat-label>
            <textarea matInput rows="3" formControlName="body" maxlength="2000"></textarea>
          </mat-form-field>
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
          <div class="two-col">
            <mat-form-field appearance="outline">
              <mat-label>Venue (optional)</mat-label>
              <input matInput formControlName="location" maxlength="200" placeholder="e.g. Ikeja hall" />
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
          <div class="form-actions">
            <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || publishing()">
              {{ publishing() ? 'Saving…' : (editingId() ? 'Save changes' : 'Create event') }}
            </button>
            @if (editingId()) {
              <button mat-button type="button" (click)="cancelEdit()" [disabled]="publishing()">Cancel</button>
            }
            @if (publishError(); as err) {
              <span class="error" role="alert">{{ err }}</span>
            }
          </div>
        </form>
      }

      @if (featureError(); as ferr) {
        <p class="error" role="alert">{{ ferr }}</p>
      }

      @if (visible().length > 0) {
        <ol class="event-list">
          @for (event of visible(); track event.id) {
            <li class="dp-card event-card" [class.event-card--featured]="event.featured">
              <div class="event-top">
                <div>
                  @if (event.featured) {
                    <span class="dp-status dp-status--warn"><mat-icon>star</mat-icon> Featured</span>
                  }
                  <strong>{{ event.title }}</strong>
                  <span class="muted byline"> · <async-avatar [photo]="event.author?.profileImage" [name]="event.author?.name ?? 'Teammate'" size="xs" [presence]="presenceOf(event.authorId)" />{{ event.author?.name ?? 'Teammate' }}</span>
                </div>
                <span class="muted">{{ event.startsAt | date:'medium' }}</span>
              </div>
              <p>{{ event.body }}</p>
              @if (event.location) {
                <p class="muted"><mat-icon>place</mat-icon> {{ event.location }}</p>
              }
              <div class="rsvp-row" role="group" aria-label="RSVP">
                @for (opt of rsvpOptions; track opt.value) {
                  <button
                    mat-button
                    [color]="event.myRsvp === opt.value ? 'primary' : undefined"
                    (click)="rsvp(event, opt.value)"
                    [disabled]="actingId() === event.id"
                  >{{ opt.label }} ({{ event.rsvps[opt.value] ?? 0 }})</button>
                }
                <span class="spacer"></span>
                <button mat-button (click)="toggleShare(event)" [attr.aria-expanded]="shareEventId() === event.id" title="Invite others to this event">
                  <mat-icon>share</mat-icon>Invite
                </button>
                @if (canFeature(event)) {
                  <button mat-button (click)="toggleFeature(event)" [disabled]="actingId() === event.id" [title]="event.featured ? 'Remove highlight' : 'Highlight at top'">
                    <mat-icon>{{ event.featured ? 'star' : 'star_border' }}</mat-icon>
                    {{ event.featured ? 'Unfeature' : 'Feature' }}
                  </button>
                }
                @if (isMine(event)) {
                  <button mat-button (click)="startEdit(event)" [disabled]="actingId() === event.id">Edit</button>
                  @if (confirmingCancelId() === event.id) {
                    <span class="delete-confirm" role="alertdialog" aria-label="Confirm event deletion">
                      <strong>Delete this event?</strong> RSVPs go with it — this cannot be undone.
                      <button mat-button (click)="confirmingCancelId.set(null)" [disabled]="actingId() === event.id">Keep</button>
                      <button mat-flat-button color="warn" (click)="confirmCancel(event)" [disabled]="actingId() === event.id">
                        {{ actingId() === event.id ? 'Deleting…' : 'Yes, delete' }}
                      </button>
                    </span>
                  } @else {
                    <button mat-button color="warn" (click)="confirmingCancelId.set(event.id)" [disabled]="actingId() === event.id">Cancel event</button>
                  }
                }
              </div>
              <div class="thread-toggle">
                <button mat-button (click)="toggleThread(event)" [attr.aria-expanded]="openThreadId() === event.id">
                  <mat-icon>comment</mat-icon>
                  Discussion{{ event.commentCount ? ' (' + event.commentCount + ')' : '' }}
                </button>
                @if (event.teamId) {
                  <a mat-button routerLink="/dashboard/messages" [queryParams]="{ teamGroup: event.teamId }" title="Discuss in the team group chat">
                    <mat-icon>forum</mat-icon>Team chat
                  </a>
                }
              </div>
              @if (shareEventId() === event.id) {
                <div class="share-panel" role="region" aria-label="Invite to this event">
                  <p class="invite-text">{{ inviteText(event) }}</p>
                  <div class="share-actions">
                    <button mat-stroked-button (click)="copyInvite(event)"><mat-icon>content_copy</mat-icon>Copy invite</button>
                    <button mat-stroked-button (click)="copyEventLink()"><mat-icon>link</mat-icon>Copy my link</button>
                    <button mat-stroked-button (click)="whatsAppInvite(event)"><mat-icon>share</mat-icon>WhatsApp</button>
                    <button mat-stroked-button (click)="facebookInvite()"><mat-icon>share</mat-icon>Facebook</button>
                  </div>
                </div>
              }
              @if (canManageAttendees(event) && isPast(event)) {
                <div class="attend-panel" role="region" aria-label="Attendance">
                  <button mat-button (click)="toggleAttendees(event)" [attr.aria-expanded]="attendeesOpenId() === event.id">
                    <mat-icon>how_to_reg</mat-icon>
                    Attendance{{ recap(event.id).going > 0 ? ' (' + recap(event.id).attended + '/' + recap(event.id).going + ' here)' : '' }}
                  </button>
                  @if (attendeesOpenId() === event.id) {
                    @if (attendeesLoading()) {
                      <mat-progress-bar mode="indeterminate" aria-label="Loading" />
                    } @else if (attendeeList(event.id).length > 0) {
                      <ul class="attend-list">
                        @for (a of attendeeList(event.id); track a.partnerId) {
                          <li>
                            <span class="who"><strong>{{ a.name }}</strong><span class="muted">@{{ a.username ?? '—' }} · {{ a.status }}</span></span>
                            <span class="spacer"></span>
                            <button mat-button [disabled]="markingId() !== null" (click)="setAttendance(event, a, true)" [color]="a.attended === true ? 'primary' : undefined" [attr.aria-pressed]="a.attended === true">Here</button>
                            <button mat-button [disabled]="markingId() !== null" (click)="setAttendance(event, a, false)" [color]="a.attended === false ? 'warn' : undefined" [attr.aria-pressed]="a.attended === false">Absent</button>
                          </li>
                        }
                      </ul>
                      <div class="recap-row">
                        <span class="muted">{{ recap(event.id).attended }} attended · {{ recap(event.id).noShow }} no-show</span>
                        <span class="spacer"></span>
                                </div>
                    } @else {
                      <p class="muted">No RSVPs yet.</p>
                    }
                  }
                </div>
              }
              @if (openThreadId() === event.id) {
                <div class="thread">
                  @if (threadLoading()) {
                    <mat-progress-bar mode="indeterminate" aria-label="Loading" />
                  }
                  @if (threadError(); as err) {
                    <p class="error" role="alert">{{ err }}</p>
                  }
                  @for (c of topComments(event.id); track c.id) {
                    <div class="comment">
                      <strong class="byline"><async-avatar [photo]="c.author?.profileImage" [name]="c.author?.name ?? 'Teammate'" size="xs" [presence]="presenceOf(c.authorId)" />{{ c.author?.name ?? 'Teammate' }}</strong>
                      <p>{{ c.body }}</p>
                      <div class="comment-foot">
                        <span class="muted">{{ c.createdAt | date:'short' }}</span>
                        <button mat-button (click)="replyTo.set({ id: c.id, name: c.author?.name ?? 'teammate' })">Reply</button>
                        @if (canDelete(event, c)) {
                          <button mat-button color="warn" (click)="deleteThreadComment(event, c)">Delete</button>
                        }
                      </div>
                      @for (r of replies(event.id, c.id); track r.id) {
                        <div class="comment comment--reply">
                          <strong class="byline"><async-avatar [photo]="r.author?.profileImage" [name]="r.author?.name ?? 'Teammate'" size="xs" [presence]="presenceOf(r.authorId)" />{{ r.author?.name ?? 'Teammate' }}</strong>
                          <p>{{ r.body }}</p>
                          <div class="comment-foot">
                            <span class="muted">{{ r.createdAt | date:'short' }}</span>
                            @if (canDelete(event, r)) {
                              <button mat-button color="warn" (click)="deleteThreadComment(event, r)">Delete</button>
                            }
                          </div>
                        </div>
                      }
                    </div>
                  } @empty {
                    @if (!threadLoading()) {
                      <p class="empty">No questions yet — ask the host anything below.</p>
                    }
                  }
                  <div class="comment-box">
                    <mat-form-field appearance="outline" subscriptSizing="dynamic">
                      <mat-label>@if (replyTo(); as rt) { Reply to {{ rt.name }}… } @else { Ask a question… }</mat-label>
                      <input matInput [value]="threadDraft()" (input)="threadDraft.set($any($event.target).value)" maxlength="1000" (keydown.enter)="sendThreadComment(event)" />
                    </mat-form-field>
                    @if (replyTo()) {
                      <button mat-button (click)="replyTo.set(null)">Cancel reply</button>
                    }
                    <button mat-flat-button color="primary" (click)="sendThreadComment(event)" [disabled]="!threadDraft().trim() || threadSending()">
                      {{ threadSending() ? 'Posting…' : 'Post' }}
                    </button>
                  </div>
                </div>
              }
            </li>
          }
        </ol>
      } @else if (!loading() && !error()) {
        <p class="empty">
          @if (tab() === 'upcoming') {
            Nothing scheduled — check back soon or create one.
          } @else {
            You haven't created any events yet.
          }
        </p>
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .events-page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
    .page-head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1em; }
    .page-head h2 { margin: 0; }
    .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); }
    .head-actions { display: flex; gap: 0.5em; align-items: center; flex-wrap: wrap; }
    .compose-form { padding: 1em; display: flex; flex-direction: column; gap: 0.75em; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75em; }
    .form-actions { display: flex; align-items: center; gap: 0.75em; }
    .event-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.75em; }
    .event-card { padding: 1em; display: flex; flex-direction: column; gap: 0.5em; }
    .event-card--featured { border-left: 4px solid var(--ms-primary); }
    .event-card p { margin: 0; }
    .event-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75em; flex-wrap: wrap; }
    .byline { display: inline-flex; align-items: center; gap: 0.4em; }
    .event-top .muted mat-icon, p.muted mat-icon { font-size: 16px; height: 16px; width: 16px; vertical-align: -3px; }
    .rsvp-row { display: flex; align-items: center; gap: 0.1em; flex-wrap: wrap; border-top: 1px solid var(--ms-line); padding-top: 0.5em; }
    .rsvp-row .spacer { flex: 1; }
    .rsvp-row button, .delete-confirm button { min-height: 44px; }
    .share-panel, .attend-panel { border-top: 1px solid var(--ms-line); padding-top: 0.7em; display: flex; flex-direction: column; gap: 0.6em; }
    .invite-text { margin: 0; background: var(--ms-canvas); border: 1px dashed var(--ms-line); border-radius: 8px; padding: 0.7em 0.9em; overflow-wrap: anywhere; }
    .share-actions { display: flex; gap: 0.5em; flex-wrap: wrap; }
    .share-actions button { min-height: 44px; }
    .attend-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
    .attend-list li { display: flex; align-items: center; gap: 0.5em; padding: 0.45em 0; border-top: 1px solid var(--ms-line); flex-wrap: wrap; }
    .attend-list .who { display: flex; flex-direction: column; min-width: 0; }
    .attend-list button { min-height: 44px; }
    .recap-row { display: flex; align-items: center; gap: 0.6em; flex-wrap: wrap; }
    .recap-row .spacer { flex: 1; }
    .thread-toggle { display: flex; }
    .thread-toggle button { min-height: 44px; }
    .thread { display: flex; flex-direction: column; gap: 0.6em; border-top: 1px solid var(--ms-line); padding-top: 0.75em; }
    .comment { display: flex; flex-direction: column; gap: 0.2em; background: var(--ms-canvas); border: 1px solid var(--ms-line); border-radius: 8px; padding: 0.6em 0.8em; }
    .comment p { margin: 0; white-space: pre-wrap; }
    .comment--reply { margin-left: 1.5em; }
    .comment-foot { display: flex; align-items: center; gap: 0.4em; flex-wrap: wrap; }
    .comment-foot button { min-height: 44px; }
    .comment-box { display: flex; gap: 0.5em; align-items: center; flex-wrap: wrap; }
    .comment-box mat-form-field { flex: 1; min-width: 200px; }
    .delete-confirm { display: inline-flex; align-items: center; gap: 0.4em; flex-wrap: wrap; background: var(--ms-error-soft); border: 1px solid var(--ms-error); border-radius: 8px; padding: 0.3em 0.6em; font-size: 0.85em; }
    html[data-theme='dark'] .delete-confirm { color: #e89a9a; }
    .delete-confirm button { min-height: 44px; }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .error { color: var(--ms-error); display: flex; align-items: center; gap: 0.5em; }
    .empty { color: var(--ms-text-muted); }
    @media only screen and (max-width: 600px) {
      .two-col { grid-template-columns: 1fr; }
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

  protected readonly rsvpOptions: Array<{ label: string; value: RsvpStatus }> = [
    { label: 'Going', value: 'going' },
    { label: 'Interested', value: 'interested' },
    { label: 'Declined', value: 'declined' },
  ];

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
