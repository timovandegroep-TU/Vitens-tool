// Paneel SCENARIO: keuze uit de narratieven (vervangt de scenariosliders uit de mockup).
import { el } from '../dom.js';
import { AANBODJAREN, NU, samenvatting } from '../model.js';
import { attachTip, esc, f1, kv } from './tooltip.js';

let knoppen = [];

export function bouw(app) {
  const box = document.querySelector('#scenRows');
  const totalen = samenvatting(app.data).aanbod;
  knoppen = app.data.narratieven.map((n) => {
    const b = el('button', { class: 'nrow', type: 'button', role: 'radio', 'data-n': n.id },
      el('span', { class: 'rond', 'aria-hidden': 'true' }), el('span', { text: `${n.id}  ${n.naam}` }), el('span', { class: 'delta', text: n.deltascenario ?? '' }));
    b.addEventListener('click', () => app.kies({ narratief: n.id }));
    attachTip(b, () => `<div class="th">Narratief ${esc(n.id)} – ${esc(n.naam)}</div>`
      + (n.toelichting ? `<div class="tm">${esc(n.toelichting)}</div>` : '')
      + (n.deltascenario ? kv('Vraag-deltascenario', n.deltascenario) : '')
      + (n.lpppd_doel != null ? kv('lpppd-doel', n.lpppd_doel) : '')
      + '<div class="sep"></div><div class="tm">Aanbod zonder maatregelen (Mm³/j, totaal)</div>'
      + AANBODJAREN.map((j, i) => kv(j === NU ? `${j} (huidig)` : j, f1(totalen[n.id][i]))).join(''));
    return b;
  });
  box.replaceChildren(...knoppen);
  // pijltjestoetsen binnen de radiogroep
  box.addEventListener('keydown', (e) => {
    const stap = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (!stap) return;
    e.preventDefault();
    const i = knoppen.findIndex((b) => Number(b.dataset.n) === app.state.narratief);
    const doel = knoppen[(i + stap + knoppen.length) % knoppen.length];
    doel.focus(); doel.click();
  });
}

export function render(app, c) {
  for (const b of knoppen) {
    const aan = Number(b.dataset.n) === app.state.narratief;
    b.setAttribute('aria-checked', String(aan)); b.tabIndex = aan ? 0 : -1;
  }
  const nu = app.zicht(NU);
  document.querySelector('#scenKern').replaceChildren(
    el('div', {}, el('b', { text: f1(c.vraag0) }), `vraag in ${c.jaar}`),
    el('div', {}, el('b', { text: f1(c.aanbod0) }), 'aanbod zonder maatr.'),
    el('div', {}, el('b', { text: (c.aanbod0 - nu.aanbod0 > 0.05 ? '+' : '') + f1(c.aanbod0 - nu.aanbod0) }), `aanbod t.o.v. ${NU}`));
}
