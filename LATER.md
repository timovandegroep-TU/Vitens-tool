# Later (niet in versie 1)

Versie 1 bouwt alleen wat in de opdracht staat. Alles hieronder is bewust uitgesteld; bij twijfel is de eenvoudigste variant gebouwd en staat de uitgebreidere hier.

## Uit de opdracht

- **Ingroeipad van maatregelen** ("jaar vol effect"). Nu: een stap op het ingangsjaar.
- **Filteren op status** van maatregelen. Nu: status is alleen informatief.
- **Rekenen met Oasen en Waternet**: hun maatregelen én hun basislijn. Nu: alleen Vitens telt mee.
- **Automatische kaartlagen** (Natura 2000, beschermingszones, netcapaciteit) en **toetsing van stroomvraag** aan een netcapaciteitsgrens. Nu: de informatiegevende partij vult de beoordeling in.
- **Schakelaars per criterium** in het scenariopaneel en het gestapelde beeld **"afname naar oorzaak"** (vraagt de toerekeningsmethode uit het tabblad *limiterende factor*).
- **Vraag per gemeente**. Nu: per cluster.
- Inloggen, gedeelde opslag, datasets naast elkaar vergelijken.
- Kostendata.
- Vervangingsopgave-tabellen.
- Mobiele layout. Nu: vaste 1600×900-stage die meeschaalt.

## Onderweg uitgesteld

- **"+ factor"-knop en scenariosliders** uit de mockup (temperatuur, PFAS, …): bestaan niet in het rekenmodel; vervangen door de keuze uit vier narratieven.
- **Onzekerheidsband** rond de vraaglijn uit de mockup: het werkdocument bevat geen bandbreedte. Vervalt in v1; eventueel later als spreiding tussen de narratieven.
- **Effecten per gemeente afgeleid uit het tekort** (mockup: "woonwijk X niet te bedienen"): vraagt een verdeelsleutel van cluster naar gemeente. Nu: alleen effecten die in het maatregel-dataobject staan.
- **Reductiefactoren op nieuwe waterleveringen** en correctie **vergund → inzetbaar** (zie OPEN-VRAGEN E1/E2).
- **Meer dan één cluster per gemeente** (OPEN-VRAGEN B12).
- **Tussenliggende peiljaren voor het aanbod** (bv. 2035) als invoer. Nu: 2030/2040/2050 en lineair daartussen.
- **Maatregel "Oplossen ruimtegebruik (min)"** en een min/max-bandbreedte per maatregel.
- **Echte provincie- en gemeentegrenzen** op de kaart. Nu: schematisch kader.
- **Versiebeheer van aanleveringen** (wie heeft wat wanneer overschreven). Nu: laatste aanlevering per id wint.
- **Datasetnaam en -datum in de .xlsx**: de Excel-export bevat geen meta-tabblad; bij import wordt de bestandsnaam de datasetnaam. De .json-export bewaart de meta wel.
- **Lege reductiefactor per jaar markeren**: de waarschuwing "lege factor" geldt per winning × criterium en kleurt nu alle drie de jaarcellen oranje, ook als maar één jaar leeg is. De melding zelf noemt wel de juiste jaren.
- **Plakken van een deel van het werkdocument-blok**: bij een blok waarin elke vierde kolom leeg is en dat ook zonder strippen past, vraagt de invoerpagina of het scheidingskolommen zijn. Automatisch herkennen kan niet zonder te gokken.
- **Testcommando in de README** (stap 6): `npm test` of `node --test`. `node --test tests/` uit het plan werkt niet op Node 22 en hoger (een map als argument wordt daar als module gelezen).
- **Locatie kiezen op een kaart** in het formulier. Nu: lat en lon intypen.
- **Opmaak van het maatregelen-template** (vastgezette kopregel, kleuren, voorbeeldrij). Nu: kale kopregel met keuzelijsten en een tabblad Uitleg.
- **Alles aan / alles uit** en zoeken in de maatregelenlijst.
- **Stand onthouden** (narratief, zichtjaar, schakelaars) na herladen of delen via de adresbalk. Nu: elke keer de beginstand.
- **Pins die elkaar overlappen** op de kaart uit elkaar schuiven; nu liggen dichtbij gelegen winningen deels over elkaar.
