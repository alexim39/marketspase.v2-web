import { ADMIN_NAV } from './admin-nav.config';

describe('ADMIN_NAV', () => {
  it('has unique group keys and menu links', () => {
    const keys = ADMIN_NAV.map((group) => group.key);
    expect(new Set(keys).size).toBe(keys.length);

    const links = ADMIN_NAV.flatMap((group) => group.children.map((item) => item.link));
    expect(new Set(links).size).toBe(links.length);
  });

  it('keeps one decision-summaries destination and the core admin routes', () => {
    const links = ADMIN_NAV.flatMap((group) => group.children.map((item) => item.link));
    expect(links.filter((link) => link.startsWith('/summaries/'))).toEqual(['/summaries/overview']);

    for (const link of [
      '/roles', '/activation', '/stores', '/finance/transactions',
      '/broadcast', '/ora', '/tickets', '/settings',
    ]) {
      expect(links).toContain(link);
    }
  });

  it('gives every item a label and search keywords', () => {
    for (const group of ADMIN_NAV) {
      expect(group.children.length).toBeGreaterThan(0);
      for (const item of group.children) {
        expect(item.label.trim()).not.toBe('');
        expect(item.keywords?.length ?? 0).toBeGreaterThan(0);
      }
    }
  });
});
