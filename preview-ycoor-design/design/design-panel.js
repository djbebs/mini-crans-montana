import { createCoverageSection } from './coverage-section.js?v=5';

const node = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

/** A compact inventory drawer; source evidence remains in the project files. */
export async function createDesignPanel({ assetBaseUrl, inventory, onFocusFace, onViewChange, onClose }) {
  const panel = node('section', 'design-panel');
  panel.id = 'design-panel';
  panel.hidden = true;
  panel.setAttribute('aria-labelledby', 'design-heading');
  const heading = node('h2', '', 'Ycoor · couverture des faces');
  heading.id = 'design-heading';
  const close = node('button', 'design-close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', 'Fermer l’inventaire des faces');
  close.title = 'Fermer · Échap';
  const header = node('header', 'design-header');
  header.append(heading, close);
  const body = node('div', 'design-body');
  let previousFocus = null, disposed = false;
  function setOpen(value) {
    if (disposed || Boolean(value) === !panel.hidden) return;
    panel.hidden = !value;
    if (value) { previousFocus = document.activeElement; close.focus({ preventScroll: true }); }
    else if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  }
  function closePanel() { setOpen(false); onClose?.(); }
  body.append(createCoverageSection({ inventory, assetBaseUrl,
    onFocusFace: typeof onFocusFace === 'function' ? id => { if (onFocusFace(id) === true) closePanel(); } : undefined,
  }));
  panel.append(header, body);
  const onKey = event => {
    if (!panel.hidden && event.key === 'Escape') { event.preventDefault(); closePanel(); }
  };
  close.addEventListener('click', closePanel);
  document.addEventListener('keydown', onKey);
  return {
    element: panel,
    get view() { return 'coverage'; },
    setOpen,
    showCoverage() {
      if (disposed) return;
      setOpen(true);
      body.scrollTop = 0;
      onViewChange?.('coverage');
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      close.removeEventListener('click', closePanel);
      document.removeEventListener('keydown', onKey);
      panel.remove();
    },
  };
}
