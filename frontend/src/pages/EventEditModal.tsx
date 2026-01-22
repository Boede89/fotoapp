import { useState } from 'react';
import api from '../services/api';
import './Dashboard.css';

interface Event {
  id: number;
  name: string;
  description: string;
  allow_view: number;
  allow_download: number;
}

interface EventEditModalProps {
  event: Event;
  onClose: () => void;
  onUpdate: () => void;
}

function EventEditModal({ event, onClose, onUpdate }: EventEditModalProps) {
  const [formData, setFormData] = useState({
    name: event.name,
    description: event.description || '',
    allow_view: event.allow_view === 1,
    allow_download: event.allow_download === 1
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.put(`/events/${event.id}`, formData);
      onUpdate();
      onClose();
    } catch (error: any) {
      setError(error.response?.data?.error || 'Fehler beim Aktualisieren');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Event bearbeiten</h2>
        <form onSubmit={handleSubmit}>
          <label>
            Albumtitel:
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </label>
          <label>
            Beschreibung:
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={formData.allow_view}
              onChange={(e) => setFormData({ ...formData, allow_view: e.target.checked })}
            />
            Gäste können Bilder ansehen
          </label>
          <label>
            <input
              type="checkbox"
              checked={formData.allow_download}
              onChange={(e) => setFormData({ ...formData, allow_download: e.target.checked })}
            />
            Gäste können Bilder herunterladen
          </label>
          {error && <div className="error-message">{error}</div>}
          <div className="modal-actions">
            <button type="button" onClick={onClose}>Abbrechen</button>
            <button type="submit" disabled={loading}>
              {loading ? 'Wird gespeichert...' : 'Speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EventEditModal;
