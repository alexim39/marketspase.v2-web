import { ProductInterface, ProductMedia } from './monthly-purchase.service';

export type ProductCategory = { key: string; label: string };
export type StockState = 'available' | 'in' | 'low' | 'out';

type CategoryRule = ProductCategory & { words: string[] };

/**
 * Category fallback for catalogs created before the product model gained a
 * `category` field. Explicit API categories always win; this only keeps the
 * shop usable with existing product names/images.
 */
const CATEGORY_RULES: CategoryRule[] = [
  {
    key: 'wellness-drinks',
    label: 'Wellness drinks',
    words: ['coffee', 'liven', 'burn', 'tea', 'shake', 'slim', 'vida', 'choco', 'energizer', 'c247', 'drink'],
  },
  {
    key: 'personal-care',
    label: 'Personal care',
    words: ['toothpaste', 'wash', 'whitening', 'cleaning', 'feminine', 'masculine', 'perfect-white', 'whitelight', 'naturacentials'],
  },
  {
    key: 'wellness-tech',
    label: 'Wellness tech',
    words: ['pendant', 'diffuser', 'enerchi', 'nu-uh2', 'ultra-h2', 'restorlyf', 'supreme', 'bracelet'],
  },
  {
    key: 'family-health',
    label: 'Family health',
    words: ['gummies', 'kiddi', 'choleduz'],
  },
];

export const CATEGORY_ORDER = [...CATEGORY_RULES.map((rule) => rule.key), 'essentials'];

const slug = (value: string) => value
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const stripHtml = (value: string) => value
  .replace(/<[^>]*>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim();

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const truncate = (value: string, max: number) => (
  value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value
);

const imageFromRaw = (raw: string): string => {
  const value = String(raw ?? '').trim();
  if (!value) return '';
  if (/^(https?:)?\/\//i.test(value) || value.startsWith('data:')) return value;
  if (/\.(png|jpe?g|webp|gif|avif|svg)$/i.test(value)) return `/img/products/${value}`;
  return `/img/products/${value}.PNG`;
};

export const productCategory = (product: ProductInterface): ProductCategory => {
  const explicit = String(product.category ?? '').trim();
  if (explicit) {
    const key = slug(explicit);
    const known = CATEGORY_RULES.find((rule) => rule.key === key || rule.label.toLowerCase() === explicit.toLowerCase());
    return known ? { key: known.key, label: known.label } : { key: key || 'essentials', label: explicit };
  }

  const haystack = `${product.name ?? ''} ${product.img ?? ''}`.toLowerCase();
  const match = CATEGORY_RULES.find((rule) => rule.words.some((word) => haystack.includes(word)));
  return match
    ? { key: match.key, label: match.label }
    : { key: 'essentials', label: 'Essentials' };
};

export const productImage = (product: ProductInterface): string => {
  const media = productMedia(product);
  const first = media[0];
  if (!first) return '';
  if (first.type === 'video') {
    return first.thumbnailUrl || media.find((item) => item.type === 'image')?.url || '';
  }
  return first.url;
};

/** Mixed image/video gallery with legacy image fallback. */
export const productMedia = (product: ProductInterface): ProductMedia[] => {
  const media = (product.media ?? [])
    .filter((item) => item && item.url)
    .map((item) => ({
      type: item.type === 'video' ? 'video' as const : 'image' as const,
      url: String(item.url),
      thumbnailUrl: item.thumbnailUrl ? String(item.thumbnailUrl) : (item.type === 'video' ? '' : String(item.url)),
      width: item.width ?? null,
      height: item.height ?? null,
      duration: item.duration ?? null,
      order: item.order ?? 0,
    }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  if (media.length > 0) return media;
  const legacy = [product.img, ...(product.gallery ?? [])]
    .map(imageFromRaw)
    .filter(Boolean);
  return [...new Set(legacy)].slice(0, 5).map((url, index) => ({
    type: 'image' as const,
    url,
    thumbnailUrl: url,
    width: null,
    height: null,
    duration: null,
    order: index,
  }));
};

export const productHasVideo = (product: ProductInterface): boolean => (
  productMedia(product).some((item) => item.type === 'video')
);

export const productGallery = (product: ProductInterface): string[] => {
  const gallery = (product.gallery ?? []).map(imageFromRaw).filter(Boolean);
  const primary = productImage(product);
  const images = [primary, ...gallery].filter(Boolean);
  return [...new Set(images)];
};

export const productSummary = (product: ProductInterface): string => {
  const short = String(product.shortDesc ?? '').trim();
  if (short) return short;

  const description = stripHtml(String(product.desc ?? ''));
  if (description) return truncate(description, 118);

  return `Genuine ${productCategory(product).label.toLowerCase()} from the MarketSpase catalog.`;
};

export const productDescription = (product: ProductInterface): string => {
  const description = String(product.desc ?? '').trim();
  if (!description) return '';
  if (/<[a-z][\s\S]*>/i.test(description)) return description;

  return description
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('');
};

export const productBenefits = (product: ProductInterface): string[] => {
  const benefits = (product.benefits ?? []).map((item) => String(item ?? '').trim()).filter(Boolean);
  if (benefits.length > 0) return benefits;
  return [
    'Genuine product from the MarketSpase catalog',
    'Pay securely from your wallet balance',
    'Track delivery and reorder from My orders',
  ];
};

export const productHowToUse = (product: ProductInterface): string => (
  String(product.howToUse ?? '').trim()
  || 'Follow the instructions on the pack. If you are unsure about suitability, message support before use.'
);

export const productDeliveryNote = (product: ProductInterface): string => (
  String(product.deliveryNote ?? '').trim()
  || 'Orders are paid from your wallet and processed after confirmation. Follow every status change in My orders. Cancellations before fulfilment are refunded to your wallet.'
);

export const stockState = (product: ProductInterface): StockState => {
  if (product.status === 'inactive' || product.status === 'archived') return 'out';
  if (product.stock === null || product.stock === undefined) return 'available';

  const stock = Number(product.stock);
  if (!Number.isFinite(stock) || stock <= 0) return 'out';
  if (stock <= 5) return 'low';
  return 'in';
};

export const stockLabel = (product: ProductInterface): { state: StockState; label: string; tone: string } => {
  const state = stockState(product);
  if (state === 'out') return { state, label: 'Out of stock', tone: 'bad' };
  if (state === 'low') return { state, label: `Only ${Number(product.stock)} left`, tone: 'warn' };
  if (state === 'in') return { state, label: 'In stock', tone: 'ok' };
  return { state, label: 'Available', tone: 'neutral' };
};

export const isOutOfStock = (product: ProductInterface): boolean => stockState(product) === 'out';

export const productPrice = (product: ProductInterface): number => {
  const price = Number(product.price);
  return Number.isFinite(price) ? price : 0;
};

export const isPriced = (product: ProductInterface): boolean => productPrice(product) > 0;
