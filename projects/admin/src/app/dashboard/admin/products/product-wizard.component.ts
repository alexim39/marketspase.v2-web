import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { firstValueFrom } from 'rxjs';
import { ApiError, userError } from '../../../core/http/api-error';
import {
  AdminProduct,
  AdminProductStatus,
  AdminProductsService,
  PricingMode,
  ProductCostBreakdown,
  ProductForm,
  ProductMedia,
  ProductPricing,
} from './admin-products.service';

const DEFAULT_COSTS: ProductCostBreakdown = {
  manufacturing: 0,
  packaging: 0,
  inboundFreight: 0,
  duties: 0,
  other: 0,
  lastMileShipping: 0,
  handling: 0,
  acquisitionAllowance: 0,
  paymentFeeRate: 0.015,
  refundReserveRate: 0.03,
  rankReserveRate: 0.015,
  notes: '',
};

const emptyForm = (): ProductForm => ({
  name: '',
  sku: '',
  category: '',
  shortDesc: '',
  desc: '',
  benefits: [],
  howToUse: '',
  deliveryNote: '',
  stock: null,
  featured: false,
  commissionable: true,
  pricingMode: 'resale',
  mentorBonus: 0,
  price: null,
  partnerPrice: null,
  retailPrice: null,
  costBreakdown: { ...DEFAULT_COSTS },
  media: [],
  targetPlatformContributionPct: 0.10,
  targetPartnerMarginPct: 0.30,
  sortOrder: null,
  status: 'draft',
});

const mediaFromProduct = (product: AdminProduct): ProductMedia[] => {
  if (Array.isArray(product.media) && product.media.length > 0) {
    return product.media
      .map((item, index) => ({ ...item, order: item.order ?? index }))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((item, index) => ({ ...item, order: index }));
  }
  const legacy = [product.img, ...(product.gallery ?? [])]
    .map((url) => String(url ?? '').trim())
    .filter(Boolean);
  return [...new Set(legacy)].slice(0, 5).map((url, index) => ({
    type: 'image' as const,
    url,
    thumbnailUrl: url,
    order: index,
  }));
};

@Component({
  selector: 'async-admin-product-wizard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    DecimalPipe,
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
  ],
  templateUrl: './product-wizard.component.html',
  styleUrls: ['./product-wizard.component.scss'],
})
export class AdminProductWizardComponent implements OnInit {
  private readonly products = inject(AdminProductsService);

  readonly product = input<AdminProduct | null>(null);
  readonly saved = output<AdminProduct>();
  readonly cancelled = output<void>();

  protected readonly step = signal(1);
  protected readonly form = signal<ProductForm>(emptyForm());
  protected readonly productId = signal<string | null>(null);
  protected readonly media = signal<ProductMedia[]>([]);
  protected readonly pricing = signal<ProductPricing | null>(null);
  protected readonly busy = signal(false);
  protected readonly uploading = signal(false);
  protected readonly previewing = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);

  protected readonly steps = [
    { number: 1, label: 'Basics' },
    { number: 2, label: 'Costs' },
    { number: 3, label: 'Media' },
    { number: 4, label: 'Pricing' },
    { number: 5, label: 'Review' },
  ];

  protected readonly landingCost = computed(() => {
    const c = this.form().costBreakdown;
    return Number(c.manufacturing || 0)
      + Number(c.packaging || 0)
      + Number(c.inboundFreight || 0)
      + Number(c.duties || 0)
      + Number(c.other || 0);
  });

  protected readonly totalCost = computed(() => {
    const c = this.form().costBreakdown;
    return this.landingCost()
      + Number(c.lastMileShipping || 0)
      + Number(c.handling || 0)
      + Number(c.acquisitionAllowance || 0);
  });

  protected readonly canPublish = computed(() => {
    const pricing = this.pricing();
    return Boolean(pricing?.canPublish)
      && this.media().length >= 1
      && this.media().length <= 5
      && !this.busy()
      && !this.previewing()
      && !this.uploading();
  });

  protected readonly pricingStatusLabel = computed(() => {
    const status = this.pricing()?.status;
    if (status === 'healthy') return 'Healthy margin';
    if (status === 'thin') return 'Publishable, below target';
    if (status === 'blocked') return 'Blocked — loss or below floor';
    if (status === 'incomplete') return 'Incomplete';
    return 'Not calculated';
  });

  ngOnInit(): void {
    const product = this.product();
    if (!product) return;
    const id = String(product._id ?? product.id ?? '');
    this.productId.set(id || null);
    const costs: ProductCostBreakdown = {
      ...DEFAULT_COSTS,
      ...(product.costBreakdown ?? {}),
      manufacturing: Number(product.costBreakdown?.manufacturing ?? product.cogs ?? 0),
      lastMileShipping: Number(product.costBreakdown?.lastMileShipping ?? product.shippingCost ?? 0),
    };
    const media = mediaFromProduct(product);
    const legacyCount = [product.img, ...(product.gallery ?? [])].filter(Boolean).length;
    if ((!product.media || product.media.length === 0) && legacyCount > 5) {
      this.notice.set('This legacy product had more than 5 images. Only the first 5 are shown and will be kept when you save.');
    }
    const storedMode = product.pricing?.mode ?? product.pricingMode;
    const mode = (storedMode === 'resale'
      && !product.pricing
      && !(Number(product.partnerPrice) > 0)
      ? 'direct'
      : (storedMode ?? (Number(product.partnerPrice) > 0 ? 'resale' : 'direct'))) as PricingMode;
    this.form.set({
      name: product.name ?? '',
      sku: product.sku ?? '',
      category: product.category ?? '',
      shortDesc: product.shortDesc ?? '',
      desc: product.desc ?? '',
      benefits: product.benefits ?? [],
      howToUse: product.howToUse ?? '',
      deliveryNote: product.deliveryNote ?? '',
      stock: typeof product.stock === 'number' ? product.stock : null,
      featured: product.featured === true,
      commissionable: product.commissionable === true,
      pricingMode: mode,
      mentorBonus: Number(product.mentorBonus ?? 0),
      price: typeof product.price === 'number' ? product.price : null,
      partnerPrice: typeof product.partnerPrice === 'number' ? product.partnerPrice : null,
      retailPrice: typeof product.retailPrice === 'number' ? product.retailPrice : null,
      costBreakdown: costs,
      media,
      targetPlatformContributionPct: Number(product.pricing?.targetPlatformContributionPct ?? 0.10),
      targetPartnerMarginPct: Number(product.pricing?.targetPartnerMarginPct ?? 0.30),
      sortOrder: typeof product.sortOrder === 'number' ? product.sortOrder : null,
      status: product.status ?? 'draft',
    });
    this.media.set(media);
    this.pricing.set(product.pricing ?? null);
  }

  protected setText(
    field: 'name' | 'sku' | 'category' | 'shortDesc' | 'desc' | 'howToUse' | 'deliveryNote',
    value: string,
  ): void {
    this.form.update((form) => ({ ...form, [field]: value }));
  }

  protected setNumber(
    field: 'stock' | 'mentorBonus' | 'sortOrder',
    value: number,
  ): void {
    this.form.update((form) => ({ ...form, [field]: Number.isFinite(value) ? value : null }));
    if (field === 'mentorBonus') this.pricing.set(null);
  }

  protected setPrice(
    field: 'price' | 'partnerPrice' | 'retailPrice',
    value: number,
  ): void {
    this.form.update((form) => ({ ...form, [field]: Number.isFinite(value) ? value : null }));
    this.pricing.set(null);
  }

  protected setMode(value: PricingMode): void {
    this.form.update((form) => ({
      ...form,
      pricingMode: value,
      ...(value === 'direct' ? { partnerPrice: null, retailPrice: null } : {}),
      ...(value === 'resale' ? { price: null } : {}),
    }));
    this.pricing.set(null);
  }

  protected setCommissionable(value: boolean): void {
    this.form.update((form) => ({ ...form, commissionable: value }));
    this.pricing.set(null);
  }

  protected setFeatured(value: boolean): void {
    this.form.update((form) => ({ ...form, featured: value }));
  }

  protected setStatus(value: AdminProductStatus): void {
    this.form.update((form) => ({ ...form, status: value }));
  }

  protected setCost(
    field: keyof Pick<ProductCostBreakdown,
      'manufacturing' | 'packaging' | 'inboundFreight' | 'duties' | 'other'
      | 'lastMileShipping' | 'handling' | 'acquisitionAllowance'>,
    value: number,
  ): void {
    this.form.update((form) => ({
      ...form,
      costBreakdown: {
        ...form.costBreakdown,
        [field]: Number.isFinite(value) ? Math.max(value, 0) : 0,
      },
    }));
    this.pricing.set(null);
  }

  protected setRate(
    field: 'paymentFeeRate' | 'refundReserveRate' | 'rankReserveRate',
    percent: number,
  ): void {
    const fallback = field === 'refundReserveRate' ? 3 : 1.5;
    const minimum = field === 'refundReserveRate' ? 3 : 1.5;
    this.form.update((form) => ({
      ...form,
      costBreakdown: {
        ...form.costBreakdown,
        [field]: Number.isFinite(percent)
          ? Math.min(Math.max(percent, minimum), 100) / 100
          : fallback / 100,
      },
    }));
    this.pricing.set(null);
  }

  protected setTarget(
    field: 'targetPlatformContributionPct' | 'targetPartnerMarginPct',
    percent: number,
  ): void {
    this.form.update((form) => ({
      ...form,
      [field]: Number.isFinite(percent) ? Math.min(Math.max(percent / 100, 0), 1) : 0,
    }));
    this.pricing.set(null);
  }

  protected setNotes(value: string): void {
    this.form.update((form) => ({
      ...form,
      costBreakdown: { ...form.costBreakdown, notes: value },
    }));
  }

  protected setBenefits(value: string): void {
    this.form.update((form) => ({
      ...form,
      benefits: value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 8),
    }));
  }

  protected goToStep(number: number): void {
    if (number < this.step() && !this.busy() && !this.previewing() && !this.uploading()) {
      this.step.set(number);
    }
  }

  protected back(): void {
    if (this.step() > 1 && !this.busy() && !this.previewing() && !this.uploading()) {
      this.step.set(this.step() - 1);
    }
  }

  protected async next(): Promise<void> {
    if (this.busy() || this.previewing() || this.uploading()) return;
    this.error.set(null);
    this.notice.set(null);

    if (this.step() === 1) {
      if (!this.form().name.trim()) {
        this.error.set('Enter the product name before continuing.');
        return;
      }
      if (!(await this.persist(false))) return;
      this.step.set(2);
      return;
    }

    if (this.step() === 2) {
      if (this.landingCost() <= 0) {
        this.error.set('Enter the manufacturing or landed product cost.');
        return;
      }
      if (!(await this.persist(false))) return;
      this.step.set(3);
      return;
    }

    if (this.step() === 3) {
      if (this.media().length < 1 || this.media().length > 5) {
        this.error.set('Add between 1 and 5 images or videos.');
        return;
      }
      if (!(await this.persist(false))) return;
      this.step.set(4);
      await this.calculatePricing();
      return;
    }

    if (this.step() === 4) {
      const pricing = await this.calculatePricing();
      if (!pricing?.canPublish) {
        this.error.set(pricing?.reasons?.[0] ?? 'Fix the pricing checks before continuing.');
        return;
      }
      if (!(await this.persist(false))) return;
      this.step.set(5);
    }
  }

  protected async saveDraft(): Promise<void> {
    if (this.busy() || this.previewing() || this.uploading()) return;
    this.error.set(null);
    this.notice.set(null);
    const saved = await this.persist(false);
    if (saved) this.notice.set('Draft saved.');
  }

  protected async publish(): Promise<void> {
    if (this.busy() || this.previewing() || this.uploading()) return;
    this.error.set(null);
    this.notice.set(null);
    if (this.media().length < 1 || this.media().length > 5) {
      this.error.set('Add between 1 and 5 images or videos.');
      return;
    }
    const pricing = await this.calculatePricing();
    if (!pricing?.canPublish) {
      this.error.set(pricing?.reasons?.[0] ?? 'Fix the pricing checks before publishing.');
      return;
    }
    const saved = await this.persist(true);
    if (saved) this.saved.emit(saved);
  }

  protected async calculatePricing(): Promise<ProductPricing | null> {
    if (this.previewing()) return this.pricing();
    this.previewing.set(true);
    this.error.set(null);
    try {
      const response = await firstValueFrom(this.products.previewPricing(this.form()));
      const pricing = response.data ?? null;
      this.pricing.set(pricing);
      return pricing;
    } catch (err) {
      this.error.set(userError(err as ApiError));
      return null;
    } finally {
      this.previewing.set(false);
    }
  }

  protected useSuggestedPrices(): void {
    const pricing = this.pricing();
    if (!pricing) return;
    const mode = this.form().pricingMode;
    if (mode === 'direct') {
      this.form.update((form) => ({
        ...form,
        price: pricing.recommendedPartnerPrice || form.price,
      }));
    } else if (mode === 'both') {
      this.form.update((form) => ({
        ...form,
        partnerPrice: pricing.recommendedPartnerPrice || form.partnerPrice,
        retailPrice: pricing.recommendedRetailPrice || form.retailPrice,
        price: Math.max(Number(form.price) || 0, pricing.recommendedRetailPrice || 0) || form.price,
      }));
    } else {
      this.form.update((form) => ({
        ...form,
        partnerPrice: pricing.recommendedPartnerPrice || form.partnerPrice,
        retailPrice: pricing.recommendedRetailPrice || form.retailPrice,
      }));
    }
    void this.calculatePricing();
  }

  protected async onFiles(event: Event): Promise<void> {
    if (this.busy() || this.uploading()) return;
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (files.length === 0) return;
    this.error.set(null);

    let id = this.productId();
    if (!id) {
      const saved = await this.persist(false);
      if (!saved) return;
      id = this.productId();
    }
    if (!id) {
      this.error.set('Save the product basics before uploading media.');
      return;
    }

    const remaining = 5 - this.media().length;
    if (remaining <= 0) {
      this.error.set('A product can have at most 5 media items.');
      return;
    }
    if (files.length > remaining) {
      this.error.set(`Only ${remaining} more media item${remaining === 1 ? '' : 's'} can be added.`);
    }

    this.uploading.set(true);
    for (const file of files.slice(0, remaining)) {
      const validation = this.validateFile(file);
      if (validation) {
        this.error.set(validation);
        continue;
      }
      try {
        const response = await firstValueFrom(this.products.uploadMedia(id, file));
        if (!response.data) continue;
        const uploaded = response.data;
        const item: ProductMedia = {
          ...uploaded,
          type: uploaded.type === 'video' ? 'video' : 'image',
          url: uploaded.url ?? '',
          order: this.media().length,
        };
        if (!item.url) continue;
        this.media.update((list) => [...list, item].slice(0, 5));
        this.form.update((form) => ({ ...form, media: this.media() }));
      } catch (err) {
        this.error.set(userError(err as ApiError));
      }
    }
    this.uploading.set(false);
  }

  protected async removeMedia(index: number): Promise<void> {
    if (this.busy() || this.uploading()) return;
    const item = this.media()[index];
    if (!item) return;
    const id = this.productId();
    const mediaId = String(item._id ?? item.id ?? '');
    if (id && mediaId) {
      try {
        await firstValueFrom(this.products.removeMedia(id, mediaId));
      } catch (err) {
        this.error.set(userError(err as ApiError));
        return;
      }
    }
    this.media.update((list) => list
      .filter((_, i) => i !== index)
      .map((entry, i) => ({ ...entry, order: i })));
    this.form.update((form) => ({ ...form, media: this.media() }));
  }

  protected moveMedia(index: number, delta: number): void {
    const target = index + delta;
    const list = [...this.media()];
    if (target < 0 || target >= list.length) return;
    const [item] = list.splice(index, 1);
    list.splice(target, 0, item);
    this.media.set(list.map((entry, i) => ({ ...entry, order: i })));
    this.form.update((form) => ({ ...form, media: this.media() }));
  }

  protected setCover(index: number): void {
    if (index === 0) return;
    this.moveMedia(index, -index);
  }

  protected mediaThumb(item: ProductMedia): string {
    return item.thumbnailUrl || item.url;
  }

  protected mediaId(item: ProductMedia): string {
    return String(item._id ?? item.id ?? item.url);
  }

  protected percent(value: number | null | undefined): number {
    return Math.round(Number(value ?? 0) * 1000) / 10;
  }

  private validateFile(file: File): string | null {
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) return `${file.name} is not an image or video.`;
    if (isImage && file.size > 8 * 1024 * 1024) return `${file.name} is larger than 8 MB.`;
    if (isVideo && file.size > 50 * 1024 * 1024) return `${file.name} is larger than 50 MB.`;
    return null;
  }

  private async persist(publish: boolean): Promise<AdminProduct | null> {
    this.busy.set(true);
    this.error.set(null);
    this.notice.set(null);
    try {
      const payload = { ...this.form(), media: this.media() };
      const id = this.productId();
      const response = id
        ? await firstValueFrom(this.products.update(id, payload, publish))
        : await firstValueFrom(this.products.create(payload, publish));
      const saved = response.data;
      if (!saved) {
        this.error.set('The server did not return the saved product.');
        return null;
      }
      const savedId = String(saved._id ?? saved.id ?? '');
      if (savedId) this.productId.set(savedId);
      if (saved.pricing) this.pricing.set(saved.pricing);
      return saved;
    } catch (err) {
      this.error.set(userError(err as ApiError));
      return null;
    } finally {
      this.busy.set(false);
    }
  }
}
