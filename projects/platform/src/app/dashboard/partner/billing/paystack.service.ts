// paystack.service.ts
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, retry, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';


export interface TransactionInterface {
  message: string;
  data: Array<{
    amount: number;
    reference: string;
    status: string;
    paymentStatus?: boolean;
    date: Date;
  }>;
}

export interface BankOption {
  name: string;
  code: string;
}

export interface ResolvedAccount {
  accountName: string;
  accountNumber: string;
}

export interface SavedWithdrawalAccount {
  bankCode: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  accountLast4: string;
  savedAt?: string | null;
}

export interface SavedWithdrawalAccountResult {
  saved: boolean;
  account: SavedWithdrawalAccount | null;
}

export interface WithdrawalRequest {
  bankCode: string;
  bankName: string;
  accountNumber: string;
  amountNgn: number;
  saveAccount?: boolean;
}

export interface WithdrawalResult {
  reference: string;
  amountNgn: number;
  status: string;
  balance: number | null;
  bank: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  payoutMode?: 'automatic' | 'manual';
  transferStatus?: string | null;
  transferCode?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class PaystackService {
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

  // get transactions
   getTransactions(partnerId: string): Observable<any> {
    return this.http
      .get<any>(this.apiURL + `/billing/transaction/${partnerId}`, { withCredentials: true })
      .pipe(retry(1), catchError(this.handleError));
  }

  // withdraw request — server re-resolves the account with Paystack.
  requestWithdrawal(payload: WithdrawalRequest): Observable<{ data: WithdrawalResult; message: string; success: boolean }> {
    return this.http.post<{ data: WithdrawalResult; message: string; success: boolean }>(
      this.apiURL + `/v1/billing/withdrawals`,
      payload,
      { withCredentials: true },
    );
  }

  /**
   * Bank directory — proxied through the backend (`GET /v1/billing/banks`)
   * so production browsers never depend on Paystack CORS.
   */
  banks(): Observable<BankOption[]> {
    return this.http
      .get<{ data: BankOption[] }>(this.apiURL + `/v1/billing/banks`, { withCredentials: true })
      .pipe(map((res) => res.data ?? []), retry(1), catchError(this.handleError));
  }

  /**
   * Resolve a bank account holder — proxied through the backend
   * (`GET /v1/billing/resolve-account`) so the Paystack secret key
   * never ships to clients. Replaces direct api.paystack.co calls.
   */
  resolveAccount(accountNumber: string, bankCode: string): Observable<ResolvedAccount> {
    return this.http
      .get<{ data: ResolvedAccount }>(
        this.apiURL + `/v1/billing/resolve-account?accountNumber=${encodeURIComponent(accountNumber)}&bankCode=${encodeURIComponent(bankCode)}`,
        { withCredentials: true },
      )
      .pipe(map((res) => res.data));
  }

  /** Owner-scoped saved payout destination for the withdrawal dialog. */
  savedWithdrawalAccount(): Observable<SavedWithdrawalAccountResult> {
    return this.http
      .get<{ data: SavedWithdrawalAccountResult }>(
        this.apiURL + '/v1/billing/withdrawal-account',
        { withCredentials: true },
      )
      .pipe(map((res) => res.data), catchError(this.handleError));
  }
}
