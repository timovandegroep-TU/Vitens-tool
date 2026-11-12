// Factoren: invloeden op vraag of aanbod (temperatuur, PFAS, verzilting), instelbaar in de tool.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bereken, ingroei, factorEffect, standaardStanden, scenarios, clusters } from '../js/model.js';
import { normaliseer, valideer } from '../js/schema.js';
import { effectenWinningen } from '../js/viz/effecten.js';
import { voorbeeld, kopie, bijna } from './hulp.mjs';

const basis = normaliseer(kopie(voorbeeld));
const S = scenarios(basis)[0].id;
const CL = clusters(basis);
function met(...factoren) { const d = kopie(basis); d.maatregelen = []; d.factoren = factoren; return d; }
const leeg = met();
const F = (over) => ({ naam: 'F', groep: 'Test', werkt_op: 'vraag', bediening: 'schuif', effect: 10, van: 2030, tot: 2040, beginstand: 100, cluster: 'alle', winning: '', toelichting: '', ...over });

test('ingroei: 0 vóór van, lineair, 1 vanaf tot; van = tot is een stap', () => {
  assert.equal(ingroei(2030, 2040, 2029), 0);
  assert.equal(ingroei(2030, 2040, 2030), 0);
  assert.equal(ingroei(2030, 2040, 2035), 0.5);
  assert.equal(ingroei(2030, 2040, 2040), 1);
  assert.equal(ingroei(2030, 2030, 2029), 0);
  assert.equal(ingroei(2030, 2030, 2030), 1);
  assert.equal(factorEffect(F(), 0.5, 2035), 2.5);
});

test('beginstand: schuif = percentage, schakelaar = aan/uit, leeg = 100%', () => {
  const d = met(F({ naam: 'a', beginstand: 40 }), F({ naam: 'b', bediening: 'schakelaar', beginstand: 0 }), F({ naam: 'c', bediening: 'schakelaar', beginstand: 30 }), F({ naam: 'd', beginstand: null }));
  assert.deepEqual(standaardStanden(d), { a: 0.4, b: 0, c: 1, d: 1 });
});

test('vraagfactor op "alle": vraag omhoog naar vraagaandeel, opgave omhoog, aanbod gelijk', () => {
  const d = met(F());
  const b = bereken(leeg, S, 2035), m = bereken(d, S, 2035);
  bijna(m.totaal.vraag0 - b.totaal.vraag0, 5, 'halverwege de ingroei: +5');
  bijna(m.totaal.opgave - b.totaal.opgave, 5, 'opgave +5');
  bijna(m.totaal.aanbod0, b.totaal.aanbod0, 'aanbod gelijk');
  bijna(m.totaal.factorVraag, 5, 'factorVraag');
  for (const c of CL) bijna(m.clusters[c].vraag0 - b.clusters[c].vraag0, 5 * b.clusters[c].vraag0 / b.totaal.vraag0, c);
  // stand 0 = geen effect; stand 0,5 = half
  assert.deepEqual(bereken(d, S, 2035, {}, { F: 0 }).totaal, b.totaal);
  bijna(bereken(d, S, 2040, {}, { F: 0.5 }).totaal.vraag0 - bereken(leeg, S, 2040).totaal.vraag0, 5, 'stand 50%');
});

test('aanbodfactor op een cluster en op een winning: bestaand aanbod omlaag', () => {
  const c = CL[1];
  const w = basis.winningen.find((x) => x.cluster === CL[2] && x.capaciteit > 2);
  const d = met(F({ naam: 'cl', werkt_op: 'aanbod', effect: 4, van: 2030, tot: 2030, cluster: c }),
    F({ naam: 'win', werkt_op: 'aanbod', bediening: 'schakelaar', effect: 2, van: 2030, tot: 2030, cluster: '', winning: w.naam }));
  const b = bereken(leeg, S, 2031), m = bereken(d, S, 2031);
  bijna(b.clusters[c].aanbod0 - m.clusters[c].aanbod0, 4, 'cluster −4');
  bijna(b.clusters[w.cluster].aanbod0 - m.clusters[w.cluster].aanbod0, 2, 'cluster van de winning −2');
  bijna(m.totaal.factorAanbod, 6, 'factorAanbod');
  bijna(m.totaal.opgave - b.totaal.opgave, 6, 'opgave +6');
  assert.equal(m.factoren.win.winning, w.naam);
  // zichtbaar in de weergave Winningen
  const e = effectenWinningen(d, m, null).find((x) => x.naam === w.naam && x.k.endsWith(w.cluster));
  bijna(e.afname, 2, 'afname winning');
  assert.match(e.tekst, /win/);
  assert.equal(effectenWinningen(d, bereken(d, S, 2031, {}, { win: 0 }), null).find((x) => x.naam === w.naam).afname, 0);
});

test('validatie factoren', () => {
  const d = met(
    F({ naam: 'a' }), F({ naam: 'a' }),                                  // dubbele naam
    F({ naam: 'b', werkt_op: 'iets', bediening: '' }),
    F({ naam: 'c', effect: -1, van: 2040, tot: 2030, beginstand: 150 }),
    F({ naam: 'd', cluster: 'Nergens' }),
    F({ naam: 'e', winning: basis.winningen[0].naam }),                  // winning bij een vraagfactor
    F({ naam: 'f', werkt_op: 'aanbod', winning: 'Bestaat niet' }),
  );
  const fout = valideer(d).filter((m) => m.niveau === 'fout' && m.tabel === 'Factoren').map((m) => `${m.rij}:${m.veld}`);
  for (const x of ['a:naam', 'b:werkt_op', 'b:bediening', 'c:effect', 'c:tot', 'c:beginstand', 'd:cluster', 'e:winning', 'f:winning']) assert.ok(fout.includes(x), x);
  assert.deepEqual(valideer(normaliseer(kopie(voorbeeld))).filter((m) => m.tabel === 'Factoren'), []);
});
