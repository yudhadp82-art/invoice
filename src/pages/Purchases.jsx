import { useState, useEffect } from 'react';
import { FiPlus, FiSearch, FiShoppingCart, FiTrash2, FiDownload } from 'react-icons/fi';
import Modal from '../components/Modal';
import { Purchases as PurchaseStore, Products as ProductStore } from '../utils/storage';
import { formatCurrency, formatDateShort } from '../utils/formatter';
import { exportPurchasesToExcel } from '../utils/excel';

export default function Purchases() {
  const [purchases, setPurchases] = useState([]);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    supplier: '',
    items: [],
    notes: '',
  });
  const [openIndex, setOpenIndex] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { reload(); }, []);

  async function reload() {
    setPurchases(await PurchaseStore.getAll());
    setProducts(await ProductStore.getAll());
  }

  function openAdd() {
    setForm({ supplier: '', items: [], notes: '' });
    setModalOpen(true);
  }

  function addItem() {
    if (products.length === 0) return;
    const p = products[0];
    setForm(f => ({
      ...f,
      items: [...f.items, {
        productId: p.id,
        productName: p.name,
        qty: 1,
        costPerUnit: p.purchaseCost || 0,
        unit: p.unit,
      }],
    }));
  }

  function updateItem(index, field, value) {
    setForm(f => {
      const items = [...f.items];
      const item = { ...items[index] };
      if (field === 'productId') {
        const product = products.find(p => p.id === value);
        if (product) {
          item.productId = value;
          item.productName = product.name;
          item.unit = product.unit;
          item.costPerUnit = product.purchaseCost || 0;
        }
      } else if (field === 'qty') {
        item.qty = Number(value) || 0;
      } else if (field === 'costPerUnit') {
        item.costPerUnit = Number(value) || 0;
      }
      items[index] = item;
      return { ...f, items };
    });
  }

  function removeItem(index) {
    setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== index) }));
  }

  async function handleSave(e) {
    e.preventDefault();
    if (form.items.length === 0) {
      alert('Tambahkan minimal 1 item');
      return;
    }

    const totalCost = form.items.reduce((sum, item) => sum + (item.costPerUnit * item.qty), 0);
    await PurchaseStore.create({ ...form, totalCost });

    // Update product stock and purchase cost
    for (const item of form.items) {
      const product = await ProductStore.getById(item.productId);
      if (product) {
        await ProductStore.update(item.productId, {
          stock: (product.stock || 0) + item.qty,
          purchaseCost: item.costPerUnit, // Update latest cost
        });
      }
    }

    setModalOpen(false);
    await reload();
  }

  async function handleDelete(id) {
    if (confirm('Hapus catatan pembelian ini?')) {
      await PurchaseStore.delete(id);
      await reload();
    }
  }

  const filtered = purchases
    .filter(p => {
      const q = search.toLowerCase();
      return (p.supplier || '').toLowerCase().includes(q) ||
        (p.items || []).some(item => (item.productName || '').toLowerCase().includes(q));
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const totalSpent = purchases.reduce((sum, p) => sum + (p.totalCost || 0), 0);

  return (
    <div className="animate-in">
      <div className="page-header page-header-actions">
        <div>
          <h1>Pembelian</h1>
          <p>Catat pembelian & restock barang</p>
        </div>
        <div className="flex gap-sm">
          <button className="btn btn-secondary" onClick={() => exportPurchasesToExcel(purchases)}>
            <FiDownload /> Export Excel
          </button>
          <button className="btn btn-primary" onClick={openAdd}>
            <FiPlus /> Catat Pembelian
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="stats-grid">
        <div className="stat-card orange">
          <div className="stat-card-header">
            <div className="stat-card-icon"><FiShoppingCart /></div>
          </div>
          <div className="stat-card-value">{purchases.length}</div>
          <div className="stat-card-label">Total Transaksi Pembelian</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-card-header">
            <div className="stat-card-icon">💰</div>
          </div>
          <div className="stat-card-value">{formatCurrency(totalSpent)}</div>
          <div className="stat-card-label">Total Pengeluaran</div>
        </div>
      </div>

      <div className="toolbar">
        <div className="search-box">
          <FiSearch className="search-icon" />
          <input name="input_1_2" type="text" placeholder="Cari pembelian..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Supplier</th>
              <th>Items</th>
              <th style={{ textAlign: 'right' }}>Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className="empty-state">
                    <div className="empty-state-icon"><FiShoppingCart /></div>
                    <h3>Belum ada catatan pembelian</h3>
                  </div>
                </td>
              </tr>
            ) : filtered.map(p => (
              <tr key={p.id}>
                <td className="text-muted">{formatDateShort(p.createdAt)}</td>
                <td><strong>{p.supplier || '-'}</strong></td>
                <td>
                  {(p.items || []).map((item, i) => (
                    <div key={i} className="text-sm">{item.productName} × {item.qty} {item.unit}</div>
                  ))}
                </td>
                <td className="text-right" style={{ fontWeight: 600 }}>{formatCurrency(p.totalCost)}</td>
                <td>
                  <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleDelete(p.id)}><FiTrash2 /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Catat Pembelian" size="lg">
        <form onSubmit={handleSave}>
          <div className="modal-body" style={{ position: 'relative' }}>
            {openIndex !== null && (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 90 }} onClick={() => setOpenIndex(null)} />
            )}
            <div className="form-group">
              <label className="form-label">Nama Supplier</label>
              <input name="supplier_4" className="form-input" value={form.supplier} onChange={e => setForm({...form, supplier: e.target.value})} placeholder="Nama supplier/toko" />
            </div>

            <div className="flex-between mb-md mt-lg">
              <h4>Daftar Barang</h4>
              <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}>
                <FiPlus /> Tambah
              </button>
            </div>

            {form.items.length === 0 ? (
              <p className="text-muted text-sm">Belum ada barang.</p>
            ) : (
              <table className="items-table">
                <thead>
                  <tr>
                    <th>Produk</th>
                    <th>Qty</th>
                    <th>Harga/unit</th>
                    <th style={{ textAlign: 'right' }}>Subtotal</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((item, i) => (
                    <tr key={i}>
                      <td style={{ position: 'relative' }}>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Cari produk..."
                          value={openIndex === i ? searchQuery : item.productName || ''}
                          onChange={e => {
                            setSearchQuery(e.target.value);
                            setOpenIndex(i);
                          }}
                          onFocus={() => {
                            setOpenIndex(i);
                            setSearchQuery(item.productName || '');
                          }}
                        />
                        {openIndex === i && (
                          <div className="dropdown-panel" style={{ 
                            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, 
                            background: '#1e293b', border: '1px solid #334155', borderRadius: 8, 
                            maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', 
                            marginTop: 4 
                          }}>
                            {products
                              .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
                              .map(p => (
                                <div
                                  key={p.id}
                                  className="dropdown-item"
                                  style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                                  onClick={() => {
                                    updateItem(i, 'productId', p.id);
                                    setOpenIndex(null);
                                    setSearchQuery('');
                                  }}
                                  onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.05)'}
                                  onMouseLeave={e => e.target.style.background = 'transparent'}
                                >
                                  {p.name}
                                </div>
                              ))}
                          </div>
                        )}
                      </td>
                      <td>
                        <input name="qty_8" className="form-input" type="number" min="1" value={item.qty} onChange={e => updateItem(i, 'qty', e.target.value)} style={{ width: 80 }} />
                      </td>
                      <td>
                        <input name="costPerUnit_10" className="form-input" type="number" min="0" value={item.costPerUnit} onChange={e => updateItem(i, 'costPerUnit', e.target.value)} style={{ width: 130 }} />
                      </td>
                      <td className="text-right" style={{ fontWeight: 600 }}>{formatCurrency(item.costPerUnit * item.qty)}</td>
                      <td>
                        <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => removeItem(i)}><FiTrash2 /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {form.items.length > 0 && (
              <div style={{ textAlign: 'right', marginTop: 12, fontSize: '16px', fontWeight: 700, color: '#818cf8' }}>
                Total: {formatCurrency(form.items.reduce((sum, item) => sum + (item.costPerUnit * item.qty), 0))}
              </div>
            )}

            <div className="form-group mt-lg">
              <label className="form-label">Catatan</label>
              <textarea name="notes_12" className="form-textarea" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Catatan pembelian..." />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Batal</button>
            <button type="submit" className="btn btn-primary">Simpan</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
