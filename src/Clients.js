import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';

function Clients() {
    // Stany
    const [clients, setClients] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Stany dla formularza (zarówno do dodawania, jak i edycji)
    const [formData, setFormData] = useState({ id: null, name: '', nip: '', address: '', phone: '', email: '', notes: '' });
    const [isEditing, setIsEditing] = useState(false);

    // Pobieranie danych
    const fetchClients = useCallback(async () => {
        setIsLoading(true);
        const { data, error } = await supabase.from('Client').select('*').order('name');
        if (error) {
            setError(error.message);
            console.error("Błąd pobierania klientów:", error);
        } else {
            setClients(data);
            setError(null);
        }
        setIsLoading(false);
    }, []);

    useEffect(() => {
        fetchClients();
    }, [fetchClients]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const resetForm = () => {
        setIsEditing(false);
        setFormData({ id: null, name: '', nip: '', address: '', phone: '', email: '', notes: '' });
    };

    // Dodawanie lub aktualizacja klienta
    const handleSubmit = async (e) => {
        e.preventDefault();
        const { id, ...clientData } = formData;
        
        let query;
        if (isEditing) {
            // Aktualizacja istniejącego klienta
            query = supabase.from('Client').update(clientData).eq('id', id);
        } else {
            // Dodanie nowego klienta
            query = supabase.from('Client').insert(clientData);
        }

        const { error } = await query;
        if (error) {
            alert(error.message);
        } else {
            resetForm();
            fetchClients();
        }
    };

    const handleEdit = (client) => {
        setIsEditing(true);
        setFormData({
            id: client.id,
            name: client.name || '',
            nip: client.nip || '',
            address: client.address || '',
            phone: client.phone || '',
            email: client.email || '',
            notes: client.notes || '',
        });
    };
    
    // Uwaga: Usuwanie jest niebezpieczne i wymaga logiki kaskadowej w bazie
    const handleDelete = async (clientId) => {
        if (!window.confirm("Jesteś pewien? Usunięcie klienta usunie wszystkie jego zamówienia i historię!")) return;
        
        // W Supabase musimy ręcznie ustawić kaskadowe usuwanie
        // Na razie tylko wyświetlimy alert
        alert("Funkcja usuwania wymaga skonfigurowania polityk kaskadowych w bazie Supabase. Na razie wyłączone dla bezpieczeństwa.");
        // const { error } = await supabase.from('Client').delete().eq('id', clientId);
        // if (error) alert(error.message);
        // else fetchClients();
    };


    if (isLoading) return <p>Ładowanie listy klientów...</p>;
    if (error) return <p className="error-message">{error}</p>;

    return (
        <>
            <div className="management-panel" style={{alignItems: 'flex-start', maxWidth: '500px'}}>
                <section className="form-section">
                    <h2>{isEditing ? 'Edytuj klienta' : 'Dodaj nowego klienta'}</h2>
                    <form onSubmit={handleSubmit}>
                        <label>Nazwa klienta / Firma *</label>
                        <input name="name" type="text" value={formData.name} onChange={handleInputChange} required />
                        
                        <label>NIP</label>
                        <input name="nip" type="text" value={formData.nip} onChange={handleInputChange} />
                        
                        <label>Adres</label>
                        <input name="address" type="text" value={formData.address} onChange={handleInputChange} />
                        
                        <label>Telefon</label>
                        <input name="phone" type="text" value={formData.phone} onChange={handleInputChange} />

                        <label>Email</label>
                        <input name="email" type="email" value={formData.email} onChange={handleInputChange} />
                        
                        <label>Notatki</label>
                        <textarea name="notes" value={formData.notes} onChange={handleInputChange} rows="4"></textarea>

                        <div className="form-actions">
                            <button type="submit">{isEditing ? 'Zapisz zmiany' : 'Dodaj klienta'}</button>
                            {isEditing && <button type="button" onClick={resetForm} className="cancel-btn">Anuluj</button>}
                        </div>
                    </form>
                </section>
            </div>

            <section className="list-section full-width">
                <h2>Lista Klientów</h2>
                <table>
                    <thead>
                      <tr>
                        <th>Nazwa</th><th>NIP</th><th>Adres</th><th>Telefon</th><th>Email</th><th>Notatki</th><th>Akcje</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clients.length === 0 ? (
                        <tr><td colSpan="7">Brak klientów w bazie.</td></tr>
                      ) : (
                        clients.map((client) => (
                          <tr key={client.id}>
                            <td>{client.name}</td><td>{client.nip || '-'}</td><td>{client.address || '-'}</td>
                            <td>{client.phone || '-'}</td><td>{client.email || '-'}</td><td>{client.notes || '-'}</td>
                            <td>
                                <div className="action-buttons">
                                    <button onClick={() => handleEdit(client)} className="edit-btn">Edytuj</button>
                                    <button onClick={() => handleDelete(client.id)} className="delete-btn">Usuń</button>
                                </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                </table>
            </section>
        </>
    );
}

export default Clients;