import React from 'react';
// Upewnij się, że useLocation jest importowane
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import './App.css';
import Navbar from './Navbar';
import Login from './Login';
import Clients from './Clients';
import Warehouse from './Warehouse';
import Orders from './Orders';
import Quotations from './Quotations';
import PrintersManagement from './PrintersManagement';
import Schedule from './Schedule';
import { supabase } from './supabaseClient';
import { useState, useEffect } from 'react';

// Hook autoryzacji - bez zmian
const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null); setLoading(false);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null); setLoading(false);
    });
    return () => authListener.subscription.unsubscribe();
  }, []);
  return { user, loading };
};

const Dashboard = () => (
    <div className="container">
        <h2>Dashboard</h2>
        <p>Witaj w Filament ERP!</p>
    </div>
);

// Komponent Layout z kluczową poprawką
const Layout = ({ user }) => { // <-- 2. ODBIERZ 'user' JAKO PROP
  const location = useLocation();
  const isFullScreen = location.pathname === '/schedule';
  const containerClass = isFullScreen ? 'container-full-width' : 'container';

  return (
    <div className={containerClass}>
      <Routes>
        {/* 3. PRZEKAŻ 'user' DALEJ DO KAŻDEGO KOMPONENTU */}
        <Route path="/" element={<Dashboard />} />
        <Route path="/quotations" element={<Quotations user={user} />} />
        <Route path="/orders" element={<Orders user={user} />} />
        <Route path="/clients" element={<Clients user={user} />} />
        <Route path="/warehouse" element={<Warehouse user={user} />} />
        <Route path="/printers" element={<PrintersManagement user={user} />} />
        <Route path="/schedule" element={<Schedule user={user} />} />
      </Routes>
    </div>
  );
}

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{textAlign: 'center', marginTop: '5rem'}}>Ładowanie...</div>;
  }

  return (
    <Router>
      {user && <Navbar user={user} />}
      <Routes>
        {!user ? (
          <>
            <Route path="/login" element={<Login />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </>
        ) : (
          <>
            {/* 1. PRZEKAŻ 'user' DO KOMPONENTU LAYOUT */}
            <Route path="/*" element={<Layout user={user} />} />
          </>
        )}
      </Routes>
    </Router>
  );
}

export default App;