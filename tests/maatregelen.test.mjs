// Acceptatietests voor de rekenregels van maatregelen.
// Draaien op de werkdocumentdata als die er is, anders op het fictieve voorbeeld.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bereken, standaardAan, volumeInJaar, maatregelStatus } from '../js/model.js';
import { werkdocument, voorbeeld, bijna, kopie, maakMaatregel } from './hulp.mjs';

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

test.todo('roundtrip maatregelen-template: exporteren → importeren → identieke objecten (stap 4, js/store.js)');
