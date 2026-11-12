// Validatieregels (js/schema.js) op de fictieve voorbeelddata.
import test from 'node:test';
import assert from 'node:assert/strict';
import { valideer, valideerMaatregel, normaliseer } from '../js/schema.js';
import { voorbeeld, kopie, maakMaatregel, zonderLevering } from './hulp.mjs';

const ctx = { clusters: new Set(['West', 'Oost']), winningen: new Map() };
const heeft = (meldingen, niveau, veld) => meldingen.some((m) => m.niveau === niveau && m.veld === veld);
const fouten = (meldingen) => meldingen.filter((m) => m.niveau === 'fout');

test('voorbeelddata: geen blokkerende fouten', () => {
  assert.deepEqual(fouten(valideer(normaliseer(kopie(voorbeeld)))), []);
});

test('basisdata, blokkerend', () => {
  const d = normaliseer(kopie(voorbeeld));
  const [s0] = [d.vraag[0].scenario];
  d.vraag.push({ ...d.vraag[0] });                                   // dubbele scenario × cluster
  d.vraag[1]['2035'] = null;                                         // ontbrekende vraag
  d.vraag[2]['2040'] = 'veel';                                       // geen getal
  d.vraag.push({ scenario: 'Nieuw', cluster: d.vraag[0].cluster, 2025: 1, 2030: 1, 2035: 1, 2040: 1, 2045: 1, 2050: 1 }); // mist de andere clusters
  d.winningen[0].cluster = 'Nergens';                                // cluster zonder vraag
  d.winningen[1].naam = d.winningen[2].naam;                          // dubbele naam
  d.winningen[3].capaciteit = -1;
  const m = valideer(d);
  const zoek = (tabel, re) => assert.ok(m.some((x) => x.niveau === 'fout' && x.tabel === tabel && re.test(x.melding)), `${tabel}: ${re}`);
  zoek('Vraag', /Dubbele rij/);
  zoek('Vraag', /ontbreekt/);
  zoek('Vraag', /geen getal/);
  zoek('Vraag', /Scenario "Nieuw" heeft geen rij/);
  zoek('Winningen', /Geen vraag voor cluster "Nergens"/);
  zoek('Winningen', /Dubbele naam/);
  zoek('Winningen', /negatief/);
  assert.ok(s0);
});

test('basisdata, waarschuwing: winning zonder coördinaten', () => {
  const d = normaliseer(kopie(voorbeeld));
  d.winningen[0].lat = null;
  const m = valideer(d);
  assert.ok(m.some((x) => x.niveau === 'waarschuwing' && x.tabel === 'Winningen' && x.rij === d.winningen[0].naam && /coördinaten/.test(x.melding)));
});

test('maatregel: volledige waterlevering en waterbesparing zijn geldig', () => {
  assert.deepEqual(valideerMaatregel(maakMaatregel({ cluster: 'West' }), ctx), []);
  assert.deepEqual(valideerMaatregel(zonderLevering(), ctx), []);
});

test('maatregel, blokkerend', () => {
  const v = (over) => valideerMaatregel(maakMaatregel({ cluster: 'West', ...over }), ctx);
  assert.ok(heeft(v({ naam: '' }), 'fout', 'naam'));
  assert.ok(heeft(v({ soort: 'iets' }), 'fout', 'soort'));
  assert.ok(heeft(v({ gemeente: null }), 'fout', 'gemeente'));                   // verplicht bij levering zonder winning
  assert.ok(heeft(v({ ingangsjaar: 2024 }), 'fout', 'ingangsjaar'));
  assert.ok(heeft(v({ ingangsjaar: 2051 }), 'fout', 'ingangsjaar'));
  assert.ok(heeft(v({ volume: -1 }), 'fout', 'volume'));
  assert.ok(heeft(v({ volume: 'veel' }), 'fout', 'volume'));
  assert.ok(heeft(v({ locatie: { lat: 5.1, lon: 52.1 } }), 'fout', 'locatie'));  // lat/lon verwisseld
  assert.ok(heeft(v({ locatie: null }), 'fout', 'locatie'));
  assert.ok(heeft(v({ cluster: 'Noordpool' }), 'fout', 'cluster'));
  assert.ok(heeft(v({ voetafdruk: null }), 'fout', 'voetafdruk Grondwater'));
  assert.ok(heeft(v({ meta: { aangeleverd_door: '', datum: '2026-01-01', bron: 'x' } }), 'fout', 'aangeleverd door'));
  assert.ok(heeft(v({ meta: { aangeleverd_door: 'x', datum: '2026-01-01', bron: ' ' } }), 'fout', 'bron (document)'));
});

test('maatregel, waarschuwing', () => {
  const v = (over) => valideerMaatregel(maakMaatregel({ cluster: 'West', ...over }), ctx);
  const groot = v({ volume: 5000000 });
  assert.ok(heeft(groot, 'waarschuwing', 'volume') && fouten(groot).length === 0);
  const oasen = v({ leverancier: 'Oasen' });
  assert.ok(heeft(oasen, 'waarschuwing', 'leverancier') && fouten(oasen).length === 0);
  const onbekend = v({ voetafdruk: { ...maakMaatregel().voetafdruk, natura2000: { beoordeling: 'onbekend' } } });
  assert.ok(heeft(onbekend, 'waarschuwing', 'voetafdruk Natura 2000') && fouten(onbekend).length === 0);
});
