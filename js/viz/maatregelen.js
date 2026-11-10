// Paneel MAATREGELEN: één schakelaar per maatregel-dataobject, gegroepeerd per spoor.
import { el } from '../dom.js';
import { ALLE_CLUSTERS } from '../model.js';
import { SPOREN, KEUZES, maatregelWeergave } from '../schema.js';
import { attachTip, esc, f1, kv } from './tooltip.js';

/** Schakelaar uit de mockup. */
export function switchBtn(on, label, cb, big) {
  const b = el('button', { class: 'sw' + (big ? ' big' : ''), type: 'button', role: 'switch', 'aria-checked': String(!!on), 'aria-label': label });
  b.addEventListener('click', (e) => { e.stopPropagation(); if (b.disabled) return; const v = b.getAttribute('aria-checked') !== 'true'; b.setAttribute('aria-checked', String(v)); cb(v); });
  return b;
}

let rijen = [];          // [{ m, row, val, sw }]

/** Maatregelen die in dit narratief (en bij een clusterfilter: op dit cluster) spelen. */
function zichtbaar(app) {
  const { narratief, cluster } = app.state;
  return app.data.maatregelen.filter((m) => (m.narratieven ?? []).includes(narratief)
    && (!cluster || m.cluster === cluster || m.cluster === ALLE_CLUSTERS));
}

function tip(app, m) {
  const r = app.resultaat().maatregelen[m.id], w = maatregelWeergave(m), jaar = app.state.jaar;
  const bijdrage = app.state.cluster ? r.perCluster[app.state.cluster] ?? 0 : r.volume;
  const teken = m.soort === 'waterbesparing' ? '−' : '+';
  const stand = app.geblokkeerd.has(m.id) ? 'niet meegerekend: fouten in de aanlevering'
    : !r.teltMee ? 'niet meegerekend (v1)' : !r.aan ? 'uit' : bijdrage > 0 ? 'telt mee' : `nog niet: gaat in per ${m.ingangsjaar}`;
  return `<div class="th">${esc(m.naam)}</div>` + (w.omschrijving ? `<div class="tm">${esc(w.omschrijving)}</div>` : '')
    + w.regels.map(([k, v]) => kv(k, v)).join('')
    + '<div class="sep"></div>'
    + kv(`Bijdrage in ${jaar}` + (app.state.cluster ? ' (dit cluster)' : ''), `${teken}${f1(bijdrage)} Mm³/j`) + kv('Stand', stand)
    + (w.effecten.length ? '<div class="sep"></div>' + w.effecten.map((e) => kv(e.label, e.beoordeling ?? '–')).join('') : '')
    + (m.overige_effecten?.politiek ? `<div class="tm" style="margin-top:6px">Politiek: ${esc(m.overige_effecten.politiek)}</div>` : '')
    + (w.noten.length ? '<div class="sep"></div>' + w.noten.map((n) => `<div class="tm">${esc(n)}</div>`).join('') : '');
}

/** Bouw de lijst opnieuw (bij start en bij wisselen van narratief of cluster). */
export function bouw(app) {
  const box = document.querySelector('#measRows');
  const lijst = zichtbaar(app);
  rijen = [];
  if (!lijst.length) {
    box.replaceChildren(el('div', { class: 'leegte' }, app.data.maatregelen.length ? 'Geen maatregelen voor dit narratief' + (app.state.cluster ? ' en dit cluster.' : '.') : 'Nog geen maatregelen aangeleverd. ',
      app.data.maatregelen.length ? null : el('a', { href: 'invoer.html', text: 'Naar Invoer' })));
    return;
  }
  const kinderen = [];
  for (const spoor of [...KEUZES.spoor, null]) {
    const groep = lijst.filter((m) => (KEUZES.spoor.includes(m.spoor) ? m.spoor : null) === spoor);
    if (!groep.length) continue;
    kinderen.push(el('div', { class: 'mgroep', text: spoor ? SPOREN[spoor] : 'Zonder spoor' }));
    for (const m of groep) {
      const vast = m.leverancier !== 'Vitens' || app.geblokkeerd.has(m.id);
      const sw = switchBtn(!vast && app.state.aan[m.id], m.naam, (v) => { app.state.aan[m.id] = v; app.update(); }, true);
      sw.disabled = vast;
      const w = maatregelWeergave(m);
      const naam = el('div', { class: 'mname' }, w.naam,
        m.leverancier !== 'Vitens' ? el('small', { text: `${m.leverancier} · niet meegerekend (v1)` }) : app.geblokkeerd.has(m.id) ? el('small', { text: 'niet meegerekend: fouten in de aanlevering' }) : null);
      const val = el('div', { class: 'mval' });
      const row = el('div', { class: 'mrow' + (vast ? ' vast' : '') }, sw, naam, val, el('div', { class: 'spoor', text: m.spoor ?? '–' }));
      if (!vast) row.addEventListener('click', () => sw.click());
      attachTip(row, () => tip(app, m));
      rijen.push({ m, row, val, sw, vast });
      kinderen.push(row);
    }
  }
  box.replaceChildren(...kinderen);
  box.scrollTop = 0;
}

export function render(app) {
  const r = app.resultaat();
  for (const { m, row, val, sw, vast } of rijen) {
    const mr = r.maatregelen[m.id];
    const v = app.state.cluster ? mr.perCluster[app.state.cluster] ?? 0 : mr.volume;
    val.textContent = (m.soort === 'waterbesparing' ? '−' : '+') + f1(v);
    const aan = !vast && app.state.aan[m.id];
    row.classList.toggle('off', !aan || v <= 0);
    sw.setAttribute('aria-checked', String(!!aan));
  }
}
