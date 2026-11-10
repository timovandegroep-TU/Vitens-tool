// Paneel EFFECTEN GEMEENTEN: effecten van de actieve maatregelen, of de afname per bestaande winning.
import { el } from '../dom.js';
import { winningInJaar, ALLE_CLUSTERS } from '../model.js';
import { VOETAFDRUK } from '../schema.js';
import { NIVEAUS, VOETAFDRUK_NIVEAU, AFNAME_DREMPELS } from '../config.js';
import * as kaart from './kaart.js';
import { esc, f1, kv } from './tooltip.js';

const LEGENDA = {
  maatregelen: [['knelpunt', 'knelpunt'], ['aandacht', 'aandacht'], ['kans', 'kans']],
  winningen: [['knelpunt', `afname ≥ ${AFNAME_DREMPELS.knelpunt}%`], ['aandacht', 'afname'], ['geen', 'geen afname']],
};

/** Effecten van de maatregelen die in het zichtjaar meetellen. Puur. */
export function effectenMaatregelen(data, resultaat, cluster) {
  const coord = new Map(data.gemeenten.map((g) => [g.gemeente, [g.lon, g.lat]]));
  const uit = [];
  for (const m of data.maatregelen) {
    if (!resultaat.maatregelen[m.id]?.actief) continue;
    if (cluster && m.cluster !== cluster && m.cluster !== ALLE_CLUSTERS) continue;
    const punt = m.locatie ? [m.locatie.lon, m.locatie.lat] : coord.get(m.gemeente) ?? null;
    const plek = m.gemeente || m.naam;
    const voeg = (niveau, tekst, i) => uit.push({ k: `${m.id}|${i}`, groep: m.id, naam: plek, niveau, label: niveau === 'geen' ? '' : niveau, tekst, punt, vorm: 'pin' });
    let n = 0;
    for (const e of m.overige_effecten?.lijst ?? []) {
      if (!NIVEAUS[e.beoordeling]) continue;
      voeg(e.beoordeling, `${m.naam}: ${e.label}` + (e.tekst ? ` – ${e.tekst}` : ''), n++);
    }
    for (const [thema, def] of Object.entries(VOETAFDRUK)) {
      const v = m.voetafdruk?.[thema], niveau = VOETAFDRUK_NIVEAU[thema]?.[v?.beoordeling];
      if (niveau) voeg(niveau, `${m.naam}: ${def.naam.toLowerCase()} ${v.beoordeling}` + (v.toelichting ? ` – ${v.toelichting}` : ''), n++);
    }
    if (!n && m.soort === 'waterlevering') voeg('geen', `${m.naam}: geen effecten aangeleverd`, 0);
  }
  return uit.sort((a, b) => NIVEAUS[a.niveau].volgorde - NIVEAUS[b.niveau].volgorde);
}

/** Afname per bestaande winning in het zichtjaar. Puur. */
export function effectenWinningen(data, narratief, jaar, cluster) {
  const critNaam = new Map(data.criteria.map((c) => [c.id, c.naam]));
  const uit = [];
  for (const w of data.winningen) {
    if (cluster && w.cluster !== cluster) continue;
    const r = winningInJaar(data, narratief, w, jaar);
    const niveau = r.afnamePct >= AFNAME_DREMPELS.knelpunt ? 'knelpunt' : r.afnamePct >= AFNAME_DREMPELS.aandacht ? 'aandacht' : 'geen';
    const bindend = r.bindend.map((id) => critNaam.get(id) ?? id).join(', ');
    uit.push({
      k: w.id, groep: w.id, naam: w.locatie || w.id, niveau, afname: r.afname, inLijst: niveau !== 'geen',
      label: `−${Math.round(r.afnamePct)}%`,
      tekst: `−${f1(r.afname)} Mm³/j: ${f1(r.aanbod)} van ${f1(w.capaciteit)}` + (bindend ? ` · bindend: ${bindend}` : ''),
      punt: [w.lon, w.lat], vorm: 'stip',
      tip: () => `<div class="th">${esc(w.locatie || w.id)}</div><div class="tm">${esc([w.type, w.gemeente, w.watersysteem].filter(Boolean).join(' · '))}</div>`
        + kv('Capaciteit', `${f1(w.capaciteit)} Mm³/j`) + kv(`Aanbod in ${jaar}`, `${f1(r.aanbod)} Mm³/j`) + kv('Afname', `${f1(r.afname)} Mm³/j (${Math.round(r.afnamePct)}%)`)
        + (bindend ? kv('Bindend criterium', bindend) : '') + (w.te_controleren ? '<div class="tm" style="margin-top:6px">Ligging benaderd (te controleren)</div>' : ''),
    });
  }
  return uit.sort((a, b) => b.afname - a.afname);
}

function markeer(k) {
  kaart.markeer(k);
  document.querySelectorAll('#effList .ei').forEach((li) => li.classList.toggle('hl', k != null && li.dataset.k === k));
}
const setFade = () => { const ul = document.querySelector('#effList'); ul.classList.toggle('fade', ul.scrollTop + ul.clientHeight < ul.scrollHeight - 4); };

export function bouw(app) {
  kaart.bouw(app.data);
  document.querySelectorAll('#effChips .chip').forEach((b) => b.addEventListener('click', () => app.kies({ effecten: b.dataset.m })));
  document.querySelector('#effList').addEventListener('scroll', setFade);
}

export function render(app) {
  const { effecten: modus, narratief, jaar, cluster } = app.state;
  document.querySelectorAll('#effChips .chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.m === modus)));
  document.querySelector('#mapLegend').replaceChildren(...LEGENDA[modus].map(([niveau, tekst]) =>
    el('span', {}, el('i', { style: `background:${NIVEAUS[niveau].kleur}` }), tekst)));

  const items = modus === 'winningen' ? effectenWinningen(app.data, narratief, jaar, cluster) : effectenMaatregelen(app.data, app.resultaat(), cluster);
  const ul = document.querySelector('#effList');
  kaart.tekenPunten(items, (k) => {
    markeer(k);
    if (k) [...ul.children].find((li) => li.dataset.k === k)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
  const lijst = items.filter((e) => e.inLijst !== false);
  if (!lijst.length) {
    ul.replaceChildren(el('li', { class: 'empty', text: modus === 'winningen' ? `Geen afname van de capaciteit in ${jaar}.` : `Geen effecten van maatregelen in ${jaar}: er telt geen maatregel met aangeleverde effecten mee.` }));
  } else {
    ul.replaceChildren(...lijst.map((e) => {
      const li = el('li', { class: 'ei', 'data-k': e.k },
        el('span', { class: 'edot', style: `background:${NIVEAUS[e.niveau].kleur}` }),
        el('div', {}, el('div', { class: 'en' }, e.naam, e.label ? el('span', { class: 'esev', text: e.label }) : null), el('div', { class: 'ed', text: e.tekst })));
      li.addEventListener('pointerenter', () => markeer(e.k));
      li.addEventListener('pointerleave', () => markeer(null));
      return li;
    }));
  }
  ul.scrollTop = Math.min(ul.scrollTop, ul.scrollHeight);
  setFade();
}
