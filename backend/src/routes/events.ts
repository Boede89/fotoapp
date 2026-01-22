import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import db from '../database';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Event erstellen (nur Gastgeber/Admin)
router.post('/', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    if (req.user?.role !== 'host' && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Nur Gastgeber können Events erstellen' });
    }

    const { name, description, allow_view = true, allow_download = false } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Event-Name ist erforderlich' });
    }

    const hostId = req.user!.id;

    // Gastgeber-Daten abrufen
    const host = db.prepare('SELECT max_events, event_date, expires_in_days FROM users WHERE id = ?').get(hostId) as any;
    
    if (!host) {
      return res.status(404).json({ error: 'Gastgeber nicht gefunden' });
    }

    // Prüfen ob Gastgeber noch Events erstellen darf
    if (host.max_events !== null) {
      const eventCount = db.prepare('SELECT COUNT(*) as count FROM events WHERE host_id = ?').get(hostId) as any;
      if (eventCount.count >= host.max_events) {
        return res.status(403).json({ error: `Sie haben bereits die maximale Anzahl von ${host.max_events} Event(s) erreicht` });
      }
    }

    // Event-Datum und Ablaufzeit vom Gastgeber-Profil nehmen
    const eventDate = host.event_date ? new Date(host.event_date) : new Date();
    const expiresInDays = host.expires_in_days || 14;
    const expiresAt = new Date(eventDate);
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const eventCode = uuidv4().substring(0, 8).toUpperCase();

    const result = db.prepare(`
      INSERT INTO events (name, description, event_code, host_id, allow_view, allow_download, event_date, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name,
      description || null,
      eventCode,
      hostId,
      allow_view ? 1 : 0,
      allow_download ? 1 : 0,
      host.event_date || null,
      expiresAt.toISOString()
    );

    const eventId = result.lastInsertRowid;

    // QR-Code generieren
    const qrUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/event/${eventCode}`;
    const qrCodeDataUrl = await QRCode.toDataURL(qrUrl);

    // QR-Code speichern
    const uploadsDir = path.join(__dirname, '../../uploads/qrcodes');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const qrCodePath = path.join(uploadsDir, `qr-${eventCode}.png`);
    const base64Data = qrCodeDataUrl.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(qrCodePath, base64Data, 'base64');

    db.prepare('UPDATE events SET qr_code = ? WHERE id = ?').run(`/uploads/qrcodes/qr-${eventCode}.png`, eventId);

    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId) as any;

    res.status(201).json({
      ...(event || {}),
      qr_code_data: qrCodeDataUrl
    });
  } catch (error) {
    next(error);
  }
});

// Alle Events eines Gastgebers
router.get('/my-events', authenticateToken, (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const events = db.prepare(`
      SELECT e.*, 
        (SELECT COUNT(*) FROM uploads WHERE event_id = e.id) as upload_count
      FROM events e
      WHERE e.host_id = ?
      ORDER BY e.created_at DESC
    `).all(userId);
    res.json(events);
  } catch (error) {
    next(error);
  }
});

// Event nach Code abrufen (öffentlich)
router.get('/code/:code', (req, res, next) => {
  try {
    const event = db.prepare('SELECT * FROM events WHERE event_code = ?').get(req.params.code) as any;
    
    if (!event) {
      return res.status(404).json({ error: 'Event nicht gefunden' });
    }

    // Prüfen ob Event abgelaufen ist
    if (event.expires_at) {
      const expiresAt = new Date(event.expires_at);
      if (new Date() > expiresAt) {
        return res.status(403).json({ error: 'Dieses Event ist abgelaufen' });
      }
    }

    res.json(event);
  } catch (error) {
    next(error);
  }
});

// Event aktualisieren (Gastgeber kann nur Name, Beschreibung, Rechte und Cover ändern)
router.put('/:id', authenticateToken, (req: AuthRequest, res, next) => {
  try {
    const eventId = parseInt(req.params.id);
    const { name, description, allow_view, allow_download, cover_image } = req.body;

    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId) as any;
    
    if (!event) {
      return res.status(404).json({ error: 'Event nicht gefunden' });
    }

    if (event.host_id !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }

    // Nur bestimmte Felder können geändert werden (nicht event_date oder expires_at)
    db.prepare(`
      UPDATE events 
      SET name = COALESCE(?, name),
          description = COALESCE(?, description),
          allow_view = COALESCE(?, allow_view),
          allow_download = COALESCE(?, allow_download),
          cover_image = COALESCE(?, cover_image)
      WHERE id = ?
    `).run(
      name || null,
      description || null,
      allow_view !== undefined ? (allow_view ? 1 : 0) : null,
      allow_download !== undefined ? (allow_download ? 1 : 0) : null,
      cover_image || null,
      eventId
    );

    const updatedEvent = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
    res.json(updatedEvent);
  } catch (error) {
    next(error);
  }
});

// Event löschen
router.delete('/:id', authenticateToken, (req: AuthRequest, res, next) => {
  try {
    const eventId = parseInt(req.params.id);
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId) as any;
    
    if (!event) {
      return res.status(404).json({ error: 'Event nicht gefunden' });
    }

    if (event.host_id !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }

    // Alle Uploads des Events finden und Dateien löschen
    const uploads = db.prepare('SELECT file_path FROM uploads WHERE event_id = ?').all(eventId) as any[];
    const fs = require('fs');
    const path = require('path');
    
    const getUploadsDir = () => {
      if (typeof __dirname !== 'undefined') {
        return path.join(__dirname, '../../uploads/events');
      }
      return path.join(process.cwd(), 'uploads/events');
    };
    
    const uploadsDir = getUploadsDir();
    
    // Dateien löschen
    for (const upload of uploads) {
      try {
        const filePath = path.join(uploadsDir, '..', upload.file_path.replace('/uploads/', ''));
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (error) {
        console.error(`Fehler beim Löschen der Datei ${upload.file_path}:`, error);
      }
    }

    // Event-Ordner löschen
    try {
      const eventDir = path.join(uploadsDir, eventId.toString());
      if (fs.existsSync(eventDir)) {
        fs.rmSync(eventDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.error('Fehler beim Löschen des Event-Ordners:', error);
    }

    // QR-Code löschen (falls vorhanden)
    if (event.qr_code) {
      try {
        const qrPath = path.join(uploadsDir, '..', 'qrcodes', path.basename(event.qr_code));
        if (fs.existsSync(qrPath)) {
          fs.unlinkSync(qrPath);
        }
      } catch (error) {
        // Ignorieren
      }
    }

    // Uploads aus Datenbank löschen
    db.prepare('DELETE FROM uploads WHERE event_id = ?').run(eventId);
    
    // Event aus Datenbank löschen
    db.prepare('DELETE FROM events WHERE id = ?').run(eventId);
    
    res.json({ message: 'Event und alle zugehörigen Dateien wurden gelöscht' });
  } catch (error) {
    next(error);
  }
});

// Uploads eines Events abrufen
router.get('/:id/uploads', (req, res, next) => {
  try {
    const eventId = parseInt(req.params.id);
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId) as any;
    
    if (!event) {
      return res.status(404).json({ error: 'Event nicht gefunden' });
    }

    const uploads = db.prepare(`
      SELECT * FROM uploads 
      WHERE event_id = ? 
      ORDER BY uploaded_at DESC
    `).all(eventId);

    res.json(uploads);
  } catch (error) {
    next(error);
  }
});

export default router;
