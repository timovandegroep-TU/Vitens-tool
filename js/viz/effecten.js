// Paneel EFFECTEN GEMEENTEN: effecten van de actieve maatregelen, of de afname per bestaande winning.
import { el } from '../dom.js';
import { ALLE_CLUSTERS } from '../model.js';
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
  const coord = (m) => { const w = data.winningen.find((x) => x.naam === m.winning && x.cluster === m.cluster) ?? data.winningen.find((x) => x.naam === m.winning); return w ? [w.lon, w.lat] : null; };
  const uit = [];
  for (const m of data.maatregelen) {
    if (!resultaat.maatregelen[m.id]?.actief) continue;
    if (cluster && m.cluster !== cluster && m.cluster !== ALLE_CLUSTERS) continue;
    const punt = m.locatie ? [m.locatie.lon, m.locatie.lat] : coord(m);
    const plek = m.gemeente || m.winning || m.naam;
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

/**
 * Afname per bestaande winning in het zichtjaar: de som van de actieve afnames die naar
 * deze winning verwijzen (kolom "winning" van de maatregel). Puur.
 */
export function effectenWinningen(data, resultaat, cluster) {
  const jaar = resultaat.jaar;
  const uit = [];
  for (const w of data.winningen) {
    if (cluster && w.cluster !== cluster) continue;
    const cap = typeof w.capaciteit === 'number' ? w.capaciteit : 0;
    const oorzaken = data.maatregelen.filter((m) => m.soort === 'afname' && m.winning === w.naam && m.cluster === w.cluster && resultaat.maatregelen[m.id]?.actief);
    const afname = Math.min(cap, oorzaken.reduce((s, m) => s + resultaat.maatregelen[m.id].volume, 0));
    const pct = cap > 0 ? afname / cap * 100 : 0;
    const niveau = pct >= AFNAME_DREMPELS.knelpunt ? 'knelpunt' : pct >= AFNAME_DREMPELS.aandacht ? 'aandacht' : 'geen';
    const reden = oorzaken.map((m) => m.naam).join(', ');
    uit.push({
      k: `w|${w.naam}|${w.cluster}`, groep: w.naam, naam: w.naam, niveau, afname, inLijst: niveau !== 'geen',
      label: `−${Math.round(pct)}%`,
      tekst: `−${f1(afname)} Mm³/j: ${f1(cap - afname)} van ${f1(cap)}` + (reden ? ` · ${reden}` : ''),
      punt: [w.lon, w.lat], vorm: 'stip',
      tip: () => `<div class="th">${esc(w.naam)}</div><div class="tm">${esc([w.gemeente, w.cluster, w.watersysteem].filter(Boolean).join(' · '))}</div>`
        + (typeof w.huidig_aanbod === 'number' ? kv('Huidig aanbod (vergund)', `${f1(w.huidig_aanbod)} Mm³/j`) : '')
        + kv('Inzetbare capaciteit nu', `${f1(cap)} Mm³/j`) + kv(`Aanbod in ${jaar}`, `${f1(cap - afname)} Mm³/j`)
        + (afname > 0 ? kv('Afname', `${f1(afname)} Mm³/j (${Math.round(pct)}%)`) + kv('Door', reden) : '<div class="tm">Geen actieve afname in dit jaar.</div>'),
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
  const { effecten: modus, jaar, cluster } = app.state;
  document.querySelectorAll('#effChips .chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.m === modus)));
  document.querySelector('#mapLegend').replaceChildren(...LEGENDA[modus].map(([niveau, tekst]) =>
    el('span', {}, el('i', { style: `background:${NIVEAUS[niveau].kleur}` }), tekst)));

  const items = modus === 'winningen' ? effectenWinningen(app.data, app.resultaat(), cluster) : effectenMaatregelen(app.data, app.resultaat(), cluster);
  const ul = document.querySelector('#effList');
  kaart.tekenPunten(items, (k) => {
    markeer(k);
    if (k) [...ul.children].find((li) => li.dataset.k === k)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
  const lijst = items.filter((e) => e.inLijst !== false);
  if (!lijst.length) {
    ul.replaceChildren(el('li', { class: 'empty', text: modus === 'winningen' ? `Geen afname van bestaande winningen in ${jaar}.` : `Geen effecten van maatregelen in ${jaar}: er telt geen maatregel met aangeleverde effecten mee.` }));
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
