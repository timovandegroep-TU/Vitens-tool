// Rekenregels: vraag per scenario, aanbod van de winningen en de maatregelen daarop.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  bereken, standaardAan, volumeInJaar, maatregelStatus, scenarios, clusters, aanbodBasis, vraagBasis, isDatapunt,
} from '../js/model.js';
import {
  normaliseer, valideerMaatregel, contextVoorMaatregel, veldVanMelding, maatregelWeergave, nieuweMaatregel, maakId, MAATREGEL_VELDEN,
} from '../js/schema.js';
import {
  maatregelenTemplate, templateLijsten, werkboekNaarBladen, maatregelenUitBladen, isMaatregelenBestand, MAATREGEL_KOLOMMEN,
} from '../js/store.js';
import { voorbeeld, bijna, kopie, maakMaatregel, zonderLevering } from './hulp.mjs';

const basis = normaliseer(kopie(voorbeeld));
const SCEN = scenarios(basis).map((s) => s.id);
const CLUSTER = clusters(basis)[0];
const WINNING = basis.winningen.find((w) => w.cluster === CLUSTER);

/** Dataset zonder maatregelen, plus de opgegeven testmaatregelen. */
function metMaatregelen(...maatregelen) {
  const d = kopie(basis);
  d.maatregelen = maatregelen;
  return d;
}
const leeg = metMaatregelen();

test('basislijn: aanbod = capaciteit van de winningen, gelijk in elk jaar en elk scenario', () => {
  const cap = basis.winningen.reduce((s, w) => s + w.capaciteit, 0);
  for (const s of SCEN) {
    for (const j of [2025, 2026, 2037, 2050]) {
      const r = bereken(leeg, s, j);
      bijna(r.totaal.aanbod0, cap, `${s} ${j}`);
      bijna(r.totaal.aanbod, cap, `${s} ${j} zonder maatregelen`);
    }
  }
  const perCluster = aanbodBasis(basis);
  bijna(perCluster[CLUSTER], basis.winningen.filter((w) => w.cluster === CLUSTER).reduce((s, w) => s + w.capaciteit, 0), CLUSTER);
  assert.ok(isDatapunt(2033).aanbod && !isDatapunt(2033).vraag && isDatapunt(2035).vraag);
});

test('scenario verandert alleen de vraag; tussenjaren lineair geïnterpoleerd', () => {
  assert.ok(SCEN.length >= 2);
  const [a, b] = SCEN;
  const ra = bereken(leeg, a, 2050), rb = bereken(leeg, b, 2050);
  assert.notEqual(ra.totaal.vraag0, rb.totaal.vraag0);
  bijna(ra.totaal.aanbod0, rb.totaal.aanbod0, 'aanbod gelijk');
  const rij = basis.vraag.find((r) => r.scenario === b && r.cluster === CLUSTER);
  bijna(vraagBasis(basis, b, 2032)[CLUSTER], rij['2030'] + (rij['2035'] - rij['2030']) * 2 / 5, '2032');
  bijna(vraagBasis(basis, b, 2050)[CLUSTER], rij['2050'], '2050');
});

test('waterlevering 5 Mm³/j op één cluster, ingangsjaar 2035', () => {
  const d = metMaatregelen(maakMaatregel({ id: 'lev', volume: 5, cluster: CLUSTER, ingangsjaar: 2035 }));
  for (const s of SCEN) {
    const b34 = bereken(leeg, s, 2034), m34 = bereken(d, s, 2034);
    const b35 = bereken(leeg, s, 2035), m35 = bereken(d, s, 2035);
    bijna(m34.clusters[CLUSTER].aanbod, b34.clusters[CLUSTER].aanbod, `${s} 2034 ongewijzigd`);
    bijna(m35.clusters[CLUSTER].aanbod, b35.clusters[CLUSTER].aanbod + 5, `${s} 2035 +5`);
    bijna(m35.totaal.vraag, b35.totaal.vraag, `${s} vraag ongewijzigd`);
    bijna(m35.totaal.opgave, b35.totaal.opgave, `${s} opgave ongewijzigd`);
    for (const c of clusters(d)) if (c !== CLUSTER) bijna(m35.clusters[c].aanbod, b35.clusters[c].aanbod, `${s} ander cluster ${c}`);
    assert.equal(m34.maatregelen.lev.volume, 0);          // "+0" vóór het ingangsjaar
    assert.equal(m35.maatregelen.lev.volume, 5);
  }
});

test('waterbesparing 3 Mm³/j op "alle clusters", ingangsjaar 2030: verdeeld naar vraagaandeel', () => {
  const d = metMaatregelen(zonderLevering({ id: 'besp', volume: 3, cluster: 'alle', ingangsjaar: 2030 }));
  const b = bereken(leeg, SCEN[0], 2030), m = bereken(d, SCEN[0], 2030);
  bijna(b.totaal.vraag - m.totaal.vraag, 3, 'totale vraag −3');
  bijna(m.totaal.aanbod, b.totaal.aanbod, 'aanbod ongewijzigd');
  let som = 0;
  for (const c of clusters(d)) {
    const daling = b.clusters[c].vraag - m.clusters[c].vraag;
    bijna(daling, 3 * b.clusters[c].vraag / b.totaal.vraag, `aandeel ${c}`);
    som += daling;
  }
  bijna(som, 3, 'som per cluster');
  bijna(bereken(d, SCEN[0], 2029).totaal.vraag, bereken(leeg, SCEN[0], 2029).totaal.vraag, '2029 ongewijzigd');
});

test('afname 2 Mm³/j van een winning, ingangsjaar 2035: bestaand aanbod omlaag, opgave omhoog', () => {
  const d = metMaatregelen(zonderLevering({ id: 'af', soort: 'afname', spoor: 'S1', volume: 2, cluster: CLUSTER, winning: WINNING.naam, ingangsjaar: 2035 }));
  const s = SCEN[0];
  const b34 = bereken(leeg, s, 2034), m34 = bereken(d, s, 2034), b35 = bereken(leeg, s, 2035), m35 = bereken(d, s, 2035);
  bijna(m34.totaal.aanbod0, b34.totaal.aanbod0, '2034 ongewijzigd');
  bijna(m35.clusters[CLUSTER].aanbod0, b35.clusters[CLUSTER].aanbod0 - 2, 'bestaand aanbod −2');
  bijna(m35.clusters[CLUSTER].aanbod, b35.clusters[CLUSTER].aanbod - 2, 'aanbod −2');
  bijna(m35.totaal.opgave, b35.totaal.opgave + 2, 'opgave +2');
  bijna(m35.totaal.afname, 2, 'afname');
  bijna(m35.totaal.bijdrage, 0, 'afname is geen bijdrage');
  bijna(m35.totaal.vraag, b35.totaal.vraag, 'vraag ongewijzigd');
  // afname uitgezet = basislijn
  assert.deepEqual(bereken(d, s, 2040, { af: false }).totaal, bereken(leeg, s, 2040).totaal);
});

test('zelfde waterlevering van Oasen: telt niet mee, staat wel in de lijst', () => {
  const d = metMaatregelen(maakMaatregel({ id: 'lev', leverancier: 'Oasen', volume: 5, cluster: CLUSTER, ingangsjaar: 2035 }));
  for (const jaar of [2034, 2035, 2050]) {
    const b = bereken(leeg, SCEN[0], jaar), m = bereken(d, SCEN[0], jaar);
    bijna(m.totaal.aanbod, b.totaal.aanbod, `totaal ${jaar}`);
  }
  const s = bereken(d, SCEN[0], 2040).maatregelen.lev;
  assert.deepEqual({ teltMee: s.teltMee, reden: s.reden, actief: s.actief }, { teltMee: false, reden: 'leverancier', actief: false });
  assert.equal(s.volume, 5);
  assert.deepEqual(maatregelStatus(maakMaatregel()), { teltMee: true, reden: null });
});

test('maatregel uit en weer aan: gelijk aan basislijn plus maatregel', () => {
  const d = metMaatregelen(maakMaatregel({ id: 'lev', volume: 5, cluster: CLUSTER, ingangsjaar: 2035 }));
  const aan1 = bereken(d, SCEN[0], 2040, { lev: true });
  const uit = bereken(d, SCEN[0], 2040, { lev: false });
  const aan2 = bereken(d, SCEN[0], 2040, { lev: true });
  assert.deepEqual(aan2, aan1);
  assert.deepEqual(uit.totaal, bereken(leeg, SCEN[0], 2040).totaal);
  bijna(aan2.totaal.aanbod, uit.totaal.aanbod + 5, 'basislijn + 5');
  assert.deepEqual(bereken(d, SCEN[0], 2040), bereken(d, SCEN[0], 2040, standaardAan(d)));
});

test('stapfunctie, dekking en informatieve sommen', () => {
  assert.equal(volumeInJaar({ ingangsjaar: 2035, volume: 4 }, 2034), 0);
  assert.equal(volumeInJaar({ ingangsjaar: 2035, volume: 4 }, 2035), 4);
  const d = metMaatregelen(
    maakMaatregel({ id: 'a', volume: 1, cluster: CLUSTER, ingangsjaar: 2030, ruimtebeslag: 10, stroomvraag: 2 }),
    maakMaatregel({ id: 'b', volume: 1, cluster: CLUSTER, ingangsjaar: 2045, ruimtebeslag: 5, stroomvraag: 1 }),
  );
  const r = bereken(d, SCEN[0], 2040);
  assert.equal(r.ruimtebeslag, 10);
  assert.equal(r.stroomvraag, 2);
  bijna(r.totaal.bijdrage, 1, 'bijdrage');
  if (r.totaal.opgave > 0) bijna(r.totaal.gedekt, Math.min(1, 1 / r.totaal.opgave), 'gedekt = bijdrage ÷ opgave');
  assert.equal(bereken(d, SCEN[0], 2045).ruimtebeslag, 15);
  // tekort = opgave − bijdrage (als dat positief is)
  bijna(r.totaal.tekort, Math.max(0, r.totaal.opgave - r.totaal.bijdrage), 'tekort');
});

// ------------------------------------------------------ template en formulier
const XLSX = createRequire(import.meta.url)('../vendor/xlsx.full.min.js');

test('roundtrip maatregelen-template: exporteren → importeren → identieke objecten', () => {
  const bytes = maatregelenTemplate(XLSX, basis, basis.maatregelen);
  const bladen = werkboekNaarBladen(XLSX, XLSX.read(bytes, { type: 'array' }));
  assert.deepEqual(Object.keys(bladen), ['Maatregelen', 'Uitleg', 'Lijsten']);
  assert.ok(isMaatregelenBestand(bladen));
  assert.deepEqual(maatregelenUitBladen(bladen), basis.maatregelen);
});

test('maatregelen-template: leeg, met gegevensvalidatie, uitleg per kolom en lijsten uit de dataset', () => {
  const bytes = maatregelenTemplate(XLSX, basis);
  const bladen = werkboekNaarBladen(XLSX, XLSX.read(bytes, { type: 'array' }));
  assert.deepEqual(maatregelenUitBladen(bladen), []);
  assert.deepEqual(bladen.Maatregelen[0], MAATREGEL_VELDEN.map((v) => v.veld));
  const uitgelegd = new Set(bladen.Uitleg.slice(1).map((r) => r[0]));
  for (const k of MAATREGEL_KOLOMMEN) assert.ok(uitgelegd.has(k.veld), `uitleg voor ${k.veld}`);
  const lijsten = templateLijsten(basis);
  assert.deepEqual(lijsten.cluster, ['alle', ...clusters(basis)]);
  assert.deepEqual(lijsten.winning, [...new Set(basis.winningen.map((w) => w.naam))]);   // Fledite ROL één keer
  const kop = bladen.Lijsten[0];
  assert.deepEqual(bladen.Lijsten.slice(1).map((r) => r[kop.indexOf('soort')]).filter(Boolean), ['waterlevering', 'waterbesparing', 'afname']);
  const zip = XLSX.CFB.read(bytes, { type: 'array' });
  const blad = Buffer.from(zip.FileIndex[zip.FullPaths.findIndex((p) => p.endsWith('xl/worksheets/sheet1.xml'))].content).toString('utf8');
  assert.equal(Number(blad.match(/<dataValidations count="(\d+)">/)?.[1]), Object.keys(lijsten).length + 6, 'één regel per keuzelijst plus zes getalcontroles');
  assert.match(blad, /<dataValidation type="list"[^>]*sqref="E2:E500"[^>]*><formula1>Lijsten!\$B\$2:\$B\$4<\/formula1>/);
  assert.match(blad, /<dataValidation type="whole" operator="between"[^>]*><formula1>2025<\/formula1><formula2>2050<\/formula2>/);
});

test('formulier: melding → veld, id-voorstel, nieuwe maatregel en weergave (rij + tooltip)', () => {
  const velden = new Set(MAATREGEL_VELDEN.map((v) => v.veld));
  const ctx = contextVoorMaatregel(basis);
  const leegM = { ...nieuweMaatregel('2026-01-01'), soort: 'waterlevering' };
  for (const x of valideerMaatregel(leegM, ctx)) assert.ok(velden.has(veldVanMelding(x.veld)), `veld bij melding "${x.veld}"`);
  assert.equal(veldVanMelding('voetafdruk Natura 2000'), 'natura2000_beoordeling');
  assert.equal(maakId('  Nieuwe winning Écht-B (2) '), 'nieuwe-winning-echt-b-2');
  assert.deepEqual([leegM.leverancier, leegM.standaard_aan, leegM.meta.datum], ['Vitens', true, '2026-01-01']);

  const w = maatregelWeergave(maakMaatregel({ volume: 2.5, naam: 'Een naam die duidelijk langer is dan vijfendertig tekens' }));
  assert.equal(w.waarde, '+2,5');
  assert.equal(w.naam.length, 35);
  assert.ok(w.regels.some(([k, v]) => k === 'Volume' && /vergunde capaciteit/.test(v)));
  const b = maatregelWeergave(zonderLevering({ leverancier: 'Oasen', volume: 3 }));
  assert.equal(b.waarde, '−3,0');
  assert.ok(b.regels.some(([k, v]) => k === 'Volume' && /verlaagde vraag/.test(v)));
  assert.ok(!b.teltMee && b.noten.some((n) => /Niet meegerekend/.test(n)));
  const a = maatregelWeergave(zonderLevering({ soort: 'afname', volume: 2, winning: 'X' }));
  assert.equal(a.waarde, '−2,0');
  assert.deepEqual(a.regels.find(([k]) => k === 'Winning'), ['Winning', 'X']);
});

test('validatie maatregel: winning bepaalt cluster en locatie; afname vraagt een winning', () => {
  const ctx = contextVoorMaatregel(basis);
  const veld = (ml, niveau, v) => ml.some((x) => x.niveau === niveau && x.veld === v);
  // levering op een bestaande winning: geen lat/lon of gemeente nodig
  const s2 = maakMaatregel({ spoor: 'S2', winning: WINNING.naam, cluster: WINNING.cluster, gemeente: null, locatie: null });
  assert.deepEqual(valideerMaatregel(s2, ctx), []);
  // afwijkend cluster: waarschuwing; onbekende winning: fout
  const ander = clusters(basis).find((c) => c !== WINNING.cluster);
  assert.ok(veld(valideerMaatregel({ ...s2, cluster: ander }, ctx), 'waarschuwing', 'cluster'));
  assert.ok(veld(valideerMaatregel({ ...s2, winning: 'Bestaat niet' }, ctx), 'fout', 'winning'));
  // afname zonder winning: waarschuwing; op "alle": fout
  const af = zonderLevering({ soort: 'afname', spoor: 'S1', cluster: CLUSTER });
  assert.ok(veld(valideerMaatregel(af, ctx), 'waarschuwing', 'winning'));
  assert.ok(veld(valideerMaatregel({ ...af, cluster: 'alle' }, ctx), 'fout', 'cluster'));
  // nieuwe levering zonder winning: locatie en gemeente verplicht
  const s3 = maakMaatregel({ cluster: CLUSTER, gemeente: null, locatie: null });
  assert.ok(veld(valideerMaatregel(s3, ctx), 'fout', 'locatie') && veld(valideerMaatregel(s3, ctx), 'fout', 'gemeente'));
});
