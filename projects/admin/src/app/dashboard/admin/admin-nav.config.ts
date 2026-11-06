export type AdminNavLeaf = {
  label: string;
  link: string;
  icon: string;
};

export type AdminNavGroup = {
  key: string;
  label: string;
  icon: string;
  children: AdminNavLeaf[];
};

/**
 * Admin navigation — grouped by the operating domain, not by page list.
 * Everything a platform operator needs to run MarketSpase lives here:
 * people, commerce (including partner stores and escrow), finance, growth,
 * communications, support and system content.
 */
export const ADMIN_NAV: AdminNavGroup[] = [
  {
    key: 'overview',
    label: 'Overview',
    icon: 'space_dashboard',
    children: [
      { label: 'Command centre', link: '/dashboard', icon: 'space_dashboard' },
    ],
  },
  {
    key: 'commerce',
    label: 'Commerce',
    icon: 'shopping_bag',
    children: [
      { label: 'Partner stores', link: '/stores', icon: 'storefront' },
      { label: 'Store orders', link: '/store-orders', icon: 'receipt_long' },
      { label: 'Escrow & settlements', link: '/store-settlements', icon: 'account_balance_wallet' },
      { label: 'Product orders', link: '/orders', icon: 'shopping_bag' },
      { label: 'Products', link: '/products', icon: 'inventory_2' },
      { label: 'Bonuses', link: '/bonuses', icon: 'card_giftcard' },
      { label: 'Shop plan (legacy)', link: '/plan', icon: 'percent' },
    ],
  },
  {
    key: 'finance',
    label: 'Finance',
    icon: 'account_balance',
    children: [
      { label: 'Activation desk', link: '/activation', icon: 'verified_user' },
      { label: 'Compensation', link: '/compensation', icon: 'workspace_premium' },
      { label: 'Deposits & withdrawals', link: '/deposits', icon: 'payments' },
    ],
  },
  {
    key: 'people',
    label: 'People',
    icon: 'group',
    children: [
      { label: 'Manage roles', link: '/roles', icon: 'badge' },
      { label: 'Partner pipeline', link: '/partner-pipeline', icon: 'person_search' },
      { label: 'Page leads', link: '/page-leads', icon: 'inbox' },
      { label: 'Partner surveys', link: '/partner-surveys', icon: 'assignment' },
    ],
  },
  {
    key: 'growth',
    label: 'Growth',
    icon: 'trending_up',
    children: [
      { label: 'Growth campaigns', link: '/growth', icon: 'hub' },
      { label: 'Automation', link: '/automation', icon: 'automation' },
      { label: 'Public pages', link: '/pages', icon: 'public' },
    ],
  },
  {
    key: 'communications',
    label: 'Communications',
    icon: 'campaign',
    children: [
      { label: 'Broadcast', link: '/broadcast', icon: 'campaign' },
      { label: 'Email list', link: '/subscriptions', icon: 'mail' },
    ],
  },
  {
    key: 'support',
    label: 'Support & trust',
    icon: 'support_agent',
    children: [
      { label: 'Support tickets', link: '/tickets', icon: 'support_agent' },
      { label: 'Moderation', link: '/moderation', icon: 'flag' },
      { label: 'Audit log', link: '/audit', icon: 'history' },
    ],
  },
  {
    key: 'system',
    label: 'Content & system',
    icon: 'settings',
    children: [
      { label: 'Training quizzes', link: '/training-quizzes', icon: 'quiz' },
      { label: 'Tutorials', link: '/tutorials', icon: 'smart_display' },
      { label: 'Presentations', link: '/kits', icon: 'present_to_all' },
      { label: 'Platform settings', link: '/settings', icon: 'tune' },
    ],
  },
];
