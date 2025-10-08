import React from 'react';
// 1. IMPORTUJ useLocation
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

// Hook do autoryzacji pozostaje bez zmian
const useAuth = () => {
  // ... (cały Twój kod useAuth bez zmian)
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

// 2. STWÓRZ NOWY KOMPONENT "Layout", który będzie zarządzał kontenerem
const Layout = () => {
  const location = useLocation();
  // Ustawiamy, które trasy mają mieć layout pełnoekranowy
  const isFullScreen = location.pathname === '/schedule'; 

  // Dynamicznie wybieramy klasę CSS
  const containerClass = isFullScreen ? 'container-full-width' : 'container';

  return (
    <div className={containerClass}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/quotations" element={<Quotations />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/warehouse" element={<Warehouse />} />
        <Route path="/printers" element={<PrintersManagement />} />
        <Route path="/schedule" element={<Schedule />} />
      </Routes>
    </div>
  );
}


function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{textAlign: 'center', marginTop: '5rem'}}>Ładowanie...</div>;
  }

  // 3. UPROŚĆ GŁÓWNĄ STRUKTURĘ
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
            {/* Wszystkie chronione trasy są teraz obsługiwane przez Layout */}
            <Route path="/*" element={<Layout />} />
          </>
        )}
      </Routes>
    </Router>
  );
}

export default App;