import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';

function Orders({ user }) {
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false); // START: Nowy stan do obsługi ładowania akcji
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);

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

  // START: Funkcja do odświeżania listy zamówień, aby uniknąć powtarzania kodu
  const fetchOrders = useCallback(async () => {
    try {
      const token = await getAuthToken();
      if (!token) throw new Error("Sesja wygasła. Zaloguj się ponownie.");
      const response = await fetch(`${API_BASE_URL}/orders`, {
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Błąd pobierania zamówień: ${errText}`);
      }
      const ordersData = await response.json();
      setOrders(ordersData || []);
    } catch (err) {
      setError(err.message);
    }
  }, [getAuthToken, API_BASE_URL]);
  // END: Funkcja do odświeżania listy zamówień

  useEffect(() => {
    if (!user) {
      setLoading(false);
      setError("Zaloguj się, aby zobaczyć zamówienia.");
      return;
    }

    const loadInitialData = async () => {
        setLoading(true);
        setError(null);
        try {
            await fetchOrders(); // Używamy nowej funkcji do pobrania zamówień
            
            const clientsPromise = supabase.from('Client').select('id, name');
            const productsPromise = supabase.from('Product').select('id, name');
            const [{ data: clientData, error: clientError }, { data: productData, error: productError }] = await Promise.all([clientsPromise, productsPromise]);

            if (clientError) throw clientError;
            if (productError) throw productError;

            setCustomers(clientData || []);
            setProducts(productData || []);

        } catch (err) {
            console.error("Błąd podczas ładowania danych:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };
    loadInitialData();
  }, [user, fetchOrders]);
  
  // START: Nowa logika do obsługi cyklu życia zamówienia
  const handleStartProcessing = async (orderId) => {
    if (!window.confirm("Czy na pewno chcesz rozpocząć realizację i zarezerwować materiały?")) return;
    setActionLoading(true);
    setError(null);
    try {
      const { error: invokeError } = await supabase.functions.invoke('start-order-processing', { body: { orderId } });
      if (invokeError) throw invokeError;
      alert('Sukces! Materiały zostały zarezerwowane.');
      await fetchOrders(); // Odśwież listę
    } catch (err) {
      alert(`Wystąpił błąd: ${err.message}`);
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteOrder = async (orderId) => {
    if (!window.confirm("Czy na pewno chcesz zakończyć zamówienie? Stany magazynowe zostaną trwale zmienione.")) return;
    setActionLoading(true);
    setError(null);
    try {
      const { error: invokeError } = await supabase.functions.invoke('complete-order', { body: { orderId } });
      if (invokeError) throw invokeError;
      alert('Sukces! Zamówienie zostało zakończone.');
      await fetchOrders(); // Odśwież listę
    } catch (err) {
      alert(`Wystąpił błąd: ${err.message}`);
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelOrder = async (orderId) => {
    if (!window.confirm("Czy na pewno chcesz ANULOWAĆ zamówienie? Rezerwacje zostaną zwolnione.")) return;
    setActionLoading(true);
    setError(null);
    try {
      const { error: invokeError } = await supabase.functions.invoke('cancel-order', { body: { orderId } });
      if (invokeError) throw invokeError;
      alert('Sukces! Zamówienie zostało anulowane.');
      await fetchOrders(); // Odśwież listę
    } catch (err) {
      alert(`Wystąpił błąd: ${err.message}`);
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };
  // END: Nowa logika

  // ... (reszta Twoich funkcji: handleInputChange, calculateTotalAmount, etc. pozostaje bez zmian) ...
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
    let updatedValue = value;

    if (name === 'quantity') {
      updatedValue = parseInt(value, 10) || 1;
    } else if (name === 'product_id') {
      const product = products.find(p => p.id === parseInt(value));
      updatedValue = value;
      // W module Zamówień cena jest wpisywana ręcznie lub pobierana z edycji, nie z produktu.
      newItems[index].price = product && !newItems[index].price ? 0 : newItems[index].price;
    } else if (name === 'price') {
      updatedValue = parseFloat(value) || 0;
    }

    newItems[index] = { ...newItems[index], [name]: updatedValue };
    calculateTotalAmount(newItems);
  };

  const addItem = () => {
    calculateTotalAmount([...formData.order_items, { product_id: '', quantity: 1, price: 0 }]);
  };

  const removeItem = (index) => {
    calculateTotalAmount(formData.order_items.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setFormData({
      customer_id: '', order_date: new Date().toISOString().slice(0, 10),
      status: 'pending', total_amount: 0, order_items: [],
    });
  };

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
      } catch (err) => {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    } else {
      setEditingOrder(null);
      resetForm();
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error("Sesja wygasła.");

      const orderDataToSend = {
        customer_id: formData.customer_id, order_date: formData.order_date,
        status: formData.status, total_amount: formData.total_amount,
      };
      const orderItemsToSend = formData.order_items;

      let response;
      if (editingOrder) {
        response = await fetch(`${API_BASE_URL}/orders/${editingOrder.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ updatedOrderData: orderDataToSend, updatedOrderItems: orderItemsToSend }),
        });
      } else {
        response = await fetch(`${API_BASE_URL}/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ orderData: orderDataToSend, orderItems: orderItemsToSend }),
        });
      }
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Błąd zapisu zamówienia");
      }
      setShowModal(false);
      await fetchOrders();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (orderId) => {
    if (!window.confirm('Czy na pewno chcesz usunąć to zamówienie?')) return;
    setLoading(true);
    try {
      const token = await getAuthToken();
      const response = await fetch(`${API_BASE_URL}/orders/${orderId}`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Błąd podczas usuwania");
      setOrders(prevOrders => prevOrders.filter(o => o.id !== orderId));
    } catch(err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="list-section full-width">
      <h2>Moduł Zamówień</h2>
      {error && <p className="error-message">{error}</p>}
      <button onClick={() => handleOpenModal()}>Dodaj Nowe Zamówienie</button>

      <table>
        {/* ... (twoja sekcja <thead> bez zmian) ... */}
        <thead>
          <tr>
            <th>ID</th>
            <th>Klient</th>
            <th>Status</th>
            <th>Data</th>
            <th>Suma</th>
            <th>Akcje</th>
          </tr>
        </thead>
        <tbody>
          {loading && !showModal ? (
            <tr><td colSpan="6">Ładowanie...</td></tr>
          ) : (
            orders.map((order) => (
              <tr key={order.id}>
                <td>#{order.id.slice(0, 8)}...</td>
                <td>{order.Client?.name || 'Brak danych'}</td>
                <td>{order.status}</td>
                <td>{new Date(order.order_date).toLocaleDateString()}</td>
                <td>{parseFloat(order.total_amount).toFixed(2)} PLN</td>
                <td className="action-buttons">
                  {/* START: Logika przycisków akcji */}
                  {order.status === 'pending' && (
                    <button className="start-btn" onClick={() => handleStartProcessing(order.id)} disabled={actionLoading}>
                      Rozpocznij
                    </button>
                  )}
                  {order.status === 'w realizacji' && (
                    <>
                      <button className="complete-btn" onClick={() => handleCompleteOrder(order.id)} disabled={actionLoading}>
                        Zakończ
                      </button>
                      <button className="cancel-btn" onClick={() => handleCancelOrder(order.id)} disabled={actionLoading}>
                        Anuluj
                      </button>
                    </>
                  )}
                  <button className="edit-btn" onClick={() => handleOpenModal(order)} disabled={actionLoading}>Edytuj</button>
                  <button className="delete-btn" onClick={() => handleDelete(order.id)} disabled={actionLoading}>Usuń</button>
                  {/* END: Logika przycisków akcji */}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {!loading && orders.length === 0 && <p>Brak zamówień do wyświetlenia.</p>}

      {/* START: Modyfikacja modala */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h2>{editingOrder ? 'Edytuj Zamówienie' : 'Dodaj Nowe Zamówienie'}</h2>
            <form onSubmit={handleSubmit}>
              {/* ... (reszta pól formularza bez zmian) ... */}
              <label htmlFor="customer_id">Klient</label>
              <select id="customer_id" name="customer_id" value={formData.customer_id} onChange={handleInputChange} required>
                <option value="">-- Wybierz klienta --</option>
                {customers.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </select>
              <div className="inline-form">
                <div>
                  <label htmlFor="order_date">Data Zamówienia</label>
                  <input type="date" id="order_date" name="order_date" value={formData.order_date} onChange={handleInputChange} required />
                </div>
                <div>
                  <label htmlFor="status">Status</label>
                  {/* Dodajemy nowy status i logikę 'readOnly' */}
                  <select 
                    id="status" 
                    name="status" 
                    value={formData.status} 
                    onChange={handleInputChange} 
                    required
                    disabled={formData.status === 'w realizacji'} // Nie pozwalamy na ręczną zmianę tego statusu
                  >
                    <option value="pending">Oczekujące</option>
                    <option value="w realizacji">W realizacji</option>
                    <option value="completed">Zrealizowane</option>
                    <option value="cancelled">Anulowane</option>
                  </select>
                </div>
              </div>
              {/* ... (reszta formularza bez zmian) ... */}
              <hr />
              <h4>Pozycje Zamówienia</h4>
              {formData.order_items.map((item, index) => (
                <div key={index} className="required-product-form" style={{gridTemplateColumns: '2fr 1fr 1fr 1fr'}}>
                  <div style={{gridColumn: 'span 2'}}>
                    <label>Produkt</label>
                    <select name="product_id" value={item.product_id} onChange={(e) => handleItemChange(index, e)} required>
                      <option value="">-- Wybierz produkt --</option>
                      {products.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                    </select>
                  </div>
                  <div>
                    <label>Ilość</label>
                    <input type="number" name="quantity" value={item.quantity} onChange={(e) => handleItemChange(index, e)} min="1" required />
                  </div>
                  <div>
                    <label>Cena jednostkowa</label>
                    <input type="number" name="price" value={item.price} onChange={(e) => handleItemChange(index, e)} step="0.01" min="0" required />
                  </div>
                  <div className="action-cell">
                    <button type="button" onClick={() => removeItem(index)} className="delete-btn">Usuń</button>
                  </div>
                </div>
              ))}
              <button type="button" onClick={addItem} className="add-item-btn">+ Dodaj Pozycję</button>
              <div className="total-summary">
                <h3>SUMA: {formData.total_amount.toFixed(2)} PLN</h3>
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setShowModal(false)} className="cancel-btn">Anuluj</button>
                <button type="submit" disabled={loading}>{loading ? 'Zapisywanie...' : 'Zapisz Zamówienie'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* END: Modyfikacja modala */}
    </div>
  );
}

export default Orders;