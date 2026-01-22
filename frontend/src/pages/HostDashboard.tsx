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
              @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap');
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              body {
                font-family: 'Poppins', Arial, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                padding: 40px 20px;
              }
              .qr-container {
                background: white;
                border-radius: 24px;
                padding: 30px 25px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                text-align: center;
                max-width: 600px;
                width: 100%;
                page-break-inside: avoid;
              }
              .party-header {
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 10px;
                margin-bottom: 15px;
              }
              .party-icon {
                font-size: 36px;
                animation: bounce 2s infinite;
              }
              @keyframes bounce {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-10px); }
              }
              .event-title {
                font-size: clamp(20px, 4vw, 28px);
                font-weight: 700;
                color: #667eea;
                margin-bottom: 15px;
                line-height: 1.2;
                word-wrap: break-word;
                overflow-wrap: break-word;
                hyphens: auto;
                max-width: 100%;
              }
              .qr-description {
                font-size: 16px;
                color: #555;
                margin-bottom: 20px;
                line-height: 1.4;
                font-weight: 400;
              }
              .qr-code-wrapper {
                background: white;
                padding: 15px;
                border-radius: 16px;
                display: inline-block;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                margin-bottom: 20px;
              }
              .qr-code-wrapper img {
                max-width: 280px;
                width: 100%;
                height: auto;
                display: block;
              }
              .qr-instructions {
                background: #f8f9fa;
                border-radius: 12px;
                padding: 15px;
                margin-top: 15px;
              }
              .qr-instructions h3 {
                font-size: 16px;
                color: #333;
                margin-bottom: 8px;
                font-weight: 600;
              }
              .qr-instructions ol {
                text-align: left;
                display: inline-block;
                color: #666;
                font-size: 13px;
                line-height: 1.6;
                margin: 0;
                padding-left: 20px;
              }
              .qr-instructions li {
                margin-bottom: 4px;
              }
              .event-code {
                margin-top: 15px;
                padding: 10px 15px;
                background: #667eea;
                color: white;
                border-radius: 8px;
                font-size: 12px;
                font-weight: 600;
                display: inline-block;
              }
              .footer {
                margin-top: 15px;
                font-size: 11px;
                color: #999;
              }
              @media print {
                @page {
                  size: A4;
                  margin: 10mm;
                }
                body {
                  background: white;
                  padding: 0;
                  margin: 0;
                }
                .qr-container {
                  box-shadow: none;
                  padding: 15px 10px;
                  border-radius: 8px;
                  max-width: 100%;
                  page-break-inside: avoid;
                  break-inside: avoid;
                }
                .party-icon {
                  animation: none;
                  font-size: 24px;
                }
                .party-header {
                  margin-bottom: 8px;
                  gap: 8px;
                }
                .event-title {
                  font-size: clamp(14px, 3vw, 18px);
                  margin-bottom: 8px;
                  line-height: 1.1;
                  word-wrap: break-word;
                  overflow-wrap: break-word;
                  hyphens: auto;
                }
                .qr-description {
                  font-size: 12px;
                  margin-bottom: 10px;
                  line-height: 1.3;
                }
                .qr-code-wrapper {
                  padding: 10px;
                  margin-bottom: 10px;
                }
                .qr-code-wrapper img {
                  max-width: 200px;
                }
                .qr-instructions {
                  padding: 10px;
                  margin-top: 10px;
                }
                .qr-instructions h3 {
                  font-size: 12px;
                  margin-bottom: 5px;
                }
                .qr-instructions ol {
                  font-size: 10px;
                  line-height: 1.4;
                  padding-left: 18px;
                }
                .qr-instructions li {
                  margin-bottom: 2px;
                }
                .event-code {
                  margin-top: 10px;
                  padding: 6px 10px;
                  font-size: 10px;
                }
                .footer {
                  margin-top: 10px;
                  font-size: 9px;
                }
              }
            </style>
          </head>
          <body>
            <div class="qr-container">
              <div class="party-header">
                <span class="party-icon">🎉</span>
                <span class="party-icon">📸</span>
                <span class="party-icon">🎊</span>
              </div>
              <h1 class="event-title">${event.name}</h1>
              <p class="qr-description">
                Scanne den QR-Code mit deinem Smartphone und teile deine schönsten Momente mit uns!
              </p>
              <div class="qr-code-wrapper">
                <img src="${window.location.origin}${event.qr_code}" alt="QR-Code" />
              </div>
              <div class="qr-instructions">
                <h3>So funktioniert's:</h3>
                <ol>
                  <li>Öffne die Kamera-App auf deinem Smartphone</li>
                  <li>Scanne den QR-Code</li>
                  <li>Gib deinen Namen ein</li>
                  <li>Lade deine Fotos und Videos hoch</li>
                </ol>
              </div>
              <div class="event-code">Event-Code: ${event.event_code}</div>
              <div class="footer">Viel Spaß auf der Party! 🎈</div>
            </div>
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                }, 500);
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
