// Snapshot van de fictieve voorbeelddata (data/voorbeeld.json): bewaakt dat het rekenmodel
// op een vaste dataset dezelfde uitkomsten blijft geven. Bij een bewuste wijziging van het
// model of van de voorbeelddata: draai `node tests/voorbeeld.test.mjs --bijwerken`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { bereken, standaardAan, scenarios } from '../js/model.js';
import { normaliseer, valideer } from '../js/schema.js';
import { controleerDataset } from '../js/store.js';
import { laad, kopie, allesUit, TOL } from './hulp.mjs';

const SNAPSHOT = 'tests/voorbeeld.snapshot.json';
const data = normaliseer(controleerDataset(kopie(laad('data/voorbeeld.json'))));
const rond = (v) => Math.round(v * 1000) / 1000;
const VELDEN = ['vraag0', 'aanbod0', 'vraag', 'aanbod', 'afname', 'opgave', 'bijdrage', 'tekort'];

/** Uitkomsten per scenario en peiljaar: zonder maatregelen, met de standaardset en per cluster. */
function maak() {
  const uit = {};
  for (const n of scenarios(data).map((x) => x.id)) {
    for (const jaar of [2026, 2030, 2035, 2040, 2050]) {
      const basis = bereken(data, n, jaar, allesUit(data)).totaal;
      const r = bereken(data, n, jaar, standaardAan(data));
      uit[`${n} ${jaar}`] = {
        zonder: { vraag: rond(basis.vraag), aanbod: rond(basis.aanbod) },
        standaard: Object.fromEntries(VELDEN.map((v) => [v, rond(r.totaal[v])])),
        clusters: Object.fromEntries(Object.entries(r.clusters).map(([c, x]) => [c, { vraag: rond(x.vraag), aanbod: rond(x.aanbod) }])),
      };
    }
  }
  return uit;
}

if (process.argv.includes('--bijwerken')) {
  writeFileSync(fileURLToPath(new URL('../' + SNAPSHOT, import.meta.url)), JSON.stringify(maak(), null, 1) + '\n');
  console.log(`${SNAPSHOT} bijgewerkt`);
}

function vergelijk(gevonden, verwacht, pad) {
  if (typeof verwacht === 'number') {
    assert.ok(Math.abs(gevonden - verwacht) <= TOL, `${pad}: gevonden ${gevonden}, verwacht ${verwacht}`);
    return;
  }
  assert.deepEqual(Object.keys(gevonden ?? {}).sort(), Object.keys(verwacht).sort(), pad);
  for (const k of Object.keys(verwacht)) vergelijk(gevonden[k], verwacht[k], `${pad} › ${k}`);
}

test('voorbeelddata: fictief gemarkeerd, alleen de bedoelde waarschuwing (Oasen)', () => {
  assert.equal(data.meta.voorbeelddata, true);
  assert.deepEqual(valideer(data).map((m) => `${m.niveau} ${m.rij} ${m.veld}`), ['waarschuwing oasen-levering-west leverancier']);
  assert.ok(data.maatregelen.length >= 10);
  for (const soort of ['waterlevering', 'waterbesparing', 'afname']) assert.ok(data.maatregelen.some((m) => m.soort === soort), soort);
});

test('voorbeelddata: uitkomsten gelijk aan de snapshot', () => {
  const snapshot = laad(SNAPSHOT);
  assert.ok(snapshot, `${SNAPSHOT} ontbreekt: draai node tests/voorbeeld.test.mjs --bijwerken`);
  vergelijk(maak(), snapshot, 'snapshot');
});

test('voorbeelddata: de vraagscenario\'s lopen uiteen in 2050 en er is een opgave', () => {
  const vraag = scenarios(data).map((x) => bereken(data, x.id, 2050, allesUit(data)).totaal.vraag0);
  assert.ok(Math.max(...vraag) - Math.min(...vraag) > 10);
  for (const x of scenarios(data)) assert.ok(bereken(data, x.id, 2050, standaardAan(data)).totaal.opgave > 0, x.id);
});
