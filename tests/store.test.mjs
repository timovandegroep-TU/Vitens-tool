// Import/export: dataset <-> tabbladen <-> .xlsx (SheetJS uit vendor/).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { normaliseer, valideer } from '../js/schema.js';
import {
  naarBladen, vanBladen, naarWerkboek, werkboekNaarBladen, leegTemplate, leesGetal, leesDatum,
  maatregelNaarRij, rijNaarMaatregel, voegMaatregelenSamen, isMaatregelenBestand, maatregelenUitBladen, controleerDataset,
} from '../js/store.js';
import { voorbeeld, kopie, maakMaatregel } from './hulp.mjs';

const XLSX = createRequire(import.meta.url)('../vendor/xlsx.full.min.js');
const zonderMeta = (d) => ({ ...d, meta: null });
const viaXlsx = (wb) => XLSX.read(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer' });

test('roundtrip dataset → .xlsx → dataset (voorbeelddata)', () => {
  const verwacht = normaliseer(kopie(voorbeeld));
  const direct = vanBladen(naarBladen(voorbeeld));
  assert.deepEqual(zonderMeta(direct.data), zonderMeta(verwacht), 'via rijen');
  assert.deepEqual(direct.opmerkingen, []);
  const terug = vanBladen(werkboekNaarBladen(XLSX, viaXlsx(naarWerkboek(XLSX, voorbeeld))));
  assert.deepEqual(zonderMeta(terug.data), zonderMeta(verwacht), 'via .xlsx');
});

test('leeg template: vier tabbladen plus Uitleg, weer in te lezen zonder fouten', () => {
  const wb = viaXlsx(leegTemplate(XLSX));
  assert.deepEqual(wb.SheetNames, ['Winningen', 'Vraag', 'Factoren', 'Maatregelen', 'Uitleg']);
  const { data, opmerkingen } = vanBladen(werkboekNaarBladen(XLSX, wb));
  assert.deepEqual(opmerkingen, []);
  assert.deepEqual([data.winningen, data.vraag, data.factoren, data.maatregelen], [[], [], [], []]);
  assert.deepEqual(valideer(data), []);
});

test('ontbrekende tabbladen worden gemeld', () => {
  const bladen = naarBladen(voorbeeld);
  delete bladen.Vraag;
  assert.equal(vanBladen(bladen).opmerkingen.length, 1);
});

test('maatregel ↔ rij: identiek object, ook met lastige tekst', () => {
  const m = normaliseer({ maatregelen: [maakMaatregel({
    omschrijving: 'Tekst met; puntkomma, komma en "aanhalingstekens"', winning: 'Lindewaard',
    overige_effecten: { politiek: 'Regel 1', lijst: [
      { label: 'Landbouw', beoordeling: 'aandacht', tekst: 'Droogteschade | met een streep' },
      { label: 'Woningbouw', beoordeling: 'kans', tekst: '' },
    ] },
  })] }).maatregelen[0];
  assert.deepEqual(rijNaarMaatregel(maatregelNaarRij(m)), m);
});

test('getallen en datums lezen (nl-NL)', () => {
  assert.equal(leesGetal('1,5'), 1.5);
  assert.equal(leesGetal('1.5'), 1.5);
  assert.equal(leesGetal('1.234,5'), 1234.5);
  assert.equal(leesGetal(' 0,75 '), 0.75);
  assert.equal(leesGetal(''), null);
  assert.equal(leesGetal('x'), 'x');                       // blijft tekst: validatie meldt "geen getal"
  assert.equal(leesDatum(46336), '2026-11-10');            // Excel-serienummer
  assert.equal(leesDatum('10-11-2026'), '2026-11-10');
});

test('maatregelen-bestand: nieuwe id toevoegen, bestaande overschrijven', () => {
  const data = normaliseer(kopie(voorbeeld));
  const bestaand = data.maatregelen[0].id, n = data.maatregelen.length;
  const bladen = { Maatregelen: naarBladen({ ...kopie(voorbeeld), maatregelen: [{ ...kopie(data.maatregelen[0]), volume: 9 }, maakMaatregel({ id: 'nieuw' })] }).Maatregelen };
  assert.ok(isMaatregelenBestand(bladen));
  assert.deepEqual(voegMaatregelenSamen(data, maatregelenUitBladen(bladen)), { toegevoegd: ['nieuw'], bijgewerkt: [bestaand] });
  assert.equal(data.maatregelen.length, n + 1);
  assert.equal(data.maatregelen[0].volume, 9);
});

test('json-import: alleen een dataset van deze tool, niet het oude formaat', () => {
  assert.equal(controleerDataset(voorbeeld), voorbeeld);
  assert.doesNotThrow(() => controleerDataset({ winningen: [] }));
  for (const fout of [null, [], 'tekst', 42, {}, { iets: 1 }, { winningen: {} }, { vraag: {} }, { maatregelen: [1] }]) {
    assert.throws(() => controleerDataset(fout), /geen dataset van deze tool/, JSON.stringify(fout));
  }
  assert.throws(() => controleerDataset({ narratieven: [], winningen: [] }), /oude formaat/);
});
