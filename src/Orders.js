import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';

function Orders() {
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error("Użytkownik nie jest zalogowany.");
      const response = await fetch(`${API_BASE_URL}/orders`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Błąd pobierania danych');
      }
      const data = await response.json();
      setOrders(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL, getAuthToken]);

  const fetchDropdownData = useCallback(async () => {
    try {
      const { data: clientData, error: clientError } = await supabase.from('Client').select('id, name');
      if (clientError) throw clientError;
      setCustomers(clientData);

      const { data: productData, error: productError } = await supabase.from('Product').select('id, name, price');
      if (productError) throw productError;
      setProducts(productData);
    } catch (err) {
      setError("Nie udało się pobrać klientów lub produktów.");
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchDropdownData();
  }, [fetchData, fetchDropdownData]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const calculateTotalAmount = (items) => {
    const total = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    setFormData(prev => ({ ...prev, order_items: items, total_amount: total }));
  };

  const handleItemChange = (index, e) => {
    const { name, value } = e.target;
    const newItems = [...formData.order_items];
    let updatedValue = value;

    if (name === 'quantity') {
      updatedValue = parseInt(value, 10) || 0;
    } else if (name === 'product_id') {
      const product = products.find(p => p.id === parseInt(value));
      updatedValue = value;
      newItems[index].price = product ? product.price : 0;
    } else if (name === 'price') {
      updatedValue = parseFloat(value) || 0;
    }

    newItems[index] = { ...newItems[index], [name]: updatedValue };
    calculateTotalAmount(newItems);
  };

  const addItem = () => {
    const newItems = [...formData.order_items, { product_id: '', quantity: 1, price: 0 }];
    calculateTotalAmount(newItems);
  };

  const removeItem = (index) => {
    const newItems = formData.order_items.filter((_, i) => i !== index);
    calculateTotalAmount(newItems);
  };

  const resetForm = () => {
    setFormData({
      customer_id: '',
      order_date: new Date().toISOString().slice(0, 10),
      status: 'pending',
      total_amount: 0,
      order_items: [],
    });
  };

  const handleOpenModal = (orderToEdit = null) => {
    if (orderToEdit) {
      setEditingOrder(orderToEdit);
      // Tutaj powinna być logika pobierania pełnych danych zamówienia, jeśli potrzebne
      // Na razie zakładamy, że mamy wszystko w `orderToEdit`
      setFormData({
        customer_id: orderToEdit.customer_id,
        order_date: new Date(orderToEdit.order_date).toISOString().slice(0, 10),
        status: orderToEdit.status,
        total_amount: orderToEdit.total_amount,
        order_items: orderToEdit.order_items || [], // Upewnij się, że order_items są dostępne
      });
    } else {
      setEditingOrder(null);
      resetForm();
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); // Można użyć osobnego stanu dla formularza
    setError(null);

    const token = await getAuthToken();
    if (!token) {
        setError("Użytkownik nie jest uwierzytelniony.");
        setLoading(false);
        return;
    }

    const { order_items, ...orderData } = formData;

    try {
      // Logika POST/PUT - można ją zrefaktoryzować, na razie zostawiamy
      // ...
      setShowModal(false);
      fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (orderId) => {
    if (!window.confirm('Czy na pewno chcesz usunąć to zamówienie?')) return;
    // ... logika usuwania ...
    fetchData();
  };

  return (
    <div className="list-section full-width">
      <h2>Moduł Zamówień</h2>
      {error && <p className="error-message">{error}</p>}
      <button onClick={() => handleOpenModal()}>Dodaj Nowe Zamówienie</button>

      <table>
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
          {loading ? (
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
                  <button className="edit-btn" onClick={() => handleOpenModal(order)}>Edytuj</button>
                  <button className="delete-btn" onClick={() => handleDelete(order.id)}>Usuń</button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {!loading && orders.length === 0 && <p>Brak zamówień do wyświetlenia.</p>}

      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h2>{editingOrder ? 'Edytuj Zamówienie' : 'Dodaj Nowe Zamówienie'}</h2>
            <form onSubmit={handleSubmit}>
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
                  <select id="status" name="status" value={formData.status} onChange={handleInputChange} required>
                    <option value="pending">Oczekujące</option>
                    <option value="completed">Zrealizowane</option>
                    <option value="cancelled">Anulowane</option>
                  </select>
                </div>
              </div>

              <hr />
              <h4>Pozycje Zamówienia</h4>
              {formData.order_items.map((item, index) => (
                <div key={index} className="required-product-form">
                  <div>
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
                <button type="submit" disabled={loading}>
                  {loading ? 'Zapisywanie...' : 'Zapisz Zamówienie'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Orders;