import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { httpCacheInterceptor } from '@marketspase/shared/core/http/http-cache.interceptor';
import { NetworkStatusService } from '@marketspase/shared/core/ui/network-status.service';

describe('httpCacheInterceptor in-flight GET sharing', () => {
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([httpCacheInterceptor])),
        provideHttpClientTesting(),
        { provide: NetworkStatusService, useValue: { noteCacheHit: () => undefined } },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
    TestBed.resetTestingModule();
  });

  it('serves two concurrent identical GETs from one network request', () => {
    const received: unknown[] = [];

    http.get('/v1/test-read').subscribe((value) => received.push(value));
    http.get('/v1/test-read').subscribe((value) => received.push(value));

    const request = backend.expectOne('/v1/test-read');
    request.flush({ ok: true });

    expect(received).toEqual([{ ok: true }, { ok: true }]);
  });
});
