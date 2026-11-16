import { computed, Injectable, signal } from '@angular/core';

export interface OraDemo {
  prompt: string;
  answer: string[];
  actions: string[];
}

const DEMOS: OraDemo[] = [
  {
    prompt: 'What should I do in my online business today?',
    answer: [
      'Morning. Based on your pipeline and campaign activity, here are your three moves:',
      'Follow up with 2 interested prospects who opened your last message. Review 4 new customer leads before 2pm. Check in with one teammate who has not activated yet.',
    ],
    actions: ['Approve plan', 'Edit plan'],
  },
  {
    prompt: 'What is the status of my online business?',
    answer: [
      'You are active and in good shape. One campaign is live, 4 leads are waiting and ₦18,400 in commissions is pending release.',
      'The thing to watch: 3 follow-ups are overdue. I can prepare them for your review.',
    ],
    actions: ['Approve follow-ups', 'View commissions'],
  },
  {
    prompt: 'Help me set up a campaign to get more leads.',
    answer: [
      'I can draft it. Based on your best-performing audience, I would suggest a 14-day campaign across two target states with a ₦20,000 budget.',
      'I will show you the full brief before anything is charged. You approve the final version.',
    ],
    actions: ['Approve draft', 'Change budget'],
  },
  {
    prompt: 'Who on my team needs support?',
    answer: [
      'Three people are worth a check-in: two new partners still finishing activation, and one Builder whose team activity dropped this week.',
      'I can prepare short, personal messages for each. You can edit every message before it sends.',
    ],
    actions: ['Approve messages', 'Open my team'],
  },
];

/** Shared demo state for the public Meet Ora page. */
@Injectable()
export class OraPublicFacade {
  readonly demos = DEMOS;
  readonly selected = signal(0);
  readonly current = computed(() => this.demos[this.selected()]);
}
