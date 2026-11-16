import { inject, Injectable, signal } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { LeadPipelineService } from '../../../prospects/lead-pipeline/lead-pipeline.service';
import { RELATIONSHIP_TAGS } from '../../../prospects/lead-pipeline/lead.models';
import { ApiError } from '../../../../../core/http/api-error';

const NG_PHONE_RE = /^(?:\+?234|0)([789]\d{9})$/;
const nigerianPhoneValidator = (control: AbstractControl): ValidationErrors | null => {
  const raw = String(control.value ?? '');
  if (!raw.trim()) return null;
  return NG_PHONE_RE.test(raw.replace(/[\s\-()]/g, '')) ? null : { ngPhone: true };
};

const toHHMM = (d: Date): string => {
  const pad = (v: number): string => String(v).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Shared edit-contact form, load and save state. */
@Injectable()
export class EditContactsFacade {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly leads = inject(LeadPipelineService);
  private readonly fb = inject(FormBuilder);

  readonly prospectId = this.route.snapshot.paramMap.get('id');
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly formError = signal<string | null>(null);
  readonly prospectName = signal('');
  readonly tags = RELATIONSHIP_TAGS;
  form: FormGroup | null = null;
  private started = false;

  ensureLoaded(): void {
    if (this.started) return;
    this.started = true;
    if (this.prospectId) this.load();
  }

  load(): void {
    if (!this.prospectId) return;
    this.loading.set(true);
    this.error.set(null);
    this.leads.getById(this.prospectId).subscribe({
      next: (res) => {
        const p = (res as unknown as { data?: Record<string, unknown> })?.data as Record<string, unknown>
          ?? (res as unknown as Record<string, unknown>);
        const prospect = (p['prospect'] ?? p) as Record<string, unknown>;
        const data = prospect ?? p;
        const name = String(data['prospectName'] ?? '');
        const surname = String(data['prospectSurname'] ?? '');
        this.prospectName.set(`${name} ${surname}`.trim() || name);
        this.form = this.fb.group({
          prospectName: [String(data['prospectName'] ?? ''), [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
          prospectSurname: [String(data['prospectSurname'] ?? '')],
          prospectPhone: [String(data['prospectPhone'] ?? ''), [Validators.required, nigerianPhoneValidator]],
          prospectEmail: [String(data['prospectEmail'] ?? ''), [Validators.email]],
          prospectSource: [String(data['prospectSource'] ?? 'Contact List'), Validators.required],
          relationship: [String(data['relationship'] ?? 'Other')],
          priority: [String(data['priority'] ?? 'normal')],
          bestTimeToCall: [data['bestTimeToCall'] ? new Date(`1970-01-01T${String(data['bestTimeToCall'])}`) : null],
          consentToContact: [Boolean(data['consentToContact'])],
          notes: [String(data['notes'] ?? data['prospectRemark'] ?? '')],
        });
        this.loading.set(false);
      },
      error: (err: ApiError) => {
        this.error.set(err.message);
        this.loading.set(false);
      },
    });
  }

  back(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      void this.router.navigate(['/dashboard/prospects/pipeline']);
    }
  }

  save(): void {
    const form = this.form;
    if (!form) return;
    Object.keys(form.controls).forEach((k) => form.get(k)?.markAsTouched());
    if (form.invalid || !this.prospectId || this.saving()) return;
    const v = form.getRawValue();
    this.saving.set(true);
    this.formError.set(null);
    this.notice.set(null);
    this.leads.updateContact(this.prospectId, {
      prospectName: String(v.prospectName).trim(),
      prospectSurname: String(v.prospectSurname).trim(),
      prospectPhone: String(v.prospectPhone).trim(),
      prospectEmail: String(v.prospectEmail).trim() || undefined,
      prospectSource: String(v.prospectSource).trim(),
      relationship: v.relationship,
      priority: v.priority,
      bestTimeToCall: v.bestTimeToCall instanceof Date ? toHHMM(v.bestTimeToCall) : String(v.bestTimeToCall ?? '').trim(),
      consentToContact: Boolean(v.consentToContact),
      notes: String(v.notes ?? '').trim(),
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.notice.set('Contact updated.');
        void this.router.navigate(['/dashboard/prospects/pipeline']);
      },
      error: (err: ApiError) => {
        this.saving.set(false);
        this.formError.set(err.message);
      },
    });
  }
}
