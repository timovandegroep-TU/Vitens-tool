// Visualisatie: de pure onderdelen van het effectenpaneel (geen DOM).
import test from 'node:test';
import assert from 'node:assert/strict';
import { bereken, scenarios } from '../js/model.js';
import { normaliseer } from '../js/schema.js';
import { effectenMaatregelen, effectenWinningen } from '../js/viz/effecten.js';
import { voorbeeld, kopie, bijna } from './hulp.mjs';

const d = normaliseer(kopie(voorbeeld));
const S = scenarios(d)[0].id;

test('effecten maatregelen: alleen van maatregelen die in het zichtjaar meetellen, zwaarste eerst', () => {
  const m = d.maatregelen.find((x) => x.soort === 'waterlevering' && x.locatie && x.leverancier === 'Vitens');
  const aan = { [m.id]: true };
  const eigen = (lijst) => lijst.filter((e) => e.groep === m.id);
  assert.deepEqual(eigen(effectenMaatregelen(d, bereken(d, S, m.ingangsjaar - 1, aan), null)), [], 'vóór het ingangsjaar');
  const lijst = eigen(effectenMaatregelen(d, bereken(d, S, m.ingangsjaar, aan), null));
  assert.ok(lijst.length > 0);
  assert.deepEqual(lijst[0].punt, [m.locatie.lon, m.locatie.lat]);
  const volgorde = ['knelpunt', 'aandacht', 'kans', 'geen'];
  const niveaus = lijst.map((e) => volgorde.indexOf(e.niveau));
  assert.deepEqual(niveaus, [...niveaus].sort((a, b) => a - b));
  assert.deepEqual(eigen(effectenMaatregelen(d, bereken(d, S, m.ingangsjaar, { [m.id]: false }), null)), []);
  // pin van een maatregel op een bestaande winning: coördinaten van de winning
  const opWinning = d.maatregelen.find((x) => x.winning && !x.locatie && x.soort === 'waterlevering');
  const w = d.winningen.find((x) => x.naam === opWinning.winning);
  const p = effectenMaatregelen(d, bereken(d, S, 2050, { [opWinning.id]: true }), null).find((e) => e.groep === opWinning.id);
  assert.deepEqual(p.punt, [w.lon, w.lat]);
});

test('effecten winningen: afname komt uit de afname-maatregelen die naar de winning verwijzen', () => {
  const af = d.maatregelen.find((x) => x.soort === 'afname');
  const w = d.winningen.find((x) => x.naam === af.winning);
  const vind = (jaar, aan) => effectenWinningen(d, bereken(d, S, jaar, aan), null).find((e) => e.naam === w.naam);
  assert.equal(effectenWinningen(d, bereken(d, S, 2030), null).length, d.winningen.length);
  assert.equal(vind(af.ingangsjaar - 1, { [af.id]: true }).niveau, 'geen');
  const na = vind(af.ingangsjaar, { [af.id]: true });
  bijna(na.afname, Math.min(w.capaciteit, af.volume), 'afname');
  assert.notEqual(na.niveau, 'geen');
  assert.match(na.tekst, new RegExp(af.naam.replace(/[()]/g, '.')));
  assert.equal(vind(af.ingangsjaar, { [af.id]: false }).afname, 0, 'afname uitgezet');
  const cl = effectenWinningen(d, bereken(d, S, 2050), w.cluster);
  assert.ok(cl.length < d.winningen.length && cl.every((e) => d.winningen.find((x) => x.naam === e.naam).cluster === w.cluster));
});
