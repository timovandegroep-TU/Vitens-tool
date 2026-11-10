// Acceptatietests op de werkdocumentdata (private/data.json).
// Worden overgeslagen met een melding als dat bestand ontbreekt.
import test from 'node:test';
import assert from 'node:assert/strict';
import { aanbodBasis, aanbodWinningPeiljaren, bereken, samenvatting, vraagBasis, AANBODJAREN } from '../js/model.js';
import { valideer, telling } from '../js/schema.js';
import { werkdocument as data, SKIP_WD, bijna, allesUit } from './hulp.mjs';

const som = (o) => Object.values(o).reduce((a, b) => a + b, 0);

const AANBOD = {
  1: [132.7, 104.31, 92.265, 84.525],
  2: [132.7, 102.72, 90.765, 82.15],
  3: [132.7, 104.39, 88.33, 86.805],
  4: [132.7, 102.635, 87.1, 80.35],
};
// aanbod − vraag, totaal (tabblad Vergelijking naratieven): huidig, 2030, 2040, 2050
const SALDO = {
  1: [-5.764, -38.381, -56.625, -67.620],
  2: [-5.764, -44.349, -72.477, -95.774],
  3: [-5.764, -29.512, -43.645, -48.258],
  4: [-5.764, -35.443, -58.034, -78.438],
};

test('basislijn: totaal aanbod per narratief en peiljaar', { skip: SKIP_WD }, () => {
  for (const n of [1, 2, 3, 4]) {
    AANBODJAREN.forEach((jaar, i) => bijna(som(aanbodBasis(data, n, jaar)), AANBOD[n][i], `aanbod N${n} ${jaar}`));
  }
  const s = samenvatting(data);
  assert.equal(s.winningen, 32);
  bijna(s.aanbod[3][2], 88.33, 'samenvatting N3 2040');
});

test('basislijn: aanbod − vraag totaal (huidig = aanbod 2026 − vraag 2025)', { skip: SKIP_WD }, () => {
  for (const n of [1, 2, 3, 4]) {
    bijna(som(aanbodBasis(data, n, 2026)) - som(vraagBasis(data, n, 2025)), SALDO[n][0], `saldo N${n} huidig`);
    [2030, 2040, 2050].forEach((jaar, i) => {
      const r = bereken(data, n, jaar, allesUit(data));
      bijna(r.totaal.saldo, SALDO[n][i + 1], `saldo N${n} ${jaar}`);
      bijna(r.totaal.tekort, -SALDO[n][i + 1], `tekort N${n} ${jaar}`);
      bijna(som(Object.fromEntries(Object.entries(r.clusters).map(([k, c]) => [k, c.saldo]))), SALDO[n][i + 1], `som clusters N${n} ${jaar}`);
    });
  }
});

test('basislijn: Bilthoven, narratief 1', { skip: SKIP_WD }, () => {
  const w = data.winningen.find((x) => x.id === 'bilthoven');
  const a = aanbodWinningPeiljaren(data, 1, w);
  [1.2, 1.08, 1.08, 0.90].forEach((v, i) => bijna(a[i], v, `Bilthoven ${AANBODJAREN[i]}`));
});

test('basislijn: winning-id is uniek (Fledite ROL komt twee keer voor)', { skip: SKIP_WD }, () => {
  const ids = data.winningen.map((w) => w.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(data.winningen.filter((w) => w.locatie === 'Fledite ROL').length, 2);
});

test('maatregel: waterbesparing huishoudens narratief 1 = 19,356 in 2040, niet in 2039', { skip: SKIP_WD }, () => {
  const hh = data.maatregelen.filter((m) => m.id.startsWith('wd-besparing-huishoudens-n1-'));
  assert.equal(hh.length, 5);
  bijna(hh.reduce((a, m) => a + m.volume, 0), 19.356, 'som volumes (D26)');

  const aan = allesUit(data);
  for (const m of hh) aan[m.id] = true;
  const basis40 = bereken(data, 1, 2040, allesUit(data)), met40 = bereken(data, 1, 2040, aan);
  bijna(basis40.totaal.vraag - met40.totaal.vraag, 19.356, 'daling vraag 2040');
  bijna(met40.totaal.aanbod, basis40.totaal.aanbod, 'aanbod 2040 ongewijzigd');
  const basis39 = bereken(data, 1, 2039, allesUit(data)), met39 = bereken(data, 1, 2039, aan);
  bijna(met39.totaal.vraag, basis39.totaal.vraag, 'vraag 2039 ongewijzigd');
  // in een ander narratief tellen deze objecten niet mee
  bijna(bereken(data, 2, 2040, aan).totaal.besparing, 0, 'geen effect in narratief 2');
});

test('maatregelen uit het werkdocument: per narratief een eigen set, ingangsjaar 2040', { skip: SKIP_WD }, () => {
  for (const n of [1, 2, 3, 4]) {
    assert.equal(data.maatregelen.filter((m) => m.id.startsWith(`wd-besparing-huishoudens-n${n}-`) && m.narratieven.join() === String(n)).length, 5);
  }
  assert.ok(data.maatregelen.every((m) => m.ingangsjaar === 2040 && m.leverancier === 'Vitens'));
  const ruimte = data.maatregelen.filter((m) => m.id.startsWith('wd-ruimtegebruik-max-'));
  assert.equal(ruimte.length, 3);
  assert.ok(ruimte.every((m) => m.soort === 'waterlevering' && m.spoor === 'S2' && m.locatie === null && m.voetafdruk === null));
});

test('validatie: werkdocumentdata heeft geen blokkerende fouten, wel waarschuwingen', { skip: SKIP_WD }, () => {
  const meldingen = valideer(data);
  const fouten = meldingen.filter((m) => m.niveau === 'fout');
  assert.deepEqual(fouten, []);
  // Benschop: capaciteit 0 bij vergunning > 0
  assert.ok(meldingen.some((m) => m.tabel === 'Winningen' && m.rij === 'benschop' && m.veld === 'capaciteit'));
  // lege factoren natuur in narratief 2 en 3 (3 winningen elk)
  assert.equal(meldingen.filter((m) => m.tabel.startsWith('Reductiefactoren') && /Lege factor/.test(m.melding)).length, 6);
  // ruimtegebruik: onbekende leveringsvelden als waarschuwing
  assert.ok(meldingen.some((m) => m.rij === 'wd-ruimtegebruik-max-utrecht-west' && m.veld === 'locatie' && m.niveau === 'waarschuwing'));
  assert.ok(telling(meldingen).waarschuwingen > 0);
});
