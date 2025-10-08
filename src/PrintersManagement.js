import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';

function PrintersManagement({ user }) {
  const [printers, setPrinters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState(null);

  const [formData, setFormData] = useState({
    name: '', model: '', build_volume_x: '', build_volume_y: '', build_volume_z: '', supported_materials: '', notes: ''
  });

  // Dodajemy getAuthToken do pobierania tokena JWT
  const getAuthToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  }, []);

  const fetchPrinters = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAuthToken();
      const { data, error: invokeError } = await supabase.functions.invoke('printers-crud', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` } // Dodajemy token
      });
      if (invokeError) throw invokeError;
      setPrinters(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => {
    if (user) {
      fetchPrinters();
    }
  }, [user, fetchPrinters]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleOpenModal = (printer = null) => {
    if (printer) {
      setEditingPrinter(printer);
      setFormData({
        name: printer.name, model: printer.model || '', build_volume_x: printer.build_volume_x || '',
        build_volume_y: printer.build_volume_y || '', build_volume_z: printer.build_volume_z || '',
        supported_materials: (printer.supported_materials || []).join(', '), notes: printer.notes || ''
      });
    } else {
      setEditingPrinter(null);
      setFormData({ name: '', model: '', build_volume_x: '', build_volume_y: '', build_volume_z: '', supported_materials: '', notes: '' });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const materialsArray = formData.supported_materials.split(',').map(m => m.trim()).filter(Boolean);
    const dataToSend = { ...formData, supported_materials: materialsArray };

    try {
      const token = await getAuthToken();
      let functionName = 'printers-crud';
      let options = {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }, // Dodajemy token
          body: dataToSend
      };

      if (editingPrinter) {
        functionName = `printers-crud/${editingPrinter.id}`;
        options.method = 'PUT';
      }

      const { error: invokeError } = await supabase.functions.invoke(functionName, options);
      if (invokeError) throw invokeError;

      setShowModal(false);
      fetchPrinters();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (printerId) => {
    if (!window.confirm('Czy na pewno chcesz usunąć tę drukarkę?')) return;
    setLoading(true);
    try {
      const token = await getAuthToken();
      const { error: invokeError } = await supabase.functions.invoke(`printers-crud/${printerId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` } // Dodajemy token
      });
      if (invokeError) throw invokeError;
      fetchPrinters();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="list-section full-width">
      <h2>Zarządzanie Drukarkami</h2>
      {error && <p className="error-message">Błąd: {error}</p>}
      <button onClick={() => handleOpenModal()}>Dodaj Nową Drukarkę</button>
      <table>
        <thead>
          <tr><th>Nazwa</th><th>Model</th><th>Pole robocze (mm)</th><th>Materiały</th><th>Akcje</th></tr>
        </thead>
        <tbody>
          {loading && !showModal ? (<tr><td colSpan="5">Ładowanie...</td></tr>) : (
            printers.map((printer) => (
              <tr key={printer.id}>
                <td>{printer.name}</td><td>{printer.model}</td>
                <td>{`${printer.build_volume_x || ''} x ${printer.build_volume_y || ''} x ${printer.build_volume_z || ''}`}</td>
                <td>{(printer.supported_materials || []).join(', ')}</td>
                <td className="action-buttons">
                  <button className="edit-btn" onClick={() => handleOpenModal(printer)}>Edytuj</button>
                  <button className="delete-btn" onClick={() => handleDelete(printer.id)}>Usuń</button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {showModal && (
        <div className="modal-backdrop"><div className="modal-content">
          <h2>{editingPrinter ? 'Edytuj Drukarkę' : 'Dodaj Nową Drukarkę'}</h2>
          <form onSubmit={handleSubmit}>
            <label>Nazwa własna</label><input type="text" name="name" value={formData.name} onChange={handleInputChange} required placeholder="np. Prusa Ania" />
            <label>Model</label><input type="text" name="model" value={formData.model} onChange={handleInputChange} placeholder="np. Prusa MK3S+" />
            <label>Pole robocze (X x Y x Z) w mm</label>
            <div className="inline-form" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <input type="number" name="build_volume_x" value={formData.build_volume_x} onChange={handleInputChange} placeholder="X" />
              <input type="number" name="build_volume_y" value={formData.build_volume_y} onChange={handleInputChange} placeholder="Y" />
              <input type="number" name="build_volume_z" value={formData.build_volume_z} onChange={handleInputChange} placeholder="Z" />
            </div>
            <label>Obsługiwane materiały (oddzielone przecinkiem)</label><input type="text" name="supported_materials" value={formData.supported_materials} onChange={handleInputChange} placeholder="np. PLA, PETG, ABS" />
            <label>Notatki</label><textarea name="notes" value={formData.notes} onChange={handleInputChange}></textarea>
            <div className="form-actions">
              <button type="button" onClick={() => setShowModal(false)} className="cancel-btn">Anuluj</button>
              <button type="submit" disabled={loading}>{loading ? 'Zapisywanie...' : 'Zapisz'}</button>
            </div>
          </form>
        </div></div>
      )}
    </div>
  );
}

export default PrintersManagement;