// Invoerpagina: bewerkbare tabellen, plakken uit Excel, validatie, import/export.
/* global XLSX */
import { el, toon } from './dom.js';
import { bouwFormulier } from './formulier.js';
import { PEILJAREN, VRAAGJAREN, AANBODJAREN, factorPeiljaar, samenvatting } from './model.js';
import {
  TABELLEN, UITLEG_REDUCTIEFACTOREN, UITLEG_VRAAG, UITLEG_VRAAG_KOLOMMEN, SPOREN, legeDataset, normaliseer, valideer, telling, nieuweMaatregel,
} from './schema.js';
import {
  bewaar, laadOpgeslagen, wisOpgeslagen, leesGetal, leesJaNee, naarWerkboek, werkboekNaarBladen, vanBladen,
  leegTemplate, bestandsnaam, isMaatregelenBestand, maatregelenUitBladen, voegMaatregelenSamen,
  controleerDataset, zonderScheidingskolommen, stripScheidingskolommen, maatregelenTemplate,
} from './store.js';

const $ = (s) => document.querySelector(s);
const nf3 = new Intl.NumberFormat('nl-NL', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const vandaag = () => new Date().toISOString().slice(0, 10);
// ------------------------------------------------------------------ state
let data = laadOpgeslagen() ?? legeDataset();
let meldingen = [];
let tab = 'winningen';
let rfNarratief = 1;
let vFilter = 'alle';
let formulier = null;          // { id } = bewerken, { nieuw: true } = nieuw, null = overzicht

const TABS = [
  ...TABELLEN.map((t) => ({ id: t.id, label: t.blad, tabel: (m) => m.tabel === t.blad })),
  { id: 'reductiefactoren', label: 'Reductiefactoren', tabel: (m) => m.tabel.startsWith('Reductiefactoren') },
  { id: 'vraag', label: 'Vraag', tabel: (m) => m.tabel === 'Vraag' },
  { id: 'maatregelen', label: 'Maatregelen', tabel: (m) => m.tabel === 'Maatregelen' },
];

/** Vul reductiefactoren en vraag aan voor nieuwe winningen/criteria/clusters (verwijdert niets). */
function vulAan() {
  for (const n of data.narratieven) {
    const rf = (data.reductiefactoren[n.id] ??= {}), vr = (data.vraag[n.id] ??= {});
    for (const w of data.winningen) for (const c of data.criteria) ((rf[w.id] ??= {})[c.id] ??= [null, null, null]);
    for (const c of data.clusters) {
      const rij = (vr[c.id] ??= {});
      for (const j of VRAAGJAREN) rij[j] ??= null;
    }
  }
}

let timer = null;
function gewijzigd({ opnieuw = false } = {}) {
  vulAan();
  bewaar(data);
  clearTimeout(timer);
  if (opnieuw) { hervalideer(); renderPaneel(); } else timer = setTimeout(hervalideer, 250);
}
function hervalideer() {
  meldingen = valideer(data);
  renderTabs(); renderValidatie(); markeer();
}
function status(tekst) {
  $('#status').textContent = tekst;
  clearTimeout(status.t); status.t = setTimeout(() => { $('#status').textContent = ''; }, 6000);
}

// -------------------------------------------------------- id's hernoemen
/** Bij het wijzigen van een id verhuizen de gekoppelde gegevens mee. */
function hernoem(tabelId, oud, nieuw) {
  if (oud === nieuw || nieuw == null || nieuw === '' || oud == null || oud === '') return;
  const verplaats = (obj) => { if (obj && oud in obj && !(nieuw in obj)) { obj[nieuw] = obj[oud]; delete obj[oud]; } };
  if (tabelId === 'winningen') Object.values(data.reductiefactoren).forEach(verplaats);
  if (tabelId === 'criteria') Object.values(data.reductiefactoren).forEach((perW) => Object.values(perW).forEach(verplaats));
  if (tabelId === 'clusters') {
    Object.values(data.vraag).forEach(verplaats);
    for (const lijst of [data.gemeenten, data.winningen, data.maatregelen]) for (const x of lijst) if (x.cluster === oud) x.cluster = nieuw;
  }
  if (tabelId === 'gemeenten') for (const lijst of [data.winningen, data.maatregelen]) for (const x of lijst) if (x.gemeente === oud) x.gemeente = nieuw;
}
function verwijderGekoppeld(tabelId, id) {
  if (tabelId === 'winningen') Object.values(data.reductiefactoren).forEach((perW) => delete perW[id]);
  if (tabelId === 'criteria') Object.values(data.reductiefactoren).forEach((perW) => Object.values(perW).forEach((perC) => delete perC[id]));
  if (tabelId === 'clusters') Object.values(data.vraag).forEach((perC) => delete perC[id]);
}

// ------------------------------------------------------- generiek raster
/**
 * Bouw een bewerkbare tabel.
 * def = { tabelnaam, kolommen:[{label, uitleg, type, opties?, klasse?, groep?}], aantal,
 *         lees(r,c), zet(r,c,ruw), rijId(r), veldId(c), rijkop?(r) -> [tekst, klein],
 *         groepen?: [{label, span, klasse}], voegToe?(), verwijder?(r), celklasse?(r,c,v) }
 */
let raster = null;
function bouwRaster(def) {
  raster = def;
  const table = el('table', { class: 'grid' });
  const thead = el('thead');
  if (def.groepen) {
    const tr = el('tr', { class: 'groepen' });
    if (def.rijkop) tr.append(el('th', { class: 'rijkop' }));
    for (const g of def.groepen) tr.append(el('th', { colspan: g.span, class: g.klasse, title: g.uitleg, text: g.label }));
    thead.append(tr);
  }
  const tr = el('tr', { class: def.groepen ? 'jaren' : '' });
  if (def.rijkop) tr.append(el('th', { class: 'rijkop', text: def.rijkopLabel ?? '' }));
  for (const k of def.kolommen) tr.append(el('th', { title: k.uitleg, class: k.groep ? `g-${k.groep}` : '', text: k.label + (k.eenheid ? ` (${k.eenheid})` : '') }));
  if (def.verwijder) tr.append(el('th'));
  thead.append(tr);
  const tbody = el('tbody');
  for (let r = 0; r < def.aantal; r++) {
    const rij = el('tr');
    if (def.rijkop) { const [t, k] = def.rijkop(r); rij.append(el('th', { class: 'rijkop' }, t, k ? el('small', { text: k }) : null)); }
    def.kolommen.forEach((k, c) => rij.append(bouwCel(def, r, c, k)));
    if (def.verwijder) {
      rij.append(el('td', { class: 'actie' }, el('button', { class: 'knop mini gevaar', type: 'button', title: 'Verwijder deze rij', 'aria-label': `Verwijder rij ${def.rijId(r)}`, text: '×', onclick: () => { def.verwijder(r); gewijzigd({ opnieuw: true }); } })));
    }
    tbody.append(rij);
  }
  table.append(thead, tbody);
  table.addEventListener('paste', plak);
  table.addEventListener('keydown', pijltjes);
  return table;
}

function bouwCel(def, r, c, k) {
  const v = def.lees(r, c);
  const td = el('td', { 'data-r': r, 'data-c': c });
  if (k.type === 'berekend') { td.className = 'berekend'; td.textContent = toon(v); return td; }
  td.className = `cel ${k.type === 'getal' || k.type === 'geheel' ? 'getal' : ''} ${k.klasse ?? ''} ${def.celklasse?.(r, c, v) ?? ''}`;
  const label = `${def.rijId(r)} – ${k.label}`;
  let inv;
  if (k.type === 'janee' || k.type === 'keuze' || k.type === 'ref') {
    const opties = k.type === 'janee' ? ['ja', 'nee'] : k.opties();
    const huidig = k.type === 'janee' ? (v ? 'ja' : 'nee') : (v ?? '');
    inv = el('select', { 'aria-label': label });
    if (k.type !== 'janee') inv.append(el('option', { value: '', text: '' }));
    for (const o of opties) inv.append(el('option', { value: o, text: o }));
    if (huidig !== '' && !opties.includes(huidig)) inv.append(el('option', { value: huidig, text: `${huidig} (onbekend)` }));
    inv.value = huidig;
  } else {
    inv = el('input', { type: 'text', value: toon(v), 'aria-label': label, inputmode: k.type === 'tekst' ? null : 'decimal', spellcheck: 'false' });
  }
  inv.addEventListener('change', () => {
    def.zet(r, c, inv.value);
    const nieuw = def.lees(r, c);
    if (inv.tagName === 'INPUT') inv.value = toon(nieuw);
    if (def.celklasse) td.className = td.className.replace(/\blaag\b/, '') + ' ' + (def.celklasse(r, c, nieuw) ?? '');
    gewijzigd({ opnieuw: !!k.herteken });
  });
  td.append(inv);
  return td;
}

/** Ruwe invoer -> waarde volgens het kolomtype. */
function lees(type, ruw) {
  if (type === 'getal' || type === 'geheel') return leesGetal(ruw);
  if (type === 'janee') return leesJaNee(ruw);
  if (type === 'keuze' || type === 'ref') return String(ruw ?? '').trim() || null;
  return String(ruw ?? '').trim();
}

/** Plakken van een blok cellen uit Excel (tab = kolom, regel = rij), vanaf de actieve cel. */
function plak(ev) {
  const td = ev.target.closest('td[data-r]');
  const tekst = ev.clipboardData?.getData('text/plain') ?? '';
  let blok = tekst.replace(/\r?\n$/, '').split(/\r?\n/).map((r) => r.split('\t'));
  if (!td || !raster || (blok.length === 1 && blok[0].length === 1)) return;   // één cel: gewoon plakken
  ev.preventDefault();
  const r0 = Number(td.dataset.r), c0 = Number(td.dataset.c);
  let extra = '';
  if (raster.plakFilter) {
    const gefilterd = raster.plakFilter(blok, c0);
    if (gefilterd !== blok) { blok = gefilterd; extra = ' Scheidingskolommen uit de Excel zijn overgeslagen.'; }
  }
  while (raster.voegToe && raster.aantal < r0 + blok.length) { raster.voegToe(); raster.aantal++; }
  let n = 0, buiten = 0;
  blok.forEach((rij, i) => rij.forEach((ruw, j) => {
    const r = r0 + i, c = c0 + j, k = raster.kolommen[c];
    if (r >= raster.aantal || !k) { buiten++; return; }
    if (k.type === 'berekend') return;
    raster.zet(r, c, ruw); n++;
  }));
  gewijzigd({ opnieuw: true });
  status(`${n} cellen geplakt` + (buiten ? `, ${buiten} vielen buiten de tabel` : '') + '.' + extra);
  $(`td[data-r="${r0}"][data-c="${c0}"] input, td[data-r="${r0}"][data-c="${c0}"] select`)?.focus();
}

/** Pijl omhoog/omlaag en Enter verplaatsen de focus binnen de kolom. */
function pijltjes(ev) {
  if (!['ArrowUp', 'ArrowDown', 'Enter'].includes(ev.key) || ev.target.tagName === 'SELECT') return;
  const td = ev.target.closest('td[data-r]'); if (!td) return;
  const r = Number(td.dataset.r) + (ev.key === 'ArrowUp' ? -1 : 1);
  const doel = $(`td[data-r="${r}"][data-c="${td.dataset.c}"] input, td[data-r="${r}"][data-c="${td.dataset.c}"] select`);
  if (doel) { ev.preventDefault(); ev.target.dispatchEvent(new Event('change')); doel.focus(); doel.select?.(); }
}

// ------------------------------------------------------------- panelen
const opties = { clusters: () => data.clusters.map((c) => c.id), gemeenten: () => data.gemeenten.map((g) => g.gemeente) };

function paneelLijst(t) {
  const lijst = data[t.id];
  const kolommen = t.kolommen.map((k) => ({
    ...k, type: t.vast && k.veld === t.sleutel ? 'berekend' : k.type,   // vast id: niet te wijzigen
    opties: k.type === 'ref' ? opties[k.ref] : () => k.keuzes,
    klasse: ['toelichting', 'uitleg'].includes(k.veld) ? 'breed' : ['naam', 'locatie', 'deltascenario', 'id', 'gemeente'].includes(k.veld) ? 'middel' : '',
    herteken: k.veld === t.sleutel,
  }));
  const nieuw = () => Object.fromEntries(t.kolommen.map((k) => [k.veld, k.type === 'janee' ? k.veld === 'te_controleren' : k.type === 'tekst' ? '' : null]));
  const def = {
    tabelnaam: t.blad, kolommen, aantal: lijst.length,
    lees: (r, c) => lijst[r][kolommen[c].veld],
    zet: (r, c, ruw) => {
      const k = kolommen[c], v = lees(k.type, ruw);
      if (k.veld === t.sleutel) hernoem(t.id, lijst[r][k.veld], v);
      lijst[r][k.veld] = v;
    },
    rijId: (r) => String(lijst[r][t.sleutel] ?? ''), veldId: (c) => kolommen[c].veld,
    voegToe: t.vast ? null : () => lijst.push(nieuw()),
    verwijder: t.vast ? null : (r) => { verwijderGekoppeld(t.id, lijst[r][t.sleutel]); lijst.splice(r, 1); },
  };
  return [
    el('h2', { text: t.blad }), el('p', { class: 'uitleg', text: t.uitleg }), kolomUitleg(t.kolommen),
    el('div', { class: 'balk' },
      t.vast ? null : el('button', { class: 'knop', type: 'button', text: '+ Rij toevoegen', onclick: () => { def.voegToe(); gewijzigd({ opnieuw: true }); focusCel(lijst.length - 1, 0); } }),
      el('span', { class: 'tip', text: `${lijst.length} rijen · plakken uit Excel: selecteer een cel en druk Ctrl+V` + (t.vast ? '' : ' (extra rijen worden toegevoegd)') })),
    lijst.length ? el('div', { class: 'tabelwrap' }, bouwRaster(def)) : (raster = { ...def, aantal: 0 }, el('div', { class: 'leeg', text: 'Nog geen rijen. Voeg een rij toe of importeer een bestand.' })),
  ];
}

function kolomUitleg(kolommen) {
  const dl = el('dl');
  for (const k of kolommen) dl.append(el('dt', { text: k.label + (k.eenheid ? ` (${k.eenheid})` : '') }), el('dd', { text: k.uitleg }));
  return el('details', { class: 'kolomuitleg' }, el('summary', { text: 'Uitleg per kolom' }), dl);
}

function narratiefChips() {
  return data.narratieven.map((n) => {
    const t = telling(meldingen.filter((m) => m.tabel === `Reductiefactoren N${n.id}`));
    return el('button', { class: 'chip', type: 'button', 'aria-pressed': String(n.id === rfNarratief), onclick: () => { rfNarratief = n.id; renderPaneel(); renderValidatie(); } },
      `${n.id} ${n.naam}`, t.fouten ? el('span', { class: 'badge f', text: t.fouten }) : null, t.waarschuwingen ? el('span', { class: 'badge w', text: t.waarschuwingen }) : null);
  });
}

function paneelReductiefactoren() {
  if (!data.narratieven.some((n) => n.id === rfNarratief)) rfNarratief = data.narratieven[0]?.id ?? 1;
  const N = rfNarratief, crit = data.criteria, win = data.winningen;
  const rf = () => (data.reductiefactoren[N] ??= {});
  const kolommen = [
    ...crit.flatMap((c) => PEILJAREN.map((j, i) => ({ label: String(j), type: 'getal', groep: c.groep, crit: c, i, uitleg: `${c.naam} – ${j}. ${c.toelichting ?? ''}` }))),
    ...PEILJAREN.map((j, i) => ({ label: String(j), type: 'berekend', groep: 'Totaal', i, uitleg: `Minimum over alle criteria in ${j} (leeg = 1)` })),
    ...AANBODJAREN.map((j, i) => ({ label: String(j), type: 'berekend', groep: 'Totaal', aanbod: i, uitleg: `Aanbod in ${j} = capaciteit × factor (Mm³/j)` })),
  ];
  const def = {
    tabelnaam: `Reductiefactoren N${N}`, kolommen, aantal: win.length, rijkopLabel: 'Winning',
    rijkop: (r) => [win[r].locatie || win[r].id, `${win[r].cluster ?? ''} · ${toon(win[r].capaciteit)} Mm³/j`],
    groepen: [
      ...crit.map((c) => ({ label: c.naam, span: 3, klasse: `g-${c.groep}`, uitleg: `${c.groep}: ${c.toelichting ?? ''}` })),
      { label: 'Factor (minimum)', span: 3, klasse: 'g-Totaal', uitleg: 'Het slechtste criterium bepaalt' },
      { label: 'Aanbod (Mm³/j)', span: 4, klasse: 'g-Totaal', uitleg: 'Capaciteit × factor' },
    ],
    lees: (r, c) => {
      const k = kolommen[c], w = win[r];
      if (k.crit) return rf()[w.id]?.[k.crit.id]?.[k.i] ?? null;
      if (k.aanbod != null) return k.aanbod === 0 ? w.capaciteit : typeof w.capaciteit === 'number' ? w.capaciteit * factorPeiljaar(data, N, w.id, k.aanbod - 1).factor : null;
      return factorPeiljaar(data, N, w.id, k.i).factor;
    },
    zet: (r, c, ruw) => { const k = kolommen[c]; if (k.crit) (((rf()[win[r].id] ??= {})[k.crit.id]) ??= [null, null, null])[k.i] = leesGetal(ruw); },
    rijId: (r) => win[r].id, veldId: (c) => (kolommen[c].crit ? `${kolommen[c].crit.id} ${kolommen[c].label}` : ''),
    celklasse: (r, c, v) => (typeof v === 'number' && v < 1 ? 'laag' : ''),
    // De Excel heeft tussen elke groep van 3 jaren een scheidingskolom (leeg of "x"): die vervalt.
    // Alleen als het blok op de 2030-kolom van een criterium begint; bij twijfel vragen we het.
    plakFilter: (blok, c0) => {
      const invul = crit.length * PEILJAREN.length;
      if (c0 >= invul || c0 % PEILJAREN.length !== 0) return blok;
      const uit = zonderScheidingskolommen(blok, invul - c0);
      if (uit.scheiding !== 'twijfel') return uit.blok;
      return confirm('In het geplakte blok is elke vierde kolom leeg.\n\nKomt dit blok rechtstreeks uit het werkdocument (met een lege scheidingskolom na elke drie jaren)?\n\nOK = ja, scheidingskolommen overslaan\nAnnuleren = nee, precies zo plakken (lege cel = lege factor)')
        ? stripScheidingskolommen(blok) : blok;
    },
  };
  // na een wijziging de berekende kolommen bijwerken
  const basisZet = def.zet;
  def.zet = (r, c, ruw) => { basisZet(r, c, ruw); queueMicrotask(() => werkBerekendBij(def, r)); };
  return [
    el('h2', { text: 'Reductiefactoren' }), el('p', { class: 'uitleg', text: UITLEG_REDUCTIEFACTOREN }),
    kolomUitleg([
      { label: 'Winning', uitleg: 'Naam, cluster en inzetbare productiecapaciteit uit de tabel Winningen. Rijen ontstaan vanzelf; voeg een winning toe in de tabel Winningen.' },
      ...crit.map((c) => ({ label: `${c.naam} – 2030 / 2040 / 2050`, uitleg: `${c.groep}. ${c.toelichting ?? ''} Waarde 0–1; leeg = 1.` })),
      { label: 'Factor (minimum) – 2030 / 2040 / 2050', uitleg: 'Berekend: het minimum over alle criteria in dat peiljaar. Niet in te vullen.' },
      { label: 'Aanbod – 2026 / 2030 / 2040 / 2050', eenheid: 'Mm³/j', uitleg: 'Berekend: capaciteit × factor; 2026 ("huidig") = capaciteit. Niet in te vullen.' },
    ]),
    el('div', { class: 'balk' }, el('span', { class: 'groeplabel', text: 'Narratief:' }), ...narratiefChips()),
    el('div', { class: 'balk' }, el('b', { id: 'rfTotaal', text: rfTotaalTekst() }),
      el('span', { class: 'tip', text: 'Plakken uit Excel: kopieer het blok H4:AP35, klik hier de cel 2030 van het eerste criterium en druk Ctrl+V. Lege scheidingskolommen uit de Excel worden overgeslagen.' })),
    win.length && crit.length ? el('div', { class: 'tabelwrap' }, bouwRaster(def)) : el('div', { class: 'leeg', text: 'Vul eerst de tabellen Winningen en Criteria.' }),
  ];
}
function rfTotaalTekst() {
  const s = samenvatting(data).aanbod[rfNarratief] ?? [];
  return `Totaal aanbod narratief ${rfNarratief}: ` + AANBODJAREN.map((j, i) => `${j}: ${nf3.format(s[i] ?? 0)}`).join(' · ') + ' Mm³/j';
}
function werkBerekendBij(def, r) {
  def.kolommen.forEach((k, c) => { if (k.type === 'berekend') { const td = $(`td[data-r="${r}"][data-c="${c}"]`); if (td) td.textContent = toon(def.lees(r, c)); } });
  const t = $('#rfTotaal'); if (t) t.textContent = rfTotaalTekst();
}

function paneelVraag() {
  const rijen = data.narratieven.flatMap((n) => data.clusters.map((c) => ({ n, c })));
  const kolommen = VRAAGJAREN.map((j) => ({ label: String(j), type: 'getal', jaar: j, uitleg: `Vraag in ${j} (Mm³/j)` }));
  const def = {
    tabelnaam: 'Vraag', kolommen, aantal: rijen.length, rijkopLabel: 'Narratief · cluster',
    rijkop: (r) => [`${rijen[r].n.id} ${rijen[r].n.naam}`, rijen[r].c.naam || rijen[r].c.id],
    lees: (r, c) => data.vraag[rijen[r].n.id]?.[rijen[r].c.id]?.[kolommen[c].jaar] ?? null,
    zet: (r, c, ruw) => { ((data.vraag[rijen[r].n.id] ??= {})[rijen[r].c.id] ??= {})[kolommen[c].jaar] = leesGetal(ruw); },
    rijId: (r) => `N${rijen[r].n.id} ${rijen[r].c.id}`, veldId: (c) => kolommen[c].label,
  };
  return [
    el('h2', { text: 'Vraag' }), el('p', { class: 'uitleg', text: UITLEG_VRAAG }), kolomUitleg(UITLEG_VRAAG_KOLOMMEN),
    el('div', { class: 'balk' }, el('span', { class: 'tip', text: 'Plakken uit Excel: klik de cel 2025 van het eerste cluster en druk Ctrl+V. Clusters staan in de volgorde van de tabel Clusters.' })),
    rijen.length ? el('div', { class: 'tabelwrap' }, bouwRaster(def)) : el('div', { class: 'leeg', text: 'Vul eerst de tabel Clusters.' }),
  ];
}

function downloadBytes(bytes, naam) {
  const a = el('a', { href: URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })), download: naam });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function paneelMaatregelen() {
  raster = null;
  if (formulier) {
    const bestaand = formulier.id != null ? data.maatregelen.find((m) => m.id === formulier.id) : null;
    if (formulier.nieuw || bestaand) {
      const oudId = bestaand?.id;
      return [bouwFormulier({
        data, maatregel: bestaand ?? nieuweMaatregel(vandaag()), nieuw: !bestaand,
        opslaan: (m) => {
          const i = data.maatregelen.findIndex((x) => x.id === oudId);
          if (i >= 0) data.maatregelen[i] = m; else data.maatregelen.push(m);
          formulier = null; gewijzigd({ opnieuw: true });
          status(`Maatregel "${m.naam || m.id}" ${i >= 0 ? 'bijgewerkt' : 'toegevoegd'}.`);
        },
        annuleer: () => { formulier = null; renderPaneel(); },
      })];
    }
    formulier = null;
  }
  const koppen = ['Id', 'Naam', 'Leverancier', 'Soort', 'Spoor', 'Narratieven', 'Cluster', 'Volume (Mm³/j)', 'Ingangsjaar', 'Standaard aan', 'Validatie', ''];
  const table = el('table', { class: 'grid' }, el('thead', {}, el('tr', {}, ...koppen.map((k) => el('th', { text: k })))));
  const tbody = el('tbody');
  for (const m of data.maatregelen) {
    const t = telling(meldingen.filter((x) => x.tabel === 'Maatregelen' && x.rij === m.id));
    const st = t.fouten ? ['status-f', `${t.fouten} blokkerend`] : t.waarschuwingen ? ['status-w', `${t.waarschuwingen} waarschuwing${t.waarschuwingen > 1 ? 'en' : ''}`] : ['status-ok', 'in orde'];
    tbody.append(el('tr', {}, ...[m.id, m.naam, m.leverancier, m.soort, m.spoor, (m.narratieven ?? []).join(', '), m.cluster, toon(m.volume), m.ingangsjaar, m.standaard_aan ? 'ja' : 'nee']
      .map((v, i) => el('td', { class: 'tekst', title: i === 4 ? SPOREN[v] : null, text: v ?? '' })), el('td', { class: `tekst ${st[0]}`, text: st[1] }),
    el('td', { class: 'actie' },
      el('button', { class: 'knop mini', type: 'button', text: 'Bewerken', 'aria-label': `Bewerk ${m.id}`, onclick: () => { formulier = { id: m.id }; renderPaneel(); } }), ' ',
      el('button', { class: 'knop mini gevaar', type: 'button', text: '×', title: 'Verwijder deze maatregel', 'aria-label': `Verwijder ${m.id}`, onclick: () => {
        if (!confirm(`Maatregel "${m.naam || m.id}" verwijderen?`)) return;
        data.maatregelen = data.maatregelen.filter((x) => x !== m); gewijzigd({ opnieuw: true });
      } }))));
  }
  table.append(tbody);
  const geenBasis = !data.clusters.length;
  return [
    el('h2', { text: 'Maatregelen' }),
    el('p', { class: 'uitleg', text: 'De maatregel-dataobjecten met hun validatiestatus. Lever een maatregel aan via het formulier, of vul het maatregelen-template (.xlsx) in en importeer het: een nieuw id wordt toegevoegd, een bestaand id overschreven.' }),
    el('div', { class: 'balk' },
      el('button', { class: 'knop pri', type: 'button', text: '+ Maatregel aanleveren', onclick: () => { formulier = { nieuw: true }; renderPaneel(); } }),
      el('span', { class: 'scheiding' }),
      el('button', { class: 'knop', type: 'button', text: 'Download maatregelen-template (.xlsx)', title: 'Leeg template met keuzelijsten (gegevensvalidatie) en een tabblad Uitleg. De lijsten met gemeenten en clusters komen uit de huidige dataset.', onclick: () => downloadBytes(maatregelenTemplate(XLSX, data), 'dwr-maatregelen-template.xlsx') }),
      el('button', { class: 'knop', type: 'button', text: 'Download maatregelen (.xlsx)', title: 'Hetzelfde template, gevuld met de huidige maatregelen', disabled: !data.maatregelen.length, onclick: () => downloadBytes(maatregelenTemplate(XLSX, data, data.maatregelen), bestandsnaam(data, 'xlsx').replace(/^dwr-/, 'dwr-maatregelen-')) }),
      el('button', { class: 'knop', type: 'button', text: 'Importeer maatregelen-bestand…', onclick: () => $('#bestand').click() })),
    geenBasis ? el('p', { class: 'tip', text: 'Let op: er zijn nog geen clusters en gemeenten. Importeer eerst de basisdata; anders zijn de keuzelijsten in formulier en template leeg.' }) : null,
    data.maatregelen.length ? el('div', { class: 'tabelwrap' }, table) : el('div', { class: 'leeg', text: 'Nog geen maatregelen.' }),
  ];
}

function renderPaneel() {
  const p = $('#paneel');
  const scroll = p.querySelector('.tabelwrap'), pos = scroll ? [scroll.scrollLeft, scroll.scrollTop] : null;
  const t = TABELLEN.find((x) => x.id === tab);
  p.replaceChildren(...(t ? paneelLijst(t) : tab === 'reductiefactoren' ? paneelReductiefactoren() : tab === 'vraag' ? paneelVraag() : paneelMaatregelen()));
  const nieuw = p.querySelector('.tabelwrap');
  if (pos && nieuw) { nieuw.scrollLeft = pos[0]; nieuw.scrollTop = pos[1]; }
  markeer();
}

function renderTabs() {
  $('#tabs').replaceChildren(...TABS.map((t) => {
    const n = telling(meldingen.filter(t.tabel));
    return el('button', { class: 'tab', role: 'tab', type: 'button', 'aria-selected': String(t.id === tab), onclick: () => { tab = t.id; formulier = null; renderTabs(); renderPaneel(); renderValidatie(); } },
      t.label, n.fouten ? el('span', { class: 'badge f', title: 'blokkerende fouten', text: n.fouten }) : null,
      n.waarschuwingen ? el('span', { class: 'badge w', title: 'waarschuwingen', text: n.waarschuwingen }) : null);
  }));
}

// ----------------------------------------------------------- validatie
const hoortBijCel = (m, rij, veld) => m.rij === rij && (m.veld === veld || veld.startsWith(m.veld + ' ') || (m.veld === 'lat/lon' && (veld === 'lat' || veld === 'lon')));

/** Kleur de cellen met een melding (rood/oranje) en zet de melding in de tooltip. */
function markeer() {
  if (!raster?.rijId) return;
  const mijn = meldingen.filter((m) => m.tabel === raster.tabelnaam);
  document.querySelectorAll('#paneel td.cel').forEach((td) => {
    const r = Number(td.dataset.r), c = Number(td.dataset.c);
    if (r >= raster.aantal) return;
    const rij = raster.rijId(r), veld = raster.veldId(c);
    const hier = mijn.filter((m) => hoortBijCel(m, rij, veld));
    td.classList.toggle('fout', hier.some((m) => m.niveau === 'fout'));
    td.classList.toggle('waarschuwing', hier.length > 0 && !hier.some((m) => m.niveau === 'fout'));
    if (hier.length) td.title = hier.map((m) => m.melding).join('\n'); else td.removeAttribute('title');
  });
}

function focusCel(r, c) {
  const td = $(`#paneel td[data-r="${r}"][data-c="${c}"]`); if (!td) return;
  td.scrollIntoView({ block: 'center', inline: 'center' });
  td.classList.remove('flits'); void td.offsetWidth; td.classList.add('flits');
  td.querySelector('input,select')?.focus({ preventScroll: true });
}

/** Ga naar de cel van een melding. */
function gaNaar(m) {
  const doel = TABS.find((t) => t.tabel(m)); if (!doel) return;
  tab = doel.id;
  const n = m.tabel.match(/^Reductiefactoren N(\d+)$/); if (n) rfNarratief = Number(n[1]);
  formulier = tab === 'maatregelen' && data.maatregelen.some((x) => x.id === m.rij) ? { id: m.rij } : null;
  renderTabs(); renderPaneel(); renderValidatie();
  if (formulier) { $('#paneel form.mform')?.focusVeld(m.veld); return; }
  if (!raster?.rijId) return;
  for (let r = 0; r < raster.aantal; r++) {
    if (raster.rijId(r) !== m.rij) continue;
    const c = raster.kolommen.findIndex((_, i) => hoortBijCel(m, m.rij, raster.veldId(i)));
    focusCel(r, Math.max(0, c)); return;
  }
}

function renderValidatie() {
  const t = telling(meldingen);
  $('#vTelling').innerHTML = t.fouten || t.waarschuwingen
    ? `<span class="f">${t.fouten} blokkerend</span> · <span class="w">${t.waarschuwingen} waarschuwing${t.waarschuwingen === 1 ? '' : 'en'}</span>`
    : '<span class="ok">geen meldingen</span>';
  document.querySelectorAll('.vfilter .chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.f === vFilter)));
  const huidig = TABS.find((x) => x.id === tab);
  const zicht = meldingen
    .filter((m) => vFilter === 'alle' || (vFilter === 'tab' ? huidig.tabel(m) && (tab !== 'reductiefactoren' || m.tabel === `Reductiefactoren N${rfNarratief}`) : m.niveau === vFilter))
    .sort((a, b) => (a.niveau === b.niveau ? 0 : a.niveau === 'fout' ? -1 : 1));
  const MAX = 200, ul = $('#vLijst');
  ul.replaceChildren(...zicht.slice(0, MAX).map((m) => el('li', { class: m.niveau, tabindex: '0', role: 'button', title: 'Ga naar deze cel', onclick: () => gaNaar(m), onkeydown: (e) => { if (e.key === 'Enter') gaNaar(m); } },
    el('span', { class: 'waar', text: [m.tabel, m.rij, m.veld].filter(Boolean).join(' › ') }), m.melding)));
  if (zicht.length > MAX) ul.append(el('li', { class: 'meer', text: `… en nog ${zicht.length - MAX} meldingen. Gebruik het filter.` }));
  if (!zicht.length) ul.append(el('li', { class: 'geen', text: meldingen.length ? 'Geen meldingen in dit filter.' : 'Geen meldingen: de dataset is volledig en consistent.' }));
}
document.querySelectorAll('.vfilter .chip').forEach((b) => b.addEventListener('click', () => { vFilter = b.dataset.f; renderValidatie(); }));

// ------------------------------------------------------ import / export
function dialoog(titel, ...inhoud) {
  $('#dlgTitel').textContent = titel;
  $('#dlgInhoud').replaceChildren(...inhoud.filter((x) => x != null));
  $('#dlg').showModal();
}

/** Samenvatting: aantallen en totaal aanbod per narratief en peiljaar, om met de Excel te vergelijken. */
function totalenInhoud() {
  const s = samenvatting(data), t = telling(meldingen);
  const tabel = el('table', {}, el('thead', {}, el('tr', {}, el('th', { text: 'Totaal aanbod (Mm³/j)' }), ...AANBODJAREN.map((j) => el('th', { text: j })))),
    el('tbody', {}, ...data.narratieven.map((n) => el('tr', {}, el('td', { text: `${n.id} ${n.naam}` }), ...s.aanbod[n.id].map((v) => el('td', { text: nf3.format(v) }))))));
  return [
    el('div', { class: 'kern' },
      el('div', {}, el('b', { text: s.winningen }), 'winningen'), el('div', {}, el('b', { text: s.maatregelen }), 'maatregelen'),
      el('div', {}, el('b', { text: data.clusters.length }), 'clusters'), el('div', {}, el('b', { text: data.gemeenten.length }), 'gemeenten'),
      el('div', {}, el('b', { class: t.fouten ? 'status-f' : 'status-ok', text: t.fouten }), 'blokkerend'), el('div', {}, el('b', { class: t.waarschuwingen ? 'status-w' : 'status-ok', text: t.waarschuwingen }), 'waarschuwingen')),
    el('h3', { text: 'Vergelijk met de Excel (cellen AV37:AY37 van "Naratief N - winningen")' }), tabel,
  ];
}

async function importeer(bestand) {
  try {
    if (/\.json$/i.test(bestand.name)) {
      const nieuw = normaliseer(controleerDataset(JSON.parse(await bestand.text())));
      if (!bevestigVervangen()) return;
      data = nieuw;
      afronden(bestand, []);
    } else {
      const bladen = werkboekNaarBladen(XLSX, XLSX.read(await bestand.arrayBuffer(), { type: 'array' }));
      if (isMaatregelenBestand(bladen)) {
        const nieuwe = maatregelenUitBladen(bladen);
        const uit = voegMaatregelenSamen(data, nieuwe);
        gewijzigd(); hervalideer();
        const metW = nieuwe.filter((m) => meldingen.some((x) => x.tabel === 'Maatregelen' && x.rij === m.id && x.niveau === 'waarschuwing')).length;
        const metF = nieuwe.filter((m) => meldingen.some((x) => x.tabel === 'Maatregelen' && x.rij === m.id && x.niveau === 'fout')).length;
        tab = 'maatregelen'; formulier = null; renderTabs(); renderPaneel(); renderValidatie();
        const idLijst = (kop, ids) => (ids.length ? el('p', { class: 'klein' }, el('b', { text: `${kop}: ` }), ids.join(', ')) : null);
        dialoog('Maatregelen geïmporteerd', el('p', { text: `${bestand.name}: ${uit.toegevoegd.length} toegevoegd, ${uit.bijgewerkt.length} bijgewerkt, ${metW} met waarschuwingen` + (metF ? `, ${metF} met blokkerende fouten` : '') + '.' }),
          nieuwe.length ? null : el('p', { text: 'Het tabblad Maatregelen bevat geen rijen; er is niets gewijzigd.' }),
          idLijst('Toegevoegd', uit.toegevoegd), idLijst('Bijgewerkt (overschreven)', uit.bijgewerkt), ...totalenInhoud());
        return;
      }
      const { data: nieuw, opmerkingen } = vanBladen(bladen);
      if (!bevestigVervangen()) return;
      nieuw.meta.naam = bestand.name.replace(/\.xlsx$/i, '');
      data = nieuw;
      afronden(bestand, opmerkingen);
    }
  } catch (e) {
    console.error(e);
    dialoog('Importeren mislukt', el('p', { text: `${bestand.name} kon niet worden gelezen: ${e.message}` }), el('p', { class: 'klein', text: 'Verwacht: een .xlsx volgens het template of een .json-export van deze tool. Er is niets gewijzigd.' }));
  }
}
const bevestigVervangen = () => !(data.winningen.length || data.maatregelen.length)
  || confirm('De huidige dataset in deze browser wordt vervangen door het bestand. Doorgaan?');

function afronden(bestand, opmerkingen) {
  formulier = null;
  data.meta.datum_import = vandaag();
  data.meta.bron = `Import: ${bestand.name}`;
  gewijzigd(); hervalideer(); renderKop(); renderPaneel();
  dialoog('Import voltooid', el('p', { text: `${bestand.name} is ingelezen als dataset "${data.meta.naam}".` }),
    opmerkingen.length ? el('ul', {}, ...opmerkingen.map((o) => el('li', { text: o }))) : null, ...totalenInhoud());
}

function downloadJson() {
  const a = el('a', { href: URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' })), download: bestandsnaam(data, 'json') });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

$('#btnImport').addEventListener('click', () => $('#bestand').click());
$('#bestand').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) importeer(f); });
$('#btnXlsx').addEventListener('click', () => XLSX.writeFile(naarWerkboek(XLSX, data), bestandsnaam(data, 'xlsx')));
$('#btnJson').addEventListener('click', downloadJson);
$('#btnTemplate').addEventListener('click', () => XLSX.writeFile(leegTemplate(XLSX), 'dwr-leeg-template.xlsx'));
$('#btnTotalen').addEventListener('click', () => dialoog('Controletotalen', ...totalenInhoud()));
$('#btnWis').addEventListener('click', () => {
  if (!confirm('Alle data uit deze browser verwijderen? Download eerst een export als je de data wilt bewaren.')) return;
  wisOpgeslagen(); data = legeDataset(); formulier = null; hervalideer(); renderKop(); renderPaneel(); status('Dataset gewist.');
});

// sleep een bestand op de pagina om te importeren
addEventListener('dragover', (e) => e.preventDefault());
addEventListener('drop', (e) => { e.preventDefault(); const f = e.dataTransfer?.files?.[0]; if (f) importeer(f); });

function renderKop() {
  $('#dsNaam').value = data.meta.naam ?? '';
  $('#dsInfo').textContent = (data.meta.voorbeelddata ? 'VOORBEELDDATA · ' : '') + (data.meta.datum_import ? `geïmporteerd op ${data.meta.datum_import.split('-').reverse().join('-')}` : 'nog niet geïmporteerd');
}
$('#dsNaam').addEventListener('change', (e) => { data.meta.naam = e.target.value.trim() || 'Dataset'; gewijzigd(); });

// -------------------------------------------------------------- start
vulAan();
if (!data.winningen.length) tab = 'winningen';
renderKop(); hervalideer(); renderPaneel();
