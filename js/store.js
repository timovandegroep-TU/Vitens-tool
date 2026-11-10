// Opslag en uitwisseling: localStorage, .json en .xlsx (via SheetJS).
// De omzetting dataset <-> tabbladen werkt op gewone rijen (arrays), zonder DOM en
// zonder SheetJS, zodat die met Node te testen is. SheetJS wordt als parameter meegegeven.

import { PEILJAREN, VRAAGJAREN } from './model.js';
import { TABELLEN, VOETAFDRUK, KEUZES, legeDataset, normaliseer, normaliseerMaatregel } from './schema.js';

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
  const narratieven = String(rij.narratieven ?? '').split(/[,;\s]+/).filter(Boolean).map((x) => (/^\d+$/.test(x) ? Number(x) : x));
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

/** Bestandsnaam: "dwr-<naam>-<datum>.<ext>". */
export function bestandsnaam(data, ext) {
  const slug = String(data.meta?.naam ?? 'dataset').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'dataset';
  return `dwr-${slug}-${new Date().toISOString().slice(0, 10)}.${ext}`;
}
