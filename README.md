# Visualisatie tool DWR – drinkwateropgave Vitens

Webtool voor de Drinkwaterraad (DWR) provincie Utrecht. De tool laat per narratief zien hoe vraag en aanbod van drinkwater zich tot 2050 ontwikkelen, hoe groot de opgave is en wat maatregelen daaraan doen.

De tool bestaat uit twee pagina's:

- **`index.html` – visualisatie.** Kies een narratief en een zichtjaar, zet maatregelen aan of uit en bekijk de dekking van de opgave en de effecten per gemeente.
- **`invoer.html` – invoer.** Basisdata en maatregelen invoeren, importeren, controleren en exporteren.

## Uw data blijft op uw computer

De tool is een statische website zonder server. Alles wat u invoert of importeert staat alleen in de opslag van uw eigen browser (localStorage). Er worden geen gegevens verstuurd en de tool laadt niets van andere websites.

Dat betekent ook:

- Een andere browser of computer heeft uw data niet. Deel data door een bestand te exporteren en bij de ander te importeren.
- Wie de browsergegevens wist, wist ook de dataset. Bewaar daarom een export.
- Zolang er geen eigen dataset is, toont de visualisatie fictieve voorbeelddata met het gele label **Voorbeelddata**.

## Voor de deskundige: basisdata invoeren

1. Open `invoer.html` en klik **Download leeg template (.xlsx)**. Het tabblad *Uitleg* beschrijft elke kolom.
2. Vul de tabbladen: Narratieven, Clusters, Gemeenten, Criteria, Winningen, Reductiefactoren N1–N4 en Vraag. Volumes in Mm³/j; decimalen met komma of punt.
3. Klik **Importeren…** en kies het bestand. Na het importeren ziet u een samenvatting met het totale aanbod per narratief en peiljaar. Vergelijk die met uw eigen totalen.
4. Rechts staat de **validatie**. Rood blokkeert, oranje is een waarschuwing. Een klik op een melding springt naar de cel.
5. U kunt ook direct in de tabellen typen of een blok cellen uit Excel plakken (Ctrl+V). Bij de reductiefactoren kunt u het blok H4:AP35 uit het werkdocument in één keer plakken.
6. Bewaar het resultaat met **Download huidige data** (.xlsx of .json).

### Hoe de tool rekent

- Aanbod per winning = inzetbare capaciteit × de laagste reductiefactor van alle criteria. Een lege factor telt als 1.
- Peiljaren voor het aanbod zijn 2026 (huidig), 2030, 2040 en 2050; de vraag is er per vijf jaar. Tussenliggende jaren zijn lineair geïnterpoleerd.
- Opgave = vraag zonder besparing − aanbod zonder maatregelen.
- Een maatregel telt in één keer mee vanaf het ingangsjaar. Waterlevering verhoogt het aanbod, waterbesparing verlaagt de vraag.
- Alleen maatregelen met leverancier Vitens tellen mee in deze versie.
- Gedekt = bijdrage van de maatregelen ÷ opgave.

Aannames en nog niet beantwoorde vragen staan in [OPEN-VRAGEN.md](OPEN-VRAGEN.md). Wat bewust is uitgesteld staat in [LATER.md](LATER.md).

## Voor Vitens: maatregelen aanleveren

Een maatregel is één dataobject: wat levert het op, waar ligt het, wat is de fysieke voetafdruk en welke overige effecten zijn er. Er zijn twee manieren.

**Via het formulier**

1. Open `invoer.html`, tabblad **Maatregelen**, en klik **+ Maatregel aanleveren**.
2. Vul de blokken in. Velden met * zijn verplicht; bij waterbesparing vervallen locatie, bron, ruimtebeslag, stroomvraag en voetafdruk.
3. Rechts ziet u hoe de maatregel in de visualisatie verschijnt.

**Via Excel**

1. Klik **Download maatregelen-template (.xlsx)**. Het bestand heeft keuzelijsten en een tabblad *Uitleg*.
2. Vul één rij per maatregel in en importeer het bestand met **Importeer maatregelen-bestand…**.
3. Een nieuw id wordt toegevoegd, een bestaand id wordt overschreven. De samenvatting laat zien wat er is gebeurd.

Volumes zijn in **Mm³ per jaar**. De tool waarschuwt bij een volume boven 30, omdat dan mogelijk m³ is ingevuld.

## De tool gebruiken

**Online (GitHub Pages).** Zet in de repository onder *Settings → Pages* de bron op de branch `main`, map `/ (root)`. De tool staat daarna op `https://<gebruiker>.github.io/<repo>/`. Er is geen bouwstap.

**Lokaal.** De pagina's gebruiken ES-modules en werken daarom niet door `index.html` te dubbelklikken. Start in de map van de repo een eenvoudige webserver:

```bash
python -m http.server 8765
```

en open `http://localhost:8765/`.

## Voor ontwikkelaars

| Map of bestand | Inhoud |
|---|---|
| `js/model.js` | Rekenmodel, zonder DOM |
| `js/schema.js` | Tabel- en velddefinities, keuzelijsten, validatie |
| `js/store.js` | Opslag in de browser, import en export (.json en .xlsx) |
| `js/invoer.js`, `js/formulier.js` | Invoerpagina en formulier "Maatregel aanleveren" |
| `js/viz/` | Panelen van de visualisatie |
| `js/config.js` | Instellingen en drempels van de visualisatie |
| `css/tokens.css` | Huisstijl Vitens: kleuren, lettertypen, vormen |
| `data/voorbeeld.json` | Fictieve voorbeelddata |
| `docs/` | JSON-schema van de dataset en een klein voorbeeld |
| `vendor/` | SheetJS 0.20.3, lokaal opgeslagen |
| `tools/` | Hulpscripts (Python) |
| `tests/` | Tests voor model, validatie, import/export en voorbeelddata |

Geen framework, geen build en geen npm-pakketten.

**Tests.** Met Node 20 of hoger:

```bash
npm test
```

De tests met werkdocumentdata worden overgeslagen als `private/data.json` ontbreekt. Na een bewuste wijziging van het model of van de voorbeelddata werkt u de snapshot bij met:

```bash
node tests/voorbeeld.test.mjs --bijwerken
```

**Interne data.** De map `private/` staat in `.gitignore` en mag nooit gecommit worden. Daar staan het werkdocument van Vitens en de daaruit omgezette dataset. Alles wat wel in de repo staat (`data/`, `docs/`, tests) is fictief.

```bash
python tools/convert_werkdocument.py
```

zet `private/werkdocument.xlsx` om naar `private/data.json` en een gevuld template, en controleert de totalen tegen het werkdocument. Vereist `openpyxl`.

**Huisstijl.** Kleuren en lettertypen komen uit `css/tokens.css`. De lettertypen Baloo en Barlow staan nog niet in de repo; tot die tijd valt de tool terug op Arial. Het logo is een tijdelijk bestand. Beide punten staan in OPEN-VRAGEN.md (I1 en I2).
