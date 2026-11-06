import { ReferralService } from './referral.service';

describe('ReferralService', () => {
  let service: ReferralService;

  beforeEach(() => {
    localStorage.clear();
    service = new ReferralService('browser' as unknown as object);
  });

  afterEach(() => {
    localStorage.clear();
    jasmine.clock().uninstall();
  });

  it('stores and retrieves a partner referral', () => {
    service.remember({ username: 'ada', name: 'Ada', surname: 'Obi' });

    const partner = service.getPartner();

    expect(partner?.username).toBe('ada');
    expect(partner?.name).toBe('Ada');
    expect(partner?.surname).toBe('Obi');
    expect(localStorage.getItem('username')).toBe('ada');
  });

  it('migrates the legacy username key', () => {
    localStorage.setItem('username', 'legacy-partner');

    const partner = service.getPartner();

    expect(partner?.username).toBe('legacy-partner');
    expect(localStorage.getItem('dp-referral')).toContain('legacy-partner');
  });

  it('ignores the generic business attribution', () => {
    service.remember({ username: 'business' });
    localStorage.setItem('username', 'business');

    expect(service.getPartner()).toBeNull();
  });

  it('expires referrals after 30 days', () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-01-01T00:00:00Z'));
    service.remember({ username: 'ada' });

    jasmine.clock().mockDate(new Date('2026-02-01T00:00:01Z'));

    expect(service.getPartner()).toBeNull();
    expect(localStorage.getItem('dp-referral')).toBeNull();
  });

  it('clears stored attribution', () => {
    service.remember({ username: 'ada' });

    service.clear();

    expect(service.getPartner()).toBeNull();
    expect(localStorage.getItem('username')).toBeNull();
  });
});
