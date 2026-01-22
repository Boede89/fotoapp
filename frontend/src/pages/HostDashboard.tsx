import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import EventEditModal from './EventEditModal';
import { ToastContainer } from '../components/Toast';
import { ConfirmModal } from '../components/ConfirmModal';
import './Dashboard.css';

interface Event {
  id: number;
  name: string;
  description: string;
  event_code: string;
  qr_code: string;
  cover_image: string;
  allow_view: number;
  allow_download: number;
  upload_count: number;
  created_at: string;
}

interface UserProfile {
  id: number;
  username: string;
  email: string;
  role: string;
  max_events: number | null;
  event_date: string | null;
  expires_in_days: number;
  event_count?: number;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

function HostDashboard() {
  const { user, logout } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [newEvent, setNewEvent] = useState({
    name: '',
    description: '',
    allow_view: true,
    allow_download: false
  });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [showQRCode, setShowQRCode] = useState<Event | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const toastIdRef = useRef(0);

  useEffect(() => {
    loadEvents();
    loadUserProfile();
  }, []);

  const loadEvents = async () => {
    try {
      const response = await api.get('/events/my-events');
      setEvents(response.data);
    } catch (error) {
      console.error('Fehler beim Laden der Events:', error);
    }
  };

  const loadUserProfile = async () => {
    try {
      const response = await api.get('/auth/me');
      setUserProfile(response.data);
    } catch (error) {
      console.error('Fehler beim Laden des Profils:', error);
    }
  };

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

  const canCreateEvent = () => {
    if (!userProfile) return true;
    if (userProfile.max_events === null) return true;
    const currentCount = userProfile.event_count || 0;
    return currentCount < userProfile.max_events;
  };

  const handleShowAddEvent = () => {
    if (!canCreateEvent()) {
      showToast(`Sie haben bereits die maximale Anzahl von ${userProfile?.max_events} Event(s) erreicht.`, 'error');
      return;
    }
    setShowAddEvent(true);
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await api.post('/events', newEvent);
      const eventId = response.data.id;

      // Cover-Bild hochladen (falls vorhanden)
      if (coverFile && eventId) {
        const formData = new FormData();
        formData.append('cover', coverFile);
        formData.append('event_id', eventId.toString());
        await api.post('/upload/cover', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
      }

      setNewEvent({ name: '', description: '', allow_view: true, allow_download: false });
      setCoverFile(null);
      if (coverInputRef.current) coverInputRef.current.value = '';
      setShowAddEvent(false);
      loadEvents();
      loadUserProfile();
      showToast('Event erfolgreich erstellt!', 'success');
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Fehler beim Erstellen des Events', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEvent = async (id: number) => {
    showConfirm(
      'Möchten Sie dieses Event wirklich löschen? Alle zugehörigen Dateien werden ebenfalls gelöscht.',
      async () => {
        try {
          await api.delete(`/events/${id}`);
          loadEvents();
          loadUserProfile();
          showToast('Event erfolgreich gelöscht', 'success');
          setConfirmModal(null);
        } catch (error: any) {
          showToast(error.response?.data?.error || 'Fehler beim Löschen', 'error');
          setConfirmModal(null);
          console.error('Fehler beim Löschen:', error);
        }
      }
    );
  };

  const handlePrintQRCode = (event: Event) => {
    const printWindow = window.open('', '_blank');
    if (printWindow && event.qr_code) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>QR-Code - ${event.name}</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
                padding: 20px;
              }
              h1 { margin-bottom: 10px; }
              p { color: #666; margin-bottom: 20px; }
              img { max-width: 400px; height: auto; }
              @media print {
                body { margin: 0; }
              }
            </style>
          </head>
          <body>
            <h1>${event.name}</h1>
            <p>Scannen Sie diesen QR-Code, um zum Event zu gelangen</p>
            <img src="${window.location.origin}${event.qr_code}" alt="QR-Code" />
            <p style="margin-top: 20px; font-size: 12px;">Event-Code: ${event.event_code}</p>
            <script>
              window.onload = function() {
                window.print();
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const getEventUrl = (code: string) => {
    return `${window.location.origin}/event/${code}`;
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Gastgeber Dashboard</h1>
        <div className="user-info">
          <span>Angemeldet als: {user?.username}</span>
          <button onClick={logout} className="logout-button">Abmelden</button>
        </div>
      </header>

      <div className="dashboard-content">
        <div className="section">
          <div className="section-header">
            <h2>Meine Events</h2>
            {userProfile && userProfile.max_events !== null && (
              <div className="event-limit-info">
                {userProfile.event_count || 0} / {userProfile.max_events} Events
              </div>
            )}
            <button 
              onClick={showAddEvent ? () => setShowAddEvent(false) : handleShowAddEvent} 
              className="add-button"
              disabled={!canCreateEvent() && !showAddEvent}
            >
              {showAddEvent ? 'Abbrechen' : '+ Event erstellen'}
            </button>
          </div>

          {showAddEvent && (
            <form onSubmit={handleAddEvent} className="add-form">
              <input
                type="text"
                placeholder="Event-Name"
                value={newEvent.name}
                onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })}
                required
              />
              <textarea
                placeholder="Beschreibung (optional)"
                value={newEvent.description}
                onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                rows={3}
              />
              <label>
                <input
                  type="checkbox"
                  checked={newEvent.allow_view}
                  onChange={(e) => setNewEvent({ ...newEvent, allow_view: e.target.checked })}
                />
                Gäste können Bilder ansehen
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={newEvent.allow_download}
                  onChange={(e) => setNewEvent({ ...newEvent, allow_download: e.target.checked })}
                />
                Gäste können Bilder herunterladen
              </label>
              <button type="submit" disabled={loading}>
                {loading ? 'Wird erstellt...' : 'Event erstellen'}
              </button>
            </form>
          )}

          <div className="events-list">
            {events.map((event) => (
              <div key={event.id} className="event-card">
                {event.cover_image && (
                  <img
                    src={event.cover_image}
                    alt={event.name}
                    className="event-cover"
                  />
                )}
                <div className="event-info">
                  <h3>{event.name}</h3>
                  {event.description && <p>{event.description}</p>}
                  <div className="event-meta">
                    <span>Code: {event.event_code}</span>
                    <span>{event.upload_count} Uploads</span>
                  </div>
                  <div className="event-permissions">
                    <span className={event.allow_view ? 'allowed' : 'denied'}>
                      {event.allow_view ? '✓ Ansehen' : '✗ Ansehen'}
                    </span>
                    <span className={event.allow_download ? 'allowed' : 'denied'}>
                      {event.allow_download ? '✓ Download' : '✗ Download'}
                    </span>
                  </div>
                  <div className="event-url">
                    <strong>Event-URL:</strong>
                    <input
                      type="text"
                      value={getEventUrl(event.event_code)}
                      readOnly
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                  </div>
                  <div className="event-actions">
                    <button
                      onClick={() => setEditingEvent(event)}
                      className="edit-button"
                    >
                      Bearbeiten
                    </button>
                    <button
                      onClick={() => setShowQRCode(event)}
                      className="qr-button"
                    >
                      QR-Code
                    </button>
                    <a
                      href={`/event/${event.event_code}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="view-button"
                    >
                      Event ansehen
                    </a>
                    <button
                      onClick={() => handleDeleteEvent(event.id)}
                      className="delete-button"
                    >
                      Löschen
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {editingEvent && (
        <EventEditModal
          event={editingEvent}
          onClose={() => setEditingEvent(null)}
          onUpdate={loadEvents}
        />
      )}

      {showQRCode && (
        <div className="modal-overlay" onClick={() => setShowQRCode(null)}>
          <div className="qr-modal" onClick={(e) => e.stopPropagation()}>
            <div className="qr-modal-header">
              <h2>QR-Code: {showQRCode.name}</h2>
              <button className="qr-modal-close" onClick={() => setShowQRCode(null)}>×</button>
            </div>
            <div className="qr-modal-content">
              {showQRCode.qr_code && (
                <img
                  src={showQRCode.qr_code}
                  alt="QR-Code"
                  className="qr-code-image"
                />
              )}
              <p className="qr-code-url">{getEventUrl(showQRCode.event_code)}</p>
              <div className="qr-modal-actions">
                <button
                  onClick={() => handlePrintQRCode(showQRCode)}
                  className="qr-print-button"
                >
                  🖨️ Drucken
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(getEventUrl(showQRCode.event_code));
                    showToast('URL in Zwischenablage kopiert!', 'success');
                  }}
                  className="qr-copy-button"
                >
                  📋 URL kopieren
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

export default HostDashboard;
