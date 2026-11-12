// Opslag en uitwisseling: localStorage, .json en .xlsx (via SheetJS).
// De omzetting dataset <-> tabbladen werkt op gewone rijen (arrays), zonder DOM en
// zonder SheetJS, zodat die met Node te testen is. SheetJS wordt als parameter meegegeven.

import { JAAR_MIN, JAAR_MAX, ALLE_CLUSTERS, clusters } from './model.js';
import { TABELLEN, VOETAFDRUK, GRENZEN, MAATREGEL_VELDEN, legeDataset, normaliseer, normaliseerMaatregel } from './schema.js';

const SLEUTEL = 'dwr-dataset-v2';

// ------------------------------------------------------------ localStorage
export function bewaar(data) {
  try { localStorage.setItem(SLEUTEL, JSON.stringify(data)); return true; } catch { return false; }
}
export function laadOpgeslagen() {
  try {
    const tekst = localStorage.getItem(SLEUTEL);
    return tekst ? normaliseer(controleerDataset(JSON.parse(tekst))) : null;
  } catch { return null; }
}
export function wisOpgeslagen() {
  try { localStorage.removeItem(SLEUTEL); } catch { /* geen opslag beschikbaar */ }
}

/**
 * Is dit een dataset van deze tool? Gooit een fout met uitleg als de vorm niet klopt
 * (bv. een willekeurig .json-bestand of het oude formaat). Inhoudelijke fouten meldt de validatie.
 */
export function controleerDataset(obj) {
  const fout = (waarom) => new Error(`Dit is geen dataset van deze tool: ${waarom}.`);
  if (obj == null || typeof obj !== 'object' || Array.isArray(obj)) throw fout('verwacht één object met tabellen');
  if ('narratieven' in obj || 'reductiefactoren' in obj) throw fout('het is het oude formaat met narratieven en reductiefactoren; dat leest deze versie niet meer');
  if (!['winningen', 'vraag', 'maatregelen'].some((k) => k in obj)) throw fout('geen van de tabellen "winningen", "vraag" of "maatregelen" gevonden');
  for (const k of ['winningen', 'vraag', 'maatregelen']) {
    if (obj[k] == null) continue;
    if (!Array.isArray(obj[k])) throw fout(`"${k}" moet een lijst zijn`);
    if (obj[k].some((x) => x == null || typeof x !== 'object' || Array.isArray(x))) throw fout(`"${k}" bevat een rij die geen object is`);
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

export function leesCel(type, v) {
  switch (type) {
    case 'getal': case 'geheel': return leesGetal(v);
    case 'janee': return leesJaNee(v);
    case 'keuze': case 'ref': return leesKeuze(v);
    default: return leesTekst(v);
  }
}
const schrijfCel = (type, v) => (type === 'janee' ? (v ? 'ja' : 'nee') : (v === '' ? null : v ?? null));

// --------------------------------------------------- maatregelen <-> rijen
const THEMAS = Object.keys(VOETAFDRUK);
const KOLOMTYPE = { getal: 'getal', geheel: 'geheel', janee: 'janee', keuze: 'keuze', ref: 'ref' };

/** Kolommen van het tabblad Maatregelen (één rij per maatregel), in de volgorde van de velden. */
export const MAATREGEL_KOLOMMEN = MAATREGEL_VELDEN.map((v) => ({ veld: v.veld, type: KOLOMTYPE[v.type] ?? 'tekst', keuzes: v.keuzes }));

const eenRegel = (s) => String(s ?? '').replace(/\s*\r?\n\s*/g, ' ');

/** Maatregel-dataobject -> platte rij { kolom: waarde }. */
export function maatregelNaarRij(m0) {
  const m = normaliseerMaatregel(m0);
  const rij = {
    id: m.id, naam: m.naam, omschrijving: m.omschrijving, leverancier: m.leverancier, soort: m.soort, spoor: m.spoor,
    standaard_aan: m.standaard_aan ? 'ja' : 'nee', status: m.status,
    volume: m.volume, ingangsjaar: m.ingangsjaar, winning: m.winning, cluster: m.cluster, gemeente: m.gemeente,
    lat: m.locatie?.lat ?? null, lon: m.locatie?.lon ?? null, bron: m.bron,
    ruimtebeslag: m.ruimtebeslag, stroomvraag: m.stroomvraag,
    politiek: m.overige_effecten.politiek,
    // één effect per regel: label | beoordeling | tekst
    overige_effecten: m.overige_effecten.lijst.map((e) => [e.label, e.beoordeling ?? '', e.tekst].map(eenRegel).join(' | ')).join('\n'),
    aangeleverd_door: m.meta.aangeleverd_door, datum: m.meta.datum, bron_document: m.meta.bron,
  };
  for (const t of THEMAS) for (const k of ['beoordeling', 'toelichting', 'bron']) rij[`${t}_${k}`] = m.voetafdruk?.[t]?.[k] ?? null;
  return rij;
}

/** Platte rij { kolom: celwaarde } -> maatregel-dataobject (genormaliseerd). */
export function rijNaarMaatregel(rij) {
  const c = Object.fromEntries(MAATREGEL_KOLOMMEN.map((k) => [k.veld, leesCel(k.type, rij[k.veld])]));
  const lijst = String(rij.overige_effecten ?? '').split(/\r?\n/).map((r) => r.trim()).filter(Boolean).map((regel) => {
    const [label = '', beoordeling = '', ...rest] = regel.split('|').map((x) => x.trim());
    return { label, beoordeling: beoordeling || null, tekst: rest.join(' | ') };
  });
  return normaliseerMaatregel({
    ...c,
    locatie: { lat: c.lat, lon: c.lon },
    voetafdruk: Object.fromEntries(THEMAS.map((t) => [t, { beoordeling: c[`${t}_beoordeling`], toelichting: c[`${t}_toelichting`], bron: c[`${t}_bron`] }])),
    overige_effecten: { politiek: c.politiek, lijst },
    meta: { aangeleverd_door: c.aangeleverd_door, datum: leesDatum(rij.datum), bron: c.bron_document },
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
const BLAD_MAATREGELEN = 'Maatregelen', BLAD_UITLEG = 'Uitleg';

/** Dataset -> { bladnaam: [[kop…], [rij…], …] }: Winningen, Vraag, Maatregelen. */
export function naarBladen(data0) {
  const data = normaliseer(JSON.parse(JSON.stringify(data0)));
  const bladen = {};
  for (const t of TABELLEN) {
    bladen[t.blad] = [t.kolommen.map((k) => k.veld), ...data[t.id].map((x) => t.kolommen.map((k) => schrijfCel(k.type, x[k.veld])))];
  }
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

/** Bevat het werkboek alleen maatregelen (maatregelen-template)? */
export const isMaatregelenBestand = (bladen) => BLAD_MAATREGELEN in bladen && !TABELLEN.some((t) => t.blad in bladen);

/** Lees alleen het tabblad Maatregelen. */
export const maatregelenUitBladen = (bladen) => alsObjecten(bladen[BLAD_MAATREGELEN]).map(rijNaarMaatregel);

/**
 * { bladnaam: rijen } -> dataset.
 * @returns { data, opmerkingen: [tekst] }  opmerkingen = ontbrekende tabbladen
 */
export function vanBladen(bladen) {
  const data = legeDataset();
  const opmerkingen = [];
  for (const t of TABELLEN) {
    if (!(t.blad in bladen)) { opmerkingen.push(`Tabblad "${t.blad}" ontbreekt.`); continue; }
    data[t.id] = alsObjecten(bladen[t.blad]).map((r) => Object.fromEntries(t.kolommen.map((k) => [k.veld, leesCel(k.type, r[k.veld])])));
  }
  if (BLAD_MAATREGELEN in bladen) data.maatregelen = maatregelenUitBladen(bladen);
  else opmerkingen.push(`Tabblad "${BLAD_MAATREGELEN}" ontbreekt.`);
  return { data: normaliseer(data), opmerkingen };
}

/** Tabblad "Uitleg": per tabel en kolom de uitlegtekst. */
export function uitlegBlad() {
  const rijen = [['Tabblad', 'Kolom', 'Type', 'Uitleg']];
  for (const t of TABELLEN) {
    rijen.push([t.blad, '', '', t.uitleg]);
    for (const k of t.kolommen) rijen.push([t.blad, k.veld, k.type + (k.eenheid ? ` (${k.eenheid})` : ''), k.uitleg]);
  }
  rijen.push([BLAD_MAATREGELEN, '', '', 'Eén rij per maatregel. Uitleg per kolom: zie hieronder en het maatregelen-template.']);
  for (const v of MAATREGEL_VELDEN) rijen.push([BLAD_MAATREGELEN, v.veld, v.type + (v.eenheid ? ` (${v.eenheid})` : ''), v.uitleg]);
  rijen.push(['Algemeen', '', '', 'Volumes in Mm³/j. Decimalen met komma of punt. ja/nee-kolommen: "ja" of "nee". De kopregels niet wijzigen.']);
  return rijen;
}

// ------------------------------------------------------------- SheetJS
const kolombreedtes = (rijen, max = 60) => rijen[0].map((k, i) => ({ wch: Math.min(max, Math.max(10, String(k).length + 2, ...rijen.slice(1, 60).map((r) => String(r[i] ?? '').split('\n')[0].length + 1))) }));

/** Dataset -> SheetJS-werkboek. */
export function naarWerkboek(XLSX, data, { metUitleg = true } = {}) {
  const wb = XLSX.utils.book_new();
  const bladen = naarBladen(data);
  if (metUitleg) bladen[BLAD_UITLEG] = uitlegBlad();
  for (const [naam, rijen] of Object.entries(bladen)) {
    const ws = XLSX.utils.aoa_to_sheet(rijen);
    ws['!cols'] = kolombreedtes(rijen);
    XLSX.utils.book_append_sheet(wb, ws, naam);
  }
  return wb;
}

/** SheetJS-werkboek -> { bladnaam: rijen }. */
export function werkboekNaarBladen(XLSX, wb) {
  return Object.fromEntries(wb.SheetNames.map((naam) =>
    [naam.trim(), XLSX.utils.sheet_to_json(wb.Sheets[naam], { header: 1, defval: null, blankrows: false })]));
}

/** Leeg template: de drie tabbladen met koppen, plus Uitleg. */
export const leegTemplate = (XLSX) => naarWerkboek(XLSX, { ...legeDataset(), meta: { ...legeDataset().meta, naam: 'Leeg template' } });

// ------------------------------------------------- maatregelen-template
const MAX_RIJEN = 500;                       // gegevensvalidatie geldt voor rij 2 t/m 500
const kolomletter = (i) => { let s = ''; for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s; return s; };
const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Keuzelijsten voor het template: { kolomnaam: [opties] }. Clusters en winningen komen uit de dataset. */
export function templateLijsten(data) {
  const uit = {};
  for (const k of MAATREGEL_KOLOMMEN) {
    if (k.type === 'janee') uit[k.veld] = ['ja', 'nee'];
    else if (k.keuzes) uit[k.veld] = [...k.keuzes];
  }
  uit.winning = (data.winningen ?? []).map((w) => w.naam).filter(Boolean);
  uit.cluster = [ALLE_CLUSTERS, ...clusters(data)];
  return uit;
}

/** Tabblad "Uitleg" van het maatregelen-template. */
export function maatregelUitlegBlad(lijsten) {
  const rijen = [['Kolom', 'Blok', 'Naam', 'Verplicht', 'Keuzes / eenheid', 'Uitleg']];
  const lang = new Set(['winning']);
  for (const v of MAATREGEL_VELDEN) {
    rijen.push([v.veld, v.blok, v.label, v.verplicht ? 'ja' : v.levering ? 'bij waterlevering' : 'nee',
      lijsten[v.veld] ? (lang.has(v.veld) ? 'zie tabblad Lijsten' : lijsten[v.veld].join(' / ')) : v.eenheid ?? '', v.uitleg]);
  }
  rijen.push([], ['Algemeen', '', '', '', '', 'Eén rij per maatregel op het tabblad Maatregelen; de kopregel niet wijzigen. Volumes in Mm³/j, altijd positief. Decimalen met komma of punt. Bij importeren op de invoerpagina: een nieuw id wordt toegevoegd, een bestaand id overschreven.']);
  rijen.push(['Algemeen', '', '', '', '', 'Bij waterbesparing en afname blijven lat, lon, bron, ruimtebeslag, stroomvraag en de voetafdruk leeg.']);
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
  const namen = Object.keys(lijsten).filter((n) => lijsten[n].length);
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
    ws['!cols'] = kolombreedtes(rijen, 70);
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
