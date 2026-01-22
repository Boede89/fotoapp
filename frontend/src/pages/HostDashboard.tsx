import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import EventEditModal from './EventEditModal';
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

function HostDashboard() {
  const { user, logout } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [newEvent, setNewEvent] = useState({
    name: '',
    description: '',
    allow_view: true,
    allow_download: false
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      const response = await api.get('/events/my-events');
      setEvents(response.data);
    } catch (error) {
      console.error('Fehler beim Laden der Events:', error);
    }
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/events', newEvent);
      setNewEvent({ name: '', description: '', allow_view: true, allow_download: false });
      setShowAddEvent(false);
      loadEvents();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Fehler beim Erstellen des Events');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEvent = async (id: number) => {
    if (!confirm('Möchten Sie dieses Event wirklich löschen? Alle zugehörigen Dateien werden ebenfalls gelöscht.')) return;
    try {
      await api.delete(`/events/${id}`);
      loadEvents();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Fehler beim Löschen');
      console.error('Fehler beim Löschen:', error);
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
            <button onClick={() => setShowAddEvent(!showAddEvent)} className="add-button">
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
    </div>
  );
}

export default HostDashboard;
