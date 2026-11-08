/**
 * In-page anchor navigation needs help in this app: the store is served with
 * `<base href="/">`, so a plain `href="#section"` resolves against the site
 * root and navigates away from routes such as `/lead/:username`.
 *
 * Call this from a click handler instead. It keeps the visitor on the current
 * route, smooth-scrolls to the target and records the anchor in the URL.
 */
export function scrollToSection(event: Event | null, id: string, behavior?: ScrollBehavior | 'instant'): void {
  event?.preventDefault();
  if (typeof document === 'undefined') return;

  const target = document.getElementById(id);
  if (!target) return;

  const reduceMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  target.scrollIntoView({
    behavior: behavior ?? (reduceMotion ? 'auto' : 'smooth'),
    block: 'start',
  });
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });

  if (event) {
    try {
      history.replaceState(null, '', `${location.pathname}${location.search}#${id}`);
    } catch {
      /* history is unavailable in some embedded contexts */
    }
  }
}
