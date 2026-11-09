
export type NavLeaf = {
  label: string;
  link?: string;
  external?: string;
  title?: string;
  permission?: string;
  icon?: string;
};

export type NavItem = NavLeaf & {
  children?: NavLeaf[];
};

export type NavPrimary = {
  key: string;
  label: string;
  icon: string;
  link?: string;
  title?: string;
  description?: string;
  section?: 'workspace' | 'connect' | 'account';
  permission?: string;
  children?: NavItem[];
};

/**
 * Partner navigation — grouped by the jobs a partner actually does.
 *
 * The primary label is the hub link; the chevron opens the smaller set of
 * child destinations. Secondary tools and reports live on each hub page
 * rather than bloating the rail.
 */
export const NEW_NAV_PRIMARY: NavPrimary[] = [
  {
    key: 'home',
    label: 'Home',
    icon: 'home',
    link: '/dashboard',
    description: "Today's priorities",
    section: 'workspace',
    title: 'Home - what should I do today?',
  },
  {
    key: 'products',
    label: 'Products',
    icon: 'storefront',
    description: 'Shop & resell',
    section: 'workspace',
    title: 'Shop products for personal use or resale',
    link: '/dashboard/products',
    children: [
      { label: 'My store', link: '/dashboard/products/my-store', title: 'Publish and manage your public shop' },
      { label: 'Store orders', link: '/dashboard/products/store-orders', title: 'Fulfil customer orders and track escrow' },
      { label: 'Resell', link: '/dashboard/products/resell', title: 'Partner pricing and resale margin' },
      { label: 'My orders', link: '/dashboard/products/order-history', title: 'Orders, delivery and reorder' },
      { label: 'Product guides', link: '/dashboard/products/guides', title: 'Buying, delivery and product care' },
    ],
  },
  {
    key: 'pipeline',
    label: 'Pipeline',
    icon: 'person_search',
    description: 'Leads & follow-ups',
    section: 'workspace',
    title: 'Follow-ups, deals and leads',
    link: '/dashboard/pipeline',
    children: [
      { label: 'Follow-ups', link: '/dashboard/prospects/pipeline', title: 'Pipeline list' },
      { label: 'Reminders', link: '/dashboard/prospects/reminders', title: 'Follow-up promises due' },
      { label: 'Deal board', link: '/dashboard/prospects/board', title: 'Move deals forward' },
    ],
  },
  {
    key: 'customer-leads',
    label: 'Customer leads',
    icon: 'groups',
    description: 'Store customers',
    section: 'workspace',
    title: 'Customers who checked out in your store',
    link: '/dashboard/prospects/customer-leads',
  },
  {
    key: 'team',
    label: 'Team',
    icon: 'groups',
    description: 'Partners & coaching',
    section: 'workspace',
    title: 'Your people and coaching',
    link: '/dashboard/team',
    children: [
      { label: 'Activation', link: '/dashboard/mentorship/team/activation', title: 'Who needs you next' },
      { label: 'Partner acquisition', link: '/dashboard/campaigns', title: 'Fund central acquisition and receive activated partners' },
      { label: 'My partners', link: '/dashboard/mentorship/partners/my-partners', title: 'Your partners' },
      { label: 'Team tree', link: '/dashboard/network/tree', title: 'Tree view' },
    ],
  },
  {
    key: 'promote',
    label: 'Promote',
    icon: 'campaign',
    description: 'Page & outreach',
    section: 'workspace',
    title: 'Promote your page, content and outreach',
    link: '/dashboard/promote',
    children: [
      { label: 'My lead page', link: '/dashboard/settings/landing-page', title: 'Edit your personal lead page' },
      { label: 'Content library', link: '/dashboard/resources/ads-contents', title: 'Texts and images to share' },
      { label: 'Prospecting guides', link: '/dashboard/resources/prospecting-contents', title: 'Scripts and frameworks' },
    ],
  },
  {
    key: 'wallet',
    label: 'Wallet',
    icon: 'payments',
    description: 'Money & commissions',
    section: 'workspace',
    title: 'Money and commissions',
    link: '/dashboard/wallet',
    children: [
      { label: 'Compensation', link: '/dashboard/compensation', title: 'Commissions and mentor bonus' },
      { label: 'Transactions', link: '/dashboard/wallet/history', title: 'Ledger' },
    ],
  },
  {
    key: 'learn',
    label: 'Learn',
    icon: 'school',
    description: 'Academy & progress',
    section: 'workspace',
    title: 'Academy and progress',
    link: '/dashboard/learn',
    children: [
      { label: 'Progress', link: '/dashboard/progress', title: 'Level journey' },
      { label: 'Goals', link: '/dashboard/goals', title: 'Goals' },
      { label: 'Courses', link: '/dashboard/training/courses', title: 'Courses' },
      { label: 'Library', link: '/dashboard/training/library', title: 'Library and resources' },
      { label: 'Tutorials', link: '/dashboard/training/tutorials', title: 'How-tos' },
    ],
  },
  {
    key: 'community',
    label: 'Community',
    icon: 'forum',
    description: 'Feed & events',
    section: 'connect',
    title: 'Talk, events and messages',
    link: '/dashboard/community',
    children: [
      { label: 'Feed', link: '/dashboard/community/feed', title: 'Feed and recognition' },
      { label: 'Events', link: '/dashboard/community/events', title: 'Events' },
      { label: 'Messages', link: '/dashboard/messages', title: 'Messages' },
    ],
  },
  {
    key: 'more',
    label: 'More',
    icon: 'more_horiz',
    description: 'Account & help',
    section: 'account',
    title: 'Settings, insights, support',
    link: '/dashboard/more',
    children: [
      { label: 'Settings', link: '/dashboard/settings/profiles', title: 'Profile, security and billing' },
      { label: 'Appearance', link: '/dashboard/settings/appearance', title: 'Light, dark or system theme' },
      { label: 'Verification & KYC', link: '/dashboard/settings/verification', title: 'Identity status and verification' },
      { label: 'Billing & withdrawals', link: '/dashboard/settings/billing', title: 'Bank account and withdrawals' },
      { label: 'Personal page', link: '/dashboard/settings/landing-page', title: 'Personal lead page content' },
      { label: 'Notifications', link: '/dashboard/notifications/center', title: 'Alerts and notification settings' },
      { label: 'Insights', link: '/dashboard/insights', title: 'Your business insights' },
      { label: 'Help & about', link: '/dashboard/support/ticket', title: 'Support and about' },
    ],
  },
];
