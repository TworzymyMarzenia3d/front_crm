import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient'; // Importujemy naszego klienta Supabase

function Warehouse() {
    const [categories, setCategories] = useState([]);
    const [products, setProducts] = useState([]);
    const [purchases, setPurchases] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Stany dla formularza kategorii
    const [newCategoryName, setNewCategoryName] = useState('');

    // Stany dla formularza produktu
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [productName, setProductName] = useState('');
    const [productUnit, setProductUnit] = useState('');
    const [manufacturer, setManufacturer] = useState('');
    const [materialType, setMaterialType] = useState('');
    const [color, setColor] = useState('');
    
    // Stany dla formularza zakupu
    const [purchaseProductId, setPurchaseProductId] = useState('');
    const [purchaseVendor, setPurchaseVendor] = useState('');
    const [purchasePrice, setPurchasePrice] = useState('');
    const [purchaseQuantity, setPurchaseQuantity] = useState('');
    const [purchaseCurrency, setPurchaseCurrency] = useState('PLN');
    const [exchangeRate, setExchangeRate] = useState('1');

    const isFilamentCategory = categories.find(c => c.id === parseInt(selectedCategoryId))?.name.toLowerCase() === 'filament';

    // --- POBIERANIE DANYCH z Supabase ---
    const fetchData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            // Używamy Promise.all, aby pobierać dane równolegle
            const { data: catsData, error: catsError } = await supabase.from('ProductCategory').select('*').order('name');
            if (catsError) throw catsError;

            const { data: prodsData, error: prodsError } = await supabase.from('Product').select('*, category:ProductCategory(*)').order('name');
            if (prodsError) throw prodsError;

            const { data: purcsData, error: purcsError } = await supabase.from('Purchase').select('*, product:Product(*)').order('purchaseDate');
            if (purcsError) throw purcsError;

            setCategories(catsData);
            setProducts(prodsData);
            setPurchases(purcsData);

            if (catsData.length > 0 && !selectedCategoryId) setSelectedCategoryId(catsData[0].id);
            if (prodsData.length > 0 && !purchaseProductId) setPurchaseProductId(prodsData[0].id);

        } catch (error) {
            console.error("Błąd pobierania danych z Supabase:", error);
            setError(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []); // Uruchom tylko raz na starcie

    // --- DODAWANIE DANYCH do Supabase ---

    const handleAddCategory = async (e) => {
        e.preventDefault();
        if (!newCategoryName.trim()) return;
        const { data, error } = await supabase.from('ProductCategory').insert({ name: newCategoryName }).select();
        if (error) alert(error.message);
        else {
            setCategories(prev => [...prev, data[0]].sort((a,b) => a.name.localeCompare(b.name)));
            setNewCategoryName('');
        }
    };

    const handleAddProduct = async (e) => {
        e.preventDefault();
        let productData;
        if (isFilamentCategory) {
            productData = { 
                name: `${manufacturer} ${materialType} ${color}`,
                unit: 'g',
                categoryId: selectedCategoryId, 
                manufacturer, 
                materialType, 
                color 
            };
        } else {
            productData = { categoryId: selectedCategoryId, name: productName, unit: productUnit };
        }
        const { error } = await supabase.from('Product').insert(productData);
        if (error) alert(error.message);
        else fetchData(); // Odświeżamy wszystko, bo lista produktów się zmieniła
    };
    
    const handleAddPurchase = async (e) => {
        e.preventDefault();
        if (!purchaseProductId) return alert("Proszę wybrać produkt.");
        
        const priceFloat = parseFloat(purchasePrice);
        const quantityFloat = parseFloat(purchaseQuantity);
        const rateFloat = parseFloat(exchangeRate);
        const priceInPLN = priceFloat * rateFloat;
        const costPerUnitInPLN = priceInPLN / quantityFloat;

        const { error } = await supabase.from('Purchase').insert({
            productId: purchaseProductId,
            vendorName: purchaseVendor,
            price: priceFloat,
            initialQuantity: quantityFloat,
            currentQuantity: quantityFloat,
            currency: purchaseCurrency,
            exchangeRate: rateFloat,
            priceInPLN: priceInPLN,
            costPerUnitInPLN: costPerUnitInPLN
        });
        if (error) alert(error.message);
        else fetchData(); // Odświeżamy wszystko
    };

    if (isLoading) return <p>Ładowanie danych magazynu...</p>;
    if (error) return <p className="error-message">Błąd: {error}</p>;

    return (
        <>
            <div className="management-panel" style={{alignItems: 'flex-start'}}>
                <section className="form-section">
                    <h2>Kategorie</h2>
                    <form onSubmit={handleAddCategory} className="add-category-form">
                        <input type="text" placeholder="Nowa nazwa..." value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} />
                        <button type="submit">Dodaj</button>
                    </form>
                    {/* TODO: Dodać listę i edycję kategorii */}
                </section>
                <section className="form-section">
                    <h2>Dodaj produkt</h2>
                    <form onSubmit={handleAddProduct}>
                        <label>Kategoria</label>
                        <select value={selectedCategoryId} onChange={e => setSelectedCategoryId(e.target.value)} required>
                            {categories.length === 0 && <option value="" disabled>Najpierw dodaj kategorię</option>}
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        {isFilamentCategory ? ( <>
                                <label>Producent</label><input type="text" value={manufacturer} onChange={e => setManufacturer(e.target.value)} required />
                                <label>Typ Materiału</label><input type="text" value={materialType} onChange={e => setMaterialType(e.target.value)} required />
                                <label>Kolor</label><input type="text" value={color} onChange={e => setColor(e.target.value)} required />
                            </> ) : ( <>
                                <label>Nazwa Produktu</label><input type="text" value={productName} onChange={e => setProductName(e.target.value)} required />
                                <label>Jednostka (g, ml, szt, h)</label><input type="text" value={productUnit} onChange={e => setProductUnit(e.target.value)} required />
                            </> )}
                        <button type="submit">Dodaj produkt</button>
                    </form>
                </section>
                <section className="form-section">
                    <h2>Dodaj nowy zakup</h2>
                    <form onSubmit={handleAddPurchase}>
                        <label>Produkt</label>
                        <select value={purchaseProductId} onChange={e => setPurchaseProductId(e.target.value)} required>
                            {products.length === 0 && <option value="" disabled>Najpierw dodaj produkt</option>}
                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <label>Dostawca (sklep)</label>
                        <input type="text" placeholder="Nazwa sklepu" value={purchaseVendor} onChange={e => setPurchaseVendor(e.target.value)} />
                        <label>Cena</label>
                        <input type="number" placeholder="Cena" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} required step="0.01" />
                        <label>Ilość</label>
                        <input type="number" placeholder="Ilość (w jednostce produktu)" value={purchaseQuantity} onChange={e => setPurchaseQuantity(e.target.value)} required step="0.01" />
                        <div className="currency-wrapper">
                            <div>
                                <label>Waluta</label>
                                <select value={purchaseCurrency} onChange={(e) => { const nc = e.target.value; setPurchaseCurrency(nc); if (nc === 'PLN') setExchangeRate('1'); }}>
                                    <option value="PLN">PLN</option><option value="EUR">EUR</option><option value="USD">USD</option><option value="CZK">CZK</option>
                                </select>
                            </div>
                            {purchaseCurrency !== 'PLN' && ( <div>
                                <label>Kurs {purchaseCurrency}/PLN</label>
                                <input type="number" value={exchangeRate} onChange={(e) => setExchangeRate(e.target.value)} required step="0.0001" />
                            </div> )}
                        </div>
                        <button type="submit">Dodaj zakup</button>
                    </form>
                </section>
            </div>
            <section className="list-section full-width">
                <h2>Stan Magazynowy (Partie Produktów)</h2>
                <table>
                    <thead><tr><th>Produkt</th><th>Ilość (zostało/całość)</th><th>Dostawca</th><th>Data zakupu</th><th>Koszt / jednostkę (PLN)</th></tr></thead>
                    <tbody>
                        {purchases.length === 0 ? (<tr><td colSpan="5">Brak zakupów w bazie.</td></tr>) : (
                            purchases.map(p => (
                                <tr key={p.id}>
                                    <td>{p.product?.name || 'Błąd'}</td><td>{p.currentQuantity} / {p.initialQuantity} {p.product?.unit}</td>
                                    <td>{p.vendorName || '-'}</td><td>{new Date(p.purchaseDate).toLocaleDateString()}</td><td>{p.costPerUnitInPLN.toFixed(4)} PLN</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </section>
        </>
    );
}

export default Warehouse;