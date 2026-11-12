// Visualisatie: laadt de dataset, houdt de stand bij en stuurt de panelen aan.
import { bereken, standaardAan, scenarios, JAAR_MIN, JAAR_MAX } from '../model.js';
import { normaliseer, valideer, telling } from '../schema.js';
import { laadOpgeslagen, controleerDataset } from '../store.js';
import { START_ZICHTJAAR } from '../config.js';
import * as scenario from './scenario.js';
import * as maatregelen from './maatregelen.js';
import * as opgave from './opgave.js';
import * as effecten from './effecten.js';
import { hideTip, ververs } from './tooltip.js';

const $ = (s) => document.querySelector(s);
const VOORBEELD = 'data/voorbeeld.json';      // fictieve data, getoond zolang er geen eigen dataset is

/** Stage van 1600×900 die meeschaalt met het venster (uit de mockup). */
function fit() {
  const s = Math.min(innerWidth / 1600, innerHeight / 900), st = $('#stage');
  st.style.transform = `scale(${s})`;
  st.style.left = ((innerWidth - 1600 * s) / 2) + 'px'; st.style.top = ((innerHeight - 900 * s) / 2) + 'px';
}
addEventListener('resize', fit);
fit();

/** Dataset uit deze browser (ingevoerd op invoer.html); anders het fictieve voorbeeld. */
async function laadData() {
  const eigen = laadOpgeslagen();
  if (eigen?.winningen.length && eigen.vraag.length) return { data: eigen, voorbeeld: false };
  const antwoord = await fetch(VOORBEELD);
  if (!antwoord.ok) throw new Error(`${VOORBEELD}: ${antwoord.status}`);
  return { data: normaliseer(controleerDataset(await antwoord.json())), voorbeeld: true };
}

function toonMelding(...inhoud) {
  document.querySelectorAll('#stage .panel').forEach((p) => { p.hidden = true; });
  const m = $('#melding'); m.hidden = false; m.replaceChildren(...inhoud);
}

function start({ data, voorbeeld }) {
  const meldingen = valideer(data);
  // Maatregelen met blokkerende fouten tellen niet mee (OPEN-VRAGEN G2)
  const geblokkeerd = new Set(meldingen.filter((m) => m.niveau === 'fout' && m.tabel === 'Maatregelen').map((m) => m.rij));
  const basisfouten = telling(meldingen.filter((m) => m.tabel !== 'Maatregelen')).fouten;

  const state = {};
  const begin = () => Object.assign(state, {
    scenario: scenarios(data)[0]?.id ?? '', jaar: START_ZICHTJAAR, cluster: null, aan: standaardAan(data),
    show: { vraag: true, aanbod: true, zonder: true, reserve: false }, view: 'chart', effecten: 'maatregelen',
  });
  let cache = new Map();
  const app = {
    data, state, geblokkeerd,
    /** Uitkomst van het rekenmodel voor een jaar (gecachet tot de volgende update). */
    resultaat(jaar = state.jaar, scenario = state.scenario) {
      const sleutel = `${scenario}|${jaar}`;
      if (!cache.has(sleutel)) {
        const aan = Object.fromEntries(data.maatregelen.map((m) => [m.id, !!state.aan[m.id] && !geblokkeerd.has(m.id)]));
        cache.set(sleutel, bereken(data, scenario, jaar, aan));
      }
      return cache.get(sleutel);
    },
    /** Cijfers voor het gekozen beeld (totaal of één cluster) in een jaar. */
    zicht(jaar, scenario) { const r = app.resultaat(jaar, scenario); return { ...(state.cluster ? r.clusters[state.cluster] : r.totaal), jaar }; },
    clusterNaam: () => state.cluster ?? 'Totaal',
    /** Wijzig de stand en teken opnieuw. */
    kies(wijziging) {
      const lijstAnders = 'cluster' in wijziging && wijziging.cluster !== state.cluster;
      Object.assign(state, wijziging);
      state.jaar = Math.max(JAAR_MIN, Math.min(JAAR_MAX, state.jaar));
      if (lijstAnders) { hideTip(); maatregelen.bouw(app); }
      app.update();
    },
    update() {
      cache = new Map();
      const c = app.zicht(state.jaar);
      document.querySelectorAll('.yr').forEach((e) => { e.textContent = state.jaar; });
      scenario.render(app, c); maatregelen.render(app); opgave.render(app, c); effecten.render(app);
      ververs();
    },
  };

  // kop: datasetnaam of VOORBEELDDATA, en een waarschuwing bij fouten in de basisdata
  const badge = $('#badge');
  const isVoorbeeld = voorbeeld || data.meta.voorbeelddata;
  badge.textContent = isVoorbeeld ? 'Voorbeelddata' : (data.meta.naam || 'Dataset') + (data.meta.datum_import ? ` · ${data.meta.datum_import.split('-').reverse().join('-')}` : '');
  badge.classList.toggle('naam', !isVoorbeeld);
  badge.title = isVoorbeeld ? 'Alle cijfers, maatregelen en effecten zijn fictief. Voer eigen data in via Invoer.' : `Dataset uit deze browser${data.meta.datum_import ? ', geïmporteerd op ' + data.meta.datum_import.split('-').reverse().join('-') : ''}`;
  if (basisfouten) {
    const a = document.createElement('a');
    a.className = 'badge fout'; a.href = 'invoer.html';
    a.textContent = `${basisfouten} fout${basisfouten > 1 ? 'en' : ''} in basisdata`;
    a.title = 'De basisdata bevat blokkerende fouten; de cijfers kunnen onjuist zijn. Open Invoer om ze op te lossen.';
    $('#fouten').replaceChildren(a);
  }
  $('#bronregel').textContent = isVoorbeeld ? 'Fictieve voorbeelddata' : `Data: ${data.meta.naam ?? ''}`;

  begin();
  scenario.bouw(app); maatregelen.bouw(app); opgave.bouw(app); effecten.bouw(app);
  app.update();
  $('#reset').addEventListener('click', () => { hideTip(); opgave.speel(false); begin(); maatregelen.bouw(app); app.update(); });
}

laadData().then(start).catch((e) => {
  console.error(e);
  const a = document.createElement('a'); a.href = 'invoer.html'; a.textContent = 'Naar Invoer';
  toonMelding('De dataset kon niet worden geladen. ', a);
});
