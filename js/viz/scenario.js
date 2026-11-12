// Paneel SCENARIO: keuze uit de vraagscenario's (chips) en de factoren (schuif of schakelaar).
// Een scenario verandert alleen de vraag. Een factor verhoogt de vraag of verlaagt het aanbod;
// beide horen bij de uitgangssituatie en tellen mee in de opgave.
import { el } from '../dom.js';
import { VRAAGJAREN, JAAR_MIN, scenarios, ingroei, isProcent } from '../model.js';
import { switchBtn } from './maatregelen.js';
import { attachTip, esc, f1, kv } from './tooltip.js';

let knoppen = [];
let factorRijen = [];       // [{ f, val, ctrl }]
const setFill = (r) => r.style.setProperty('--p', r.value + '%');

function scenarioTip(app, s, i) {
  const vraag = (j) => app.zicht(j, s.id).vraag0;
  return `<div class="th">Scenario ${i + 1} – ${esc(s.naam)}</div>`
    + (s.toelichting ? `<div class="tm">${esc(s.toelichting)}</div>` : '')
    + '<div class="sep"></div><div class="tm">Vraag incl. factoren, zonder besparing (Mm³/j' + (app.state.cluster ? `, ${esc(app.clusterNaam())}` : ', totaal') + ')</div>'
    + VRAAGJAREN.map((j) => kv(j, f1(vraag(j)))).join('')
    + '<div class="tm" style="margin-top:6px">Het scenario verandert alleen de vraag; het aanbod is in elk scenario gelijk.</div>';
}

function factorTip(app, f) {
  const r = app.resultaat().factoren[f.naam], jaar = app.state.jaar;
  const teken = f.werkt_op === 'vraag' ? '+' : '−';
  const stand = f.bediening === 'schakelaar' ? (r.stand > 0 ? 'aan' : 'uit') : `${Math.round(r.stand * 100)}%`;
  const plek = r.winning ? `winning ${r.winning} (${r.cluster})` : !r.cluster || r.cluster === 'alle' ? 'alle clusters (naar aandeel)' : r.cluster;
  return `<div class="th">${esc(f.naam)}</div>` + (f.toelichting ? `<div class="tm">${esc(f.toelichting)}</div>` : '')
    + kv('Werkt op', f.werkt_op === 'vraag' ? 'vraag (omhoog)' : 'aanbod (omlaag)')
    + kv('Effect bij 100%', isProcent(f) ? `${teken}${f1(f.effect ?? 0)}% van de ${f.werkt_op === 'vraag' ? 'vraag' : 'capaciteit'}` : `${teken}${f1(f.effect ?? 0)} Mm³/j`)
    + kv('Ingroei', f.van === f.tot ? `vanaf ${f.tot}` : `${f.van} → ${f.tot}`)
    + kv('Waar', plek) + kv('Stand', stand)
    + '<div class="sep"></div>' + kv(`Effect in ${jaar}`, `${teken}${f1(r.effect)} Mm³/j`)
    + (r.effect === 0 && r.stand > 0 && ingroei(f.van, f.tot, jaar) === 0 ? `<div class="tm">Begint pas in ${f.van}.</div>` : '');
}

export function bouw(app) {
  // vraagscenario's als chips (radiogroep)
  const box = document.querySelector('#scenRows');
  knoppen = scenarios(app.data).map((s, i) => {
    const b = el('button', { class: 'schip', type: 'button', role: 'radio', 'data-s': s.id, text: `${i + 1} ${s.naam}` });
    b.addEventListener('click', () => app.kies({ scenario: s.id }));
    attachTip(b, () => scenarioTip(app, s, i));
    return b;
  });
  box.replaceChildren(...knoppen);
  box.onkeydown = (e) => {
    const stap = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (!stap) return;
    e.preventDefault();
    const i = knoppen.findIndex((b) => b.dataset.s === app.state.scenario);
    const doel = knoppen[(i + stap + knoppen.length) % knoppen.length];
    doel.focus(); doel.click();
  };

  // factoren, gegroepeerd
  const lijst = document.querySelector('#factRows');
  const factoren = (app.data.factoren ?? []).filter((f) => f.naam);
  factorRijen = [];
  if (!factoren.length) {
    lijst.replaceChildren(el('div', { class: 'leegte' }, 'Geen factoren ingevoerd. ', el('a', { href: 'invoer.html', text: 'Naar Invoer' })));
    return;
  }
  const kinderen = [];
  let groep = null;
  for (const f of factoren) {
    if ((f.groep || 'Overig') !== groep) { groep = f.groep || 'Overig'; kinderen.push(el('div', { class: 'fkop', text: groep })); }
    const val = el('span', { class: 'fval' });
    let ctrl;
    if (f.bediening === 'schakelaar') {
      ctrl = switchBtn(app.state.standen[f.naam] > 0, f.naam, (v) => { app.state.standen[f.naam] = v ? 1 : 0; app.update(); });
    } else {
      ctrl = el('input', { type: 'range', class: 'fs', min: '0', max: '100', step: '5', 'aria-label': f.naam });
      ctrl.value = Math.round((app.state.standen[f.naam] ?? 0) * 100); setFill(ctrl);
      ctrl.addEventListener('input', () => { app.state.standen[f.naam] = ctrl.value / 100; setFill(ctrl); app.update(); });
    }
    const rij = el('div', { class: 'frow' }, el('span', { class: 'fnaam', text: f.naam }), val, el('span', { class: 'ctrl' }, ctrl));
    attachTip(rij, () => factorTip(app, f));
    factorRijen.push({ f, val, ctrl });
    kinderen.push(rij);
  }
  lijst.replaceChildren(...kinderen);
}

export function render(app, c) {
  for (const b of knoppen) {
    const aan = b.dataset.s === app.state.scenario;
    b.setAttribute('aria-checked', String(aan)); b.tabIndex = aan ? 0 : -1;
  }
  const r = app.resultaat();
  for (const { f, val, ctrl } of factorRijen) {
    const x = r.factoren[f.naam];
    const effect = app.state.cluster ? x.perCluster[app.state.cluster] ?? 0 : x.effect;
    val.textContent = effect < 0.05 ? f1(0) : (f.werkt_op === 'vraag' ? '+' : '−') + f1(effect);
    val.classList.toggle('nul', effect < 0.05);
    if (ctrl.type === 'range') { ctrl.value = Math.round(x.stand * 100); setFill(ctrl); }
    else ctrl.setAttribute('aria-checked', String(x.stand > 0));
  }
  const start = app.zicht(JAAR_MIN);
  const groei = c.vraag0 - start.vraag0;
  document.querySelector('#scenKern').replaceChildren(
    el('div', {}, el('b', { text: f1(c.vraag0) }), `vraag in ${c.jaar}`),
    el('div', {}, el('b', { text: (groei > 0.05 ? '+' : '') + f1(groei) }), `vraag t.o.v. ${JAAR_MIN}`),
    el('div', {}, el('b', { text: f1(c.aanbod0) }), 'bestaand aanbod'));
}
