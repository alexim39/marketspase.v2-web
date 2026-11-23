/**
 * Single source of truth for public-page SEO.
 *
 * The same manifest is consumed by the runtime SeoService (client and
 * prerender) and can later drive sitemap generation without drift.
 */
export const SITE_URL = 'https://marketspase.com';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/logo/og-image-v2.jpg`;

export interface SeoPage {
  path: string;
  title: string;
  description: string;
  canonical: string;
  robots: string;
  ogTitle?: string;
  ogDescription?: string;
  schema?: () => unknown[];
}

const canonical = (path: string) => `${SITE_URL}${path === '/' ? '/' : path}`;

export const PUBLIC_SEO: Record<string, SeoPage> = {
  '/': {
    path: '/',
    title: 'MarketSpase - A Real Online Business Opportunity Without the Chase',
    description:
      'MarketSpase is a product-backed online business opportunity for people who want to make money online without chasing, cold-calling or pitching friends. Meet Ora, your AI business partner.',
    canonical: canonical('/'),
    robots: 'index, follow',
    ogTitle: 'MarketSpase - Your Online Business. Without the Chase.',
    ogDescription:
      'Build a real online business without chasing, cold-calling or pitching friends. MarketSpase brings the interest and Ora prepares the work - you approve the next move.',
    schema: () => [productSchema(), serviceSchema()],
  },
  '/join': {
    path: '/join',
    title: 'Join MarketSpase - Start Your Online Business Without the Chase',
    description:
      'Create a free MarketSpase account, verify your email, meet Ora and activate with a real product when you are ready. No invitation, no cold calls and no pressure.',
    canonical: canonical('/join'),
    robots: 'index, follow',
    schema: () => [productSchema(), breadcrumbSchema('Join', '/join')],
  },
  '/how-it-works': {
    path: '/how-it-works',
    title: 'How Your Online Business Works - MarketSpase',
    description:
      'See how MarketSpase works: free signup, real product activation, central advertising, fair allocation, product-margin commissions and Ora, your AI business partner.',
    canonical: canonical('/how-it-works'),
    robots: 'index, follow',
    schema: () => [howToSchema(), breadcrumbSchema('How it works', '/how-it-works')],
  },
  '/about': {
    path: '/about',
    title: 'About MarketSpase - A Real Online Business Opportunity',
    description:
      'Learn who MarketSpase is for, what we believe and why we built a product-backed online business without chasing, cold-calling or pitching friends.',
    canonical: canonical('/about'),
    robots: 'index, follow',
    schema: () => [aboutSchema(), breadcrumbSchema('About', '/about')],
  },
  '/faq': {
    path: '/faq',
    title: 'Online Business Questions - MarketSpase FAQ',
    description:
      'Straight answers about MarketSpase: signup, activation cost, products, commissions, placement, ranks, Ora, data and support.',
    canonical: canonical('/faq'),
    robots: 'index, follow',
    schema: () => [faqSchema(), breadcrumbSchema('FAQ', '/faq')],
  },
  '/ora': {
    path: '/ora',
    title: 'Meet Ora - Your AI Business Partner | MarketSpase',
    description:
      'Ora knows your rank, pipeline, campaigns and team. Ask what to do next, get a personal plan and approve every action before it runs.',
    canonical: canonical('/ora'),
    robots: 'index, follow',
    schema: () => [oraSchema(), breadcrumbSchema('Ora', '/ora')],
  },
};

export const isPublicSeoPath = (path: string): boolean => Boolean(PUBLIC_SEO[path]);

const organizationId = `${SITE_URL}/#organization`;
const websiteId = `${SITE_URL}/#website`;

const productSchema = () => ({
  '@type': 'Product',
  '@id': `${SITE_URL}/#starter-product`,
  name: 'MarketSpase Signature Clothing Set',
  description:
    'The MarketSpase starter product used to activate a partner account. It is a real shipped product, not a recruitment fee.',
  sku: 'MS-STARTER-001',
  brand: { '@type': 'Brand', name: 'MarketSpase' },
  offers: {
    '@type': 'Offer',
    url: `${SITE_URL}/join`,
    price: '38000',
    priceCurrency: 'NGN',
    availability: 'https://schema.org/InStock',
    seller: { '@id': organizationId },
  },
});

const serviceSchema = () => ({
  '@type': 'Service',
  '@id': `${SITE_URL}/#service`,
  name: 'MarketSpase online business platform',
  serviceType: 'Product-backed online business platform',
  provider: { '@id': organizationId },
  areaServed: { '@type': 'Country', name: 'Nigeria' },
  url: SITE_URL,
  description:
    'A product-backed online business platform with activation through a real product, product-margin commissions, team tools and Ora, an AI business partner.',
});

const oraSchema = () => ({
  '@type': 'Service',
  '@id': `${SITE_URL}/#ora`,
  name: 'Ora',
  serviceType: 'AI business partner',
  provider: { '@id': organizationId },
  url: `${SITE_URL}/ora`,
  description:
    'Ora is MarketSpase’s AI business partner. It uses the partner’s rank, pipeline, campaigns and team context to prepare a daily plan and actions for approval.',
});

const aboutSchema = () => ({
  '@type': 'AboutPage',
  '@id': `${SITE_URL}/about#page`,
  url: `${SITE_URL}/about`,
  name: 'About MarketSpase',
  description:
    'MarketSpase is a product-backed online business for people who want to earn online without chasing, cold-calling or pitching friends.',
  about: { '@id': organizationId },
  isPartOf: { '@id': websiteId },
});

const breadcrumbSchema = (name: string, path: string) => ({
  '@type': 'BreadcrumbList',
  '@id': `${SITE_URL}${path}#breadcrumb`,
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
    { '@type': 'ListItem', position: 2, name, item: `${SITE_URL}${path}` },
  ],
});

const howToSchema = () => ({
  '@type': 'HowTo',
  '@id': `${SITE_URL}/how-it-works#howto`,
  name: 'How to start a MarketSpase online business',
  description:
    'Create a free account, verify your email, meet Ora, activate with the starter product and follow the daily plan.',
  step: [
    {
      '@type': 'HowToStep',
      position: 1,
      name: 'Create your free account',
      text: 'Sign up with your name, phone and email. No invitation or referral link is required.',
      url: `${SITE_URL}/partner/signup`,
    },
    {
      '@type': 'HowToStep',
      position: 2,
      name: 'Verify your email',
      text: 'Open the verification link sent to your inbox to activate your account.',
    },
    {
      '@type': 'HowToStep',
      position: 3,
      name: 'Meet Ora and explore the Academy',
      text: 'Ask Ora for your first plan and start the IPO course in the Academy.',
    },
    {
      '@type': 'HowToStep',
      position: 4,
      name: 'Activate with the starter product',
      text: 'Buy the real MarketSpase starter product shown before payment. Activation unlocks commissions and the allocation queue.',
      url: `${SITE_URL}/join`,
    },
    {
      '@type': 'HowToStep',
      position: 5,
      name: 'Follow your daily plan',
      text: 'Use the dashboard, CRM and Ora to work the next action, follow up and build your team.',
    },
  ],
});

const faqItems = [
  {
    q: 'What kind of online business is this?',
    a: 'MarketSpase is a product-backed online business. You activate with a real product, earn from product sales and qualification, and use Ora to plan the day and prepare the work.',
  },
  {
    q: 'Who can join MarketSpase?',
    a: 'Anyone ready to build a product business can create an account. The experience is designed with 18-35s in mind, but the platform is open to anyone willing to do the work and follow the rules.',
  },
  {
    q: 'Do I need experience or a following?',
    a: 'No. Ora gives you a daily plan, the Academy teaches the basics and the community has your back. You need consistency and a willingness to learn.',
  },
  {
    q: 'Do I need an invitation or referral link?',
    a: 'No. Sign-up is open. Create an account with your name, phone and email, then verify your email. Campaign and referral links are tracked when present, but they are not required to join.',
  },
  {
    q: 'What am I buying when I activate?',
    a: 'A real MarketSpase starter product, shipped to the address you provide. The product and exact price are shown before you pay. It is not a recruitment fee.',
  },
  {
    q: 'How do I make money?',
    a: 'Through product sales, team and placement commissions, the Activation Mentor Bonus and store or retail orders. Every earning path is visible in your wallet, with pending, released and withdrawn amounts.',
  },
  {
    q: 'What is Ora?',
    a: 'Ora is your AI business partner. It knows your rank, progress, pipeline, campaigns and team. Ask what to do, get a personal plan and approve the actions you want it to prepare.',
  },
  {
    q: 'Can Ora act without me?',
    a: 'No. Ora can prepare actions such as campaigns, follow-ups and team messages, but you confirm before anything runs. You stay in control.',
  },
];

const faqSchema = () => ({
  '@type': 'FAQPage',
  '@id': `${SITE_URL}/faq#faq`,
  mainEntity: faqItems.map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a },
  })),
});

/** Page-specific JSON-LD nodes, wrapped in a single graph by SeoService. */
export const pageSchema = (page: SeoPage): unknown[] => {
  const nodes = page.schema?.() ?? [];
  return [
    ...nodes,
    {
      '@type': 'WebPage',
      '@id': `${page.canonical}#webpage`,
      url: page.canonical,
      name: page.title,
      description: page.description,
      isPartOf: { '@id': websiteId },
      about: { '@id': organizationId },
      inLanguage: 'en-NG',
    },
  ];
};
