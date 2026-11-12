# Schrijft data/voorbeeld.json in het formaat van de tool (schema 2).
#   Winningen:   de winningen uit het werkdocument V04_1 (aangeleverd door de opdrachtgever,
#                12-11-2026). Gemeente en coördinaten zijn benaderd op plaatsnaam.
#   Vraag:       FICTIEF: vier vraagscenario's, orde van grootte als het werkdocument.
#   Maatregelen: FICTIEF: verzonnen voorbeelden op echte winningen en verzonnen nieuwe locaties.
#
# Gebruik:  python tools/maak_voorbeeld.py data/voorbeeld.json
# daarna:   node tests/voorbeeld.test.mjs --bijwerken   (snapshot bijwerken)
import io, json, sys

JAREN = [2025, 2030, 2035, 2040, 2045, 2050]

# ------------------------------------------------------------------ vraag
# vraag 2025 per cluster (Mm³/j) en hoe hard het cluster meegroeit met het scenario
CLUSTERS = {            # naam: (vraag 2025, groeigevoeligheid)
    'Utrecht West':                 (46.5, 1.10),
    'Utrecht Zuid':                 (16.6, 0.80),
    'Utrecht Randmeren Utrecht':    (32.5, 1.00),
    'Utrecht Randmeren Gelderland': (14.6, 0.90),
    'Flevoland':                    (28.0, 1.20),
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
# Werkdocument: Locatie, Type, Vitens cluster (gebruik), Watersysteem, Huidig aanbod, Inzetbare productiecapaciteit
WERKDOCUMENT = """
Bremerberg	Winning	Flevoland	Polder	8	7
Fledite	Winning	Flevoland	Polder	11	11
Harderbroek	Winning	Flevoland	Polder	10	10
Harderwijk	Winning	Utrecht Randmeren Gelderland	Flanken	5	5
Putten	Winning	Utrecht Randmeren Gelderland	Flanken	3,5	3,5
Fledite ROL	Winning	Utrecht Randmeren Gelderland	Polder	2,2	2,2
Holk	Winning	Utrecht Randmeren Gelderland	Polder	5	5
Amersfoort Koedijkerweg	Winning	Utrecht Randmeren Utrecht	Flanken	1,5	1,5
Laren	Winning	Utrecht Randmeren Utrecht	Flanken	2	2
Loosdrecht	Winning	Utrecht Randmeren Utrecht	Flanken	2,2	2,2
Amersfoort Berg	Winning	Utrecht Randmeren Utrecht	Heuvelrug	1,5	1,5
Soestduinen	Winning	Utrecht Randmeren Utrecht	Heuvelrug	9	9
Eemdijk	Winning	Utrecht Randmeren Utrecht	Polder	5	5
Fledite ROL	Winning	Utrecht Randmeren Utrecht	Polder	1,8	1,8
Spiekzand ROL	Winning	Utrecht Randmeren Utrecht	Polder	5	5
Beerschoten	Winning	Utrecht West	Flanken	8	8
Bilthoven	Winning	Utrecht West	Flanken	2	1,2
Benschop	Winning	Utrecht West	Polder	3	0
Groenekan	Winning	Utrecht West	Polder	7,5	6
Linschoten	Winning	Utrecht West	Polder	10	10
Bunnik	Winning	Utrecht West	Riviergebied	3,5	3,5
De Meern	Winning	Utrecht West	Riviergebied	1,9	1,9
Leidsche Rijn	Winning	Utrecht West	Riviergebied	5,3	5
Nieuwegein	Winning	Utrecht West	Riviergebied	2,5	2,5
Tull en 't Waal	Winning	Utrecht West	Riviergebied	6	6
Driebergen	Winning	Utrecht Zuid	Flanken	0,9	0,9
Leersum	Winning	Utrecht Zuid	Flanken	0,8	0,8
Veenendaal	Winning	Utrecht Zuid	Flanken	3	3
Woudenberg	Winning	Utrecht Zuid	Flanken	3,4	2,2
Zeist	Winning	Utrecht Zuid	Flanken	5	5
Rhenen	Winning	Utrecht Zuid	Heuvelrug	2	2
Cothen	Winning	Utrecht Zuid	Riviergebied	3	3
"""

# Benaderde ligging op plaatsnaam (gemeente, lat, lon); staat niet in het werkdocument.
LIGGING = {
    'Amersfoort Berg': ('Amersfoort', 52.14, 5.37), 'Amersfoort Koedijkerweg': ('Amersfoort', 52.18, 5.40),
    'Beerschoten': ('De Bilt', 52.09, 5.20), 'Benschop': ('Lopik', 52.01, 4.98), 'Bilthoven': ('De Bilt', 52.13, 5.20),
    'Bremerberg': ('Dronten', 52.42, 5.65), 'Bunnik': ('Bunnik', 52.07, 5.20), 'Cothen': ('Wijk bij Duurstede', 52.00, 5.31),
    'De Meern': ('Utrecht', 52.08, 5.03), 'Driebergen': ('Utrechtse Heuvelrug', 52.05, 5.28), 'Eemdijk': ('Bunschoten', 52.25, 5.33),
    'Fledite': ('Zeewolde', 52.30, 5.42), 'Fledite ROL': ('Zeewolde', 52.30, 5.42), 'Groenekan': ('De Bilt', 52.12, 5.15),
    'Harderbroek': ('Zeewolde', 52.37, 5.57), 'Harderwijk': ('Harderwijk', 52.34, 5.62), 'Holk': ('Nijkerk', 52.23, 5.45),
    'Laren': ('Laren', 52.26, 5.23), 'Leersum': ('Utrechtse Heuvelrug', 52.01, 5.43), 'Leidsche Rijn': ('Utrecht', 52.10, 5.05),
    'Linschoten': ('Montfoort', 52.06, 4.91), 'Loosdrecht': ('Wijdemeren', 52.20, 5.12), 'Nieuwegein': ('Nieuwegein', 52.03, 5.09),
    'Putten': ('Putten', 52.26, 5.61), 'Rhenen': ('Rhenen', 51.96, 5.57), 'Soestduinen': ('Soest', 52.15, 5.30),
    'Spiekzand ROL': ('Zeewolde', 52.33, 5.50), "Tull en 't Waal": ('Houten', 52.00, 5.13), 'Veenendaal': ('Veenendaal', 52.03, 5.55),
    'Woudenberg': ('Woudenberg', 52.08, 5.42), 'Zeist': ('Zeist', 52.09, 5.24),
}

getal = lambda t: float(t.replace(',', '.'))
winningen = []
for regel in WERKDOCUMENT.strip().splitlines():
    naam, typ, cluster, systeem, huidig, cap = regel.split('\t')
    gem, la, lo = LIGGING[naam]
    winningen.append({'naam': naam, 'type': typ, 'cluster': cluster, 'watersysteem': systeem,
                      'huidig_aanbod': getal(huidig), 'capaciteit': getal(cap), 'gemeente': gem,
                      'lat': la, 'lon': lo, 'toelichting': 'Ligging benaderd op plaatsnaam.'})
assert len(winningen) == 32 and abs(sum(w['capaciteit'] for w in winningen) - 132.7) < 1e-9

# ------------------------------------------------------------ maatregelen
META = {'aangeleverd_door': 'J. Voorbeeld (fictief)', 'datum': '2026-11-12', 'bron': 'Fictief voorbeeld, geen echte plannen'}
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
    maatregel('besparing-huishoudens', 'Waterbesparing huishoudens', 'Fictief voorbeeld: campagnes en waterbesparende toestellen bij huishoudens.',
              'waterbesparing', 'S0', 6.0, 2030, True, 'besloten', 'alle',
              politiek='Breed draagvlak in de regio.', eff=[('Huishoudens', 'aandacht', 'Vraagt gedragsverandering van bewoners.')]),
    maatregel('besparing-bedrijven', 'Waterbesparing bedrijven', 'Fictief voorbeeld: afspraken met grootverbruikers over hergebruik van proceswater.',
              'waterbesparing', 'S0', 2.0, 2035, True, 'verkenning', 'alle',
              politiek='Bedrijven vragen een overgangstermijn.', eff=[('Bedrijven', 'aandacht', 'Investering in hergebruik nodig.')]),
    maatregel('slimme-meters', 'Slimme watermeters', 'Fictief voorbeeld: inzicht in verbruik en lekverlies met slimme meters.',
              'waterbesparing', 'S0', 1.0, 2032, False, 'idee', 'alle', eff=[('Privacy', 'aandacht', 'Meetgegevens vragen zorgvuldige omgang.')]),
    # S1 – afnames van bestaande winningen (aanbod omlaag)
    maatregel('afname-de-meern', 'Sluiting De Meern', 'Fictief voorbeeld: de winning sluit om verdroging van een natuurgebied te stoppen.',
              'afname', 'S1', 1.9, 2030, True, 'besloten', 'Utrecht West', winning='De Meern'),
    maatregel('afname-soestduinen', 'Lagere vergunning Soestduinen', 'Fictief voorbeeld: de vergunning wordt verlaagd vanwege landbouwschade.',
              'afname', 'S1', 2.5, 2035, True, 'verkenning', 'Utrecht Randmeren Utrecht', winning='Soestduinen'),
    maatregel('afname-harderbroek', 'Einde levensduur Harderbroek', 'Fictief voorbeeld: de zuivering is aan het einde van de levensduur en sluit.',
              'afname', 'S1', 5.0, 2040, True, 'verkenning', 'Flevoland', winning='Harderbroek'),
    maatregel('afname-zeist', 'Verontreiniging Zeist', 'Fictief voorbeeld: door verontreiniging valt een deel van de putten weg.',
              'afname', 'S1', 1.5, 2045, True, 'idee', 'Utrecht Zuid', winning='Zeist'),
    # S1 – instandhouding (aanbod terug op peil)
    maatregel('herbouw-harderbroek', 'Herbouw zuivering Harderbroek', 'Fictief voorbeeld: nieuwe zuivering op hetzelfde terrein, zodat de winning in bedrijf blijft.',
              'waterlevering', 'S1', 5.0, 2042, True, 'verkenning', 'Flevoland', winning='Harderbroek', bron='grondwater', ha=1.5, mw=0.8,
              voetafdruk=voet(GW0, ('in of grenst aan', 'Bestaande winning in de zone.'), N0, NET),
              politiek='Raad steunt behoud van de winning.', eff=[('Bouwverkeer', 'aandacht', 'Twee jaar bouwverkeer.')]),
    # S2 – vergroten op bestaande locatie
    maatregel('uitbreiding-harderwijk', 'Uitbreiding Harderwijk', 'Fictief voorbeeld: extra putten en een zuiveringsstraat op het bestaande terrein.',
              'waterlevering', 'S2', 3.0, 2034, True, 'verkenning', 'Utrecht Randmeren Gelderland', winning='Harderwijk', bron='grondwater', ha=2.0, mw=1.0,
              voetafdruk=voet(('beperkt', 'Verlaging tot enkele centimeters.'), ('in of grenst aan', 'Zone wordt iets groter.'), ('mogelijk', 'Natura 2000-gebied op 2 km.'), NET),
              eff=[('Natuur', 'aandacht', 'Monitoring van het nabije bos nodig.')]),
    maatregel('uitbreiding-linschoten', 'Uitbreiding Linschoten', 'Fictief voorbeeld: vergroten van de vergunning op de bestaande locatie.',
              'waterlevering', 'S2', 2.5, 2036, False, 'idee', 'Utrecht West', winning='Linschoten', bron='grondwater', ha=1.0, mw=0.6,
              voetafdruk=voet(('significant', 'Verlaging tot in het natuurgebied.'), ('in of grenst aan', 'Zone moet worden vergroot.'), ('waarschijnlijk', 'Natuurgebied grenst aan de winning.'), NET),
              politiek='Verwachte weerstand van natuurorganisaties.', eff=[('Natuur', 'knelpunt', 'Verdroging van vennen.'), ('Woningbouw', 'kans', 'Maakt een nieuwe wijk mogelijk.')]),
    # S3 – nieuwe winlocatie
    maatregel('winning-heideveld', 'Nieuwe winning Heideveld', 'Fictief voorbeeld: nieuwe grondwaterwinning met zuivering op een verzonnen locatie.',
              'waterlevering', 'S3', 6.0, 2038, True, 'verkenning', 'Utrecht Randmeren Utrecht', gemeente='Heideveld (fictief)', locatie={'lat': 52.20, 'lon': 5.35},
              bron='grondwater', ha=12.0, mw=1.8,
              voetafdruk=voet(('beperkt', 'Verlaging tot 5 cm op 500 m.'), BUITEN, ('mogelijk', 'Beekdal op 2 km.'), ('onvoldoende', 'Nieuw onderstation nodig.')),
              politiek='Raad wil eerst uitsluitsel over landbouwschade.',
              eff=[('Doorlooptijd', 'knelpunt', 'Vergunningtraject van ongeveer acht jaar.'), ('Landbouw', 'aandacht', 'Beperkingen in de nieuwe beschermingszone.'), ('Woningbouw', 'kans', 'Maakt aansluiting van nieuwbouw mogelijk.')]),
    maatregel('oeverwinning-westmeer', 'Oeverwinning Westmeer', 'Fictief voorbeeld: nieuwe oevergrondwaterwinning langs een verzonnen meer.',
              'waterlevering', 'S3', 5.0, 2042, False, 'idee', 'Utrecht West', gemeente='Westmeer (fictief)', locatie={'lat': 52.12, 'lon': 4.92},
              bron='oevergrondwater', ha=15.0, mw=2.5,
              voetafdruk=voet(('beperkt', 'Vooral invloed op het peil van het meer.'), ('in of grenst aan', 'Nieuwe zone rond het meer.'), ('waarschijnlijk', 'Meer is beschermd gebied.'), ('krap', 'Aansluiting na netverzwaring.')),
              eff=[('Recreatie', 'knelpunt', 'Deel van de oever niet meer toegankelijk.')]),
    maatregel('oppervlaktewater-noordvaart', 'Oppervlaktewater Noordvaart', 'Fictief voorbeeld: inname en zuivering van water uit een verzonnen vaart.',
              'waterlevering', 'S3', 10.0, 2045, False, 'idee', 'Flevoland', gemeente='Noordvaart (fictief)', locatie={'lat': 52.45, 'lon': 5.55},
              bron='oppervlaktewater', ha=20.0, mw=4.0,
              voetafdruk=voet(GW0, BUITEN, ('mogelijk', 'Natuurgebied langs de vaart.'), ('onvoldoende', 'Grote aansluiting nodig.')),
              politiek='Past in de regionale strategie; kosten zijn een zorg.',
              eff=[('Energie', 'knelpunt', 'Hoge stroomvraag van de zuivering.'), ('Grondwater', 'kans', 'Ontlast de grondwatervoorraad.')]),
    # andere leverancier: zichtbaar, niet meegerekend (v1)
    maatregel('oasen-levering-west', 'Levering Oasen naar Utrecht West', 'Fictief voorbeeld: water van een buurbedrijf via een nieuwe verbinding.',
              'waterlevering', 'S3', 2.0, 2035, True, 'idee', 'Utrecht West', gemeente='Grensdorp (fictief)', locatie={'lat': 51.99, 'lon': 4.90},
              bron='overig', ha=0.5, mw=0.3, voetafdruk=voet(GW0, BUITEN, N0, NET), leverancier='Oasen'),
]

data = {
    'meta': {'naam': 'Voorbeelddata', 'schema_versie': 2, 'datum_import': '2026-11-12',
             'bron': 'Winningen: werkdocument V04_1. Vraagscenario\'s en maatregelen: fictief.', 'voorbeelddata': True},
    'winningen': winningen,
    'vraag': vraag,
    'maatregelen': M,
}
io.open(sys.argv[1], 'w', encoding='utf-8', newline='\n').write(json.dumps(data, ensure_ascii=False, indent=1) + '\n')
tot = lambda s, j: sum(r[str(j)] for r in vraag if r['scenario'] == s)
print('capaciteit', round(sum(w['capaciteit'] for w in winningen), 2), '| winningen', len(winningen), '| maatregelen', len(M))
for s, _, _ in SCENARIOS:
    print(f'{s:14s}', [round(tot(s, j), 1) for j in JAREN])
