// Tooltip en kleine opmaakhulpjes (overgenomen uit de mockup: showTip / attachTip).
const tip = typeof document === 'undefined' ? null : document.querySelector('#tip');   // null in Node (tests)
let tipFn = null;

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf1 = new Intl.NumberFormat('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
/** Eén decimaal, nl-NL; −0,0 wordt 0,0. */
export const f1 = (v) => nf1.format(Math.abs(v) < 0.05 ? 0 : v);
/** Regel "label … waarde" (beide worden ge-escaped). */
export const kv = (k, v) => `<div class="kv"><span>${esc(k)}</span><b>${esc(v)}</b></div>`;

function placeTip(x, y) {
  const pad = 14, r = tip.getBoundingClientRect();
  let L = x + pad, T = y + pad;
  if (L + r.width > innerWidth - 8) L = x - r.width - pad;
  if (T + r.height > innerHeight - 8) T = y - r.height - pad;
  tip.style.left = Math.max(8, L) + 'px'; tip.style.top = Math.max(8, T) + 'px';
}
/** Toon de tooltip; `fn` geeft de HTML en wordt opnieuw aangeroepen bij `ververs()`. */
export function showTip(fn, x, y, sleutel = '') { tipFn = fn; tip.dataset.k = sleutel; tip.innerHTML = fn(); tip.hidden = false; placeTip(x, y); }
export function moveTip(x, y) { if (tipFn) placeTip(x, y); }
export function hideTip() { tip.hidden = true; tipFn = null; tip.dataset.k = ''; }
export const tipSleutel = () => (tip.hidden ? null : tip.dataset.k);
/** Na een update: inhoud van een open tooltip bijwerken. */
export function ververs() { if (!tip.hidden && tipFn) tip.innerHTML = tipFn(); }

export function attachTip(node, fn) {
  node.addEventListener('pointerenter', (e) => showTip(fn, e.clientX, e.clientY));
  node.addEventListener('pointermove', (e) => moveTip(e.clientX, e.clientY));
  node.addEventListener('pointerleave', hideTip);
  node.addEventListener('focusin', () => { const r = node.getBoundingClientRect(); showTip(fn, r.left, r.bottom); });
  node.addEventListener('focusout', hideTip);
}
