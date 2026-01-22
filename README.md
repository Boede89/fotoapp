# Fotoapp - Party Foto Upload Tool

Ein modernes Foto-Upload-Tool für Partys und Veranstaltungen, das in einem Linux-Container in einer Proxmox-Umgebung läuft. Gäste können Fotos und Videos hochladen, während Gastgeber die Rechte verwalten können.

## Features

- 🎉 **Event-Management**: Gastgeber können Events erstellen und verwalten
- 📸 **Foto/Video-Upload**: Gäste können Fotos und Videos hochladen (aus Dateien oder direkt per Kamera)
- 🔐 **Rollenbasierte Zugriffe**: Admin, Gastgeber und Gäste mit unterschiedlichen Berechtigungen
- 📱 **QR-Code-Zugang**: Einfacher Zugang für Gäste über QR-Code
- 👁️ **Flexible Rechte**: Gastgeber können bestimmen, ob Gäste Bilder ansehen und/oder herunterladen dürfen
- 🖼️ **Album-Cover**: Gastgeber können ein Cover-Bild für ihr Event hochladen
- 💾 **Synology NAS Integration**: Automatische Synchronisation mit Synology NAS (optional)
- 🐳 **Docker-Container**: Einfache Deployment in Proxmox

## Technologie-Stack

- **Backend**: Node.js + Express + TypeScript
- **Frontend**: React + TypeScript + Vite
- **Datenbank**: SQLite
- **Container**: Docker mit Multi-Stage Build

## Installation

### Voraussetzungen

- Docker und Docker Compose
- Proxmox (oder andere Container-Umgebung)
- Optional: Synology NAS für Dateispeicherung

### Schnellstart

1. Repository klonen:
```bash
git clone https://github.com/Boede89/fotoapp.git
cd fotoapp
```

2. Umgebungsvariablen konfigurieren:
Erstellen Sie eine `.env` Datei im Hauptverzeichnis:

```env
JWT_SECRET=ihr-sicheres-secret-hier
FRONTEND_URL=http://ihre-domain.de
ADMIN_PASSWORD=ihr-admin-passwort

# Synology NAS (optional)
SYNOLOGY_ENABLED=true
SYNOLOGY_HOST=192.168.1.100
SYNOLOGY_USERNAME=ihr-nas-benutzer
SYNOLOGY_PASSWORD=ihr-nas-passwort
SYNOLOGY_SHARE=fotoapp
SYNOLOGY_BASE_PATH=/fotoapp
```

3. Container starten:
```bash
docker-compose up -d
```

4. Auf die Anwendung zugreifen:
- Frontend: http://localhost:3000 (im Development-Modus)
- Backend: http://localhost:3001

### Standard-Anmeldedaten

Nach dem ersten Start wird automatisch ein Admin-Benutzer erstellt:
- **Benutzername**: `admin`
- **Passwort**: Das in `ADMIN_PASSWORD` gesetzte Passwort (Standard: `admin123`)

**WICHTIG**: Ändern Sie das Admin-Passwort nach dem ersten Login!

## Verwendung

### Admin-Dashboard

1. Melden Sie sich als Admin an
2. Erstellen Sie Gastgeber-Accounts für Event-Organisatoren
3. Verwalten Sie alle Events und Gastgeber

### Gastgeber-Dashboard

1. Melden Sie sich als Gastgeber an
2. Erstellen Sie ein neues Event:
   - Event-Name eingeben
   - Optional: Beschreibung und Cover-Bild
   - Rechte festlegen (Ansehen/Download erlauben)
3. QR-Code oder Event-URL an Gäste weitergeben

### Gäste-Zugang

1. QR-Code scannen oder Event-URL öffnen
2. Namen eingeben
3. Fotos/Videos auswählen oder per Kamera aufnehmen
4. Hochladen

## Synology NAS Integration

Die Anwendung kann automatisch alle hochgeladenen Dateien zu Ihrer Synology NAS synchronisieren.

### Voraussetzungen

1. SMB/CIFS-Freigabe auf der Synology NAS erstellen
2. Benutzer mit Schreibrechten auf der Freigabe erstellen
3. Umgebungsvariablen in der `.env` Datei konfigurieren

### Konfiguration

```env
SYNOLOGY_ENABLED=true
SYNOLOGY_HOST=192.168.1.100          # IP-Adresse Ihrer NAS
SYNOLOGY_USERNAME=nas-user           # NAS-Benutzername
SYNOLOGY_PASSWORD=nas-password       # NAS-Passwort
SYNOLOGY_SHARE=fotoapp               # Name der SMB-Freigabe
SYNOLOGY_BASE_PATH=/fotoapp          # Basis-Pfad auf der Freigabe
```

Für jedes Event wird automatisch ein Ordner erstellt: `{EventName}_{EventID}`

## Entwicklung

### Lokale Entwicklung

1. Alle Dependencies installieren:
```bash
npm run install:all
```

2. Backend starten:
```bash
cd backend
npm run dev
```

3. Frontend starten (in neuem Terminal):
```bash
cd frontend
npm run dev
```

### Build

```bash
npm run build
```

## Docker-Container in Proxmox

1. Erstellen Sie einen LXC-Container oder VM mit Docker-Unterstützung
2. Kopieren Sie das Projekt in den Container
3. Konfigurieren Sie die Umgebungsvariablen
4. Starten Sie mit `docker-compose up -d`

## Sicherheit

- ⚠️ Ändern Sie das `JWT_SECRET` in der Produktion
- ⚠️ Verwenden Sie starke Passwörter für Admin- und Gastgeber-Accounts
- ⚠️ Konfigurieren Sie eine Firewall für den Container
- ⚠️ Verwenden Sie HTTPS in der Produktion (Reverse Proxy empfohlen)

## Struktur

```
fotoapp/
├── backend/           # Backend-Code
│   ├── src/
│   │   ├── routes/   # API-Routen
│   │   ├── middleware/
│   │   ├── services/ # Synology-Integration
│   │   └── database.ts
│   └── package.json
├── frontend/          # Frontend-Code
│   ├── src/
│   │   ├── pages/    # React-Komponenten
│   │   ├── context/  # Auth-Context
│   │   └── services/ # API-Service
│   └── package.json
├── docker-compose.yml
├── Dockerfile
└── README.md
```

## API-Endpunkte

### Authentifizierung
- `POST /api/auth/login` - Anmelden
- `POST /api/auth/register` - Registrierung (nur für Gastgeber durch Admin)

### Events
- `GET /api/events/my-events` - Eigene Events (Gastgeber)
- `POST /api/events` - Event erstellen
- `GET /api/events/code/:code` - Event nach Code abrufen
- `PUT /api/events/:id` - Event aktualisieren
- `DELETE /api/events/:id` - Event löschen
- `GET /api/events/:id/uploads` - Uploads eines Events

### Upload
- `POST /api/upload` - Datei hochladen
- `POST /api/upload/cover` - Cover-Bild hochladen

### Admin
- `GET /api/admin/hosts` - Alle Gastgeber auflisten
- `POST /api/admin/hosts` - Gastgeber erstellen
- `DELETE /api/admin/hosts/:id` - Gastgeber löschen

## Lizenz

MIT

## Support

Bei Fragen oder Problemen erstellen Sie bitte ein Issue im GitHub-Repository.
