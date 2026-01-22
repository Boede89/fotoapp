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

// Gastgeber löschen
router.delete('/hosts/:id', requireRole('admin'), (req: AuthRequest, res, next) => {
  try {
    const hostId = parseInt(req.params.id);
    db.prepare('DELETE FROM users WHERE id = ? AND role = ?').run(hostId, 'host');
    res.json({ message: 'Gastgeber gelöscht' });
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
