import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
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
  const [newHost, setNewHost] = useState({
    username: '',
    email: '',
    password: '',
    max_events: '',
    event_date: '',
    expires_in_days: 14
  });
  const [loading, setLoading] = useState(false);

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
    } catch (error: any) {
      alert(error.response?.data?.error || 'Fehler beim Erstellen des Gastgebers');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteHost = async (id: number) => {
    if (!confirm('Möchten Sie diesen Gastgeber wirklich löschen?')) return;
    try {
      await api.delete(`/admin/hosts/${id}`);
      loadHosts();
    } catch (error) {
      alert('Fehler beim Löschen');
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
                <button
                  onClick={() => handleDeleteHost(host.id)}
                  className="delete-button"
                >
                  Löschen
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
