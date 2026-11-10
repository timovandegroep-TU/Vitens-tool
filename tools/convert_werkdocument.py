#!/usr/bin/env python3
"""Eenmalige converter: werkdocument (Excel) -> private/data.json + gevuld template.

Gebruik (lokaal, vanuit de hoofdmap van de repo):

    pip install openpyxl
    python tools/convert_werkdocument.py [private/werkdocument.xlsx]

Leest het werkdocument "bepalen drinkwateropgave MGP V04_1" op VASTE celbereiken
en schrijft:

    private/data.json              dataset in de structuur van docs/datamodel.schema.json
    private/template-gevuld.xlsx   dezelfde data, een tabblad per tabel

Het script rekent het aanbod zelf na en vergelijkt met de acceptatietotalen.
Bij een afwijking stopt het met een foutmelding en schrijft het niets.

De uitvoer staat in private/ en mag nooit gecommit worden.
"""
import datetime
import json
import re
import sys
from pathlib import Path

try:
    from openpyxl import Workbook, load_workbook
    from openpyxl.utils import column_index_from_string as col
except ImportError:
    sys.exit("openpyxl ontbreekt. Installeer met: pip install openpyxl")

ROOT = Path(__file__).resolve().parent.parent
TOL = 0.001

# --------------------------------------------------------------------------
# Vaste indeling van het werkdocument
# --------------------------------------------------------------------------
NARRATIEFNAMEN = {1: "Ruim in conflict", 2: "Stoom in conflict", 3: "Ruim in harmonie", 4: "Stoom in harmonie"}
SHEET_WINNINGEN = "Naratief {n} - winningen"
SHEET_VRAAG = "Ontwikkeling van de vraag"
SHEET_VERGELIJKING = "Vergelijking naratieven "  # let op: spatie aan het eind
SHEET_MAATREGELEN = "Maatregelen en opgave"

RIJEN_WINNINGEN = range(4, 36)          # rij 4 t/m 35
PEILJAREN = [2030, 2040, 2050]
VRAAGJAREN = [2025, 2030, 2035, 2040, 2045, 2050]

# id, weergavenaam, korte naam, alle spellingen in de Excel
CLUSTERS = [
    ("utrecht-west", "Utrecht West", "UW", ["Utrecht West", "Cluster Utrecht West"]),
    ("utrecht-zuid", "Utrecht Zuid", "UZ", ["Utrecht Zuid", "Cluster Utrecht Zuid"]),
    ("rm-utrecht", "Utrecht Randmeren Utrecht", "RM-U",
     ["Utrecht Randmeren Utrecht", "Cluster Utrecht Randmeren Utrecht", "Utrecht RM U"]),
    ("rm-gelderland", "Utrecht Randmeren Gelderland", "RM-G",
     ["Utrecht Randmeren Gelderland", "Cluster Utrecht Randmeren Gelderland", "Utrecht RM G"]),
    ("flevoland", "Flevoland", "Flevoland", ["Flevoland", "Cluster Flevoland"]),
]
CLUSTER_ID = {s.lower(): cid for cid, _, _, spellingen in CLUSTERS for s in spellingen}
CLUSTER_KORT = {cid: kort for cid, _, kort, _ in CLUSTERS}

# id, naam, groep, eerste jaarkolom (2030) in 'Naratief N - winningen', cel met de koptekst
CRITERIA = [
    ("instandhouding-intern", "Instandhouding (intern)", "Assets", "H", "G2"),
    ("instandhouding-extern", "Instandhouding (extern)", "Assets", "L", "K2"),
    ("natuur", "Natuur", "Grondwaterkwantiteit", "P", "O2"),
    ("landbouw", "Landbouw", "Grondwaterkwantiteit", "T", "S2"),
    ("bebouwing", "Bebouwing (paalrot)", "Grondwaterkwantiteit", "X", "W2"),
    ("bodemdaling", "Bodemdaling", "Grondwaterkwantiteit", "AB", "AA2"),
    ("grondwaterkwaliteit", "Grondwaterkwaliteit", "Grondwaterkwaliteit", "AF", "AE2"),
    ("onbekend", "?? (betekenis onbekend)", "Grondwaterkwaliteit", "AJ", "AI2"),
    ("oppervlaktewaterkwaliteit", "Oppervlaktewaterkwaliteit", "Oppervlaktewaterkwaliteit", "AN", "AM2"),
]

# Vraagblokken in 'Ontwikkeling van de vraag': narratief -> (kolom clusternaam, eerste jaarkolom,
# eerste rij, cel lpppd-doel, cel deltascenario)
VRAAGBLOKKEN = {
    1: ("A", "B", 12, "E3", "B5"),
    2: ("A", "B", 37, "E28", "B30"),
    3: ("I", "J", 12, "M3", "J5"),
    4: ("I", "J", 37, "M28", "J30"),
}

# Maatregelen in 'Maatregelen en opgave': kolommen E-I = clusters in deze volgorde
MAATREGEL_CLUSTERKOLOMMEN = {"E": "utrecht-west", "F": "utrecht-zuid", "G": "rm-utrecht",
                             "H": "rm-gelderland", "I": "flevoland"}
RIJEN_BESPARING_HUISHOUDENS = [26, 27, 28, 29]   # narratief staat in kolom B (rij 28 = 4, rij 29 = 3!)
RIJ_BESPARING_BEDRIJVEN = 30
RIJ_RUIMTEGEBRUIK_MAX = 33
INGANGSJAAR_MAATREGELEN = 2040                   # aanname, zie OPEN-VRAGEN D1

# Gemeente en coordinaten staan NIET in het werkdocument. Benaderd op plaatsnaam
# (openbare informatie), alles "te controleren". (gemeente, lat, lon)
LOCATIES = {
    "Amersfoort Berg": ("Amersfoort", 52.14, 5.37),
    "Amersfoort Koedijkerweg": ("Amersfoort", 52.18, 5.40),
    "Beerschoten": ("De Bilt", 52.09, 5.20),
    "Benschop": ("Lopik", 52.01, 4.98),
    "Bilthoven": ("De Bilt", 52.13, 5.20),
    "Bremerberg": ("Dronten", 52.42, 5.65),
    "Bunnik": ("Bunnik", 52.07, 5.20),
    "Cothen": ("Wijk bij Duurstede", 52.00, 5.31),
    "De Meern": ("Utrecht", 52.08, 5.03),
    "Driebergen": ("Utrechtse Heuvelrug", 52.05, 5.28),
    "Eemdijk": ("Bunschoten", 52.25, 5.33),
    "Fledite": ("Zeewolde", 52.30, 5.42),
    "Fledite ROL": ("Zeewolde", 52.30, 5.42),
    "Groenekan": ("De Bilt", 52.12, 5.15),
    "Harderbroek": ("Zeewolde", 52.37, 5.57),
    "Harderwijk": ("Harderwijk", 52.34, 5.62),
    "Holk": ("Nijkerk", 52.23, 5.45),
    "Laren": ("Laren", 52.26, 5.23),
    "Leersum": ("Utrechtse Heuvelrug", 52.01, 5.43),
    "Leidsche Rijn": ("Utrecht", 52.10, 5.05),
    "Linschoten": ("Montfoort", 52.06, 4.91),
    "Loosdrecht": ("Wijdemeren", 52.20, 5.12),
    "Nieuwegein": ("Nieuwegein", 52.03, 5.09),
    "Putten": ("Putten", 52.26, 5.61),
    "Rhenen": ("Rhenen", 51.96, 5.57),
    "Soestduinen": ("Soest", 52.15, 5.30),
    "Spiekzand ROL": ("Zeewolde", 52.33, 5.50),
    "Tull en 't Waal": ("Houten", 52.00, 5.13),
    "Veenendaal": ("Veenendaal", 52.03, 5.55),
    "Woudenberg": ("Woudenberg", 52.08, 5.42),
    "Zeist": ("Zeist", 52.09, 5.24),
}

# Koppeltabel gemeente -> cluster: staat NIET in het werkdocument. Eerste schatting van het
# voorzieningsgebied, alles "te controleren". (gemeente, cluster, lat, lon)
GEMEENTEN = [
    ("Utrecht", "utrecht-west", 52.09, 5.12), ("De Bilt", "utrecht-west", 52.11, 5.18),
    ("Stichtse Vecht", "utrecht-west", 52.17, 5.03), ("De Ronde Venen", "utrecht-west", 52.21, 4.87),
    ("Woerden", "utrecht-west", 52.09, 4.88), ("Montfoort", "utrecht-west", 52.05, 4.95),
    ("Oudewater", "utrecht-west", 52.02, 4.87), ("Lopik", "utrecht-west", 51.98, 4.95),
    ("IJsselstein", "utrecht-west", 52.02, 5.04), ("Nieuwegein", "utrecht-west", 52.03, 5.09),
    ("Houten", "utrecht-west", 52.03, 5.17), ("Bunnik", "utrecht-west", 52.07, 5.20),
    ("Vijfheerenlanden", "utrecht-west", 51.92, 5.10),
    ("Zeist", "utrecht-zuid", 52.09, 5.24), ("Utrechtse Heuvelrug", "utrecht-zuid", 52.04, 5.36),
    ("Wijk bij Duurstede", "utrecht-zuid", 51.98, 5.34), ("Rhenen", "utrecht-zuid", 51.96, 5.57),
    ("Veenendaal", "utrecht-zuid", 52.03, 5.55), ("Renswoude", "utrecht-zuid", 52.07, 5.54),
    ("Woudenberg", "utrecht-zuid", 52.08, 5.42),
    ("Amersfoort", "rm-utrecht", 52.16, 5.39), ("Leusden", "rm-utrecht", 52.13, 5.43),
    ("Soest", "rm-utrecht", 52.17, 5.29), ("Baarn", "rm-utrecht", 52.21, 5.29),
    ("Bunschoten", "rm-utrecht", 52.24, 5.38), ("Eemnes", "rm-utrecht", 52.25, 5.26),
    ("Laren", "rm-utrecht", 52.26, 5.23), ("Wijdemeren", "rm-utrecht", 52.21, 5.10),
    ("Nijkerk", "rm-gelderland", 52.22, 5.49), ("Putten", "rm-gelderland", 52.26, 5.61),
    ("Ermelo", "rm-gelderland", 52.30, 5.62), ("Harderwijk", "rm-gelderland", 52.34, 5.62),
    ("Barneveld", "rm-gelderland", 52.14, 5.59),
    ("Almere", "flevoland", 52.37, 5.22), ("Zeewolde", "flevoland", 52.33, 5.54),
    ("Lelystad", "flevoland", 52.51, 5.47), ("Dronten", "flevoland", 52.52, 5.72),
]

# --------------------------------------------------------------------------
# Acceptatietotalen (uit de opdracht; bron: werkdocument V04_1)
# --------------------------------------------------------------------------
ACC_AANBOD = {  # narratief -> [2026, 2030, 2040, 2050]
    1: [132.7, 104.31, 92.265, 84.525],
    2: [132.7, 102.72, 90.765, 82.15],
    3: [132.7, 104.39, 88.33, 86.805],
    4: [132.7, 102.635, 87.1, 80.35],
}
ACC_OPGAVE = {  # aanbod - vraag: [huidig, 2030, 2040, 2050]
    1: [-5.764, -38.381, -56.625, -67.620],
    2: [-5.764, -44.349, -72.477, -95.774],
    3: [-5.764, -29.512, -43.645, -48.258],
    4: [-5.764, -35.443, -58.034, -78.438],
}
ACC_BILTHOVEN_N1 = [1.2, 1.08, 1.08, 0.90]
ACC_BESPARING_HH_N1 = 19.356


class Afwijking(Exception):
    pass


def slug(tekst):
    s = tekst.lower().replace("'", "")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def getal(ws, cel, verplicht=True):
    v = ws[cel].value
    if v is None or v == "":
        if verplicht:
            raise Afwijking(f"{ws.title}!{cel}: lege cel, getal verwacht")
        return None
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        raise Afwijking(f"{ws.title}!{cel}: '{v}' is geen getal")
    return float(v)


def cluster_id(ws, cel):
    naam = str(ws[cel].value or "").strip()
    try:
        return CLUSTER_ID[naam.lower()]
    except KeyError:
        raise Afwijking(f"{ws.title}!{cel}: onbekend cluster '{naam}'")


def schoon(x):
    """Rond floating-point-ruis weg (0.30000000000000004 -> 0.3)."""
    return None if x is None else round(x, 9)


def kolom(letter, offset=0):
    from openpyxl.utils import get_column_letter
    return get_column_letter(col(letter) + offset)


# --------------------------------------------------------------------------
# Inlezen
# --------------------------------------------------------------------------
def lees(pad):
    wb = load_workbook(pad, data_only=True)   # data_only: opgeslagen formule-uitkomsten
    vandaag = datetime.date.today().isoformat()
    data = {
        "meta": {"naam": "Werkdocument MGP V04_1", "schema_versie": 1, "datum_import": vandaag,
                 "bron": "Werkdocument bepalen drinkwateropgave MGP V04_1 (tools/convert_werkdocument.py)",
                 "voorbeelddata": False},
        "narratieven": [], "clusters": [{"id": c, "naam": n} for c, n, _, _ in CLUSTERS],
        "gemeenten": [{"gemeente": g, "cluster": c, "lat": la, "lon": lo, "te_controleren": True}
                      for g, c, la, lo in GEMEENTEN],
        "criteria": [], "winningen": [], "reductiefactoren": {}, "vraag": {}, "maatregelen": [],
    }

    # --- criteria (kopteksten uit narratief 1) ---
    ws1 = wb[SHEET_WINNINGEN.format(n=1)]
    for cid, naam, groep, _, kopcel in CRITERIA:
        kop = " ".join(str(ws1[kopcel].value or "").split())
        data["criteria"].append({"id": cid, "naam": naam, "groep": groep, "toelichting": kop})

    # --- winningen (kolommen A-F van narratief 1; gelijk voor alle narratieven) ---
    rij_id = {}
    for r in RIJEN_WINNINGEN:
        locatie = str(ws1[f"A{r}"].value).strip()
        cl = cluster_id(ws1, f"C{r}")
        wid = slug(locatie)
        if locatie == "Fledite ROL":   # komt twee keer voor, met verschillend cluster
            wid += {"rm-gelderland": "-rmg", "rm-utrecht": "-rmu"}[cl]
        if wid in rij_id.values():
            raise Afwijking(f"dubbele winning-id '{wid}' (rij {r})")
        rij_id[r] = wid
        verg, cap = getal(ws1, f"E{r}"), getal(ws1, f"F{r}")
        gem, lat, lon = LOCATIES.get(locatie, (None, None, None))
        data["winningen"].append({
            "id": wid, "locatie": locatie, "gemeente": gem, "type": str(ws1[f"B{r}"].value or "").strip(),
            "cluster": cl, "watersysteem": str(ws1[f"D{r}"].value or "").strip(),
            "vergunning": schoon(verg), "niet_inzetbaar": schoon(verg - cap), "capaciteit": schoon(cap),
            "lat": lat, "lon": lon, "te_controleren": True, "toelichting": "",
        })

    # --- reductiefactoren per narratief ---
    for n in (1, 2, 3, 4):
        ws = wb[SHEET_WINNINGEN.format(n=n)]
        per_winning = {}
        for r in RIJEN_WINNINGEN:
            # zelfde winning op dezelfde rij in elk narratief?
            if str(ws[f"A{r}"].value).strip() != str(ws1[f"A{r}"].value).strip() \
                    or getal(ws, f"F{r}") != getal(ws1, f"F{r}"):
                raise Afwijking(f"{ws.title} rij {r}: locatie of capaciteit wijkt af van narratief 1")
            per_crit = {}
            for cid, _, _, eerste, _ in CRITERIA:
                waarden = [getal(ws, f"{kolom(eerste, i)}{r}", verplicht=False) for i in range(3)]
                for i, w in enumerate(waarden):
                    if w is not None and not 0 <= w <= 1:
                        raise Afwijking(f"{ws.title}!{kolom(eerste, i)}{r}: factor {w} buiten [0,1]")
                per_crit[cid] = [schoon(w) for w in waarden]
            per_winning[rij_id[r]] = per_crit
        data["reductiefactoren"][str(n)] = per_winning

    # --- narratieven en vraag ---
    wv = wb[SHEET_VRAAG]
    for n, (knaam, kjaar, rij0, cel_lpppd, cel_delta) in VRAAGBLOKKEN.items():
        jaren = [int(wv[f"{kolom(kjaar, i)}{rij0 - 1}"].value) for i in range(6)]
        if jaren != VRAAGJAREN:
            raise Afwijking(f"{SHEET_VRAAG}: jaren narratief {n} zijn {jaren}, verwacht {VRAAGJAREN}")
        data["narratieven"].append({
            "id": n, "naam": NARRATIEFNAMEN[n], "deltascenario": str(wv[cel_delta].value or "").strip(),
            "lpppd_doel": getal(wv, cel_lpppd), "toelichting": "",
        })
        per_cluster = {}
        for r in range(rij0, rij0 + 5):
            cl = cluster_id(wv, f"{knaam}{r}")
            per_cluster[cl] = {str(j): schoon(getal(wv, f"{kolom(kjaar, i)}{r}")) for i, j in enumerate(jaren)}
        if len(per_cluster) != 5:
            raise Afwijking(f"{SHEET_VRAAG}: narratief {n} heeft geen 5 unieke clusters")
        data["vraag"][str(n)] = per_cluster

    # --- maatregelen ---
    wm = wb[SHEET_MAATREGELEN]

    def maatregel(mid, naam, omschrijving, soort, spoor, narratieven, aan, cl, volume, rij):
        return {
            "id": mid, "naam": naam, "omschrijving": omschrijving, "leverancier": "Vitens",
            "soort": soort, "spoor": spoor, "narratieven": narratieven, "standaard_aan": aan, "status": None,
            "locatie": None, "gemeente": None, "cluster": cl, "bron": None, "volume": schoon(volume),
            "ruimtebeslag": None, "stroomvraag": None, "ingangsjaar": INGANGSJAAR_MAATREGELEN,
            "voetafdruk": None, "overige_effecten": {"politiek": "", "lijst": []},
            "meta": {"aangeleverd_door": "Vitens (werkdocument)", "datum": vandaag,
                     "bron": f"Werkdocument MGP V04_1, tabblad '{SHEET_MAATREGELEN}', rij {rij}",
                     "onvolledig": soort == "waterlevering"},
        }

    def toepassen(r):
        v = wm[f"C{r}"].value
        return isinstance(v, (int, float)) and v > 0

    gezien = set()
    for r in RIJEN_BESPARING_HUISHOUDENS:
        n = wm[f"B{r}"].value
        if n not in (1, 2, 3, 4) or n in gezien:
            raise Afwijking(f"{SHEET_MAATREGELEN}!B{r}: narratief '{n}' ongeldig of dubbel")
        gezien.add(n)
        toel = str(wm[f"J{r}"].value or "").strip()
        for k, cl in MAATREGEL_CLUSTERKOLOMMEN.items():
            data["maatregelen"].append(maatregel(
                f"wd-besparing-huishoudens-n{n}-{cl}", f"Besparing huishoudens ({CLUSTER_KORT[cl]})",
                f"Waterbesparing huishoudens 2040, narratief {n}: {toel}", "waterbesparing", "S0",
                [int(n)], toepassen(r), cl, getal(wm, f"{k}{r}"), r))

    r = RIJ_BESPARING_BEDRIJVEN
    toel = str(wm[f"J{r}"].value or "").strip()
    for k, cl in MAATREGEL_CLUSTERKOLOMMEN.items():
        data["maatregelen"].append(maatregel(
            f"wd-besparing-bedrijven-{cl}", f"Besparing bedrijven 10% ({CLUSTER_KORT[cl]})",
            f"Waterbesparing bedrijven: {toel}", "waterbesparing", "S0",
            [1, 2, 3, 4], toepassen(r), cl, getal(wm, f"{k}{r}"), r))

    r = RIJ_RUIMTEGEBRUIK_MAX
    for k, cl in MAATREGEL_CLUSTERKOLOMMEN.items():
        vol = getal(wm, f"{k}{r}")
        if vol > 0:
            data["maatregelen"].append(maatregel(
                f"wd-ruimtegebruik-max-{cl}", f"Opl. ruimtegebruik max ({CLUSTER_KORT[cl]})",
                "Oplossen ruimtegebruik productielocaties (max). Locatie, bron, ruimtebeslag, "
                "stroomvraag en voetafdruk zijn in het werkdocument niet bekend.",
                "waterlevering", "S2", [1, 2, 3, 4], toepassen(r), cl, vol, r))

    return data, wb


# --------------------------------------------------------------------------
# Narekenen en controleren
# --------------------------------------------------------------------------
def aanbod_peiljaren(data, n, winning):
    """[2026, 2030, 2040, 2050] voor een winning: capaciteit x MIN over criteria (leeg = 1)."""
    f = data["reductiefactoren"][str(n)][winning["id"]]
    uit = [winning["capaciteit"]]
    for i in range(3):
        factor = min((1 if rij[i] is None else rij[i]) for rij in f.values())
        uit.append(winning["capaciteit"] * factor)
    return uit


def controleer(data, wb):
    fouten = []

    def check(label, gevonden, verwacht):
        if abs(gevonden - verwacht) > TOL:
            fouten.append(f"{label}: berekend {gevonden:.4f}, verwacht {verwacht:.4f}")

    totalen = {}
    for n in (1, 2, 3, 4):
        tot = [0.0] * 4
        for w in data["winningen"]:
            for i, a in enumerate(aanbod_peiljaren(data, n, w)):
                tot[i] += a
        totalen[n] = tot
        vraag = [sum(c[j] for c in data["vraag"][str(n)].values()) for j in ("2025", "2030", "2040", "2050")]
        ws = wb[SHEET_WINNINGEN.format(n=n)]
        for i, jaar in enumerate((2026, 2030, 2040, 2050)):
            check(f"aanbod N{n} {jaar} (acceptatie)", tot[i], ACC_AANBOD[n][i])
            check(f"aanbod N{n} {jaar} (cel {'AV AW AX AY'.split()[i]}37)", tot[i],
                  getal(ws, f"{'AV AW AX AY'.split()[i]}37"))
            check(f"aanbod - vraag N{n} {'huidig' if i == 0 else jaar} (acceptatie)", tot[i] - vraag[i], ACC_OPGAVE[n][i])
            check(f"aanbod - vraag N{n} {'huidig' if i == 0 else jaar} (Vergelijking naratieven)", tot[i] - vraag[i],
                  getal(wb[SHEET_VERGELIJKING], f"{'DEFG'[i]}{2 + n}"))

    bilthoven = next(w for w in data["winningen"] if w["id"] == "bilthoven")
    for i, a in enumerate(aanbod_peiljaren(data, 1, bilthoven)):
        check(f"Bilthoven N1 {(2026, 2030, 2040, 2050)[i]}", a, ACC_BILTHOVEN_N1[i])

    hh = sum(m["volume"] for m in data["maatregelen"] if m["id"].startswith("wd-besparing-huishoudens-n1-"))
    check("besparing huishoudens N1 (D26)", hh, ACC_BESPARING_HH_N1)
    check("besparing huishoudens N1 vs cel D26", hh, getal(wb[SHEET_MAATREGELEN], "D26"))

    if len(data["winningen"]) != 32:
        fouten.append(f"{len(data['winningen'])} winningen gevonden, verwacht 32")
    if fouten:
        raise Afwijking("ACCEPTATIETOTALEN WIJKEN AF:\n  - " + "\n  - ".join(fouten))
    return totalen


# --------------------------------------------------------------------------
# Gevuld template (.xlsx): een tabblad per tabel
# --------------------------------------------------------------------------
THEMAS = ["grondwater", "beschermingszone", "natura2000", "netcapaciteit"]
MAATREGEL_KOLOMMEN = (
    ["id", "naam", "omschrijving", "leverancier", "soort", "spoor", "narratieven", "standaard_aan", "status",
     "lat", "lon", "gemeente", "cluster", "bron", "volume", "ruimtebeslag", "stroomvraag", "ingangsjaar"]
    + [f"{t}_{v}" for t in THEMAS for v in ("beoordeling", "toelichting", "bron")]
    + ["politiek", "overige_effecten", "aangeleverd_door", "datum", "bron_document", "onvolledig"]
)


def janee(b):
    return "ja" if b else "nee"


def maatregel_rij(m):
    vo = m.get("voetafdruk") or {}
    loc = m.get("locatie") or {}
    rij = {
        **{k: m.get(k) for k in ("id", "naam", "omschrijving", "leverancier", "soort", "spoor", "status",
                                 "gemeente", "cluster", "bron", "volume", "ruimtebeslag", "stroomvraag",
                                 "ingangsjaar")},
        "narratieven": ",".join(str(n) for n in m["narratieven"]),
        "standaard_aan": janee(m["standaard_aan"]),
        "lat": loc.get("lat"), "lon": loc.get("lon"),
        "politiek": m["overige_effecten"].get("politiek", ""),
        # een effect per regel: label | beoordeling | tekst
        "overige_effecten": "\n".join(f"{e['label']} | {e['beoordeling']} | {e.get('tekst', '')}"
                                      for e in m["overige_effecten"].get("lijst", [])),
        "aangeleverd_door": m["meta"]["aangeleverd_door"], "datum": m["meta"]["datum"],
        "bron_document": m["meta"]["bron"], "onvolledig": janee(m["meta"].get("onvolledig")),
    }
    for t in THEMAS:
        for v in ("beoordeling", "toelichting", "bron"):
            rij[f"{t}_{v}"] = (vo.get(t) or {}).get(v)
    return [rij[k] for k in MAATREGEL_KOLOMMEN]


def schrijf_template(data, pad):
    wb = Workbook()
    wb.remove(wb.active)

    def blad(naam, kop, rijen):
        ws = wb.create_sheet(naam)
        ws.append(kop)
        for r in rijen:
            ws.append(r)
        ws.freeze_panes = "A2"

    def tabel(naam, kolommen, items):
        blad(naam, kolommen, [[janee(i[k]) if isinstance(i.get(k), bool) else i.get(k) for k in kolommen]
                              for i in items])

    tabel("Narratieven", ["id", "naam", "deltascenario", "lpppd_doel", "toelichting"], data["narratieven"])
    tabel("Clusters", ["id", "naam"], data["clusters"])
    tabel("Gemeenten", ["gemeente", "cluster", "lat", "lon", "te_controleren"], data["gemeenten"])
    tabel("Criteria", ["id", "naam", "groep", "toelichting"], data["criteria"])
    tabel("Winningen", ["id", "locatie", "gemeente", "type", "cluster", "watersysteem", "vergunning",
                        "niet_inzetbaar", "capaciteit", "lat", "lon", "te_controleren", "toelichting"],
          data["winningen"])
    crit = [c["id"] for c in data["criteria"]]
    for n in data["narratieven"]:
        f = data["reductiefactoren"][str(n["id"])]
        blad(f"Reductiefactoren N{n['id']}",
             ["winning"] + [f"{c} {j}" for c in crit for j in PEILJAREN],
             [[w["id"]] + [f[w["id"]][c][i] for c in crit for i in range(3)] for w in data["winningen"]])
    blad("Vraag", ["narratief", "cluster"] + VRAAGJAREN,
         [[int(n), cl] + [v[str(j)] for j in VRAAGJAREN]
          for n, per in data["vraag"].items() for cl, v in per.items()])
    blad("Maatregelen", MAATREGEL_KOLOMMEN, [maatregel_rij(m) for m in data["maatregelen"]])
    wb.save(pad)


# --------------------------------------------------------------------------
def main():
    bron = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "private" / "werkdocument.xlsx"
    if not bron.exists():
        sys.exit(f"Werkdocument niet gevonden: {bron}")
    try:
        data, wb = lees(bron)
        totalen = controleer(data, wb)
    except Afwijking as e:
        sys.exit(f"\nFOUT - er is NIETS geschreven.\n{e}\n")

    uit = ROOT / "private"
    uit.mkdir(exist_ok=True)
    (uit / "data.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    schrijf_template(data, uit / "template-gevuld.xlsx")

    leeg = sum(1 for n in data["reductiefactoren"].values() for w in n.values() for rij in w.values()
               for x in rij if x is None)
    print(f"OK - {len(data['winningen'])} winningen, {len(data['maatregelen'])} maatregelen, "
          f"{len(data['gemeenten'])} gemeenten, {leeg} lege reductiefactoren (worden 1).")
    print("Totaal aanbod (Mm3/j), nagerekend en gelijk aan de acceptatietotalen:")
    print("  narratief                2026      2030      2040      2050")
    for n, t in totalen.items():
        print(f"  {n} {NARRATIEFNAMEN[n]:<20}" + "".join(f"{x:10.3f}" for x in t))
    print(f"Geschreven: {uit / 'data.json'} en {uit / 'template-gevuld.xlsx'}")


if __name__ == "__main__":
    main()
