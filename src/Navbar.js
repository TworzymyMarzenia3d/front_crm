import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';

function Navbar({ user }) { // Upewnij się, że 'user' jest tutaj przekazywany
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="nav-logo">Filament ERP</div>
      <div className="nav-links">
        {user && (
          <>
            <NavLink to="/" end>Dashboard</NavLink>
            <NavLink to="/warehouse">Magazyn</NavLink>
            <NavLink to="/clients">Klienci</NavLink>
            <NavLink to="/quotations">Wyceny</NavLink>
            <NavLink to="/orders">Zamówienia</NavLink>
            {/* V-- DODAJ NOWY LINK --V */}
            <NavLink to="/printers">Drukarki</NavLink>
          </>
        )}
      </div>
      <div className="nav-user">
        {user ? (
          <>
            <span>{user.email}</span>
            <button onClick={handleLogout}>Wyloguj</button>
          </>
        ) : null}
      </div>
    </nav>
  );
}

export default Navbar;