import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import { ToastContainer } from '../components/Toast';
import { ConfirmModal } from '../components/ConfirmModal';
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

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

function EventPage() {
  const { code } = useParams<{ code: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [canView, setCanView] = useState(true);
  const [canDownload, setCanDownload] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [selectedUploads, setSelectedUploads] = useState<number[]>([]);
  const [guestName, setGuestName] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const toastIdRef = useRef(0);

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
      setUploads(response.data.uploads || response.data);
      setCanView(response.data.canView !== undefined ? response.data.canView : true);
      setCanDownload(response.data.canDownload !== undefined ? response.data.canDownload : false);
      setIsHost(response.data.isHost || false);
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
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      setSelectedFiles(filesArray);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!guestName.trim() || selectedFiles.length === 0 || !code) {
      setError('Bitte geben Sie Ihren Namen ein und wählen Sie mindestens eine Datei aus');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      // Alle Dateien hinzufügen
      selectedFiles.forEach((file) => {
        formData.append('files', file);
      });
      formData.append('event_code', code);
      formData.append('guest_name', guestName);

      await api.post('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setGuestName('');
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      loadUploads();
      showToast(`${selectedFiles.length} Datei(en) erfolgreich hochgeladen!`, 'success');
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Fehler beim Hochladen';
      setError(errorMsg);
      showToast(errorMsg, 'error');
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

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const showConfirm = (message: string, onConfirm: () => void) => {
    setConfirmModal({ message, onConfirm });
  };

  const isImage = (fileType: string) => fileType.startsWith('image/');
  const isVideo = (fileType: string) => fileType.startsWith('video/');

  const handleDeleteUpload = async (uploadId: number) => {
    if (!event) return;
    showConfirm(
      'Möchten Sie dieses Bild wirklich löschen?',
      async () => {
        try {
          await api.delete(`/events/${event.id}/uploads/${uploadId}`);
          loadUploads();
          showToast('Bild erfolgreich gelöscht', 'success');
          setConfirmModal(null);
        } catch (error: any) {
          showToast(error.response?.data?.error || 'Fehler beim Löschen', 'error');
          setConfirmModal(null);
        }
      }
    );
  };

  const handleBulkDelete = async () => {
    if (!event || selectedUploads.length === 0) return;
    showConfirm(
      `Möchten Sie ${selectedUploads.length} Bild(er) wirklich löschen?`,
      async () => {
        try {
          for (const uploadId of selectedUploads) {
            await api.delete(`/events/${event.id}/uploads/${uploadId}`);
          }
          setSelectedUploads([]);
          loadUploads();
          showToast(`${selectedUploads.length} Bild(er) erfolgreich gelöscht`, 'success');
          setConfirmModal(null);
        } catch (error: any) {
          showToast(error.response?.data?.error || 'Fehler beim Löschen', 'error');
          setConfirmModal(null);
        }
      }
    );
  };

  const handleBulkDownload = async () => {
    if (!event || selectedUploads.length === 0) return;
    
    try {
      const response = await api.post(`/events/${event.id}/uploads/download`, {
        uploadIds: selectedUploads
      });
      
      // Alle ausgewählten Dateien herunterladen
      response.data.files.forEach((file: any) => {
        const link = document.createElement('a');
        link.href = file.path;
        link.download = file.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });
      
      setSelectedUploads([]);
      showToast(`${selectedUploads.length} Datei(en) werden heruntergeladen`, 'success');
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Fehler beim Download', 'error');
    }
  };

  const handleDownloadAll = async () => {
    if (!event || uploads.length === 0) return;
    
    try {
      const response = await api.post(`/events/${event.id}/uploads/download`, {});
      
      // Alle Dateien herunterladen
      response.data.files.forEach((file: any) => {
        const link = document.createElement('a');
        link.href = file.path;
        link.download = file.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });
      showToast(`${uploads.length} Datei(en) werden heruntergeladen`, 'success');
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Fehler beim Download', 'error');
    }
  };

  return (
    <div className="event-page">
      <div className="event-header">
        {event.cover_image && (
          <img
            src={event.cover_image}
            alt={event.name}
            className="event-cover-large"
            onError={(e) => {
              // Fallback auf absoluten Pfad
              const img = e.target as HTMLImageElement;
              if (!img.src.startsWith('http')) {
                img.src = `${window.location.origin}${event.cover_image}`;
              }
            }}
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
                  multiple
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                📁 Mehrere Dateien wählen
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
            {selectedFiles.length > 0 && (
              <div className="selected-files">
                <strong>{selectedFiles.length} Datei(en) ausgewählt:</strong>
                <ul>
                  {selectedFiles.map((file, index) => (
                    <li key={index}>
                      {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {error && <div className="error-message">{error}</div>}
            <button
              onClick={handleUpload}
              disabled={uploading || selectedFiles.length === 0 || !guestName.trim()}
              className="upload-button"
            >
              {uploading ? `Wird hochgeladen... (${selectedFiles.length} Datei(en))` : `${selectedFiles.length > 0 ? selectedFiles.length + ' ' : ''}Datei(en) hochladen`}
            </button>
          </div>
        </div>

        {canView && (
          <div className="gallery-section">
            <div className="gallery-header">
              <h2>Galerie ({uploads.length} {uploads.length === 1 ? 'Datei' : 'Dateien'})</h2>
              {uploads.length > 0 && (
                <div className="gallery-actions">
                  {isHost && (
                    <button
                      onClick={handleBulkDelete}
                      disabled={selectedUploads.length === 0}
                      className="delete-selected-button"
                    >
                      Ausgewählte löschen ({selectedUploads.length})
                    </button>
                  )}
                  {canDownload && (
                    <>
                      <button
                        onClick={handleBulkDownload}
                        disabled={selectedUploads.length === 0}
                        className="download-selected-button"
                      >
                        Ausgewählte herunterladen ({selectedUploads.length})
                      </button>
                      <button
                        onClick={handleDownloadAll}
                        className="download-all-button"
                      >
                        Alle herunterladen
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            {uploads.length === 0 ? (
              <p className="no-uploads">Noch keine Dateien hochgeladen</p>
            ) : (
              <div className="gallery">
                {uploads.map((upload) => (
                  <div key={upload.id} className={`gallery-item ${selectedUploads.includes(upload.id) ? 'selected' : ''}`}>
                    {isHost && (
                      <input
                        type="checkbox"
                        checked={selectedUploads.includes(upload.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedUploads([...selectedUploads, upload.id]);
                          } else {
                            setSelectedUploads(selectedUploads.filter(id => id !== upload.id));
                          }
                        }}
                        className="upload-checkbox"
                      />
                    )}
                    {canDownload && !isHost && (
                      <input
                        type="checkbox"
                        checked={selectedUploads.includes(upload.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedUploads([...selectedUploads, upload.id]);
                          } else {
                            setSelectedUploads(selectedUploads.filter(id => id !== upload.id));
                          }
                        }}
                        className="upload-checkbox"
                      />
                    )}
                    {isImage(upload.file_type) ? (
                      <img
                        src={upload.file_path}
                        alt={upload.original_filename}
                        className="gallery-image"
                        onError={(e) => {
                          // Fallback auf absoluten Pfad
                          const img = e.target as HTMLImageElement;
                          if (!img.src.startsWith('http')) {
                            img.src = `${window.location.origin}${upload.file_path}`;
                          }
                        }}
                      />
                    ) : isVideo(upload.file_type) ? (
                      <video
                        src={upload.file_path}
                        controls
                        className="gallery-video"
                      />
                    ) : (
                      <div className="gallery-file">{upload.original_filename}</div>
                    )}
                    <div className="gallery-info">
                      <span className="guest-name">{upload.guest_name}</span>
                      <div className="gallery-item-actions">
                        {canDownload && (
                          <a
                            href={upload.file_path}
                            download={upload.original_filename}
                            className="download-link"
                          >
                            ⬇ Herunterladen
                          </a>
                        )}
                        {isHost && (
                          <button
                            onClick={() => handleDeleteUpload(upload.id)}
                            className="delete-upload-button"
                          >
                            🗑️ Löschen
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {confirmModal && (
        <ConfirmModal
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
          confirmText="Löschen"
          cancelText="Abbrechen"
          type="danger"
        />
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

export default EventPage;
