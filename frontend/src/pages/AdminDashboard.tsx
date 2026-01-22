import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { ToastContainer } from '../components/Toast';
import { ConfirmModal } from '../components/ConfirmModal';
import './Dashboard.css';

interface Host {
  id: number;
  username: string;
  email: string;
  max_events: number | null;
  event_date: string | null;
  expires_in_days: number;
  event_count?: number;
  created_at: string;
}

function AdminDashboard() {
  const { user, logout } = useAuth();
  const [hosts, setHosts] = useState<Host[]>([]);
  const [showAddHost, setShowAddHost] = useState(false);
  const [editingHost, setEditingHost] = useState<Host | null>(null);
  const [newHost, setNewHost] = useState({
    username: '',
    email: '',
    password: '',
    max_events: '',
    event_date: '',
    expires_in_days: 14
  });
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const toastIdRef = useRef(0);

  useEffect(() => {
    loadHosts();
  }, []);

  const loadHosts = async () => {
    try {
      const response = await api.get('/admin/hosts');
      setHosts(response.data);
    } catch (error) {
      console.error('Fehler beim Laden der Gastgeber:', error);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = ++toastIdRef.current;
    setToasts((prev: Toast[]) => [...prev, { id, message, type }]);
  };

  const removeToast = (id: number) => {
    setToasts((prev: Toast[]) => prev.filter((t: Toast) => t.id !== id));
  };

  const showConfirm = (message: string, onConfirm: () => void) => {
    setConfirmModal({ message, onConfirm });
  };

  const handleAddHost = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/admin/hosts', {
        ...newHost,
        max_events: newHost.max_events ? parseInt(newHost.max_events) : null
      });
      setNewHost({ username: '', email: '', password: '', max_events: '', event_date: '', expires_in_days: 14 });
      setShowAddHost(false);
      loadHosts();
      showToast('Gastgeber erfolgreich erstellt!', 'success');
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Fehler beim Erstellen des Gastgebers', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteHost = async (id: number) => {
    showConfirm(
      'Möchten Sie diesen Gastgeber wirklich löschen? Alle zugehörigen Events und Dateien werden ebenfalls gelöscht.',
      async () => {
        try {
          await api.delete(`/admin/hosts/${id}`);
          loadHosts();
          showToast('Gastgeber erfolgreich gelöscht', 'success');
          setConfirmModal(null);
        } catch (error: any) {
          showToast(error.response?.data?.error || 'Fehler beim Löschen', 'error');
          setConfirmModal(null);
          console.error('Fehler beim Löschen:', error);
        }
      }
    );
  };

  const handleEditHost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHost) return;
    
    setLoading(true);
    try {
      const updateData: any = {};
      if (newHost.username) updateData.username = newHost.username;
      if (newHost.email) updateData.email = newHost.email;
      if (newHost.password) updateData.password = newHost.password;
      if (newHost.max_events !== '') updateData.max_events = newHost.max_events ? parseInt(newHost.max_events) : null;
      if (newHost.event_date !== '') updateData.event_date = newHost.event_date || null;
      if (newHost.expires_in_days) updateData.expires_in_days = parseInt(newHost.expires_in_days.toString()) || 14;

      await api.put(`/admin/hosts/${editingHost.id}`, updateData);
      setEditingHost(null);
      setNewHost({ username: '', email: '', password: '', max_events: '', event_date: '', expires_in_days: 14 });
      loadHosts();
      showToast('Gastgeber erfolgreich aktualisiert!', 'success');
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Fehler beim Aktualisieren', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Admin Dashboard</h1>
        <div className="user-info">
          <span>Angemeldet als: {user?.username}</span>
          <button onClick={logout} className="logout-button">Abmelden</button>
        </div>
      </header>

      <div className="dashboard-content">
        <div className="section">
          <div className="section-header">
            <h2>Gastgeber verwalten</h2>
            <button onClick={() => setShowAddHost(!showAddHost)} className="add-button">
              {showAddHost ? 'Abbrechen' : '+ Gastgeber hinzufügen'}
            </button>
          </div>

          {showAddHost && (
            <form onSubmit={handleAddHost} className="add-form">
              <input
                type="text"
                placeholder="Benutzername"
                value={newHost.username}
                onChange={(e) => setNewHost({ ...newHost, username: e.target.value })}
                required
              />
              <input
                type="email"
                placeholder="E-Mail"
                value={newHost.email}
                onChange={(e) => setNewHost({ ...newHost, email: e.target.value })}
                required
              />
              <input
                type="password"
                placeholder="Passwort"
                value={newHost.password}
                onChange={(e) => setNewHost({ ...newHost, password: e.target.value })}
                required
              />
              <label>
                Maximale Anzahl Events (leer = unbegrenzt):
                <input
                  type="number"
                  min="1"
                  placeholder="Unbegrenzt"
                  value={newHost.max_events}
                  onChange={(e) => setNewHost({ ...newHost, max_events: e.target.value })}
                />
              </label>
              <label>
                Event-Datum (wenn gesetzt, gilt für alle Events dieses Gastgebers):
                <input
                  type="date"
                  value={newHost.event_date}
                  onChange={(e) => setNewHost({ ...newHost, event_date: e.target.value })}
                />
              </label>
              <label>
                Gültigkeitsdauer in Tagen (Standard: 14):
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={newHost.expires_in_days}
                  onChange={(e) => setNewHost({ ...newHost, expires_in_days: parseInt(e.target.value) || 14 })}
                />
              </label>
              <button type="submit" disabled={loading}>
                {loading ? 'Wird erstellt...' : 'Erstellen'}
              </button>
            </form>
          )}

          {editingHost && (
            <div className="edit-host-form">
              <h3>Gastgeber bearbeiten: {editingHost.username}</h3>
              <form onSubmit={handleEditHost}>
                <input
                  type="text"
                  placeholder="Benutzername"
                  value={newHost.username}
                  onChange={(e) => setNewHost({ ...newHost, username: e.target.value })}
                />
                <input
                  type="email"
                  placeholder="E-Mail"
                  value={newHost.email}
                  onChange={(e) => setNewHost({ ...newHost, email: e.target.value })}
                />
                <input
                  type="password"
                  placeholder="Neues Passwort (leer lassen zum Beibehalten)"
                  value={newHost.password}
                  onChange={(e) => setNewHost({ ...newHost, password: e.target.value })}
                />
                <label>
                  Maximale Anzahl Events (leer = unbegrenzt):
                  <input
                    type="number"
                    min="1"
                    placeholder="Unbegrenzt"
                    value={newHost.max_events}
                    onChange={(e) => setNewHost({ ...newHost, max_events: e.target.value })}
                  />
                </label>
                <label>
                  Event-Datum:
                  <input
                    type="date"
                    value={newHost.event_date}
                    onChange={(e) => setNewHost({ ...newHost, event_date: e.target.value })}
                  />
                </label>
                <label>
                  Gültigkeitsdauer in Tagen:
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={newHost.expires_in_days}
                    onChange={(e) => setNewHost({ ...newHost, expires_in_days: parseInt(e.target.value) || 14 })}
                  />
                </label>
                <div className="form-actions">
                  <button type="button" onClick={() => {
                    setEditingHost(null);
                    setNewHost({ username: '', email: '', password: '', max_events: '', event_date: '', expires_in_days: 14 });
                  }}>
                    Abbrechen
                  </button>
                  <button type="submit" disabled={loading}>
                    {loading ? 'Wird gespeichert...' : 'Speichern'}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="hosts-list">
            {hosts.map((host) => (
              <div key={host.id} className="host-card">
                <div>
                  <h3>{host.username}</h3>
                  <p>{host.email}</p>
                  <div className="host-info">
                    <span>Max. Events: {host.max_events || 'Unbegrenzt'}</span>
                    {host.event_count !== undefined && (
                      <span>Aktuell: {host.event_count} / {host.max_events || '∞'}</span>
                    )}
                    {host.event_date && (
                      <span>Event-Datum: {new Date(host.event_date).toLocaleDateString('de-DE')}</span>
                    )}
                    <span>Gültigkeitsdauer: {host.expires_in_days} Tage</span>
                  </div>
                </div>
                <div className="host-actions">
                  <button
                    onClick={() => {
                      setEditingHost(host);
                      setNewHost({
                        username: host.username,
                        email: host.email,
                        password: '',
                        max_events: host.max_events?.toString() || '',
                        event_date: host.event_date || '',
                        expires_in_days: host.expires_in_days || 14
                      });
                    }}
                    className="edit-button"
                  >
                    Bearbeiten
                  </button>
                  <button
                    onClick={() => handleDeleteHost(host.id)}
                    className="delete-button"
                  >
                    Löschen
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
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

export default AdminDashboard;
