// Kleine DOM-hulpjes, gedeeld door de invoerpagina en het maatregelformulier.

/** Maak een element: el('td', { class: 'x', text: 'y', onclick: f }, ...kinderen). */
export const el = (tag, attrs = {}, ...kinderen) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
  }
  e.append(...kinderen.filter((x) => x != null));
  return e;
};

/** Getal voor in een invoerveld: komma als decimaalteken, geen afronding die data wijzigt. */
export const toon = (v) => (v == null ? '' : typeof v === 'number' ? String(Math.round(v * 1e6) / 1e6).replace('.', ',') : String(v));
