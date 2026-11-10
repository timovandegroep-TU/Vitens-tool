# Open vragen

Onduidelijkheden die niet zelf zijn ingevuld. Per vraag: waar het in de bron staat en met welke **tijdelijke aanname** de tool nu rekent. Bron "WD" = werkdocument *bepalen drinkwateropgave MGP V04_1* (staat in `private/`, niet in de repo).

Status: eerste versie (stap 1). Een antwoord? Zet het erachter en verplaats de vraag naar "Beantwoord".

## A. Bronnen

| # | Vraag | Waar | Tijdelijke aanname |
|---|---|---|---|
| A1 | De slide `referentie/dataobject-maatregel.png` ontbreekt in de repo. Wijkt die af van de veldentabel in de opdracht? | opdracht, "Bronnen in de repo" | Het maatregel-dataobject volgt de veldentabel uit de opdracht. Na aanlevering van de slide: velden en bloknamen vergelijken. |
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
| D6 | Van "Oplossen ruimtegebruik" zijn locatie, bron, ruimtebeslag, stroomvraag en voetafdruk onbekend. | rij 33 | Leeg gelaten; de validatie toont dit als waarschuwing in plaats van blokkerend (uitzondering voor bron "werkdocument"). **Ter review**: volgens de veldentabel zijn dit verplichte velden bij waterlevering. |
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

## Beantwoord

*(nog leeg)*
