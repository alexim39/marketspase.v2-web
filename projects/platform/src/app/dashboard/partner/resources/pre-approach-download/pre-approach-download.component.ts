import { Component, inject, Input, OnInit, ChangeDetectionStrategy, signal } from '@angular/core';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { PartnerInterface } from '../../../../_common/services/partner.service';
import { MatIconModule } from '@angular/material/icon';
import { HelpDialogComponent } from '../../../../_common/help-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { RouterModule } from '@angular/router';

interface GuideDoc {
  id: string;
  title: string;
  icon: string;
  when: string;
  about: string;
  file: string;
  download: string;
}

const GUIDES: GuideDoc[] = [
  {
    id: 'pre-approach',
    title: 'Pre-approach Document',
    icon: 'menu_book',
    when: 'Read before your first contact with any prospect.',
    about: 'The framework for structuring your approach: who to talk to, what to say first, and how to earn the longer conversation.',
    file: 'docs/pre-approach_tool_for_marketspase.pdf',
    download: 'pre-approach-document.pdf',
  },
  {
    id: 'chat-responses',
    title: 'Sample Prospect Chat Responses',
    icon: 'forum',
    when: 'Keep open while chatting — answers to the questions prospects actually ask.',
    about: 'Tried replies to common objections and questions, so you never stall mid-conversation.',
    file: 'docs/Sample-prospect-chat-responses.pdf',
    download: 'Sample-prospect-chat-responses-document.pdf',
  },
];

/**
 * @title Prospecting guides — learn the approach, borrow the words.
 *
 * Reading progress is tracked on this device per partner (training
 * ladder milestones stay server-owned and untouched).
 */
@Component({
    selector: 'async-preapproach-download',
    styleUrls: ['pre-approach-download.component.scss'],
    templateUrl: 'pre-approach-download.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, MatFormFieldModule, MatTabsModule, MatButtonModule, MatChipsModule, MatInputModule, MatIconModule, RouterModule]
})
export class PreApproachDownloadComponent implements OnInit {
    @Input() partner!: PartnerInterface;
    readonly dialog = inject(MatDialog);

    protected readonly guides = GUIDES;
    protected readonly readIds = signal<Set<string>>(new Set());

    ngOnInit(): void {
        this.readIds.set(this.loadRead());
    }

    protected readCount(): number {
      return this.guides.filter((g) => this.readIds().has(g.id)).length;
    }

    protected isRead(id: string): boolean {
      return this.readIds().has(id);
    }

    protected download(g: GuideDoc): void {
      const link = document.createElement('a');
      link.href = g.file;
      link.download = g.download;
      link.click();
    }

    protected markRead(id: string): void {
      this.readIds.update((s) => new Set(s).add(id));
      this.persistRead();
    }

    protected markUnread(id: string): void {
      this.readIds.update((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
      this.persistRead();
    }

    private storageKey(): string {
      return `dp-guides-read:${String(this.partner?._id ?? 'anon')}`;
    }

    private loadRead(): Set<string> {
      try {
        const raw = localStorage.getItem(this.storageKey());
        const ids = raw ? (JSON.parse(raw) as unknown) : [];
        return new Set(Array.isArray(ids) ? ids.map(String) : []);
      } catch {
        return new Set();
      }
    }

    private persistRead(): void {
      try {
        localStorage.setItem(this.storageKey(), JSON.stringify([...this.readIds()]));
      } catch {
        // Private mode etc. — progress simply doesn't persist.
      }
    }

    showDescription () {
        this.dialog.open(HelpDialogComponent, {
          data: {help: `
            Read both guides, then practice them on real prospects. Your reading progress is tracked on this device.
          `},
        });
      }
}
