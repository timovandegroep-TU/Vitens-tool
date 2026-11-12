// Formulier "Maatregel aanleveren": één maatregel-dataobject invullen of bewerken,
// met validatie per veld en een preview van de rij en tooltip in de visualisatie.
import { el, toon } from './dom.js';
import {
  MAATREGEL_BLOKKEN, MAATREGEL_VELDEN, VOETAFDRUK, KEUZES, valideerMaatregel, contextVoorMaatregel,
  veldVanMelding, maatregelWeergave, normaliseerMaatregel, maakId, telling,
} from './schema.js';
import { ALLE_CLUSTERS, clusters } from './model.js';
import { leesGetal, maatregelNaarRij, rijNaarMaatregel } from './store.js';

/**
 * @param opties { data, maatregel, nieuw: bool, opslaan(m), annuleer() }
 *   `maatregel` wordt niet gewijzigd; `opslaan` krijgt een genormaliseerd object.
 * @returns het formulier-element; `element.focusVeld(veld)` zet de focus op een veld.
 */
export function bouwFormulier({ data, maatregel, nieuw, opslaan, annuleer }) {
  // Het formulier werkt op de platte rij van het template (één waarde per veld), plus de lijst met effecten.
  const start = normaliseerMaatregel(maatregel);
  const rij = maatregelNaarRij(start);
  let effecten = start.overige_effecten.lijst.map((e) => ({ ...e }));
  let idAangeraakt = !nieuw || !!rij.id;
  const ctx = contextVoorMaatregel(data);
  const andereIds = new Set(data.maatregelen.map((m) => m.id).filter((id) => nieuw || id !== start.id));
  // Velden die alleen bij een waterlevering horen, zijn verborgen bij besparing en afname.
  const geenLevering = () => !!rij.soort && rij.soort !== 'waterlevering';
  const soortNaam = () => (rij.soort === 'afname' ? 'afname' : 'waterbesparing');

  /** Huidige stand als dataobject. Bij besparing en afname vervallen de velden die alleen voor levering gelden. */
  function object() {
    const r = { ...rij, overige_effecten: '' };
    if (geenLevering()) for (const v of MAATREGEL_VELDEN) if (v.alleenLevering) r[v.veld] = null;
    const m = rijNaarMaatregel(r);
    m.overige_effecten.lijst = effecten.map((e) => ({ label: (e.label ?? '').trim(), beoordeling: e.beoordeling || null, tekst: (e.tekst ?? '').trim() }));
    return m;
  }
  function meldingen(m) {
    const uit = valideerMaatregel(m, ctx);
    if (m.id && andereIds.has(m.id)) uit.unshift({ niveau: 'fout', tabel: 'Maatregelen', rij: m.id, veld: 'id', melding: `Id "${m.id}" bestaat al. Kies een ander id, of bewerk de bestaande maatregel.` });
    return uit;
  }

  const form = el('form', { class: 'mform', novalidate: true });
  const preview = el('aside', { class: 'mpreview', 'aria-label': 'Preview' });
  const voet = el('div', { class: 'mvoet' });

  // ------------------------------------------------------------ velden
  const opties = (v) => (v.veld === 'winning' ? data.winningen.map((w) => w.naam).filter(Boolean)
    : v.veld === 'cluster' ? [ALLE_CLUSTERS, ...clusters(data)] : v.keuzes);
  const optieLabel = (v, o) => (v.veld === 'cluster' && o === ALLE_CLUSTERS ? 'alle clusters' : o);

  function invoer(v) {
    const id = `mf-${v.veld}`, huidig = rij[v.veld];
    const zet = (waarde) => { rij[v.veld] = waarde; gewijzigd(v); };
    if (v.type === 'keuze' || v.type === 'ref') {
      const s = el('select', { id, 'data-veld': v.veld });
      s.append(el('option', { value: '', text: v.verplicht ? '– kies –' : '' }));
      const lijst = opties(v);
      for (const o of lijst) s.append(el('option', { value: o, text: optieLabel(v, o) }));
      if (huidig && !lijst.includes(huidig)) s.append(el('option', { value: huidig, text: `${huidig} (onbekend)` }));
      s.value = huidig ?? '';
      s.addEventListener('change', () => zet(s.value || null));
      return s;
    }
    if (v.type === 'janee') {
      const c = el('input', { id, type: 'checkbox', 'data-veld': v.veld });
      c.checked = huidig === 'ja';
      c.addEventListener('change', () => zet(c.checked ? 'ja' : 'nee'));
      return el('label', { class: 'vink' }, c, 'ja');
    }
    if (v.type === 'langetekst') {
      const t = el('textarea', { id, rows: '2', 'data-veld': v.veld });
      t.value = huidig ?? '';
      t.addEventListener('input', () => zet(t.value));
      return t;
    }
    const getal = v.type === 'getal' || v.type === 'geheel';
    const i = el('input', { id, type: v.type === 'datum' ? 'date' : 'text', 'data-veld': v.veld, inputmode: getal ? 'decimal' : null, class: getal ? 'getal' : '', spellcheck: 'false', maxlength: v.veld === 'naam' ? '80' : null });
    i.value = getal ? toon(huidig) : huidig ?? '';
    i.addEventListener('input', () => zet(getal ? leesGetal(i.value) : i.value));
    return i;
  }

  function veld(v) {
    const viaWinning = !!rij.winning && ['gemeente', 'lat', 'lon'].includes(v.veld);   // komt dan uit de tabel Winningen
    const verplicht = v.verplicht || (v.levering && rij.soort === 'waterlevering' && !viaWinning);
    return el('div', { class: 'veld' + (v.type === 'langetekst' ? ' breed' : ''), 'data-rij': v.veld },
      el('label', { for: `mf-${v.veld}` }, v.label.replace(/^.* – /, ''), v.eenheid ? el('span', { class: 'eenheid', text: ` (${v.eenheid})` }) : null, verplicht ? el('span', { class: 'ster', title: 'verplicht', text: ' *' }) : null),
      invoer(v), el('div', { class: 'hulp', text: v.uitleg }), el('div', { class: 'vmelding', role: 'alert' }));
  }

  function effectenlijst() {
    const lijst = el('div', { class: 'effecten', id: 'mf-overige_effecten', 'data-veld': 'overige_effecten', tabindex: '-1' });
    const teken = () => {
      lijst.replaceChildren(...effecten.map((e, i) => {
        const label = el('input', { type: 'text', placeholder: 'Label, bv. Woningbouw', 'aria-label': `Effect ${i + 1}: label` });
        label.value = e.label ?? '';
        label.addEventListener('input', () => { e.label = label.value; gewijzigd(); });
        const b = el('select', { 'aria-label': `Effect ${i + 1}: beoordeling` }, el('option', { value: '', text: '– kies –' }), ...KEUZES.overigEffect.map((o) => el('option', { value: o, text: o })));
        b.value = e.beoordeling ?? '';
        b.addEventListener('change', () => { e.beoordeling = b.value || null; gewijzigd(); });
        const tekst = el('input', { type: 'text', placeholder: 'Toelichting', 'aria-label': `Effect ${i + 1}: toelichting` });
        tekst.value = e.tekst ?? '';
        tekst.addEventListener('input', () => { e.tekst = tekst.value; gewijzigd(); });
        return el('div', { class: 'effect' }, label, b, tekst,
          el('button', { class: 'knop mini gevaar', type: 'button', title: 'Verwijder dit effect', 'aria-label': `Verwijder effect ${i + 1}`, text: '×', onclick: () => { effecten.splice(i, 1); teken(); gewijzigd(); } }));
      }), el('button', { class: 'knop mini', type: 'button', text: '+ Effect toevoegen', onclick: () => { effecten.push({ label: '', beoordeling: null, tekst: '' }); teken(); gewijzigd(); lijst.querySelector('.effect:last-of-type input')?.focus(); } }));
    };
    teken();
    const v = MAATREGEL_VELDEN.find((x) => x.veld === 'overige_effecten');
    return el('div', { class: 'veld breed', 'data-rij': 'overige_effecten' }, el('label', { text: 'Effecten (kans / aandacht / knelpunt)' }), lijst,
      el('div', { class: 'hulp', text: 'Per effect een label, een beoordeling en een korte toelichting. ' + v.uitleg.split('. ')[0].replace('Eén effect per regel', 'In het template: één effect per regel') + '.' }), el('div', { class: 'vmelding', role: 'alert' }));
  }

  function blok(naam) {
    const velden = MAATREGEL_VELDEN.filter((v) => v.blok === naam);
    if (naam === 'Fysieke voetafdruk') {
      if (geenLevering()) return el('fieldset', {}, el('legend', { text: naam }), el('p', { class: 'hulp', text: `Niet van toepassing bij ${soortNaam()}.` }));
      return el('fieldset', {}, el('legend', { text: naam }),
        el('p', { class: 'hulp', text: 'Beoordeling door de informatiegevende partij. De tool rekent deze niet na en toetst niet aan kaartlagen.' }),
        ...Object.entries(VOETAFDRUK).map(([t, def]) => el('div', { class: 'thema' }, el('h4', { text: def.naam }), el('div', { class: 'rooster drie' }, ...velden.filter((v) => v.thema === t).map(veld)))));
    }
    const zichtbaar = velden.filter((v) => v.veld !== 'overige_effecten' && !(v.alleenLevering && geenLevering()));
    return el('fieldset', {}, el('legend', { text: naam }),
      el('div', { class: 'rooster' }, ...zichtbaar.map(veld), naam === 'Overige effecten' ? effectenlijst() : null),
      naam === 'Fysieke kenmerken' && geenLevering() ? el('p', { class: 'hulp', text: `Bij ${soortNaam()} vervallen locatie (lat/lon), bron, ruimtebeslag en stroomvraag.` }) : null);
  }

  // ------------------------------------------------- reageren op invoer
  function gewijzigd(v) {
    if (v?.veld === 'naam' && !idAangeraakt) { rij.id = maakId(rij.naam); form.querySelector('#mf-id').value = rij.id; }
    if (v?.veld === 'id') idAangeraakt = true;
    if (v?.veld === 'winning' && rij.winning && ctx.winningen.get(rij.winning)) {
      const w = ctx.winningen.get(rij.winning);                       // de winning bepaalt cluster en gemeente
      if (w.cluster) { rij.cluster = w.cluster; form.querySelector('#mf-cluster').value = rij.cluster; }
      if (w.gemeente && !rij.gemeente) { rij.gemeente = w.gemeente; form.querySelector('#mf-gemeente').value = rij.gemeente; }
      tekenBlokken();
    }
    if (v?.veld === 'soort') { tekenBlokken(); form.querySelector('#mf-soort')?.focus(); }
    werkBij();
  }

  function werkBij() {
    const m = object(), ml = meldingen(m), t = telling(ml);
    form.querySelectorAll('.veld').forEach((d) => {
      const hier = ml.filter((x) => veldVanMelding(x.veld) === d.dataset.rij || (d.dataset.rij === 'lon' && x.veld === 'locatie'));
      d.classList.toggle('fout', hier.some((x) => x.niveau === 'fout'));
      d.classList.toggle('waarschuwing', hier.length > 0 && !hier.some((x) => x.niveau === 'fout'));
      d.querySelector('.vmelding').textContent = hier.map((x) => x.melding).join(' ');
    });
    tekenPreview(m);
    const idOk = !!m.id && !andereIds.has(m.id);
    voet.replaceChildren(
      el('button', { class: 'knop pri', type: 'submit', disabled: !idOk, text: nieuw ? 'Maatregel toevoegen' : 'Wijzigingen opslaan' }),
      el('button', { class: 'knop', type: 'button', text: 'Annuleren', onclick: annuleer }),
      el('span', { class: 'mstatus' },
        !t.fouten && !t.waarschuwingen ? el('span', { class: 'status-ok', text: 'Volledig ingevuld.' }) : null,
        t.fouten ? el('span', { class: 'status-f', text: `${t.fouten} blokkerend` }) : null,
        t.fouten && t.waarschuwingen ? ' · ' : null,
        t.waarschuwingen ? el('span', { class: 'status-w', text: `${t.waarschuwingen} waarschuwing${t.waarschuwingen > 1 ? 'en' : ''}` }) : null,
        !idOk ? ' Vul eerst een uniek id in.' : t.fouten ? ' Opslaan kan; de fouten blijven zichtbaar in het validatiepaneel.' : null));
  }

  function tekenPreview(m) {
    const w = maatregelWeergave(m);
    preview.replaceChildren(...[
      el('h3', { text: 'Preview in de visualisatie' }),
      el('div', { class: 'pkop', text: 'Rij in de maatregelenlijst' }),
      el('div', { class: 'mrow' + (m.standaard_aan && w.teltMee ? '' : ' off') },
        el('span', { class: 'sw' + (m.standaard_aan && w.teltMee ? ' aan' : ''), 'aria-hidden': 'true' }),
        el('span', { class: 'mname', text: w.naam || '(naam)' }), el('span', { class: 'mval', text: w.waarde }), el('span', { class: 'spoor', text: w.spoor || '–' })),
      w.teltMee ? null : el('div', { class: 'pnoot', text: 'niet meegerekend (v1)' }),
      el('div', { class: 'pkop', text: 'Tooltip' }),
      el('div', { class: 'ptip' },
        el('div', { class: 'th', text: m.naam || '(naam)' }), w.omschrijving ? el('div', { class: 'tm', text: w.omschrijving }) : null,
        ...w.regels.map(([k, v]) => el('div', { class: 'kv' }, el('span', { text: k }), el('b', { text: v }))),
        w.effecten.length ? el('div', { class: 'sep' }) : null,
        ...w.effecten.map((e) => el('div', { class: 'kv' }, el('span', { text: e.label }), el('b', { class: `eff-${e.beoordeling ?? ''}`, text: e.beoordeling ?? '–' }))),
        w.noten.length ? el('div', { class: 'sep' }) : null, ...w.noten.map((n) => el('div', { class: 'tm', text: n }))),
    ].filter(Boolean));
  }

  const blokken = el('div', { class: 'mblokken' });
  function tekenBlokken() { blokken.replaceChildren(...MAATREGEL_BLOKKEN.map(blok)); }

  form.addEventListener('submit', (ev) => { ev.preventDefault(); const m = object(); if (m.id && !andereIds.has(m.id)) opslaan(m); });
  form.append(
    el('h2', { text: nieuw ? 'Maatregel aanleveren' : `Maatregel bewerken: ${start.naam || start.id}` }),
    el('p', { class: 'uitleg', text: 'Vul het dataobject van één maatregel in. Velden met * zijn verplicht; welke velden dat zijn hangt af van de soort. De preview rechts laat zien hoe de maatregel in de visualisatie verschijnt.' }),
    el('div', { class: 'mlayout' }, blokken, preview), voet);
  tekenBlokken(); werkBij();
  form.focusVeld = (naam) => {
    const doel = form.querySelector(`[data-veld="${veldVanMelding(naam)}"]`) ?? form.querySelector('[data-veld]');
    doel?.scrollIntoView({ block: 'center' }); doel?.focus({ preventScroll: true });
  };
  return form;
}
