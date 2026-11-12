# Open vragen

Onduidelijkheden die niet zelf zijn ingevuld. Per vraag: waar het in de bron staat en met welke **tijdelijke aanname** de tool nu rekent. Bron "WD" = werkdocument *bepalen drinkwateropgave MGP V04_1* (staat in `private/`, niet in de repo).

Status: eerste versie (stap 1). Een antwoord? Zet het erachter en verplaats de vraag naar "Beantwoord".

## K. Factoren (temperatuur, PFAS, verzilting) (12-11-2026)

Gekozen in overleg: per factor een schuif of schakelaar; effect in Mm³/j bij volle stand met lineaire ingroei; werkt op een cluster, op "alle" of op één winning.

| # | Vraag | Waar | Tijdelijke aanname |
|---|---|---|---|
| K1 | Horen factoren bij de uitgangssituatie of bij de maatregelen? | `js/model.js` | Uitgangssituatie: een vraagfactor zit in "vraag zonder besparing", een aanbodfactor in het bestaand aanbod. Ze vergroten dus de opgave; maatregelen moeten dat goedmaken. |
| K2 | Dubbeltelling: het vraagscenario "Hoog + warm" bevat al een klimaateffect, de factor Temperatuurstijging ook. | dummydata | Laten staan; de deskundige moet kiezen waar klimaat zit (in het scenario of als factor). |
| K3 | Hoe verdeel je een factor op "alle"? | `bereken` | Vraagfactor naar aandeel in de vraag van het scenario, aanbodfactor naar aandeel in de capaciteit. |
| K4 | Afname door een factor op één winning kan groter worden dan de capaciteit van die winning. | weergave Winningen | Het rekenmodel trekt het volle effect af van het cluster; de weergave Winningen toont maximaal 100%. |
| K5 | Waar in de visualisatie? | paneel Scenario | Vraagscenario's als chips bovenaan, factoren eronder per groep, scrollbaar. De "+ factor"-knop uit de mockup komt niet terug: factoren komen uit de invoer. |
| K6 | Gelden de factoren in elk vraagscenario? | – | Ja. Factoren per scenario staan in LATER. |
| K7 | Factoren in de dummydata zijn verzonnen (Temperatuurstijging, PFAS-normaanscherping, PFAS-incident Veenendaal, Verzilting grondwater). | `data/voorbeeld.json` | Toelichting begint met "Fictief voorbeeld". |

## J. Eenvoudiger aanlevering: vraagscenario's en vlak aanbod (12-11-2026)

Besluit opdrachtgever: de data uit het werkdocument (narratieven, criteria, reductiefactoren) is **tijdelijk losgelaten**. De secties B, C en D hieronder gaan over het werkdocument en zijn tot die tijd niet van toepassing. Gekozen in overleg: vraag als reeks per cluster, vaste vraagscenario's, afname als maatregel met minteken, één Excel met drie tabbladen.

| # | Vraag | Waar | Tijdelijke aanname |
|---|---|---|---|
| J1 | Welke vraagscenario's komen er, en op welke bronnen (CBS-variant, verbruik per persoon, klimaat)? | tabel Vraag | Dummydata met vier scenario's: Laag, Midden (CBS), Hoog, Hoog + warm. Waarden verzonnen, orde van grootte als het werkdocument. |
| J2 | Wie levert de vraagreeks per cluster aan, en per hoeveel jaar? | tabel Vraag | Per 5 jaar (2025–2050), per cluster; tussenjaren lineair. |
| J3 | Is een afname (sluiting, lagere vergunning, einde levensduur) een maatregel die je aan en uit kunt zetten, of een vast gegeven? | soort "afname" | Een maatregel, standaard aan, in spoor S1. Telt mee in het **bestaand aanbod** en dus in de opgave, niet in de "bijdrage" van maatregelen. Uitzetten = laten zien wat er gebeurt als de afname niet doorgaat. |
| J4 | Opgave en dekking met afnames. | `js/model.js` | Opgave = vraag zonder besparing − bestaand aanbod (capaciteit − afnames). Gedekt = (besparing + extra aanbod) ÷ opgave. |
| J5 | Gelden maatregelen in elk scenario? (Voorheen per narratief.) | maatregel | Ja: het veld "narratieven" is vervallen. Een scenario verandert alleen de vraag. |
| J6 | Cluster van een maatregel. | maatregel | Direct gekozen uit de clusters in de tabel Vraag, of via een bestaande winning. De koppeltabel gemeente → cluster is vervallen; gemeente is vrije tekst. |
| J7 | Capaciteit van een winning: inzetbaar of vergund? | tabel Winningen | Inzetbare productiecapaciteit nu, zoals voorheen. Leveringen blijven met vergunde capaciteit tellen (E1). |
| J8 | Het werkdocument koppelen aan het nieuwe formaat. | `tools/convert_werkdocument.py` | Niet gedaan: de converter schrijft nog het oude formaat (schema 1) en de acceptatietests op het werkdocument zijn verwijderd (staan in de git-geschiedenis). |
| J10 | De winningen in `data/voorbeeld.json` zijn nu de **echte** winningen uit het werkdocument (aangeleverd 12-11-2026; 32 stuks, 132,7 Mm³/j). Mag dat in de repo en op GitHub Pages? De oorspronkelijke opdracht vroeg om fictieve voorbeelddata en noemt het werkdocument intern. | `data/voorbeeld.json`, `tools/maak_voorbeeld.py` | Lokaal gecommit, nog niet gepusht. Vraag en maatregelen blijven fictief; elke maatregel heeft "Fictief voorbeeld" in de omschrijving. Ligging (gemeente, lat/lon) benaderd op plaatsnaam. |
| J11 | Fledite ROL staat twee keer in de tabel (twee clusters). | tabel Winningen | Toegestaan: naam + cluster moet uniek zijn. Een maatregel met winning "Fledite ROL" gebruikt de rij van zijn eigen cluster. |
| J9 | Datasets in het oude formaat (met narratieven en reductiefactoren). | import, localStorage | Worden niet meer gelezen; de import geeft een duidelijke melding. Opslag in de browser gebruikt een nieuwe sleutel, dus een oude dataset verschijnt niet meer. |

## A. Bronnen

| # | Vraag | Waar | Tijdelijke aanname |
|---|---|---|---|
| A1 | De slide `referentie/dataobject-maatregel.png` staat nog niet in de repo (wel gezien in de chat; komt overeen met de veldentabel). | opdracht, "Bronnen in de repo" | Het maatregel-dataobject volgt de veldentabel uit de opdracht. Bestand zelf nog toevoegen aan `referentie/`. |
| A3 | De slide noemt volume in **m³/jaar**, de opdracht en de tool gebruiken **Mm³/j**. In welke eenheid levert Vitens aan? | slide "Dataobject", veld Volume | Mm³/j. De validatie waarschuwt bij volume > 30 (mogelijk in m³ ingevuld). |
| A4 | De slide noemt bij "Water aanbod" een **vraagprognose per gemeente**. | slide "Dataobject", blok Water aanbod | Niet in v1: vraag per cluster (zie LATER.md). |
| A2 | Is het bestand "…nieuwste versie V04 (1).xlsx" hetzelfde als "V04_1"? | bestandsnaam | Ja: alle acceptatietotalen uit de opdracht kloppen met dit bestand. |

## B. Werkdocument – basislijn

| # | Vraag | Waar | Tijdelijke aanname |
|---|---|---|---|
| B1 | Wat is criterium "??"? In *Naratief 1 - figuren* (rij 51) heet dezelfde kolomgroep "incidentele verontreiniging". Klopt dat? | *Naratief N - winningen* AI2, kolommen AI–AL; *N1 - figuren* A51 | Criterium blijft bestaan met naam "?? (betekenis onbekend)", groep Grondwaterkwaliteit. Alle waarden zijn 1, dus geen effect op het aanbod. |
| B2 | Kolom K bevat bij 8 winningen een "x" (alleen in narratief 1). Betekenis? | *Naratief 1 - winningen* K4, K5, K6, K12, K26, K29, K33, K35 | Genegeerd. |
| B3 | "Huidig" vergelijkt aanbod 2026 met vraag 2025. Is dat de bedoeling? | *Naratief N - figuren* rij 29–34 (bv. `B19-B10`) | Overgenomen: opgave "huidig" = aanbod 2026 − vraag 2025. |
| B4 | Welk aanbod geldt in 2025? De Excel begint bij 2026 ("huidig"). | *Naratief N - winningen* AV | Aanbod 2025 = aanbod 2026 = inzetbare productiecapaciteit (vlakke lijn 2025–2026). |
| B5 | *Narratief 2 - figuren*: "Vraag – Huidig" is hard 138 in plaats van een formule (andere narratieven: 138,46). | *Naratief 2 - figuren* B38:E38 | Niet overgenomen; de tool rekent overal met de vraagtabel. Raakt aanbod en opgave niet. |
| B6 | Aftrek in formules van kolom F (Bilthoven −0,8; Groenekan −1,5; Woudenberg −1,2; Bremerberg −1; Benschop −3). De opdracht noemt dit "bestuurlijke beperking", maar het tabblad *Info zuiveringen en winningen* noemt deze bedragen "niet inzetbaar operationele capaciteit" (kolom H). De bestuurlijke beperking (kolom F aldaar, bv. Groenekan 2,5) zit al in kolom E verwerkt. Hoe moet de aparte kolom heten? | *Naratief 1 - winningen* F7, F8, F9, F18, F34; *Info…* kolommen E–I; toelichting A44–A46 | Aparte kolom `niet_inzetbaar` ("aftrek op inzetbare vergunning"), zodat capaciteit = vergunning − niet_inzetbaar. Naam en uitlegtekst ter review. |
| B7 | Benschop: vergunning 3, inzetbare capaciteit 0. Bewust? | *Naratief 1 - winningen* rij 7 | Overgenomen; validatie geeft een waarschuwing. |
| B8 | Lege reductiefactoren bij natuur in narratief 2 en 3 (Benschop en beide Fledite ROL-rijen). Vergeten of bewust? | *Naratief 2/3 - winningen* P7:R7, P16:R17 | Leeg = 1, met waarschuwing (zoals in de Excel, waar MIN lege cellen overslaat). |
| B9 | "Fledite ROL" staat twee keer in het winningen-tabblad (2,2 → Randmeren Gelderland; 1,8 → Randmeren Utrecht), maar één keer in *Info…* (4,0, cluster Flevoland). De toelichting noemt "Amersfoort Hoge Weg 6,8" en "Holk 2,2". Welke indeling is leidend? | *Naratief 1 - winningen* rij 16–17, A47; *Info…* rij 34 | Winningen-tabblad is leidend; id's `fledite-rol-rmg` en `fledite-rol-rmu`. |
| B10 | Het werkdocument heeft geen gemeente en geen coördinaten per winning. | – | Gemeente en lat/lon benaderd op plaatsnaam, gemarkeerd "te controleren". |
| B11 | De koppeltabel gemeente → cluster staat niet in het werkdocument. | – | Initieel: gemeenten in het voorzieningsgebied van de 5 clusters, allemaal "te controleren". |
| B12 | Kan een gemeente onder meer dan één cluster vallen? | – | v1: één cluster per gemeente. |
| B13 | De vraagtabel komt via een externe koppeling (`[1]Narratieven`). Is de in het bestand opgeslagen waarde actueel? | *Ontwikkeling van de vraag* | Opgeslagen waarden worden als invoer overgenomen. |
| B14 | Hetzelfde tabblad bevat ook "Aanbod – operationele productiecapaciteit incl. projecten" en "Vraag – Vitens noodzakelijke productie". Moeten die ergens voor gebruikt worden? | *Ontwikkeling van de vraag* rij 18–24, 43–49, 53–59 | Niet gebruikt. |
| B15 | Tussenjaren: de Excel rekent alleen op 2026/2030/2040/2050 (aanbod) en per 5 jaar (vraag). | – | Lineaire interpolatie; tooltip toont "geïnterpoleerd"; echte datapunten als markers. |

## C. Werkdocument – wat we bewust niet overnemen

| # | Punt | Waar | Wat de tool doet |
|---|---|---|---|
| C1 | "Aantal beperkingen": de COUNTIF-bereiken verschuiven per kolom (H:AP, I:AQ, J:AR, K:AS) en vallen deels over de totaalkolommen; de tekstcriteria ("<0,91") hangen af van de landinstelling. | *Naratief N - limiterende factor* AW–AZ | Niet overgenomen; raakt het aanbod niet. |
| C2 | *Naratief 1 - figuren* rij 52 verwijst naar *Naratief 2 - limiterende factor*. | *N1 - figuren* C52:E52 | Niet overgenomen (toerekening naar oorzaak staat in LATER.md). |
| C3 | De som van de toegerekende afnames (rij 53) wijkt af van de totale afname (rij 42). | *N1 - figuren* rij 42 en 53 | Niet overgenomen. |

## D. Maatregelen uit het werkdocument

| # | Vraag | Waar | Tijdelijke aanname |
|---|---|---|---|
| D1 | De maatregelen hebben alleen een effect voor 2040. Vanaf wanneer gelden ze? | *Maatregelen en opgave* rij 24 e.v., "vermindering opgave (nu 2040)" | Ingangsjaar = 2040 voor alle omgezette maatregelen. |
| D2 | De opdracht zegt "rij 26 = narratief 1, rij 27 = 2, enzovoort", maar rij 28 is gelabeld "(4)" (kolom B = 4, formule op vraag narratief 4) en rij 29 "(3)". | *Maatregelen en opgave* A28:B29 | De converter leest het narratief uit **kolom B**, niet uit de rijvolgorde. |
| D3 | "Waterbesparing bedrijven 10%" heeft geen narratief; het volume (totaal 1) is verdeeld naar het vraagaandeel van narratief 4 in 2040. | rij 30 | Geldt voor alle narratieven, met de volumes per cluster uit de Excel. |
| D4 | Welke maatregelen staan standaard aan? Alleen rij 33 heeft "toepassen?" = 1. | kolom C | `standaard_aan` = (kolom C > 0): alleen "Oplossen ruimtegebruik (max)" staat aan. |
| D5 | "Oplossen ruimtegebruik productielocaties (min)" (rij 32): ook omzetten? | rij 32 | Nee, alleen (max) zoals de opdracht vraagt. |
| D6 | Van "Oplossen ruimtegebruik" zijn locatie, bron, ruimtebeslag, stroomvraag en voetafdruk onbekend. | rij 33 | Leeg gelaten. Deze objecten krijgen het kenmerk `meta.onvolledig = ja`; daarmee toont de validatie de ontbrekende velden als waarschuwing in plaats van blokkerend. **Ter review**: volgens de veldentabel zijn dit verplichte velden bij waterlevering. |
| D7 | De besparing huishoudens is 13% (narratief 1–2) resp. 12% (3–4) van de **totale** vraag 2040 per cluster, met als toelichting "van 134 lpppd naar 115" resp. "115 naar 100". Klopt een percentage van de totale vraag voor een maatregel op huishoudens? | rij 26–29, kolom J | Volumes ongewijzigd overgenomen. |

## E. Rekenregels voor maatregelen

| # | Vraag | Tijdelijke aanname |
|---|---|---|
| E1 | Waterleveringen tellen met **vergunde** capaciteit, de basislijn met **inzetbare productiecapaciteit**. Bij bestaande winningen ligt inzetbaar soms flink lager (Groenekan 7,5 → 6; Bilthoven 2 → 1,2; Woudenberg 3,4 → 2,2; Benschop 3 → 0). Acceptabel voor nieuwe maatregelen? | Niet gecorrigeerd. Tooltip van elke waterlevering toont "volume = vergunde capaciteit". |
| E2 | Nieuwe waterleveringen krijgen geen reductiefactoren (natuur, waterkwaliteit, …), bestaande winningen wel. Bedoeling? | Geen reductie op maatregelen. |
| E3 | Maatregelen van Oasen en Waternet tellen niet mee. | Zichtbaar in lijst en op kaart met "niet meegerekend (v1)", schakelaar uitgeschakeld. |
| E4 | Besparing op "alle clusters": verdeeld naar het aandeel van elk cluster in de basisvraag in jaar t. Kan de vraag van een cluster daardoor onder 0 komen? | Nee in de praktijk; de tool kapt niet af. |
| E5 | Dekkingsbalk: gedekt = bijdrage maatregelen ÷ opgave, met opgave = vraag zonder besparing − aanbod zonder maatregelen (zoals in de mockup). Bij filter "per cluster" per cluster berekend. | Overgenomen uit de mockup. |
| E6 | "Reserve +10%"-chip: in de mockup vraag × 1,1 als stippellijn, zonder effect op opgave of dekking. | Ongewijzigd overgenomen. |

## F. Afwijkingen van het plan in de code

| # | Vraag | Waar | Tijdelijke aanname |
|---|---|---|---|
| F1 | Het plan noemt `js/config.js` voor de drempels (30 Mm³-waarschuwing, jaren, pin-kleuren). Dat bestand bestaat niet. Alsnog afsplitsen? | `GRENZEN` in `js/schema.js`, jaren in `js/model.js` | Stap 5: `js/config.js` bestaat nu en bevat de instellingen van de visualisatie (pin-kleuren, drempels, startjaar). De validatiegrenzen blijven in `js/schema.js`. |
| F2 | Het plan noemt één `css/stijl.css`; de invoerpagina heeft `css/invoer.css`. | `invoer.html` | Stap 5: `css/stijl.css` is de stijl van `index.html` (uit de mockup); `css/invoer.css` blijft voor de invoerpagina. De kleurvariabelen staan in beide. |
| F3 | Het plan noemt `meta.versie`; schema en code gebruiken `meta.schema_versie` (+ `voorbeelddata`). | `docs/datamodel.schema.json` | Schema is leidend. |

## G. Formulier en maatregelen-template (stap 4)

| # | Vraag | Waar | Tijdelijke aanname |
|---|---|---|---|
| G1 | Welke velden vervallen bij waterbesparing? De veldentabel maakt locatie, bron, ruimtebeslag, stroomvraag en voetafdruk alleen verplicht bij waterlevering. | formulier "Maatregel aanleveren" | Bij waterbesparing toont het formulier deze velden niet en worden ze bij opslaan leeggemaakt. Gemeente en cluster blijven voor beide soorten. Via het template kunnen ze nog wel gevuld worden. |
| G2 | Mag een maatregel met blokkerende fouten worden opgeslagen? | formulier, knop Opslaan | Ja, zodra het id uniek is (net als bij de basistabellen); de fouten staan in het validatiepaneel. Wat de visualisatie met zo'n maatregel doet, volgt in stap 5. |
| G3 | Als het gekozen cluster afwijkt van het cluster van de gemeente in de koppeltabel: fout of toegestaan? | `valideerMaatregel` | Het formulier neemt het cluster over uit de koppeltabel; een afwijkend cluster mag en geeft een waarschuwing. |
| G4 | De gegevensvalidatie in het template is gecontroleerd met openpyxl en LibreOffice, niet met Excel zelf. | `maatregelenTemplate` in `js/store.js` | Werkt ook in Excel (standaard OOXML). Graag één keer openen in Excel en een keuzelijst proberen. |
| G5 | Rij + tooltip in de preview zijn een voorstel; de mockup toont een ingroeipad, dat in v1 vervalt. | `maatregelWeergave` in `js/schema.js` | Tooltip toont spoor, werking, leverancier, volume, ingangsjaar, cluster, narratieven, fysieke kenmerken, voetafdruk, effecten en bron. Stap 5 gebruikt dezelfde functie. |
| G6 | Standaardwaarden van een nieuwe maatregel in het formulier. | `nieuweMaatregel` | Leverancier Vitens, alle vier narratieven, standaard aan = ja, datum = vandaag. |

## H. Visualisatie (stap 5)

| # | Vraag | Waar | Tijdelijke aanname |
|---|---|---|---|
| H1 | Welke data toont `index.html` als er in de browser nog geen dataset staat? | `js/viz/app.js` | Stap 6: het fictieve `data/voorbeeld.json`, met het gele label Voorbeelddata. |
| H2 | Maatregelen met blokkerende fouten (zie G2). | paneel Maatregelen | Zichtbaar, schakelaar uitgeschakeld, "niet meegerekend: fouten in de aanlevering". Fouten in de basisdata geven een rood label in de kop met een link naar Invoer. |
| H3 | Welke maatregelen staan in de lijst? | paneel Maatregelen | Alleen die van het gekozen narratief; bij een clusterfilter alleen die van dat cluster of "alle clusters". De waarde is de bijdrage in het zichtjaar (bij een clusterfilter: het deel voor dat cluster). |
| H4 | Wanneer telt een effect van een maatregel? | paneel Effecten, chip Maatregelen | Alleen van maatregelen die in het zichtjaar meetellen (aan, Vitens, ingangsjaar bereikt). Waterleveringen zonder aangeleverde effecten staan er als "geen effecten aangeleverd". |
| H5 | Hoe vertaalt de fysieke voetafdruk zich naar knelpunt / aandacht? | `VOETAFDRUK_NIVEAU` in `js/config.js` | Zwaarste beoordeling = knelpunt, middelste en "onbekend" = aandacht, lichtste = geen melding. Beschermingszone "in of grenst aan" = aandacht. |
| H6 | Drempels voor de kleur van een winning. | `AFNAME_DREMPELS` in `js/config.js` | Afname ≥ 25% van de capaciteit = rood, elke afname daaronder = oranje, geen afname = grijs. Het bindende criterium is dat van het eerstvolgende peiljaar. |
| H7 | Het ingaan van een maatregel is in de grafiek een verticale sprong op het ingangsjaar (stapfunctie). Zo gewenst? | grafiek | Ja, volgt uit de modelregel; ingroei staat in LATER. |
| H8 | Logo "De Kleine Consultant" uit de mockup staat in de voet; het paginanummer is vervangen door de naam van de dataset. | `index.html` | Overgenomen uit de mockup. |
| H9 | Kaart: omtrek van Utrecht uit de mockup in een kader dat meeschaalt met alle punten in de dataset; Flevoland en Gelderland alleen als label. | `js/viz/kaart.js` | Schematisch; echte grenzen staan in LATER. |

## Beantwoord

*(nog leeg)*

## I. Huisstijl Vitens en afronding (stap 6)

| # | Vraag | Waar | Tijdelijke aanname |
|---|---|---|---|
| I1 | Vitens.nl gebruikt het oude lettertype "Baloo"; de tool gebruikt de opvolger Baloo 2 (gewicht 600), die er vrijwel gelijk uitziet. Akkoord? (open punt 4 van de huisstijlreferentie) | `fonts/`, `css/tokens.css` | Baloo 2 en Barlow staan als woff2 in `fonts/` (zelf gehost, OFL, latijnse subset). Staat het oude Baloo op de computer, dan gaat dat voor. |
| I2 | Het Vitens-logo is een tijdelijk bestand, uit het aangeleverde voorbeeld (schermafdruk, 181×79 px). Mag het logo in een openbare repo en op GitHub Pages, en wie is de afzender (Vitens, DWR/provincie, DKC)? | `assets/vitens-logo.png`, kop van beide pagina's | Logo staat linksboven, zoals in het voorbeeld. Vervangen door het officiële bestand; bij "nee" de `<img>` in `index.html` en `invoer.html` weghalen. |
| I3 | Het logo "De Kleine Consultant" in de voet is vervallen (het voorbeeld in huisstijl heeft het niet). Zie H8. | `index.html` | Geen logo in de voet; rechtsonder staat de naam van de dataset. |
| I4 | Statuskleuren oranje (aandacht) en donker turquoise (kans) zijn een voorstel uit de huisstijlreferentie, geen Vitens-kleuren. | `--tool-status-*` in `css/tokens.css`, `NIVEAUS` in `js/config.js` | Overgenomen. De kleuren staan op twee plekken omdat de kaart ze als SVG-attribuut zet. |
| I5 | Eigen aanvullingen op de tokens voor de invoerpagina: vlak- en tekstkleur voor fouten en waarschuwingen, omdat signaalrood als kleine tekst op wit te weinig contrast heeft. | `--tool-fout-*`, `--tool-aandacht-*` | Voorstel; graag akkoord. |
| I6 | De titel van `index.html` is nu "Visualisatie tool DWR" (zoals het voorbeeld); de lange zin uit de mockup staat als ondertitel onder de lijn. | `index.html` | Overgenomen uit het voorbeeld. |
| I7 | De invoerpagina had geen link naar de visualisatie. | `invoer.html` | Knop "Naar visualisatie" in de kop toegevoegd. |
| I8 | `referentie/` (mockup) en `docs/` worden door GitHub Pages mee gepubliceerd. | repo | Geen bezwaar aangenomen: beide bevatten alleen fictieve data. `private/` staat in `.gitignore` en komt niet op Pages. |
