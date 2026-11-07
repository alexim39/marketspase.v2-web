import {
  ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { RouterModule } from '@angular/router';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { CoachingService, CoachingInbox, CoachingNote, MyCoach } from '../../../core/coaching/coaching.service';
import { PresenceService, PresenceStatus } from '../../../core/presence/presence.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../core/http/api-error';
import { AvatarComponent } from '../../../_common/avatar.component';

/**
 * @title My Coach & Mentorship — your assigned coach, action items and session notes.
 *
 * Coach is your direct upline (network parent). Notes are upline-writable
 * and member-readable so coaching stays visible to both. OnPush + signals.
 */
@Component({
  selector: 'async-my-coach',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, DatePipe, FormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule, PageSkeletonComponent, RouterModule],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a routerLink="/dashboard/training">Academy</a> &gt;
        <span>My Coach</span>
      </div>
    </section>

    <section class="coach-page">
      <div class="page-head">
        <div>
          <h2>My Coach & Mentorship</h2>
          <p class="subtitle">Your direct upline or campaign mentor, your next move, and your coaching history.</p>
        </div>
        <a mat-button routerLink="/dashboard/training">Back to Academy</a>
      </div>

      @if (loading()) {
        <async-page-skeleton layout="dashboard" [rows]="3" label="your coach" [showHeader]="false" />
      }

      @if (error(); as err) {
        <p class="error" role="alert">
          {{ err }}
          <button mat-button (click)="reload()">Retry</button>
        </p>
      }

      @if (coach(); as c) {
        <div class="dp-card coach-card">
          <async-avatar [photo]="c.coach?.profileImage" [name]="c.coach?.name ?? 'No coach yet'" size="md" [presence]="coachPresence()" />
          <div>
            @if (c.coach) {
              <strong>{{ c.coach.name }}</strong>
              <span class="muted">@{{ c.coach.username }}</span>
              @if (coachPresence() === 'online') {
                <span class="dp-status dp-status--ok">Online now</span>
              } @else if (coachPresence() === 'recent') {
                <span class="dp-status dp-status--info">Active recently</span>
              }
              @if (c.nextAction) {
                <p class="next-action">{{ c.nextAction }}</p>
              } @else {
                <p class="muted">No next action recorded yet.</p>
              }
            } @else {
              <strong>No coach assigned yet</strong>
              <p class="muted">Your upline will appear here once your referral link is set.</p>
            }
          </div>
        </div>

        <div class="dp-card journey-card">
          <div class="journey-head">
            <div>
              <p class="eyebrow">Your journey</p>
              <h3>{{ levelLabel(c.journey?.levelLabel) }}</h3>
              <p class="muted">Next rank: {{ nextRankLabel(c.journey?.nextLabel) }}</p>
            </div>
            <span class="pill">{{ c.journey?.percent ?? 0 }}%</span>
          </div>
          <div class="meter" role="progressbar" [attr.aria-valuenow]="c.journey?.percent ?? 0" aria-valuemin="0" aria-valuemax="100" aria-label="Journey progress">
            <span [style.width.%]="c.journey?.percent ?? 0"></span>
          </div>
          @if (c.missing?.length) {
            <ul class="missing-list">
              @for (m of c.missing; track m.key) {
                <li>
                  <strong>{{ m.label }}</strong>
                  <span class="muted">{{ m.action }}</span>
                </li>
              }
            </ul>
          } @else {
            <p class="muted">No outstanding steps right now.</p>
          }
        </div>
      }

      <div class="dp-card notes-card">
        <div class="card-head">
          <h3>Coaching notes</h3>
          <button
            mat-icon-button
            type="button"
            class="info-btn"
            (click)="showNotesInfo.set(!showNotesInfo())"
            [attr.aria-expanded]="showNotesInfo()"
            aria-label="How coaching notes work"
            title="How coaching notes work">
            <mat-icon>info_outline</mat-icon>
          </button>
        </div>
        <div class="shared-label"><mat-icon>group</mat-icon> {{ sharedLabel() }}</div>
        @if (showNotesInfo()) {
          <div class="notes-info" role="note">
            <mat-icon>info</mat-icon>
            <p>
              <strong>This is a shared coaching journal, not a private diary.</strong>
              Notes you add here are visible to your coach, and notes your coach adds appear
              here too. Only you and your upline can read them. For a real-time conversation,
              use Chat.
            </p>
          </div>
        }
        @if (coach()) {
          <div class="note-compose">
            <mat-form-field appearance="outline">
              <mat-label>Add a note to your shared coaching log</mat-label>
              <textarea matInput rows="2" [value]="draft()" (input)="draft.set($any($event.target).value)" maxlength="2000" placeholder="What was discussed, next step…"></textarea>
            </mat-form-field>
            <button mat-flat-button color="primary" (click)="saveNote()" [disabled]="!draft().trim() || saving()">{{ saving() ? 'Saving…' : 'Add note' }}</button>
            @if (noteError(); as err) {
              <span class="error" role="alert">{{ err }}</span>
            }
          </div>
        }
        @if (notes().length > 0) {
          <ul class="note-list">
            @for (n of notes(); track n.id) {
              <li>
                <p>{{ n.body }}</p>
                <span class="muted">{{ authorLabel(n) }} · {{ sharedLabel() }} · {{ n.createdAt | date:'medium' }}</span>
              </li>
            }
          </ul>
        } @else if (!loading()) {
          <p class="empty">No notes yet — your first coaching session starts the shared log.</p>
        }
      </div>

      @if (inbox()?.teamSize) {
        <div class="dp-card inbox-card">
          <div class="card-head">
            <h3>Notes from your team</h3>
            <span class="pill">{{ inbox()?.total ?? 0 }}</span>
          </div>
          <p class="inbox-sub">Recent notes across the partners you mentor. Open a partner to reply.</p>
          @if (inbox()?.notes?.length) {
            <ul class="inbox-list">
              @for (n of inbox()?.notes ?? []; track n.id) {
                <li>
                  <div class="inbox-top">
                    <a [routerLink]="['/dashboard/mentorship/partners/my-partners/detail', n.memberId]">{{ n.memberName }}</a>
                    <span class="role" [class.role--coach]="n.authorRole === 'coach'">{{ n.authorRole === 'coach' ? 'Coach note' : 'Member note' }}</span>
                  </div>
                  <p>{{ n.body }}</p>
                  <span class="muted">{{ n.authorName }} · {{ n.createdAt | date:'medium' }}</span>
                </li>
              }
            </ul>
          } @else {
            <p class="empty">No notes from your team yet. When they add one, it appears here.</p>
          }
        </div>
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .coach-page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
    .page-head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1em; }
    .page-head h2 { margin: 0; }
    .page-head a { min-height: 44px; }
    .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); max-width: 44em; }
    .coach-card { padding: 1em; display: flex; gap: 1em; align-items: flex-start; }
    .coach-card strong { display: block; }
    .next-action { margin: 0.4em 0 0; font-weight: 600; }
    .next-action { display: flex; align-items: center; gap: 0.35em; }
    .next-action mat-icon { font-size: 1.1em; width: 1.1em; height: 1.1em; color: var(--ms-primary-strong); }
    .journey-card { padding: 1em; display: flex; flex-direction: column; gap: 0.75em; }
    .journey-head { display: flex; justify-content: space-between; gap: 1em; align-items: flex-start; }
    .journey-head h3 { margin: 0.1em 0 0.15em; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.72rem; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; }
    .pill { align-self: center; padding: 4px 10px; border-radius: 999px; background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-weight: 800; }
    .meter { height: 8px; border-radius: 999px; background: var(--ms-line); overflow: hidden; }
    .meter span { display: block; height: 100%; background: var(--ms-primary); transition: width 0.25s ease; }
    .missing-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5em; }
    .missing-list li { display: flex; flex-direction: column; gap: 0.1em; border-top: 1px solid var(--ms-line); padding-top: 0.5em; }
    .missing-list li:first-child { border-top: none; padding-top: 0; }
    .action-card { padding: 1em; }
    .action-card h3 { margin: 0 0 0.4em; }
    .action-card ul { margin: 0; padding-left: 1.2em; }
    .notes-card { padding: 1em; display: flex; flex-direction: column; gap: 0.75em; }
    .notes-card h3 { margin: 0; }
    .card-head { display: flex; align-items: center; justify-content: space-between; gap: 0.5em; }
    .card-head h3 { margin: 0; }
    .info-btn { color: var(--ms-text-muted); flex: 0 0 auto; }
    .shared-label { display: inline-flex; align-items: center; gap: 0.3em; color: var(--ms-primary-strong); font-size: 0.78rem; font-weight: 700; }
    .shared-label mat-icon { font-size: 1em; width: 1em; height: 1em; }
    .notes-info { display: flex; gap: 0.6em; align-items: flex-start; background: var(--ms-primary-soft); border: 1px solid var(--ms-line); border-radius: 8px; padding: 0.7em 0.85em; }
    .notes-info mat-icon { color: var(--ms-primary-strong); flex: 0 0 auto; }
    .notes-info p { margin: 0; font-size: 0.88em; }
    .inbox-card { padding: 1em; display: flex; flex-direction: column; gap: 0.65em; }
    .inbox-sub { margin: 0; color: var(--ms-text-muted); font-size: 0.88em; }
    .inbox-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.6em; }
    .inbox-list li { background: var(--ms-canvas); border: 1px solid var(--ms-line); border-radius: 8px; padding: 0.7em 0.9em; display: flex; flex-direction: column; gap: 0.25em; }
    .inbox-list p { margin: 0; }
    .inbox-top { display: flex; align-items: center; justify-content: space-between; gap: 0.5em; }
    .inbox-top a { font-weight: 700; text-decoration: none; }
    .role { padding: 2px 8px; border-radius: 999px; font-size: 0.72rem; font-weight: 700; background: var(--ms-canvas); border: 1px solid var(--ms-line); color: var(--ms-text-muted); }
    .role--coach { background: var(--ms-primary-soft); border-color: transparent; color: var(--ms-primary-strong); }
    .note-compose { display: flex; flex-direction: column; gap: 0.5em; }
    .note-compose mat-form-field { width: 100%; }
    .note-compose button { align-self: flex-start; min-height: 44px; }
    .note-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.6em; }
    .note-list li { background: var(--ms-canvas); border: 1px solid var(--ms-line); border-radius: 8px; padding: 0.7em 0.9em; }
    .note-list p { margin: 0; }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .error { color: var(--ms-error); display: flex; align-items: center; gap: 0.5em; }
    html[data-theme='dark'] .error { color: #e89a9a; }
    .empty { color: var(--ms-text-muted); }
  `],
})
export class MyCoachComponent implements OnInit {
  private readonly coaching = inject(CoachingService);
  private readonly auth = inject(AuthService);
  private readonly presence = inject(PresenceService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly noteError = signal<string | null>(null);
  protected readonly coach = signal<MyCoach | null>(null);
  protected readonly notes = signal<CoachingNote[]>([]);
  protected readonly inbox = signal<CoachingInbox | null>(null);
  protected readonly showNotesInfo = signal(false);
  protected readonly draft = signal('');
  /** coachId → lastSeenAt (null = offline); drives the avatar dot. */
  protected readonly presenceMap = signal<Record<string, string | null>>({});
  protected readonly meId = computed(() => String(this.auth.currentUser()?.id ?? ''));

  /** Presence dot for the coach avatar (null hides it). */
  protected coachPresence(): PresenceStatus {
    const id = this.coach()?.coach?.id;
    if (!id) return null;
    return this.presence.statusOf(this.presenceMap()[id] ?? null);
  }

  protected levelLabel(value?: string | null): string {
    const text = String(value ?? '').trim();
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Partner';
  }

  protected nextRankLabel(value?: string | null): string {
    const text = String(value ?? '').trim();
    return text ? this.levelLabel(text) : 'Not set yet';
  }

  protected authorLabel(note: CoachingNote): string {
    const author = String(note.authorId ?? note.coachId ?? '');
    if (author && author === this.meId()) return 'You';
    return this.coach()?.coach?.name || 'Coach';
  }

  protected sharedLabel(): string {
    return this.coach()?.coach ? 'Shared with your coach' : 'Your coaching log';
  }

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.coaching
      .mine()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (res) => {
          this.coach.set(res?.data ?? null);
          this.loadNotes();
          this.loadInbox();
          const coachId = res?.data?.coach?.id;
          if (coachId) {
            this.presence
              .lookup([coachId])
              .pipe(takeUntilDestroyed(this.destroyRef))
              .subscribe((map) => this.presenceMap.set({ ...this.presenceMap(), ...map }));
          }
        },
        error: (err: ApiError) => this.error.set(err.message),
      });
  }

  private loadNotes(): void {
    this.coaching
      .notes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.notes.set(res?.data ?? []),
        error: () => this.notes.set([]),
      });
  }

  private loadInbox(): void {
    this.coaching
      .inbox()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.inbox.set(res?.data ?? null),
        error: () => this.inbox.set(null),
      });
  }

  protected saveNote(): void {
    const body = this.draft().trim();
    if (!body || this.saving()) return;
    this.saving.set(true);
    this.noteError.set(null);
    const me = this.meId();
    if (!me) {
      this.saving.set(false);
      this.noteError.set('Could not determine your account - please sign in again.');
      return;
    }
    this.coaching
      .addNote(me, body)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: () => {
          this.draft.set('');
          this.loadNotes();
        },
        error: (err: ApiError) => this.noteError.set(err.message),
      });
  }
}
