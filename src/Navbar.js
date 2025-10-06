import React from 'react';
import { NavLink } from 'react-router-dom';

function Navbar({ onLogout }) {
  return (
    <nav className="navbar">
      <div className="navbar-brand">Filament ERP</div>
      <div className="navbar-links">
        <NavLink to="/warehouse">Magazyn</NavLink>
        <NavLink to="/clients">Klienci</NavLink>
        <NavLink to="/orders">Zamówienia</NavLink>
      </div>
      <button onClick={onLogout} className="logout-button">Wyloguj</button>
    </nav>
  );
}

export default Navbar;