import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuth } from './auth/AuthContext.jsx';
import RequireAuth from './auth/RequireAuth.jsx';
import Tasks from './pages/Tasks.jsx';
import Reminders from './pages/Reminders.jsx';
import Notes from './pages/Notes.jsx';
import Settings from './pages/Settings.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';

function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const doLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="header">
      <h1 style={{ margin: 0, fontSize: 20 }}>Reminders</h1>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        {user && (
          <>
            <NavLink to="/settings" className="item-meta">
              {user.email}
            </NavLink>
            <button className="secondary" onClick={doLogout}>Sign out</button>
          </>
        )}
      </div>
    </div>
  );
}

function Tabs() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <nav className="tabs">
      <NavLink to="/tasks" className={({ isActive }) => (isActive ? 'active' : '')}>
        Tasks
      </NavLink>
      <NavLink to="/reminders" className={({ isActive }) => (isActive ? 'active' : '')}>
        Reminders
      </NavLink>
      <NavLink to="/notes" className={({ isActive }) => (isActive ? 'active' : '')}>
        Notes
      </NavLink>
    </nav>
  );
}

export default function App() {
  return (
    <div className="app">
      <Header />
      <Tabs />

      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route path="/" element={<Navigate to="/tasks" replace />} />
        <Route
          path="/tasks"
          element={
            <RequireAuth>
              <Tasks />
            </RequireAuth>
          }
        />
        <Route
          path="/reminders"
          element={
            <RequireAuth>
              <Reminders />
            </RequireAuth>
          }
        />
        <Route
          path="/notes"
          element={
            <RequireAuth>
              <Notes />
            </RequireAuth>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireAuth>
              <Settings />
            </RequireAuth>
          }
        />

        <Route path="*" element={<div className="empty">Page not found</div>} />
      </Routes>
    </div>
  );
}