import express from 'express';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';
import db from '../database';
import bcrypt from 'bcryptjs';

const router = express.Router();

// Alle Routen erfordern Authentifizierung
router.use(authenticateToken);

// Gastgeber erstellen (nur Admin)
router.post('/hosts', requireRole('admin'), async (req: AuthRequest, res, next) => {
  try {
    const { username, email, password, max_events, event_date, expires_in_days = 14 } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Benutzername, E-Mail und Passwort sind erforderlich' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    try {
      const result = db.prepare(`
        INSERT INTO users (username, email, password, role, max_events, event_date, expires_in_days)
        VALUES (?, ?, ?, 'host', ?, ?, ?)
      `).run(
        username,
        email,
        hashedPassword,
        max_events || null,
        event_date || null,
        expires_in_days || 14
      );

      res.status(201).json({
        id: result.lastInsertRowid,
        username,
        email,
        role: 'host',
        max_events: max_events || null,
        event_date: event_date || null,
        expires_in_days: expires_in_days || 14
      });
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(409).json({ error: 'Benutzername oder E-Mail bereits vergeben' });
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

// Alle Gastgeber auflisten
router.get('/hosts', requireRole('admin'), (req: AuthRequest, res, next) => {
  try {
    const hosts = db.prepare(`
      SELECT u.id, u.username, u.email, u.max_events, u.event_date, u.expires_in_days, u.created_at,
        (SELECT COUNT(*) FROM events WHERE host_id = u.id) as event_count
      FROM users u
      WHERE u.role = ?
    `).all('host');
    res.json(hosts);
  } catch (error) {
    next(error);
  }
});

// Gastgeber aktualisieren
router.put('/hosts/:id', requireRole('admin'), async (req: AuthRequest, res, next) => {
  try {
    const hostId = parseInt(req.params.id);
    const { username, email, password, max_events, event_date, expires_in_days } = req.body;

    const host = db.prepare('SELECT * FROM users WHERE id = ? AND role = ?').get(hostId, 'host') as any;
    if (!host) {
      return res.status(404).json({ error: 'Gastgeber nicht gefunden' });
    }

    let updateQuery = 'UPDATE users SET ';
    const updates: any[] = [];
    const values: any[] = [];

    if (username) {
      updates.push('username = ?');
      values.push(username);
    }
    if (email) {
      updates.push('email = ?');
      values.push(email);
    }
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updates.push('password = ?');
      values.push(hashedPassword);
    }
    if (max_events !== undefined) {
      updates.push('max_events = ?');
      values.push(max_events || null);
    }
    if (event_date !== undefined) {
      updates.push('event_date = ?');
      values.push(event_date || null);
    }
    if (expires_in_days !== undefined) {
      updates.push('expires_in_days = ?');
      values.push(expires_in_days || 14);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Keine Änderungen angegeben' });
    }

    values.push(hostId);
    updateQuery += updates.join(', ') + ' WHERE id = ? AND role = ?';
    values.push('host');

    try {
      db.prepare(updateQuery).run(...values);
      const updatedHost = db.prepare('SELECT id, username, email, max_events, event_date, expires_in_days, created_at FROM users WHERE id = ?').get(hostId);
      res.json(updatedHost);
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(409).json({ error: 'Benutzername oder E-Mail bereits vergeben' });
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

// Gastgeber löschen (mit Event-Cleanup)
router.delete('/hosts/:id', requireRole('admin'), (req: AuthRequest, res, next) => {
  try {
    const hostId = parseInt(req.params.id);
    
    const host = db.prepare('SELECT * FROM users WHERE id = ? AND role = ?').get(hostId, 'host') as any;
    if (!host) {
      return res.status(404).json({ error: 'Gastgeber nicht gefunden' });
    }

    // Alle Events des Gastgebers finden
    const events = db.prepare('SELECT id FROM events WHERE host_id = ?').all(hostId) as any[];

    // Für jedes Event: Dateien und Event löschen
    const fs = require('fs');
    const path = require('path');
    const getUploadsDir = () => {
      if (typeof __dirname !== 'undefined') {
        return path.join(__dirname, '../../uploads/events');
      }
      return path.join(process.cwd(), 'uploads/events');
    };
    const uploadsDir = getUploadsDir();

    for (const event of events) {
      // Uploads löschen
      const uploads = db.prepare('SELECT file_path FROM uploads WHERE event_id = ?').all(event.id) as any[];
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
        const eventDir = path.join(uploadsDir, event.id.toString());
        if (fs.existsSync(eventDir)) {
          fs.rmSync(eventDir, { recursive: true, force: true });
        }
      } catch (error) {
        console.error('Fehler beim Löschen des Event-Ordners:', error);
      }

      // Uploads aus Datenbank löschen
      db.prepare('DELETE FROM uploads WHERE event_id = ?').run(event.id);
      // Event aus Datenbank löschen
      db.prepare('DELETE FROM events WHERE id = ?').run(event.id);
    }

    // Gastgeber löschen
    db.prepare('DELETE FROM users WHERE id = ? AND role = ?').run(hostId, 'host');
    
    res.json({ message: 'Gastgeber und alle zugehörigen Events wurden gelöscht' });
  } catch (error) {
    next(error);
  }
});

// Alle Events auflisten (Admin-Übersicht)
router.get('/events', requireRole('admin'), (req: AuthRequest, res, next) => {
  try {
    const events = db.prepare(`
      SELECT e.*, u.username as host_name
      FROM events e
      JOIN users u ON e.host_id = u.id
      ORDER BY e.created_at DESC
    `).all();
    res.json(events);
  } catch (error) {
    next(error);
  }
});

export default router;
