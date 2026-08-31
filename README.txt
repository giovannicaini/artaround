# Insegnamento di Tecnologie Web

# CdS In Informatica

# (A.A. 2025-26)

# Progetto ArtAround 18-24

# READ ME DEL PROGETTO ARTAROUND

## Nome del gruppo: Artista Solitario

## Membri del gruppo

- Nome e cognome: `Giovanni Caini`, matricola: `0000757981`, mail: `giovanni.caini@studio.unibo.it`
- LLM (nome e versione e licenza): Claude Code (Claude Sonnet 5, Anthropic) — accesso via abbonamento Claude Code, licenza proprietaria/commerciale

## Tipo progetto

18-24

## Data di disponibilità delle applicazioni

15 settembre 2026

## Locazione del progetto:

- URI del marketplace: https://site252619.tw.cs.unibo.it/marketplace/
- URI del navigator: https://site252619.tw.cs.unibo.it/navigator/
- Altri URI rilevanti:
  - Home Page del progetto (da cui si raggiunge tutto il resto): https://site252619.tw.cs.unibo.it
  - API REST: https://site252619.tw.cs.unibo.it/api/
  - Documentazione API (Swagger UI): https://site252619.tw.cs.unibo.it/api-docs/

## Organizzazione dei sorgenti

Il progetto è un monorepo gestito con npm workspaces + Turborepo, orchestrato da un unico `package.json` di root. La struttura è la seguente:

```
artaround/
├── apps/
│   ├── server/                       # Backend Express + MongoDB, unico entry-point HTTP (porta 8000)
│   │   └── src/
│   │       ├── index.ts              # Bootstrap: monta /api, /marketplace, /navigator, /uploads
│   │       ├── config/                # config.ts, database.ts (connessione MongoDB), swagger.ts
│   │       ├── controllers/           # auth, user, museum, artwork, item, visit, marketplace, upload, utils
│   │       ├── middleware/            # auth (JWT), role, error (gestione errori centralizzata)
│   │       ├── models/                # Schemi Mongoose
│   │       ├── routes/                # Vari file di routes, montate tutte in routes/index.ts
│   │       ├── scripts/               # Script per migrazioni di dati
│   │       └── utils/                 # wikidata.service, translation.service, upload.service, ai.service
│   │
│   ├── marketplace/                   # App Web Components (Lit) per la creazione dei contenuti
│   │   └── src/
│   │       ├── app-root.ts, main.ts   # Root component e bootstrap
│   │       ├── base/                  # Classe base LitElement + mixin "museo attivo"
│   │       ├── components/             # Contiene i vari web components, tra cui in /ui molti componenti UI riutilizzabili
│   │       ├── services/               # un service per dominio + i18n, translation, ai, history, permissions, preferences
│   │       └── utils/                  # query-builder, events, translation-fields
│   │
│   └── navigator/                     # App React per la visita guidata in loco
│       └── src/
│           ├── App.tsx, main.tsx      # Routing e bootstrap React
│           ├── components/             # MapView (visualizzazione mappa museo)
│           ├── context/                # NavigatorContext (stato visita/navigazione)
│           ├── pages/                  # HomePage, MuseumPage, VisitPlayerPage
│           └── services/               # api (client REST), speech (Web Speech API)
│
├── packages/
│   └── shared/                        # Tipi, costanti e utility condivise fra le 3 app
│       └── src/
│           ├── types/                  # Museum, Artwork, Item, Visit, User, Upload, Wikidata, API, i18n, ..
│           ├── display/                # label/formattazione (opere, contenuti, musei, visite)
│           ├── i18n/                   # locales.ts (helper caricamento traduzioni)
│           └── locales/                # it.json, en.json, fr.json, de.json, es.json
│
├── uploads/                            # File caricati (es. immagini), serviti dal server
├── scripts/                            # Script di repo
└── package.json                        # Orchestrazione dev/build/start/seed su tutti i workspace (Turborepo)
```

Ogni app ha build indipendente: Vite per marketplace e navigator, `tsc` per server e `tsup` per shared. In produzione il server Express è l'unico processo esposto (gestito dal docker di dipartimente): serve l'API sotto `/api`, i build statici di marketplace e navigator sotto rispettivamente `/marketplace` e `/navigator`, e i file caricati sotto `/uploads`.
In ogni app/shared, è presente, oltre la cartella `/src`, con i sorgenti, anche la cartella `/dist` contenente gli output di build compilati, generati da tsc/vite/tsup a partire dal codice in src/. Si segnala in particolare che lo script con cui viene avviato node-22 su gocker è in `artaround/apps/server/dist/index.js`

## Tecnologie utilizzate

Linguaggio: **TypeScript** ovunque (server, marketplace, navigator, shared), monorepo con **npm
workspaces** orchestrato da **Turborepo** (`turbo`). Di seguito ogni pacchetto NPM installato in
ciascun workspace, oltre a quelli preinstallati con Node/npm.

#### Server-side (`apps/server`)

- `express` — web framework
- `mongoose` — ODM per MongoDB
- `jsonwebtoken` + `bcryptjs` — autenticazione JWT e hashing password
- `express-validator` — validazione input
- `multer` — upload file multipart
- `sharp` — ridimensionamento/ottimizzazione immagini
- `swagger-jsdoc` + `swagger-ui-express` — documentazione API interattiva
- `axios` — chiamate a servizi esterni (Wikidata, Nominatim/OpenStreetMap per il geocoding, OpenAI
  per le traduzioni assistite da AI)
- `http-proxy-middleware` — proxy verso i dev server di marketplace/navigator in sviluppo
- `cors`, `dotenv`
- `@artaround/shared` — pacchetto condiviso interno

#### Applicazione marketplace (`apps/marketplace`)

- `lit` — Web Components
- `leaflet` — mappa interattiva nell'editor indirizzo museo (geocoding + preview marker)
- `tslib`
- `@artaround/shared` — pacchetto condiviso interno

#### Applicazione navigator (`apps/navigator`)

- `react`, `react-dom` — framework UI
- `react-router-dom` — routing
- `lucide-react` — icone
- Web Speech API (nativa del browser, nessun pacchetto) — sintesi vocale dei contenuti
- `@artaround/shared` — pacchetto condiviso interno

#### Pacchetto condiviso (`packages/shared`)

- TypeScript, buildato con `tsup` in formato CJS+ESM con dichiarazioni `.d.ts`

#### Root del monorepo

- `turbo` — orchestrazione build/dev/test su tutti i workspace
- `typescript` (condivisa dai workspace)

## Contributo individuale

#### persona1: Giovanni Caini: tutto, tra cui analisi dei requisiti, architettura del monorepo, backend (API, autenticazione, integrazione Wikidata/Nominatim, seed dei contenuti reali), frontend marketplace e navigator, internazionalizzazione, deployment e configurazione del dominio.

#### LLM: Claude Code (Claude Sonnet 5, Anthropic) — assistenza alla programmazione, soprattutto in compiti ripetitivi (es. replicazione dei vari component della ui), verifica di uniformità tra i vari file di progetto, controllo aggiuntivo sulla correttezza del codice (già di per sè abbastanza "controllato" dalla rigida transpilazione di TypeScript)
