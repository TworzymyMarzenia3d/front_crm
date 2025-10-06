import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import { supabase } from './supabaseClient'; // Importujemy klienta Supabase
import Login from './Login';
import Navbar from './Navbar';
import Warehouse from './Warehouse';
import Clients from './Clients';
import Orders from './Orders';

function App() {
  const [session, setSession] = useState(supabase.auth.getSession());

  useEffect(() => {
    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (!session) {
    return <Login />;
  }

  return (
    <Router>
      <div className="App">
        <Navbar onLogout={handleLogout} />
        <main className="container">
          <Routes>
            <Route path="/warehouse" element={<Warehouse />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="*" element={<Navigate to="/warehouse" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;