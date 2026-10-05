import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import Tasks from './pages/Tasks.jsx';
import Reminders from './pages/Reminders.jsx';
import Notes from './pages/Notes.jsx';
import Settings from './pages/Settings.jsx';


export default function App() {
  return (
    <div className="app">
      <div className="header">
        <h1 style={{ margin: 0, fontSize: 20 }}>Reminders</h1>
        <NavLink to="/settings" className="item-meta">
          Settings
        </NavLink>
      </div>

      <nav className="tabs">
        <NavLink to="/tasks"     className={({ isActive }) => isActive ? 'active' : ''}>Tasks</NavLink>
        <NavLink to="/reminders" className={({ isActive }) => isActive ? 'active' : ''}>Reminders</NavLink>
        <NavLink to="/notes"     className={({ isActive }) => isActive ? 'active' : ''}>Notes</NavLink>
      </nav>

      <Routes>
        <Route path="/" element={<Navigate to="/tasks" replace />} />
        <Route path="/tasks"     element={<Tasks />} />
        <Route path="/reminders" element={<Reminders />} />
        <Route path="/notes"     element={<Notes />} />
        <Route path="/settings"  element={<Settings />} />
        <Route path="*" element={<div className="empty">Page not found</div>} />
      </Routes>
    </div>
  );
}