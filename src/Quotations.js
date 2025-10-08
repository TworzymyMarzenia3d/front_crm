import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';

const RequiredProductForm = ({ product, index, itemIndex, updateProduct, removeProduct, allProducts }) => {
  const handleChange = useCallback(async (e) => {
    const { name, value } = e.target;
    await updateProduct(itemIndex, index, { ...product, [name]: value });
  }, [product, index, itemIndex, updateProduct]);

  const handleProductSelection = useCallback(async (e) => {
    const selectedProductId = parseInt(e.target.value);
    const selectedProduct = allProducts.find(p => p.id === selectedProductId);
    await updateProduct(itemIndex, index, {
      ...product,
      productId: selectedProductId,
      customName: selectedProduct ? selectedProduct.name : '',
    });
  }, [product, index, itemIndex, updateProduct, allProducts]);

// To jest poprawiona wersja z nowym polem
const RequiredProductForm = ({ product, index, itemIndex, updateProduct, removeProduct, allProducts }) => {
  const handleChange = useCallback(async (e) => {
    const { name, value } = e.target;
    // START: Zmiana - przekazujemy plannedScrapQuantity jako liczbę
    const updatedValue = name === 'plannedScrapQuantity' ? parseFloat(value) || 0 : value;
    await updateProduct(itemIndex, index, { ...product, [name]: updatedValue });
    // END: Zmiana
  }, [product, index, itemIndex, updateProduct]);

  const handleProductSelection = useCallback(async (e) => {
    const selectedProductId = parseInt(e.target.value);
    const selectedProduct = allProducts.find(p => p.id === selectedProductId);
    await updateProduct(itemIndex, index, {
      ...product,
      productId: selectedProductId,
      customName: selectedProduct ? selectedProduct.name : '',
    });
  }, [product, index, itemIndex, updateProduct, allProducts]);

  return (
    <div className="required-product-form">
        {product.isCustom ? (
          <div><label>Nazwa materiału (spoza bazy)</label><input type="text" name="customName" value={product.customName || ''} onChange={handleChange} /></div>
        ) : (
          <div><label>Produkt z magazynu</label><select name="productId" value={product.productId || ''} onChange={handleProductSelection}><option value="">Wybierz produkt...</option>{allProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        )}
      <div><label>Ilość</label><input type="number" name="quantity" value={product.quantity || ''} onChange={handleChange} step="0.01" /></div>
      
      {/* START: DODANE NOWE POLE */}
      <div>
        <label>Planowany odpad</label>
        <input 
            type="number" 
            name="plannedScrapQuantity" 
            value={product.plannedScrapQuantity || ''} 
            onChange={handleChange} 
            step="0.01" 
            placeholder="np. 0.5"
        />
      </div>
      {/* END: DODANE NOWE POLE */}

      <div><label>Szac. koszt jedn.</label><input type="number" name="estimatedUnitCost" value={product.estimatedUnitCost || ''} onChange={handleChange} step="0.01" readOnly={!product.isCustom} /></div>
      <div className="action-cell"><button type="button" onClick={() => removeProduct(itemIndex, index)} className="delete-btn">Usuń</button></div>
    </div>
  );
};

function Quotations({ user }) {
  const [quotations, setQuotations] = useState([]);
  const [clients, setClients] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ clientId: '', status: 'draft', totalCalculatedCost: 0, totalSellingPrice: 0, items: [] });
  const API_BASE_URL = process.env.REACT_APP_SUPABASE_EDGE_FUNCTION_URL;

  const getAuthToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Sesja wygasła lub użytkownik nie jest zalogowany.");
    return session.access_token;
  }, []);

  const fetchQuotations = useCallback(async (token) => {
    const response = await fetch(`${API_BASE_URL}/quotations`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Błąd pobierania wycen: ${errText}`);
    }
    return await response.json();
 }, [API_BASE_URL]);

    const fetchInitialData = useCallback(async () => {
    const clientPromise = supabase.from('Client').select('id, name');
    const productPromise = supabase.from('Product').select('id, name');
    const [{ data: clientData, error: clientError }, { data: productData, error: productError }] = await Promise.all([clientPromise, productPromise]);
   if (clientError) throw new Error(`Błąd pobierania klientów: ${clientError.message}`);
   if (productError) throw new Error(`Błąd pobierania produktów: ${productError.message}`);
   return { clientData, productData };
}, []);



  useEffect(() => {
    if (!user) {
        setLoading(false);
        setError("Oczekiwanie na sesję użytkownika...");
        return;
    }
    const loadAllData = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await getAuthToken();
        const [quotationsData, initialData] = await Promise.all([fetchQuotations(token), fetchInitialData()]);
        setQuotations(quotationsData || []);
        setClients(initialData.clientData || []);
        setAllProducts(initialData.productData || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadAllData();
  }, [user, getAuthToken, fetchQuotations, fetchInitialData]);

  const getFifoCost = useCallback(async (productId, quantity) => {
    try {
      const token = await getAuthToken();
      const response = await fetch(`${API_BASE_URL}/fifo-cost-calculator`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify([{ productId, requiredQuantity: quantity }])
      });
      if (!response.ok) throw new Error('Błąd kalkulacji kosztu');
      const data = await response.json();
      return data && data.length > 0 ? data[0] : null;
    } catch (err) {
      setError("Nie udało się skalkulować kosztu FIFO.");
      return null;
    }
  }, [API_BASE_URL, getAuthToken]);

  const calculateTotals = useCallback((items) => {
    let totalCost = 0, totalPrice = 0;
    items.forEach(item => {
      let itemCost = 0;
      item.requiredProducts.forEach(rp => {
        itemCost += (parseFloat(rp.quantity) || 0) * (parseFloat(rp.estimatedUnitCost) || 0);
      });
      item.calculatedCost = itemCost * (item.quantity || 1);
      const markup = 1 + (parseFloat(item.markupPercent) || 0) / 100;
      item.sellingPrice = item.calculatedCost * markup;
      totalCost += item.calculatedCost;
      totalPrice += item.sellingPrice;
    });
    return { updatedItems: items, totalCalculatedCost: totalCost, totalSellingPrice: totalPrice };
  }, []);

  const updateFormData = useCallback((newItems) => {
    const { updatedItems, totalCalculatedCost, totalSellingPrice } = calculateTotals(newItems);
    setFormData(prev => ({ ...prev, items: updatedItems, totalCalculatedCost, totalSellingPrice }));
  }, [calculateTotals]);

  const handleAddItem = useCallback(() => {
    updateFormData([...formData.items, {
      description: '', quantity: 1, markupPercent: 20,
      calculatedCost: 0, sellingPrice: 0, requiredProducts: [],
    }]);
  }, [formData.items, updateFormData]);
  
  const handleRemoveItem = useCallback((itemIndex) => {
    updateFormData(formData.items.filter((_, i) => i !== itemIndex));
  }, [formData.items, updateFormData]);
  
  const handleItemChange = useCallback((index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    updateFormData(newItems);
  }, [formData.items, updateFormData]);
  
  const handleAddProduct = useCallback((itemIndex, isCustom) => {
    const newItems = [...formData.items];
    newItems[itemIndex].requiredProducts.push({
      quantity: 1, productId: null, isCustom: isCustom, customName: '', estimatedUnitCost: 0,
    });
    updateFormData(newItems);
  }, [formData.items, updateFormData]);

  const handleUpdateProduct = useCallback(async (itemIndex, productIndex, updatedProduct) => {
    const newItems = [...formData.items];
    const originalProduct = newItems[itemIndex].requiredProducts[productIndex];
    newItems[itemIndex].requiredProducts[productIndex] = updatedProduct;
    const needsRecalculation = !updatedProduct.isCustom && updatedProduct.productId && updatedProduct.quantity > 0 &&
      (originalProduct.productId !== updatedProduct.productId || originalProduct.quantity !== updatedProduct.quantity);
    if (needsRecalculation) {
      const costResult = await getFifoCost(updatedProduct.productId, updatedProduct.quantity);
      if (costResult && costResult.hasSufficientStock) {
        newItems[itemIndex].requiredProducts[productIndex].estimatedUnitCost = costResult.totalCost / updatedProduct.quantity;
      } else {
        alert(`Brak wystarczającej ilości produktu na magazynie!`);
        newItems[itemIndex].requiredProducts[productIndex].estimatedUnitCost = 0;
      }
    }
    updateFormData(newItems);
  }, [formData.items, getFifoCost, updateFormData]);

  const handleRemoveProduct = useCallback((itemIndex, productIndex) => {
    const newItems = [...formData.items];
    newItems[itemIndex].requiredProducts = newItems[itemIndex].requiredProducts.filter((_, i) => i !== productIndex);
    updateFormData(newItems);
  }, [formData.items, updateFormData]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
        const token = await getAuthToken();
        const {items, ...quoteData} = formData;
        const response = await fetch(`${API_BASE_URL}/quotations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
            body: JSON.stringify({quotationData: quoteData, items: items})
        });
        if(!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "Nie udało się zapisać wyceny.");
        }
        setShowModal(false);
        const newQuotations = await fetchQuotations(token);
        setQuotations(newQuotations);
    } catch (err) {
        setError(err.message);
    } finally {
        setLoading(false);
    }
  }, [API_BASE_URL, formData, getAuthToken, fetchQuotations]);

    return (
    <div className="list-section full-width">
      <h2>Moduł Wycen</h2>
      {error && <p className="error-message">{error}</p>}
      <button onClick={() => setShowModal(true)}>Dodaj Nową Wycenę</button>
      <table>
        <thead><tr><th>ID</th><th>Klient</th><th>Status</th><th>Data</th><th>Cena sprzedaży</th></tr></thead>
        <tbody>
          {loading ? (<tr><td colSpan="5">Ładowanie...</td></tr>) : (
            quotations.map(q => (<tr key={q.id}><td>#{q.id}</td><td>{q.Client?.name || 'Brak klienta'}</td><td>{q.status}</td><td>{new Date(q.createdAt).toLocaleDateString()}</td><td>{q.totalSellingPrice.toFixed(2)} PLN</td></tr>))
          )}
        </tbody>
      </table>
      {!loading && quotations.length === 0 && <p>Brak wycen do wyświetlenia.</p>}
      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h2>Nowa Wycena</h2>
            <form onSubmit={handleSubmit}>
              <label htmlFor="client-select">Wybierz klienta</label>
              <select id="client-select" value={formData.clientId} onChange={(e) => setFormData({...formData, clientId: e.target.value})} required>
                <option value="">-- Proszę wybrać klienta --</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <hr />
              {formData.items.map((item, itemIndex) => (
                <div key={itemIndex} className="quotation-item">
                    <div className="item-header"><h3>Pozycja #{itemIndex + 1}</h3><button type="button" onClick={() => handleRemoveItem(itemIndex)} className="delete-btn">X</button></div>
                    <label>Opis pozycji</label>
                    <input type="text" value={item.description} onChange={(e) => handleItemChange(itemIndex, 'description', e.target.value)} placeholder="np. Obudowa do prototypu" required />
                    <div className="inline-form">
                        <div><label>Ilość szt.</label><input type="number" value={item.quantity} onChange={(e) => handleItemChange(itemIndex, 'quantity', e.target.value)} min="1"/></div>
                        <div><label>Marża (%)</label><input type="number" value={item.markupPercent} onChange={(e) => handleItemChange(itemIndex, 'markupPercent', e.target.value)} /></div>
                    </div>
                    <h4>Wymagane materiały:</h4>
                    {item.requiredProducts.map((p, pIndex) => (
                        <RequiredProductForm key={pIndex} product={p} index={pIndex} itemIndex={itemIndex} updateProduct={handleUpdateProduct} removeProduct={handleRemoveProduct} allProducts={allProducts} />
                    ))}
                    <div className="form-actions"><button type="button" onClick={() => handleAddProduct(itemIndex, false)}>Dodaj z magazynu</button><button type="button" onClick={() => handleAddProduct(itemIndex, true)}>Dodaj spoza magazynu</button></div>
                    <div className="item-summary"><p>Szac. koszt: {item.calculatedCost.toFixed(2)} PLN</p><p>Cena sprzedaży: {item.sellingPrice.toFixed(2)} PLN</p></div>
                </div>
              ))}
              <button type="button" onClick={handleAddItem} className="add-item-btn">+ Dodaj kolejną pozycję do wyceny</button>
              <div className="total-summary"><h3>SUMA: {formData.totalSellingPrice.toFixed(2)} PLN</h3><p>(Szacowany koszt całkowity: {formData.totalCalculatedCost.toFixed(2)} PLN)</p></div>
              <div className="form-actions"><button type="button" onClick={() => setShowModal(false)} className="cancel-btn">Anuluj</button><button type="submit" disabled={loading}>{loading ? 'Zapisywanie...' : 'Zapisz Wycenę'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Quotations;