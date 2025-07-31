# 🛩️ LED Flytrafikk Display

Ein norsk LED-stil flydisplay som viser ekte flytrafikk i ditt område ved hjelp av OpenSky Network API.

## ✨ Funksjonar

- **Ekte flydata**: Henter live data frå OpenSky Network API med 4000 spørsmålar/dag
- **LED-design**: Autentisk LED-display med cyan glow-effektar
- **Intelligent filtrering**: Viser berre fly i lufta (ikkje på bakken)
- **Norsk lokalisering**: Alle tekstar og meldingar på norsk
- **Mobilvenleg**: Responsiv design som fungerer på mobil og nettbrett
- **Auto-oppdatering**: Automatisk oppdatering av flydata
- **GPS-støtte**: Kan bruke di noverande posisjon
- **Trygg API**: Bruker Netlify Functions for å skjule API-nøklar

## 🚀 Bruk

Nettsida er tilgjengeleg på: [https://[ditt-netlify-namn].netlify.app](https://[ditt-netlify-namn].netlify.app)

1. Anten:
   - Trykk "📍 Min posisjon" for å bruke GPS
   - Eller skriv inn GPS-koordinatar manuelt
2. Vel radius (anbefalt: 5-15 km for synlege fly)
3. Trykk "🔍 Søk etter fly"

## 🔧 Teknisk info

- **API**: OpenSky Network med autentisert tilgang (4000 spørsmålar/dag)
- **Proxy**: Netlify Functions skjuler API-nøklar trygt
- **Fallback**: api.allorigins.win som backup
- **Oppdateringsfrekvens**: Manuell eller 30 sekund auto-refresh
- **Hosting**: Netlify (gratis)

## � Deployment til Netlify

### Steg 1: Last opp til GitHub
1. Last opp desse filene til GitHub repository:
   - `index.html`
   - `netlify.toml`
   - `netlify/functions/flights.js`
   - `README.md`
   - `.gitignore`

### Steg 2: Koble til Netlify
1. Gå til [netlify.com](https://netlify.com) og logg inn
2. Klikk "New site from Git"
3. Vel GitHub og autoriser tilgang
4. Vel ditt `flytrafikk-display` repository
5. La standardinnstillingane stå (Netlify finn `netlify.toml` automatisk)
6. Klikk "Deploy site"

### Steg 3: Legg til API-nøklar (viktig!)
1. I Netlify dashboard, gå til "Site settings"
2. Klikk "Environment variables" i venstre meny
3. Legg til desse variablane:
   - `OPENSKY_USERNAME`: `din-opensky-brukarnamn`
   - `OPENSKY_PASSWORD`: `ditt-opensky-passord`
4. Klikk "Save"

### Steg 4: Redeploy
1. Gå til "Deploys" tab
2. Klikk "Trigger deploy" → "Deploy site"
3. Vent til deployment er ferdig

Ferdig! 🎉 Du får no ein URL som `https://amazing-name-123456.netlify.app`

## 📱 Tips for bruk

- **Optimal radius**: 10 km for fly du faktisk kan sjå
- **Beste tid**: Dagtid med mykje flytrafikk
- **Flyplassnær**: Prøv nær Gardermoen, Bergen, Stavanger for mest aktivitet
- **Tålmodighet**: API kan ta nokre sekund å svare

## 🛠️ Lokal utvikling

For å teste lokalt:

1. Installer [Netlify CLI](https://docs.netlify.com/cli/get-started/):
   ```bash
   npm install -g netlify-cli
   ```

2. Køyr lokal server:
   ```bash
   cd "c:\Users\eldar.asebo\Desktop\Fly"
   netlify dev
   ```

3. Opne `http://localhost:8888`

## 📄 Lisens

Open source - bruk fritt!

## 🙏 Takk til

- [OpenSky Network](https://opensky-network.org/) for gratis flydata API
- [Netlify](https://netlify.com/) for gratis hosting og Functions
- Google Fonts for Orbitron-fonten
