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
  for (const m of lijst('maatregelen')) uit.push(...valideerMaatregel(m, { clusters, gemeenten, narratieven }));

  return uit;
}

/**
 * Valideer één maatregel-dataobject (ook gebruikt door het formulier).
 * @param ctx { clusters: Set, gemeenten: Set, narratieven: Set<string> }
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

/** Telt fouten en waarschuwingen. */
export const telling = (meldingen) => ({
  fouten: meldingen.filter((m) => m.niveau === FOUT).length,
  waarschuwingen: meldingen.filter((m) => m.niveau === WAARSCHUWING).length,
});
