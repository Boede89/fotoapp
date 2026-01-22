import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../database';

const router = express.Router();

// Login
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Benutzername und Passwort erforderlich' });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(username, username) as any;

    if (!user) {
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }

    const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      secret,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
});

// Registrierung (nur für Gastgeber durch Admin)
router.post('/register', async (req, res, next) => {
  try {
    const { username, email, password, role = 'host' } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Alle Felder sind erforderlich' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    try {
      const result = db.prepare(`
        INSERT INTO users (username, email, password, role)
        VALUES (?, ?, ?, ?)
      `).run(username, email, hashedPassword, role);

      res.status(201).json({
        id: result.lastInsertRowid,
        username,
        email,
        role
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

// Benutzer-Profil abrufen
router.get('/me', authenticateToken, (req: AuthRequest, res, next) => {
  try {
    const user = db.prepare('SELECT id, username, email, role, max_events, event_date, expires_in_days FROM users WHERE id = ?').get(req.user!.id) as any;
    if (!user) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }
    
    // Event-Anzahl hinzufügen
    if (user.role === 'host') {
      const eventCount = db.prepare('SELECT COUNT(*) as count FROM events WHERE host_id = ?').get(user.id) as any;
      user.event_count = eventCount.count;
    }
    
    res.json(user);
  } catch (error) {
    next(error);
  }
});

export default router;
