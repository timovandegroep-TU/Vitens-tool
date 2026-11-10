# Schrijft data/voorbeeld.json (volledig fictief; namen en waarden zijn verzonnen).
# Gebruik: python tools/maak_voorbeeld.py data/voorbeeld.json  en daarna  node tests/voorbeeld.test.mjs --bijwerken
import json, io, sys

CRIT = [
    ("instandhouding-intern", "Instandhouding (intern)", "Assets", "Einde levensduur en herbouw van eigen installaties"),
    ("instandhouding-extern", "Instandhouding (extern)", "Assets", "Verstoringen van buitenaf"),
    ("natuur", "Natuur", "Grondwaterkwantiteit", "Verdroging in natuurgebieden"),
    ("landbouw", "Landbouw", "Grondwaterkwantiteit", "Landbouwschade"),
    ("bebouwing", "Bebouwing (paalrot)", "Grondwaterkwantiteit", "Paalrot"),
    ("bodemdaling", "Bodemdaling", "Grondwaterkwantiteit", "Bodemdalingsschade"),
    ("grondwaterkwaliteit", "Grondwaterkwaliteit", "Grondwaterkwaliteit", "Risico op verontreiniging"),
    ("onbekend", "Incidentele verontreiniging", "Grondwaterkwaliteit", "Fictief criterium"),
    ("oppervlaktewaterkwaliteit", "Oppervlaktewaterkwaliteit", "Oppervlaktewaterkwaliteit", "Verontreiniging oppervlaktewater"),
]
CLUSTERS = [("noordrand", "Noordrand"), ("middengebied", "Middengebied"), ("zuidoever", "Zuidoever")]
GEM = [  # naam, cluster, lat, lon
    ("Waterdorp", "noordrand", 52.19, 5.20), ("Duinrode", "noordrand", 52.16, 5.38),
    ("Bronhuizen", "middengebied", 52.09, 5.02), ("Veenwijk", "middengebied", 52.07, 5.22),
    ("Rivierstad", "zuidoever", 51.97, 5.12), ("Heuvelbroek", "zuidoever", 52.01, 5.44),
]
WIN = [  # id, locatie, gemeente, watersysteem, vergunning, niet_inzetbaar, lat, lon
    ("waterdorp-noord", "Waterdorp Noord", "Waterdorp", "Heuvelrug", 9.0, 1.0, 52.205, 5.18),
    ("waterdorp-plas", "Waterdorp Plas", "Waterdorp", "Flanken", 5.0, 0, 52.18, 5.25),
    ("duinrode", "Duinrode", "Duinrode", "Heuvelrug", 7.0, 0.5, 52.15, 5.40),
    ("bronhuizen", "Bronhuizen", "Bronhuizen", "Polder", 6.0, 0, 52.10, 5.00),
    ("veenwijk-oost", "Veenwijk Oost", "Veenwijk", "Flanken", 8.0, 0, 52.06, 5.26),
    ("veenwijk-west", "Veenwijk West", "Veenwijk", "Polder", 4.0, 1.0, 52.08, 5.17),
    ("rivierstad", "Rivierstad", "Rivierstad", "Rivierengebied", 10.0, 0, 51.96, 5.10),
    ("heuvelbroek", "Heuvelbroek", "Heuvelbroek", "Flanken", 6.0, 0, 52.02, 5.46),
]
cluster_van = {g[0]: g[1] for g in GEM}

# reductiefactoren per narratief: {winning: {criterium: [2030, 2040, 2050]}}
RF = {
    "1": {
        "waterdorp-noord": {"natuur": [0.9, 0.75, 0.75], "instandhouding-intern": [1, 0.9, 0.9]},
        "waterdorp-plas": {"oppervlaktewaterkwaliteit": [1, 0.9, 0.75]},
        "duinrode": {"natuur": [0.9, 0.9, 0.75]},
        "bronhuizen": {"bodemdaling": [0.75, 0.5, 0.5], "bebouwing": [1, 0.9, 0.9]},
        "veenwijk-oost": {"landbouw": [0.9, 0.9, 0.9]},
        "veenwijk-west": {"instandhouding-intern": [1, 0, 0]},
        "rivierstad": {"grondwaterkwaliteit": [1, 0.9, 0.75]},
        "heuvelbroek": {"instandhouding-extern": [1, 1, 0.9]},
    },
    "2": {
        "waterdorp-noord": {"natuur": [0.9, 0.75, 0.5]},
        "waterdorp-plas": {"oppervlaktewaterkwaliteit": [0.9, 0.75, 0.75]},
        "duinrode": {"natuur": [0.9, 0.75, 0.75]},
        "bronhuizen": {"bodemdaling": [0.75, 0.5, 0.5]},
        "veenwijk-oost": {"landbouw": [0.9, 0.75, 0.75]},
        "veenwijk-west": {"instandhouding-intern": [1, 0, 0]},
        "rivierstad": {"grondwaterkwaliteit": [0.9, 0.9, 0.75]},
    },
    "3": {
        "waterdorp-noord": {"natuur": [1, 0.9, 0.9]},
        "bronhuizen": {"bodemdaling": [0.9, 0.75, 0.75]},
        "veenwijk-west": {"instandhouding-intern": [1, 0.5, 0.5]},
        "rivierstad": {"grondwaterkwaliteit": [1, 1, 0.9]},
    },
    "4": {
        "waterdorp-noord": {"natuur": [0.9, 0.9, 0.75]},
        "duinrode": {"natuur": [1, 0.9, 0.9]},
        "bronhuizen": {"bodemdaling": [0.9, 0.75, 0.5]},
        "veenwijk-west": {"instandhouding-intern": [1, 0.5, 0]},
        "rivierstad": {"grondwaterkwaliteit": [1, 0.9, 0.9]},
    },
}

# volledig invullen (geen lege cellen): ontbrekend = 1
RF = {n: {w[0]: {c[0]: RF[n].get(w[0], {}).get(c[0], [1, 1, 1]) for c in CRIT} for w in WIN} for n in RF}

# vraag: start 2025 per cluster en groei per 5 jaar per narratief
START = {"noordrand": 16.0, "middengebied": 15.0, "zuidoever": 13.0}
GROEI = {"1": 0.035, "2": 0.055, "3": 0.005, "4": 0.025}
JAREN = [2025, 2030, 2035, 2040, 2045, 2050]
vraag = {n: {c: {str(j): round(v0 * (1 + g) ** i, 1) for i, j in enumerate(JAREN)} for c, v0 in START.items()} for n, g in GROEI.items()}

META = {"aangeleverd_door": "J. Voorbeeld (fictief)", "datum": "2026-11-10", "bron": "Fictief projectenoverzicht"}
ALLE = [1, 2, 3, 4]

def vt(gw, bz, n2, net):
    t = lambda b, s: {"beoordeling": b, "toelichting": s, "bron": "Fictieve quickscan"}
    return {"grondwater": t(*gw), "beschermingszone": t(*bz), "natura2000": t(*n2), "netcapaciteit": t(*net)}

def levering(id, naam, oms, spoor, gemeente, lat, lon, bron, volume, ha, mw, jaar, aan, status, voet, politiek, effecten, narr=ALLE):
    return {"id": id, "naam": naam, "omschrijving": oms, "leverancier": "Vitens", "soort": "waterlevering", "spoor": spoor,
            "narratieven": narr, "standaard_aan": aan, "status": status, "locatie": {"lat": lat, "lon": lon}, "gemeente": gemeente,
            "cluster": cluster_van[gemeente], "bron": bron, "volume": volume, "ruimtebeslag": ha, "stroomvraag": mw, "ingangsjaar": jaar,
            "voetafdruk": voet, "overige_effecten": {"politiek": politiek, "lijst": [{"label": l, "beoordeling": b, "tekst": t} for l, b, t in effecten]},
            "meta": dict(META)}

def besparing(id, naam, oms, volume, jaar, aan, status, politiek, effecten, narr=ALLE):
    return {"id": id, "naam": naam, "omschrijving": oms, "leverancier": "Vitens", "soort": "waterbesparing", "spoor": "S0",
            "narratieven": narr, "standaard_aan": aan, "status": status, "locatie": None, "gemeente": None, "cluster": "alle",
            "bron": None, "volume": volume, "ruimtebeslag": None, "stroomvraag": None, "ingangsjaar": jaar, "voetafdruk": None,
            "overige_effecten": {"politiek": politiek, "lijst": [{"label": l, "beoordeling": b, "tekst": t} for l, b, t in effecten]},
            "meta": dict(META)}

GEEN = ("geen effect", "Geen extra onttrekking."); BUITEN = ("buiten", "Ligt buiten de zones."); N0 = ("geen invloed", "Geen gebied in de buurt."); NET = ("voldoende", "Bestaande aansluiting volstaat.")
M = [
    besparing("besparing-huishoudens", "Waterbesparing huishoudens", "Campagnes en waterbesparende toestellen bij huishoudens.", 2.0, 2030, True, "besloten",
              "Breed draagvlak in de regio.", [("Huishoudens", "aandacht", "Vraagt gedragsverandering van bewoners.")]),
    besparing("besparing-bedrijven", "Waterbesparing bedrijven", "Afspraken met grootverbruikers over hergebruik van proceswater.", 1.0, 2035, False, "verkenning",
              "Bedrijven vragen om een overgangstermijn.", [("Bedrijven", "aandacht", "Investering in hergebruik nodig."), ("Economie", "kans", "Minder afhankelijk van drinkwater.")]),
    besparing("slimme-meters", "Slimme watermeters", "Inzicht in verbruik en lekverlies met slimme meters.", 0.6, 2032, False, "idee",
              "Nog niet besproken.", [("Privacy", "aandacht", "Meetgegevens vragen zorgvuldige omgang.")], narr=[1, 2]),
    levering("renovatie-veenwijk-west", "Renovatie Veenwijk West", "Vervangen van putten en zuivering zodat de winning in bedrijf blijft.", "S1", "Veenwijk", 52.08, 5.17, "grondwater", 1.5, 0.5, 0.4, 2038, True, "besloten",
             vt(GEEN, ("in of grenst aan", "Bestaande winning in de zone."), N0, NET), "Raad steunt behoud van de winning.",
             [("Bouwverkeer", "aandacht", "Twee jaar bouwverkeer door de kern.")]),
    levering("herstel-bronhuizen", "Herstel putten Bronhuizen", "Nieuwe putten op het bestaande terrein tegen verstopping.", "S1", "Bronhuizen", 52.10, 5.00, "grondwater", 1.0, 0.2, 0.2, 2033, False, "verkenning",
             vt(GEEN, ("in of grenst aan", "Bestaande winning in de zone."), N0, NET), "Geen bezwaren bekend.", []),
    levering("uitbreiding-rivierstad", "Uitbreiding Rivierstad", "Extra zuiveringsstraat op de bestaande locatie.", "S2", "Rivierstad", 51.96, 5.10, "oevergrondwater", 3.0, 2.0, 1.2, 2034, True, "verkenning",
             vt(("beperkt", "Verlaging tot enkele centimeters."), BUITEN, ("mogelijk", "Uiterwaard op 1,5 km."), ("krap", "Aansluiting na netverzwaring.")), "Gemeente wil afspraken over de uiterwaard.",
             [("Recreatie", "kans", "Nieuw wandelpad langs het terrein."), ("Landbouw", "aandacht", "Mogelijke droogteschade op naastgelegen percelen.")]),
    levering("uitbreiding-duinrode", "Uitbreiding Duinrode", "Vergroten van de vergunning op de bestaande locatie.", "S2", "Duinrode", 52.15, 5.40, "grondwater", 2.0, 1.0, 0.6, 2036, False, "idee",
             vt(("significant", "Verlaging tot in het natuurgebied."), ("in of grenst aan", "Zone moet worden vergroot."), ("waarschijnlijk", "Natuurgebied grenst aan de winning."), NET), "Verwachte weerstand van natuurorganisaties.",
             [("Natuur", "knelpunt", "Verdroging van vennen."), ("Woningbouw", "kans", "Maakt een nieuwe wijk mogelijk.")]),
    levering("winning-heuvelbroek-zuid", "Nieuwe winning Heuvelbroek Zuid", "Nieuwe grondwaterwinning met zuivering ten zuiden van Heuvelbroek.", "S3", "Heuvelbroek", 51.99, 5.48, "grondwater", 4.0, 12.0, 1.8, 2040, True, "verkenning",
             vt(("beperkt", "Verlaging tot 5 cm op 500 m."), BUITEN, ("mogelijk", "Beekdal op 2 km."), ("onvoldoende", "Nieuw onderstation nodig.")), "Raad wil eerst uitsluitsel over landbouwschade.",
             [("Doorlooptijd", "knelpunt", "Vergunningtraject van ongeveer acht jaar."), ("Landbouw", "aandacht", "Beperkingen in de nieuwe beschermingszone."), ("Woningbouw", "kans", "Maakt aansluiting van nieuwbouw mogelijk.")]),
    levering("oeverwinning-waterdorp", "Oeverwinning Waterdorp", "Nieuwe oevergrondwaterwinning langs de plas.", "S3", "Waterdorp", 52.17, 5.28, "oevergrondwater", 5.0, 15.0, 2.5, 2042, False, "idee",
             vt(("beperkt", "Vooral invloed op het peil van de plas."), ("in of grenst aan", "Nieuwe zone rond de plas."), ("waarschijnlijk", "Plas is beschermd gebied."), ("krap", "Aansluiting na netverzwaring.")), "Nog geen standpunt.",
             [("Recreatie", "knelpunt", "Deel van de oever niet meer toegankelijk."), ("Natuur", "aandacht", "Onderzoek naar effect op de plas nodig.")]),
    levering("oppervlaktewater-rivierstad", "Oppervlaktewater Rivierstad", "Inname en zuivering van rivierwater.", "S3", "Rivierstad", 51.95, 5.15, "oppervlaktewater", 6.0, 20.0, 4.0, 2045, False, "idee",
             vt(GEEN, BUITEN, ("mogelijk", "Uiterwaard naast het innamepunt."), ("onvoldoende", "Grote aansluiting nodig.")), "Past in de regionale strategie, kosten zijn een zorg.",
             [("Energie", "knelpunt", "Hoge stroomvraag van de zuivering."), ("Grondwater", "kans", "Ontlast de grondwatervoorraad.")], narr=[1, 2]),
]

data = {
    "meta": {"naam": "Voorbeelddata (fictief)", "schema_versie": 1, "datum_import": "2026-11-10",
             "bron": "Verzonnen namen en waarden, alleen om de tool te tonen", "voorbeelddata": True},
    "narratieven": [
        {"id": 1, "naam": "Ruim in conflict", "deltascenario": "Scenario A", "lpppd_doel": 130, "toelichting": "Fictief: sterke groei, weinig samenwerking"},
        {"id": 2, "naam": "Stoom in conflict", "deltascenario": "Scenario B", "lpppd_doel": 130, "toelichting": "Fictief: zeer sterke groei, weinig samenwerking"},
        {"id": 3, "naam": "Ruim in harmonie", "deltascenario": "Scenario A", "lpppd_doel": 110, "toelichting": "Fictief: beperkte groei, veel samenwerking"},
        {"id": 4, "naam": "Stoom in harmonie", "deltascenario": "Scenario B", "lpppd_doel": 110, "toelichting": "Fictief: gematigde groei, veel samenwerking"},
    ],
    "clusters": [{"id": i, "naam": n} for i, n in CLUSTERS],
    "gemeenten": [{"gemeente": g, "cluster": c, "lat": la, "lon": lo, "te_controleren": False} for g, c, la, lo in GEM],
    "criteria": [{"id": i, "naam": n, "groep": g, "toelichting": t} for i, n, g, t in CRIT],
    "winningen": [{"id": i, "locatie": l, "gemeente": g, "type": "Winning", "cluster": cluster_van[g], "watersysteem": w, "vergunning": v,
                   "niet_inzetbaar": ni, "capaciteit": v - ni, "lat": la, "lon": lo, "te_controleren": False, "toelichting": ""}
                  for i, l, g, w, v, ni, la, lo in WIN],
    "reductiefactoren": RF,
    "vraag": vraag,
    "maatregelen": M,
}
io.open(sys.argv[1], "w", encoding="utf-8", newline="\n").write(json.dumps(data, ensure_ascii=False, indent=1) + "\n")
print("winningen", len(WIN), "capaciteit", sum(w[4] - w[5] for w in WIN), "maatregelen", len(M))
