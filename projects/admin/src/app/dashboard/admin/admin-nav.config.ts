export type AdminNavLeaf = {
  label: string;
  link: string;
  icon: string;
  /** Extra search terms so operators can find pages by task or synonym. */
  keywords?: string[];
};

export type AdminNavGroup = {
  key: string;
  label: string;
  icon: string;
  children: AdminNavLeaf[];
};

/**
 * Admin navigation — grouped by the operator's working domain, not by the
 * route table. Pages sit where an operator would look for them:
 * people/onboarding in People, storefronts and fulfilment in Commerce,
 * wallet liability in Finance, job health and governance in System.
 *
 * The eight decision summaries share one destination with tabs; keeping
 * eight near-identical rows made the rail hard to scan.
 */
export const ADMIN_NAV: AdminNavGroup[] = [
  {
    key: 'overview',
    label: 'Overview',
    icon: 'space_dashboard',
    children: [
      {
        label: 'Command centre',
        link: '/dashboard',
        icon: 'space_dashboard',
        keywords: ['home', 'dashboard', 'overview', 'attention', 'alerts'],
      },
      {
        label: 'Decision summaries',
        link: '/summaries/overview',
        icon: 'insights',
        keywords: ['summaries', 'reports', 'analytics', 'kpi', 'insights', 'metrics'],
      },
    ],
  },
  {
    key: 'people',
    label: 'People',
    icon: 'group',
    children: [
      {
        label: 'Members & roles',
        link: '/roles',
        icon: 'badge',
        keywords: ['members', 'users', 'partners', 'roles', 'access', 'admin', 'leader', '360', 'suspend'],
      },
      {
        label: 'Partner activation',
        link: '/activation',
        icon: 'verified_user',
        keywords: ['activation', 'onboarding', 'starter', 'identity', 'kyc', 'verification'],
      },
      {
        label: 'Partner pipeline',
        link: '/partner-pipeline',
        icon: 'person_search',
        keywords: ['prospects', 'leads', 'pipeline', 'funnel'],
      },
      {
        label: 'Rank groups',
        link: '/rank-groups',
        icon: 'groups',
        keywords: ['ranks', 'journey', 'groups', 'community', 'chat'],
      },
    ],
  },
  {
    key: 'commerce',
    label: 'Commerce',
    icon: 'shopping_bag',
    children: [
      {
        label: 'Partner stores',
        link: '/stores',
        icon: 'storefront',
        keywords: ['stores', 'storefront', 'shops', 'partners'],
      },
      {
        label: 'Store orders',
        link: '/store-orders',
        icon: 'receipt_long',
        keywords: ['store orders', 'customer orders', 'shipping', 'delivery'],
      },
      {
        label: 'Escrow & settlements',
        link: '/store-settlements',
        icon: 'account_balance_wallet',
        keywords: ['escrow', 'settlements', 'payouts', 'fees', 'releases'],
      },
      {
        label: 'Products',
        link: '/products',
        icon: 'inventory_2',
        keywords: ['products', 'catalogue', 'catalog', 'inventory', 'activation products'],
      },
      {
        label: 'Product orders',
        link: '/orders',
        icon: 'shopping_bag',
        keywords: ['product orders', 'fulfilment', 'fulfillment', 'shipping', 'refunds'],
      },
      {
        label: 'Partner pages',
        link: '/pages',
        icon: 'public',
        keywords: ['pages', 'public pages', 'one-pager', 'storefront', 'profile'],
      },
    ],
  },
  {
    key: 'finance',
    label: 'Finance',
    icon: 'account_balance',
    children: [
      {
        label: 'Deposits & withdrawals',
        link: '/finance/transactions',
        icon: 'payments',
        keywords: ['wallet', 'deposits', 'withdrawals', 'payouts', 'ledger', 'transactions', 'refunds'],
      },
      {
        label: 'Compensation',
        link: '/compensation',
        icon: 'workspace_premium',
        keywords: ['commissions', 'ranks', 'mentor bonuses', 'payouts'],
      },
      {
        label: 'Bonus campaigns',
        link: '/bonuses',
        icon: 'card_giftcard',
        keywords: ['bonuses', 'welcome bonus', 'wallet credit', 'promotion', 'campaign'],
      },
    ],
  },
  {
    key: 'growth',
    label: 'Growth',
    icon: 'trending_up',
    children: [
      {
        label: 'Growth campaigns',
        link: '/growth',
        icon: 'hub',
        keywords: ['growth', 'campaigns', 'ads', 'budget', 'allocation'],
      },
      {
        label: 'Feature adoption',
        link: '/feature-adoption',
        icon: 'insights',
        keywords: ['adoption', 'analytics', 'retention', 'engagement'],
      },
      {
        label: 'Recurring revenue',
        link: '/recurring-revenue',
        icon: 'repeat',
        keywords: ['recurring', 'subscriptions', 'bundles', 'repeat orders', 'revenue'],
      },
    ],
  },
  {
    key: 'communications',
    label: 'Communications',
    icon: 'campaign',
    children: [
      {
        label: 'Broadcast',
        link: '/broadcast',
        icon: 'campaign',
        keywords: ['broadcast', 'sms', 'email', 'notice', 'announcement', 'campaign'],
      },
      {
        label: 'Ora monitor',
        link: '/ora',
        icon: 'forum',
        keywords: ['ora', 'ai', 'chat', 'transcripts', 'moderation', 'conversations'],
      },
      {
        label: 'Email list',
        link: '/subscriptions',
        icon: 'mail',
        keywords: ['email list', 'subscribers', 'newsletter', 'audience'],
      },
    ],
  },
  {
    key: 'support',
    label: 'Support',
    icon: 'support_agent',
    children: [
      {
        label: 'Support tickets',
        link: '/tickets',
        icon: 'support_agent',
        keywords: ['support', 'tickets', 'help', 'issues', 'requests'],
      },
      {
        label: 'Moderation',
        link: '/moderation',
        icon: 'flag',
        keywords: ['moderation', 'reports', 'flagged', 'content', 'posts'],
      },
    ],
  },
  {
    key: 'content',
    label: 'Content',
    icon: 'auto_stories',
    children: [
      {
        label: 'Training Studio',
        link: '/training-quizzes',
        icon: 'school',
        keywords: ['training', 'quizzes', 'courses', 'lessons', 'content'],
      },
      {
        label: 'Tutorials',
        link: '/tutorials',
        icon: 'smart_display',
        keywords: ['tutorials', 'videos', 'guides', 'kits'],
      },
      {
        label: 'Weekly video',
        link: '/weekly-videos',
        icon: 'play_circle',
        keywords: ['weekly video', 'briefing', 'video', 'reflections'],
      },
    ],
  },
  {
    key: 'system',
    label: 'System',
    icon: 'settings',
    children: [
      {
        label: 'Platform settings',
        link: '/settings',
        icon: 'tune',
        keywords: ['settings', 'rules', 'fees', 'commission', 'configuration'],
      },
      {
        label: 'Job health',
        link: '/automation',
        icon: 'automation',
        keywords: ['automation', 'jobs', 'sweeps', 'scheduler', 'background', 'health'],
      },
      {
        label: 'Audit log',
        link: '/audit',
        icon: 'history',
        keywords: ['audit', 'history', 'changes', 'activity'],
      },
      {
        label: 'Recycle bin',
        link: '/recycle-bin',
        icon: 'restore_from_trash',
        keywords: ['deleted', 'restore', 'trash', 'recycle'],
      },
    ],
  },
];
