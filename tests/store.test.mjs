// Import/export: dataset <-> tabbladen <-> .xlsx (SheetJS uit vendor/).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { normaliseer, valideer } from '../js/schema.js';
import {
  naarBladen, vanBladen, naarWerkboek, werkboekNaarBladen, leegTemplate, leesGetal, leesDatum,
  maatregelNaarRij, rijNaarMaatregel, voegMaatregelenSamen, isMaatregelenBestand, maatregelenUitBladen,
} from '../js/store.js';
import { werkdocument, voorbeeld, SKIP_WD, kopie, maakMaatregel } from './hulp.mjs';

const XLSX = createRequire(import.meta.url)('../vendor/xlsx.full.min.js');
const zonderMeta = (d) => ({ ...d, meta: null });
const viaXlsx = (wb) => XLSX.read(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer' });

function roundtrip(data, naam) {
  const verwacht = normaliseer(kopie(data));
  const direct = vanBladen(naarBladen(data));
  assert.deepEqual(zonderMeta(direct.data), zonderMeta(verwacht), `${naam}: via rijen`);
  assert.deepEqual(direct.opmerkingen, []);
  const terug = vanBladen(werkboekNaarBladen(XLSX, viaXlsx(naarWerkboek(XLSX, data))));
  assert.deepEqual(zonderMeta(terug.data), zonderMeta(verwacht), `${naam}: via .xlsx`);
  assert.deepEqual(terug.data.maatregelen, verwacht.maatregelen, `${naam}: identieke maatregel-objecten`);
}

test('roundtrip dataset → .xlsx → dataset (fictief voorbeeld)', () => roundtrip(voorbeeld, 'voorbeeld'));
test('roundtrip dataset → .xlsx → dataset (werkdocument)', { skip: SKIP_WD }, () => roundtrip(werkdocument, 'werkdocument'));

test('maatregel ↔ rij: identiek object, ook met lastige tekst', () => {
  const m = normaliseer({ ...kopie(voorbeeld), maatregelen: [maakMaatregel({
    omschrijving: 'Tekst met; puntkomma, komma en "aanhalingstekens"',
    overige_effecten: { politiek: 'Regel 1', lijst: [
      { label: 'Landbouw', beoordeling: 'aandacht', tekst: 'Droogteschade | met een streep' },
      { label: 'Woningbouw', beoordeling: 'kans', tekst: '' },
    ] },
  })] }).maatregelen[0];
  assert.deepEqual(rijNaarMaatregel(maatregelNaarRij(m)), m);
});

test('leeg template: alle tabbladen, en weer in te lezen zonder fouten in de structuur', () => {
  const wb = viaXlsx(leegTemplate(XLSX));
  for (const blad of ['Narratieven', 'Clusters', 'Gemeenten', 'Criteria', 'Winningen', 'Reductiefactoren N1',
    'Reductiefactoren N4', 'Vraag', 'Maatregelen', 'Uitleg']) assert.ok(wb.SheetNames.includes(blad), blad);
  const { data, opmerkingen } = vanBladen(werkboekNaarBladen(XLSX, wb));
  assert.deepEqual(opmerkingen, []);
  assert.equal(data.narratieven.length, 4);
  assert.equal(data.criteria.length, 9);
  assert.deepEqual(valideer(data).filter((m) => m.niveau === 'fout'), []);
});

test('ontbrekende tabbladen worden gemeld', () => {
  const bladen = naarBladen(voorbeeld);
  delete bladen.Vraag; delete bladen['Reductiefactoren N2'];
  const { opmerkingen } = vanBladen(bladen);
  assert.equal(opmerkingen.length, 2);
});

test('onbekende winning of criterium in een tabblad blijft zichtbaar voor de validatie', () => {
  const bladen = naarBladen(voorbeeld);
  bladen['Reductiefactoren N1'][0].push('verzonnen 2030');
  bladen['Reductiefactoren N1'][1].push(0.5);
  bladen['Reductiefactoren N1'].push(['spookwinning', 2]);
  const m = valideer(vanBladen(bladen).data).filter((x) => x.niveau === 'fout').map((x) => x.melding).join(' ');
  assert.match(m, /Onbekend criterium "verzonnen"/);
  assert.match(m, /Onbekende winning "spookwinning"/);
});

test('getallen en datums lezen (nl-NL)', () => {
  assert.equal(leesGetal('1,5'), 1.5);
  assert.equal(leesGetal('1.5'), 1.5);
  assert.equal(leesGetal('1.234,5'), 1234.5);
  assert.equal(leesGetal(' 0,75 '), 0.75);
  assert.equal(leesGetal(''), null);
  assert.equal(leesGetal(null), null);
  assert.equal(leesGetal('x'), 'x');                       // blijft tekst: validatie meldt "geen getal"
  assert.equal(leesDatum(46336), '2026-11-10');            // Excel-serienummer
  assert.equal(leesDatum('10-11-2026'), '2026-11-10');
  assert.equal(leesDatum('2026-11-10'), '2026-11-10');
});

test('maatregelen-bestand: nieuwe id toevoegen, bestaande overschrijven', () => {
  const data = normaliseer(kopie(voorbeeld));
  const bestaand = data.maatregelen[0].id;
  const bladen = { Maatregelen: naarBladen({ ...kopie(voorbeeld), maatregelen: [
    { ...kopie(data.maatregelen[0]), volume: 9 }, maakMaatregel({ id: 'nieuw' }),
  ] }).Maatregelen };
  assert.ok(isMaatregelenBestand(bladen));
  const uit = voegMaatregelenSamen(data, maatregelenUitBladen(bladen));
  assert.deepEqual(uit, { toegevoegd: ['nieuw'], bijgewerkt: [bestaand] });
  assert.equal(data.maatregelen.length, 3);
  assert.equal(data.maatregelen[0].volume, 9);
});
