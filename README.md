# 🛩️ LED Flytrafikk Display

Ein norsk LED-stil flydisplay som viser ekte flytrafikk i ditt område ved hjelp av OpenSky Network API.

## ✨ Funksjonar

- **Ekte flydata**: Henter live data frå OpenSky Network API
- **LED-design**: Autentisk LED-display med cyan glow-effektar
- **Intelligent filtrering**: Viser berre fly i lufta (ikkje på bakken)
- **Norsk lokalisering**: Alle tekstar og meldingar på norsk
- **Mobilvenleg**: Responsiv design som fungerer på mobil og nettbrett
- **Auto-oppdatering**: Automatisk oppdatering av flydata
- **GPS-støtte**: Kan bruke di noverande posisjon

## 🚀 Bruk

1. Opne nettsida: [https://[ditt-brukarnavn].github.io/flytrafikk-display](https://[ditt-brukarnavn].github.io/flytrafikk-display)
2. Anten:
   - Trykk "📍 Min posisjon" for å bruke GPS
   - Eller skriv inn GPS-koordinatar manuelt
3. Vel radius (anbefalt: 5-15 km for synlege fly)
4. Trykk "🔍 Søk etter fly"

## 🔧 Teknisk info

- **API**: OpenSky Network (gratis, offentleg tilgang)
- **CORS-løysing**: Bruker api.allorigins.win som proxy ved behov
- **Oppdateringsfrekvens**: Manuell eller 30 sekund auto-refresh
- **Støtta nettlesarar**: Alle moderne nettlesarar

## 📱 Tips for bruk

- **Optimal radius**: 10 km for fly du faktisk kan sjå
- **Beste tid**: Dagtid med mykje flytrafikk
- **Flyplassnær**: Prøv nær Gardermoen, Bergen, Stavanger for mest aktivitet
- **Tålmodighet**: API kan ta nokre sekund å svare

## 🛠️ Lokal utvikling

For å køyre lokalt:

1. Last ned `index.html`
2. Opne i nettlesar eller køyr lokal server:
   ```bash
   python -m http.server 8000
   ```
3. Gå til `http://localhost:8000`

## 📄 Lisens

Open source - bruk fritt!

## 🙏 Takk til

- [OpenSky Network](https://opensky-network.org/) for gratis flydata API
- Google Fonts for Orbitron-fonten
