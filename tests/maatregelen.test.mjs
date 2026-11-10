// Acceptatietests voor de rekenregels van maatregelen.
// Draaien op de werkdocumentdata als die er is, anders op het fictieve voorbeeld.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bereken, standaardAan, volumeInJaar, maatregelStatus } from '../js/model.js';
import { createRequire } from 'node:module';
import {
  normaliseer, valideerMaatregel, contextVoorMaatregel, veldVanMelding, maatregelWeergave, nieuweMaatregel, maakId, MAATREGEL_VELDEN,
} from '../js/schema.js';
import {
  maatregelenTemplate, templateLijsten, werkboekNaarBladen, maatregelenUitBladen, isMaatregelenBestand,
  maatregelNaarRij, rijNaarMaatregel, MAATREGEL_KOLOMMEN,
} from '../js/store.js';
import { werkdocument, voorbeeld, bijna, kopie, maakMaatregel, SKIP_WD } from './hulp.mjs';

const basisdata = werkdocument ?? voorbeeld;
const bron = werkdocument ? 'werkdocument' : 'fictief voorbeeld';
const CLUSTER = basisdata.clusters.some((c) => c.id === 'utrecht-west') ? 'utrecht-west' : basisdata.clusters[0].id;

/** Dataset zonder bestaande maatregelen, plus de opgegeven testmaatregelen. */
function metMaatregelen(...maatregelen) {
  const d = kopie(basisdata);
  d.maatregelen = maatregelen;
  return d;
}
const leeg = metMaatregelen();

test(`waterlevering 5 Mm³/j op één cluster, ingangsjaar 2035 (${bron})`, () => {
  const d = metMaatregelen(maakMaatregel({ id: 'lev', volume: 5, cluster: CLUSTER, ingangsjaar: 2035 }));
  for (const n of [1, 2, 3, 4]) {
    const b34 = bereken(leeg, n, 2034), m34 = bereken(d, n, 2034);
    const b35 = bereken(leeg, n, 2035), m35 = bereken(d, n, 2035);
    bijna(m34.clusters[CLUSTER].aanbod, b34.clusters[CLUSTER].aanbod, `N${n} 2034 ongewijzigd`);
    bijna(m35.clusters[CLUSTER].aanbod, b35.clusters[CLUSTER].aanbod + 5, `N${n} 2035 +5`);
    bijna(m35.totaal.aanbod, b35.totaal.aanbod + 5, `N${n} totaal 2035 +5`);
    bijna(m35.totaal.vraag, b35.totaal.vraag, `N${n} vraag ongewijzigd`);
    for (const c of d.clusters) {
      if (c.id !== CLUSTER) bijna(m35.clusters[c.id].aanbod, b35.clusters[c.id].aanbod, `N${n} ander cluster ${c.id}`);
    }
    assert.equal(m34.maatregelen.lev.volume, 0);          // "+0" vóór het ingangsjaar
    assert.equal(m35.maatregelen.lev.volume, 5);
  }
});

test(`waterbesparing 3 Mm³/j op "alle clusters", ingangsjaar 2030: verdeeld naar vraagaandeel (${bron})`, () => {
  const d = metMaatregelen(maakMaatregel({
    id: 'besp', soort: 'waterbesparing', spoor: 'S0', volume: 3, cluster: 'alle', ingangsjaar: 2030,
    locatie: null, bron: null, ruimtebeslag: null, stroomvraag: null, voetafdruk: null,
  }));
  const b = bereken(leeg, 1, 2030), m = bereken(d, 1, 2030);
  bijna(b.totaal.vraag - m.totaal.vraag, 3, 'totale vraag −3');
  bijna(m.totaal.aanbod, b.totaal.aanbod, 'aanbod ongewijzigd');
  let som = 0;
  for (const c of d.clusters) {
    const daling = b.clusters[c.id].vraag - m.clusters[c.id].vraag;
    bijna(daling, 3 * b.clusters[c.id].vraag / b.totaal.vraag, `aandeel ${c.id}`);
    som += daling;
  }
  bijna(som, 3, 'som per cluster');
  bijna(bereken(d, 1, 2029).totaal.vraag, bereken(leeg, 1, 2029).totaal.vraag, '2029 ongewijzigd');
});

test(`zelfde waterlevering van Oasen: telt niet mee, staat wel in de lijst (${bron})`, () => {
  const d = metMaatregelen(maakMaatregel({ id: 'lev', leverancier: 'Oasen', volume: 5, cluster: CLUSTER, ingangsjaar: 2035 }));
  for (const jaar of [2034, 2035, 2050]) {
    const b = bereken(leeg, 1, jaar), m = bereken(d, 1, jaar);
    bijna(m.totaal.aanbod, b.totaal.aanbod, `totaal ${jaar}`);
    for (const c of d.clusters) bijna(m.clusters[c.id].aanbod, b.clusters[c.id].aanbod, `${c.id} ${jaar}`);
  }
  const s = bereken(d, 1, 2040).maatregelen.lev;
  assert.deepEqual({ teltMee: s.teltMee, reden: s.reden, actief: s.actief }, { teltMee: false, reden: 'leverancier', actief: false });
  assert.equal(s.volume, 5);                               // wel zichtbaar met zijn volume
});

test(`maatregel uit en weer aan: gelijk aan basislijn plus maatregel (${bron})`, () => {
  const d = metMaatregelen(maakMaatregel({ id: 'lev', volume: 5, cluster: CLUSTER, ingangsjaar: 2035 }));
  const aan1 = bereken(d, 1, 2040, { lev: true });
  const uit = bereken(d, 1, 2040, { lev: false });
  const aan2 = bereken(d, 1, 2040, { lev: true });
  assert.deepEqual(aan2, aan1);
  assert.deepEqual(uit.totaal, bereken(leeg, 1, 2040).totaal);
  bijna(aan2.totaal.aanbod, uit.totaal.aanbod + 5, 'basislijn + 5');
  // zonder expliciete stand geldt standaard_aan
  assert.deepEqual(bereken(d, 1, 2040), bereken(d, 1, 2040, standaardAan(d)));
});

test('maatregel geldt alleen in de opgegeven narratieven', () => {
  const m = maakMaatregel({ narratieven: [1, 2] });
  assert.deepEqual(maatregelStatus(m, 1), { teltMee: true, reden: null });
  assert.deepEqual(maatregelStatus(m, 3), { teltMee: false, reden: 'narratief' });
  const d = metMaatregelen(maakMaatregel({ id: 'x', volume: 2, cluster: CLUSTER, ingangsjaar: 2030, narratieven: [1, 2] }));
  bijna(bereken(d, 3, 2040).totaal.levering, 0, 'narratief 3');
  bijna(bereken(d, 2, 2040).totaal.levering, 2, 'narratief 2');
});

test('stapfunctie, dekking en informatieve sommen', () => {
  assert.equal(volumeInJaar({ ingangsjaar: 2035, volume: 4 }, 2034), 0);
  assert.equal(volumeInJaar({ ingangsjaar: 2035, volume: 4 }, 2035), 4);
  const d = metMaatregelen(
    maakMaatregel({ id: 'a', volume: 1, cluster: CLUSTER, ingangsjaar: 2030, ruimtebeslag: 10, stroomvraag: 2 }),
    maakMaatregel({ id: 'b', volume: 1, cluster: CLUSTER, ingangsjaar: 2045, ruimtebeslag: 5, stroomvraag: 1 }),
  );
  const r = bereken(d, 1, 2040);
  assert.equal(r.ruimtebeslag, 10);                        // alleen actieve maatregelen in het zichtjaar
  assert.equal(r.stroomvraag, 2);
  bijna(r.totaal.bijdrage, 1, 'bijdrage');
  if (r.totaal.opgave > 0) bijna(r.totaal.gedekt, Math.min(1, 1 / r.totaal.opgave), 'gedekt = bijdrage ÷ opgave');
  assert.equal(bereken(d, 1, 2045).ruimtebeslag, 15);
});

// ------------------------------------------------- stap 4: template en formulier
const XLSX = createRequire(import.meta.url)('../vendor/xlsx.full.min.js');

function templateRoundtrip(data) {
  const d = normaliseer(kopie(data));
  const bytes = maatregelenTemplate(XLSX, d, d.maatregelen);
  const bladen = werkboekNaarBladen(XLSX, XLSX.read(bytes, { type: 'array' }));
  assert.deepEqual(Object.keys(bladen), ['Maatregelen', 'Uitleg', 'Lijsten']);
  assert.ok(isMaatregelenBestand(bladen));
  assert.deepEqual(maatregelenUitBladen(bladen), d.maatregelen);
}
test('roundtrip maatregelen-template: exporteren → importeren → identieke objecten (fictief voorbeeld)', () => templateRoundtrip(voorbeeld));
test('roundtrip maatregelen-template (werkdocument)', { skip: SKIP_WD }, () => templateRoundtrip(werkdocument));

test('maatregelen-template: leeg, met gegevensvalidatie, uitleg per kolom en lijsten uit de dataset', () => {
  const d = normaliseer(kopie(voorbeeld));
  const bytes = maatregelenTemplate(XLSX, d);
  const bladen = werkboekNaarBladen(XLSX, XLSX.read(bytes, { type: 'array' }));
  assert.deepEqual(maatregelenUitBladen(bladen), []);
  assert.deepEqual(bladen.Maatregelen[0], MAATREGEL_KOLOMMEN.map((k) => k.veld));
  // elke kolom heeft een uitlegregel
  const uitgelegd = new Set(bladen.Uitleg.slice(1).map((r) => r[0]));
  for (const k of MAATREGEL_KOLOMMEN) assert.ok(uitgelegd.has(k.veld), `uitleg voor ${k.veld}`);
  assert.deepEqual(MAATREGEL_VELDEN.map((v) => v.veld), MAATREGEL_KOLOMMEN.map((k) => k.veld).sort((a, b) => MAATREGEL_VELDEN.findIndex((v) => v.veld === a) - MAATREGEL_VELDEN.findIndex((v) => v.veld === b)));
  // lijsten: clusters (met "alle") en gemeenten uit de dataset
  const lijsten = templateLijsten(d);
  assert.deepEqual(lijsten.cluster, ['alle', ...d.clusters.map((c) => c.id)]);
  assert.deepEqual(lijsten.gemeente, d.gemeenten.map((g) => g.gemeente));
  const kop = bladen.Lijsten[0];
  assert.deepEqual(bladen.Lijsten.slice(1).map((r) => r[kop.indexOf('soort')]).filter(Boolean), ['waterlevering', 'waterbesparing']);
  // gegevensvalidatie staat in het bladbestand van Maatregelen
  const zip = XLSX.CFB.read(bytes, { type: 'array' });
  const blad = Buffer.from(zip.FileIndex[zip.FullPaths.findIndex((p) => p.endsWith('xl/worksheets/sheet1.xml'))].content).toString('utf8');
  const aantal = Number(blad.match(/<dataValidations count="(\d+)">/)?.[1]);
  assert.equal(aantal, Object.keys(lijsten).length + 6, 'één regel per keuzelijst plus zes getalcontroles');
  assert.match(blad, /<dataValidation type="list"[^>]*sqref="E2:E500"[^>]*><formula1>Lijsten!\$B\$2:\$B\$3<\/formula1>/);
  assert.match(blad, /<dataValidation type="whole" operator="between"[^>]*><formula1>2025<\/formula1><formula2>2050<\/formula2>/);
});

test('narratieven uit Excel: "1,2" dat als getal 1.2 is ingelezen blijft narratief 1 en 2', () => {
  const rij = maatregelNaarRij(maakMaatregel());
  assert.deepEqual(rijNaarMaatregel({ ...rij, narratieven: 1.2 }).narratieven, [1, 2]);
  assert.deepEqual(rijNaarMaatregel({ ...rij, narratieven: '1; 3 4' }).narratieven, [1, 3, 4]);
  assert.deepEqual(rijNaarMaatregel({ ...rij, narratieven: 3 }).narratieven, [3]);
});

test('cluster wijkt af van de koppeltabel: waarschuwing', () => {
  const d = normaliseer(kopie(voorbeeld));
  const g = d.gemeenten[0], ander = d.clusters.find((c) => c.id !== g.cluster).id;
  const ctx = contextVoorMaatregel(d);
  const m = maakMaatregel({ gemeente: g.gemeente, cluster: ander });
  assert.ok(valideerMaatregel(m, ctx).some((x) => x.niveau === 'waarschuwing' && x.veld === 'cluster' && /koppeltabel/.test(x.melding)));
  assert.ok(!valideerMaatregel({ ...m, cluster: g.cluster }, ctx).some((x) => x.veld === 'cluster'));
  assert.ok(!valideerMaatregel({ ...m, cluster: 'alle' }, ctx).some((x) => x.veld === 'cluster'));
});

test('formulier: melding → veld, id-voorstel, nieuwe maatregel en weergave (rij + tooltip)', () => {
  const velden = new Set(MAATREGEL_VELDEN.map((v) => v.veld));
  // elke melding op een lege waterlevering is aan een formulierveld te koppelen
  const leeg = { ...nieuweMaatregel('2026-01-01'), soort: 'waterlevering' };
  for (const x of valideerMaatregel(leeg, contextVoorMaatregel(voorbeeld))) assert.ok(velden.has(veldVanMelding(x.veld)), `veld bij melding "${x.veld}"`);
  assert.equal(veldVanMelding('overig effect 2'), 'overige_effecten');
  assert.equal(veldVanMelding('voetafdruk Natura 2000'), 'natura2000_beoordeling');
  assert.equal(maakId('  Nieuwe winning Écht-B (2) '), 'nieuwe-winning-echt-b-2');
  assert.deepEqual([leeg.leverancier, leeg.narratieven, leeg.standaard_aan, leeg.meta.datum], ['Vitens', [1, 2, 3, 4], true, '2026-01-01']);

  const w = maatregelWeergave(maakMaatregel({ volume: 2.5, naam: 'Een naam die duidelijk langer is dan vijfendertig tekens' }));
  assert.equal(w.waarde, '+2,5');
  assert.equal(w.naam.length, 35);
  assert.ok(w.teltMee);
  assert.ok(w.noten.some((n) => /vergunde capaciteit/.test(n)));
  assert.deepEqual(w.regels.find(([k]) => k === 'Cluster'), ['Cluster', 'alle clusters (naar vraagaandeel)']);
  const b = maatregelWeergave(maakMaatregel({ soort: 'waterbesparing', leverancier: 'Oasen', volume: 3 }));
  assert.equal(b.waarde, '−3,0');
  assert.ok(!b.teltMee && b.noten.some((n) => /Niet meegerekend/.test(n)));
  assert.ok(!b.regels.some(([k]) => k === 'Ruimtebeslag'));
});
