# Aviation Stack API Setup

## 🛩️ Aviation Stack som Fallback for OpenSky

Aviation Stack API er no implementert som ein smart fallback for OpenSky API. Når OpenSky feiler (504 timeout, nettverksproblem, etc.), vil systemet automatisk prøve Aviation Stack for å få live fly-data.

## 🔑 Set opp API-nøkkel i Netlify

1. **Logg inn på Netlify Dashboard**
   - Gå til: https://app.netlify.com/
   - Vel prosjektet ditt: `flytrafikk`

2. **Legg til Environment Variable**
   - Gå til: **Site settings** → **Environment variables**
   - Klikk **Add variable**
   - **Key:** `AVIATIONSTACK_API_KEY`
   - **Value:** [Din Aviation Stack API-nøkkel]
   - Klikk **Save**

3. **Trigger ny deployment**
   - Gå til **Deploys** 
   - Klikk **Trigger deploy** → **Deploy site**

## 📡 Korleis det fungerer

### Smart Fallback Logikk:
1. **Primær:** OpenSky API (rask, gratis, men ustabil)
2. **Fallback:** Aviation Stack API (stabil, betalt, men avgrensa quota)

### Data Mapping:
Aviation Stack data blir konvertert til OpenSky-format for kompatibilitet:

```javascript
// Aviation Stack → OpenSky format
[icao24, callsign, origin_country, time_position, last_contact, 
 longitude, latitude, baro_altitude, on_ground, velocity, 
 true_track, vertical_rate, sensors, geo_altitude, squawk, spi, 
 position_source, route_info, aircraft_type, duration, remaining, elapsed]
```

### Geografisk Filtrering:
- **Norge + omliggjande område:** lat: 55-75°, lon: -5-35°
- **Berre fly i lufta:** `is_ground: false`
- **Maksimalt 50 fly** (Aviation Stack quota-sparing)

## 🎯 Fordelar

### Robustheit:
- **Zero downtime:** Om OpenSky feiler, Aviation Stack tek over
- **Transparent:** Brukar merkar ikkje forskjell
- **Smart quota-bruk:** Aviation Stack blir berre brukt ved naud

### Datakvalitet:
- **Detaljert ruteinformasjon:** Departure → Arrival airports
- **Live posisjon:** Latitude, longitude, altitude, speed
- **Flyselskap:** Automatisk deteksjon og mapping

## 📊 Status-overvaking

Frontend viser datakjelde i console:
```javascript
console.log('Data source:', apiStatus.dataSource);
// "OpenSky" = Normal drift
// "AviationStack (fallback)" = Fallback aktiv
// "Error (no fallback available)" = Begge feila
```

## 🚨 Feilsøking

### Aviation Stack API virkar ikkje:
1. **Sjekk API-nøkkel:** Verifiser at `AVIATIONSTACK_API_KEY` er sett i Netlify
2. **Sjekk quota:** Logg inn på Aviation Stack dashboard
3. **Sjekk logs:** Netlify Functions logs viser feilmeldingar

### Ingen fly vises:
1. **Geografisk område:** Aviation Stack kan ha andre dekningsområde
2. **Quota oppbrukt:** Sjekk Aviation Stack dashboard
3. **API-grenser:** Free plan har avgrensa features

## 💰 Kostnader

### Free Plan (Aviation Stack):
- **1000 requests/month**
- **Live flights:** ✅ Inkludert
- **Historical data:** ❌ Ikkje inkludert

### Smart Bruk:
- **Fallback-only:** Brukar berre quota når OpenSky feiler
- **Caching:** Kan implementere caching for å redusere API-kall
- **Geofencing:** Filtrerer berre norske fly

## 🔄 Testing

### Test Fallback:
For å teste Aviation Stack fallback, kan du simulere OpenSky-feil ved å:
1. Kommentere ut OpenSky API-nøkkel midlertidig
2. Forkorte timeout drastisk (1ms)
3. Bruke feil URL i OpenSky-request

### Forventa Resultat:
```
🚀 Fetching OpenSky data...
❌ OpenSky request failed: timeout
🔄 Trying Aviation Stack fallback...
✅ Aviation Stack fallback successful: 15 flights
```
