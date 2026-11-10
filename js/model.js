// Rekenmodel drinkwateropgave: basislijn (werkdocument) + maatregelen.
// Pure functies, geen DOM, geen opslag: draait in de browser en in Node (tests).
// Alle volumes in Mm³/j. `data` volgt docs/datamodel.schema.json.

export const JAAR_MIN = 2025;
export const JAAR_MAX = 2050;
export const NU = 2026;                                   // "huidig" in het werkdocument
export const AANBODJAREN = [2026, 2030, 2040, 2050];      // echte datapunten aanbod
export const PEILJAREN = [2030, 2040, 2050];              // jaren met reductiefactoren
export const VRAAGJAREN = [2025, 2030, 2035, 2040, 2045, 2050];
export const ALLE_CLUSTERS = 'alle';

/** Lineaire interpolatie; buiten het bereik de eerste/laatste waarde. */
export function interpoleer(xs, ys, t) {
  if (t <= xs[0]) return ys[0];
  for (let i = 1; i < xs.length; i++) {
    if (t <= xs[i]) return ys[i - 1] + (ys[i] - ys[i - 1]) * (t - xs[i - 1]) / (xs[i] - xs[i - 1]);
  }
  return ys[ys.length - 1];
}

/** Is `jaar` een echt datapunt (geen interpolatie)? */
export const isDatapunt = (jaar) => ({
  vraag: VRAAGJAREN.includes(jaar),
  aanbod: jaar <= NU || AANBODJAREN.includes(jaar),
});

// ---------------------------------------------------------------- basislijn

/**
 * Reductiefactor van een winning in een peiljaar (index 0..2 = 2030/2040/2050).
 * factor = MIN over de criteria; leeg = 1. Het slechtste criterium is bindend;
 * bij een gelijke stand zijn ze allemaal bindend. Zonder reductie (factor 1): geen.
 */
export function factorPeiljaar(data, narratief, winningId, i) {
  const rijen = data.reductiefactoren?.[narratief]?.[winningId] ?? {};
  let factor = 1, bindend = [];
  for (const c of data.criteria) {
    const v = rijen[c.id]?.[i];
    const f = v == null ? 1 : v;
    if (f < factor) { factor = f; bindend = [c.id]; }
    else if (f === factor && f < 1) bindend.push(c.id);
  }
  return { factor, bindend };
}

/** Aanbod van één winning op de datapunten [2026, 2030, 2040, 2050]. */
export function aanbodWinningPeiljaren(data, narratief, winning) {
  return [winning.capaciteit, ...PEILJAREN.map((_, i) =>
    winning.capaciteit * factorPeiljaar(data, narratief, winning.id, i).factor)];
}

/**
 * Eén winning in een willekeurig jaar: aanbod (geïnterpoleerd), afname t.o.v. de
 * capaciteit en het bindende criterium van het eerstvolgende peiljaar.
 */
export function winningInJaar(data, narratief, winning, jaar) {
  const aanbod = interpoleer(AANBODJAREN, aanbodWinningPeiljaren(data, narratief, winning), jaar);
  const afname = winning.capaciteit - aanbod;
  let bindend = [];
  if (jaar > NU) {
    const i = Math.max(0, PEILJAREN.findIndex((p) => p >= jaar));
    bindend = factorPeiljaar(data, narratief, winning.id, i).bindend;
  }
  return {
    aanbod, afname, bindend,
    afnamePct: winning.capaciteit > 0 ? afname / winning.capaciteit * 100 : 0,
  };
}

const leegPerCluster = (data) => Object.fromEntries(data.clusters.map((c) => [c.id, 0]));
const som = (obj) => Object.values(obj).reduce((a, b) => a + b, 0);

/** Basisaanbod per cluster in `jaar` (som over de winningen van dat cluster). */
export function aanbodBasis(data, narratief, jaar) {
  const uit = leegPerCluster(data);
  for (const w of data.winningen) {
    if (w.cluster in uit) uit[w.cluster] += interpoleer(AANBODJAREN, aanbodWinningPeiljaren(data, narratief, w), jaar);
  }
  return uit;
}

/** Basisvraag per cluster in `jaar`. */
export function vraagBasis(data, narratief, jaar) {
  const uit = leegPerCluster(data);
  const perCluster = data.vraag?.[narratief] ?? {};
  for (const id of Object.keys(uit)) {
    const rij = perCluster[id];
    if (rij) uit[id] = interpoleer(VRAAGJAREN, VRAAGJAREN.map((j) => rij[j] ?? 0), jaar);
  }
  return uit;
}

// -------------------------------------------------------------- maatregelen

/**
 * Telt een maatregel mee in dit narratief? Alleen leverancier Vitens (v1) en
 * alleen als het narratief in de lijst staat. `reden` zegt waarom niet.
 */
export function maatregelStatus(maatregel, narratief) {
  if (maatregel.leverancier !== 'Vitens') return { teltMee: false, reden: 'leverancier' };
  if (!(maatregel.narratieven ?? []).includes(Number(narratief))) return { teltMee: false, reden: 'narratief' };
  return { teltMee: true, reden: null };
}

/** Stapfunctie: 0 vóór het ingangsjaar, daarna het volledige volume. */
export const volumeInJaar = (maatregel, jaar) => (jaar >= maatregel.ingangsjaar ? maatregel.volume : 0);

/** Beginstand van de schakelaars: { id: true/false }. */
export const standaardAan = (data) => Object.fromEntries(data.maatregelen.map((m) => [m.id, !!m.standaard_aan]));

/**
 * Verdeel het volume van een maatregel over de clusters.
 * Cluster opgegeven: alles op dat cluster. "alle": naar aandeel in de basisvraag in dat jaar.
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

function resultaat(vraag0, aanbod0, besparing, levering) {
  const vraag = vraag0 - besparing, aanbod = aanbod0 + levering;
  const opgave = vraag0 - aanbod0;                 // zonder maatregelen; > 0 = tekort
  const bijdrage = besparing + levering;
  return {
    vraag0, aanbod0, vraag, aanbod, besparing, levering, bijdrage, opgave,
    saldo: aanbod - vraag,                         // zoals de Excel: aanbod − vraag (negatief = tekort)
    tekort: Math.max(0, vraag - aanbod),
    gedekt: opgave <= 0 ? 1 : Math.min(1, bijdrage / opgave),
  };
}

/**
 * Hoofdberekening voor één narratief en één jaar.
 * @param aan  { id: true/false } stand van de schakelaars; ontbrekend = standaard_aan.
 * @returns {
 *   jaar, narratief,
 *   totaal:   { vraag0, aanbod0, vraag, aanbod, besparing, levering, bijdrage, opgave, saldo, tekort, gedekt },
 *   clusters: { [clusterId]: zelfde velden },
 *   maatregelen: { [id]: { teltMee, reden, aan, volume, actief, perCluster } },
 *   ruimtebeslag, stroomvraag   // som over actieve maatregelen in dit jaar
 * }
 */
export function bereken(data, narratief, jaar, aan = {}) {
  const vraag0 = vraagBasis(data, narratief, jaar);
  const aanbod0 = aanbodBasis(data, narratief, jaar);
  const besparing = leegPerCluster(data), levering = leegPerCluster(data);
  const maatregelen = {};
  let ruimtebeslag = 0, stroomvraag = 0;

  for (const m of data.maatregelen) {
    let { teltMee, reden } = maatregelStatus(m, narratief);
    const staatAan = aan[m.id] ?? !!m.standaard_aan;
    const volume = volumeInJaar(m, jaar);
    const perCluster = verdeel(m, volume, vraag0);
    if (teltMee && !perCluster) { teltMee = false; reden = 'cluster'; }
    const actief = teltMee && staatAan && volume > 0;
    if (actief) {
      const doel = m.soort === 'waterbesparing' ? besparing : levering;
      for (const [id, v] of Object.entries(perCluster)) doel[id] += v;
      ruimtebeslag += m.ruimtebeslag ?? 0;
      stroomvraag += m.stroomvraag ?? 0;
    }
    maatregelen[m.id] = { teltMee, reden, aan: staatAan, volume, actief, perCluster: perCluster ?? {} };
  }

  const clusters = {};
  for (const c of data.clusters) {
    clusters[c.id] = resultaat(vraag0[c.id], aanbod0[c.id], besparing[c.id], levering[c.id]);
  }
  return {
    jaar, narratief: Number(narratief),
    totaal: resultaat(som(vraag0), som(aanbod0), som(besparing), som(levering)),
    clusters, maatregelen, ruimtebeslag, stroomvraag,
  };
}

/** `bereken` voor elk jaar 2025–2050 (voor de grafiek). */
export function reeks(data, narratief, aan = {}) {
  const uit = [];
  for (let j = JAAR_MIN; j <= JAAR_MAX; j++) uit.push(bereken(data, narratief, j, aan));
  return uit;
}

/**
 * Samenvatting na import: totaal aanbod per narratief op [2026, 2030, 2040, 2050],
 * om direct met de Excel te vergelijken.
 */
export function samenvatting(data) {
  return {
    winningen: data.winningen.length,
    maatregelen: data.maatregelen.length,
    aanbod: Object.fromEntries(data.narratieven.map((n) =>
      [n.id, AANBODJAREN.map((j) => som(aanbodBasis(data, n.id, j)))])),
  };
}
