// Paneel SCENARIO: keuze uit de vraagscenario's. Een scenario verandert alleen de vraag;
// het aanbod (bestaande winningen ± maatregelen) is in elk scenario gelijk.
import { el } from '../dom.js';
import { VRAAGJAREN, JAAR_MIN, scenarios } from '../model.js';
import { attachTip, esc, f1, kv } from './tooltip.js';

let knoppen = [];

export function bouw(app) {
  const box = document.querySelector('#scenRows');
  const vraag = (id, j) => app.zicht(j, id).vraag0;
  knoppen = scenarios(app.data).map((s, i) => {
    const b = el('button', { class: 'nrow', type: 'button', role: 'radio', 'data-s': s.id },
      el('span', { class: 'rond', 'aria-hidden': 'true' }), el('span', { class: 'snaam', text: `${i + 1}  ${s.naam}` }), el('span', { class: 'delta' }));
    b.addEventListener('click', () => app.kies({ scenario: s.id }));
    attachTip(b, () => `<div class="th">Scenario ${i + 1} – ${esc(s.naam)}</div>`
      + (s.toelichting ? `<div class="tm">${esc(s.toelichting)}</div>` : '')
      + '<div class="sep"></div><div class="tm">Vraag zonder besparing (Mm³/j' + (app.state.cluster ? `, ${esc(app.clusterNaam())}` : ', totaal') + ')</div>'
      + VRAAGJAREN.map((j) => kv(j, f1(vraag(s.id, j)))).join('')
      + '<div class="tm" style="margin-top:6px">Het scenario verandert alleen de vraag; het aanbod is in elk scenario gelijk.</div>');
    return b;
  });
  box.replaceChildren(...knoppen);
  // pijltjestoetsen binnen de radiogroep
  box.addEventListener('keydown', (e) => {
    const stap = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (!stap) return;
    e.preventDefault();
    const i = knoppen.findIndex((b) => b.dataset.s === app.state.scenario);
    const doel = knoppen[(i + stap + knoppen.length) % knoppen.length];
    doel.focus(); doel.click();
  });
}

export function render(app, c) {
  for (const b of knoppen) {
    const aan = b.dataset.s === app.state.scenario;
    b.setAttribute('aria-checked', String(aan)); b.tabIndex = aan ? 0 : -1;
    // rechts: vraag van dit scenario in het zichtjaar
    b.querySelector('.delta').textContent = `${f1(app.zicht(app.state.jaar, b.dataset.s).vraag0)} in ${app.state.jaar}`;
  }
  const start = app.zicht(JAAR_MIN);
  const groei = c.vraag0 - start.vraag0;
  document.querySelector('#scenKern').replaceChildren(
    el('div', {}, el('b', { text: f1(c.vraag0) }), `vraag in ${c.jaar}`),
    el('div', {}, el('b', { text: (groei > 0.05 ? '+' : '') + f1(groei) }), `vraag t.o.v. ${JAAR_MIN}`),
    el('div', {}, el('b', { text: f1(c.aanbod0) }), 'bestaand aanbod'));
}
