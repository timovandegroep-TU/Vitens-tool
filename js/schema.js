// Datamodel: keuzelijsten en validatie. Puur (geen DOM), dus ook in Node te testen.
// De structuur zelf staat beschreven in docs/datamodel.schema.json.

import { ALLE_CLUSTERS, JAAR_MIN, JAAR_MAX, PEILJAREN, VRAAGJAREN } from './model.js';

export const KEUZES = {
  leverancier: ['Vitens', 'Oasen', 'Waternet'],
  soort: ['waterlevering', 'waterbesparing'],
  spoor: ['S0', 'S1', 'S2', 'S3'],
  status: ['idee', 'verkenning', 'besloten', 'in uitvoering'],
  bron: ['grondwater', 'oevergrondwater', 'oppervlaktewater', 'overig'],
  groep: ['Assets', 'Grondwaterkwantiteit', 'Grondwaterkwaliteit', 'Oppervlaktewaterkwaliteit'],
  overigEffect: ['kans', 'aandacht', 'knelpunt'],
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

/**
 * Valideer een hele dataset.
 * @returns [{ niveau: 'fout'|'waarschuwing', tabel, rij, veld, melding }]
 *          'fout' = blokkerend (rood), 'waarschuwing' = oranje. `rij` = id of naam van de rij.
 */
export function valideer(data) {
  const uit = [];
  const meld = (niveau, tabel, rij, veld, melding) => uit.push({ niveau, tabel, rij: String(rij ?? ''), veld, melding });
  const fout = (...a) => meld(FOUT, ...a);
  const waarschuw = (...a) => meld(WAARSCHUWING, ...a);

  const lijst = (naam) => (Array.isArray(data?.[naam]) ? data[naam] : []);
  const ids = (naam, sleutel = 'id') => new Set(lijst(naam).map((x) => x[sleutel]));
  const clusters = ids('clusters'), criteria = ids('criteria'), winningen = ids('winningen');
  const narratieven = new Set(lijst('narratieven').map((n) => String(n.id)));
  const gemeenten = ids('gemeenten', 'gemeente');

  // getal-controle: leeg mag alleen als `optioneel`
  const getal = (tabel, rij, veld, v, optioneel = false) => {
    if (leeg(v)) { if (!optioneel) fout(tabel, rij, veld, 'Waarde ontbreekt.'); return false; }
    if (!isGetal(v)) { fout(tabel, rij, veld, `"${v}" is geen getal.`); return false; }
    return true;
  };
  const dubbel = (tabel, items, sleutel = 'id') => {
    const gezien = new Set();
    for (const x of items) {
      if (leeg(x[sleutel])) fout(tabel, '', sleutel, 'Id ontbreekt.');
      else if (gezien.has(x[sleutel])) fout(tabel, x[sleutel], sleutel, `Dubbele ${sleutel} "${x[sleutel]}".`);
      gezien.add(x[sleutel]);
    }
  };

  // ------------------------------------------------------------ basisdata
  dubbel('Narratieven', lijst('narratieven'));
  dubbel('Clusters', lijst('clusters'));
  dubbel('Criteria', lijst('criteria'));
  dubbel('Winningen', lijst('winningen'));
  dubbel('Gemeenten', lijst('gemeenten'), 'gemeente');

  for (const n of lijst('narratieven')) {
    if (!leeg(n.id) && !(Number.isInteger(n.id) && n.id >= 1 && n.id <= 4)) fout('Narratieven', n.id, 'id', `Id "${n.id}" moet een geheel getal van 1 t/m 4 zijn.`);
  }
  for (const c of lijst('criteria')) {
    if (!KEUZES.groep.includes(c.groep)) fout('Criteria', c.id, 'groep', `Onbekende groep "${c.groep}".`);
  }
  for (const g of lijst('gemeenten')) {
    if (!clusters.has(g.cluster)) fout('Gemeenten', g.gemeente, 'cluster', `Onbekend cluster "${g.cluster}".`);
    getal('Gemeenten', g.gemeente, 'lat', g.lat, true);
    getal('Gemeenten', g.gemeente, 'lon', g.lon, true);
  }
  for (const w of lijst('winningen')) {
    if (!clusters.has(w.cluster)) fout('Winningen', w.id, 'cluster', `Onbekend cluster "${w.cluster}".`);
    const capOk = getal('Winningen', w.id, 'capaciteit', w.capaciteit);
    const vergOk = getal('Winningen', w.id, 'vergunning', w.vergunning, true);
    getal('Winningen', w.id, 'niet_inzetbaar', w.niet_inzetbaar, true);
    if (capOk && w.capaciteit < 0) fout('Winningen', w.id, 'capaciteit', 'Capaciteit is negatief.');
    if (capOk && vergOk && w.capaciteit === 0 && w.vergunning > 0) {
      waarschuw('Winningen', w.id, 'capaciteit', `Capaciteit is 0 terwijl de vergunning ${w.vergunning} Mm³/j is.`);
    }
    const latOk = getal('Winningen', w.id, 'lat', w.lat, true), lonOk = getal('Winningen', w.id, 'lon', w.lon, true);
    if (!latOk || !lonOk) { if (leeg(w.lat) || leeg(w.lon)) waarschuw('Winningen', w.id, 'lat/lon', 'Geen coördinaten: winning staat niet op de kaart.'); }
  }

  // reductiefactoren
  const rf = data?.reductiefactoren ?? {};
  for (const n of Object.keys(rf)) {
    const tabel = `Reductiefactoren N${n}`;
    if (!narratieven.has(n)) { fout(tabel, '', 'narratief', `Onbekend narratief "${n}".`); continue; }
    for (const [wid, perCrit] of Object.entries(rf[n] ?? {})) {
      if (!winningen.has(wid)) { fout(tabel, wid, 'winning', `Onbekende winning "${wid}".`); continue; }
      for (const [cid, rij] of Object.entries(perCrit ?? {})) {
        if (!criteria.has(cid)) { fout(tabel, wid, cid, `Onbekend criterium "${cid}".`); continue; }
        PEILJAREN.forEach((jaar, i) => {
          const v = rij?.[i];
          if (leeg(v)) return;
          if (!isGetal(v)) fout(tabel, wid, `${cid} ${jaar}`, `"${v}" is geen getal.`);
          else if (v < 0 || v > 1) fout(tabel, wid, `${cid} ${jaar}`, `Factor ${v} ligt buiten 0–1.`);
        });
      }
    }
  }
  // lege factoren (worden 1): één waarschuwing per winning × criterium
  for (const n of narratieven) {
    for (const w of lijst('winningen')) {
      for (const c of lijst('criteria')) {
        const rij = rf[n]?.[w.id]?.[c.id];
        const legeJaren = PEILJAREN.filter((_, i) => leeg(rij?.[i]));
        if (legeJaren.length) {
          waarschuw(`Reductiefactoren N${n}`, w.id, c.id, `Lege factor voor ${legeJaren.join(', ')}: wordt 1.`);
        }
      }
    }
  }

  // vraag: elk narratief × cluster × jaar moet er zijn
  const vraag = data?.vraag ?? {};
  for (const n of Object.keys(vraag)) {
    if (!narratieven.has(n)) fout('Vraag', `N${n}`, 'narratief', `Onbekend narratief "${n}".`);
    for (const cid of Object.keys(vraag[n] ?? {})) {
      if (!clusters.has(cid)) fout('Vraag', `N${n} ${cid}`, 'cluster', `Onbekend cluster "${cid}".`);
    }
  }
  for (const n of narratieven) {
    for (const cid of clusters) {
      for (const jaar of VRAAGJAREN) {
        const v = vraag[n]?.[cid]?.[jaar];
        if (leeg(v)) fout('Vraag', `N${n} ${cid}`, String(jaar), 'Vraag ontbreekt.');
        else if (!isGetal(v)) fout('Vraag', `N${n} ${cid}`, String(jaar), `"${v}" is geen getal.`);
      }
    }
  }

  // ---------------------------------------------------------- maatregelen
  dubbel('Maatregelen', lijst('maatregelen'));
  const ctx = contextVoorMaatregel(data);
  for (const m of lijst('maatregelen')) uit.push(...valideerMaatregel(m, ctx));

  return uit;
}

/** Naslag voor `valideerMaatregel`: bekende clusters, gemeenten en narratieven van de dataset. */
export function contextVoorMaatregel(data) {
  const lijst = (naam) => (Array.isArray(data?.[naam]) ? data[naam] : []);
  return {
    clusters: new Set(lijst('clusters').map((c) => c.id)),
    gemeenten: new Set(lijst('gemeenten').map((g) => g.gemeente)),
    narratieven: new Set(lijst('narratieven').map((n) => String(n.id))),
    clusterVanGemeente: new Map(lijst('gemeenten').map((g) => [g.gemeente, g.cluster])),
  };
}

/**
 * Valideer één maatregel-dataobject (ook gebruikt door het formulier).
 * @param ctx { clusters: Set, gemeenten: Set, narratieven: Set<string>, clusterVanGemeente?: Map }
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
  // Bij een bewust onvolledige aanlevering (meta.onvolledig) zijn ontbrekende
  // leveringsvelden een waarschuwing in plaats van een blokkerende fout.
  const ontbreekt = (veld, melding) => (m.meta?.onvolledig ? waarschuw(veld, melding + ' (onvolledig aangeleverd)') : fout(veld, melding));

  // identiteit en levering
  if (leeg(m.id)) fout('id', 'Verplicht veld is leeg.');
  else if (!/^[a-z0-9][a-z0-9-]*$/.test(m.id)) fout('id', 'Alleen kleine letters, cijfers en streepjes.');
  if (leeg(m.naam)) fout('naam', 'Verplicht veld is leeg.');
  else if (m.naam.length > GRENZEN.naamMax) waarschuw('naam', `Naam is langer dan ${GRENZEN.naamMax} tekens en wordt afgekapt in de tool.`);
  keuze('leverancier', m.leverancier, KEUZES.leverancier, true);
  keuze('soort', m.soort, KEUZES.soort, true);
  keuze('spoor', m.spoor, KEUZES.spoor, true);
  keuze('status', m.status, KEUZES.status, false);
  if (!Array.isArray(m.narratieven) || m.narratieven.length === 0) fout('narratieven', 'Kies minstens één narratief.');
  else for (const n of m.narratieven) if (!ctx.narratieven.has(String(n))) fout('narratieven', `Onbekend narratief "${n}".`);
  if (typeof m.standaard_aan !== 'boolean') fout('standaard_aan', 'Verplicht veld is leeg (ja/nee).');
  if (m.leverancier && m.leverancier !== 'Vitens' && KEUZES.leverancier.includes(m.leverancier)) {
    waarschuw('leverancier', `Leverancier ${m.leverancier}: wordt in v1 niet meegerekend.`);
  }

  // fysieke kenmerken
  if (leeg(m.volume)) fout('volume', 'Verplicht veld is leeg.');
  else if (!isGetal(m.volume)) fout('volume', `"${m.volume}" is geen getal.`);
  else if (m.volume < 0) fout('volume', 'Volume is negatief; vul altijd een positief getal in.');
  else if (m.volume > GRENZEN.volumeWaarschuwing) waarschuw('volume', `Volume ${m.volume} Mm³/j is groter dan ${GRENZEN.volumeWaarschuwing}: mogelijk ingevuld in m³ in plaats van Mm³.`);

  if (leeg(m.ingangsjaar)) fout('ingangsjaar', 'Verplicht veld is leeg.');
  else if (!Number.isInteger(m.ingangsjaar)) fout('ingangsjaar', `"${m.ingangsjaar}" is geen jaartal.`);
  else if (m.ingangsjaar < JAAR_MIN || m.ingangsjaar > JAAR_MAX) fout('ingangsjaar', `Ingangsjaar ${m.ingangsjaar} ligt buiten ${JAAR_MIN}–${JAAR_MAX}.`);

  if (leeg(m.cluster)) fout('cluster', 'Verplicht veld is leeg.');
  else if (m.cluster !== ALLE_CLUSTERS && !ctx.clusters.has(m.cluster)) fout('cluster', `Onbekend cluster "${m.cluster}".`);

  if (leeg(m.gemeente)) { if (levering) ontbreekt('gemeente', 'Verplicht bij waterlevering.'); }
  else if (!ctx.gemeenten.has(m.gemeente)) fout('gemeente', `Gemeente "${m.gemeente}" staat niet in de koppeltabel.`);
  else {
    const verwacht = ctx.clusterVanGemeente?.get(m.gemeente);
    if (verwacht && !leeg(m.cluster) && m.cluster !== ALLE_CLUSTERS && m.cluster !== verwacht) {
      waarschuw('cluster', `Cluster "${m.cluster}" wijkt af van de koppeltabel: ${m.gemeente} valt onder "${verwacht}".`);
    }
  }

  const loc = m.locatie;
  if (loc == null || (leeg(loc.lat) && leeg(loc.lon))) { if (levering) ontbreekt('locatie', 'Verplicht bij waterlevering.'); }
  else if (!isGetal(loc.lat) || !isGetal(loc.lon)) fout('locatie', 'Lat en lon moeten beide een getal zijn.');
  else {
    const g = GRENZEN.nederland;
    if (loc.lat < g.latMin || loc.lat > g.latMax || loc.lon < g.lonMin || loc.lon > g.lonMax) {
      fout('locatie', `Coördinaat (${loc.lat}, ${loc.lon}) ligt buiten Nederland. Verwacht WGS84: lat ${g.latMin}–${g.latMax}, lon ${g.lonMin}–${g.lonMax}.`);
    }
  }

  if (leeg(m.bron)) { if (levering) ontbreekt('bron', 'Verplicht bij waterlevering.'); }
  else keuze('bron', m.bron, KEUZES.bron, false);
  for (const veld of ['ruimtebeslag', 'stroomvraag']) {
    const v = m[veld];
    if (leeg(v)) { if (levering) ontbreekt(veld, 'Verplicht bij waterlevering.'); }
    else if (!isGetal(v)) fout(veld, `"${v}" is geen getal.`);
    else if (v < 0) fout(veld, 'Waarde is negatief.');
  }

  // fysieke voetafdruk
  for (const [thema, def] of Object.entries(VOETAFDRUK)) {
    const b = m.voetafdruk?.[thema]?.beoordeling;
    const veld = `voetafdruk ${def.naam}`;
    if (leeg(b)) { if (levering) ontbreekt(veld, 'Beoordeling verplicht bij waterlevering.'); }
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
// en van het tabblad Maatregelen. `veld` = kolomnaam in het template. `levering` = alleen
// van toepassing (en dan verplicht) bij waterlevering.
export const MAATREGEL_BLOKKEN = ['Levering', 'Fysieke kenmerken', 'Fysieke voetafdruk', 'Overige effecten', 'Bron en eigenaar'];
const V = (blok, veld, label, type, uitleg, extra = {}) => ({ blok, veld, label, type, uitleg, ...extra });
export const MAATREGEL_VELDEN = [
  V('Levering', 'id', 'Id', 'tekst', 'Uniek en stabiel kenmerk: kleine letters, cijfers en streepjes. Een nieuwe aanlevering met hetzelfde id overschrijft de oude.', { verplicht: true }),
  V('Levering', 'naam', 'Naam', 'tekst', `Label in de tool, maximaal ${GRENZEN.naamMax} tekens.`, { verplicht: true }),
  V('Levering', 'omschrijving', 'Omschrijving', 'langetekst', 'Eén of twee zinnen; verschijnt in de tooltip van de maatregel.'),
  V('Levering', 'leverancier', 'Leverancier', 'keuze', 'Wie levert het water of realiseert de besparing. In versie 1 telt alleen Vitens mee in de opgave; maatregelen van Oasen en Waternet zijn wel zichtbaar.', { verplicht: true, keuzes: KEUZES.leverancier }),
  V('Levering', 'soort', 'Soort', 'keuze', 'Waterlevering verhoogt het aanbod; waterbesparing verlaagt de vraag.', { verplicht: true, keuzes: KEUZES.soort }),
  V('Levering', 'spoor', 'Spoor', 'keuze', 'S0 drinkwaterbesparing · S1 instandhouding bestaande capaciteit · S2 vergroten op bestaande locatie · S3 nieuwe winlocatie.', { verplicht: true, keuzes: KEUZES.spoor }),
  V('Levering', 'narratieven', 'Narratieven', 'narratieven', 'In welke narratieven de maatregel geldt. In het template: nummers gescheiden door een komma, bv. 1,2,3,4.', { verplicht: true }),
  V('Levering', 'standaard_aan', 'Standaard aan', 'janee', 'Beginstand van de schakelaar in de visualisatie.', { verplicht: true }),
  V('Levering', 'status', 'Status', 'keuze', 'Alleen informatief; er wordt niet op gefilterd.', { keuzes: KEUZES.status }),

  V('Fysieke kenmerken', 'volume', 'Volume', 'getal', 'Altijd een positief getal in miljoen m³ per jaar. Waterlevering: de vergunde capaciteit. Waterbesparing: de verlaging van de vraag.', { verplicht: true, eenheid: 'Mm³/j' }),
  V('Fysieke kenmerken', 'ingangsjaar', 'Ingangsjaar', 'geheel', `Vanaf dit jaar telt het volledige volume mee (geen ingroei). ${JAAR_MIN}–${JAAR_MAX}.`, { verplicht: true }),
  V('Fysieke kenmerken', 'gemeente', 'Gemeente', 'ref', 'Gemeente waar de maatregel ligt; moet in de koppeltabel Gemeenten staan en bepaalt het cluster.', { ref: 'gemeenten', levering: true }),
  V('Fysieke kenmerken', 'cluster', 'Cluster', 'ref', 'Cluster waarop het volume telt. "alle" = verdeeld over alle clusters naar hun aandeel in de vraag (gebruikelijk bij waterbesparing).', { verplicht: true, ref: 'clusters' }),
  V('Fysieke kenmerken', 'lat', 'Lat', 'getal', `Breedtegraad in WGS84 (${GRENZEN.nederland.latMin}–${GRENZEN.nederland.latMax}), bv. 52,09. Voor de pin op de kaart.`, { levering: true, alleenLevering: true }),
  V('Fysieke kenmerken', 'lon', 'Lon', 'getal', `Lengtegraad in WGS84 (${GRENZEN.nederland.lonMin}–${GRENZEN.nederland.lonMax}), bv. 5,12.`, { levering: true, alleenLevering: true }),
  V('Fysieke kenmerken', 'bron', 'Bron (type water)', 'keuze', 'Type water dat gewonnen wordt.', { levering: true, alleenLevering: true, keuzes: KEUZES.bron }),
  V('Fysieke kenmerken', 'ruimtebeslag', 'Ruimtebeslag', 'getal', 'Benodigde ruimte in hectare.', { levering: true, alleenLevering: true, eenheid: 'ha' }),
  V('Fysieke kenmerken', 'stroomvraag', 'Stroomvraag', 'getal', 'Benodigd elektrisch vermogen in megawatt.', { levering: true, alleenLevering: true, eenheid: 'MW' }),

  ...Object.entries(VOETAFDRUK).flatMap(([t, def]) => [
    V('Fysieke voetafdruk', `${t}_beoordeling`, `${def.naam} – beoordeling`, 'keuze', `Beoordeling door de informatiegevende partij; de tool rekent dit niet na.`, { levering: true, alleenLevering: true, keuzes: def.keuzes, thema: t }),
    V('Fysieke voetafdruk', `${t}_toelichting`, `${def.naam} – toelichting`, 'tekst', 'Korte onderbouwing van de beoordeling.', { alleenLevering: true, thema: t }),
    V('Fysieke voetafdruk', `${t}_bron`, `${def.naam} – bron`, 'tekst', 'Onderzoek of document waarop de beoordeling berust.', { alleenLevering: true, thema: t }),
  ]),

  V('Overige effecten', 'politiek', 'Politieke overwegingen', 'langetekst', 'Vrije tekst.'),
  V('Overige effecten', 'overige_effecten', 'Overige effecten', 'effecten', 'Eén effect per regel. In het template: label | beoordeling | tekst, met beoordeling kans, aandacht of knelpunt. Meerdere effecten: nieuwe regel in dezelfde cel (Alt+Enter).'),

  V('Bron en eigenaar', 'aangeleverd_door', 'Aangeleverd door', 'tekst', 'Persoon en organisatie die deze maatregel aanlevert.', { verplicht: true }),
  V('Bron en eigenaar', 'datum', 'Datum aanlevering', 'datum', 'Datum van aanlevering (jjjj-mm-dd of dd-mm-jjjj).', { verplicht: true }),
  V('Bron en eigenaar', 'bron_document', 'Bron (document)', 'tekst', 'Document of systeem waaruit de gegevens komen. Geen links naar interne omgevingen.', { verplicht: true }),
  V('Bron en eigenaar', 'onvolledig', 'Onvolledig aangeleverd', 'janee', 'Ja = bewust onvolledig (bv. omgezet uit het werkdocument): ontbrekende leveringsvelden geven dan een waarschuwing in plaats van een blokkerende fout.'),
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
 * @returns { naam, spoor, waarde, teltMee, rij: [[label, waarde]], noten: [tekst] }
 */
export function maatregelWeergave(m) {
  const getal = (v) => typeof v === 'number' && Number.isFinite(v);
  const levering = m.soort === 'waterlevering';
  const teltMee = m.leverancier === 'Vitens';
  const naam = String(m.naam ?? '');
  const regels = [
    ['Spoor', m.spoor ? SPOREN[m.spoor] ?? m.spoor : '–'],
    ['Werkt op', m.soort === 'waterbesparing' ? 'vraag (besparing)' : levering ? 'aanbod (levering)' : '–'],
    ['Leverancier', m.leverancier ?? '–'],
    ['Volume', getal(m.volume) ? `${nl(m.volume)} Mm³/j` : '–'],
    ['Vanaf', m.ingangsjaar ?? '–'],
    ['Cluster', m.cluster === ALLE_CLUSTERS ? 'alle clusters (naar vraagaandeel)' : m.cluster ?? '–'],
    ['Narratieven', (m.narratieven ?? []).join(', ') || '–'],
  ];
  if (m.gemeente) regels.push(['Gemeente', m.gemeente]);
  if (m.status) regels.push(['Status', m.status]);
  if (levering) {
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
  if (levering) noten.push('Volume = vergunde capaciteit.');
  if (m.meta?.aangeleverd_door) noten.push(`Aangeleverd door ${m.meta.aangeleverd_door}` + (m.meta.datum ? `, ${m.meta.datum}` : '') + (m.meta.bron ? ` · ${m.meta.bron}` : ''));
  return {
    naam: naam.length > GRENZEN.naamMax ? naam.slice(0, GRENZEN.naamMax - 1) + '…' : naam,
    omschrijving: m.omschrijving ?? '', spoor: m.spoor ?? '', teltMee,
    waarde: getal(m.volume) ? `${m.soort === 'waterbesparing' ? '−' : '+'}${nl(m.volume)}` : '–',
    regels, noten,
    effecten: (m.overige_effecten?.lijst ?? []).filter((e) => e.label),
  };
}

/** Nieuwe, lege maatregel voor het formulier. */
export function nieuweMaatregel(datum) {
  return normaliseerMaatregel({ leverancier: 'Vitens', narratieven: [1, 2, 3, 4], standaard_aan: true, meta: { datum } });
}

/** "Nieuwe winning B" -> "nieuwe-winning-b" (voorstel voor het id). */
export const maakId = (tekst) => String(tekst ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// ------------------------------------------------------------------ tabellen
// Eén definitie per basistabel: naam van het tabblad (Excel + invoerpagina) en per
// kolom het type en de uitlegtekst. Types: tekst | getal | geheel | janee | keuze | ref.
// `ref` verwijst naar een andere tabel (keuzelijst wordt daaruit opgebouwd).

export const TABELLEN = [
  {
    id: 'narratieven', blad: 'Narratieven', sleutel: 'id', vast: true,
    uitleg: 'De vier narratieven. Elk narratief heeft eigen reductiefactoren en een eigen vraagontwikkeling.',
    kolommen: [
      { veld: 'id', label: 'Id', type: 'geheel', uitleg: 'Nummer van het narratief (1–4). Niet wijzigen.' },
      { veld: 'naam', label: 'Naam', type: 'tekst', uitleg: 'Ruim in conflict / Stoom in conflict / Ruim in harmonie / Stoom in harmonie.' },
      { veld: 'deltascenario', label: 'Vraag-deltascenario', type: 'tekst', uitleg: 'Deltascenario waarop de vraagprognose is gebaseerd (werkdocument: "Vraag - Deltascenario").' },
      { veld: 'lpppd_doel', label: 'lpppd-doel', type: 'getal', uitleg: 'Doel voor het huishoudelijk verbruik in liter per persoon per dag in 2040 (werkdocument: "lpppd target").' },
      { veld: 'toelichting', label: 'Toelichting', type: 'tekst', uitleg: 'Korte toelichting; verschijnt bij de narratiefkeuze in de visualisatie.' },
    ],
  },
  {
    id: 'clusters', blad: 'Clusters', sleutel: 'id',
    uitleg: 'Vitens-clusters. Aanbod, vraag en opgave worden per cluster berekend.',
    kolommen: [
      { veld: 'id', label: 'Id', type: 'tekst', uitleg: 'Vast id (kleine letters, cijfers, streepjes). Andere tabellen verwijzen hiernaar.' },
      { veld: 'naam', label: 'Weergavenaam', type: 'tekst', uitleg: 'Naam zoals getoond in de tool.' },
    ],
  },
  {
    id: 'gemeenten', blad: 'Gemeenten', sleutel: 'gemeente',
    uitleg: 'Koppeltabel gemeente → cluster. Hiermee bepaalt de tool het cluster van een maatregel. Eén cluster per gemeente.',
    kolommen: [
      { veld: 'gemeente', label: 'Gemeente', type: 'tekst', uitleg: 'Naam van de gemeente.' },
      { veld: 'cluster', label: 'Cluster', type: 'ref', ref: 'clusters', uitleg: 'Cluster waar de gemeente onder valt.' },
      { veld: 'lat', label: 'Lat', type: 'getal', uitleg: 'Breedtegraad van het middelpunt (WGS84), alleen voor de kaart.' },
      { veld: 'lon', label: 'Lon', type: 'getal', uitleg: 'Lengtegraad van het middelpunt (WGS84), alleen voor de kaart.' },
      { veld: 'te_controleren', label: 'Te controleren', type: 'janee', uitleg: 'Ja zolang cluster of coördinaten nog niet door een deskundige zijn bevestigd.' },
    ],
  },
  {
    id: 'criteria', blad: 'Criteria', sleutel: 'id',
    uitleg: 'Criteria waarop de capaciteit van een winning kan afnemen. Het slechtste criterium bepaalt de reductiefactor (minimum, niet vermenigvuldigd).',
    kolommen: [
      { veld: 'id', label: 'Id', type: 'tekst', uitleg: 'Vast id. De volgorde van deze tabel is de volgorde van de kolomgroepen in de reductiefactoren.' },
      { veld: 'naam', label: 'Naam', type: 'tekst', uitleg: 'Korte naam, getoond als bindend criterium.' },
      { veld: 'groep', label: 'Groep', type: 'keuze', keuzes: KEUZES.groep, uitleg: 'Assets / Grondwaterkwantiteit / Grondwaterkwaliteit / Oppervlaktewaterkwaliteit.' },
      { veld: 'toelichting', label: 'Toelichting', type: 'tekst', uitleg: 'Koptekst uit het werkdocument.' },
    ],
  },
  {
    id: 'winningen', blad: 'Winningen', sleutel: 'id',
    uitleg: 'Bestaande winningen. Het model rekent met de inzetbare productiecapaciteit; "huidig" (2026) = capaciteit.',
    kolommen: [
      { veld: 'id', label: 'Id', type: 'tekst', uitleg: 'Uniek id. Let op: "Fledite ROL" komt twee keer voor met een verschillend cluster.' },
      { veld: 'locatie', label: 'Locatie', type: 'tekst', uitleg: 'Naam van de winning (werkdocument kolom A).' },
      { veld: 'gemeente', label: 'Gemeente', type: 'ref', ref: 'gemeenten', uitleg: 'Gemeente waarin de winning ligt. Staat niet in het werkdocument; initieel benaderd.' },
      { veld: 'type', label: 'Type', type: 'tekst', uitleg: 'Werkdocument kolom B.' },
      { veld: 'cluster', label: 'Cluster', type: 'ref', ref: 'clusters', uitleg: 'Vitens Cluster (gebruik): het cluster dat het water gebruikt (werkdocument kolom C).' },
      { veld: 'watersysteem', label: 'Watersysteem', type: 'tekst', uitleg: 'Watersysteem van de winning: Flanken / Heuvelrug / Polder / Riviergebied (kolom D).' },
      { veld: 'vergunning', label: 'Vergunning', type: 'getal', eenheid: 'Mm³/j', uitleg: 'Inzetbare vergunning: vergunning minus bestuurlijke beperkingen (kolom E "Huidig aanbod").' },
      { veld: 'niet_inzetbaar', label: 'Niet inzetbaar', type: 'getal', eenheid: 'Mm³/j', uitleg: 'Aftrek op de vergunning die in het werkdocument in de formule van kolom F zit (bv. Bilthoven 0,8). Alleen ter documentatie.' },
      { veld: 'capaciteit', label: 'Inzetbare productiecapaciteit', type: 'getal', eenheid: 'Mm³/j', uitleg: 'Hiermee rekent het model (kolom F). Aanbod = capaciteit × reductiefactor.' },
      { veld: 'lat', label: 'Lat', type: 'getal', uitleg: 'Breedtegraad (WGS84) voor de kaart.' },
      { veld: 'lon', label: 'Lon', type: 'getal', uitleg: 'Lengtegraad (WGS84) voor de kaart.' },
      { veld: 'te_controleren', label: 'Te controleren', type: 'janee', uitleg: 'Ja zolang gemeente en coördinaten benaderd zijn.' },
      { veld: 'toelichting', label: 'Toelichting', type: 'tekst', uitleg: 'Vrije toelichting.' },
    ],
  },
];

export const UITLEG_REDUCTIEFACTOREN = 'Per narratief: rijen = winningen, kolomgroepen = criteria × 2030 / 2040 / 2050, zelfde indeling als kolommen H–AP van "Naratief N - winningen". Waarde tussen 0 en 1: het deel van de capaciteit dat overblijft. Leeg = 1. De factor van een winning is het minimum over de criteria.';
export const UITLEG_VRAAG_KOLOMMEN = [
  { label: 'Narratief · cluster', uitleg: 'Eén rij per narratief × cluster, in de volgorde van de tabellen Narratieven en Clusters. Rijen ontstaan vanzelf; voeg een cluster toe in de tabel Clusters.' },
  { label: '2025 – 2050', eenheid: 'Mm³/j', uitleg: 'Drinkwatervraag van het cluster in dat jaar, per 5 jaar. Verplicht: een lege cel is een blokkerende fout. Tussenliggende jaren worden lineair geïnterpoleerd.' },
];
export const UITLEG_VRAAG = 'Drinkwatervraag per narratief en cluster in Mm³/j voor 2025–2050 (per 5 jaar). Bron: tabblad "Ontwikkeling van de vraag".';

const STANDAARD_NARRATIEVEN = ['Ruim in conflict', 'Stoom in conflict', 'Ruim in harmonie', 'Stoom in harmonie'];
const STANDAARD_CRITERIA = [
  ['instandhouding-intern', 'Instandhouding (intern)', 'Assets', 'EOL en herbouwpotentie assets'],
  ['instandhouding-extern', 'Instandhouding (extern)', 'Assets', 'Overstromingsrisico, bedrijfszekerheid winveld, grondpositie, ontwikkelingen in de omgeving'],
  ['natuur', 'Natuur', 'Grondwaterkwantiteit', 'Effect op (grondwaterafhankelijke) natuur: verdroging'],
  ['landbouw', 'Landbouw', 'Grondwaterkwantiteit', 'Effect op landbouw: landbouwschade'],
  ['bebouwing', 'Bebouwing (paalrot)', 'Grondwaterkwantiteit', 'Effect op bebouwing: paalrot'],
  ['bodemdaling', 'Bodemdaling', 'Grondwaterkwantiteit', 'Bodemdalingsschade'],
  ['grondwaterkwaliteit', 'Grondwaterkwaliteit', 'Grondwaterkwaliteit', 'Wincapaciteit neemt af door risico op verontreiniging'],
  ['onbekend', '?? (betekenis onbekend)', 'Grondwaterkwaliteit', 'Zie OPEN-VRAGEN B1'],
  ['oppervlaktewaterkwaliteit', 'Oppervlaktewaterkwaliteit', 'Oppervlaktewaterkwaliteit', 'Wincapaciteit uit oppervlaktewater neemt (tijdelijk) af door verontreiniging'],
];

/** Lege dataset: alleen de vaste structuur (narratieven en criteria). */
export function legeDataset() {
  return {
    meta: { naam: 'Nieuwe dataset', schema_versie: 1, datum_import: null, bron: '', voorbeelddata: false },
    narratieven: STANDAARD_NARRATIEVEN.map((naam, i) => ({ id: i + 1, naam, deltascenario: '', lpppd_doel: null, toelichting: '' })),
    clusters: [], gemeenten: [],
    criteria: STANDAARD_CRITERIA.map(([id, naam, groep, toelichting]) => ({ id, naam, groep, toelichting })),
    winningen: [], reductiefactoren: {}, vraag: {}, maatregelen: [],
  };
}

/**
 * Breng een dataset in de vaste vorm: alle tabellen aanwezig, reductiefactoren en
 * vraag volledig uitgeschreven (lege cellen = null), maatregelen met alle velden.
 * Wijzigt `data` zelf en geeft het terug.
 */
export function normaliseer(data) {
  const leegDs = legeDataset();
  for (const k of Object.keys(leegDs)) if (data[k] == null) data[k] = leegDs[k];
  data.meta = { ...leegDs.meta, ...data.meta };

  const rf = {}, vraag = {};
  for (const n of data.narratieven) {
    const N = String(n.id);
    rf[N] = {};
    for (const w of data.winningen) {
      rf[N][w.id] = {};
      for (const c of data.criteria) {
        const rij = data.reductiefactoren?.[N]?.[w.id]?.[c.id];
        rf[N][w.id][c.id] = PEILJAREN.map((_, i) => rij?.[i] ?? null);
      }
    }
    vraag[N] = {};
    for (const c of data.clusters) {
      const rij = data.vraag?.[N]?.[c.id] ?? {};
      vraag[N][c.id] = Object.fromEntries(VRAAGJAREN.map((j) => [String(j), rij[j] ?? null]));
    }
  }
  data.reductiefactoren = rf;
  data.vraag = vraag;
  data.maatregelen = data.maatregelen.map(normaliseerMaatregel);
  return data;
}

/** Maatregel met alle velden in vaste volgorde (ontbrekend = null / leeg). */
export function normaliseerMaatregel(m) {
  const loc = m.locatie;
  const heeftLoc = loc && !(leeg(loc.lat) && leeg(loc.lon));
  const vo = m.voetafdruk;
  const heeftVo = vo && Object.keys(VOETAFDRUK).some((t) => vo[t] && ['beoordeling', 'toelichting', 'bron'].some((k) => !leeg(vo[t][k])));
  return {
    id: m.id ?? '', naam: m.naam ?? '', omschrijving: m.omschrijving ?? '',
    leverancier: m.leverancier ?? 'Vitens', soort: m.soort ?? null, spoor: m.spoor ?? null,
    narratieven: Array.isArray(m.narratieven) ? [...m.narratieven] : [1, 2, 3, 4],
    standaard_aan: !!m.standaard_aan, status: leeg(m.status) ? null : m.status,
    locatie: heeftLoc ? { lat: loc.lat ?? null, lon: loc.lon ?? null } : null,
    gemeente: leeg(m.gemeente) ? null : m.gemeente,
    cluster: leeg(m.cluster) ? null : m.cluster,
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
    meta: {
      aangeleverd_door: m.meta?.aangeleverd_door ?? '', datum: m.meta?.datum ?? '', bron: m.meta?.bron ?? '',
      onvolledig: !!m.meta?.onvolledig,
    },
  };
}

/** Telt fouten en waarschuwingen. */
export const telling = (meldingen) => ({
  fouten: meldingen.filter((m) => m.niveau === FOUT).length,
  waarschuwingen: meldingen.filter((m) => m.niveau === WAARSCHUWING).length,
});
