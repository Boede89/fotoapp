import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import './EventPage.css';

interface Event {
  id: number;
  name: string;
  description: string;
  event_code: string;
  cover_image: string;
  allow_view: number;
  allow_download: number;
}

interface Upload {
  id: number;
  guest_name: string;
  filename: string;
  original_filename: string;
  file_path: string;
  file_type: string;
  uploaded_at: string;
}

function EventPage() {
  const { code } = useParams<{ code: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [guestName, setGuestName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadEvent();
    loadUploads();
  }, [code]);

  const loadEvent = async () => {
    try {
      const response = await api.get(`/events/code/${code}`);
      setEvent(response.data);
    } catch (error: any) {
      setError('Event nicht gefunden');
    }
  };

  const loadUploads = async () => {
    if (!event) return;
    try {
      const response = await api.get(`/events/${event.id}/uploads`);
      setUploads(response.data);
    } catch (error) {
      console.error('Fehler beim Laden der Uploads:', error);
    }
  };

  useEffect(() => {
    if (event) {
      loadUploads();
    }
  }, [event]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!guestName.trim() || !selectedFile || !code) {
      setError('Bitte geben Sie Ihren Namen ein und wählen Sie eine Datei aus');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('event_code', code);
      formData.append('guest_name', guestName);

      await api.post('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setGuestName('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      loadUploads();
      alert('Datei erfolgreich hochgeladen!');
    } catch (error: any) {
      setError(error.response?.data?.error || 'Fehler beim Hochladen');
    } finally {
      setUploading(false);
    }
  };

  if (!event) {
    return (
      <div className="event-page">
        <div className="loading">Lädt Event...</div>
      </div>
    );
  }

  const isImage = (fileType: string) => fileType.startsWith('image/');
  const isVideo = (fileType: string) => fileType.startsWith('video/');

  return (
    <div className="event-page">
      <div className="event-header">
        {event.cover_image && (
          <img
            src={`http://localhost:3001${event.cover_image}`}
            alt={event.name}
            className="event-cover-large"
          />
        )}
        <div className="event-title">
          <h1>{event.name}</h1>
          {event.description && <p>{event.description}</p>}
        </div>
      </div>

      <div className="event-content">
        <div className="upload-section">
          <h2>Foto/Video hochladen</h2>
          <div className="upload-form">
            <input
              type="text"
              placeholder="Ihr Name"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="name-input"
            />
            <div className="file-inputs">
              <label className="file-button">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*,video/*"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                📁 Aus Dateien wählen
              </label>
              <label className="file-button">
                <input
                  type="file"
                  ref={cameraInputRef}
                  accept="image/*,video/*"
                  capture="environment"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                📷 Kamera öffnen
              </label>
            </div>
            {selectedFile && (
              <div className="selected-file">
                Ausgewählt: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
              </div>
            )}
            {error && <div className="error-message">{error}</div>}
            <button
              onClick={handleUpload}
              disabled={uploading || !selectedFile || !guestName.trim()}
              className="upload-button"
            >
              {uploading ? 'Wird hochgeladen...' : 'Hochladen'}
            </button>
          </div>
        </div>

        {event.allow_view && (
          <div className="gallery-section">
            <h2>Galerie ({uploads.length} {uploads.length === 1 ? 'Datei' : 'Dateien'})</h2>
            {uploads.length === 0 ? (
              <p className="no-uploads">Noch keine Dateien hochgeladen</p>
            ) : (
              <div className="gallery">
                {uploads.map((upload) => (
                  <div key={upload.id} className="gallery-item">
                    {isImage(upload.file_type) ? (
                      <img
                        src={`http://localhost:3001${upload.file_path}`}
                        alt={upload.original_filename}
                        className="gallery-image"
                      />
                    ) : isVideo(upload.file_type) ? (
                      <video
                        src={`http://localhost:3001${upload.file_path}`}
                        controls
                        className="gallery-video"
                      />
                    ) : (
                      <div className="gallery-file">{upload.original_filename}</div>
                    )}
                    <div className="gallery-info">
                      <span className="guest-name">{upload.guest_name}</span>
                      {event.allow_download && (
                        <a
                          href={`http://localhost:3001${upload.file_path}`}
                          download
                          className="download-link"
                        >
                          ⬇ Herunterladen
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default EventPage;
