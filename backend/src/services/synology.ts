import SMB2 from 'smb2';
import path from 'path';
import fs from 'fs';

interface SynologyConfig {
  host: string;
  username: string;
  password: string;
  share: string;
  basePath?: string;
}

let smb2Client: SMB2 | null = null;

function getSynologyClient(): SMB2 | null {
  if (process.env.SYNOLOGY_ENABLED !== 'true') {
    return null;
  }

  if (!smb2Client) {
    const config: SynologyConfig = {
      host: process.env.SYNOLOGY_HOST || '',
      username: process.env.SYNOLOGY_USERNAME || '',
      password: process.env.SYNOLOGY_PASSWORD || '',
      share: process.env.SYNOLOGY_SHARE || 'fotoapp',
      basePath: process.env.SYNOLOGY_BASE_PATH || '/fotoapp'
    };

    if (!config.host || !config.username || !config.password) {
      console.warn('Synology-Konfiguration unvollständig');
      return null;
    }

    smb2Client = new SMB2({
      share: `\\\\${config.host}\\${config.share}`,
      domain: process.env.SYNOLOGY_DOMAIN || '',
      username: config.username,
      password: config.password
    });
  }

  return smb2Client;
}

export async function syncToSynology(
  eventId: number,
  eventName: string,
  localFilePath: string,
  originalFilename: string
): Promise<void> {
  const client = getSynologyClient();
  if (!client) {
    return;
  }

  return new Promise((resolve, reject) => {
    const basePath = process.env.SYNOLOGY_BASE_PATH || '/fotoapp';
    const eventFolder = `${basePath}/${eventName}_${eventId}`;
    const remotePath = `${eventFolder}/${originalFilename}`;

    // Ordner erstellen (falls nicht vorhanden)
    client.mkdir(eventFolder, (err) => {
      if (err && err.code !== 'EEXIST') {
        console.error('Fehler beim Erstellen des Ordners:', err);
        // Weiter versuchen, Datei hochzuladen
      }

      // Datei lesen
      const fileContent = fs.readFileSync(localFilePath);

      // Datei hochladen
      client.writeFile(remotePath, fileContent, (err) => {
        if (err) {
          console.error('Fehler beim Hochladen zur Synology:', err);
          reject(err);
        } else {
          console.log(`Datei erfolgreich zu Synology synchronisiert: ${remotePath}`);
          resolve();
        }
      });
    });
  });
}

// Alternative: WebDAV-Implementierung (falls SMB nicht funktioniert)
export async function syncToSynologyWebDAV(
  eventId: number,
  eventName: string,
  localFilePath: string,
  originalFilename: string
): Promise<void> {
  // Diese Funktion kann später implementiert werden, wenn WebDAV bevorzugt wird
  // Für jetzt verwenden wir SMB2
  return syncToSynology(eventId, eventName, localFilePath, originalFilename);
}
