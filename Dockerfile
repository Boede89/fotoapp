# Multi-Stage Build für Fotoapp

# Stage 1: Backend bauen
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build

# Stage 2: Frontend bauen
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 3: Production Image
FROM node:20-alpine
WORKDIR /app

# System-Abhängigkeiten für better-sqlite3 und smb2
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cifs-utils

# Backend-Dependencies installieren
COPY backend/package*.json ./
RUN npm ci --production

# Backend-Code kopieren
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/src ./src

# Frontend-Build kopieren
COPY --from=frontend-builder /app/frontend/dist ./public

# Upload-Verzeichnisse erstellen
RUN mkdir -p uploads/events uploads/qrcodes data

# Umgebungsvariablen
ENV NODE_ENV=production
ENV PORT=3001
ENV FRONTEND_URL=http://localhost:3000

# Port freigeben
EXPOSE 3001

# Start-Script
CMD ["node", "dist/server.js"]
