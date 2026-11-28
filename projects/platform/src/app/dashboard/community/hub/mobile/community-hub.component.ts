import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { DatePipe, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, forkJoin, interval, of } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { AvatarComponent } from '../../../../_common/avatar.component';
import { CommunityService } from '../../../../core/community/community.service';
import { FeedPost, POST_KIND_LABELS, PostKind } from '../../../../core/community/community.models';
import { EventService } from '../../../../core/events/event.service';
import { CommunityEvent } from '../../../../core/events/event.models';
import { MessageService } from '../../../../core/messaging/message.service';
import { Contact, Message } from '../../../../core/messaging/message.models';
import { PresenceService, PresenceStatus } from '../../../../core/presence/presence.service';
import { ApiError, userError } from '../../../../core/http/api-error';

interface HubPerson {
  id: string;
  name: string;
  photo: string | null;
}

/**
 * Community hub — native mobile overview.
 *
 * A live "circle" card leads with real teammate photos and presence pulses,
 * then the latest feed, upcoming gatherings and recent conversations. Every
 * card is a direct entry point; the heavy interaction stays on the dedicated
 * feed, events and messages screens.
 */
@Component({
  selector: 'async-community-hub-mobile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AvatarComponent,
    DatePipe,
    MatButtonModule,
    MatIconModule,
    PageSkeletonComponent,
    RouterModule,
  ],
  templateUrl: './community-hub.component.html',
  styleUrls: ['./community-hub.component.scss'],
})
export class CommunityHubMobileComponent implements OnInit {
  private readonly community = inject(CommunityService);
  private readonly events = inject(EventService);
  private readonly messages = inject(MessageService);
  private readonly presence = inject(PresenceService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);

  protected readonly loading = signal(true);
  protected readonly loaded = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly posts = signal<FeedPost[]>([]);
  protected readonly upcomingEvents = signal<CommunityEvent[]>([]);
  protected readonly recentMessages = signal<Message[]>([]);
  protected readonly contacts = signal<Contact[]>([]);
  protected readonly unread = signal(0);
  protected readonly presenceMap = signal<Record<string, string | null>>({});
  /** Recomputes relative presence as minutes pass, even without a request. */
  private readonly clock = signal(0);

  protected readonly people = computed<HubPerson[]>(() => {
    this.clock();
    const contactById = new Map(this.contacts().map((contact) => [String(contact.id), contact]));
    const people = new Map<string, HubPerson>();
    const add = (id: string | null | undefined, name: string | null | undefined, photo: string | null | undefined): void => {
      const key = String(id ?? '').trim();
      if (!key) return;
      const contact = contactById.get(key);
      const existing = people.get(key);
      const displayName = (contact?.name ?? name ?? '').trim() || 'Teammate';
      const displayPhoto = contact?.photo ?? photo ?? null;
      if (!existing) {
        people.set(key, { id: key, name: displayName, photo: displayPhoto });
      } else if (!existing.photo && displayPhoto) {
        existing.photo = displayPhoto;
      }
    };

    for (const contact of this.contacts()) add(contact.id, contact.name, contact.photo);
    for (const post of this.posts()) add(post.authorId, post.author?.name, post.author?.profileImage);
    for (const event of this.upcomingEvents()) add(event.authorId, event.author?.name, event.author?.profileImage);
    for (const message of this.recentMessages()) add(message.senderId, message.sender?.name, null);

    const rank = (person: HubPerson): number => {
      const status = this.presenceOf(person.id);
      return status === 'online' ? 0 : status === 'recent' ? 1 : 2;
    };
    return [...people.values()].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  });

  protected readonly heroPeople = computed(() => this.people().slice(0, 3));
  protected readonly onlineCount = computed(() => this.people().filter((person) => this.presenceOf(person.id) === 'online').length);
  protected readonly recentCount = computed(() => this.people().filter((person) => this.presenceOf(person.id) === 'recent').length);

  protected readonly pulseLabel = computed(() => {
    if (this.onlineCount() > 0) return 'Live now';
    if (this.recentCount() > 0) return 'Around lately';
    return 'Team pulse';
  });

  protected readonly presenceHeadline = computed(() => {
    const online = this.people().filter((person) => this.presenceOf(person.id) === 'online');
    if (online.length === 1) return `${this.firstName(online[0].name)} is online now`;
    if (online.length > 1) return `${this.firstName(online[0].name)} and ${online.length - 1} other${online.length > 2 ? 's' : ''} are online`;
    const recent = this.people().filter((person) => this.presenceOf(person.id) === 'recent');
    if (recent.length === 1) return `${this.firstName(recent[0].name)} was active recently`;
    if (recent.length > 1) return `${this.firstName(recent[0].name)} and ${recent.length - 1} other${recent.length > 2 ? 's' : ''} were around`;
    if (this.people().length > 0) return 'Your circle is quiet';
    return 'Build your circle';
  });

  protected readonly presenceDetail = computed(() => {
    const count = this.people().length;
    if (this.onlineCount() > 0) return `${this.onlineCount()} online · ${count} in your circle`;
    if (this.recentCount() > 0) return `${this.recentCount()} recently active · ${count} in your circle`;
    if (count > 0) return `${count} teammate${count === 1 ? '' : 's'} · tap to say hello`;
    return 'Follow teammates and start a conversation';
  });

  ngOnInit(): void {
    this.reload();
    if (!isPlatformBrowser(this.platformId)) return;
    interval(60_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.clock.update((value) => value + 1);
        this.refreshPresence();
      });
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      feed: this.community.feed(undefined, 6).pipe(catchError(() => of(null))),
      upcoming: this.events.upcoming(4).pipe(catchError(() => of(null))),
      unread: this.messages.unreadCount().pipe(catchError(() => of(null))),
      inbox: this.messages.inbox(5).pipe(catchError(() => of(null))),
      contacts: this.messages.contacts().pipe(catchError(() => of(null))),
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        this.loading.set(false);
        this.loaded.set(true);
      }),
    ).subscribe({
      next: ({ feed, upcoming, unread, inbox, contacts }) => {
        this.posts.set(feed?.data?.items ?? []);
        this.upcomingEvents.set(upcoming?.data?.items ?? []);
        this.unread.set(unread?.data?.unread ?? 0);
        this.recentMessages.set(inbox?.data ?? []);
        this.contacts.set(contacts?.data ?? []);
        this.refreshPresence();
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }

  /** Bulk presence for every teammate already on screen. */
  private refreshPresence(): void {
    const ids = [
      ...this.contacts().map((contact) => contact.id),
      ...this.posts().map((post) => post.authorId),
      ...this.upcomingEvents().map((event) => event.authorId),
      ...this.recentMessages().map((message) => message.senderId),
    ];
    if (ids.length === 0) return;
    this.presence.lookup(ids)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((map) => {
        this.presenceMap.update((current) => ({ ...current, ...map }));
        this.clock.update((value) => value + 1);
      });
  }

  protected presenceOf(id: string | null | undefined): PresenceStatus {
    this.clock();
    if (!id) return null;
    return this.presence.statusOf(this.presenceMap()[String(id)] ?? null);
  }

  protected timeAgo(iso: string | null | undefined): string {
    const time = iso ? new Date(iso).getTime() : NaN;
    if (!Number.isFinite(time)) return '';
    const minutes = Math.max(0, Math.round((Date.now() - time) / 60_000));
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d`;
    return new Date(iso as string).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  protected preview(body: string | null | undefined, limit = 140): string {
    const text = String(body ?? '').replace(/\s+/g, ' ').trim();
    return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text;
  }

  protected senderName(message: Message): string {
    const contact = this.contacts().find((row) => String(row.id) === String(message.senderId));
    return message.sender?.name ?? contact?.name ?? 'Teammate';
  }

  protected photoFor(id: string | null | undefined): string | null {
    const key = String(id ?? '');
    if (!key) return null;
    return this.contacts().find((row) => String(row.id) === key)?.photo
      ?? this.posts().find((post) => String(post.authorId) === key)?.author?.profileImage
      ?? this.upcomingEvents().find((event) => String(event.authorId) === key)?.author?.profileImage
      ?? null;
  }

  protected kindLabel(kind: PostKind): string {
    return POST_KIND_LABELS[kind] ?? kind;
  }

  protected kindIcon(kind: PostKind): string {
    switch (kind) {
      case 'recognition': return 'workspace_premium';
      case 'announcement': return 'campaign';
      case 'training': return 'school';
      case 'event': return 'event';
      default: return 'forum';
    }
  }

  protected scopeLabel(scope: CommunityEvent['scope']): string {
    switch (scope) {
      case 'team': return 'My team';
      case 'leadership': return 'Leaders';
      case 'members': return 'Members';
      default: return 'Everyone';
    }
  }

  private firstName(name: string): string {
    return String(name ?? '').trim().split(/\s+/)[0] || 'A teammate';
  }
}
