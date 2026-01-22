import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';

const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/fotoapp.db');
const db = new Database(dbPath);

// Datenbank-Schema erstellen
export function initDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // Benutzer-Tabelle
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'guest',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Events-Tabelle
      db.exec(`
        CREATE TABLE IF NOT EXISTS events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          cover_image TEXT,
          qr_code TEXT,
          event_code TEXT UNIQUE NOT NULL,
          host_id INTEGER NOT NULL,
          allow_view BOOLEAN DEFAULT 1,
          allow_download BOOLEAN DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (host_id) REFERENCES users(id)
        )
      `);

      // Uploads-Tabelle
      db.exec(`
        CREATE TABLE IF NOT EXISTS uploads (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_id INTEGER NOT NULL,
          guest_name TEXT NOT NULL,
          filename TEXT NOT NULL,
          original_filename TEXT NOT NULL,
          file_path TEXT NOT NULL,
          file_type TEXT NOT NULL,
          file_size INTEGER NOT NULL,
          uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (event_id) REFERENCES events(id)
        )
      `);

      // Admin-Benutzer erstellen (falls nicht vorhanden)
      const adminExists = db.prepare('SELECT id FROM users WHERE role = ?').get('admin');
      if (!adminExists) {
        const defaultPassword = process.env.ADMIN_PASSWORD || 'admin123';
        const hashedPassword = bcrypt.hashSync(defaultPassword, 10);
        db.prepare(`
          INSERT INTO users (username, email, password, role)
          VALUES (?, ?, ?, ?)
        `).run('admin', 'admin@fotoapp.local', hashedPassword, 'admin');
        console.log('Admin-Benutzer erstellt: admin / ' + defaultPassword);
      }

      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

export default db;
