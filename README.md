# Visualisatie tool DWR – drinkwateropgave Vitens

Webtool voor de Drinkwaterraad (DWR) provincie Utrecht. De tool laat per vraagscenario zien hoe vraag en aanbod van drinkwater zich tot 2050 ontwikkelen, hoe groot de opgave is en wat maatregelen daaraan doen.

De tool bestaat uit twee pagina's:

- **`index.html` – visualisatie.** Kies een vraagscenario en een zichtjaar, zet maatregelen aan of uit en bekijk de dekking van de opgave en de effecten per gemeente.
- **`invoer.html` – invoer.** Basisdata en maatregelen invoeren, importeren, controleren en exporteren.

## Uw data blijft op uw computer

De tool is een statische website zonder server. Alles wat u invoert of importeert staat alleen in de opslag van uw eigen browser (localStorage). Er worden geen gegevens verstuurd en de tool laadt niets van andere websites.

Dat betekent ook:

- Een andere browser of computer heeft uw data niet. Deel data door een bestand te exporteren en bij de ander te importeren.
- Wie de browsergegevens wist, wist ook de dataset. Bewaar daarom een export.
- Zolang er geen eigen dataset is, toont de visualisatie fictieve voorbeelddata met het gele label **Voorbeelddata**.

## Voor de deskundige: data aanleveren

Alle data past in één Excel-bestand met drie tabbladen. Op `invoer.html` staat het lege template (**Download leeg template (.xlsx)**); het tabblad *Uitleg* beschrijft elke kolom.

| Tabblad | Eén rij per | Wat de tool ermee doet |
|---|---|---|
| **Winningen** | bestaande winning: locatie, type, cluster, watersysteem, huidig aanbod, inzetbare productiecapaciteit (Mm³/j), gemeente, lat/lon | Het huidige aanbod is de som van de inzetbare productiecapaciteit. De eerste zes kolommen staan in de volgorde van het werkdocument: dat blok kunt u in één keer plakken. |
| **Vraag** | scenario × cluster: vraag in 2025, 2030, … 2050 | Linksboven kies je een scenario; het scenario verandert alleen de vraag. |
| **Maatregelen** | maatregel | Elke maatregel wordt een schakelaar in de visualisatie. |

1. Vul de tabbladen en klik **Importeren…**. Na het importeren ziet u een samenvatting met het huidige aanbod en de totale vraag per scenario.
2. Rechts staat de **validatie**. Rood blokkeert, oranje is een waarschuwing. Een klik op een melding springt naar de cel.
3. U kunt ook direct in de tabellen typen of een blok cellen uit Excel plakken (Ctrl+V).
4. Bewaar het resultaat met **Download huidige data** (.xlsx of .json).

Wilt u eerst zien hoe het werkt, klik dan **Voorbeelddata laden**: dat laadt `data/voorbeeld.json`. Daarin staan de winningen uit het werkdocument; de vraagscenario's en maatregelen zijn fictief.

### Hoe de tool rekent

- **Vraag** = de reeks van het gekozen scenario, per cluster. Tussen de 5-jaarspunten wordt lineair geïnterpoleerd.
- **Bestaand aanbod** = capaciteit van de winningen, gelijk in elk jaar, min de afnames die aan staan.
- **Aanbod** = bestaand aanbod + waterleveringen die aan staan.
- **Opgave** = vraag zonder besparing − bestaand aanbod.
- Een maatregel telt in één keer mee vanaf het ingangsjaar. Waterlevering verhoogt het aanbod, waterbesparing verlaagt de vraag, een afname verlaagt het bestaand aanbod.
- Alleen maatregelen met leverancier Vitens tellen mee in deze versie.
- **Gedekt** = (besparing + extra aanbod) ÷ opgave.

Aannames en nog niet beantwoorde vragen staan in [OPEN-VRAGEN.md](OPEN-VRAGEN.md). Wat bewust is uitgesteld staat in [LATER.md](LATER.md).

## Voor Vitens: maatregelen aanleveren

Een maatregel is één dataobject: wat doet het met vraag of aanbod, waar ligt het, wat is de fysieke voetafdruk en welke overige effecten zijn er. Er zijn drie soorten:

- **waterlevering**: extra aanbod (S1 herbouw, S2 vergroten, S3 nieuwe locatie);
- **waterbesparing**: minder vraag (S0);
- **afname**: een bestaande winning levert minder of sluit (S1). Kies dan in de kolom *winning* om welke winning het gaat.

Bij een maatregel op een bestaande winning komen cluster en kaartlocatie uit het tabblad Winningen. Er zijn twee manieren om aan te leveren.

**Via het formulier**

1. Open `invoer.html`, tabblad **Maatregelen**, en klik **+ Maatregel aanleveren**.
2. Vul de blokken in. Velden met * zijn verplicht; bij waterbesparing en afname vervallen locatie, bron, ruimtebeslag, stroomvraag en voetafdruk.
3. Rechts ziet u hoe de maatregel in de visualisatie verschijnt.

**Via Excel**

1. Klik **Download maatregelen-template (.xlsx)**. Het bestand heeft keuzelijsten en een tabblad *Uitleg*.
2. Vul één rij per maatregel in en importeer het bestand met **Importeer maatregelen-bestand…**.
3. Een nieuw id wordt toegevoegd, een bestaand id wordt overschreven. De samenvatting laat zien wat er is gebeurd.

Volumes zijn in **Mm³ per jaar** en altijd positief; de soort bepaalt of het er af of bij gaat. De tool waarschuwt bij een volume boven 30, omdat dan mogelijk m³ is ingevuld.

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
| `fonts/` | Lettertypen Baloo 2 en Barlow (woff2) |
| `data/voorbeeld.json` | Fictieve voorbeelddata |
| `docs/` | JSON-schema van de dataset |
| `vendor/` | SheetJS 0.20.3, lokaal opgeslagen |
| `tools/` | Hulpscripts (Python) |
| `tests/` | Tests voor model, validatie, import/export en voorbeelddata |

Geen framework, geen build en geen npm-pakketten.

**Tests.** Met Node 20 of hoger:

```bash
npm test
```

Na een bewuste wijziging van het model of van de voorbeelddata werkt u de snapshot bij met:

```bash
node tests/voorbeeld.test.mjs --bijwerken
```

**Interne data.** De map `private/` staat in `.gitignore` en mag nooit gecommit worden. Daar staan het werkdocument van Vitens en de daaruit omgezette dataset. Wat wel in de repo staat is fictief, met één uitzondering: de winningen in `data/voorbeeld.json` komen uit het werkdocument (OPEN-VRAGEN J10).

```bash
python tools/convert_werkdocument.py
```

zet `private/werkdocument.xlsx` om naar `private/data.json`. **Let op:** de converter schrijft nog het oude formaat (met narratieven en reductiefactoren), dat deze versie van de tool niet leest. De koppeling met het werkdocument is tijdelijk losgelaten (OPEN-VRAGEN J8).

De fictieve voorbeelddata maakt u opnieuw met `python tools/maak_voorbeeld.py data/voorbeeld.json`.

**Huisstijl.** Kleuren en lettertypen komen uit `css/tokens.css`. De lettertypen Baloo 2 en Barlow staan in `fonts/` (SIL Open Font License) en worden niet van een andere site geladen. Het logo is een tijdelijk bestand; zie OPEN-VRAGEN.md (I2).
