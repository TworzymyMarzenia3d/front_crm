import React, { useState } from 'react';
import { supabase } from './supabaseClient';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });
    if (error) {
      setError(error.message);
    }
    setIsLoading(false);
  };

  return (
    <div className="login-container">
      <form onSubmit={handleLogin} className="login-form">
        <h1>Filament ERP</h1>
        <h2>Logowanie</h2>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Hasło" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit" disabled={isLoading}>{isLoading ? 'Logowanie...' : 'Zaloguj'}</button>
        {error && <p className="error-message">{error}</p>}
      </form>
    </div>
  );
}
export default Login;