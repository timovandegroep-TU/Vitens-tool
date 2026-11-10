// Visualisatie: de pure onderdelen van het effectenpaneel (geen DOM).
import test from 'node:test';
import assert from 'node:assert/strict';
import { bereken } from '../js/model.js';
import { normaliseer } from '../js/schema.js';
import { effectenMaatregelen, effectenWinningen } from '../js/viz/effecten.js';
import { werkdocument, voorbeeld, SKIP_WD, kopie, bijna } from './hulp.mjs';

test('effecten maatregelen: alleen van maatregelen die in het zichtjaar meetellen, zwaarste eerst', () => {
  const d = normaliseer(kopie(voorbeeld));
  const m = d.maatregelen.find((x) => x.soort === 'waterlevering');
  const aan = { [m.id]: true };
  assert.deepEqual(effectenMaatregelen(d, bereken(d, 1, m.ingangsjaar - 1, aan), null), [], 'vóór het ingangsjaar');
  const lijst = effectenMaatregelen(d, bereken(d, 1, m.ingangsjaar, aan), null);
  assert.equal(lijst.length, m.overige_effecten.lijst.length + 4, 'overige effecten + vier voetafdrukthema\'s (geen daarvan is licht)');
  assert.ok(lijst.every((e) => e.groep === m.id && e.naam === m.gemeente));
  assert.deepEqual(lijst[0].punt, [m.locatie.lon, m.locatie.lat]);
  const niveaus = lijst.map((e) => e.niveau);
  assert.deepEqual(niveaus, [...niveaus].sort((a, b) => ['knelpunt', 'aandacht', 'kans', 'geen'].indexOf(a) - ['knelpunt', 'aandacht', 'kans', 'geen'].indexOf(b)));
  // uitgeschakeld of ander cluster: niets
  assert.deepEqual(effectenMaatregelen(d, bereken(d, 1, m.ingangsjaar, { [m.id]: false }), null), []);
  const ander = d.clusters.find((c) => c.id !== m.cluster).id;
  assert.deepEqual(effectenMaatregelen(d, bereken(d, 1, m.ingangsjaar, aan), ander), []);
});

test('effecten winningen: Bilthoven narratief 1 (10% afname in 2030, 25% in 2050)', { skip: SKIP_WD }, () => {
  const d = normaliseer(kopie(werkdocument));
  const vind = (jaar) => effectenWinningen(d, 1, jaar, null).find((e) => /bilthoven/i.test(e.naam));
  assert.equal(effectenWinningen(d, 1, 2030, null).length, d.winningen.length);
  const a = vind(2030), b = vind(2050), nu = vind(2026);
  bijna(a.afname, 0.12, 'afname 2030'); assert.equal(a.niveau, 'aandacht'); assert.equal(a.label, '−10%'); assert.match(a.tekst, /bindend: /);
  bijna(b.afname, 0.30, 'afname 2050'); assert.equal(b.niveau, 'knelpunt');
  assert.equal(nu.niveau, 'geen'); assert.equal(nu.inLijst, false);
  const uw = effectenWinningen(d, 1, 2030, 'utrecht-west');
  assert.ok(uw.length < d.winningen.length && uw.every((e) => d.winningen.find((w) => w.id === e.k).cluster === 'utrecht-west'));
  const afnames = effectenWinningen(d, 1, 2040, null).map((e) => e.afname);
  assert.deepEqual(afnames, [...afnames].sort((x, y) => y - x), 'grootste afname eerst');
});
