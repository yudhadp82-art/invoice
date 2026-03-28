import { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiTag, FiSave, FiDownload, FiUpload, FiFileText } from 'react-icons/fi';
import Modal from '../components/Modal';
import { PriceCategories as CategoryStore, Products as ProductStore } from '../utils/storage';
import { formatCurrency } from '../utils/formatter';
import { exportPricingToExcel, downloadPricingTemplate, triggerImportExcel } from '../utils/excel';
import ConfirmModal from '../components/ConfirmModal';

export default function Pricing() {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  
  // Category Modal State
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCatId, setEditingCatId] = useState(null);
  const [catName, setCatName] = useState('');
  const [deleteId, setDeleteId] = useState(null);

  // Pricing Modal State
  const [priceModalOpen, setPriceModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productPrices, setProductPrices] = useState({});

  useEffect(() => {
    reload();
    window.addEventListener('app-data-mutation', reload);
    return () => window.removeEventListener('app-data-mutation', reload);
  }, []);

  async function reload() {
    setCategories(await CategoryStore.getAll());
    setProducts(await ProductStore.getAll());
  }

  // --- Category Handlers ---
  function openAddCategory() {
    setCatName('');
    setEditingCatId(null);
    setCatModalOpen(true);
  }

  function openEditCategory(category) {
    setCatName(category.name);
    setEditingCatId(category.id);
    setCatModalOpen(true);
  }

  async function handleSaveCategory(e) {
    e.preventDefault();
    if (editingCatId) {
      await CategoryStore.update(editingCatId, { name: catName });
    } else {
      await CategoryStore.create({ name: catName });
    }
    setCatModalOpen(false);
    await reload();
  }

  async function handleDeleteCategory(id) {
    setDeleteId(id);
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await CategoryStore.delete(deleteId);
    setDeleteId(null);
    await reload();
  }

  // --- Pricing Handlers ---
  function openEditPrices(product) {
    setEditingProduct(product);
    setProductPrices(product.categoryPrices || {});
    setPriceModalOpen(true);
  }

  async function handleSavePrices(e) {
    e.preventDefault();
    if (!editingProduct) return;
    
    // Clean up empty prices
    const cleanPrices = {};
    Object.entries(productPrices).forEach(([catId, price]) => {
      if (price !== '' && price !== null && !isNaN(price)) {
        cleanPrices[catId] = Number(price);
      }
    });

    await ProductStore.update(editingProduct.id, { categoryPrices: cleanPrices });
    setPriceModalOpen(false);
    await reload();
  }

  function handleExport() {
    exportPricingToExcel(products, categories);
  }

  function handleImport() {
    triggerImportExcel(async (data) => {
      let count = 0;
      for (const item of data) {
        const sku = item['SKU'];
        const name = item['Nama Produk'];
        if (!sku && !name) continue;

        const productIndex = products.findIndex(p => (sku && p.sku === sku) || (name && p.name === name));
        if (productIndex !== -1) {
          const product = products[productIndex];
          const newCatPrices = { ...product.categoryPrices };

          categories.forEach(c => {
            const excelKey = `Harga Jual: ${c.name}`;
            if (item[excelKey] !== undefined && item[excelKey] !== '') {
              newCatPrices[c.id] = Number(item[excelKey]);
            }
          });

          let updates = { categoryPrices: newCatPrices };
          if (item['Harga Jual Utama (Default)']) {
            updates.sellPrice = Number(item['Harga Jual Utama (Default)']);
          }
          
          await ProductStore.update(product.id, updates);
          count++;
        }
      }
      alert(`Berhasil update harga untuk ${count} produk!`);
      await reload();
    });
  }

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="animate-in">
      <div className="page-header page-header-actions">
        <div>
          <h1>Kategori Harga</h1>
          <p>Kelola tingkatan harga dan set harga fix per produk</p>
        </div>
        <button className="btn btn-primary" onClick={openAddCategory}>
          <FiPlus /> Tambah Kategori
        </button>
      </div>

      <div className="card mb-lg">
        <div className="card-header">
          <h3 className="card-title">Daftar Kategori Harga</h3>
        </div>
        <div className="table-container" style={{ border: 'none' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Nama Kategori</th>
                <th style={{ width: '100px', textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {categories.length === 0 ? (
                <tr><td colSpan={2} className="text-center text-muted">Belum ada kategori</td></tr>
              ) : categories.map(c => (
                <tr key={c.id}>
                  <td><strong>{c.name}</strong></td>
                  <td>
                    <div className="table-actions justify-center">
                      <button className="btn btn-ghost btn-sm" onClick={() => openEditCategory(c)}><FiEdit2 /></button>
                      <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleDeleteCategory(c.id)}><FiTrash2 /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="toolbar">
        <div className="search-box">
          <FiSearch className="search-icon" />
          <input type="text" placeholder="Cari produk..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="card-title">Daftar Harga Jual (Price List)</h3>
          <div className="flex gap-sm">
            <button className="btn btn-ghost btn-sm" onClick={() => downloadPricingTemplate(categories)} title="Download Template Excel">
              <FiFileText /> Template
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleImport}>
              <FiUpload /> Import Excel
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleExport}>
              <FiDownload /> Export Excel
            </button>
          </div>
        </div>
        <div className="table-container" style={{ border: 'none', overflowX: 'auto' }}>
          <table className="table" style={{ whiteSpace: 'nowrap' }}>
            <thead>
              <tr>
                <th style={{ minWidth: 200 }}>Produk & SKU</th>
                <th style={{ textAlign: 'right', minWidth: 120 }}>Modal</th>
                <th style={{ textAlign: 'right', minWidth: 150, background: 'rgba(99, 102, 241, 0.05)' }}>Harga Jual Utama<br/><span className="text-sm font-normal text-muted">(Default / Retail)</span></th>
                {categories.map(c => (
                  <th key={c.id} style={{ textAlign: 'right', minWidth: 150 }}>Harga: {c.name}</th>
                ))}
                <th style={{ width: 80, textAlign: 'center', position: 'sticky', right: 0, background: '#1e293b' }}>Set Harga</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={5 + categories.length}>
                    <div className="empty-state">
                      <div className="empty-state-icon"><FiTag /></div>
                      <h3>Belum ada produk</h3>
                    </div>
                  </td>
                </tr>
              ) : filteredProducts.map(p => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.name}</strong><br/>
                    <span className="text-muted text-sm">{p.sku} | {p.category}</span>
                  </td>
                  <td className="text-right text-muted">{formatCurrency(p.purchaseCost)}</td>
                  <td className="text-right" style={{ background: 'rgba(99, 102, 241, 0.02)', fontWeight: 600 }}>{formatCurrency(p.sellPrice)}</td>
                  {categories.map(c => {
                    const price = p.categoryPrices?.[c.id];
                    return (
                      <td key={c.id} className="text-right" style={{ color: price ? '#e2e8f0' : '#64748b' }}>
                        {price ? formatCurrency(price) : <span className="text-muted text-sm">- pakai default -</span>}
                      </td>
                    );
                  })}
                  <td style={{ textAlign: 'center', position: 'sticky', right: 0, background: '#1e293b' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => openEditPrices(p)}><FiEdit2 /> Set</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Kategori */}
      <Modal isOpen={catModalOpen} onClose={() => setCatModalOpen(false)} title={editingCatId ? 'Edit Kategori' : 'Tambah Kategori'}>
        <form onSubmit={handleSaveCategory}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Nama Kategori</label>
              <input className="form-input" required value={catName} onChange={e => setCatName(e.target.value)} placeholder="Contoh: Grosir, VIP, Reseller" name="catName" />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setCatModalOpen(false)}>Batal</button>
            <button type="submit" className="btn btn-primary">Simpan</button>
          </div>
        </form>
      </Modal>

      {/* Modal Set Harga Produk */}
      {editingProduct && (
        <Modal isOpen={priceModalOpen} onClose={() => setPriceModalOpen(false)} title={`Set Harga: ${editingProduct.name}`}>
          <form onSubmit={handleSavePrices}>
            <div className="modal-body">
              <div style={{ marginBottom: 20, padding: 15, background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                <p className="mb-sm"><strong>Harga Modal:</strong> {formatCurrency(editingProduct.purchaseCost)}</p>
                <p><strong>Harga Jual Utama (Default):</strong> <span className="text-success" style={{fontWeight: 600}}>{formatCurrency(editingProduct.sellPrice)}</span></p>
                <p className="text-sm text-muted mt-sm">Harga utama digunakan jika harga kategori dikosongkan.</p>
              </div>

              <h4 className="mb-sm">Harga Khusus per Kategori</h4>
              <p className="text-sm text-muted mb-md">Masukkan harga fix untuk setiap kategori (bukan persen markup). Kosongkan untuk mengikuti harga utama.</p>
              
              <div className="form-row">
                {categories.map(c => (
                  <div className="form-group" key={c.id}>
                    <label className="form-label">{c.name} (Rp)</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      min="0"
                      placeholder="Ikut harga utama"
                      value={productPrices[c.id] || ''}
                      onChange={e => setProductPrices({ ...productPrices, [c.id]: e.target.value })}
                      name={`price_${c.id}`}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setPriceModalOpen(false)}>Batal</button>
              <button type="submit" className="btn btn-primary"><FiSave /> Simpan Harga</button>
            </div>
          </form>
        </Modal>
      )}
      <ConfirmModal 
        isOpen={!!deleteId} 
        onClose={() => setDeleteId(null)} 
        onConfirm={confirmDelete}
        title="Hapus Kategori Harga"
        message="Hapus kategori harga ini? Peringatan: Customer yang menggunakan kategori ini bisa jadi error."
      />
    </div>
  );
}
