// Opslag en uitwisseling: localStorage, .json en .xlsx (via SheetJS).
// De omzetting dataset <-> tabbladen werkt op gewone rijen (arrays), zonder DOM en
// zonder SheetJS, zodat die met Node te testen is. SheetJS wordt als parameter meegegeven.

import { PEILJAREN, VRAAGJAREN, JAAR_MIN, JAAR_MAX, ALLE_CLUSTERS } from './model.js';
import {
  TABELLEN, VOETAFDRUK, KEUZES, GRENZEN, MAATREGEL_VELDEN, legeDataset, normaliseer, normaliseerMaatregel,
} from './schema.js';

const SLEUTEL = 'dwr-dataset-v1';

// ------------------------------------------------------------ localStorage
export function bewaar(data) {
  try { localStorage.setItem(SLEUTEL, JSON.stringify(data)); return true; } catch { return false; }
}
export function laadOpgeslagen() {
  try {
    const tekst = localStorage.getItem(SLEUTEL);
    return tekst ? normaliseer(JSON.parse(tekst)) : null;
  } catch { return null; }
}
export function wisOpgeslagen() {
  try { localStorage.removeItem(SLEUTEL); } catch { /* geen opslag beschikbaar */ }
}

/**
 * Is dit een dataset van deze tool? Gooit een fout met uitleg als de vorm niet klopt
 * (bv. een willekeurig .json-bestand). Inhoudelijke fouten meldt de validatie.
 */
export function controleerDataset(obj) {
  const fout = (waarom) => new Error(`Dit is geen dataset van deze tool: ${waarom}.`);
  if (obj == null || typeof obj !== 'object' || Array.isArray(obj)) throw fout('verwacht één object met tabellen');
  const leeg = legeDataset();
  if (!['narratieven', 'clusters', 'winningen', 'maatregelen'].some((k) => k in obj)) {
    throw fout('geen van de tabellen "narratieven", "clusters", "winningen" of "maatregelen" gevonden');
  }
  for (const [k, vorm] of Object.entries(leeg)) {
    if (obj[k] == null) continue;
    const ok = Array.isArray(vorm) ? Array.isArray(obj[k]) : typeof obj[k] === 'object' && !Array.isArray(obj[k]);
    if (!ok) throw fout(`"${k}" moet een ${Array.isArray(vorm) ? 'lijst' : 'object'} zijn`);
    if (Array.isArray(vorm) && obj[k].some((x) => x == null || typeof x !== 'object' || Array.isArray(x))) throw fout(`"${k}" bevat een rij die geen object is`);
  }
  return obj;
}

// ------------------------------------------------------- celwaarden lezen
const isLeeg = (v) => v == null || (typeof v === 'string' && v.trim() === '');

/** "1,5" of "1.5" of 1.5 -> 1.5. Leeg -> null. Niet te lezen -> de oorspronkelijke tekst (validatie meldt het). */
export function leesGetal(v) {
  if (isLeeg(v)) return null;
  if (typeof v === 'number') return v;
  const s = String(v).trim().replace(/\s/g, '');
  // nl-NL: komma = decimaalteken. "1.234,5" -> 1234.5 ; "1,5" -> 1.5 ; "1.5" -> 1.5
  const t = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = Number(t);
  return t !== '' && Number.isFinite(n) ? n : String(v);
}
export function leesJaNee(v) {
  if (typeof v === 'boolean') return v;
  return ['ja', 'j', 'true', '1', 'x', 'yes'].includes(String(v ?? '').trim().toLowerCase());
}
const leesTekst = (v) => (v == null ? '' : String(v).trim());
const leesKeuze = (v) => (isLeeg(v) ? null : String(v).trim());

/** Excel-datum (serienummer of Date) of tekst -> "jjjj-mm-dd". */
export function leesDatum(v) {
  if (isLeeg(v)) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'number') return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);            // dd-mm-jjjj
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : s;
}

function leesCel(type, v) {
  switch (type) {
    case 'getal': return leesGetal(v);
    case 'geheel': { const n = leesGetal(v); return typeof n === 'number' && Number.isInteger(n) ? n : n; }
    case 'janee': return leesJaNee(v);
    case 'keuze': case 'ref': return leesKeuze(v);
    default: return leesTekst(v);
  }
}
const schrijfCel = (type, v) => (type === 'janee' ? (v ? 'ja' : 'nee') : (v ?? null));

/**
 * Geplakt blok voor de reductiefactortabel: het werkdocument heeft na elke groep van
 * drie jaren een scheidingskolom (leeg of "x", kolommen K, O, S, …). Die moet weg.
 * @param blok    [[cel…]…] zoals geplakt, beginnend op de 2030-kolom van een criterium
 * @param ruimte  aantal invulkolommen vanaf de startcel
 * @returns { blok, scheiding: 'ja' | 'nee' | 'twijfel' }
 *   'ja'      zeker Excel-indeling: `blok` is al zonder scheidingskolommen
 *   'twijfel' elke 4e kolom is leeg en het blok past ook zonder strippen: kan allebei.
 *             `blok` is ongewijzigd; de aanroeper vraagt het de gebruiker.
 */
export function zonderScheidingskolommen(blok, ruimte) {
  const breedte = Math.max(0, ...blok.map((r) => r.length));
  const isScheiding = (i) => i % 4 === 3;
  const cellen = blok.flatMap((r) => r.filter((_, i) => isScheiding(i)));
  if (breedte < 4 || cellen.some((v) => typeof leesGetal(v) === 'number')) return { blok, scheiding: 'nee' };
  const zeker = breedte > ruimte || cellen.some((v) => !isLeeg(v));
  return zeker ? { blok: strip(blok), scheiding: 'ja' } : { blok, scheiding: 'twijfel' };
}
const strip = (blok) => blok.map((r) => r.filter((_, i) => i % 4 !== 3));
export { strip as stripScheidingskolommen };

// --------------------------------------------------- maatregelen <-> rijen
const THEMAS = Object.keys(VOETAFDRUK);

/** Kolommen van het tabblad Maatregelen: één rij per maatregel. */
export const MAATREGEL_KOLOMMEN = [
  { veld: 'id', type: 'tekst' }, { veld: 'naam', type: 'tekst' }, { veld: 'omschrijving', type: 'tekst' },
  { veld: 'leverancier', type: 'keuze', keuzes: KEUZES.leverancier }, { veld: 'soort', type: 'keuze', keuzes: KEUZES.soort },
  { veld: 'spoor', type: 'keuze', keuzes: KEUZES.spoor }, { veld: 'narratieven', type: 'tekst' },
  { veld: 'standaard_aan', type: 'janee' }, { veld: 'status', type: 'keuze', keuzes: KEUZES.status },
  { veld: 'lat', type: 'getal' }, { veld: 'lon', type: 'getal' }, { veld: 'gemeente', type: 'ref' },
  { veld: 'cluster', type: 'ref' }, { veld: 'bron', type: 'keuze', keuzes: KEUZES.bron },
  { veld: 'volume', type: 'getal' }, { veld: 'ruimtebeslag', type: 'getal' }, { veld: 'stroomvraag', type: 'getal' },
  { veld: 'ingangsjaar', type: 'geheel' },
  ...THEMAS.flatMap((t) => [
    { veld: `${t}_beoordeling`, type: 'keuze', keuzes: VOETAFDRUK[t].keuzes },
    { veld: `${t}_toelichting`, type: 'tekst' }, { veld: `${t}_bron`, type: 'tekst' },
  ]),
  { veld: 'politiek', type: 'tekst' }, { veld: 'overige_effecten', type: 'tekst' },
  { veld: 'aangeleverd_door', type: 'tekst' }, { veld: 'datum', type: 'tekst' },
  { veld: 'bron_document', type: 'tekst' }, { veld: 'onvolledig', type: 'janee' },
];

const eenRegel = (s) => String(s ?? '').replace(/\s*\r?\n\s*/g, ' ');

/** Maatregel-dataobject -> platte rij { kolom: waarde }. */
export function maatregelNaarRij(m0) {
  const m = normaliseerMaatregel(m0);
  const rij = {
    id: m.id, naam: m.naam, omschrijving: m.omschrijving, leverancier: m.leverancier, soort: m.soort, spoor: m.spoor,
    narratieven: m.narratieven.join(','), standaard_aan: m.standaard_aan ? 'ja' : 'nee', status: m.status,
    lat: m.locatie?.lat ?? null, lon: m.locatie?.lon ?? null, gemeente: m.gemeente, cluster: m.cluster, bron: m.bron,
    volume: m.volume, ruimtebeslag: m.ruimtebeslag, stroomvraag: m.stroomvraag, ingangsjaar: m.ingangsjaar,
    politiek: m.overige_effecten.politiek,
    // één effect per regel: label | beoordeling | tekst
    overige_effecten: m.overige_effecten.lijst.map((e) => [e.label, e.beoordeling ?? '', e.tekst].map(eenRegel).join(' | ')).join('\n'),
    aangeleverd_door: m.meta.aangeleverd_door, datum: m.meta.datum, bron_document: m.meta.bron,
    onvolledig: m.meta.onvolledig ? 'ja' : 'nee',
  };
  for (const t of THEMAS) for (const k of ['beoordeling', 'toelichting', 'bron']) rij[`${t}_${k}`] = m.voetafdruk?.[t]?.[k] ?? null;
  return rij;
}

/** Platte rij { kolom: celwaarde } -> maatregel-dataobject (genormaliseerd). */
export function rijNaarMaatregel(rij) {
  const c = Object.fromEntries(MAATREGEL_KOLOMMEN.map((k) => [k.veld, leesCel(k.type, rij[k.veld])]));
  const narratieven = String(rij.narratieven ?? '').split(/[,;.\s]+/).filter(Boolean).map((x) => (/^\d+$/.test(x) ? Number(x) : x));
  const lijst = String(rij.overige_effecten ?? '').split(/\r?\n/).map((r) => r.trim()).filter(Boolean).map((regel) => {
    const [label = '', beoordeling = '', ...rest] = regel.split('|').map((x) => x.trim());
    return { label, beoordeling: beoordeling || null, tekst: rest.join(' | ') };
  });
  return normaliseerMaatregel({
    ...c, narratieven: narratieven.length ? narratieven : [],
    locatie: { lat: c.lat, lon: c.lon },
    voetafdruk: Object.fromEntries(THEMAS.map((t) => [t, { beoordeling: c[`${t}_beoordeling`], toelichting: c[`${t}_toelichting`], bron: c[`${t}_bron`] }])),
    overige_effecten: { politiek: c.politiek, lijst },
    meta: { aangeleverd_door: c.aangeleverd_door, datum: leesDatum(rij.datum), bron: c.bron_document, onvolledig: c.onvolledig },
  });
}

/**
 * Zet aangeleverde maatregelen over de bestaande heen: nieuw id = toevoegen,
 * bestaand id = overschrijven. Wijzigt `data.maatregelen`.
 */
export function voegMaatregelenSamen(data, nieuwe) {
  const index = new Map(data.maatregelen.map((m, i) => [m.id, i]));
  const uit = { toegevoegd: [], bijgewerkt: [] };
  for (const m of nieuwe) {
    if (index.has(m.id)) { data.maatregelen[index.get(m.id)] = m; uit.bijgewerkt.push(m.id); }
    else { index.set(m.id, data.maatregelen.length); data.maatregelen.push(m); uit.toegevoegd.push(m.id); }
  }
  return uit;
}

// ---------------------------------------------------- dataset <-> bladen
const bladRF = (n) => `Reductiefactoren N${n}`;
const BLAD_VRAAG = 'Vraag', BLAD_MAATREGELEN = 'Maatregelen', BLAD_UITLEG = 'Uitleg';

/** Dataset -> { bladnaam: [[kop…], [rij…], …] } (volgorde = volgorde van de tabbladen). */
export function naarBladen(data0) {
  const data = normaliseer(JSON.parse(JSON.stringify(data0)));
  const bladen = {};
  for (const t of TABELLEN) {
    bladen[t.blad] = [t.kolommen.map((k) => k.veld), ...data[t.id].map((x) => t.kolommen.map((k) => schrijfCel(k.type, x[k.veld])))];
  }
  for (const n of data.narratieven) {
    const rf = data.reductiefactoren[n.id];
    bladen[bladRF(n.id)] = [
      ['winning', ...data.criteria.flatMap((c) => PEILJAREN.map((j) => `${c.id} ${j}`))],
      ...data.winningen.map((w) => [w.id, ...data.criteria.flatMap((c) => rf[w.id][c.id])]),
    ];
  }
  bladen[BLAD_VRAAG] = [['narratief', 'cluster', ...VRAAGJAREN],
    ...data.narratieven.flatMap((n) => data.clusters.map((c) => [n.id, c.id, ...VRAAGJAREN.map((j) => data.vraag[n.id][c.id][j])]))];
  bladen[BLAD_MAATREGELEN] = [MAATREGEL_KOLOMMEN.map((k) => k.veld),
    ...data.maatregelen.map((m) => { const r = maatregelNaarRij(m); return MAATREGEL_KOLOMMEN.map((k) => r[k.veld]); })];
  return bladen;
}

/** [[kop…], [rij…]] -> [{ kop: waarde }], lege rijen overgeslagen. */
function alsObjecten(rijen) {
  if (!rijen?.length) return [];
  const kop = rijen[0].map((k) => String(k ?? '').trim());
  return rijen.slice(1).filter((r) => r && r.some((v) => !isLeeg(v)))
    .map((r) => Object.fromEntries(kop.map((k, i) => [k, r[i] ?? null])));
}

/** Bevat het werkboek alleen maatregelen (maatregelen-template van Vitens)? */
export const isMaatregelenBestand = (bladen) => BLAD_MAATREGELEN in bladen && !('Winningen' in bladen);

/** Lees alleen het tabblad Maatregelen. */
export const maatregelenUitBladen = (bladen) => alsObjecten(bladen[BLAD_MAATREGELEN]).map(rijNaarMaatregel);

/**
 * { bladnaam: rijen } -> dataset.
 * @returns { data, opmerkingen: [tekst] }  opmerkingen = ontbrekende tabbladen e.d.
 */
export function vanBladen(bladen) {
  const data = legeDataset();
  const opmerkingen = [];
  for (const t of TABELLEN) {
    if (!(t.blad in bladen)) { opmerkingen.push(`Tabblad "${t.blad}" ontbreekt.`); if (!t.vast && t.id !== 'criteria') data[t.id] = []; continue; }
    data[t.id] = alsObjecten(bladen[t.blad]).map((r) => Object.fromEntries(t.kolommen.map((k) => [k.veld, leesCel(k.type, r[k.veld])])));
  }
  for (const n of data.narratieven) {
    const N = String(n.id);
    data.reductiefactoren[N] = {};
    if (!(bladRF(N) in bladen)) { opmerkingen.push(`Tabblad "${bladRF(N)}" ontbreekt: alle factoren worden 1.`); continue; }
    for (const r of alsObjecten(bladen[bladRF(N)])) {
      const wid = leesTekst(r.winning);
      const perCrit = {};
      for (const [kop, v] of Object.entries(r)) {
        const m = kop.match(/^(.+)\s+(\d{4})$/);
        const i = m ? PEILJAREN.indexOf(Number(m[2])) : -1;
        if (i < 0) continue;
        (perCrit[m[1]] ??= [null, null, null])[i] = leesGetal(v);
      }
      data.reductiefactoren[N][wid] = perCrit;
    }
  }
  if (BLAD_VRAAG in bladen) {
    for (const r of alsObjecten(bladen[BLAD_VRAAG])) {
      const N = String(leesGetal(r.narratief)), cid = leesTekst(r.cluster);
      (data.vraag[N] ??= {})[cid] = Object.fromEntries(VRAAGJAREN.map((j) => [String(j), leesGetal(r[j])]));
    }
  } else opmerkingen.push(`Tabblad "${BLAD_VRAAG}" ontbreekt.`);
  if (BLAD_MAATREGELEN in bladen) data.maatregelen = maatregelenUitBladen(bladen);
  // onbekende winningen/criteria/clusters uit de bladen blijven staan zodat de validatie ze meldt
  const rfRuw = data.reductiefactoren, vraagRuw = data.vraag;
  normaliseer(data);
  for (const [N, perW] of Object.entries(rfRuw)) {
    for (const [wid, perC] of Object.entries(perW)) {
      for (const [cid, rij] of Object.entries(perC)) {
        if (!data.reductiefactoren[N]?.[wid]?.[cid]) ((data.reductiefactoren[N] ??= {})[wid] ??= {})[cid] = rij;
      }
    }
  }
  for (const [N, perC] of Object.entries(vraagRuw)) {
    for (const [cid, rij] of Object.entries(perC)) if (!data.vraag[N]?.[cid]) (data.vraag[N] ??= {})[cid] = rij;
  }
  return { data, opmerkingen };
}

/** Tabblad "Uitleg": per tabel en kolom de uitlegtekst. */
export function uitlegBlad() {
  const rijen = [['Tabblad', 'Kolom', 'Type', 'Uitleg']];
  for (const t of TABELLEN) {
    rijen.push([t.blad, '', '', t.uitleg]);
    for (const k of t.kolommen) rijen.push([t.blad, k.veld, k.type + (k.eenheid ? ` (${k.eenheid})` : ''), k.uitleg]);
  }
  rijen.push(['Reductiefactoren N1–N4', '', 'getal 0–1', 'Rijen = winningen (id), kolommen = "<criterium-id> <jaar>" voor 2030, 2040 en 2050. Leeg = 1. De factor van een winning is het minimum over de criteria.']);
  rijen.push([BLAD_VRAAG, '', 'getal (Mm³/j)', 'Eén rij per narratief × cluster; kolommen 2025 t/m 2050 per 5 jaar.']);
  rijen.push([BLAD_MAATREGELEN, '', '', 'Eén rij per maatregel. Zie het maatregelen-template voor de uitleg per veld.']);
  rijen.push(['Algemeen', '', '', 'Volumes in Mm³/j. Decimalen met komma of punt. ja/nee-kolommen: "ja" of "nee".']);
  return rijen;
}

// ------------------------------------------------------------- SheetJS
/** Dataset -> SheetJS-werkboek. */
export function naarWerkboek(XLSX, data, { metUitleg = true } = {}) {
  const wb = XLSX.utils.book_new();
  const bladen = naarBladen(data);
  if (metUitleg) bladen[BLAD_UITLEG] = uitlegBlad();
  for (const [naam, rijen] of Object.entries(bladen)) {
    const ws = XLSX.utils.aoa_to_sheet(rijen);
    ws['!cols'] = rijen[0].map((k, i) => ({ wch: Math.min(60, Math.max(10, String(k).length + 2, ...rijen.slice(1, 40).map((r) => String(r[i] ?? '').length + 1))) }));
    XLSX.utils.book_append_sheet(wb, ws, naam);
  }
  return wb;
}

/** SheetJS-werkboek -> { bladnaam: rijen }. */
export function werkboekNaarBladen(XLSX, wb) {
  return Object.fromEntries(wb.SheetNames.map((naam) =>
    [naam.trim(), XLSX.utils.sheet_to_json(wb.Sheets[naam], { header: 1, defval: null, blankrows: false })]));
}

/** Leeg template: alle tabbladen met koppen; narratieven en criteria vooringevuld. */
export const leegTemplate = (XLSX) => naarWerkboek(XLSX, { ...legeDataset(), meta: { ...legeDataset().meta, naam: 'Leeg template' } });

// ------------------------------------------------- maatregelen-template
const MAX_RIJEN = 500;                       // gegevensvalidatie geldt voor rij 2 t/m 500
const kolomletter = (i) => { let s = ''; for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s; return s; };
const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Keuzelijsten voor het template: { kolomnaam: [opties] }. Gemeenten en clusters komen uit de dataset. */
export function templateLijsten(data) {
  const uit = {};
  for (const k of MAATREGEL_KOLOMMEN) {
    if (k.type === 'janee') uit[k.veld] = ['ja', 'nee'];
    else if (k.keuzes) uit[k.veld] = [...k.keuzes];
  }
  uit.gemeente = (data.gemeenten ?? []).map((g) => g.gemeente).filter(Boolean);
  uit.cluster = [ALLE_CLUSTERS, ...(data.clusters ?? []).map((c) => c.id).filter(Boolean)];
  return uit;
}

/** Tabblad "Uitleg" van het maatregelen-template. */
export function maatregelUitlegBlad(lijsten) {
  const rijen = [['Kolom', 'Blok', 'Naam', 'Verplicht', 'Keuzes / eenheid', 'Uitleg']];
  for (const v of MAATREGEL_VELDEN) {
    rijen.push([v.veld, v.blok, v.label, v.verplicht ? 'ja' : v.levering ? 'bij waterlevering' : 'nee',
      lijsten[v.veld] && v.veld !== 'gemeente' ? lijsten[v.veld].join(' / ') : v.veld === 'gemeente' ? 'zie tabblad Lijsten' : v.eenheid ?? '', v.uitleg]);
  }
  rijen.push([], ['Algemeen', '', '', '', '', 'Eén rij per maatregel op het tabblad Maatregelen; de kopregel niet wijzigen. Volumes in Mm³/j. Decimalen met komma of punt. Bij importeren op de invoerpagina: een nieuw id wordt toegevoegd, een bestaand id overschreven.']);
  rijen.push(['Algemeen', '', '', '', '', 'Bij waterbesparing blijven lat, lon, bron, ruimtebeslag, stroomvraag en de voetafdruk leeg.']);
  return rijen;
}

/** Gegevensvalidatie (XML) voor het tabblad Maatregelen. */
function validatieXml(lijsten, lijstKolom, aantalLijstRijen) {
  const bereik = (i) => `${kolomletter(i)}2:${kolomletter(i)}${MAX_RIJEN}`;
  const g = GRENZEN.nederland;
  const getallen = {
    volume: ['decimal', 'greaterThanOrEqual', 0, null, 'Vul een positief getal in (Mm³/j).'],
    ruimtebeslag: ['decimal', 'greaterThanOrEqual', 0, null, 'Vul een positief getal in (ha).'],
    stroomvraag: ['decimal', 'greaterThanOrEqual', 0, null, 'Vul een positief getal in (MW).'],
    ingangsjaar: ['whole', 'between', JAAR_MIN, JAAR_MAX, `Vul een jaartal in van ${JAAR_MIN} t/m ${JAAR_MAX}.`],
    lat: ['decimal', 'between', g.latMin, g.latMax, `Breedtegraad in WGS84: ${g.latMin} t/m ${g.latMax}.`],
    lon: ['decimal', 'between', g.lonMin, g.lonMax, `Lengtegraad in WGS84: ${g.lonMin} t/m ${g.lonMax}.`],
  };
  const dv = [];
  MAATREGEL_KOLOMMEN.forEach((k, i) => {
    const basis = `allowBlank="1" showErrorMessage="1" errorTitle="${xml(k.veld)}" sqref="${bereik(i)}"`;
    if (lijsten[k.veld]?.length) {
      const L = kolomletter(lijstKolom[k.veld]);
      dv.push(`<dataValidation type="list" ${basis} error="${xml('Kies een waarde uit de lijst.')}"><formula1>Lijsten!$${L}$2:$${L}$${aantalLijstRijen[k.veld] + 1}</formula1></dataValidation>`);
    } else if (getallen[k.veld]) {
      const [type, op, a, b, tekst] = getallen[k.veld];
      dv.push(`<dataValidation type="${type}" operator="${op}" ${basis} error="${xml(tekst)}"><formula1>${a}</formula1>${b == null ? '' : `<formula2>${b}</formula2>`}</dataValidation>`);
    }
  });
  return `<dataValidations count="${dv.length}">${dv.join('')}</dataValidations>`;
}

/**
 * Maatregelen-template als .xlsx-bytes (Uint8Array): tabbladen Maatregelen (met
 * gegevensvalidatie), Uitleg en Lijsten. `maatregelen` leeg = leeg template.
 * SheetJS schrijft zelf geen gegevensvalidatie; die wordt in het bladbestand ingevoegd.
 */
export function maatregelenTemplate(XLSX, data, maatregelen = []) {
  const lijsten = templateLijsten(data);
  const namen = Object.keys(lijsten);
  const lijstKolom = Object.fromEntries(namen.map((n, i) => [n, i]));
  const aantal = Object.fromEntries(namen.map((n) => [n, lijsten[n].length]));
  const hoogte = Math.max(0, ...Object.values(aantal));
  const bladen = {
    [BLAD_MAATREGELEN]: [MAATREGEL_KOLOMMEN.map((k) => k.veld),
      ...maatregelen.map((m) => { const r = maatregelNaarRij(m); return MAATREGEL_KOLOMMEN.map((k) => r[k.veld]); })],
    [BLAD_UITLEG]: maatregelUitlegBlad(lijsten),
    Lijsten: [namen, ...Array.from({ length: hoogte }, (_, r) => namen.map((n) => lijsten[n][r] ?? null))],
  };
  const wb = XLSX.utils.book_new();
  for (const [naam, rijen] of Object.entries(bladen)) {
    const ws = XLSX.utils.aoa_to_sheet(rijen);
    ws['!cols'] = rijen[0].map((k, i) => ({ wch: Math.min(70, Math.max(12, String(k).length + 2, ...rijen.slice(1, 60).map((r) => String(r[i] ?? '').split('\n')[0].length + 1))) }));
    XLSX.utils.book_append_sheet(wb, ws, naam);
  }
  // gegevensvalidatie invoegen in het eerste blad (Maatregelen)
  const zip = XLSX.CFB.read(new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' })), { type: 'array' });
  const i = zip.FullPaths.findIndex((p) => p.endsWith('xl/worksheets/sheet1.xml'));
  const tekst = new TextDecoder().decode(new Uint8Array(zip.FileIndex[i].content));
  if (!tekst.includes('</sheetData>')) throw new Error('Template: onverwachte bladindeling.');
  const nieuw = new TextEncoder().encode(tekst.replace('</sheetData>', '</sheetData>' + validatieXml(lijsten, lijstKolom, aantal)));
  zip.FileIndex[i].content = nieuw; zip.FileIndex[i].size = nieuw.length;
  return new Uint8Array(XLSX.CFB.write(zip, { fileType: 'zip', type: 'array' }));
}

/** Bestandsnaam: "dwr-<naam>-<datum>.<ext>". */
export function bestandsnaam(data, ext) {
  const slug = String(data.meta?.naam ?? 'dataset').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'dataset';
  return `dwr-${slug}-${new Date().toISOString().slice(0, 10)}.${ext}`;
}
