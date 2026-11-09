import {Component, Input, ChangeDetectionStrategy, inject} from '@angular/core';
import {MatTabsModule} from '@angular/material/tabs';
import {MatSelectModule} from '@angular/material/select';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {FormsModule} from '@angular/forms';

import { MatIconModule } from '@angular/material/icon';
import templatesData from '../../../../../../../public/resource-templates/text/source.json';
import { PartnerInterface } from '../../../../../_common/services/partner.service';
import {MatButtonModule} from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';

interface TextTemplate {
  title: string;
  description: string;
  platforms?: string[];
}

/**
 * @title Text templates — copy a template and share it.
 */
@Component({
selector: 'async-text-download',
template: `

<div class="wrapper">
  <div class="toolbar">
    <mat-form-field appearance="outline" subscriptSizing="dynamic">
      <mat-label>Search templates</mat-label>
      <input matInput type="search" [(ngModel)]="query" (input)="filterTemplates()" placeholder="Words or phrases" />
    </mat-form-field>
    <mat-form-field appearance="outline" subscriptSizing="dynamic">
      <mat-label>Platform</mat-label>
      <mat-select [(ngModel)]="selectedPlatform" (selectionChange)="filterTemplates()">
        <mat-option value="All Platforms">All Platforms</mat-option>
        <mat-option value="Facebook">Facebook</mat-option>
        <mat-option value="Twitter">Twitter</mat-option>
        <mat-option value="Instagram">Instagram</mat-option>
        <mat-option value="WhatsApp">WhatsApp</mat-option>
        <mat-option value="LinkedIn">LinkedIn</mat-option>
        <mat-option value="Pinterest">Pinterest</mat-option>
        <mat-option value="TikTok">TikTok</mat-option>
        <mat-option value="YouTube">YouTube</mat-option>
      </mat-select>
    </mat-form-field>
  </div>

  @if (filteredTemplates.length > 0) {
    <section class="template-list">
      @for (template of filteredTemplates; track template.title) {
        <div class="template-item dp-card">
          <div class="template-top">
            <h3>{{ template.title }}</h3>
            <button mat-icon-button (click)="copyContent(template)" title="Copy with my link" aria-label="Copy with my link">
              <mat-icon>content_copy</mat-icon>
            </button>
          </div>
          <p>{{ template.description }}</p>
          <p class="muted">Posts with <strong>{{ partnerLink() }}</strong></p>
          <div class="template-actions">
            <button mat-button (click)="copyContent(template)">Copy</button>
          </div>
        </div>
      }
    </section>
  } @else {
    <p class="empty">No templates match — try another search or platform.</p>
  }

  <button mat-mini-fab color="primary" class="scroll-to-top" (click)="scrollToTop()" aria-label="Scroll to top">
    <mat-icon>arrow_upward</mat-icon>
  </button>
</div>

`,
styles: [`

.wrapper { padding: 0.5em 0; }
.toolbar { display: flex; gap: 0.75em; flex-wrap: wrap; align-items: center; margin-bottom: 1em; }
.toolbar mat-form-field { flex: 1; min-width: 200px; }

.template-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 1rem;
}

.template-item {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.4em;
}

.template-item h3 {
    margin: 0;
    font-size: 1.05rem;
}

.template-item p { margin: 0; font-size: 0.9rem; }
.muted { color: var(--ms-text-muted); font-size: 0.85em; }
.muted strong { color: var(--ms-primary-strong); }

.template-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5em; }
.template-top button { min-height: 44px; }
.template-actions { display: flex; gap: 0.4em; flex-wrap: wrap; margin-top: 0.3em; }
.template-actions button { min-height: 44px; }

.empty { color: var(--ms-text-muted); text-align: center; padding: 2em 1em; }

@media (max-width: 480px) {
    .template-list {
        grid-template-columns: 1fr;
    }
}

.scroll-to-top {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 1000;
}

/* Lift above the mobile bottom tab bar. */
@media (max-width: 600px) {
    .scroll-to-top {
        bottom: 5.5em;
        right: 0.75em;
    }
}

`],
changeDetection: ChangeDetectionStrategy.Eager,
imports: [MatTabsModule, MatFormFieldModule, MatButtonModule, MatIconModule, FormsModule, MatInputModule, MatSelectModule]
})
export class TextDownloadComponent {
  templates: TextTemplate[] = [...(templatesData as TextTemplate[])];
  filteredTemplates: TextTemplate[] = [...this.templates];
  selectedPlatform: string = 'All Platforms';
  query = '';

  @Input() partner!: PartnerInterface;

  constructor(
    private snackBar: MatSnackBar
  ) {}

    ngOnInit(): void {
        this.templates = this.shuffleArray([...(templatesData as TextTemplate[])]);
        this.filteredTemplates = [...this.templates];
    }

    private shuffleArray(array: TextTemplate[]): TextTemplate[] {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    }

    protected partnerLink(): string {
      return `https://marketspase.com/lead/${this.partner?.username ?? ''}`;
    }

    private fullContent(template: TextTemplate): string {
      return `${template.description}\n\nVisit ${this.partnerLink()} to get started`;
    }

    copyContent(template: TextTemplate): void {
      navigator.clipboard.writeText(this.fullContent(template)).then(() => {
        this.showSnackbar('Content and link copied to clipboard!');
      }).catch(() => {
        this.showSnackbar('Failed to copy content. Please try again.');
      });
    }

    private showSnackbar(message: string): void {
      this.snackBar.open(message, 'Close', {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
      });
    }


  filterTemplates() {
    const q = this.query.trim().toLowerCase();
    this.filteredTemplates = this.templates.filter((template) => {
      const platformOk = this.selectedPlatform === 'All Platforms'
        || template.platforms?.includes(this.selectedPlatform);
      if (!platformOk) return false;
      if (!q) return true;
      return `${template.title ?? ''} ${template.description ?? ''}`.toLowerCase().includes(q);
    });
  }

  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
