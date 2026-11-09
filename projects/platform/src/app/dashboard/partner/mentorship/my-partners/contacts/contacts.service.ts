import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, timeout } from 'rxjs';
import { retry, catchError } from 'rxjs/operators';
import { environment } from '../../../../../../environments/environment';

export interface ProspectContact {
  _id?: string;
  id?: string;
  prospectName?: string;
  prospectSurname?: string;
  prospectEmail?: string | null;
  prospectPhone?: string | null;
  phoneHiddenReason?: 'no-phone' | 'not-direct' | 'no-consent' | null;
  emailHiddenReason?: 'no-email' | 'not-direct' | 'no-consent' | null;
  consentToContact?: boolean;
  bestTimeToCall?: string;
  prospectSource?: string;
  prospectRemark?: string;
  notes?: string;
  status?: string | { name?: string; stage?: string };
  createdAt?: string | Date;
  updatedAt?: string | Date;
  partnerId?: string;
}

export interface ContactsInterface {
  message: string;
  data?: ProspectContact[];
}

export interface ProspectStatusUpdate {
  name: string;
  note?: string;
  paydayDate?: string | Date;
  expectedDecisionDate?: string | Date;
  onboardingDate?: string | Date;
}

export interface BulkStatusResult {
  message: string;
  success: boolean;
  data: {
    updated: string[];
    skipped: Array<{ prospectId: string; reason: string }>;
  };
}

export interface ContactListQuery {
  q?: string;
  status?: string;
  /** all | attention | unworked | hot | converted | archived */
  attention?: string;
  /** all | link | other */
  channel?: string;
  /** attention | newest | oldest | stuck | name */
  sort?: string;
  page?: number;
  limit?: number;
  /** '1' to include full-list health counts */
  stats?: '1';
}

export interface ContactListStats {
  total: number;
  attention: number;
  unworked: number;
  hot: number;
  converted: number;
  archived: number;
}

export interface ContactListPage {
  message: string;
  success: boolean;
  data: ProspectContact[];
  meta: {
    total: number;
    page: number;
    limit: number;
    pages: number;
    stats?: ContactListStats | null;
  };
}
  

@Injectable()
export class ContactsService {
  // Define API
  /** Base URL comes from the Angular environment (dev/prod swapped at build). */
  apiURL = environment.apiUrl;

  
  constructor(private http: HttpClient) {}
  /*========================================
    CRUD Methods for consuming RESTful API
  =========================================*/
  // Http Options
  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
    }),
  };

  // Error handling
  private handleError(error: any) {
    let errorMessage: {code: string, message: string};
    if (error.error instanceof ErrorEvent) {
      // Get client-side error
      errorMessage = error.error.message;
    } else {
      // Get server-side error
      errorMessage = {'code': error.status, 'message': error.message};
    }
    //window.alert(errorMessage);
    return throwError(() => {
      return errorMessage;
    });
  }


  // contact creatioin
  create(dataObject: ContactsInterface): Observable<ContactsInterface> {
    return this.http
      .post<ContactsInterface>(this.apiURL + `/prospect/create`, dataObject, { withCredentials: true })
      .pipe(retry(1), catchError(this.handleError));
  }

  // contact creatioin
  update(dataObject: ContactsInterface): Observable<ContactsInterface> {
    return this.http
      .put<ContactsInterface>(this.apiURL + `/prospect/update`, dataObject, { withCredentials: true })
      .pipe(retry(1), catchError(this.handleError));
  }

  // get contacts createdBy (owner = downline partner id)
  getContactsCreatedBy(createdBy: string): Observable<ContactsInterface> {
    return this.http
      .get<ContactsInterface>(this.apiURL + `/prospect/all-createdBy/${createdBy}`, { withCredentials: true })
      .pipe(retry(1), catchError(this.handleError));
  }

  /** Legacy typo alias — kept so older callers keep compiling. */
  getContctsCreatedBy(createdBy: string): Observable<ContactsInterface> {
    return this.getContactsCreatedBy(createdBy);
  }

  /**
   * Server-paged coaching query (?page&limit&q&status&attention&channel&sort&stats).
   * Prefer over getContactsCreatedBy for lists — filtering/sorting/counts run in Mongo.
   */
  getContactsPage(createdBy: string, query: ContactListQuery): Observable<ContactListPage> {
    const params: Record<string, string> = {};
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      params[key] = String(value);
    }
    return this.http
      .get<ContactListPage>(this.apiURL + `/prospect/all-createdBy/${createdBy}`, { params, withCredentials: true })
      // A hung API (e.g. unreachable Mongo buffers the query forever) must
      // surface as an error banner, never an eternal spinner.
      .pipe(retry(1), timeout(30000), catchError(this.handleError));
  }

  // get contacts createdby
  import(partnerId: string): Observable<ContactsInterface> {
    return this.http
      .get<ContactsInterface>(this.apiURL + `/prospect/import/${partnerId}`, { withCredentials: true })
      .pipe(retry(1), catchError(this.handleError));
  }

  // get prospect byId
  getProspectById(prospectId: string): Observable<ContactsInterface> {
    return this.http
      .get<ContactsInterface>(this.apiURL + `/prospect/getById/${prospectId}`, { withCredentials: true })
      .pipe(retry(1), catchError(this.handleError));
  }

  // update prospect status — object shape { name, note?, paydayDate?,
  // expectedDecisionDate?, onboardingDate? } (whole-subdoc replace server-side;
  // a bare string would destructure to undefined and persist nothing).
  updateProspectStatus(obj: { status: ProspectStatusUpdate; prospectId: string }): Observable<ContactsInterface> {
    return this.http
      .post<ContactsInterface>(this.apiURL + `/prospect/updateStatus`, obj, { withCredentials: true })
      .pipe(retry(1), catchError(this.handleError));
  }

  /** Bulk coach action: move N prospects to one stage. Fail-soft per id is handled by caller. */
  updateManyStatuses(prospectIds: string[], status: string): Observable<BulkStatusResult> {
    return this.http
      .post<BulkStatusResult>(this.apiURL + `/prospect/updateStatusMany`, { prospectIds, status }, { withCredentials: true })
      .pipe(retry(1), timeout(30000), catchError(this.handleError));
  }

  // update prospect remark
  updateProspectRemark(obj: {remark: string; prospectId: string}): Observable<ContactsInterface> {
    return this.http
      .post<ContactsInterface>(this.apiURL + `/prospect/updateRemark`, obj, { withCredentials: true })
      .pipe(retry(1), catchError(this.handleError));
  }

  // delete prospect - session-owned v1 DELETE (legacy GET-as-delete retired)
  deleteProspect(id: string): Observable<ContactsInterface> {
    return this.http
      .delete<ContactsInterface>(this.apiURL + `/v1/prospects/${id}`, { withCredentials: true })
      .pipe(retry(1), catchError(this.handleError));
  }

  // submit booking — session-authenticated (server requires a partner session)
   bookSurvey(formData: any): Observable<any> {
     return this.http
       .post<any>(this.apiURL + '/booking/submit', formData, { withCredentials: true })
      .pipe(retry(1), catchError(this.handleError));
  }
}

/* ------------------------------------------------------------------ */
/* Shared coaching helpers (pure — safe for signals/computed).         */
/* ------------------------------------------------------------------ */

export const CONTACT_STATUSES: string[] = [
  'New Prospect', 'Contacted', 'Follow-Up Scheduled', 'Engaged',
  'Sent Information', 'Awaiting Response', 'Interested', 'Nurturing',
  'Closing', 'Booked for Session', 'Member', 'Not Interested',
  'Disqualified', 'Inactive', 'Re-engagement', 'Archive', 'Partner',
];

const CONVERTED = new Set(['member', 'partner']);
const ARCHIVED = new Set(['not interested', 'disqualified', 'inactive', 'archive']);
const HOT = new Set(['interested', 'closing', 'booked for session']);

export function contactId(c: ProspectContact): string {
  return String(c._id ?? c.id ?? '');
}

export function statusLabelOf(c: Pick<ProspectContact, 'status'>): string {
  const s: unknown = c.status;
  if (s && typeof s === 'object') {
    const v = (s as { name?: unknown; stage?: unknown }).name
      ?? (s as { name?: unknown; stage?: unknown }).stage;
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  if (typeof s === 'string' && s.trim()) return s.trim();
  return 'New Prospect';
}

export function statusToneOf(label: string): string {
  const l = label.toLowerCase();
  if (CONVERTED.has(l)) return 'dp-status--ok';
  if (HOT.has(l)) return 'dp-status--warn';
  if (ARCHIVED.has(l)) return 'dp-status--bad';
  if (/contacted|follow|engaged|sent|awaiting|nurturing|re-engagement/.test(l)) return 'dp-status--info';
  return 'dp-status--neutral';
}

export function isConvertedLabel(label: string): boolean {
  return CONVERTED.has(label.toLowerCase());
}

export function isArchivedLabel(label: string): boolean {
  return ARCHIVED.has(label.toLowerCase());
}

export function isHotLabel(label: string): boolean {
  return HOT.has(label.toLowerCase());
}

export function daysSince(dateLike: string | Date | undefined | null, now = Date.now()): number {
  if (!dateLike) return 0;
  const t = new Date(dateLike).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((now - t) / 86_400_000));
}

/** Stuck = untouched 7d+ (active only) OR unworked 48h+. Converted/archived never flag. */
export function needsAttention(c: ProspectContact, now = Date.now()): boolean {
  const label = statusLabelOf(c);
  if (isConvertedLabel(label) || isArchivedLabel(label)) return false;
  const updated = c.updatedAt ?? c.createdAt;
  if (daysSince(updated, now) >= 7) return true;
  if (label.toLowerCase() === 'new prospect' && daysSince(c.createdAt, now) >= 2) return true;
  return false;
}

export function isUnworked(c: ProspectContact): boolean {
  const label = statusLabelOf(c).toLowerCase();
  return label === 'new prospect' && !isConvertedLabel(label) && !isArchivedLabel(label);
}

export function fullNameOf(c: ProspectContact): string {
  return `${c.prospectName ?? ''} ${c.prospectSurname ?? ''}`.trim() || 'Prospect';
}
