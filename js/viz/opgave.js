// Paneel DRINKWATEROPGAVE: zichtjaar, grafiek, tabel, legenda en dekkingsbalk (uit de mockup).
import { el } from '../dom.js';
import { JAAR_MIN, JAAR_MAX, NU, AANBODJAREN, VRAAGJAREN, isDatapunt } from '../model.js';
import { AFSPEEL_MS, RESERVE_FACTOR } from '../config.js';
import { attachTip, showTip, moveTip, hideTip, tipSleutel, esc, f1, kv } from './tooltip.js';

const $ = (s) => document.querySelector(s);
const JAREN = Array.from({ length: JAAR_MAX - JAAR_MIN + 1 }, (_, i) => JAAR_MIN + i);
const SPAN = JAAR_MAX - JAAR_MIN;
const setFill = (r) => r.style.setProperty('--p', (r.value - r.min) / (r.max - r.min) * 100 + '%');
let app = null;

// ------------------------------------------------------------ zichtjaar
function renderZicht() {
  const zr = $('#zr'), jaar = app.state.jaar;
  zr.value = jaar; setFill(zr);
  const W = 394, thumb = 30, pos = (y) => thumb / 2 + (y - JAAR_MIN) / SPAN * (W - thumb);
  const ticks = [];
  for (let y = JAAR_MIN; y <= JAAR_MAX; y += 5) {
    if (y !== jaar && Math.abs(y - jaar) < 3) continue;
    ticks.push(el('span', { class: y === jaar ? 'on' : '', style: `left:${pos(y)}px`, text: y }));
  }
  if (jaar % 5) ticks.push(el('span', { class: 'on', style: `left:${pos(jaar)}px`, text: jaar }));
  $('#zTicks').replaceChildren(...ticks);
}

let spelend = null;
const PLAY = '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 1.5 L10.5 6 L3 10.5 Z" fill="#fff"/></svg>';
const PAUSE = '<svg width="12" height="12" viewBox="0 0 12 12"><rect x="2" y="1.5" width="3" height="9" fill="#fff"/><rect x="7" y="1.5" width="3" height="9" fill="#fff"/></svg>';
export function speel(aan) {
  clearInterval(spelend); spelend = null;
  if (aan) {
    if (app.state.jaar >= JAAR_MAX) app.kies({ jaar: JAAR_MIN });
    spelend = setInterval(() => { if (app.state.jaar >= JAAR_MAX) { speel(false); return; } app.kies({ jaar: app.state.jaar + 1 }); }, AFSPEEL_MS);
  }
  $('#play').innerHTML = spelend ? PAUSE : PLAY;
  $('#play').setAttribute('aria-label', spelend ? 'Pauzeer tijdlijn' : 'Speel tijdlijn af');
}

// -------------------------------------------------------------- grafiek
const CH = { L: 78, R: 564, T: 28, B: 282 };
let dom = { min: 80, max: 190, stap: 20 };
const X = (t) => CH.L + (t - JAAR_MIN) / SPAN * (CH.R - CH.L);
const Y = (v) => CH.T + (dom.max - v) / (dom.max - dom.min) * (CH.B - CH.T);
const pathOf = (pts) => pts.map((p, i) => (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join('');

/** As-indeling: ronde stap zodat er hooguit ~6 lijnen zijn. */
function schaal(lo, hi) {
  const bereik = Math.max(hi - lo, 1);
  const stap = [0.5, 1, 2, 5, 10, 20, 50, 100].find((s) => bereik / s <= 5.5) ?? 200;
  return { stap, min: Math.floor((lo - stap * 0.25) / stap) * stap, max: Math.ceil((hi + stap * 0.35) / stap) * stap };
}

/**
 * Lijn met stappen: een maatregel gaat in één keer in op het ingangsjaar, dus op dat jaar
 * een verticale sprong (waarde vlak vóór = basislijn van dat jaar + maatregelen van het jaar ervoor).
 */
function stappen(S, waarde, basis, effect, teken) {
  const pts = [];
  S.forEach((c, i) => {
    if (i > 0) { const voor = basis(c) + teken * effect(S[i - 1]); if (Math.abs(voor - waarde(c)) > 0.005) pts.push([c.jaar, voor]); }
    pts.push([c.jaar, waarde(c)]);
  });
  return pts;
}

function renderChart() {
  const S = JAREN.map((j) => app.zicht(j)), sh = app.state.show;
  let lo = Infinity, hi = -Infinity;
  for (const c of S) {
    const v = [c.vraag, c.aanbod];
    if (sh.zonder) v.push(c.aanbod0);
    if (sh.reserve) v.push(c.vraag * RESERVE_FACTOR);
    for (const x of v) { lo = Math.min(lo, x); hi = Math.max(hi, x); }
  }
  dom = schaal(lo, hi);
  const vraag = stappen(S, (c) => c.vraag, (c) => c.vraag0, (c) => c.besparing, -1);
  const aanbod = stappen(S, (c) => c.aanbod, (c) => c.aanbod0, (c) => c.levering, 1);
  const tot = (pts) => pts.filter((p) => p[0] <= NU), vanaf = (pts) => pts.filter((p) => p[0] >= NU);

  let s = `<text x="6" y="12" class="ytick" style="text-anchor:start">Mm³/j</text>`;
  s += `<rect x="${X(NU)}" y="${CH.T}" width="${CH.R - X(NU)}" height="${CH.B - CH.T}" fill="var(--plot)"/>`;
  for (let v = dom.min + dom.stap; v <= dom.max + 1e-9; v += dom.stap) {
    s += `<line class="grid" x1="${CH.L}" x2="${CH.R}" y1="${Y(v)}" y2="${Y(v)}"/><text class="ytick" x="${CH.L - 12}" y="${Y(v) + 5}">${String(Math.round(v * 10) / 10).replace('.', ',')}</text>`;
  }
  s += `<text x="${X(NU) + 10}" y="${CH.T + 16}" font-size="12" letter-spacing="3" fill="#5B6F82">PROJECTIE</text>`;
  if (sh.reserve) {
    const r = S.map((c) => [c.jaar, c.vraag * RESERVE_FACTOR]), e = r[r.length - 1];
    s += `<path d="${pathOf(r)}" fill="none" stroke="var(--slate)" stroke-width="1.4" stroke-dasharray="12 5"/>`;
    s += `<text class="vlab" x="${X(JAAR_MAX) - 2}" y="${Y(e[1]) - 7}" text-anchor="end" style="font-weight:400;fill:var(--slate)">reserve +10%</text>`;
  }
  if (sh.zonder) {
    s += `<path d="${pathOf(S.map((c) => [c.jaar, c.aanbod0]))}" fill="none" stroke="#7F93A6" stroke-width="1.7" stroke-dasharray="1.5 3.5" stroke-linecap="round"/>`;
    s += AANBODJAREN.map((j) => `<circle class="punt" cx="${X(j)}" cy="${Y(app.zicht(j).aanbod0)}" r="2.6" fill="#fff" stroke="#7F93A6" stroke-width="1.4"/>`).join('');
  }
  if (sh.vraag) {
    s += `<path d="${pathOf(tot(vraag))}" fill="none" stroke="var(--vraag)" stroke-width="3" stroke-linecap="round"/>`;
    s += `<path d="${pathOf(vanaf(vraag))}" fill="none" stroke="var(--vraag)" stroke-width="3" stroke-dasharray="11 7"/>`;
    s += VRAAGJAREN.map((j) => `<circle class="punt" cx="${X(j)}" cy="${Y(app.zicht(j).vraag)}" r="3" fill="#fff" stroke="var(--vraag)" stroke-width="1.8"/>`).join('');
  }
  if (sh.aanbod) {
    s += `<path d="${pathOf(tot(aanbod))}" fill="none" stroke="var(--navy)" stroke-width="3.5" stroke-linecap="round"/>`;
    s += `<path d="${pathOf(vanaf(aanbod))}" fill="none" stroke="var(--navy)" stroke-width="3.5" stroke-dasharray="13 8"/>`;
    s += AANBODJAREN.map((j) => `<circle class="punt" cx="${X(j)}" cy="${Y(app.zicht(j).aanbod)}" r="3" fill="#fff" stroke="var(--navy)" stroke-width="1.8"/>`).join('');
  }
  // nu-lijn
  s += `<line x1="${X(NU)}" x2="${X(NU)}" y1="${CH.T - 6}" y2="${CH.B}" stroke="var(--navy)" stroke-width="1.6"/>`;
  s += `<text x="${X(NU)}" y="${CH.T - 11}" text-anchor="middle" font-size="13" font-weight="700" fill="var(--ink)">nu</text>`;
  // zichtjaar
  const jaar = app.state.jaar, c = app.zicht(jaar), zx = X(jaar);
  s += `<line x1="${zx}" x2="${zx}" y1="${CH.T}" y2="${CH.B}" stroke="var(--navy)" stroke-width="1.4"/>`;
  const rechts = jaar <= JAAR_MAX - 5, tx = rechts ? zx + 12 : zx - 12, anc = rechts ? 'start' : 'end';
  const vBoven = c.vraag >= c.aanbod;
  if (sh.vraag) {
    s += `<circle cx="${zx}" cy="${Y(c.vraag)}" r="7" fill="var(--vraag)" stroke="#fff" stroke-width="2.5"/>`;
    s += `<text class="vlab" x="${tx}" y="${Y(c.vraag) + (vBoven ? -9 : 17)}" text-anchor="${anc}">${f1(c.vraag)}</text>`;
  }
  if (sh.aanbod) {
    s += `<circle cx="${zx}" cy="${Y(c.aanbod)}" r="7" fill="var(--navy)" stroke="#fff" stroke-width="2.5"/>`;
    s += `<text class="vlab" x="${tx}" y="${Y(c.aanbod) + (vBoven ? 17 : -9)}" text-anchor="${anc}">${f1(c.aanbod)}</text>`;
  }
  // x-as
  s += `<line x1="${CH.L}" x2="${CH.R}" y1="${CH.B}" y2="${CH.B}" stroke="var(--navy)" stroke-width="1.4"/>`;
  for (let y = JAAR_MIN; y <= JAAR_MAX; y += 5) {
    s += `<line x1="${X(y)}" x2="${X(y)}" y1="${CH.B}" y2="${CH.B + 6}" stroke="var(--navy)" stroke-width="1.2"/><text class="xtick" x="${X(y)}" y="${CH.B + 24}">${y}</text>`;
  }
  $('#chartG').innerHTML = s;
  drawHover();
}

// hover / crosshair
let hoverJaar = null;
function jaarVanEvent(ev) {
  const svg = $('#chart'), pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
  const p = pt.matrixTransform(svg.getScreenCTM().inverse());
  return Math.max(JAAR_MIN, Math.min(JAAR_MAX, Math.round(JAAR_MIN + (p.x - CH.L) / (CH.R - CH.L) * SPAN)));
}
function drawHover() {
  const g = $('#hoverG');
  if (hoverJaar == null) { g.innerHTML = ''; return; }
  const c = app.zicht(hoverJaar), x = X(hoverJaar), sh = app.state.show;
  let s = `<line x1="${x}" x2="${x}" y1="${CH.T}" y2="${CH.B}" stroke="#8EA4B8" stroke-width="1"/>`;
  if (sh.vraag) s += `<circle cx="${x}" cy="${Y(c.vraag)}" r="4" fill="#fff" stroke="var(--vraag)" stroke-width="2"/>`;
  if (sh.aanbod) s += `<circle cx="${x}" cy="${Y(c.aanbod)}" r="4" fill="#fff" stroke="var(--navy)" stroke-width="2"/>`;
  if (sh.zonder) s += `<circle cx="${x}" cy="${Y(c.aanbod0)}" r="3.5" fill="#fff" stroke="#7F93A6" stroke-width="1.6"/>`;
  g.innerHTML = s;
}
const lkey = (stroke, w, dash) => `<svg width="18" height="6"><line x1="1" y1="3" x2="17" y2="3" stroke="${stroke}" stroke-width="${w}" ${dash ? `stroke-dasharray="${dash}"` : ''} stroke-linecap="round"/></svg>`;
function chartTip(t) {
  const c = app.zicht(t), sh = app.state.show, dp = isDatapunt(t);
  const soort = (echt) => (echt ? '' : ' <i style="color:var(--muted);font-style:normal">(geïnterpoleerd)</i>');
  let h = `<div class="th">${t} · ${t <= NU ? 'huidig' : 'projectie'}${app.state.cluster ? ' · ' + esc(app.clusterNaam()) : ''}</div>`;
  if (sh.vraag) h += `<div class="tr">${lkey('#4AA8E0', 3)}<b>${f1(c.vraag)}</b><span>Vraag${soort(dp.vraag)}</span></div>`;
  if (sh.aanbod) h += `<div class="tr">${lkey('#0E3150', 3.5)}<b>${f1(c.aanbod)}</b><span>Aanbod${soort(dp.aanbod)}</span></div>`;
  if (sh.zonder) h += `<div class="tr">${lkey('#7F93A6', 1.7, '1.5 3.5')}<b>${f1(c.aanbod0)}</b><span>Zonder maatregelen</span></div>`;
  if (sh.reserve) h += `<div class="tr">${lkey('#5E7387', 1.4, '5 3')}<b>${f1(c.vraag * RESERVE_FACTOR)}</b><span>Reservenorm</span></div>`;
  return h + '<div class="sep"></div>' + kv('Vraag zonder besparing', f1(c.vraag0)) + kv('Tekort', `${f1(c.tekort)} Mm³/j`)
    + `<div class="tm" style="margin:4px 0 0">Klik om ${t} als zichtjaar te kiezen</div>`;
}

// legenda
const LEG = [
  { k: 'vraag', label: 'Vraag', key: '<svg width="34" height="8"><line x1="1" y1="4" x2="33" y2="4" stroke="#4AA8E0" stroke-width="3" stroke-linecap="round"/></svg>' },
  { k: 'aanbod', label: 'Aanbod', key: '<svg width="34" height="8"><line x1="1" y1="4" x2="33" y2="4" stroke="#0E3150" stroke-width="3.5" stroke-linecap="round"/></svg>' },
  { k: 'zonder', label: 'Zonder maatregelen', key: '<svg width="34" height="8"><line x1="1" y1="4" x2="33" y2="4" stroke="#7F93A6" stroke-width="1.7" stroke-dasharray="1.5 3.5" stroke-linecap="round"/></svg>' },
];
function renderLegend() {
  $('#legend').replaceChildren(...LEG.map((l) => {
    const b = el('button', { class: 'lg', type: 'button', 'aria-pressed': String(app.state.show[l.k]), title: 'Toon/verberg ' + l.label.toLowerCase() });
    b.innerHTML = l.key; b.append(el('span', { text: l.label }));
    b.addEventListener('click', () => { app.state.show[l.k] = !app.state.show[l.k]; app.update(); });
    return b;
  }), el('span', { class: 'lg', style: 'cursor:default;font-size:13px;color:var(--ink-2)', title: 'Tussenliggende jaren zijn lineair geïnterpoleerd' },
    el('span', { style: 'width:9px;height:9px;border-radius:50%;border:2px solid var(--ink-2);background:#fff;display:inline-block' }), 'datapunt'));
}

// tabelweergave
function renderTable() {
  const tabel = app.state.view === 'table';
  $('#chipTab').setAttribute('aria-pressed', String(tabel));
  $('#tableView').hidden = !tabel;
  $('#legend').style.visibility = $('#chart').style.visibility = tabel ? 'hidden' : 'visible';
  if (!tabel) return;
  const ys = [...VRAAGJAREN]; if (!ys.includes(app.state.jaar)) { ys.push(app.state.jaar); ys.sort((a, b) => a - b); }
  let h = '<table><thead><tr><th>Jaar</th><th>Vraag</th><th>Aanbod</th><th>Zonder maatr.</th><th>Opgave</th><th>Maatregelen</th><th>Tekort</th><th>Gedekt</th></tr></thead><tbody>';
  for (const y of ys) {
    const c = app.zicht(y);
    h += `<tr class="${y === app.state.jaar ? 'sel' : ''}"><td>${y}</td><td>${f1(c.vraag)}</td><td>${f1(c.aanbod)}</td><td>${f1(c.aanbod0)}</td><td>${c.opgave > 0 ? f1(c.opgave) : '–'}</td><td>${f1(c.bijdrage)}</td><td>${f1(c.tekort)}</td><td>${c.opgave > 0 ? Math.floor(c.gedekt * 100) + '%' : '–'}</td></tr>`;
  }
  $('#tableView').innerHTML = h + '</tbody></table><div style="font-size:11.5px;color:#6B7F92;margin-top:8px">Alle waarden in Mm³/j · opgave = vraag zonder besparing − aanbod zonder maatregelen</div>';
}

// --------------------------------------------------------- dekkingsbalk
function renderBar(c) {
  const W = 546;
  let pct, links, rechts = '', detail;
  if (c.opgave <= 0) {
    pct = 100; links = 'Geen opgave'; detail = `Aanbod zonder maatregelen dekt de vraag in ${c.jaar} (overschot ${f1(-c.opgave)} Mm³/j)`;
  } else {
    pct = Math.floor(c.gedekt * 100);
    links = `Gedekt ${pct}%`; rechts = c.tekort > 0.05 ? 'Tekort' : '';
    const over = c.bijdrage - c.opgave;
    detail = `Opgave ${f1(c.opgave)} · maatregelen ${f1(c.bijdrage)} · ` + (over > 0.05 ? `overschot ${f1(over)}` : `tekort ${f1(c.tekort)}`) + ' Mm³/j';
  }
  const w = pct <= 0 ? 0 : Math.max(52, pct / 100 * W);
  $('#barFill').style.width = w + 'px';
  const L = $('#barL'), R = $('#barR'), binnen = w >= 170;
  L.textContent = links; R.textContent = rechts;
  L.classList.toggle('out', !binnen); L.style.left = (binnen ? 22 : w + 14) + 'px';
  R.classList.toggle('inv', w > W - 90);
  $('#barDetail').textContent = detail + (app.state.cluster ? ` · ${app.clusterNaam()}` : '');
}

// ------------------------------------------------------------- opbouw
export function bouw(a) {
  app = a;
  const kies = $('#clusterKeuze');
  kies.replaceChildren(el('option', { value: '', text: 'Totaal' }), ...app.data.clusters.map((c) => el('option', { value: c.id, text: c.naam || c.id })));
  kies.addEventListener('change', () => app.kies({ cluster: kies.value || null }));
  $('#zr').addEventListener('input', (e) => { speel(false); app.kies({ jaar: Number(e.target.value) }); });
  $('#play').addEventListener('click', () => speel(!spelend));
  $('#chipRes').addEventListener('click', () => { app.state.show.reserve = !app.state.show.reserve; app.update(); });
  $('#chipTab').addEventListener('click', () => { app.state.view = app.state.view === 'chart' ? 'table' : 'chart'; app.update(); });
  const hit = $('#hit');
  hit.addEventListener('pointermove', (ev) => {
    const t = jaarVanEvent(ev);
    if (t !== hoverJaar) { hoverJaar = t; drawHover(); }
    if (tipSleutel() !== 'jaar' + t) showTip(() => chartTip(hoverJaar ?? t), ev.clientX, ev.clientY, 'jaar' + t);
    else moveTip(ev.clientX, ev.clientY);
  });
  hit.addEventListener('pointerleave', () => { hoverJaar = null; drawHover(); hideTip(); });
  hit.addEventListener('click', (ev) => { speel(false); app.kies({ jaar: jaarVanEvent(ev) }); });
  attachTip($('#bar'), () => {
    const c = app.zicht(app.state.jaar);
    return `<div class="th">Invulling drinkwateropgave ${c.jaar}${app.state.cluster ? ' · ' + esc(app.clusterNaam()) : ''}</div>`
      + '<div class="tm">Opgave = vraag zonder besparing − aanbod zonder maatregelen. Gedekt = bijdrage maatregelen ÷ opgave.</div>'
      + kv('Vraag zonder besparing', f1(c.vraag0)) + kv('Aanbod zonder maatregelen', f1(c.aanbod0))
      + kv('Opgave', f1(c.opgave)) + kv('Besparing (vraag)', f1(c.besparing)) + kv('Extra aanbod', f1(c.levering)) + kv('Tekort', f1(c.tekort));
  });
  speel(false);
}

export function render(a, c) {
  const kies = $('#clusterKeuze');
  kies.value = app.state.cluster ?? ''; kies.classList.toggle('actief', !!app.state.cluster);
  $('#chipRes').setAttribute('aria-pressed', String(app.state.show.reserve));
  renderZicht(); renderLegend(); renderChart(); renderTable(); renderBar(c);
}
