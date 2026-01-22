import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { initDatabase } from './database';
import authRoutes from './routes/auth';
import eventRoutes from './routes/events';
import uploadRoutes from './routes/upload';
import adminRoutes from './routes/admin';
import { errorHandler } from './middleware/errorHandler';
import { cleanupExpiredEvents } from './services/cleanup';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Statische Dateien für Uploads
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Frontend statisch servieren (Production)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../public')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  });
}

// Error Handler (muss zuletzt kommen)
app.use(errorHandler);

// Datenbank initialisieren und Server starten
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
  });

  // Cleanup-Job: Alle 6 Stunden abgelaufene Events löschen
  setInterval(async () => {
    console.log('Starte Cleanup-Job für abgelaufene Events...');
    await cleanupExpiredEvents();
  }, 6 * 60 * 60 * 1000); // 6 Stunden

  // Cleanup einmal beim Start ausführen
  cleanupExpiredEvents();
}).catch((error) => {
  console.error('Fehler beim Initialisieren der Datenbank:', error);
  process.exit(1);
});
