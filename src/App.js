import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import Navbar from './Navbar';
import Login from './Login';
import Clients from './Clients';
import Warehouse from './Warehouse';
import Orders from './Orders';
import Quotations from './Quotations';
import { supabase } from './supabaseClient';
import { useState, useEffect } from 'react';

const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => authListener.subscription.unsubscribe();
  }, []);

  return { user, loading };
};

const Dashboard = () => (
    // Używamy tutaj również klasy "container" dla spójności
    <div className="container">
        <h2>Dashboard</h2>
        <p>Witaj w Filament ERP!</p>
    </div>
);

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Ładowanie...</div>;
  }

  return (
    <Router>
      <div>
        {user && <Navbar />}
        {/*
          TUTAJ JEST ZMIANA:
          Dodajemy div z klasą "container", który będzie
          otaczał zawartość każdej podstrony.
        */}
        <div className="container">
          <Routes>
            {!user ? (
              <>
                {/* Login nie potrzebuje kontenera, więc go zostawiamy poza */}
                <Route path="/login" element={<Login />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
              </>
            ) : (
              <>
                {/* 
                  Dashboard jest teraz prostszy, bo kontener jest już w App.js,
                  ale dla spójności zostawiamy go jak był. Można by go uprościć.
                */}
                <Route path="/" element={<Dashboard />} />
                <Route path="/quotations" element={<Quotations />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/clients" element={<Clients />} />
                <Route path="/warehouse" element={<Warehouse />} />
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