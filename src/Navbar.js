import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';

function Navbar() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">Filament ERP</div>
      <div className="navbar-links">
        <NavLink to="/">Dashboard</NavLink>
        <NavLink to="/quotations">Wyceny</NavLink>
        <NavLink to="/orders">Zamówienia</NavLink>
        <NavLink to="/clients">Klienci</NavLink>
        <NavLink to="/warehouse">Magazyn</NavLink>
        <NavLink to="/printers">Drukarki</NavLink>
        <NavLink to="/schedule">Harmonogram</NavLink>

      </div>
      <button onClick={handleLogout} className="logout-button">
        Wyloguj
      </button>
    </nav>
  );
}

export default Navbar;