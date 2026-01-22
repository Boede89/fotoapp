import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import db from '../database';
import { syncToSynology } from '../services/synology';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

interface MulterAuthRequest extends AuthRequest {
  file?: Express.Multer.File;
}

// Upload-Verzeichnis-Pfad (für CommonJS)
const getUploadsDir = () => {
  if (typeof __dirname !== 'undefined') {
    return path.join(__dirname, '../../uploads/events');
  }
  return path.join(process.cwd(), 'uploads/events');
};

const uploadsDirPath = getUploadsDir();
if (!fs.existsSync(uploadsDirPath)) {
  fs.mkdirSync(uploadsDirPath, { recursive: true });
}

// Multer-Konfiguration
const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    const eventId = (req.body as any).event_id || (req.query as any).event_id;
    const eventDir = path.join(uploadsDirPath, eventId?.toString() || 'temp');
    if (!fs.existsSync(eventDir)) {
      fs.mkdirSync(eventDir, { recursive: true });
    }
    cb(null, eventDir);
  },
  filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB
  },
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi|webm/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Nur Bild- und Video-Dateien sind erlaubt'));
    }
  }
});

// Datei hochladen
router.post('/', upload.single('file'), async (req: MulterRequest, res: Response, next: NextFunction) => {
  try {
    const { event_code, guest_name } = req.body;

    if (!event_code || !guest_name || !req.file) {
      return res.status(400).json({ error: 'Event-Code, Gästename und Datei sind erforderlich' });
    }

    // Event prüfen
    const event = db.prepare('SELECT * FROM events WHERE event_code = ?').get(event_code) as any;
    if (!event) {
      return res.status(404).json({ error: 'Event nicht gefunden' });
    }

    const filePath = req.file.path;
    const relativePath = `/uploads/events/${event.id}/${req.file.filename}`;

    // In Datenbank speichern
    const result = db.prepare(`
      INSERT INTO uploads (event_id, guest_name, filename, original_filename, file_path, file_type, file_size)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      event.id,
      guest_name,
      req.file.filename,
      req.file.originalname,
      relativePath,
      req.file.mimetype,
      req.file.size
    );

    // Zu Synology NAS synchronisieren (falls konfiguriert)
    if (process.env.SYNOLOGY_ENABLED === 'true') {
      try {
        await syncToSynology(event.id, event.name, filePath, req.file.originalname);
      } catch (synoError) {
        console.error('Synology-Sync-Fehler:', synoError);
        // Fehler wird geloggt, aber Upload wird trotzdem als erfolgreich markiert
      }
    }

    res.status(201).json({
      id: result.lastInsertRowid,
      message: 'Datei erfolgreich hochgeladen',
      file: {
        id: result.lastInsertRowid,
        filename: req.file.originalname,
        path: relativePath,
        size: req.file.size,
        type: req.file.mimetype
      }
    });
  } catch (error) {
    next(error);
  }
});

// Cover-Bild hochladen
router.post('/cover', upload.single('cover'), authenticateToken, async (req: MulterAuthRequest, res: Response, next: NextFunction) => {
  try {
    const { event_id } = req.body as { event_id?: string };

    if (!event_id || !req.file) {
      return res.status(400).json({ error: 'Event-ID und Cover-Bild sind erforderlich' });
    }

    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(parseInt(event_id)) as any;
    
    if (!event) {
      return res.status(404).json({ error: 'Event nicht gefunden' });
    }

    if (event.host_id !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }

    const relativePath = `/uploads/events/${event_id}/cover-${req.file.filename}`;
    
    // Altes Cover löschen (falls vorhanden)
    if (event.cover_image) {
      const oldPath = path.join(uploadsDirPath, '..', event.cover_image.replace('/uploads/', ''));
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    // Neues Cover speichern
    const newCoverPath = path.join(uploadsDirPath, event_id.toString(), `cover-${req.file!.filename}`);
    fs.renameSync(req.file.path, newCoverPath);

    db.prepare('UPDATE events SET cover_image = ? WHERE id = ?').run(relativePath, event.id);

    res.json({
      message: 'Cover-Bild erfolgreich hochgeladen',
      cover_image: relativePath
    });
  } catch (error) {
    next(error);
  }
});

export default router;
