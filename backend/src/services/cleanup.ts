import db from '../database';
import fs from 'fs';
import path from 'path';

// Upload-Verzeichnis-Pfad
const getUploadsDir = () => {
  if (typeof __dirname !== 'undefined') {
    return path.join(__dirname, '../../uploads/events');
  }
  return path.join(process.cwd(), 'uploads/events');
};

export async function cleanupExpiredEvents(): Promise<void> {
  try {
    const now = new Date().toISOString();
    
    // Abgelaufene Events finden
    const expiredEvents = db.prepare(`
      SELECT id, name FROM events 
      WHERE expires_at IS NOT NULL AND expires_at < ?
    `).all(now) as any[];

    console.log(`Gefundene abgelaufene Events: ${expiredEvents.length}`);

    for (const event of expiredEvents) {
      // Alle Uploads des Events finden
      const uploads = db.prepare('SELECT file_path FROM uploads WHERE event_id = ?').all(event.id) as any[];

      // Dateien löschen
      const uploadsDir = getUploadsDir();
      for (const upload of uploads) {
        try {
          const filePath = path.join(uploadsDir, '..', upload.file_path.replace('/uploads/', ''));
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`Datei gelöscht: ${filePath}`);
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
          console.log(`Event-Ordner gelöscht: ${eventDir}`);
        }
      } catch (error) {
        console.error(`Fehler beim Löschen des Event-Ordners:`, error);
      }

      // QR-Code löschen (falls vorhanden)
      const eventData = db.prepare('SELECT qr_code FROM events WHERE id = ?').get(event.id) as any;
      if (eventData?.qr_code) {
        try {
          const qrPath = path.join(uploadsDir, '..', 'qrcodes', path.basename(eventData.qr_code));
          if (fs.existsSync(qrPath)) {
            fs.unlinkSync(qrPath);
          }
        } catch (error) {
          // Ignorieren
        }
      }

      // Uploads aus Datenbank löschen
      db.prepare('DELETE FROM uploads WHERE event_id = ?').run(event.id);
      console.log(`Uploads für Event ${event.id} gelöscht`);

      // Event aus Datenbank löschen
      db.prepare('DELETE FROM events WHERE id = ?').run(event.id);
      console.log(`Event ${event.id} (${event.name}) gelöscht`);
    }

    if (expiredEvents.length > 0) {
      console.log(`${expiredEvents.length} abgelaufene Event(s) wurden gelöscht`);
    }
  } catch (error) {
    console.error('Fehler beim Cleanup:', error);
  }
}
