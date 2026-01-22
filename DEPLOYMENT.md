# Deployment-Anleitung für Proxmox

## Docker Compose V2 verwenden

Falls Sie den Fehler `ModuleNotFoundError: No module named 'distutils'` erhalten, verwenden Sie Docker Compose V2:

### Lösung 1: Docker Compose V2 verwenden (empfohlen)

Docker Compose V2 ist als Plugin für Docker verfügbar und wird mit `docker compose` (ohne Bindestrich) aufgerufen:

```bash
# Container starten
docker compose up -d

# Container stoppen
docker compose down

# Logs anzeigen
docker compose logs -f

# Container neu bauen
docker compose build
```

### Lösung 2: Docker Compose V2 installieren (falls nicht vorhanden)

Falls `docker compose` nicht funktioniert, installieren Sie Docker Compose V2:

```bash
# Für Debian/Ubuntu
apt-get update
apt-get install docker-compose-plugin

# Oder manuell installieren
mkdir -p ~/.docker/cli-plugins/
curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 -o ~/.docker/cli-plugins/docker-compose
chmod +x ~/.docker/cli-plugins/docker-compose
```

### Lösung 3: Alte docker-compose reparieren (nicht empfohlen)

Falls Sie die alte Version behalten möchten:

```bash
# Python distutils installieren (für Python 3.12+)
apt-get install python3-distutils

# Oder docker-compose aktualisieren
pip3 install --upgrade docker-compose
```

## Empfohlener Workflow

1. **Repository klonen:**
   ```bash
   git clone https://github.com/Boede89/fotoapp.git
   cd fotoapp
   ```

2. **.env-Datei erstellen:**
   ```bash
   ./setup-env.sh
   # oder manuell:
   cp .env.example .env
   nano .env
   ```

3. **Wichtige Werte anpassen:**
   - `JWT_SECRET` - sicheres Secret generieren: `openssl rand -base64 32`
   - `ADMIN_PASSWORD` - sicheres Passwort setzen
   - `FRONTEND_URL` - Ihre Domain oder IP-Adresse

4. **Container bauen und starten:**
   ```bash
   docker compose build
   docker compose up -d
   ```

5. **Status prüfen:**
   ```bash
   docker compose ps
   docker compose logs -f fotoapp
   ```

6. **Auf die Anwendung zugreifen:**
   - Öffnen Sie `http://ihre-ip:3001` im Browser
   - Melden Sie sich mit `admin` / Ihrem `ADMIN_PASSWORD` an

## Troubleshooting

### Container startet nicht
```bash
# Logs prüfen
docker compose logs fotoapp

# Container neu bauen
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Port bereits belegt
Ändern Sie in `docker-compose.yml` den Port:
```yaml
ports:
  - "3002:3001"  # Statt 3001:3001
```

### Datenbank-Problem
```bash
# Datenbank zurücksetzen (ACHTUNG: Löscht alle Daten!)
docker compose down
rm -rf data/
docker compose up -d
```
