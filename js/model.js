// Rekenmodel drinkwateropgave: vraag per scenario, aanbod van de bestaande winningen,
// en maatregelen die een van beide veranderen.
// Pure functies, geen DOM, geen opslag: draait in de browser en in Node (tests).
// Alle volumes in Mm³/j. `data` volgt docs/datamodel.schema.json.
//
//   vraag   = vraag van het gekozen scenario − besparingen
//   aanbod  = capaciteit van de winningen − afnames + leveringen
//   opgave  = vraag zonder besparing − aanbod zonder leveringen (afnames tellen wel mee)

export const JAAR_MIN = 2025;
export const JAAR_MAX = 2050;
export const NU = 2026;                                   // "huidig": grens tussen nu en projectie
export const VRAAGJAREN = [2025, 2030, 2035, 2040, 2045, 2050];
export const ALLE_CLUSTERS = 'alle';

const tekst = (v) => (v == null ? '' : String(v).trim());

/** Lineaire interpolatie; buiten het bereik de eerste/laatste waarde. */
export function interpoleer(xs, ys, t) {
  if (t <= xs[0]) return ys[0];
  for (let i = 1; i < xs.length; i++) {
    if (t <= xs[i]) return ys[i - 1] + (ys[i] - ys[i - 1]) * (t - xs[i - 1]) / (xs[i] - xs[i - 1]);
  }
  return ys[ys.length - 1];
}

/** Is `jaar` een echt datapunt (geen interpolatie)? Het aanbod kent geen interpolatie. */
export const isDatapunt = (jaar) => ({ vraag: VRAAGJAREN.includes(jaar), aanbod: true });

// ------------------------------------------------- scenario's en clusters
/** Scenario's in de volgorde van de tabel Vraag; toelichting = de eerste niet-lege. */
export function scenarios(data) {
  const uit = new Map();
  for (const r of data?.vraag ?? []) {
    const id = tekst(r.scenario);
    if (!id) continue;
    if (!uit.has(id)) uit.set(id, { id, naam: id, toelichting: '' });
    if (!uit.get(id).toelichting && tekst(r.toelichting)) uit.get(id).toelichting = tekst(r.toelichting);
  }
  return [...uit.values()];
}

/** Clusters in de volgorde van de tabel Vraag, aangevuld met clusters die alleen bij winningen staan. */
export function clusters(data) {
  const uit = new Set();
  for (const r of data?.vraag ?? []) if (tekst(r.cluster)) uit.add(tekst(r.cluster));
  for (const w of data?.winningen ?? []) if (tekst(w.cluster)) uit.add(tekst(w.cluster));
  return [...uit];
}

const leegPerCluster = (data) => Object.fromEntries(clusters(data).map((c) => [c, 0]));
const som = (obj) => Object.values(obj).reduce((a, b) => a + b, 0);
const getal = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

// ---------------------------------------------------------------- basislijn
/** Capaciteit van de bestaande winningen per cluster (gelijk in elk jaar). */
export function aanbodBasis(data) {
  const uit = leegPerCluster(data);
  for (const w of data.winningen) {
    const c = tekst(w.cluster);
    if (c in uit) uit[c] += getal(w.capaciteit);
  }
  return uit;
}

/** Vraag per cluster in `jaar` voor een scenario (lineair tussen de 5-jaarspunten). */
export function vraagBasis(data, scenario, jaar) {
  const uit = leegPerCluster(data);
  const gedaan = new Set();
  for (const r of data.vraag) {
    const c = tekst(r.cluster);
    if (tekst(r.scenario) !== tekst(scenario) || !(c in uit) || gedaan.has(c)) continue;
    uit[c] = interpoleer(VRAAGJAREN, VRAAGJAREN.map((j) => getal(r[String(j)])), jaar);
    gedaan.add(c);
  }
  return uit;
}

// -------------------------------------------------------------- maatregelen
/** Telt een maatregel mee? Alleen leverancier Vitens (v1). `reden` zegt waarom niet. */
export function maatregelStatus(maatregel) {
  if (maatregel.leverancier !== 'Vitens') return { teltMee: false, reden: 'leverancier' };
  return { teltMee: true, reden: null };
}

/** Stapfunctie: 0 vóór het ingangsjaar, daarna het volledige volume. */
export const volumeInJaar = (maatregel, jaar) => (jaar >= maatregel.ingangsjaar ? getal(maatregel.volume) : 0);

/** Beginstand van de schakelaars: { id: true/false }. */
export const standaardAan = (data) => Object.fromEntries(data.maatregelen.map((m) => [m.id, !!m.standaard_aan]));

/**
 * Verdeel het volume van een maatregel over de clusters.
 * Cluster opgegeven: alles op dat cluster. "alle": naar aandeel in de vraag in dat jaar.
 * Onbekend cluster: null (maatregel telt niet mee).
 */
function verdeel(maatregel, volume, vraag0) {
  if (maatregel.cluster === ALLE_CLUSTERS) {
    const totaal = som(vraag0);
    const n = Object.keys(vraag0).length;
    return Object.fromEntries(Object.entries(vraag0).map(([id, v]) => [id, volume * (totaal > 0 ? v / totaal : 1 / n)]));
  }
  return maatregel.cluster in vraag0 ? { [maatregel.cluster]: volume } : null;
}

function resultaat(vraag0, capaciteit, besparing, levering, afname) {
  const aanbod0 = capaciteit - afname;              // bestaand aanbod, na afnames
  const vraag = vraag0 - besparing, aanbod = aanbod0 + levering;
  const opgave = vraag0 - aanbod0;                  // > 0 = tekort zonder besparing en levering
  const bijdrage = besparing + levering;
  return {
    vraag0, capaciteit, afname, aanbod0, vraag, aanbod, besparing, levering, bijdrage, opgave,
    saldo: aanbod - vraag,                          // negatief = tekort
    tekort: Math.max(0, vraag - aanbod),
    gedekt: opgave <= 0 ? 1 : Math.min(1, bijdrage / opgave),
  };
}

const DOEL = { waterbesparing: 'besparing', waterlevering: 'levering', afname: 'afname' };

/**
 * Hoofdberekening voor één scenario en één jaar.
 * @param aan  { id: true/false } stand van de schakelaars; ontbrekend = standaard_aan.
 * @returns {
 *   jaar, scenario,
 *   totaal:   { vraag0, capaciteit, afname, aanbod0, vraag, aanbod, besparing, levering, bijdrage, opgave, saldo, tekort, gedekt },
 *   clusters: { [cluster]: zelfde velden },
 *   maatregelen: { [id]: { teltMee, reden, aan, volume, actief, perCluster } },
 *   ruimtebeslag, stroomvraag   // som over actieve maatregelen in dit jaar
 * }
 */
export function bereken(data, scenario, jaar, aan = {}) {
  const vraag0 = vraagBasis(data, scenario, jaar);
  const capaciteit = aanbodBasis(data);
  const effect = { besparing: leegPerCluster(data), levering: leegPerCluster(data), afname: leegPerCluster(data) };
  const maatregelen = {};
  let ruimtebeslag = 0, stroomvraag = 0;

  for (const m of data.maatregelen) {
    let { teltMee, reden } = maatregelStatus(m);
    const staatAan = aan[m.id] ?? !!m.standaard_aan;
    const volume = volumeInJaar(m, jaar);
    const perCluster = verdeel(m, volume, vraag0);
    if (teltMee && (!perCluster || !DOEL[m.soort])) { teltMee = false; reden = perCluster ? 'soort' : 'cluster'; }
    const actief = teltMee && staatAan && volume > 0;
    if (actief) {
      for (const [id, v] of Object.entries(perCluster)) effect[DOEL[m.soort]][id] += v;
      ruimtebeslag += getal(m.ruimtebeslag);
      stroomvraag += getal(m.stroomvraag);
    }
    maatregelen[m.id] = { teltMee, reden, aan: staatAan, volume, actief, perCluster: perCluster ?? {} };
  }

  const perCluster = {};
  for (const c of Object.keys(vraag0)) {
    perCluster[c] = resultaat(vraag0[c], capaciteit[c], effect.besparing[c], effect.levering[c], effect.afname[c]);
  }
  return {
    jaar, scenario,
    totaal: resultaat(som(vraag0), som(capaciteit), som(effect.besparing), som(effect.levering), som(effect.afname)),
    clusters: perCluster, maatregelen, ruimtebeslag, stroomvraag,
  };
}

/** `bereken` voor elk jaar 2025–2050 (voor de grafiek). */
export function reeks(data, scenario, aan = {}) {
  const uit = [];
  for (let j = JAAR_MIN; j <= JAAR_MAX; j++) uit.push(bereken(data, scenario, j, aan));
  return uit;
}

/**
 * Samenvatting na import: aantallen, huidige capaciteit en de totale vraag per scenario
 * op de 5-jaarspunten, om direct met de bron te vergelijken.
 */
export function samenvatting(data) {
  return {
    winningen: data.winningen.length,
    maatregelen: data.maatregelen.length,
    clusters: clusters(data).length,
    capaciteit: som(aanbodBasis(data)),
    vraag: Object.fromEntries(scenarios(data).map((s) => [s.id, VRAAGJAREN.map((j) => som(vraagBasis(data, s.id, j)))])),
  };
}
