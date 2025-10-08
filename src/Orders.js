import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';

function Orders({ user }) {
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [printers, setPrinters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [schedulingModalData, setSchedulingModalData] = useState(null);

  const [formData, setFormData] = useState({
    customer_id: '',
    order_date: new Date().toISOString().slice(0, 10),
    status: 'pending',
    total_amount: 0,
    order_items: [],
  });

  const API_BASE_URL = process.env.REACT_APP_SUPABASE_EDGE_FUNCTION_URL;

  const getAuthToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
        const token = await getAuthToken();
        if (!token) throw new Error("Sesja wygasła.");
        const response = await fetch(`${API_BASE_URL}/orders`, {
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Błąd pobierania zamówień: ${errText}`);
        }
        setOrders(await response.json() || []);
    } catch (err) { setError(err.message); }
  }, [getAuthToken, API_BASE_URL]);

  useEffect(() => {
    if (!user) { setLoading(false); setError("Zaloguj się."); return; }
    const loadInitialData = async () => {
        setLoading(true); setError(null);
        try {
            const token = await getAuthToken();
            const ordersPromise = fetch(`${API_BASE_URL}/orders`, { headers: { 'Authorization': `Bearer ${token}` }});
            const clientsPromise = supabase.from('Client').select('id, name');
            const productsPromise = supabase.from('Product').select('id, name');
            const printersPromise = supabase.from('Printers').select('id, name');
            
            const [ordersResponse, { data: cData, error: cErr }, { data: pData, error: pErr }, { data: prData, error: prErr }] = await Promise.all([ordersPromise, clientsPromise, productsPromise, printersPromise]);
            
            if (!ordersResponse.ok) throw new Error(await ordersResponse.text());
            if (cErr) throw cErr;
            if (pErr) throw pErr;
            if (prErr) throw prErr;

            setOrders(await ordersResponse.json() || []);
            setCustomers(cData || []);
            setProducts(pData || []);
            setPrinters(prData || []);
        } catch (err) { console.error("Błąd ładowania danych:", err); setError(err.message); } 
        finally { setLoading(false); }
    };
    loadInitialData();
  }, [user, getAuthToken, API_BASE_URL]);

  const handleStartProcessing = async (orderId) => {
    if (!window.confirm("Rozpocząć realizację i zarezerwować materiały?")) return;
    setActionLoading(true);
    try {
        const { error } = await supabase.functions.invoke('start-order-processing', { body: { orderId } });
        if (error) throw error;
        alert('Sukces! Materiały zarezerwowane.');
        await fetchOrders();
    } catch (err) { alert(`Błąd: ${err.message}`); }
    finally { setActionLoading(false); }
  };

  const handleCompleteOrder = async (orderId) => {
    if (!window.confirm("Zakończyć zamówienie? Stany magazynowe zostaną zmienione.")) return;
    setActionLoading(true);
    try {
        const { error } = await supabase.functions.invoke('complete-order', { body: { orderId } });
        if (error) throw error;
        alert('Sukces! Zamówienie zakończone.');
        await fetchOrders();
    } catch (err) { alert(`Błąd: ${err.message}`); }
    finally { setActionLoading(false); }
  };

  const handleCancelOrder = async (orderId) => {
    if (!window.confirm("Anulować zamówienie? Rezerwacje zostaną zwolnione.")) return;
    setActionLoading(true);
    try {
        const { error } = await supabase.functions.invoke('cancel-order', { body: { orderId } });
        if (error) throw error;
        alert('Sukces! Zamówienie anulowane.');
        await fetchOrders();
    } catch (err) { alert(`Błąd: ${err.message}`); }
    finally { setActionLoading(false); }
  };

  const handleLogScrap = async (e, orderItemId, productId) => {
    e.preventDefault();
    const quantity = parseFloat(e.target.elements.scrappedQuantity.value);
    const reason = e.target.elements.reason.value;
    if (!quantity || quantity <= 0) { alert("Proszę podać prawidłową ilość odpadu."); return; }
    setActionLoading(true);
    try {
        const { error } = await supabase.functions.invoke('log-scrap', { body: { orderItemId, productId, scrappedQuantity: quantity, reason } });
        if (error) throw error;
        alert("Pomyślnie zaraportowano odpad.");
        e.target.reset();
    } catch (err) { alert(`Błąd: ${err.message}`); }
    finally { setActionLoading(false); }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const calculateTotalAmount = (items) => {
    const total = items.reduce((sum, item) => sum + ((parseFloat(item.quantity) || 0) * (parseFloat(item.price) || 0)), 0);
    setFormData(prev => ({ ...prev, order_items: items, total_amount: total }));
  };

  const handleItemChange = (index, e) => {
    const { name, value } = e.target;
    const newItems = [...formData.order_items];
    newItems[index] = { ...newItems[index], [name]: value };
    calculateTotalAmount(newItems);
  };

  const addItem = () => { calculateTotalAmount([...formData.order_items, { product_id: '', quantity: 1, price: 0 }]); };
  const removeItem = (index) => { calculateTotalAmount(formData.order_items.filter((_, i) => i !== index)); };
  const resetForm = () => { setFormData({ customer_id: '', order_date: new Date().toISOString().slice(0, 10), status: 'pending', total_amount: 0, order_items: [], }); };

  const handleOpenModal = async (orderToEdit = null) => {
    if (orderToEdit) {
      setLoading(true);
      try {
        const token = await getAuthToken();
        const response = await fetch(`${API_BASE_URL}/orders/${orderToEdit.id}`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) throw new Error("Nie udało się pobrać szczegółów zamówienia");
        const fullOrder = await response.json();
        setEditingOrder(fullOrder);
        setFormData({
          customer_id: fullOrder.customer_id,
          order_date: new Date(fullOrder.order_date).toISOString().slice(0, 10),
          status: fullOrder.status,
          total_amount: fullOrder.total_amount,
          order_items: fullOrder.order_items || [],
        });
      } catch (err) { setError(err.message); } 
      finally { setLoading(false); }
    } else { setEditingOrder(null); resetForm(); }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
        const token = await getAuthToken();
        const { order_items, ...orderData } = formData;
        let response;
        if (editingOrder) {
            response = await fetch(`${API_BASE_URL}/orders/${editingOrder.id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ updatedOrderData: orderData, updatedOrderItems: order_items }),
            });
        } else {
            response = await fetch(`${API_BASE_URL}/orders`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ orderData, orderItems: order_items }),
            });
        }
        if (!response.ok) throw new Error((await response.json()).error);
        setShowModal(false);
        await fetchOrders();
    } catch (err) { setError(err.message); } 
    finally { setLoading(false); }
  };

  const handleDelete = async (orderId) => {
    if (!window.confirm('Na pewno usunąć to zamówienie?')) return;
    try {
        const token = await getAuthToken();
        const response = await fetch(`${API_BASE_URL}/orders/${orderId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) throw new Error("Błąd podczas usuwania");
        await fetchOrders();
    } catch(err) { setError(err.message); }
  };
  
  const handleOpenScheduleModal = (orderItemId, productId) => {
    setSchedulingModalData({ orderItemId, productId });
  };

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    const formEl = new FormData(e.target);
    const jobData = {
      printerId: parseInt(formEl.get('printerId')),
      durationHours: parseFloat(formEl.get('durationHours')),
      plannedStartTime: formEl.get('plannedStartTime'),
      color: formEl.get('color'),
      orderItemId: schedulingModalData.orderItemId,
    };
    const startTime = new Date(jobData.plannedStartTime);
    const endTime = new Date(startTime.getTime() + jobData.durationHours * 60 * 60 * 1000);
    const payload = { ...jobData, plannedStartTime: startTime.toISOString(), plannedEndTime: endTime.toISOString() };
    delete payload.durationHours;
    try {
        const token = await getAuthToken();
        const response = await fetch(`${API_BASE_URL}/print-jobs-crud`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error((await response.json()).error || "Błąd planowania");
        alert("Zadanie dodane do harmonogramu!");
        setSchedulingModalData(null);
    } catch (err) { alert(`Błąd: ${err.message}`); } 
    finally { setActionLoading(false); }
  };

  return (
    <div className="list-section full-width">
      <h2>Moduł Zamówień</h2>
      {error && <p className="error-message">{error}</p>}
      <button onClick={() => handleOpenModal()}>Dodaj Nowe Zamówienie</button>
      <table>
        <thead><tr><th>ID</th><th>Klient</th><th>Status</th><th>Data</th><th>Suma</th><th>Akcje</th></tr></thead>
        <tbody>
          {loading && !showModal ? (<tr><td colSpan="6">Ładowanie...</td></tr>) : (
            orders.map((order) => (
              <tr key={order.id}>
                <td>#{order.id.slice(0, 8)}...</td><td>{order.Client?.name || 'Brak danych'}</td>
                <td>{order.status}</td><td>{new Date(order.order_date).toLocaleDateString()}</td>
                <td>{parseFloat(order.total_amount).toFixed(2)} PLN</td>
                <td className="action-buttons">
                  {order.status === 'pending' && <button className="start-btn" onClick={() => handleStartProcessing(order.id)} disabled={actionLoading}>Rozpocznij</button>}
                  {order.status === 'w realizacji' && (
                    <>
                      <button className="complete-btn" onClick={() => handleCompleteOrder(order.id)} disabled={actionLoading}>Zakończ</button>
                      <button className="cancel-btn" onClick={() => handleCancelOrder(order.id)} disabled={actionLoading}>Anuluj</button>
                    </>
                  )}
                  <button className="edit-btn" onClick={() => handleOpenModal(order)} disabled={actionLoading}>Szczegóły</button>
                  <button className="delete-btn" onClick={() => handleDelete(order.id)} disabled={actionLoading}>Usuń</button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      
      {showModal && (
        <div className="modal-backdrop"><div className="modal-content">
            <h2>{editingOrder ? 'Szczegóły Zamówienia' : 'Dodaj Nowe Zamówienie'}</h2>
            <form onSubmit={handleSubmit}>
              <label>Klient</label><select name="customer_id" value={formData.customer_id} onChange={handleInputChange} required><option value="">-- Wybierz --</option>{customers.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}</select>
              <div className="inline-form">
                <div><label>Data</label><input type="date" name="order_date" value={formData.order_date} onChange={handleInputChange} required /></div>
                <div><label>Status</label><select name="status" value={formData.status} onChange={handleInputChange} required disabled={!!editingOrder}><option value="pending">Oczekujące</option><option value="w realizacji">W realizacji</option><option value="completed">Zrealizowane</option><option value="cancelled">Anulowane</option></select></div>
              </div><hr />
              <h4>Pozycje Zamówienia</h4>
              {!editingOrder ? (
                <>
                  {formData.order_items.map((item, index) => (
                    <div key={index} className="required-product-form" style={{gridTemplateColumns: '2fr 1fr 1fr 1fr'}}>
                      <div style={{gridColumn: 'span 2'}}><label>Produkt</label><select name="product_id" value={item.product_id} onChange={(e) => handleItemChange(index, e)} required><option value="">-- Wybierz --</option>{products.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}</select></div>
                      <div><label>Ilość</label><input type="number" name="quantity" value={item.quantity} onChange={(e) => handleItemChange(index, e)} min="1" required /></div>
                      <div><label>Cena jedn.</label><input type="number" name="price" value={item.price} onChange={(e) => handleItemChange(index, e)} step="0.01" min="0" required /></div>
                      <div className="action-cell"><button type="button" onClick={() => removeItem(index)} className="delete-btn">Usuń</button></div>
                    </div>
                  ))}<button type="button" onClick={addItem} className="add-item-btn">+ Dodaj Pozycję</button>
                </>
              ) : (
                formData.order_items.map((item, index) => (
                    <div key={index} className="required-product-form" style={{ gridTemplateColumns: '3fr 1fr', alignItems: 'center' }}>
                      <div><strong>{products.find(p => p.id === item.product_id)?.name}</strong> (Ilość: {item.quantity})</div>
                      <div className="action-cell">
                          {formData.status === 'w realizacji' && <button type="button" onClick={() => handleOpenScheduleModal(item.id, item.product_id)}>Zaplanuj</button>}
                      </div>
                    </div>
                ))
              )}
              {editingOrder && formData.status === 'w realizacji' && (
                <>
                  <hr style={{margin: "2rem 0"}} />
                  <h4>Zarządzanie Odpadem (Scrap)</h4>
                  {formData.order_items.map((item) => (
                    <div key={item.id} className="scrap-management-item">
                      <strong>Produkt: {products.find(p => p.id === item.product_id)?.name}</strong>
                      <form onSubmit={(e) => handleLogScrap(e, item.id, item.product_id)} className="inline-form" style={{alignItems: 'flex-end'}}>
                          <div><label>Ilość odpadu</label><input type="number" name="scrappedQuantity" step="0.01" placeholder="np. 1.5" required/></div>
                          <div style={{flexGrow: 2}}><label>Powód (opcjonalnie)</label><input type="text" name="reason" placeholder="np. Błąd cięcia"/></div>
                          <button type="submit" disabled={actionLoading}>{actionLoading ? '...' : 'Zapisz Odpad'}</button>
                      </form>
                    </div>
                  ))}
                </>
              )}
              <div className="total-summary" style={{marginTop: '1rem'}}><h3>SUMA: {formData.total_amount.toFixed(2)} PLN</h3></div>
              <div className="form-actions" style={{marginTop: "2rem"}}>
                <button type="button" onClick={() => setShowModal(false)} className="cancel-btn">Zamknij</button>
                <button type="submit" disabled={loading}>{!editingOrder ? (loading ? 'Zapisywanie...' : 'Zapisz Zamówienie') : (loading ? 'Zapisywanie...' : 'Zapisz Zmiany')}</button>
              </div>
            </form>
        </div></div>
      )}

      {schedulingModalData && (
        <div className="modal-backdrop"><div className="modal-content">
            <h2>Zaplanuj Zadanie Druku</h2>
            <form onSubmit={handleScheduleSubmit}>
              <p>Produkt: <strong>{products.find(p => p.id === schedulingModalData.productId)?.name}</strong></p>
              <label>Drukarka</label><select name="printerId" required><option value="">-- Wybierz --</option>{printers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              <label>Data i godzina rozpoczęcia</label><input type="datetime-local" name="plannedStartTime" required />
              <label>Szacowany czas druku (w godzinach)</label><input type="number" name="durationHours" step="0.5" placeholder="np. 8.5" required />
              <label>Kolor w harmonogramie</label><input type="color" name="color" defaultValue="#3788d8" />
              <div className="form-actions">
                <button type="button" onClick={() => setSchedulingModalData(null)} className="cancel-btn">Anuluj</button>
                <button type="submit" disabled={actionLoading}>{actionLoading ? 'Planowanie...' : 'Dodaj do Harmonogramu'}</button>
              </div>
            </form>
        </div></div>
      )}
    </div>
  );
}

export default Orders;