// Gedeelde hulpfuncties voor de tests.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

export const TOL = 0.001;
const pad = (rel) => fileURLToPath(new URL('../' + rel, import.meta.url));

/** Lees een JSON-bestand relatief aan de repo; null als het niet bestaat. */
export function laad(rel) {
  try { return JSON.parse(readFileSync(pad(rel), 'utf8')); } catch { return null; }
}

/** Fictieve voorbeelddata (data/voorbeeld.json), altijd in de repo. */
export const voorbeeld = laad('data/voorbeeld.json');

export function bijna(gevonden, verwacht, label = '') {
  assert.ok(Math.abs(gevonden - verwacht) <= TOL, `${label}: gevonden ${gevonden}, verwacht ${verwacht} (tolerantie ${TOL})`);
}

export const kopie = (x) => JSON.parse(JSON.stringify(x));

/** Alle schakelaars uit. */
export const allesUit = (data) => Object.fromEntries(data.maatregelen.map((m) => [m.id, false]));

/** Minimale geldige waterlevering; overschrijf velden naar behoefte. */
export function maakMaatregel(over = {}) {
  return {
    id: 'test-maatregel', naam: 'Testmaatregel', omschrijving: '', leverancier: 'Vitens',
    soort: 'waterlevering', spoor: 'S3', standaard_aan: true, status: 'idee',
    winning: null, cluster: 'alle', gemeente: 'Testdorp', locatie: { lat: 52.1, lon: 5.1 }, bron: 'grondwater',
    volume: 1, ruimtebeslag: 2, stroomvraag: 0.5, ingangsjaar: 2030,
    voetafdruk: {
      grondwater: { beoordeling: 'beperkt' }, beschermingszone: { beoordeling: 'buiten' },
      natura2000: { beoordeling: 'geen invloed' }, netcapaciteit: { beoordeling: 'voldoende' },
    },
    overige_effecten: { politiek: '', lijst: [] },
    meta: { aangeleverd_door: 'Test', datum: '2026-01-01', bron: 'Test' },
    ...over,
  };
}

/** Minimale waterbesparing of afname (zonder de velden die alleen bij levering horen). */
export const zonderLevering = (over = {}) => maakMaatregel({
  soort: 'waterbesparing', spoor: 'S0', gemeente: null, locatie: null, bron: null, ruimtebeslag: null, stroomvraag: null, voetafdruk: null, ...over,
});
