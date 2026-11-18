import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ApiError, userError } from '../../../core/http/api-error';
import { SmsService } from '../../../core/sms/sms.service';
import {
  SmsCampaign,
  SmsCampaignDetail,
  SmsQuote,
  SmsRecipientItem,
  SmsSuggestion,
  SmsSuppression,
  SmsTemplate,
} from '../../../core/sms/sms.models';

type Tab = 'compose' | 'history' | 'templates' | 'optouts';
type RecipientType = 'prospects' | 'partners' | 'customer_leads';

const PRICE_PER_PAGE = 10;
const RECIPIENT_PAGE_SIZE = 50;

@Component({
  selector: 'async-sms-center',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe, DatePipe, FormsModule, MatButtonModule, MatCheckboxModule, MatFormFieldModule,
    MatIconModule, MatInputModule, MatProgressBarModule, MatSelectModule, MatSnackBarModule, RouterModule,
  ],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a routerLink="/dashboard/messages">Messages</a> &gt;
        <span>SMS Center</span>
      </div>
    </section>

    <section class="sms-page">
      <header class="page-head">
        <div>
          <p class="eyebrow">MESSAGES · DIRECT OUTREACH</p>
          <h1>SMS Center</h1>
          <p class="subtitle">Send a personal text to a prospect, store customer, or your direct team. Ora drafts it from their current activity; you review and send.</p>
        </div>
        <div class="wallet-chip">
          <span>Wallet</span>
          <strong>{{ walletBalance() | currency:'NGN':'symbol-narrow':'1.0-2' }}</strong>
          <a mat-button routerLink="/dashboard/wallet/deposit">Top up</a>
        </div>
      </header>

      <nav class="tabs" aria-label="SMS sections">
        @for (item of tabs; track item.key) {
          <button type="button" [class.active]="tab() === item.key" [attr.aria-pressed]="tab() === item.key" (click)="setTab(item.key)">
            <mat-icon aria-hidden="true">{{ item.icon }}</mat-icon>
            {{ item.label }}
          </button>
        }
      </nav>

      @if (tab() === 'compose') {
        <div class="compose-grid">
          <section class="panel recipients-panel">
            <div class="panel-head">
              <div><p class="eyebrow">Step 1</p><h2>Choose recipients</h2></div>
              <span class="count-chip">{{ selected().length }} selected</span>
            </div>

            <div class="type-toggle" role="group" aria-label="Recipient type">
              <button type="button" [class.active]="recipientType() === 'prospects'" [attr.aria-pressed]="recipientType() === 'prospects'" (click)="setType('prospects')">Prospects</button>
              <button type="button" [class.active]="recipientType() === 'partners'" [attr.aria-pressed]="recipientType() === 'partners'" (click)="setType('partners')">Partners</button>
              <button type="button" [class.active]="recipientType() === 'customer_leads'" [attr.aria-pressed]="recipientType() === 'customer_leads'" (click)="setType('customer_leads')">Customers</button>
            </div>

            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="search">
              <mat-icon matPrefix>search</mat-icon>
              <mat-label>Search name, username or phone</mat-label>
              <input matInput type="search" [value]="query()" (input)="onSearch($any($event.target).value)" />
            </mat-form-field>

            @if (loadingRecipients()) {
              <mat-progress-bar mode="indeterminate" aria-label="Loading recipients" />
            }
            @if (error(); as err) {
              <p class="error" role="alert">{{ err }} <button mat-button type="button" (click)="loadRecipients()">Retry</button></p>
            }

            <p class="results-meta" role="status">Showing {{ recipients().length }} of {{ recipientTotal() }} {{ typeNoun() }}</p>

            <ul class="recipient-list">
              @for (item of visibleRecipients(); track item.type + item.id) {
                <li class="recipient" [class.disabled]="!item.eligible">
                  <mat-checkbox
                    [checked]="isSelected(item)"
                    [disabled]="!item.eligible"
                    (change)="toggleRecipient(item, $event.checked)"
                    [attr.aria-label]="'Select ' + item.name" />
                  <div class="recipient-copy">
                    <strong>{{ item.name }}</strong>
                    <span>{{ item.phoneMasked }} @if (item.username) { · &#64;{{ item.username }} }</span>
                    @if (!item.eligible) { <small class="reason">{{ item.reason }}</small> }
                  </div>
                  <span class="type-pill">{{ typeLabel(item.type) }}</span>
                </li>
              } @empty {
                <li class="empty-row">No {{ typeNoun() }} found.</li>
              }
            </ul>

            @if (recipientHasMore()) {
              <div class="load-more">
                @if (loadingMore()) { <mat-progress-bar mode="indeterminate" aria-label="Loading more recipients" /> }
                <button mat-stroked-button type="button" (click)="loadMore()" [disabled]="loadingMore()">
                  <mat-icon aria-hidden="true">expand_more</mat-icon>
                  {{ loadingMore() ? 'Loading…' : 'Load more' }}
                </button>
              </div>
            }

            @if (selected().length > 0) {
              <div class="selected-tray">
                @for (item of selected(); track item.id) {
                  <button type="button" class="selected-chip" (click)="toggleRecipient(item, false)">
                    {{ item.name }} <mat-icon aria-hidden="true">close</mat-icon>
                  </button>
                }
                <button mat-button type="button" (click)="clearSelection()">Clear all</button>
              </div>
            }
          </section>

          <section class="panel composer-panel">
            <div class="panel-head">
              <div><p class="eyebrow">Step 2</p><h2>Write with Ora</h2></div>
              @if (suggestLoading()) { <span class="muted">Ora is reading the activity…</span> }
            </div>

            @if (suggestions().length > 0) {
              <div class="suggestions" aria-label="Ora message suggestions">
                <p class="suggest-label"><mat-icon aria-hidden="true">auto_awesome</mat-icon> Ora suggests, based on {{ suggestionName() }}’s activity</p>
                @for (s of suggestions(); track s.body) {
                  <button type="button" class="suggestion" (click)="useSuggestion(s)">
                    <span>{{ s.label }}</span>
                    <small>{{ s.body }}</small>
                  </button>
                }
              </div>
            }

            <mat-form-field appearance="outline" class="message-field">
              <mat-label>Message</mat-label>
              <textarea matInput rows="6" maxlength="459" [value]="body()" (input)="onBody($any($event.target).value)" placeholder="Write a short, personal message…"></textarea>
              <mat-hint align="end">{{ body().length }}/459</mat-hint>
            </mat-form-field>

            <div class="message-meta">
              <span>{{ pages() }} page{{ pages() === 1 ? '' : 's' }} · personalisation included</span>
              <span>{{ selected().length }} recipient{{ selected().length === 1 ? '' : 's' }}</span>
              @if (quoteLoading()) { <span class="muted">Checking price…</span> }
              <strong>{{ estimatedCost() | currency:'NGN':'symbol-narrow':'1.0-2' }}</strong>
            </div>

            <div class="quick-row">
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="template-field">
                <mat-label>Use a template</mat-label>
                <mat-select (selectionChange)="applyTemplate($event.value)">
                  @for (t of templates(); track t.id) {
                    <mat-option [value]="t">{{ t.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <button mat-stroked-button type="button" (click)="tab.set('templates')">Manage templates</button>
            </div>

            <div class="tokens">
              <span>Insert:</span>
              @for (token of tokens; track token) {
                <button type="button" (click)="insertToken(token)">{{ token }}</button>
              }
            </div>

            <div class="schedule-row">
              <mat-checkbox [checked]="scheduleEnabled()" (change)="scheduleEnabled.set($event.checked)">Schedule for later</mat-checkbox>
              @if (scheduleEnabled()) {
                <input class="date-input" type="datetime-local" [value]="scheduledAt()" (input)="scheduledAt.set($any($event.target).value)" aria-label="Schedule date and time" />
              }
            </div>

            @if (quoteError(); as err) {
              <p class="error" role="alert">Price check failed: {{ err }} <button mat-button type="button" (click)="refreshQuote()">Retry</button></p>
            }

            @if (ineligible().length > 0) {
              <div class="ineligible" role="status">
                <p><mat-icon aria-hidden="true">info</mat-icon> {{ ineligible().length }} selected contact{{ ineligible().length === 1 ? '' : 's' }} will be skipped</p>
                <ul>
                  @for (row of ineligible(); track row.type + row.id) {
                    <li><strong>{{ row.name }}</strong> — {{ row.reason }}</li>
                  }
                </ul>
              </div>
            }

            @if (previews().length > 0) {
              <details class="previews">
                <summary>Preview as sent</summary>
                @for (p of previews(); track p.name + p.phoneMasked) {
                  <article>
                    <strong>{{ p.name }} · {{ p.phoneMasked }}</strong>
                    <p>{{ p.body }}</p>
                  </article>
                }
              </details>
            }

            <div class="review" [class.review--warn]="selected().length === 0 || overBudget() || scheduleInvalid()">
              <div>
                <span>Estimated charge</span>
                <strong>{{ estimatedCost() | currency:'NGN':'symbol-narrow':'1.0-2' }}</strong>
                <small>{{ pages() }} page{{ pages() === 1 ? '' : 's' }} max · ₦{{ pricePerPage }}/page · {{ quote()?.recipients ?? selected().length }} recipient{{ (quote()?.recipients ?? selected().length) === 1 ? '' : 's' }}</small>
              </div>
              @if (overBudget()) {
                <p>Your wallet is short by {{ shortfall() | currency:'NGN':'symbol-narrow':'1.0-2' }}. <a routerLink="/dashboard/wallet/deposit">Top up</a></p>
              }
              @if (scheduleInvalid()) {
                <p>Choose a date and time in the future to schedule this SMS.</p>
              }
              @if (notice(); as note) { <p class="notice">{{ note }}</p> }
              @if (sendError(); as err) { <p class="error" role="alert">{{ err }}</p> }
              <button mat-flat-button color="primary" type="button" [disabled]="!canSend()" (click)="send()">
                <mat-icon aria-hidden="true">send</mat-icon>
                {{ sending() ? 'Sending…' : (scheduleEnabled() ? 'Schedule SMS' : 'Send SMS') }}
              </button>
            </div>
          </section>
        </div>
      }

      @if (tab() === 'history') {
        <section class="panel">
          <div class="panel-head">
            <div><p class="eyebrow">Delivery</p><h2>SMS history</h2></div>
            <button mat-stroked-button type="button" (click)="loadHistory()">Refresh</button>
          </div>
          @if (historyLoading()) { <mat-progress-bar mode="indeterminate" aria-label="Loading SMS history" /> }
          @if (historyError(); as err) { <p class="error" role="alert">{{ err }}</p> }
          <div class="history-list">
            @for (row of history(); track row.id) {
              <article class="history-row">
                <div class="history-main">
                  <strong>{{ row.body }}</strong>
                  <span>{{ row.createdAt | date:'medium' }} · {{ row.recipientCount }} recipients · {{ row.pages }} page{{ row.pages === 1 ? '' : 's' }}</span>
                  @if (row.refundedAmount > 0) {
                    <small class="refund">{{ row.refundedAmount | currency:'NGN':'symbol-narrow':'1.0-2' }} refunded</small>
                  }
                </div>
                <span class="status status--{{ row.status }}">{{ statusLabel(row.status) }}</span>
                <strong class="history-cost">{{ row.totalCost | currency:'NGN':'symbol-narrow':'1.0-2' }}</strong>
                <button mat-button type="button" (click)="openCampaign(row.id)">Details</button>
              </article>
            } @empty {
              <p class="empty-row">No SMS campaigns yet.</p>
            }
          </div>

          @if (activeCampaign(); as campaign) {
            <div class="detail-card">
              <div class="panel-head">
                <div><p class="eyebrow">Campaign detail</p><h3>{{ campaign.body }}</h3></div>
                <button mat-icon-button type="button" (click)="activeCampaign.set(null)" aria-label="Close details"><mat-icon>close</mat-icon></button>
              </div>
              <p class="muted">{{ campaign.createdAt | date:'medium' }} · {{ campaign.sentCount }}/{{ campaign.recipientCount }} accepted · {{ campaign.totalCost | currency:'NGN':'symbol-narrow':'1.0-2' }}</p>
              <ul class="recipient-statuses">
                @for (r of campaign.recipients; track r.id) {
                  <li><span>{{ r.name }}</span><span>{{ r.phoneMasked }}</span><span class="status status--{{ r.status }}">{{ r.status }}</span></li>
                }
              </ul>
              <div class="detail-actions">
                @if (campaign.status === 'scheduled') {
                  <button mat-stroked-button type="button" (click)="cancelCampaign(campaign)">Cancel & refund</button>
                }
                @if (campaign.status === 'failed' || campaign.status === 'partial') {
                  <button mat-flat-button color="primary" type="button" (click)="retryCampaign(campaign)">Retry failed</button>
                }
              </div>
            </div>
          }
        </section>
      }

      @if (tab() === 'templates') {
        <section class="panel">
          <div class="panel-head"><div><p class="eyebrow">Reusable words</p><h2>SMS templates</h2></div></div>
          <div class="template-grid">
            @for (t of templates(); track t.id) {
              <article class="template-card">
                <div class="template-head"><strong>{{ t.name }}</strong>@if (t.system) { <span class="type-pill">System</span> }</div>
                <p>{{ t.body }}</p>
                <div class="template-actions">
                  <button mat-button type="button" (click)="useTemplateAndCompose(t)">Use</button>
                  @if (!t.system) { <button mat-button color="warn" type="button" (click)="deleteTemplate(t)">Delete</button> }
                </div>
              </article>
            }
          </div>
          <div class="template-form">
            <h3>Create a template</h3>
            <mat-form-field appearance="outline"><mat-label>Template name</mat-label><input matInput [value]="templateName()" (input)="templateName.set($any($event.target).value)" maxlength="80" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Message</mat-label><textarea matInput rows="3" maxlength="459" [value]="templateBody()" (input)="templateBody.set($any($event.target).value)"></textarea></mat-form-field>
            <button mat-flat-button color="primary" type="button" (click)="createTemplate()">Save template</button>
          </div>
        </section>
      }

      @if (tab() === 'optouts') {
        <section class="panel">
          <div class="panel-head">
            <div><p class="eyebrow">Respect the no</p><h2>SMS opt-outs</h2></div>
            <span class="count-chip">{{ optouts().length }} numbers</span>
          </div>
          <p class="muted">Numbers on this list are excluded from every SMS campaign automatically.</p>
          <div class="optout-form">
            <mat-form-field appearance="outline"><mat-label>Phone number</mat-label><input matInput type="tel" [value]="optoutPhone()" (input)="optoutPhone.set($any($event.target).value)" placeholder="0803 123 4567" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Reason (optional)</mat-label><input matInput [value]="optoutReason()" (input)="optoutReason.set($any($event.target).value)" maxlength="200" /></mat-form-field>
            <button mat-flat-button color="primary" type="button" (click)="addOptout()">Add opt-out</button>
          </div>
          <ul class="optout-list">
            @for (row of optouts(); track row.id) {
              <li><div><strong>{{ row.maskedPhone }}</strong><span>{{ row.reason }} · {{ row.createdAt | date:'mediumDate' }}</span></div><button mat-button type="button" (click)="removeOptout(row)">Remove</button></li>
            } @empty { <li class="empty-row">No opt-outs yet.</li> }
          </ul>
        </section>
      }
    </section>
  `,
  styles: [`
    .sms-page { display: flex; flex-direction: column; gap: 16px; padding-bottom: 24px; }
    .page-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
    .page-head h1 { margin: 2px 0 6px; font-size: clamp(1.8rem, 3vw, 2.4rem); letter-spacing: -0.03em; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.68rem; font-weight: 800; letter-spacing: 0.13em; text-transform: uppercase; }
    .subtitle { margin: 0; max-width: 62em; color: var(--ms-text-muted); line-height: 1.55; }
    .wallet-chip { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid var(--ms-line); border-radius: 999px; background: var(--ms-surface); }
    .wallet-chip > span { color: var(--ms-text-muted); font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
    .wallet-chip strong { font-variant-numeric: tabular-nums; }
    .wallet-chip a { min-height: 36px; }
    .tabs { display: flex; gap: 4px; flex-wrap: wrap; padding: 4px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); background: var(--ms-surface); width: fit-content; max-width: 100%; }
    .tabs button { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 14px; border: 0; border-radius: var(--ms-radius-md); background: transparent; color: var(--ms-text-muted); font: inherit; font-size: 0.84rem; font-weight: 700; cursor: pointer; }
    .tabs button.active { background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .tabs mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .compose-grid { display: grid; grid-template-columns: minmax(280px, 0.8fr) minmax(0, 1.2fr); gap: 16px; align-items: start; }
    .panel { min-width: 0; padding: 18px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); background: var(--ms-surface); box-shadow: var(--ms-shadow-sm); }
    .panel-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
    .panel-head h2, .panel-head h3 { margin: 2px 0 0; font-size: 1.1rem; }
    .count-chip, .type-pill { display: inline-flex; align-items: center; padding: 3px 9px; border-radius: 999px; background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-size: 0.68rem; font-weight: 800; text-transform: capitalize; white-space: nowrap; }
    .type-toggle { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; padding: 3px; border: 1px solid var(--ms-line); border-radius: 999px; background: var(--ms-canvas); margin-bottom: 10px; }
    .type-toggle button { min-height: 40px; border: 0; border-radius: 999px; background: transparent; color: var(--ms-text-muted); font: inherit; font-weight: 700; cursor: pointer; }
    .type-toggle button.active { background: var(--ms-surface); color: var(--ms-primary-strong); box-shadow: var(--ms-shadow-sm); }
    .search { width: 100%; }
    .results-meta { margin: 2px 0 0; color: var(--ms-text-muted); font-size: 0.72rem; }
    .recipient-list { list-style: none; margin: 8px 0 0; padding: 0; max-height: 390px; overflow-y: auto; display: flex; flex-direction: column; }
    .recipient { display: flex; align-items: center; gap: 8px; padding: 9px 2px; border-top: 1px solid var(--ms-line); min-width: 0; }
    .recipient:first-child { border-top: none; }
    .recipient.disabled { opacity: 0.6; }
    .recipient-copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .recipient-copy strong, .recipient-copy span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .recipient-copy strong { font-size: 0.9rem; }
    .recipient-copy span, .recipient-copy small { color: var(--ms-text-muted); font-size: 0.75rem; }
    .recipient-copy .reason { color: var(--ms-warning); }
    .selected-tray { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 10px; max-height: 120px; overflow-y: auto; }
    .load-more { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
    .load-more button { min-height: 44px; width: 100%; }
    .load-more button mat-icon { margin-right: 4px; }
    .selected-chip { display: inline-flex; align-items: center; gap: 4px; min-height: 36px; padding: 0 8px; border: 1px solid var(--ms-line); border-radius: 999px; background: var(--ms-canvas); color: var(--ms-text); font: inherit; font-size: 0.74rem; font-weight: 700; cursor: pointer; }
    .selected-chip mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .suggestions { display: flex; flex-direction: column; gap: 6px; padding: 10px; border: 1px solid var(--ms-primary); border-radius: var(--ms-radius-lg); background: var(--ms-primary-soft); margin-bottom: 10px; }
    .suggest-label { display: flex; align-items: center; gap: 5px; margin: 0 0 2px; color: var(--ms-primary-strong); font-size: 0.72rem; font-weight: 800; }
    .suggest-label mat-icon { font-size: 17px; width: 17px; height: 17px; }
    .suggestion { display: flex; flex-direction: column; gap: 2px; padding: 8px 10px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-md); background: var(--ms-surface); text-align: left; font: inherit; cursor: pointer; }
    .suggestion > span { font-size: 0.78rem; font-weight: 800; color: var(--ms-primary-strong); }
    .suggestion small { color: var(--ms-text-muted); font-size: 0.74rem; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .message-field { width: 100%; }
    .message-meta { display: flex; gap: 8px 14px; flex-wrap: wrap; align-items: baseline; color: var(--ms-text-muted); font-size: 0.76rem; margin-top: -4px; }
    .message-meta strong { margin-left: auto; color: var(--ms-text); font-size: 0.95rem; }
    .quick-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
    .template-field { flex: 1; min-width: 180px; }
    .tokens { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; color: var(--ms-text-muted); font-size: 0.72rem; }
    .tokens button { min-height: 30px; padding: 0 7px; border: 1px solid var(--ms-line); border-radius: 6px; background: var(--ms-canvas); color: var(--ms-primary-strong); font: inherit; font-size: 0.68rem; font-weight: 700; cursor: pointer; }
    .schedule-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 8px; }
    .date-input { min-height: 44px; padding: 0 10px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-md); background: var(--ms-surface); color: var(--ms-text); font: inherit; }
    .review { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; padding: 12px; border-radius: var(--ms-radius-lg); background: var(--ms-canvas); border: 1px solid var(--ms-line); }
    .review > div { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
    .review span { color: var(--ms-text-muted); font-size: 0.75rem; font-weight: 700; }
    .review strong { font-size: 1.2rem; }
    .review small { color: var(--ms-text-muted); }
    .review--warn { border-color: var(--ms-warning); background: var(--ms-warning-soft); }
    .review button { min-height: 44px; }
    .review p { margin: 0; }
    .notice { color: var(--ms-success); }
    .error { color: var(--ms-error); }
    .ineligible { padding: 10px 12px; border: 1px solid var(--ms-warning); border-radius: var(--ms-radius-md); background: var(--ms-warning-soft); margin-top: 10px; }
    .ineligible p { display: flex; align-items: center; gap: 5px; margin: 0 0 4px; color: var(--ms-warning); font-size: 0.78rem; font-weight: 800; }
    .ineligible p mat-icon { font-size: 17px; width: 17px; height: 17px; }
    .ineligible ul { margin: 0; padding-left: 18px; color: var(--ms-text-muted); font-size: 0.76rem; line-height: 1.5; }
    .ineligible strong { color: var(--ms-text); }
    .previews { margin-top: 10px; padding: 8px 10px; border: 1px dashed var(--ms-line); border-radius: var(--ms-radius-md); background: var(--ms-canvas); }
    .previews summary { color: var(--ms-primary-strong); font-size: 0.76rem; font-weight: 800; cursor: pointer; }
    .previews article { padding-top: 8px; margin-top: 8px; border-top: 1px solid var(--ms-line); }
    .previews strong { display: block; font-size: 0.72rem; color: var(--ms-text-muted); }
    .previews p { margin: 3px 0 0; font-size: 0.8rem; line-height: 1.45; }
    .muted { color: var(--ms-text-muted); font-size: 0.8rem; }
    .history-list { display: flex; flex-direction: column; }
    .history-row { display: flex; align-items: center; gap: 10px; padding: 11px 0; border-top: 1px solid var(--ms-line); flex-wrap: wrap; }
    .history-row:first-child { border-top: none; }
    .history-main { flex: 1; min-width: 180px; display: flex; flex-direction: column; gap: 2px; }
    .history-main strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .history-main span { color: var(--ms-text-muted); font-size: 0.75rem; }
    .history-main .refund { color: var(--ms-success); font-size: 0.72rem; font-weight: 700; }
    .history-cost { font-variant-numeric: tabular-nums; }
    .status { display: inline-flex; padding: 3px 8px; border-radius: 999px; background: var(--ms-canvas); color: var(--ms-text-muted); font-size: 0.68rem; font-weight: 800; text-transform: capitalize; white-space: nowrap; }
    .status--sent { background: var(--ms-success-soft); color: var(--ms-success); }
    .status--scheduled, .status--sending { background: var(--ms-info-soft); color: var(--ms-primary-strong); }
    .status--partial { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .status--failed, .status--cancelled { background: var(--ms-error-soft); color: var(--ms-error); }
    .detail-card { margin-top: 14px; padding: 14px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); background: var(--ms-canvas); }
    .recipient-statuses { list-style: none; margin: 10px 0 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
    .recipient-statuses li { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 8px; align-items: center; padding: 5px 0; border-top: 1px solid var(--ms-line); font-size: 0.78rem; }
    .detail-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
    .template-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr)); gap: 10px; }
    .template-card { display: flex; flex-direction: column; gap: 8px; padding: 12px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-md); background: var(--ms-canvas); }
    .template-head { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
    .template-card p { margin: 0; color: var(--ms-text-muted); font-size: 0.8rem; line-height: 1.45; }
    .template-actions { display: flex; gap: 4px; margin-top: auto; }
    .template-form { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--ms-line); }
    .template-form h3 { margin: 0; }
    .optout-form { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
    .optout-form mat-form-field { flex: 1; min-width: 180px; }
    .optout-form button { min-height: 44px; }
    .optout-list { list-style: none; margin: 12px 0 0; padding: 0; display: flex; flex-direction: column; }
    .optout-list li { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 9px 0; border-top: 1px solid var(--ms-line); flex-wrap: wrap; }
    .optout-list div { display: flex; flex-direction: column; gap: 1px; }
    .optout-list span { color: var(--ms-text-muted); font-size: 0.74rem; }
    .empty-row { padding: 16px 0; color: var(--ms-text-muted); font-size: 0.8rem; }
    @media (max-width: 900px) {
      .compose-grid { grid-template-columns: minmax(0, 1fr); }
      .recipient-list { max-height: 320px; }
    }
    @media (max-width: 600px) {
      .page-head { flex-direction: column; }
      .wallet-chip { width: 100%; justify-content: space-between; }
      .tabs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 2px; width: 100%; }
      .tabs button { flex-direction: column; gap: 2px; min-height: 56px; padding: 6px 2px; font-size: 0.7rem; }
      .panel { padding: 14px; }
      .review > div { width: 100%; }
      .review button { width: 100%; }
      .history-row { align-items: flex-start; }
      .history-cost { margin-left: auto; }
    }
  `],
})
export class SmsCenterComponent implements OnInit {
  private readonly sms = inject(SmsService);
  private readonly route = inject(ActivatedRoute);
  private readonly snack = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly tabs: Array<{ key: Tab; label: string; icon: string }> = [
    { key: 'compose', label: 'Compose', icon: 'edit' },
    { key: 'history', label: 'History', icon: 'history' },
    { key: 'templates', label: 'Templates', icon: 'description' },
    { key: 'optouts', label: 'Opt-outs', icon: 'block' },
  ];
  protected readonly tokens = ['{{first_name}}', '{{my_name}}', '{{lead_page}}', '{{store_link}}'];
  protected readonly pricePerPage = PRICE_PER_PAGE;
  protected readonly tab = signal<Tab>('compose');
  protected readonly recipientType = signal<RecipientType>('prospects');
  protected readonly query = signal('');
  protected readonly recipients = signal<SmsRecipientItem[]>([]);
  protected readonly selected = signal<SmsRecipientItem[]>([]);
  protected readonly loadingRecipients = signal(false);
  protected readonly loadingMore = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly recipientTotal = signal(0);
  protected readonly recipientHasMore = signal(false);
  protected readonly walletBalance = signal(0);
  protected readonly suggestions = signal<SmsSuggestion[]>([]);
  protected readonly suggestionName = signal('this contact');
  protected readonly suggestLoading = signal(false);
  protected readonly body = signal('');
  protected readonly templates = signal<SmsTemplate[]>([]);
  protected readonly scheduleEnabled = signal(false);
  protected readonly scheduledAt = signal('');
  protected readonly sending = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly sendError = signal<string | null>(null);
  protected readonly quote = signal<SmsQuote | null>(null);
  protected readonly quoteLoading = signal(false);
  protected readonly quoteError = signal<string | null>(null);
  protected readonly history = signal<SmsCampaign[]>([]);
  protected readonly historyLoading = signal(false);
  protected readonly historyError = signal<string | null>(null);
  protected readonly activeCampaign = signal<SmsCampaignDetail | null>(null);
  protected readonly optouts = signal<SmsSuppression[]>([]);
  protected readonly optoutPhone = signal('');
  protected readonly optoutReason = signal('');
  protected readonly templateName = signal('');
  protected readonly templateBody = signal('');
  private suggestTimer: ReturnType<typeof setTimeout> | null = null;
  private quoteTimer: ReturnType<typeof setTimeout> | null = null;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private quoteRequest = 0;
  private lastQuery = '';

  protected readonly visibleRecipients = computed(() => this.recipients());
  protected readonly pages = computed(() => this.quote()?.pages ?? Math.max(1, Math.ceil(this.body().trim().length / 160)));
  protected readonly estimatedCost = computed(() => {
    if (this.body().trim().length < 3) return 0;
    return this.quote()?.cost ?? this.selected().length * this.pages() * PRICE_PER_PAGE;
  });
  protected readonly ineligible = computed(() => this.quote()?.ineligible ?? []);
  protected readonly previews = computed(() => this.quote()?.previews ?? []);
  protected readonly overBudget = computed(() => {
    const quote = this.quote();
    return quote ? quote.shortfall > 0 : this.estimatedCost() > this.walletBalance();
  });
  protected readonly shortfall = computed(() => {
    const quote = this.quote();
    return quote ? quote.shortfall : Math.max(0, this.estimatedCost() - this.walletBalance());
  });
  protected readonly scheduleInvalid = computed(() => {
    if (!this.scheduleEnabled()) return false;
    const value = this.scheduledAt();
    if (!value) return true;
    const at = new Date(value).getTime();
    return !Number.isFinite(at) || at <= Date.now();
  });
  protected readonly canSend = computed(() =>
    this.selected().length > 0
    && this.body().trim().length >= 3
    && !this.sending()
    && !this.quoteLoading()
    && !this.scheduleInvalid()
    && !this.overBudget());

  ngOnInit(): void {
    this.loadTemplates();
    this.loadOptouts();
    this.loadHistory();
    const prospect = String(this.route.snapshot.queryParamMap.get('prospect') ?? '').trim();
    const partner = String(this.route.snapshot.queryParamMap.get('partner') ?? '').trim();
    const customerLead = String(this.route.snapshot.queryParamMap.get('customerLead') ?? '').trim();
    if (customerLead) {
      this.recipientType.set('customer_leads');
      this.loadRecipients(customerLead);
    } else if (partner) {
      this.recipientType.set('partners');
      this.loadRecipients(partner);
    } else if (prospect) {
      this.loadRecipients(prospect);
    } else {
      this.loadRecipients();
    }
  }

  protected setTab(tab: Tab): void {
    this.tab.set(tab);
    if (tab === 'history') this.loadHistory();
    if (tab === 'templates') this.loadTemplates();
    if (tab === 'optouts') this.loadOptouts();
  }

  protected setType(type: RecipientType): void {
    if (this.recipientType() === type) return;
    this.recipientType.set(type);
    this.selected.set([]);
    this.suggestions.set([]);
    this.query.set('');
    this.lastQuery = '';
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
    this.scheduleQuote();
    this.loadRecipients();
  }

  protected loadRecipients(preselectId = '', append = false): void {
    const skip = append ? this.recipients().length : 0;
    if (append) this.loadingMore.set(true);
    else this.loadingRecipients.set(true);
    this.error.set(null);
    this.sms.recipients(this.recipientType(), this.lastQuery, {
      limit: RECIPIENT_PAGE_SIZE,
      skip,
    }).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const items = res.data?.items ?? [];
          if (append) {
            this.recipients.update((rows) => {
              const seen = new Set(rows.map((row) => `${row.type}:${row.id}`));
              return [...rows, ...items.filter((row) => !seen.has(`${row.type}:${row.id}`))];
            });
          } else {
            this.recipients.set(items);
          }
          this.recipientTotal.set(Number(res.data?.total ?? items.length));
          this.recipientHasMore.set(Boolean(res.data?.hasMore));
          this.walletBalance.set(Number(res.data?.walletBalance ?? this.walletBalance()));
          if (preselectId) {
            const found = items.find((row) => row.id === preselectId);
            if (found?.eligible) {
              this.selected.set([found]);
              this.loadSuggestions();
              this.scheduleQuote();
            } else if (found) {
              this.error.set(found.reason ?? 'This contact cannot receive SMS.');
            } else {
              this.loadRecipientById(preselectId);
            }
          }
          this.loadingRecipients.set(false);
          this.loadingMore.set(false);
        },
        error: (err: ApiError) => {
          this.loadingRecipients.set(false);
          this.loadingMore.set(false);
          this.error.set(userError(err));
        },
      });
  }

  protected loadMore(): void {
    if (this.loadingMore() || !this.recipientHasMore()) return;
    this.loadRecipients('', true);
  }

  protected loadRecipientById(id: string): void {
    this.sms.recipients(this.recipientType(), '', { limit: 1, id })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const item = res.data?.items?.[0];
          if (item?.eligible) {
            this.selected.set([item]);
            this.loadSuggestions();
            this.scheduleQuote();
          } else if (item) {
            this.error.set(item.reason ?? 'This contact cannot receive SMS.');
          }
        },
        error: (err: ApiError) => this.error.set(userError(err)),
      });
  }

  protected onSearch(value: string): void {
    this.query.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      const q = value.trim();
      this.lastQuery = q.length >= 2 ? q : '';
      this.loadRecipients();
    }, 300);
  }

  protected typeLabel(type: SmsRecipientItem['type']): string {
    if (type === 'partner') return 'Partner';
    if (type === 'customer_lead') return 'Customer';
    return 'Prospect';
  }

  protected typeNoun(): string {
    if (this.recipientType() === 'partners') return 'partners';
    if (this.recipientType() === 'customer_leads') return 'customers';
    return 'prospects';
  }

  protected isSelected(item: SmsRecipientItem): boolean {
    return this.selected().some((row) => row.type === item.type && row.id === item.id);
  }

  protected toggleRecipient(item: SmsRecipientItem, checked: boolean): void {
    if (!item.eligible) return;
    this.selected.update((rows) => checked
      ? [...rows.filter((row) => !(row.type === item.type && row.id === item.id)), item]
      : rows.filter((row) => !(row.type === item.type && row.id === item.id)));
    this.suggestions.set([]);
    this.loadSuggestions();
    this.scheduleQuote();
  }

  protected clearSelection(): void {
    this.selected.set([]);
    this.suggestions.set([]);
    this.scheduleQuote();
  }

  protected loadSuggestions(): void {
    const first = this.selected()[0];
    if (!first) { this.suggestions.set([]); return; }
    this.suggestLoading.set(true);
    this.suggestionName.set(first.name);
    this.sms.suggest(first.type, first.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.suggestions.set(res.data?.suggestions ?? []);
          this.suggestLoading.set(false);
        },
        error: () => this.suggestLoading.set(false),
      });
  }

  /** Debounced authoritative quote; the server expands tokens per recipient. */
  protected scheduleQuote(): void {
    this.quoteRequest += 1;
    if (this.quoteTimer) clearTimeout(this.quoteTimer);
    this.quote.set(null);
    this.quoteError.set(null);
    if (this.selected().length === 0 || this.body().trim().length < 3) {
      this.quoteLoading.set(false);
      return;
    }
    this.quoteLoading.set(true);
    this.quoteTimer = setTimeout(() => this.refreshQuote(), 400);
  }

  protected refreshQuote(): void {
    if (this.quoteTimer) {
      clearTimeout(this.quoteTimer);
      this.quoteTimer = null;
    }
    const recipients = this.selected().map((row) => ({ type: row.type, id: row.id }));
    const body = this.body().trim();
    if (recipients.length === 0 || body.length < 3) {
      this.quote.set(null);
      this.quoteLoading.set(false);
      return;
    }
    const request = ++this.quoteRequest;
    this.quoteLoading.set(true);
    this.quoteError.set(null);
    this.sms.quote(recipients, body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          if (request !== this.quoteRequest) return;
          this.quote.set(res.data ?? null);
          if (res.data) this.walletBalance.set(Number(res.data.walletBalance ?? this.walletBalance()));
          this.quoteLoading.set(false);
        },
        error: (err: ApiError) => {
          if (request !== this.quoteRequest) return;
          this.quoteLoading.set(false);
          this.quoteError.set(userError(err));
        },
      });
  }

  protected useSuggestion(suggestion: SmsSuggestion): void {
    this.body.set(suggestion.body);
    this.notice.set(null);
    this.sendError.set(null);
    this.scheduleQuote();
  }

  protected onBody(value: string): void {
    this.body.set(value);
    this.sendError.set(null);
    this.notice.set(null);
    this.scheduleQuote();
    if (this.suggestTimer) clearTimeout(this.suggestTimer);
    if (this.selected().length === 0 && value.trim().length >= 2) {
      this.suggestTimer = setTimeout(() => this.loadSuggestions(), 450);
    }
  }

  protected insertToken(token: string): void {
    this.body.update((value) => `${value}${value.endsWith(' ') || !value ? '' : ' '}${token}`);
    this.scheduleQuote();
  }

  protected applyTemplate(template: SmsTemplate): void {
    if (!template) return;
    this.body.set(template.body);
    this.scheduleQuote();
  }

  protected useTemplateAndCompose(template: SmsTemplate): void {
    this.body.set(template.body);
    this.scheduleQuote();
    this.tab.set('compose');
  }

  protected send(): void {
    if (!this.canSend()) {
      if (this.scheduleInvalid()) this.sendError.set('Choose a date and time in the future to schedule this SMS.');
      return;
    }
    if (this.scheduleEnabled() && !this.scheduledAt()) {
      this.sendError.set('Choose a date and time to schedule this SMS.');
      return;
    }
    this.sending.set(true);
    this.sendError.set(null);
    this.notice.set(null);
    const scheduledAt = this.scheduleEnabled() && this.scheduledAt()
      ? new Date(this.scheduledAt()).toISOString()
      : null;
    const idempotencyKey = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `sms-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.sms.send({
      idempotencyKey,
      recipients: this.selected().map((row) => ({ type: row.type, id: row.id })),
      body: this.body(),
      scheduledAt,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.sending.set(false);
        const skipped = res.data?.ineligible?.length ?? 0;
        const skippedNote = skipped
          ? ` ${skipped} selected contact${skipped === 1 ? ' was' : 's were'} skipped because they are no longer eligible.`
          : '';
        this.notice.set((res.data?.status === 'scheduled'
          ? 'SMS scheduled. You can cancel it from History until it starts sending.'
          : 'SMS queued. Delivery results will appear in History.') + skippedNote);
        this.body.set('');
        this.selected.set([]);
        this.suggestions.set([]);
        this.scheduleEnabled.set(false);
        this.scheduledAt.set('');
        this.quote.set(null);
        this.quoteError.set(null);
        this.quoteRequest += 1;
        this.loadHistory();
        this.walletBalance.update((value) => value - Number(res.data?.totalCost ?? 0));
        this.snack.open(
          res.data?.status === 'scheduled' ? 'SMS scheduled successfully' : 'SMS queued successfully',
          'Close',
          { duration: 3000 },
        );
      },
      error: (err: ApiError) => {
        this.sending.set(false);
        this.sendError.set(userError(err));
      },
    });
  }

  protected loadHistory(): void {
    this.historyLoading.set(true);
    this.historyError.set(null);
    this.sms.history({ limit: 30 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.history.set(res.data?.items ?? []);
          this.historyLoading.set(false);
        },
        error: (err: ApiError) => {
          this.historyError.set(userError(err));
          this.historyLoading.set(false);
        },
      });
  }

  protected openCampaign(id: string): void {
    this.sms.campaign(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => this.activeCampaign.set(res.data ?? null),
      error: (err: ApiError) => this.snack.open(userError(err), 'Close', { duration: 4000 }),
    });
  }

  protected cancelCampaign(campaign: SmsCampaignDetail): void {
    this.sms.cancel(campaign.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.walletBalance.update((value) => value + Number(res.data?.refundedAmount ?? 0));
        this.snack.open('Scheduled SMS cancelled and refunded', 'Close', { duration: 3000 });
        this.activeCampaign.set(null);
        this.loadHistory();
      },
      error: (err: ApiError) => this.snack.open(userError(err), 'Close', { duration: 4000 }),
    });
  }

  protected retryCampaign(campaign: SmsCampaignDetail): void {
    const retryCost = campaign.recipients
      .filter((row) => row.status === 'failed')
      .reduce((total, row) => total + Number(row.cost ?? 0), 0);
    this.sms.retry(campaign.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.walletBalance.update((value) => value - retryCost);
        this.snack.open('Failed messages queued for retry', 'Close', { duration: 3000 });
        this.activeCampaign.set(null);
        this.loadHistory();
      },
      error: (err: ApiError) => this.snack.open(userError(err), 'Close', { duration: 4000 }),
    });
  }

  protected loadTemplates(): void {
    this.sms.templates().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => this.templates.set(res.data ?? []),
      error: () => this.templates.set([]),
    });
  }

  protected createTemplate(): void {
    if (this.templateName().trim().length < 2 || this.templateBody().trim().length < 3) return;
    this.sms.createTemplate(this.templateName(), this.templateBody())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.templateName.set('');
          this.templateBody.set('');
          this.loadTemplates();
          this.snack.open('Template saved', 'Close', { duration: 2500 });
        },
        error: (err: ApiError) => this.snack.open(userError(err), 'Close', { duration: 4000 }),
      });
  }

  protected deleteTemplate(template: SmsTemplate): void {
    if (template.system) return;
    this.sms.deleteTemplate(template.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.loadTemplates(),
      error: (err: ApiError) => this.snack.open(userError(err), 'Close', { duration: 4000 }),
    });
  }

  protected loadOptouts(): void {
    this.sms.suppressions().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => this.optouts.set(res.data ?? []),
      error: () => this.optouts.set([]),
    });
  }

  protected addOptout(): void {
    if (this.optoutPhone().trim().length < 7) return;
    this.sms.addSuppression(this.optoutPhone(), this.optoutReason() || 'Manual opt-out')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.optoutPhone.set('');
          this.optoutReason.set('');
          this.loadOptouts();
          this.loadRecipients();
        },
        error: (err: ApiError) => this.snack.open(userError(err), 'Close', { duration: 4000 }),
      });
  }

  protected removeOptout(row: SmsSuppression): void {
    this.sms.removeSuppression(row.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.loadOptouts(),
      error: (err: ApiError) => this.snack.open(userError(err), 'Close', { duration: 4000 }),
    });
  }

  protected statusLabel(status: string): string {
    switch (status) {
      case 'scheduled': return 'Scheduled';
      case 'sending': return 'Sending';
      case 'sent': return 'Sent';
      case 'partial': return 'Partial';
      case 'failed': return 'Failed';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  }
}
