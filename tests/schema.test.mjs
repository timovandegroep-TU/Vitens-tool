// Validatieregels (js/schema.js) op het fictieve voorbeeld.
import test from 'node:test';
import assert from 'node:assert/strict';
import { valideer, valideerMaatregel } from '../js/schema.js';
import { voorbeeld, kopie, maakMaatregel } from './hulp.mjs';

const ctx = { clusters: new Set(['cluster-oost', 'cluster-west']), gemeenten: new Set(['Waterdorp']), narratieven: new Set(['1', '2', '3', '4']) };
const heeft = (meldingen, niveau, veld) => meldingen.some((m) => m.niveau === niveau && m.veld === veld);
const fouten = (meldingen) => meldingen.filter((m) => m.niveau === 'fout');

test('fictief voorbeeld: geen blokkerende fouten', () => {
  assert.deepEqual(fouten(valideer(voorbeeld)), []);
});

test('basisdata, blokkerend', () => {
  const d = kopie(voorbeeld);
  d.reductiefactoren['1']['bronhuizen']['natuur'] = [1.5, 'abc', -0.1];       // buiten [0,1] en niet-numeriek
  d.reductiefactoren['1']['bronhuizen']['bestaat-niet'] = [1, 1, 1];          // onbekend criterium
  d.reductiefactoren['1']['geen-winning'] = {};                               // onbekende winning
  d.reductiefactoren['9'] = {};                                               // onbekend narratief
  d.winningen[0].cluster = 'cluster-noord';                                   // onbekend cluster
  d.winningen.push({ ...d.winningen[1] });                                    // dubbele id
  d.winningen[1].capaciteit = 'veel';                                         // niet-numeriek
  delete d.vraag['2']['cluster-west']['2035'];                                // ontbrekende vraag
  const m = valideer(d);
  const zoek = (tabel, re) => assert.ok(m.some((x) => x.niveau === 'fout' && x.tabel === tabel && re.test(x.melding)), `${tabel}: ${re}`);
  zoek('Reductiefactoren N1', /buiten 0–1/);
  zoek('Reductiefactoren N1', /geen getal/);
  zoek('Reductiefactoren N1', /Onbekend criterium/);
  zoek('Reductiefactoren N1', /Onbekende winning/);
  zoek('Reductiefactoren N9', /Onbekend narratief/);
  zoek('Winningen', /Onbekend cluster/);
  zoek('Winningen', /Dubbele id/);
  zoek('Winningen', /geen getal/);
  zoek('Vraag', /Vraag ontbreekt/);
  assert.equal(m.filter((x) => x.niveau === 'fout' && x.tabel === 'Reductiefactoren N1' && /buiten 0–1/.test(x.melding)).length, 2);
});

test('basisdata, waarschuwing', () => {
  const d = kopie(voorbeeld);
  d.winningen[0].lat = null;
  d.winningen[1].capaciteit = 0;
  const m = valideer(d);
  assert.deepEqual(fouten(m), []);
  assert.ok(m.some((x) => x.niveau === 'waarschuwing' && x.rij === 'waterdorp-noord' && /coördinaten/.test(x.melding)));
  assert.ok(m.some((x) => x.niveau === 'waarschuwing' && x.rij === 'bronhuizen' && /Capaciteit is 0/.test(x.melding)));
  assert.ok(m.some((x) => x.niveau === 'waarschuwing' && x.tabel === 'Reductiefactoren N1' && x.rij === 'bronhuizen' && x.veld === 'bodemdaling' && /2040/.test(x.melding)));
});

test('maatregel: volledige waterlevering en waterbesparing zijn geldig', () => {
  assert.deepEqual(valideerMaatregel(maakMaatregel({ gemeente: 'Waterdorp', cluster: 'cluster-oost' }), ctx), []);
  const besparing = maakMaatregel({ soort: 'waterbesparing', spoor: 'S0', locatie: null, gemeente: null, bron: null, ruimtebeslag: null, stroomvraag: null, voetafdruk: null });
  assert.deepEqual(valideerMaatregel(besparing, ctx), []);
});

test('maatregel, blokkerend', () => {
  const v = (over) => valideerMaatregel(maakMaatregel({ gemeente: 'Waterdorp', cluster: 'cluster-oost', ...over }), ctx);
  assert.ok(heeft(v({ naam: '' }), 'fout', 'naam'));
  assert.ok(heeft(v({ soort: 'iets' }), 'fout', 'soort'));
  assert.ok(heeft(v({ gemeente: 'Nergenshuizen' }), 'fout', 'gemeente'));
  assert.ok(heeft(v({ gemeente: null }), 'fout', 'gemeente'));                 // verplicht bij levering
  assert.ok(heeft(v({ ingangsjaar: 2024 }), 'fout', 'ingangsjaar'));
  assert.ok(heeft(v({ ingangsjaar: 2051 }), 'fout', 'ingangsjaar'));
  assert.ok(heeft(v({ volume: -1 }), 'fout', 'volume'));
  assert.ok(heeft(v({ volume: 'veel' }), 'fout', 'volume'));
  assert.ok(heeft(v({ locatie: { lat: 5.1, lon: 52.1 } }), 'fout', 'locatie'));  // lat/lon verwisseld
  assert.ok(heeft(v({ locatie: null }), 'fout', 'locatie'));
  assert.ok(heeft(v({ cluster: 'cluster-noord' }), 'fout', 'cluster'));
  assert.ok(heeft(v({ narratieven: [] }), 'fout', 'narratieven'));
  assert.ok(heeft(v({ voetafdruk: null }), 'fout', 'voetafdruk Grondwater'));
  assert.ok(heeft(v({ meta: { aangeleverd_door: '', datum: '2026-01-01', bron: 'x' } }), 'fout', 'aangeleverd door'));
  assert.ok(heeft(v({ meta: { aangeleverd_door: 'x', datum: '2026-01-01', bron: ' ' } }), 'fout', 'bron (document)'));
});

test('maatregel, waarschuwing', () => {
  const v = (over) => valideerMaatregel(maakMaatregel({ gemeente: 'Waterdorp', cluster: 'cluster-oost', ...over }), ctx);
  const groot = v({ volume: 5000000 });
  assert.ok(heeft(groot, 'waarschuwing', 'volume') && fouten(groot).length === 0);
  const oasen = v({ leverancier: 'Oasen' });
  assert.ok(heeft(oasen, 'waarschuwing', 'leverancier') && fouten(oasen).length === 0);
  const onbekend = v({ voetafdruk: { ...maakMaatregel().voetafdruk, natura2000: { beoordeling: 'onbekend' } } });
  assert.ok(heeft(onbekend, 'waarschuwing', 'voetafdruk Natura 2000') && fouten(onbekend).length === 0);
});

test('maatregel: onvolledig aangeleverd (werkdocument) geeft waarschuwingen, geen fouten', () => {
  const m = maakMaatregel({
    cluster: 'cluster-oost', locatie: null, gemeente: null, bron: null, ruimtebeslag: null, stroomvraag: null, voetafdruk: null,
    meta: { aangeleverd_door: 'Vitens', datum: '2026-01-01', bron: 'werkdocument', onvolledig: true },
  });
  const r = valideerMaatregel(m, ctx);
  assert.deepEqual(fouten(r), []);
  for (const veld of ['locatie', 'gemeente', 'bron', 'ruimtebeslag', 'stroomvraag', 'voetafdruk Netcapaciteit']) {
    assert.ok(heeft(r, 'waarschuwing', veld), veld);
  }
});
