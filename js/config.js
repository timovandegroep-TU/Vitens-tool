// Instellingen en drempels van de visualisatie. Rekenregels staan in js/model.js,
// validatiegrenzen (o.a. de 30 Mm³-waarschuwing) in js/schema.js (GRENZEN).

export const START_ZICHTJAAR = 2035;
export const AFSPEEL_MS = 380;            // tempo van "afspelen" per jaar
export const RESERVE_FACTOR = 1.1;        // chip "Reserve +10%": vraag × 1,1 (alleen een lijn)

// Kleuren van pins en bolletjes (css/tokens.css: --tool-status-*; hier herhaald omdat ze in SVG-attributen komen)
export const NIVEAUS = {
  knelpunt: { kleur: '#FF3A0D', volgorde: 0 },
  aandacht: { kleur: '#F2A71B', volgorde: 1 },
  kans:     { kleur: '#2E9E8F', volgorde: 2 },
  geen:     { kleur: '#AEB8DA', volgorde: 3 },
};

// Fysieke voetafdruk -> niveau in het effectenpaneel. Niet genoemd = geen melding.
export const VOETAFDRUK_NIVEAU = {
  grondwater:       { beperkt: 'aandacht', significant: 'knelpunt', onbekend: 'aandacht' },
  beschermingszone: { 'in of grenst aan': 'aandacht', onbekend: 'aandacht' },
  natura2000:       { mogelijk: 'aandacht', waarschijnlijk: 'knelpunt', onbekend: 'aandacht' },
  netcapaciteit:    { krap: 'aandacht', onvoldoende: 'knelpunt', onbekend: 'aandacht' },
};

// Winningen: afname van de capaciteit in het zichtjaar (% van de inzetbare capaciteit)
export const AFNAME_DREMPELS = { aandacht: 0.05, knelpunt: 25 };

// Schematische kaart: omtrek provincie Utrecht (lon, lat) uit de mockup en labels van de buurprovincies
export const OMTREK_UTRECHT = [[4.79,52.23],[4.86,52.27],[4.95,52.26],[5.02,52.22],[5.10,52.20],[5.17,52.17],[5.24,52.19],[5.25,52.25],
  [5.30,52.27],[5.37,52.25],[5.42,52.24],[5.47,52.20],[5.50,52.16],[5.50,52.12],[5.54,52.08],[5.62,52.05],[5.63,51.99],
  [5.58,51.95],[5.45,51.96],[5.34,51.97],[5.27,51.95],[5.23,51.90],[5.12,51.86],[5.02,51.88],[4.98,51.94],[4.88,51.97],
  [4.82,52.01],[4.79,52.06],[4.80,52.12],[4.84,52.16],[4.80,52.20]];
export const KAARTLABELS = [
  { tekst: 'UTRECHT', punt: [5.13, 52.02] },
  { tekst: 'FLEVOLAND', punt: [5.50, 52.44] },
  { tekst: 'GELDERLAND', punt: [5.74, 52.13] },
];
