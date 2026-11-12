# Schrijft data/voorbeeld.json: volledig fictieve data in het formaat van de tool (schema 2).
# Namen en waarden zijn verzonnen; de orde van grootte lijkt op het werkdocument
# (5 clusters, ca. 30 winningen, ca. 132 Mm³/j aanbod, vraag ca. 138 Mm³/j in 2025).
#
# Gebruik:  python tools/maak_voorbeeld.py data/voorbeeld.json
# daarna:   node tests/voorbeeld.test.mjs --bijwerken   (snapshot bijwerken)
import io, json, sys

JAREN = [2025, 2030, 2035, 2040, 2045, 2050]

# ------------------------------------------------------------------ vraag
# vraag 2025 per cluster (Mm³/j) en hoe hard het cluster meegroeit met het scenario
CLUSTERS = {            # naam: (vraag 2025, groeigevoeligheid)
    'West':   (46.5, 1.10),
    'Zuid':   (16.6, 0.80),
    'Midden': (32.5, 1.00),
    'Oost':   (14.6, 0.90),
    'Noord':  (28.0, 1.20),
}
SCENARIOS = [           # naam, groei vraag 2025->2050 (gemiddeld), toelichting
    ('Laag', -0.02, 'Fictief. CBS-prognose laag; verbruik daalt naar 120 l p.p.p.d.; klimaat zoals nu.'),
    ('Midden (CBS)', 0.09, 'Fictief. CBS-prognose midden; verbruik 128 l p.p.p.d.; gematigde opwarming (+1 °C).'),
    ('Hoog', 0.20, 'Fictief. CBS-prognose hoog; verbruik 130 l p.p.p.d.; gematigde opwarming (+1 °C).'),
    ('Hoog + warm', 0.28, 'Fictief. CBS-prognose hoog; verbruik 132 l p.p.p.d.; warm en droog (+2 °C), meer vraag in droge zomers.'),
]

vraag = []
for s, groei, toel in SCENARIOS:
    for i, (c, (v0, gev)) in enumerate(CLUSTERS.items()):
        rij = {'scenario': s, 'cluster': c}
        for j in JAREN:
            x = (j - 2025) / 25
            rij[str(j)] = round(v0 * (1 + groei * gev * x ** 0.9), 2)
        rij['toelichting'] = toel if i == 0 else ''
        vraag.append(rij)

# -------------------------------------------------------------- winningen
# naam, cluster, capaciteit, lat, lon
WIN = [
    ('Lindewaard', 'West', 11.0, 52.090, 4.930), ('Hoge Brug', 'West', 9.0, 52.120, 4.990),
    ('Kromme Akker', 'West', 7.0, 52.050, 4.880), ('Wilgenoord', 'West', 6.0, 52.140, 4.900),
    ('Rietveen', 'West', 5.0, 52.030, 4.960), ('Molendijk', 'West', 3.0, 52.070, 5.020),
    ('Schaapsdrift', 'West', 2.0, 52.110, 4.850), ('Vossenhol', 'West', 1.0, 52.160, 4.960),
    ('Beekzicht', 'Zuid', 5.0, 51.980, 5.230), ('Dorrewaard', 'Zuid', 3.5, 51.960, 5.330),
    ('Heidepoort', 'Zuid', 3.5, 52.000, 5.390), ('Klaverhoeve', 'Zuid', 3.0, 51.990, 5.170),
    ('Zandstede', 'Zuid', 2.0, 51.950, 5.260),
    ('Eikenrode', 'Midden', 8.0, 52.150, 5.300), ('Bosrand', 'Midden', 6.0, 52.120, 5.360),
    ('Leemberg', 'Midden', 5.0, 52.180, 5.240), ('Dennenhof', 'Midden', 4.0, 52.100, 5.200),
    ('Valkenheuvel', 'Midden', 3.0, 52.200, 5.330), ('Mosveld', 'Midden', 2.0, 52.140, 5.420),
    ('Wolfsberg', 'Oost', 5.0, 52.320, 5.640), ('Hertenkamp', 'Oost', 4.0, 52.280, 5.700),
    ('Bremhorst', 'Oost', 3.5, 52.250, 5.600), ('Ruigeveld', 'Oost', 3.0, 52.350, 5.580),
    ('Polderkern', 'Noord', 10.0, 52.470, 5.500), ('Nieuwlandse Dijk', 'Noord', 7.0, 52.430, 5.600),
    ('Kavel Zeven', 'Noord', 5.0, 52.510, 5.450), ('Lage Vaart', 'Noord', 4.0, 52.400, 5.520),
    ('Meeuwenplaat', 'Noord', 2.0, 52.540, 5.580),
]
winningen = [{'naam': n, 'cluster': c, 'gemeente': n, 'capaciteit': cap,
              'lat': la, 'lon': lo, 'toelichting': ''} for n, c, cap, la, lo in WIN]

# ------------------------------------------------------------ maatregelen
META = {'aangeleverd_door': 'J. Voorbeeld (fictief)', 'datum': '2026-11-12', 'bron': 'Fictief overzicht maatregelen'}
GEEN = None


def voet(gw, bz, n2, net):
    t = lambda b, s: {'beoordeling': b, 'toelichting': s, 'bron': 'Fictieve quickscan'}
    return {'grondwater': t(*gw), 'beschermingszone': t(*bz), 'natura2000': t(*n2), 'netcapaciteit': t(*net)}


def effecten(*lijst):
    return [{'label': l, 'beoordeling': b, 'tekst': t} for l, b, t in lijst]


def maatregel(id, naam, oms, soort, spoor, volume, jaar, aan, status, cluster, winning=None, gemeente=None,
              locatie=None, bron=None, ha=None, mw=None, voetafdruk=None, politiek='', eff=(), leverancier='Vitens'):
    return {'id': id, 'naam': naam, 'omschrijving': oms, 'leverancier': leverancier, 'soort': soort, 'spoor': spoor,
            'standaard_aan': aan, 'status': status, 'winning': winning, 'cluster': cluster, 'gemeente': gemeente,
            'locatie': locatie, 'bron': bron, 'volume': volume, 'ruimtebeslag': ha, 'stroomvraag': mw, 'ingangsjaar': jaar,
            'voetafdruk': voetafdruk, 'overige_effecten': {'politiek': politiek, 'lijst': effecten(*eff)}, 'meta': dict(META)}


GW0 = ('geen effect', 'Geen extra onttrekking.'); BUITEN = ('buiten', 'Ligt buiten de zones.')
N0 = ('geen invloed', 'Geen gebied in de buurt.'); NET = ('voldoende', 'Bestaande aansluiting volstaat.')

M = [
    # S0 – besparing (vraag omlaag)
    maatregel('besparing-huishoudens', 'Waterbesparing huishoudens', 'Campagnes en waterbesparende toestellen bij huishoudens.',
              'waterbesparing', 'S0', 6.0, 2030, True, 'besloten', 'alle',
              politiek='Breed draagvlak in de regio.', eff=[('Huishoudens', 'aandacht', 'Vraagt gedragsverandering van bewoners.')]),
    maatregel('besparing-bedrijven', 'Waterbesparing bedrijven', 'Afspraken met grootverbruikers over hergebruik van proceswater.',
              'waterbesparing', 'S0', 2.0, 2035, True, 'verkenning', 'alle',
              politiek='Bedrijven vragen een overgangstermijn.', eff=[('Bedrijven', 'aandacht', 'Investering in hergebruik nodig.')]),
    maatregel('slimme-meters', 'Slimme watermeters', 'Inzicht in verbruik en lekverlies met slimme meters.',
              'waterbesparing', 'S0', 1.0, 2032, False, 'idee', 'alle', eff=[('Privacy', 'aandacht', 'Meetgegevens vragen zorgvuldige omgang.')]),
    # S1 – afnames van bestaande winningen (aanbod omlaag)
    maatregel('afname-schaapsdrift', 'Sluiting Schaapsdrift (natuur)', 'Winning sluit om verdroging van het nabije natuurgebied te stoppen.',
              'afname', 'S1', 2.0, 2030, True, 'besloten', 'West', winning='Schaapsdrift'),
    maatregel('afname-eikenrode', 'Lagere vergunning Eikenrode', 'Vergunning wordt verlaagd vanwege landbouwschade.',
              'afname', 'S1', 2.5, 2035, True, 'verkenning', 'Midden', winning='Eikenrode'),
    maatregel('afname-kavel-zeven', 'Einde levensduur Kavel Zeven', 'Zuivering is aan het einde van de levensduur en sluit.',
              'afname', 'S1', 5.0, 2040, True, 'verkenning', 'Noord', winning='Kavel Zeven'),
    maatregel('afname-heidepoort', 'Verontreiniging Heidepoort', 'Toenemende verontreiniging; een deel van de putten valt weg.',
              'afname', 'S1', 1.5, 2045, True, 'idee', 'Zuid', winning='Heidepoort'),
    # S1 – instandhouding (aanbod terug op peil)
    maatregel('herbouw-kavel-zeven', 'Herbouw zuivering Kavel Zeven', 'Nieuwe zuivering op hetzelfde terrein, zodat de winning in bedrijf blijft.',
              'waterlevering', 'S1', 5.0, 2042, True, 'verkenning', 'Noord', winning='Kavel Zeven', bron='grondwater', ha=1.5, mw=0.8,
              voetafdruk=voet(GW0, ('in of grenst aan', 'Bestaande winning in de zone.'), N0, NET),
              politiek='Raad steunt behoud van de winning.', eff=[('Bouwverkeer', 'aandacht', 'Twee jaar bouwverkeer.')]),
    # S2 – vergroten op bestaande locatie
    maatregel('uitbreiding-wolfsberg', 'Uitbreiding Wolfsberg', 'Extra putten en een zuiveringsstraat op het bestaande terrein.',
              'waterlevering', 'S2', 3.0, 2034, True, 'verkenning', 'Oost', winning='Wolfsberg', bron='grondwater', ha=2.0, mw=1.0,
              voetafdruk=voet(('beperkt', 'Verlaging tot enkele centimeters.'), ('in of grenst aan', 'Zone wordt iets groter.'), ('mogelijk', 'Natura 2000-gebied op 2 km.'), NET),
              eff=[('Natuur', 'aandacht', 'Monitoring van het nabije bos nodig.')]),
    maatregel('uitbreiding-lindewaard', 'Uitbreiding Lindewaard', 'Vergroten van de vergunning op de bestaande locatie.',
              'waterlevering', 'S2', 2.5, 2036, False, 'idee', 'West', winning='Lindewaard', bron='grondwater', ha=1.0, mw=0.6,
              voetafdruk=voet(('significant', 'Verlaging tot in het natuurgebied.'), ('in of grenst aan', 'Zone moet worden vergroot.'), ('waarschijnlijk', 'Natuurgebied grenst aan de winning.'), NET),
              politiek='Verwachte weerstand van natuurorganisaties.', eff=[('Natuur', 'knelpunt', 'Verdroging van vennen.'), ('Woningbouw', 'kans', 'Maakt een nieuwe wijk mogelijk.')]),
    # S3 – nieuwe winlocatie
    maatregel('winning-veldhoven-oost', 'Nieuwe winning Veldhoven-Oost', 'Nieuwe grondwaterwinning met zuivering in het oosten van cluster Midden.',
              'waterlevering', 'S3', 6.0, 2038, True, 'verkenning', 'Midden', gemeente='Veldhoven-Oost', locatie={'lat': 52.17, 'lon': 5.47},
              bron='grondwater', ha=12.0, mw=1.8,
              voetafdruk=voet(('beperkt', 'Verlaging tot 5 cm op 500 m.'), BUITEN, ('mogelijk', 'Beekdal op 2 km.'), ('onvoldoende', 'Nieuw onderstation nodig.')),
              politiek='Raad wil eerst uitsluitsel over landbouwschade.',
              eff=[('Doorlooptijd', 'knelpunt', 'Vergunningtraject van ongeveer acht jaar.'), ('Landbouw', 'aandacht', 'Beperkingen in de nieuwe beschermingszone.'), ('Woningbouw', 'kans', 'Maakt aansluiting van nieuwbouw mogelijk.')]),
    maatregel('oeverwinning-westmeer', 'Oeverwinning Westmeer', 'Nieuwe oevergrondwaterwinning langs het meer.',
              'waterlevering', 'S3', 5.0, 2042, False, 'idee', 'West', gemeente='Westmeer', locatie={'lat': 52.10, 'lon': 4.82},
              bron='oevergrondwater', ha=15.0, mw=2.5,
              voetafdruk=voet(('beperkt', 'Vooral invloed op het peil van het meer.'), ('in of grenst aan', 'Nieuwe zone rond het meer.'), ('waarschijnlijk', 'Meer is beschermd gebied.'), ('krap', 'Aansluiting na netverzwaring.')),
              eff=[('Recreatie', 'knelpunt', 'Deel van de oever niet meer toegankelijk.')]),
    maatregel('oppervlaktewater-noord', 'Oppervlaktewater Noordvaart', 'Inname en zuivering van water uit de Noordvaart.',
              'waterlevering', 'S3', 10.0, 2045, False, 'idee', 'Noord', gemeente='Noordvaart', locatie={'lat': 52.50, 'lon': 5.66},
              bron='oppervlaktewater', ha=20.0, mw=4.0,
              voetafdruk=voet(GW0, BUITEN, ('mogelijk', 'Natuurgebied langs de vaart.'), ('onvoldoende', 'Grote aansluiting nodig.')),
              politiek='Past in de regionale strategie; kosten zijn een zorg.',
              eff=[('Energie', 'knelpunt', 'Hoge stroomvraag van de zuivering.'), ('Grondwater', 'kans', 'Ontlast de grondwatervoorraad.')]),
    # andere leverancier: zichtbaar, niet meegerekend (v1)
    maatregel('oasen-levering-west', 'Levering Oasen naar West', 'Water van een buurbedrijf via een nieuwe verbinding.',
              'waterlevering', 'S3', 2.0, 2035, True, 'idee', 'West', gemeente='Grensdorp', locatie={'lat': 51.99, 'lon': 4.86},
              bron='overig', ha=0.5, mw=0.3, voetafdruk=voet(GW0, BUITEN, N0, NET), leverancier='Oasen'),
]

data = {
    'meta': {'naam': 'Voorbeelddata (fictief)', 'schema_versie': 2, 'datum_import': '2026-11-12',
             'bron': 'Verzonnen namen en waarden, alleen om de tool te tonen', 'voorbeelddata': True},
    'winningen': winningen,
    'vraag': vraag,
    'maatregelen': M,
}
io.open(sys.argv[1], 'w', encoding='utf-8', newline='\n').write(json.dumps(data, ensure_ascii=False, indent=1) + '\n')
tot = lambda s, j: sum(r[str(j)] for r in vraag if r['scenario'] == s)
print('capaciteit', round(sum(w[2] for w in WIN), 2), '| winningen', len(WIN), '| maatregelen', len(M))
for s, _, _ in SCENARIOS:
    print(f'{s:14s}', [round(tot(s, j), 1) for j in JAREN])
