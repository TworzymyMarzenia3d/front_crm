import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import Navbar from './Navbar';
import Login from './Login';
import Clients from './Clients';
import Warehouse from './Warehouse';
import Orders from './Orders';
import Quotations from './Quotations';
import PrintersManagement from './PrintersManagement'; // <-- 1. IMPORT
import { supabase } from './supabaseClient';
import { useState, useEffect } from 'react';

// Hook do zarządzania stanem autoryzacji
const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

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

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{textAlign: 'center', marginTop: '5rem'}}>Ładowanie...</div>;
  }

  return (
    <Router>
      <div>
        {user && <Navbar user={user} />} 
        <div className="container">
          <Routes>
            {!user ? (
              <>
                <Route path="/login" element={<Login />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
              </>
            ) : (
              <>
                <Route path="/" element={<Dashboard />} />
                <Route path="/quotations" element={<Quotations user={user} />} />
                <Route path="/orders" element={<Orders user={user} />} />
                <Route path="/clients" element={<Clients user={user} />} />
                <Route path="/warehouse" element={<Warehouse user={user} />} />
                {/* V-- 2. DODAJ NOWĄ TRASĘ --V */}
                <Route path="/printers" element={<PrintersManagement user={user} />} />
                <Route path="/login" element={<Navigate to="/" replace />} />
              </>
            )}
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;