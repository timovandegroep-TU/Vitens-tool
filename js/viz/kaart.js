// Schematische kaart: projectie, kader met provincie Utrecht en buurprovincies, pins en stippen.
import { OMTREK_UTRECHT, KAARTLABELS, NIVEAUS } from '../config.js';
import { attachTip, esc } from './tooltip.js';

const W = 295, H = 196, PAD = 12;
const NS = 'http://www.w3.org/2000/svg';
const PIN = 'M0,0 C-2,-6 -10,-11 -10,-18 A10,10 0 1 1 10,-18 C10,-11 2,-6 0,0 Z';
let project = null;

const isPunt = (p) => Array.isArray(p) && p.every((v) => typeof v === 'number' && Number.isFinite(v));

/** Kaartkader = omtrek Utrecht plus alle punten in de dataset (dus incl. Flevoland en Gelderland). */
export function bouw(data) {
  const punten = [...OMTREK_UTRECHT,
    ...data.gemeenten.map((g) => [g.lon, g.lat]), ...data.winningen.map((w) => [w.lon, w.lat]),
    ...data.maatregelen.map((m) => [m.locatie?.lon, m.locatie?.lat])].filter(isPunt);
  const lons = punten.map((p) => p[0]), lats = punten.map((p) => p[1]);
  const lo0 = Math.min(...lons), lo1 = Math.max(...lons), la0 = Math.min(...lats), la1 = Math.max(...lats);
  const cosL = Math.cos((la0 + la1) / 2 * Math.PI / 180);
  const k = Math.min((W - 2 * PAD) / Math.max(1e-6, (lo1 - lo0) * cosL), (H - 2 * PAD) / Math.max(1e-6, la1 - la0));
  const ox = (W - (lo1 - lo0) * cosL * k) / 2, oy = (H - (la1 - la0) * k) / 2;
  project = ([lon, lat]) => [ox + (lon - lo0) * cosL * k, oy + (la1 - lat) * k];

  const d = OMTREK_UTRECHT.map((p, i) => (i ? 'L' : 'M') + project(p).map((v) => v.toFixed(1)).join(',')).join('') + 'Z';
  const binnen = ([lon, lat]) => lon >= lo0 && lon <= lo1 && lat >= la0 && lat <= la1;
  document.querySelector('#mapG').innerHTML =
    `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="10" fill="rgba(93,183,230,.10)" stroke="rgba(93,183,230,.35)" stroke-dasharray="3 4"/>`
    + `<path d="${d}" fill="var(--map)" stroke="var(--map)" stroke-width="5" stroke-linejoin="round" opacity=".9"/>`
    + data.gemeenten.filter((g) => isPunt([g.lon, g.lat])).map((g) => { const [x, y] = project([g.lon, g.lat]); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.3" fill="#fff" opacity=".45"/>`; }).join('')
    + KAARTLABELS.filter((l) => binnen(l.punt)).map((l) => { const [x, y] = project(l.punt); return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle"${l.tekst === 'UTRECHT' ? ' style="fill:#0E3150;opacity:.55"' : ''}>${esc(l.tekst)}</text>`; }).join('');
}

/**
 * Teken de punten. items: [{ k, punt:[lon,lat], niveau, vorm:'pin'|'stip', tip() }]
 * @param opHover(k|null)  aangeroepen bij aanwijzen van een punt
 */
export function tekenPunten(items, opHover) {
  const pg = document.querySelector('#pinG');
  pg.replaceChildren();
  const gezien = {};
  // zwaarste niveau bovenop: eerst de lichtste tekenen
  const volgorde = [...items].filter((e) => isPunt(e.punt)).sort((a, b) => NIVEAUS[b.niveau].volgorde - NIVEAUS[a.niveau].volgorde);
  for (const e of volgorde) {
    const [x, y] = project(e.punt);
    const sleutel = x.toFixed(0) + ',' + y.toFixed(0);
    const n = gezien[sleutel] = (gezien[sleutel] || 0) + 1;
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'pin'); g.dataset.k = e.k;
    const kleur = NIVEAUS[e.niveau].kleur;
    if (e.vorm === 'stip') {
      g.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)})`);
      g.innerHTML = `<circle r="${e.niveau === 'geen' ? 3.2 : 5}" fill="${kleur}" stroke="#fff" stroke-width="1.3"/>`;
    } else {
      g.setAttribute('transform', `translate(${(x + (n - 1) * 12).toFixed(1)},${y.toFixed(1)}) scale(.85)`);
      g.innerHTML = `<path d="${PIN}" fill="${kleur}" stroke="#fff" stroke-width="1.6"/><circle cx="0" cy="-18" r="4.2" fill="#fff"/>`;
    }
    g.addEventListener('pointerenter', () => opHover(e.k));
    g.addEventListener('pointerleave', () => opHover(null));
    if (e.tip) attachTip(g, e.tip);
    pg.append(g);
  }
}

export function markeer(k) {
  document.querySelectorAll('#pinG .pin').forEach((p) => p.classList.toggle('dim', k != null && p.dataset.k !== k));
}
