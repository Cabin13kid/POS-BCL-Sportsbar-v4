# BARTRACK BCL

Bar bestellingen + voorraad dashboard. FastAPI + React + MongoDB.

## Twee draai-modi

### 1. Development (twee servers, hot reload)
Standaard setup. Frontend draait op `:3000` met hot reload, backend op `:8001`.
Frontend `.env` heeft `REACT_APP_BACKEND_URL` ingesteld op de externe URL.

```bash
sudo supervisorctl status   # frontend + backend draaien
```

### 2. Single-server productie (1 server voor alles)
FastAPI op `:8001` serveert zowel de API als de **gebouwde** React frontend.
Alles draait via 1 proces — geen aparte frontend nodig.

**Bouwen + draaien:**
```bash
# 1) Bouw de React app (relatieve API URLs voor zelfde origin)
cd /app/frontend && REACT_APP_BACKEND_URL="" GENERATE_SOURCEMAP=false yarn build

# 2) Herstart backend (detecteert /app/frontend/build automatisch)
sudo supervisorctl restart backend

# 3) Open http://localhost:8001/  → React app
#    http://localhost:8001/api/*  → backend API
```

**Hoe het werkt** (`backend/server.py`):
- `/api/*` routes worden eerst gematcht (FastAPI router).
- Daarna mount `StaticFiles` de assets onder `/static/*`.
- Een catch-all `GET /{full_path:path}` serveert `index.html` voor SPA routing
  (zo werkt React Router voor `/orders`, `/inventory`, etc.).
- Files in `build/` (favicon, manifest, …) worden direct geserveerd.

**Frontend `api.js`** gebruikt automatisch relatieve URLs als
`REACT_APP_BACKEND_URL` leeg is — zelfde code werkt in beide modi.

## Standaard admin
- Email: `admin@bar.nl`
- Wachtwoord: `admin123`
- Login werkt ook met username (in te stellen via Gebruikers pagina).

## Rollen
- **admin** — alles incl. gebruikers + promoties beheren.
- **manager** — menu, voorraad, plattegrond, bestellingen verwijderen.
- **werknemer** — POS / Dashboard / Bestellingen aanmaken + afrekenen.
