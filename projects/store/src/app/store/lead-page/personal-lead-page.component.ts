import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { FormsModule, NgForm } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { StoreService, storeAssetUrl, storeError } from '../store.service';
import { PublicLeadPage } from '../store.models';
import { environment } from '../../../environments/environment';
import { scrollToSection } from '../../_common/utils/scroll-to-section';

/**
 * Public personal lead page — the shareable page that belongs to the partner,
 * separate from their store. Visitors can introduce themselves, leave contact
 * details and opt in; the lead lands directly in the partner's pipeline.
 */
@Component({
  selector: 'async-personal-lead-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, RouterModule],
  template: `
    @if (loading()) {
      <div class="loading"><span></span><p>Loading page…</p></div>
    } @else if (error(); as message) {
      <div class="missing">
        <mat-icon>person_off</mat-icon>
        <h1>Page not available</h1>
        <p>{{ message }}</p>
      </div>
    } @else if (page(); as p) {
      <main class="lead-page">
        <section class="hero">
          <div class="hero-inner">
            <div class="identity">
              @if (image(p.profileImage); as photo) {
                <img class="avatar" [src]="photo" [alt]="p.name" />
              } @else {
                <span class="avatar initials">{{ initial(p.name) }}</span>
              }
              <div>
                <p class="eyebrow">{{ text(p, 'heroBadge') || 'Your next step' }}</p>
                <p class="partner-name">{{ p.name }}</p>
                <p class="handle">&#64;{{ p.username }}</p>
                @if (text(p, 'jobTitle'); as role) {
                  <p class="role">{{ role }}</p>
                }
                @if (text(p, 'bio'); as shortBio) {
                  <p class="bio-line">{{ shortBio }}</p>
                }
              </div>
            </div>

            <div class="hero-copy">
              <h1>{{ text(p, 'headline') || 'Build a business around your life.' }}</h1>
              @if (text(p, 'businessTagline'); as tagline) {
                <p class="tagline">{{ tagline }}</p>
              }
              <p class="sub">{{ text(p, 'subHeadline') || 'A simple conversation could change your direction.' }}</p>
              <div class="hero-actions">
                <a class="primary-btn" href="#lead-form" (click)="scrollToForm($event)">Start the conversation</a>
                @if (whatsappUrl(); as wa) {
                  <a class="ghost-btn" [href]="wa" target="_blank" rel="noopener">
                    <mat-icon>chat</mat-icon> {{ text(p, 'whatsappCtaText') || 'Chat on WhatsApp' }}
                  </a>
                }
                @if (groupUrl(); as group) {
                  <a class="ghost-btn" [href]="group" target="_blank" rel="noopener">
                    <mat-icon>groups</mat-icon> Join WhatsApp group
                  </a>
                }
                @if (joinUrl(); as join) {
                  <a class="ghost-btn join-btn" [href]="join">
                    <mat-icon>person_add</mat-icon> Join my team
                  </a>
                }
              </div>
            </div>
          </div>
        </section>

        <section class="content-grid">
          <div class="story">
            @if (text(p, 'aboutStory'); as story) {
              <p class="eyebrow">The story</p>
              <h2>Why this work matters</h2>
              <p class="story-copy">{{ story }}</p>
            }

            @if (achievementLines(p).length > 0) {
              <p class="eyebrow">Milestones</p>
              <h2>Progress worth sharing</h2>
              <ul class="achievements">
                @for (achievement of achievementLines(p); track achievement) {
                  <li><mat-icon>workspace_premium</mat-icon><span>{{ achievement }}</span></li>
                }
              </ul>
            }

            @if (points(p).length > 0) {
              <p class="eyebrow">What you get</p>
              <h2>A clear path, not a pitch</h2>
              <ul class="points">
                @for (point of points(p); track point) {
                  <li><mat-icon>check_circle</mat-icon><span>{{ point }}</span></li>
                }
              </ul>
            }

            @if (text(p, 'testimonial'); as quote) {
              <blockquote>
                <p>“{{ quote }}”</p>
                <footer>— {{ p.name }}</footer>
              </blockquote>
            }

            @if (videoUrl(p); as video) {
              <a class="video-card" [href]="video" target="_blank" rel="noopener">
                <span class="video-icon"><mat-icon>play_arrow</mat-icon></span>
                <span>
                  <strong>Watch the video testimonial</strong>
                  <small>{{ videoDomain(video) }}</small>
                </span>
              </a>
            }

            @if (text(p, 'inviteNote'); as note) {
              <div class="invite-note">
                <mat-icon>waving_hand</mat-icon>
                <div>
                  <strong>A note from {{ firstName(p.name) }}</strong>
                  <p>{{ note }}</p>
                </div>
              </div>
            }
          </div>

          <aside class="lead-card" id="lead-form">
            @if (submitted()) {
              <div class="success">
                <mat-icon>check_circle</mat-icon>
                <h2>You're on the list</h2>
                <p>{{ successMessage() }}</p>
                <button mat-stroked-button type="button" (click)="reset()">Send another message</button>
                @if (joinUrl(); as join) {
                  <a mat-flat-button color="primary" [href]="join">Ready now? Join my team</a>
                }
              </div>
            } @else {
              <p class="eyebrow">Say hello</p>
              <h2>Let's start with a conversation.</h2>
              <p class="card-sub">Share your details and {{ firstName(p.name) }} will reach out. No pressure, no spam.</p>

              <form #leadForm="ngForm" (ngSubmit)="submit(leadForm)" class="lead-form">
                <div class="row">
                  <mat-form-field appearance="outline" subscriptSizing="dynamic">
                    <mat-label>First name</mat-label>
                    <input matInput name="name" [(ngModel)]="form.name" required minlength="2" maxlength="80" autocomplete="given-name" />
                  </mat-form-field>
                  <mat-form-field appearance="outline" subscriptSizing="dynamic">
                    <mat-label>Surname</mat-label>
                    <input matInput name="surname" [(ngModel)]="form.surname" maxlength="80" autocomplete="family-name" />
                  </mat-form-field>
                </div>
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>Phone number</mat-label>
                  <input matInput name="phone" [(ngModel)]="form.phone" required minlength="7" maxlength="20" inputmode="tel" autocomplete="tel" />
                </mat-form-field>
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>Email (optional)</mat-label>
                  <input matInput name="email" type="email" [(ngModel)]="form.email" maxlength="254" autocomplete="email" />
                </mat-form-field>
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>State / city (optional)</mat-label>
                  <input matInput name="state" [(ngModel)]="form.state" maxlength="80" autocomplete="address-level1" />
                </mat-form-field>
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>What would you like to change? (optional)</mat-label>
                  <textarea matInput name="message" rows="3" [(ngModel)]="form.message" maxlength="1000"></textarea>
                </mat-form-field>

                <label class="consent">
                  <input type="checkbox" name="consent" [(ngModel)]="form.consent" required />
                  <span>I agree to be contacted about this conversation. My details are shared only with this partner.</span>
                </label>

                @if (formError(); as message) {
                  <p class="form-error" role="alert">{{ message }}</p>
                }

                <button mat-flat-button color="primary" class="submit" type="submit" [disabled]="submitting() || leadForm.invalid">
                  {{ submitting() ? 'Sending…' : 'Send my details' }}
                </button>
                <p class="privacy">Your information is used for this conversation and is not sold.</p>
              </form>
            }
          </aside>
        </section>

        <section class="contact-strip">
          <div>
            <p class="eyebrow">Prefer a direct line?</p>
            <h2>Reach {{ firstName(p.name) }} directly.</h2>
          </div>
          <div class="contact-actions">
            @if (text(p, 'displayPhone'); as phone) {
              <a mat-stroked-button [href]="'tel:' + phone"><mat-icon>call</mat-icon> {{ phone }}</a>
            }
            @if (text(p, 'displayEmail'); as email) {
              <a mat-stroked-button [href]="'mailto:' + email"><mat-icon>mail</mat-icon> Email</a>
            }
            @if (p.store; as store) {
              <a mat-stroked-button [routerLink]="['/', store.slug]"><mat-icon>storefront</mat-icon> Visit store</a>
            }
            @if (joinUrl(); as join) {
              <a mat-flat-button color="primary" [href]="join"><mat-icon>person_add</mat-icon> Join my team</a>
            }
          </div>
        </section>

        @if (socials(p).length > 0) {
          <section class="social-strip">
            <div>
              <p class="eyebrow">Follow the journey</p>
              <h2>More from {{ firstName(p.name) }}</h2>
            </div>
            <div class="social-links">
              @for (social of socials(p); track social.label) {
                <a [href]="social.url" target="_blank" rel="noopener">
                  <mat-icon>{{ social.icon }}</mat-icon>
                  <span>{{ social.label }}</span>
                </a>
              }
            </div>
          </section>
        }

        <footer class="page-footer">
          <span>MarketSpase · independent partner page</span>
          @if (text(p, 'locationDisplay'); as location) { <span>{{ location }}</span> }
        </footer>
      </main>
    }
  `,
  styles: [`
    :host { display: block; min-height: 100vh; background: var(--ms-canvas, #f7f5ef); color: var(--ms-text, #1c1c1c); }
    .loading, .missing { min-height: 60vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1em; padding: 2em; text-align: center; }
    .loading span { width: 34px; height: 34px; border-radius: 50%; border: 3px solid var(--ms-line); border-top-color: var(--ms-primary); animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .missing mat-icon { font-size: 48px; width: 48px; height: 48px; color: var(--ms-text-muted); }
    .lead-page { max-width: 1180px; margin: 0 auto; padding: 0 1.2em 3em; }
    .hero { padding: clamp(3em, 8vw, 6em) 0 3em; }
    .hero-inner { display: grid; grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr); gap: 2.5em; align-items: end; }
    .identity { display: flex; align-items: center; gap: 1em; }
    .avatar { width: 84px; height: 84px; border-radius: 24px; object-fit: cover; box-shadow: 0 14px 34px rgba(0,0,0,0.14); }
    .avatar.initials { display: grid; place-items: center; font-size: 2em; font-weight: 800; color: #fff; background: linear-gradient(145deg, var(--ms-primary), #1f3d2f); }
    .partner-name { margin: 0.35em 0 0; font-weight: 800; font-size: 1.05em; }
    .handle { margin: 0.1em 0 0; color: var(--ms-text-muted); font-size: 0.85em; }
    .role { margin: 0.35em 0 0; color: var(--ms-primary-strong); font-size: 0.8em; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
    .bio-line { margin: 0.45em 0 0; color: var(--ms-text-muted); font-size: 0.86em; line-height: 1.5; max-width: 24em; }
    .tagline { margin: 0.55em 0 0; color: var(--ms-primary-strong); font-size: 0.82em; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.72rem; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; }
    h1 { margin: 0.35em 0 0; font-size: clamp(2.1rem, 5vw, 4rem); line-height: 1.02; letter-spacing: -0.04em; }
    .sub { margin: 0.8em 0 0; font-size: clamp(1rem, 1.6vw, 1.2rem); line-height: 1.6; color: var(--ms-text-muted); max-width: 38em; }
    .hero-actions { display: flex; gap: 0.6em; flex-wrap: wrap; margin-top: 1.3em; }
    .primary-btn, .ghost-btn { display: inline-flex; align-items: center; gap: 0.35em; min-height: 46px; padding: 0 1.1em; border-radius: 999px; text-decoration: none; font-weight: 700; }
    .primary-btn { background: var(--ms-primary); color: #fff; }
    .ghost-btn { border: 1px solid var(--ms-line); color: var(--ms-text); }
    .join-btn { background: var(--ms-primary); border-color: var(--ms-primary); color: #fff; }
    .content-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(340px, 0.75fr); gap: 1.5em; align-items: start; }
    .story { display: flex; flex-direction: column; gap: 1.1em; padding: 1.5em 0; }
    .story h2 { margin: 0.25em 0 0; font-size: clamp(1.4rem, 2.5vw, 2rem); letter-spacing: -0.02em; }
    .story-copy { margin: 0; line-height: 1.75; color: var(--ms-text-muted); white-space: pre-line; max-width: 46em; }
    .points { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.65em; }
    .points li { display: flex; gap: 0.55em; align-items: flex-start; line-height: 1.5; }
    .points mat-icon { color: var(--ms-success); flex: none; }
    .achievements { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.65em; }
    .achievements li { display: flex; gap: 0.55em; align-items: flex-start; padding: 0.8em; border-radius: 12px; background: var(--ms-surface); border: 1px solid var(--ms-line); line-height: 1.45; }
    .achievements mat-icon { color: var(--ms-primary-strong); flex: none; }
    .video-card { display: flex; align-items: center; gap: 0.8em; padding: 1em; border-radius: 16px; background: linear-gradient(135deg, var(--ms-primary), #1f3d2f); color: #fff; text-decoration: none; box-shadow: 0 14px 34px rgba(20, 40, 30, 0.18); }
    .video-card .video-icon { width: 46px; height: 46px; flex: none; display: grid; place-items: center; border-radius: 50%; background: rgba(255,255,255,0.18); }
    .video-card strong { display: block; }
    .video-card small { display: block; margin-top: 0.15em; opacity: 0.75; }
    .invite-note { display: flex; gap: 0.8em; align-items: flex-start; padding: 1em; border-radius: 14px; background: var(--ms-primary-soft); color: var(--ms-text); }
    .invite-note mat-icon { color: var(--ms-primary-strong); flex: none; }
    .invite-note strong { display: block; margin-bottom: 0.2em; }
    .invite-note p { margin: 0; line-height: 1.55; color: var(--ms-text-muted); }
    blockquote { margin: 1em 0 0; padding: 1.2em; border-left: 3px solid var(--ms-primary); background: var(--ms-surface); border-radius: 0 12px 12px 0; }
    blockquote p { margin: 0; font-size: 1.05em; line-height: 1.65; }
    blockquote footer { margin-top: 0.6em; color: var(--ms-text-muted); font-size: 0.82em; }
    .lead-card { position: sticky; top: 1.2em; padding: 1.4em; border-radius: 20px; border: 1px solid var(--ms-line); background: var(--ms-surface); box-shadow: 0 18px 60px rgba(20, 40, 30, 0.1); }
    .lead-card h2 { margin: 0.25em 0 0; font-size: 1.45em; letter-spacing: -0.02em; }
    .card-sub { margin: 0.45em 0 1em; color: var(--ms-text-muted); line-height: 1.55; font-size: 0.9em; }
    .lead-form { display: flex; flex-direction: column; gap: 0.55em; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.55em; }
    .consent { display: flex; gap: 0.55em; align-items: flex-start; color: var(--ms-text-muted); font-size: 0.8em; line-height: 1.5; padding: 0.2em 0 0.5em; }
    .consent input { margin-top: 0.2em; accent-color: var(--ms-primary); }
    .submit { width: 100%; min-height: 48px; }
    .privacy { margin: 0.1em 0 0; text-align: center; color: var(--ms-text-muted); font-size: 0.72em; }
    .form-error { margin: 0; color: var(--ms-error); font-size: 0.82em; }
    .success { display: flex; flex-direction: column; align-items: flex-start; gap: 0.5em; padding: 1em 0; }
    .success mat-icon { color: var(--ms-success); font-size: 42px; width: 42px; height: 42px; }
    .success h2 { margin: 0; }
    .success p { margin: 0; color: var(--ms-text-muted); line-height: 1.55; }
    .contact-strip { margin-top: 1.5em; padding: 1.5em; border-radius: 18px; background: linear-gradient(135deg, var(--ms-primary-soft), var(--ms-surface)); display: flex; justify-content: space-between; gap: 1em; align-items: center; flex-wrap: wrap; }
    .contact-strip h2 { margin: 0.2em 0 0; font-size: 1.35em; }
    .contact-actions { display: flex; gap: 0.5em; flex-wrap: wrap; }
    .contact-actions mat-icon { margin-right: 0.25em; }
    .social-strip { margin-top: 1.5em; padding: 1.5em; border-radius: 18px; border: 1px solid var(--ms-line); background: var(--ms-surface); display: flex; justify-content: space-between; gap: 1em; align-items: center; flex-wrap: wrap; }
    .social-strip h2 { margin: 0.2em 0 0; font-size: 1.35em; }
    .social-links { display: flex; gap: 0.45em; flex-wrap: wrap; }
    .social-links a { display: inline-flex; align-items: center; gap: 0.3em; padding: 0.5em 0.8em; border-radius: 999px; border: 1px solid var(--ms-line); color: var(--ms-text); text-decoration: none; font-size: 0.82em; font-weight: 700; }
    .social-links a:hover { border-color: var(--ms-primary); color: var(--ms-primary-strong); }
    .social-links mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .page-footer { display: flex; justify-content: space-between; gap: 1em; flex-wrap: wrap; padding-top: 1.5em; color: var(--ms-text-muted); font-size: 0.75em; }
    @media (max-width: 900px) {
      .hero-inner, .content-grid { grid-template-columns: 1fr; }
      .hero { padding-top: 2.2em; }
      .lead-card { position: static; }
    }
    @media (max-width: 520px) {
      .row { grid-template-columns: 1fr; }
      .avatar { width: 64px; height: 64px; border-radius: 18px; }
    }
  `],
})
export class PersonalLeadPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(StoreService);
  private readonly title = inject(Title);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly page = signal<PublicLeadPage | null>(null);
  protected readonly submitting = signal(false);
  protected readonly submitted = signal(false);
  protected readonly successMessage = signal('');
  protected readonly formError = signal<string | null>(null);

  protected readonly form = {
    name: '',
    surname: '',
    phone: '',
    email: '',
    state: '',
    message: '',
    consent: false,
  };

  ngOnInit(): void {
    const username = String(this.route.snapshot.paramMap.get('username') ?? '').trim();
    if (!username) {
      this.error.set('This page link is incomplete.');
      this.loading.set(false);
      return;
    }
    this.store.publicLeadPage(username).subscribe({
      next: (res) => {
        this.page.set(res.data);
        this.title.setTitle(`${res.data.name} · MarketSpase`);
        this.loading.set(false);
        if (typeof window !== 'undefined' && window.location.hash === '#lead-form') {
          setTimeout(() => scrollToSection(null, 'lead-form', 'instant'), 0);
        }
      },
      error: (err: unknown) => {
        this.error.set(storeError(err));
        this.loading.set(false);
      },
    });
  }

  protected scrollToForm(event: Event): void {
    scrollToSection(event, 'lead-form');
  }

  protected submit(form: NgForm): void {
    const page = this.page();
    if (!page || this.submitting()) return;
    if (form.invalid || !this.form.consent) {
      form.control.markAllAsTouched();
      if (!this.form.consent) this.formError.set('Please agree to be contacted.');
      return;
    }
    this.submitting.set(true);
    this.formError.set(null);
    this.store.submitPublicLead(page.username, {
      name: this.form.name,
      surname: this.form.surname,
      phone: this.form.phone,
      email: this.form.email,
      state: this.form.state,
      message: this.form.message,
    }).pipe(finalize(() => this.submitting.set(false))).subscribe({
      next: (res) => {
        this.submitted.set(true);
        this.successMessage.set(res.message ?? 'Your details are with the team.');
      },
      error: (err: unknown) => this.formError.set(storeError(err)),
    });
  }

  protected reset(): void {
    this.submitted.set(false);
    this.successMessage.set('');
    this.formError.set(null);
    this.form.name = '';
    this.form.surname = '';
    this.form.phone = '';
    this.form.email = '';
    this.form.state = '';
    this.form.message = '';
    this.form.consent = false;
  }

  protected text(page: PublicLeadPage, key: string): string {
    const value = page.landing?.[key];
    return Array.isArray(value) ? value.join(', ') : String(value ?? '').trim();
  }

  protected points(page: PublicLeadPage): string[] {
    const value = page.landing?.['opportunityPoints'];
    return Array.isArray(value) ? value.map((v) => String(v).trim()).filter(Boolean).slice(0, 8) : [];
  }

  protected achievementLines(page: PublicLeadPage): string[] {
    const raw = this.text(page, 'achievements');
    if (!raw) return [];
    return raw
      .split(/\r?\n|;/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 8);
  }

  protected videoUrl(page: PublicLeadPage): string | null {
    const url = this.text(page, 'videoTestimonialUrl');
    return /^https?:\/\//i.test(url) ? url : null;
  }

  protected videoDomain(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return 'Video testimonial';
    }
  }

  protected groupUrl(): string | null {
    const page = this.page();
    if (!page) return null;
    const group = this.text(page, 'whatsappGroupLink');
    return /^https?:\/\//i.test(group) ? group : null;
  }

  protected joinUrl(): string | null {
    const page = this.page();
    if (!page?.username) return null;
    const base = String((environment as { platformUrl?: string }).platformUrl ?? '').replace(/\/+$/, '');
    if (!base) return null;
    return `${base}/join?ref=${encodeURIComponent(page.username)}`;
  }

  protected socials(page: PublicLeadPage): Array<{ label: string; url: string; icon: string }> {
    const links: Array<{ key: string; label: string; icon: string }> = [
      { key: 'facebookPage', label: 'Facebook', icon: 'public' },
      { key: 'instagramPage', label: 'Instagram', icon: 'photo_camera' },
      { key: 'tiktokPage', label: 'TikTok', icon: 'music_note' },
      { key: 'twitterPage', label: 'X', icon: 'alternate_email' },
      { key: 'linkedinPage', label: 'LinkedIn', icon: 'work' },
      { key: 'youtubePage', label: 'YouTube', icon: 'play_circle' },
    ];
    return links
      .map(({ key, label, icon }) => ({ label, icon, url: this.text(page, key) }))
      .filter((link) => /^https?:\/\//i.test(link.url));
  }

  protected image(value: string): string {
    return storeAssetUrl(value);
  }

  protected initial(name: string): string {
    return String(name ?? 'M').trim().charAt(0).toUpperCase();
  }

  protected firstName(name: string): string {
    return String(name ?? '').trim().split(/\s+/)[0] || 'your host';
  }

  protected whatsappUrl(): string | null {
    const page = this.page();
    if (!page) return null;
    const direct = this.text(page, 'whatsappChatLink');
    if (direct && /^https?:\/\//i.test(direct)) return direct;
    const phone = this.text(page, 'displayPhone');
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '').replace(/^0/, '234');
    return digits ? `https://wa.me/${digits}` : null;
  }
}
