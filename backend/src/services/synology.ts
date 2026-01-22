import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

interface SynologyConfig {
  host: string;
  username: string;
  password: string;
  share: string;
  basePath?: string;
  mountPoint?: string;
}

let isMounted = false;
let mountPoint: string | null = null;

function getSynologyConfig(): SynologyConfig | null {
  if (process.env.SYNOLOGY_ENABLED !== 'true') {
    return null;
  }

  const config: SynologyConfig = {
    host: process.env.SYNOLOGY_HOST || '',
    username: process.env.SYNOLOGY_USERNAME || '',
    password: process.env.SYNOLOGY_PASSWORD || '',
    share: process.env.SYNOLOGY_SHARE || 'fotoapp',
    basePath: process.env.SYNOLOGY_BASE_PATH || '/fotoapp',
    mountPoint: process.env.SYNOLOGY_MOUNT_POINT || '/mnt/synology'
  };

  if (!config.host || !config.username || !config.password) {
    console.warn('Synology-Konfiguration unvollständig');
    return null;
  }

  return config;
}

async function mountSynologyShare(config: SynologyConfig): Promise<boolean> {
  if (isMounted && mountPoint) {
    return true;
  }

  try {
    // Mount-Point erstellen
    if (!fs.existsSync(config.mountPoint!)) {
      fs.mkdirSync(config.mountPoint!, { recursive: true });
    }

    // SMB-Share mounten
    const mountCmd = `mount -t cifs //${config.host}/${config.share} ${config.mountPoint} -o username=${config.username},password=${config.password},uid=1000,gid=1000,iocharset=utf8`;
    
    try {
      await execAsync(mountCmd);
      isMounted = true;
      mountPoint = config.mountPoint!;
      console.log(`Synology-Share erfolgreich gemountet: ${config.mountPoint}`);
      return true;
    } catch (error: any) {
      // Falls bereits gemountet, ist das OK
      if (error.message.includes('already mounted') || error.message.includes('Device or resource busy')) {
        isMounted = true;
        mountPoint = config.mountPoint!;
        return true;
      }
      throw error;
    }
  } catch (error) {
    console.error('Fehler beim Mounten der Synology-Share:', error);
    return false;
  }
}

export async function syncToSynology(
  eventId: number,
  eventName: string,
  localFilePath: string,
  originalFilename: string
): Promise<void> {
  const config = getSynologyConfig();
  if (!config) {
    return;
  }

  try {
    // Share mounten (falls nicht bereits gemountet)
    const mounted = await mountSynologyShare(config);
    if (!mounted) {
      console.warn('Synology-Share konnte nicht gemountet werden. Überspringe Synchronisation.');
      return;
    }

    const basePath = config.basePath || '/fotoapp';
    const eventFolder = path.join(config.mountPoint!, basePath, `${eventName}_${eventId}`);
    const remotePath = path.join(eventFolder, originalFilename);

    // Ordner erstellen (falls nicht vorhanden)
    if (!fs.existsSync(eventFolder)) {
      fs.mkdirSync(eventFolder, { recursive: true });
    }

    // Datei kopieren
    fs.copyFileSync(localFilePath, remotePath);
    console.log(`Datei erfolgreich zu Synology synchronisiert: ${remotePath}`);
  } catch (error) {
    console.error('Fehler beim Synchronisieren zur Synology:', error);
    // Fehler wird geloggt, aber Upload wird trotzdem als erfolgreich markiert
  }
}

// Alternative: WebDAV-Implementierung (falls SMB nicht funktioniert)
export async function syncToSynologyWebDAV(
  eventId: number,
  eventName: string,
  localFilePath: string,
  originalFilename: string
): Promise<void> {
  // Diese Funktion kann später implementiert werden, wenn WebDAV bevorzugt wird
  // Für jetzt verwenden wir SMB/CIFS mount
  return syncToSynology(eventId, eventName, localFilePath, originalFilename);
}
