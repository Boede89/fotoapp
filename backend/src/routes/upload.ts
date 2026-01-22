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
  files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };
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
// Temporäres Verzeichnis für Uploads (wird später verschoben)
const tempUploadsDir = path.join(uploadsDirPath, 'temp');
if (!fs.existsSync(tempUploadsDir)) {
  fs.mkdirSync(tempUploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    // Dateien werden zunächst in temp gespeichert, dann nach Event-ID verschoben
    cb(null, tempUploadsDir);
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
    fileSize: 500 * 1024 * 1024 // 500MB
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

// Mehrere Dateien hochladen
router.post('/', upload.array('files', 50), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { event_code, guest_name } = req.body;
    
    // Dateien aus Request extrahieren
    let files: Express.Multer.File[] = [];
    if (req.files) {
      if (Array.isArray(req.files)) {
        files = req.files;
      } else if (typeof req.files === 'object') {
        // Wenn files ein Objekt ist, alle Arrays zusammenführen
        files = Object.values(req.files).flat();
      }
    } else if ((req as any).file) {
      files = [(req as any).file];
    }

    if (!event_code || !guest_name || files.length === 0) {
      return res.status(400).json({ error: 'Event-Code, Gästename und mindestens eine Datei sind erforderlich' });
    }

    // Event prüfen
    const event = db.prepare('SELECT * FROM events WHERE event_code = ?').get(event_code) as any;
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

    const uploadedFiles: any[] = [];

    // Event-Verzeichnis erstellen
    const eventDir = path.join(uploadsDirPath, event.id.toString());
    if (!fs.existsSync(eventDir)) {
      fs.mkdirSync(eventDir, { recursive: true });
    }

    // Alle Dateien verarbeiten
    for (const file of files) {
      // Datei von temp-Verzeichnis ins Event-Verzeichnis verschieben
      const tempFilePath = file.path;
      const finalFilePath = path.join(eventDir, file.filename);
      
      // Datei verschieben
      fs.renameSync(tempFilePath, finalFilePath);
      
      const relativePath = `/uploads/events/${event.id}/${file.filename}`;

      // In Datenbank speichern
      const result = db.prepare(`
        INSERT INTO uploads (event_id, guest_name, filename, original_filename, file_path, file_type, file_size)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        event.id,
        guest_name,
        file.filename,
        file.originalname,
        relativePath,
        file.mimetype,
        file.size
      );

      // Zu Synology NAS synchronisieren (falls konfiguriert)
      if (process.env.SYNOLOGY_ENABLED === 'true') {
        try {
          await syncToSynology(event.id, event.name, finalFilePath, file.originalname);
        } catch (synoError) {
          console.error('Synology-Sync-Fehler:', synoError);
          // Fehler wird geloggt, aber Upload wird trotzdem als erfolgreich markiert
        }
      }

      uploadedFiles.push({
        id: result.lastInsertRowid,
        filename: file.originalname,
        path: relativePath,
        size: file.size,
        type: file.mimetype
      });
    }

    res.status(201).json({
      message: `${uploadedFiles.length} Datei(en) erfolgreich hochgeladen`,
      files: uploadedFiles
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
