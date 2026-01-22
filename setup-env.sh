#!/bin/bash

# Setup-Script für .env-Datei

echo "Fotoapp - .env Setup"
echo "===================="
echo ""

# Prüfen ob .env bereits existiert
if [ -f .env ]; then
    echo "⚠️  .env-Datei existiert bereits!"
    read -p "Möchten Sie sie überschreiben? (j/n): " overwrite
    if [ "$overwrite" != "j" ] && [ "$overwrite" != "J" ]; then
        echo "Abgebrochen."
        exit 0
    fi
fi

# .env-Datei erstellen
cat > .env << 'EOF'
# Server-Konfiguration
PORT=3001
NODE_ENV=production

# JWT Secret (WICHTIG: In Produktion ändern!)
# Generieren Sie ein sicheres Secret mit: openssl rand -base64 32
JWT_SECRET=change-this-secret-in-production-please-generate-a-secure-one

# Frontend URL (Ihre Domain oder IP-Adresse)
# Für lokale Entwicklung: http://localhost:3000
# Für Produktion: https://ihre-domain.de
FRONTEND_URL=http://localhost:3000

# Datenbank
DB_PATH=/app/data/fotoapp.db

# Admin-Passwort (wird beim ersten Start verwendet)
# WICHTIG: Ändern Sie dies nach dem ersten Login!
ADMIN_PASSWORD=admin123

# Synology NAS Integration (optional)
# Setzen Sie SYNOLOGY_ENABLED=true, wenn Sie die NAS-Integration verwenden möchten
SYNOLOGY_ENABLED=false
SYNOLOGY_HOST=
SYNOLOGY_USERNAME=
SYNOLOGY_PASSWORD=
SYNOLOGY_SHARE=fotoapp
SYNOLOGY_BASE_PATH=/fotoapp
SYNOLOGY_DOMAIN=
EOF

echo "✅ .env-Datei wurde erstellt!"
echo ""
echo "⚠️  WICHTIG: Bitte passen Sie folgende Werte in der .env-Datei an:"
echo "   - JWT_SECRET (generieren Sie ein sicheres Secret)"
echo "   - ADMIN_PASSWORD (setzen Sie ein sicheres Passwort)"
echo "   - FRONTEND_URL (Ihre Domain oder IP-Adresse)"
echo ""
echo "Sie können die Datei jetzt bearbeiten mit:"
echo "   nano .env"
echo ""
