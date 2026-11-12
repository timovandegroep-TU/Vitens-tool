// Datamodel: keuzelijsten, tabellen en validatie. Puur (geen DOM), dus ook in Node te testen.
// De structuur staat beschreven in docs/datamodel.schema.json.
//
// Een dataset bestaat uit drie lijsten, gelijk aan de drie tabbladen van het Excel-template:
//   winningen   bestaande winningen met hun huidige capaciteit (= huidig aanbod)
//   vraag       drinkwatervraag per scenario × cluster, per 5 jaar
//   maatregelen dataobjecten die vraag of aanbod veranderen
// Scenario's en clusters zijn geen aparte tabel: ze volgen uit de tabel Vraag.

import { ALLE_CLUSTERS, JAAR_MIN, JAAR_MAX, VRAAGJAREN, scenarios, clusters } from './model.js';

export const KEUZES = {
  leverancier: ['Vitens', 'Oasen', 'Waternet'],
  soort: ['waterlevering', 'waterbesparing', 'afname'],
  spoor: ['S0', 'S1', 'S2', 'S3'],
  status: ['idee', 'verkenning', 'besloten', 'in uitvoering'],
  bron: ['grondwater', 'oevergrondwater', 'oppervlaktewater', 'overig'],
  overigEffect: ['kans', 'aandacht', 'knelpunt'],
};

/** Wat een soort doet: op welke kant van de opgave en met welk teken. */
export const SOORTEN = {
  waterlevering: { werktOp: 'aanbod', teken: '+', uitleg: 'aanbod omhoog (levering)', volume: 'vergunde capaciteit' },
  waterbesparing: { werktOp: 'vraag', teken: '−', uitleg: 'vraag omlaag (besparing)', volume: 'verlaagde vraag' },
  afname: { werktOp: 'aanbod', teken: '−', uitleg: 'aanbod omlaag (afname bestaande capaciteit)', volume: 'afname van de capaciteit' },
};

export const SPOREN = {
  S0: 'Spoor 0 – Drinkwaterbesparing',
  S1: 'Spoor 1 – Instandhouding bestaande capaciteit',
  S2: 'Spoor 2 – Vergroten op bestaande locatie',
  S3: 'Spoor 3 – Nieuwe winlocatie',
};

// Fysieke voetafdruk: thema's met hun beoordelingen, van licht naar zwaar; 'onbekend' apart.
export const VOETAFDRUK = {
  grondwater:       { naam: 'Grondwater',                 keuzes: ['geen effect', 'beperkt', 'significant', 'onbekend'] },
  beschermingszone: { naam: 'Grondwaterbeschermingszone', keuzes: ['buiten', 'in of grenst aan', 'onbekend'] },
  natura2000:       { naam: 'Natura 2000',                keuzes: ['geen invloed', 'mogelijk', 'waarschijnlijk', 'onbekend'] },
  netcapaciteit:    { naam: 'Netcapaciteit',              keuzes: ['voldoende', 'krap', 'onvoldoende', 'onbekend'] },
};

// Grenzen voor de validatie
export const GRENZEN = {
  volumeWaarschuwing: 30,                                  // Mm³/j: daarboven mogelijk in m³ ingevuld
  nederland: { latMin: 50.7, latMax: 53.6, lonMin: 3.3, lonMax: 7.3 },
  naamMax: 35,
};

const FOUT = 'fout', WAARSCHUWING = 'waarschuwing';
const leeg = (v) => v == null || (typeof v === 'string' && v.trim() === '');
const isGetal = (v) => typeof v === 'number' && Number.isFinite(v);

// ------------------------------------------------------------------ tabellen
// Eén definitie per basistabel: naam van het tabblad (Excel + invoerpagina) en per
// kolom het type en de uitlegtekst. Types: tekst | getal | janee | keuze.
// `rij(x)` geeft de naam van een rij in validatiemeldingen.

export const TABELLEN = [
  {
    id: 'winningen', blad: 'Winningen', rij: (w) => String(w.naam ?? ''),
    uitleg: 'Bestaande winningen. Het huidige aanbod is de som van de inzetbare productiecapaciteit; die blijft gelijk tot een maatregel het aanbod verandert (een levering of een afname). De eerste zes kolommen staan in dezelfde volgorde als in het werkdocument (Locatie t/m Inzetbare productiecapaciteit), zodat u dat blok in één keer kunt plakken.',
    kolommen: [
      { veld: 'naam', label: 'Locatie', type: 'tekst', uitleg: 'Naam van de winning. Mag vaker voorkomen bij verschillende clusters (bv. Fledite ROL); de combinatie naam + cluster is uniek. Een maatregel kan hiernaar verwijzen (kolom "winning").' },
      { veld: 'type', label: 'Type', type: 'tekst', uitleg: 'Bv. Winning. Alleen ter informatie.' },
      { veld: 'cluster', label: 'Vitens cluster (gebruik)', type: 'tekst', uitleg: 'Cluster dat het water gebruikt. Moet ook in de tabel Vraag voorkomen.' },
      { veld: 'watersysteem', label: 'Watersysteem', type: 'tekst', uitleg: 'Flanken / Heuvelrug / Polder / Riviergebied. Alleen ter informatie.' },
      { veld: 'huidig_aanbod', label: 'Huidig aanbod', type: 'getal', eenheid: 'Mm³/j', uitleg: 'Vergunde capaciteit na bestuurlijke beperkingen. Alleen ter informatie; de tool rekent met de inzetbare productiecapaciteit.' },
      { veld: 'capaciteit', label: 'Inzetbare productiecapaciteit', type: 'getal', eenheid: 'Mm³/j', uitleg: 'Hiermee rekent de tool: dit is het huidige aanbod van de winning.' },
      { veld: 'gemeente', label: 'Gemeente', type: 'tekst', uitleg: 'Gemeente waarin de winning ligt. Alleen ter informatie.' },
      { veld: 'lat', label: 'Lat', type: 'getal', uitleg: 'Breedtegraad (WGS84), bv. 52,09. Voor de kaart.' },
      { veld: 'lon', label: 'Lon', type: 'getal', uitleg: 'Lengtegraad (WGS84), bv. 5,12. Voor de kaart.' },
      { veld: 'toelichting', label: 'Toelichting', type: 'tekst', uitleg: 'Vrije toelichting.' },
    ],
  },
  {
    id: 'vraag', blad: 'Vraag', rij: (r) => `${r.scenario ?? ''} · ${r.cluster ?? ''}`,
    uitleg: 'Drinkwatervraag per scenario en cluster in Mm³/j, per 5 jaar. Eén rij per scenario × cluster. De scenario\'s en clusters van de tool komen uit deze tabel; elk scenario moet voor elk cluster een rij hebben.',
    kolommen: [
      { veld: 'scenario', label: 'Scenario', type: 'tekst', uitleg: 'Naam van het vraagscenario, bv. "Midden (CBS)". Gelijke naam = zelfde scenario.' },
      { veld: 'cluster', label: 'Cluster', type: 'tekst', uitleg: 'Naam van het cluster. Gelijke naam = zelfde cluster.' },
      ...VRAAGJAREN.map((j) => ({ veld: String(j), label: String(j), type: 'getal', eenheid: 'Mm³/j', uitleg: `Vraag in ${j}. Verplicht. Tussenliggende jaren worden lineair geïnterpoleerd.` })),
      { veld: 'toelichting', label: 'Toelichting scenario', type: 'tekst', uitleg: 'Uitgangspunten van het scenario (bv. CBS-variant, verbruik per persoon, klimaat). Eén keer per scenario invullen is genoeg; de tool toont de eerste.' },
    ],
  },
];

// ------------------------------------------------------------------ dataset
/** Lege dataset. */
export function legeDataset() {
  return {
    meta: { naam: 'Nieuwe dataset', schema_versie: 2, datum_import: null, bron: '', voorbeelddata: false },
    winningen: [], vraag: [], maatregelen: [],
  };
}

/** Rij van een basistabel met alle kolommen (ontbrekend = null of ''). */
function normaliseerRij(t, x) {
  return Object.fromEntries(t.kolommen.map((k) => {
    const v = x?.[k.veld];
    return [k.veld, k.type === 'tekst' ? (v == null ? '' : String(v)) : (v === '' ? null : v ?? null)];
  }));
}

/**
 * Breng een dataset in de vaste vorm: alle tabellen aanwezig, rijen met alle kolommen,
 * maatregelen met alle velden. Wijzigt `data` zelf en geeft het terug.
 */
export function normaliseer(data) {
  const leegDs = legeDataset();
  for (const k of Object.keys(leegDs)) if (!Array.isArray(leegDs[k]) ? data[k] == null : !Array.isArray(data[k])) data[k] = leegDs[k];
  data.meta = { ...leegDs.meta, ...data.meta, schema_versie: 2 };
  for (const t of TABELLEN) data[t.id] = data[t.id].map((x) => normaliseerRij(t, x));
  data.maatregelen = data.maatregelen.map(normaliseerMaatregel);
  return data;
}

// --------------------------------------------------------------- validatie
/**
 * Valideer een hele dataset.
 * @returns [{ niveau: 'fout'|'waarschuwing', tabel, rij, veld, melding }]
 *          'fout' = blokkerend (rood), 'waarschuwing' = oranje. `rij` = naam van de rij.
 */
export function valideer(data) {
  const uit = [];
  const meld = (niveau, tabel, rij, veld, melding) => uit.push({ niveau, tabel, rij: String(rij ?? ''), veld, melding });
  const fout = (...a) => meld(FOUT, ...a);
  const waarschuw = (...a) => meld(WAARSCHUWING, ...a);
  const lijst = (naam) => (Array.isArray(data?.[naam]) ? data[naam] : []);

  const getal = (tabel, rij, veld, v, optioneel = false) => {
    if (leeg(v)) { if (!optioneel) fout(tabel, rij, veld, 'Waarde ontbreekt.'); return false; }
    if (!isGetal(v)) { fout(tabel, rij, veld, `"${v}" is geen getal.`); return false; }
    return true;
  };

  // ------------------------------------------------------------- vraag
  const T = 'Vraag';
  const vraagClusters = new Set(), gezien = new Set();
  for (const r of lijst('vraag')) {
    const rij = TABELLEN[1].rij(r);
    if (leeg(r.scenario)) fout(T, rij, 'scenario', 'Scenario ontbreekt.');
    if (leeg(r.cluster)) fout(T, rij, 'cluster', 'Cluster ontbreekt.');
    else vraagClusters.add(String(r.cluster).trim());
    const sleutel = `${String(r.scenario ?? '').trim()}|${String(r.cluster ?? '').trim()}`;
    if (!leeg(r.scenario) && !leeg(r.cluster)) {
      if (gezien.has(sleutel)) fout(T, rij, 'cluster', `Dubbele rij voor scenario "${r.scenario}" en cluster "${r.cluster}".`);
      gezien.add(sleutel);
    }
    for (const j of VRAAGJAREN) {
      if (getal(T, rij, String(j), r[String(j)]) && r[String(j)] < 0) fout(T, rij, String(j), 'Vraag is negatief.');
    }
  }
  for (const s of scenarios(data)) {
    for (const c of vraagClusters) {
      if (!gezien.has(`${s.id}|${c}`)) fout(T, `${s.id} · ${c}`, 'cluster', `Scenario "${s.id}" heeft geen rij voor cluster "${c}".`);
    }
  }

  // --------------------------------------------------------- winningen
  const W = 'Winningen', namen = new Set();
  for (const w of lijst('winningen')) {
    const rij = w.naam ?? '';
    if (leeg(w.naam)) fout(W, rij, 'naam', 'Naam ontbreekt.');
    else if (namen.has(`${w.naam}|${w.cluster}`)) fout(W, rij, 'naam', `"${w.naam}" staat twee keer bij cluster "${w.cluster}".`);
    namen.add(`${w.naam}|${w.cluster}`);
    if (leeg(w.cluster)) fout(W, rij, 'cluster', 'Cluster ontbreekt.');
    else if (!vraagClusters.has(String(w.cluster).trim())) fout(W, rij, 'cluster', `Geen vraag voor cluster "${w.cluster}": voeg het toe in de tabel Vraag of kies een bestaand cluster.`);
    const capOk = getal(W, rij, 'capaciteit', w.capaciteit);
    if (capOk && w.capaciteit < 0) fout(W, rij, 'capaciteit', 'Capaciteit is negatief.');
    if (getal(W, rij, 'huidig_aanbod', w.huidig_aanbod, true) && capOk && w.capaciteit === 0 && w.huidig_aanbod > 0) {
      waarschuw(W, rij, 'capaciteit', `Inzetbare capaciteit is 0 terwijl het huidig aanbod ${w.huidig_aanbod} Mm³/j is.`);
    }
    const latOk = getal(W, rij, 'lat', w.lat, true), lonOk = getal(W, rij, 'lon', w.lon, true);
    if ((!latOk || !lonOk) && (leeg(w.lat) || leeg(w.lon))) waarschuw(W, rij, 'lat', 'Geen coördinaten: de winning staat niet op de kaart.');
  }

  // ------------------------------------------------------- maatregelen
  const gezienM = new Set();
  for (const m of lijst('maatregelen')) {
    if (!leeg(m.id) && gezienM.has(m.id)) fout('Maatregelen', m.id, 'id', `Dubbele id "${m.id}".`);
    gezienM.add(m.id);
  }
  const ctx = contextVoorMaatregel(data);
  for (const m of lijst('maatregelen')) uit.push(...valideerMaatregel(m, ctx));
  return uit;
}

/** Naslag voor `valideerMaatregel`: bekende clusters en de winningen per naam. */
export function contextVoorMaatregel(data) {
  const winningen = new Map();
  for (const w of data?.winningen ?? []) if (!leeg(w.naam)) winningen.set(w.naam, [...(winningen.get(w.naam) ?? []), w]);
  return { clusters: new Set(clusters(data)), winningen };
}

/**
 * De winning waar een maatregel naar verwijst. Een naam kan bij meer clusters horen
 * (Fledite ROL): dan die van het cluster van de maatregel, anders de eerste.
 */
export function winningVan(ctx, m) {
  const kandidaten = leeg(m?.winning) ? [] : ctx.winningen.get(m.winning) ?? [];
  return kandidaten.find((w) => w.cluster === m.cluster) ?? kandidaten[0] ?? null;
}

/**
 * Valideer één maatregel-dataobject (ook gebruikt door het formulier).
 * @param ctx { clusters: Set, winningen: Map<naam, winning> }
 */
export function valideerMaatregel(m, ctx) {
  const uit = [];
  const T = 'Maatregelen', rij = m?.id ?? '';
  const fout = (veld, melding) => uit.push({ niveau: FOUT, tabel: T, rij: String(rij), veld, melding });
  const waarschuw = (veld, melding) => uit.push({ niveau: WAARSCHUWING, tabel: T, rij: String(rij), veld, melding });
  const keuze = (veld, v, opties, verplicht) => {
    if (leeg(v)) { if (verplicht) fout(veld, 'Verplicht veld is leeg.'); return; }
    if (!opties.includes(v)) fout(veld, `"${v}" is geen geldige keuze (${opties.join(' / ')}).`);
  };
  const levering = m.soort === 'waterlevering';
  const winning = winningVan(ctx, m);

  // identiteit en levering
  if (leeg(m.id)) fout('id', 'Verplicht veld is leeg.');
  else if (!/^[a-z0-9][a-z0-9-]*$/.test(m.id)) fout('id', 'Alleen kleine letters, cijfers en streepjes.');
  if (leeg(m.naam)) fout('naam', 'Verplicht veld is leeg.');
  else if (m.naam.length > GRENZEN.naamMax) waarschuw('naam', `Naam is langer dan ${GRENZEN.naamMax} tekens en wordt afgekapt in de tool.`);
  keuze('leverancier', m.leverancier, KEUZES.leverancier, true);
  keuze('soort', m.soort, KEUZES.soort, true);
  keuze('spoor', m.spoor, KEUZES.spoor, true);
  keuze('status', m.status, KEUZES.status, false);
  if (typeof m.standaard_aan !== 'boolean') fout('standaard_aan', 'Verplicht veld is leeg (ja/nee).');
  if (m.leverancier && m.leverancier !== 'Vitens' && KEUZES.leverancier.includes(m.leverancier)) {
    waarschuw('leverancier', `Leverancier ${m.leverancier}: wordt in v1 niet meegerekend.`);
  }

  // volume en ingangsjaar
  if (leeg(m.volume)) fout('volume', 'Verplicht veld is leeg.');
  else if (!isGetal(m.volume)) fout('volume', `"${m.volume}" is geen getal.`);
  else if (m.volume < 0) fout('volume', 'Volume is negatief; vul altijd een positief getal in. De soort bepaalt of het er af of bij gaat.');
  else if (m.volume > GRENZEN.volumeWaarschuwing) waarschuw('volume', `Volume ${m.volume} Mm³/j is groter dan ${GRENZEN.volumeWaarschuwing}: mogelijk ingevuld in m³ in plaats van Mm³.`);
  if (leeg(m.ingangsjaar)) fout('ingangsjaar', 'Verplicht veld is leeg.');
  else if (!Number.isInteger(m.ingangsjaar)) fout('ingangsjaar', `"${m.ingangsjaar}" is geen jaartal.`);
  else if (m.ingangsjaar < JAAR_MIN || m.ingangsjaar > JAAR_MAX) fout('ingangsjaar', `Ingangsjaar ${m.ingangsjaar} ligt buiten ${JAAR_MIN}–${JAAR_MAX}.`);

  // plaats: cluster, winning, gemeente, locatie
  if (leeg(m.cluster)) fout('cluster', 'Verplicht veld is leeg.');
  else if (m.cluster !== ALLE_CLUSTERS && !ctx.clusters.has(m.cluster)) fout('cluster', `Onbekend cluster "${m.cluster}": het staat niet in de tabel Vraag.`);
  if (!leeg(m.winning)) {
    if (!winning) fout('winning', `Winning "${m.winning}" staat niet in de tabel Winningen.`);
    else if (!leeg(m.cluster) && m.cluster !== winning.cluster) waarschuw('cluster', `Cluster "${m.cluster}" wijkt af van de winning: ${m.winning} valt onder "${winning.cluster}".`);
  } else if (m.soort === 'afname') {
    waarschuw('winning', 'Afname zonder winning: kies de winning waarvan de capaciteit afneemt.');
  }
  if (m.soort === 'afname' && m.cluster === ALLE_CLUSTERS) fout('cluster', 'Een afname hoort bij één cluster; "alle" is alleen voor waterbesparing.');
  if (leeg(m.gemeente) && levering && !winning) fout('gemeente', 'Verplicht bij waterlevering.');

  const loc = m.locatie;
  const winningOpKaart = winning && isGetal(winning.lat) && isGetal(winning.lon);
  if (loc == null || (leeg(loc.lat) && leeg(loc.lon))) {
    if (levering && !winningOpKaart) fout('locatie', 'Verplicht bij waterlevering (of kies een bestaande winning met coördinaten).');
  } else if (!isGetal(loc.lat) || !isGetal(loc.lon)) fout('locatie', 'Lat en lon moeten beide een getal zijn.');
  else {
    const g = GRENZEN.nederland;
    if (loc.lat < g.latMin || loc.lat > g.latMax || loc.lon < g.lonMin || loc.lon > g.lonMax) {
      fout('locatie', `Coördinaat (${loc.lat}, ${loc.lon}) ligt buiten Nederland. Verwacht WGS84: lat ${g.latMin}–${g.latMax}, lon ${g.lonMin}–${g.lonMax}.`);
    }
  }

  // fysieke kenmerken en voetafdruk: alleen bij waterlevering
  if (leeg(m.bron)) { if (levering) fout('bron', 'Verplicht bij waterlevering.'); }
  else keuze('bron', m.bron, KEUZES.bron, false);
  for (const veld of ['ruimtebeslag', 'stroomvraag']) {
    const v = m[veld];
    if (leeg(v)) { if (levering) fout(veld, 'Verplicht bij waterlevering.'); }
    else if (!isGetal(v)) fout(veld, `"${v}" is geen getal.`);
    else if (v < 0) fout(veld, 'Waarde is negatief.');
  }
  for (const [thema, def] of Object.entries(VOETAFDRUK)) {
    const b = m.voetafdruk?.[thema]?.beoordeling;
    const veld = `voetafdruk ${def.naam}`;
    if (leeg(b)) { if (levering) fout(veld, 'Beoordeling verplicht bij waterlevering.'); }
    else if (!def.keuzes.includes(b)) fout(veld, `"${b}" is geen geldige keuze (${def.keuzes.join(' / ')}).`);
    else if (b === 'onbekend') waarschuw(veld, 'Beoordeling is "onbekend".');
  }

  // overige effecten
  (m.overige_effecten?.lijst ?? []).forEach((e, i) => {
    if (leeg(e.label)) fout(`overig effect ${i + 1}`, 'Label ontbreekt.');
    keuze(`overig effect ${i + 1}`, e.beoordeling, KEUZES.overigEffect, true);
  });

  // bron en eigenaar
  if (leeg(m.meta?.aangeleverd_door)) fout('aangeleverd door', 'Verplicht: wie levert deze maatregel aan?');
  if (leeg(m.meta?.bron)) fout('bron (document)', 'Verplicht: uit welk document of systeem komt dit?');
  if (leeg(m.meta?.datum)) fout('datum aanlevering', 'Verplicht veld is leeg.');
  return uit;
}

// ------------------------------------------------------- maatregel: velden
// Eén definitie per veld van het maatregel-dataobject, in de volgorde van het formulier
// en van het tabblad Maatregelen. `veld` = kolomnaam in het template.
// `levering` = verplicht bij waterlevering; `alleenLevering` = alleen zichtbaar bij waterlevering.
export const MAATREGEL_BLOKKEN = ['Levering', 'Fysieke kenmerken', 'Fysieke voetafdruk', 'Overige effecten', 'Bron en eigenaar'];
const V = (blok, veld, label, type, uitleg, extra = {}) => ({ blok, veld, label, type, uitleg, ...extra });
export const MAATREGEL_VELDEN = [
  V('Levering', 'id', 'Id', 'tekst', 'Uniek en stabiel kenmerk: kleine letters, cijfers en streepjes. Een nieuwe aanlevering met hetzelfde id overschrijft de oude.', { verplicht: true }),
  V('Levering', 'naam', 'Naam', 'tekst', `Label in de tool, maximaal ${GRENZEN.naamMax} tekens.`, { verplicht: true }),
  V('Levering', 'omschrijving', 'Omschrijving', 'langetekst', 'Eén of twee zinnen; verschijnt in de tooltip van de maatregel.'),
  V('Levering', 'leverancier', 'Leverancier', 'keuze', 'Wie levert het water of realiseert de besparing. In versie 1 telt alleen Vitens mee in de opgave; maatregelen van Oasen en Waternet zijn wel zichtbaar.', { verplicht: true, keuzes: KEUZES.leverancier }),
  V('Levering', 'soort', 'Soort', 'keuze', 'Waterlevering: aanbod omhoog. Waterbesparing: vraag omlaag. Afname: aanbod omlaag, omdat een bestaande winning minder kan leveren (bv. sluiting, natuur, vergunning).', { verplicht: true, keuzes: KEUZES.soort }),
  V('Levering', 'spoor', 'Spoor', 'keuze', 'S0 drinkwaterbesparing · S1 instandhouding bestaande capaciteit (ook afnames) · S2 vergroten op bestaande locatie · S3 nieuwe winlocatie.', { verplicht: true, keuzes: KEUZES.spoor }),
  V('Levering', 'standaard_aan', 'Standaard aan', 'janee', 'Beginstand van de schakelaar in de visualisatie.', { verplicht: true }),
  V('Levering', 'status', 'Status', 'keuze', 'Alleen informatief; er wordt niet op gefilterd.', { keuzes: KEUZES.status }),

  V('Fysieke kenmerken', 'volume', 'Volume', 'getal', 'Altijd een positief getal in miljoen m³ per jaar. Waterlevering: de vergunde capaciteit. Waterbesparing: de verlaging van de vraag. Afname: hoeveel capaciteit wegvalt.', { verplicht: true, eenheid: 'Mm³/j' }),
  V('Fysieke kenmerken', 'ingangsjaar', 'Ingangsjaar', 'geheel', `Vanaf dit jaar telt het volledige volume mee (geen ingroei). ${JAAR_MIN}–${JAAR_MAX}.`, { verplicht: true }),
  V('Fysieke kenmerken', 'winning', 'Bestaande winning', 'ref', 'Bij afname, instandhouding (S1) of vergroten (S2): de winning waar het om gaat. Cluster en kaartlocatie komen dan uit de tabel Winningen. Leeg bij een nieuwe locatie of een besparing.', { ref: 'winningen' }),
  V('Fysieke kenmerken', 'cluster', 'Cluster', 'ref', 'Cluster waarop het volume telt. "alle" = verdeeld over alle clusters naar hun aandeel in de vraag (gebruikelijk bij waterbesparing).', { verplicht: true, ref: 'clusters' }),
  V('Fysieke kenmerken', 'gemeente', 'Gemeente', 'tekst', 'Gemeente waar de maatregel ligt. Verplicht bij een waterlevering op een nieuwe locatie.', { levering: true }),
  V('Fysieke kenmerken', 'lat', 'Lat', 'getal', `Breedtegraad in WGS84 (${GRENZEN.nederland.latMin}–${GRENZEN.nederland.latMax}), bv. 52,09. Voor de pin op de kaart. Niet nodig als een bestaande winning is gekozen.`, { levering: true, alleenLevering: true }),
  V('Fysieke kenmerken', 'lon', 'Lon', 'getal', `Lengtegraad in WGS84 (${GRENZEN.nederland.lonMin}–${GRENZEN.nederland.lonMax}), bv. 5,12.`, { levering: true, alleenLevering: true }),
  V('Fysieke kenmerken', 'bron', 'Bron (type water)', 'keuze', 'Type water dat gewonnen wordt.', { levering: true, alleenLevering: true, keuzes: KEUZES.bron }),
  V('Fysieke kenmerken', 'ruimtebeslag', 'Ruimtebeslag', 'getal', 'Benodigde ruimte in hectare.', { levering: true, alleenLevering: true, eenheid: 'ha' }),
  V('Fysieke kenmerken', 'stroomvraag', 'Stroomvraag', 'getal', 'Benodigd elektrisch vermogen in megawatt.', { levering: true, alleenLevering: true, eenheid: 'MW' }),

  ...Object.entries(VOETAFDRUK).flatMap(([t, def]) => [
    V('Fysieke voetafdruk', `${t}_beoordeling`, `${def.naam} – beoordeling`, 'keuze', 'Beoordeling door de informatiegevende partij; de tool rekent dit niet na.', { levering: true, alleenLevering: true, keuzes: def.keuzes, thema: t }),
    V('Fysieke voetafdruk', `${t}_toelichting`, `${def.naam} – toelichting`, 'tekst', 'Korte onderbouwing van de beoordeling.', { alleenLevering: true, thema: t }),
    V('Fysieke voetafdruk', `${t}_bron`, `${def.naam} – bron`, 'tekst', 'Onderzoek of document waarop de beoordeling berust.', { alleenLevering: true, thema: t }),
  ]),

  V('Overige effecten', 'politiek', 'Politieke overwegingen', 'langetekst', 'Vrije tekst.'),
  V('Overige effecten', 'overige_effecten', 'Overige effecten', 'effecten', 'Eén effect per regel. In het template: label | beoordeling | tekst, met beoordeling kans, aandacht of knelpunt. Meerdere effecten: nieuwe regel in dezelfde cel (Alt+Enter).'),

  V('Bron en eigenaar', 'aangeleverd_door', 'Aangeleverd door', 'tekst', 'Persoon en organisatie die deze maatregel aanlevert.', { verplicht: true }),
  V('Bron en eigenaar', 'datum', 'Datum aanlevering', 'datum', 'Datum van aanlevering (jjjj-mm-dd of dd-mm-jjjj).', { verplicht: true }),
  V('Bron en eigenaar', 'bron_document', 'Bron (document)', 'tekst', 'Document of systeem waaruit de gegevens komen. Geen links naar interne omgevingen.', { verplicht: true }),
];

/** Bij welk veld (kolomnaam) hoort een validatiemelding? */
export function veldVanMelding(veld) {
  if (veld === 'locatie') return 'lat';
  if (veld === 'aangeleverd door') return 'aangeleverd_door';
  if (veld === 'bron (document)') return 'bron_document';
  if (veld === 'datum aanlevering') return 'datum';
  if (veld.startsWith('overig effect')) return 'overige_effecten';
  if (veld.startsWith('voetafdruk ')) {
    const t = Object.keys(VOETAFDRUK).find((k) => VOETAFDRUK[k].naam === veld.slice('voetafdruk '.length));
    return t ? `${t}_beoordeling` : veld;
  }
  return veld;
}

const nl = (v, decimalen = 1) => new Intl.NumberFormat('nl-NL', { minimumFractionDigits: decimalen, maximumFractionDigits: 3 }).format(v);

/**
 * Hoe een maatregel in de visualisatie verschijnt: de rij in de maatregelenlijst en de
 * tooltip. Puur (geen DOM); gebruikt door de preview in het formulier en door index.html.
 * @returns { naam, spoor, waarde, teltMee, regels: [[label, waarde]], noten: [tekst], effecten }
 */
export function maatregelWeergave(m) {
  const getal = (v) => typeof v === 'number' && Number.isFinite(v);
  const s = SOORTEN[m.soort];
  const teltMee = m.leverancier === 'Vitens';
  const naam = String(m.naam ?? '');
  const regels = [
    ['Spoor', m.spoor ? SPOREN[m.spoor] ?? m.spoor : '–'],
    ['Werkt op', s ? s.uitleg : '–'],
    ['Leverancier', m.leverancier ?? '–'],
    ['Volume', getal(m.volume) ? `${nl(m.volume)} Mm³/j` + (s ? ` (${s.volume})` : '') : '–'],
    ['Vanaf', m.ingangsjaar ?? '–'],
    ['Cluster', m.cluster === ALLE_CLUSTERS ? 'alle clusters (naar vraagaandeel)' : m.cluster ?? '–'],
  ];
  if (m.winning) regels.push(['Winning', m.winning]);
  if (m.gemeente) regels.push(['Gemeente', m.gemeente]);
  if (m.status) regels.push(['Status', m.status]);
  if (m.soort === 'waterlevering') {
    if (m.bron) regels.push(['Bron', m.bron]);
    if (getal(m.ruimtebeslag)) regels.push(['Ruimtebeslag', `${nl(m.ruimtebeslag, 0)} ha`]);
    if (getal(m.stroomvraag)) regels.push(['Stroomvraag', `${nl(m.stroomvraag, 0)} MW`]);
    for (const [t, def] of Object.entries(VOETAFDRUK)) {
      const b = m.voetafdruk?.[t]?.beoordeling;
      if (b) regels.push([def.naam, b]);
    }
  }
  const noten = [];
  if (!teltMee) noten.push('Niet meegerekend (v1): alleen maatregelen van Vitens tellen mee in de opgave.');
  if (m.meta?.aangeleverd_door) noten.push(`Aangeleverd door ${m.meta.aangeleverd_door}` + (m.meta.datum ? `, ${m.meta.datum}` : '') + (m.meta.bron ? ` · ${m.meta.bron}` : ''));
  return {
    naam: naam.length > GRENZEN.naamMax ? naam.slice(0, GRENZEN.naamMax - 1) + '…' : naam,
    omschrijving: m.omschrijving ?? '', spoor: m.spoor ?? '', teltMee,
    waarde: getal(m.volume) ? `${s?.teken ?? ''}${nl(m.volume)}` : '–',
    regels, noten,
    effecten: (m.overige_effecten?.lijst ?? []).filter((e) => e.label),
  };
}

/** Nieuwe, lege maatregel voor het formulier. */
export function nieuweMaatregel(datum) {
  return normaliseerMaatregel({ leverancier: 'Vitens', standaard_aan: true, meta: { datum } });
}

/** "Nieuwe winning B" -> "nieuwe-winning-b" (voorstel voor het id). */
export const maakId = (tekst) => String(tekst ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Maatregel met alle velden in vaste volgorde (ontbrekend = null / leeg). */
export function normaliseerMaatregel(m) {
  const loc = m.locatie;
  const heeftLoc = loc && !(leeg(loc.lat) && leeg(loc.lon));
  const vo = m.voetafdruk;
  const heeftVo = vo && Object.keys(VOETAFDRUK).some((t) => vo[t] && ['beoordeling', 'toelichting', 'bron'].some((k) => !leeg(vo[t][k])));
  return {
    id: m.id ?? '', naam: m.naam ?? '', omschrijving: m.omschrijving ?? '',
    leverancier: m.leverancier ?? 'Vitens', soort: m.soort ?? null, spoor: m.spoor ?? null,
    standaard_aan: !!m.standaard_aan, status: leeg(m.status) ? null : m.status,
    winning: leeg(m.winning) ? null : m.winning,
    cluster: leeg(m.cluster) ? null : m.cluster,
    gemeente: leeg(m.gemeente) ? null : m.gemeente,
    locatie: heeftLoc ? { lat: loc.lat ?? null, lon: loc.lon ?? null } : null,
    bron: leeg(m.bron) ? null : m.bron,
    volume: m.volume ?? null, ruimtebeslag: m.ruimtebeslag ?? null, stroomvraag: m.stroomvraag ?? null,
    ingangsjaar: m.ingangsjaar ?? null,
    voetafdruk: heeftVo ? Object.fromEntries(Object.keys(VOETAFDRUK).map((t) => [t, {
      beoordeling: leeg(vo[t]?.beoordeling) ? null : vo[t].beoordeling,
      toelichting: vo[t]?.toelichting ?? '', bron: vo[t]?.bron ?? '',
    }])) : null,
    overige_effecten: {
      politiek: m.overige_effecten?.politiek ?? '',
      lijst: (m.overige_effecten?.lijst ?? []).map((e) => ({ label: e.label ?? '', beoordeling: e.beoordeling ?? null, tekst: e.tekst ?? '' })),
    },
    meta: { aangeleverd_door: m.meta?.aangeleverd_door ?? '', datum: m.meta?.datum ?? '', bron: m.meta?.bron ?? '' },
  };
}

/** Telt fouten en waarschuwingen. */
export const telling = (meldingen) => ({
  fouten: meldingen.filter((m) => m.niveau === FOUT).length,
  waarschuwingen: meldingen.filter((m) => m.niveau === WAARSCHUWING).length,
});
