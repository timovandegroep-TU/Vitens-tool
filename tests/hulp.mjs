// Gedeelde hulpfuncties voor de tests.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

export const TOL = 0.001;
const pad = (rel) => fileURLToPath(new URL('../' + rel, import.meta.url));

/** Lees een JSON-bestand relatief aan de repo; null als het niet bestaat. */
export function laad(rel) {
  return existsSync(pad(rel)) ? JSON.parse(readFileSync(pad(rel), 'utf8')) : null;
}

/** Werkdocumentdata (private/data.json); ontbreekt in een schone checkout. */
export const werkdocument = laad('private/data.json');
export const SKIP_WD = werkdocument ? false
  : 'private/data.json ontbreekt: draai eerst tools/convert_werkdocument.py (tests met werkdocumentdata overgeslagen)';

/** Fictief voorbeeld dat altijd in de repo staat. */
export const voorbeeld = laad('docs/datamodel-voorbeeld.json');

export function bijna(gevonden, verwacht, label = '') {
  assert.ok(Math.abs(gevonden - verwacht) <= TOL, `${label}: gevonden ${gevonden}, verwacht ${verwacht} (tolerantie ${TOL})`);
}

export const kopie = (x) => JSON.parse(JSON.stringify(x));

/** Alle schakelaars uit. */
export const allesUit = (data) => Object.fromEntries(data.maatregelen.map((m) => [m.id, false]));

/** Minimale geldige maatregel; overschrijf velden naar behoefte. */
export function maakMaatregel(over = {}) {
  return {
    id: 'test-maatregel', naam: 'Testmaatregel', omschrijving: '', leverancier: 'Vitens',
    soort: 'waterlevering', spoor: 'S3', narratieven: [1, 2, 3, 4], standaard_aan: true, status: 'idee',
    locatie: { lat: 52.1, lon: 5.1 }, gemeente: null, cluster: 'alle', bron: 'grondwater',
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
