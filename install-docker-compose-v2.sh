#!/bin/bash

# Script zum Installieren von Docker Compose V2

echo "Docker Compose V2 Installation"
echo "================================"
echo ""

# Prüfen ob Docker installiert ist
if ! command -v docker &> /dev/null; then
    echo "❌ Docker ist nicht installiert!"
    echo "Bitte installieren Sie Docker zuerst."
    exit 1
fi

echo "✅ Docker gefunden: $(docker --version)"
echo ""

# Prüfen ob Docker Compose V2 bereits installiert ist
if docker compose version &> /dev/null; then
    echo "✅ Docker Compose V2 ist bereits installiert!"
    docker compose version
    exit 0
fi

echo "Installiere Docker Compose V2..."
echo ""

# Verzeichnis erstellen
mkdir -p ~/.docker/cli-plugins/

# Architektur erkennen
ARCH=$(uname -m)
case $ARCH in
    x86_64)
        COMPOSE_ARCH="x86_64"
        ;;
    aarch64|arm64)
        COMPOSE_ARCH="aarch64"
        ;;
    armv7l)
        COMPOSE_ARCH="armv7"
        ;;
    *)
        echo "❌ Nicht unterstützte Architektur: $ARCH"
        exit 1
        ;;
esac

# Prüfen ob curl oder wget verfügbar ist
if command -v curl &> /dev/null; then
    DOWNLOAD_CMD="curl -SL"
    # Neueste Version herunterladen
    COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d\" -f4)
elif command -v wget &> /dev/null; then
    DOWNLOAD_CMD="wget -O"
    # Neueste Version herunterladen
    COMPOSE_VERSION=$(wget -qO- https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d\" -f4)
else
    echo "❌ Weder curl noch wget ist installiert!"
    echo "Bitte installieren Sie eines der beiden:"
    echo "  apt-get install curl"
    echo "  oder"
    echo "  apt-get install wget"
    exit 1
fi

if [ -z "$COMPOSE_VERSION" ]; then
    COMPOSE_VERSION="v2.24.5"  # Fallback-Version
fi

echo "Lade Docker Compose $COMPOSE_VERSION für $COMPOSE_ARCH herunter..."

# Download URL
DOWNLOAD_URL="https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-${COMPOSE_ARCH}"

# Herunterladen
if [ "$DOWNLOAD_CMD" = "wget -O" ]; then
    wget -O ~/.docker/cli-plugins/docker-compose "$DOWNLOAD_URL"
else
    curl -SL "$DOWNLOAD_URL" -o ~/.docker/cli-plugins/docker-compose
fi

# Ausführbar machen
chmod +x ~/.docker/cli-plugins/docker-compose

# Prüfen ob Installation erfolgreich war
if docker compose version &> /dev/null; then
    echo ""
    echo "✅ Docker Compose V2 erfolgreich installiert!"
    docker compose version
    echo ""
    echo "Sie können jetzt 'docker compose' verwenden (ohne Bindestrich)"
else
    echo ""
    echo "❌ Installation fehlgeschlagen"
    echo "Versuchen Sie es manuell:"
    if command -v wget &> /dev/null; then
        echo "  mkdir -p ~/.docker/cli-plugins/"
        echo "  wget -O ~/.docker/cli-plugins/docker-compose https://github.com/docker/compose/releases/latest/download/docker-compose-linux-${COMPOSE_ARCH}"
        echo "  chmod +x ~/.docker/cli-plugins/docker-compose"
    else
        echo "  apt-get install wget"
        echo "  mkdir -p ~/.docker/cli-plugins/"
        echo "  wget -O ~/.docker/cli-plugins/docker-compose https://github.com/docker/compose/releases/latest/download/docker-compose-linux-${COMPOSE_ARCH}"
        echo "  chmod +x ~/.docker/cli-plugins/docker-compose"
    fi
    exit 1
fi
