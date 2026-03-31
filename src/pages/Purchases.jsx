import { useState, useEffect } from 'react';
import { FiPlus, FiSearch, FiShoppingCart, FiTrash2, FiDownload, FiEdit2, FiFolder, FiGrid } from 'react-icons/fi';
import Modal from '../components/Modal';
import { Purchases as PurchaseStore, Products as ProductStore, Invoices as InvoiceStore } from '../utils/storage';
import { formatCurrency, formatDateShort, formatNumber, formatNumberInput } from '../utils/formatter';
import { exportPurchasesToExcel } from '../utils/excel';
import ConfirmModal from '../components/ConfirmModal';

export default function Purchases() {
  const [purchases, setPurchases] = useState([]);
  const [products, setProducts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState({
    supplier: '',
    invoiceIds: [], // array to support Multi-PO
    items: [],
    notes: '',
    discountType: 'nominal',
    discountValue: 0,
  });
  const [openIndex, setOpenIndex] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    reload();
    window.addEventListener('app-data-mutation', reload);
    return () => window.removeEventListener('app-data-mutation', reload);
  }, []);

  async function reload() {
    const ps = await PurchaseStore.getAll();
    const invs = await InvoiceStore.getAll();
    const prods = await ProductStore.getAll();
    
    // Auto-sync linked purchases (Smart Sync: maintain manual items)
    const updatedPurchases = await Promise.all(ps.map(async p => {
      const currentIds = p.invoiceIds || (p.invoiceId ? [p.invoiceId] : []);
      if (currentIds.length === 0) return p;

      const linkedInvs = invs.filter(i => currentIds.includes(i.id));
      if (linkedInvs.length === 0) return p;

      // Gabungkan semua item dari invoice-invoice terpilih
      const combinedInvItemsMap = {};
      linkedInvs.forEach(inv => {
        (inv.items || []).forEach(it => {
          const key = it.productId || it.productName;
          if (combinedInvItemsMap[key]) {
            combinedInvItemsMap[key].qty = Number(combinedInvItemsMap[key].qty) + Number(it.qty);
          } else {
            combinedInvItemsMap[key] = { ...it };
          }
        });
      });
      const combinedInvItems = Object.values(combinedInvItemsMap);
      const pItems = p.items || [];

      // ANALISA PERUBAHAN
      // Kita ingin menyinkronkan item yang ADA di PO, namun TIDAK menghapus item manual.
      let hasChange = false;
      const newItems = [...pItems];
      
      // 1. Update atau tambah item dari PO
      combinedInvItems.forEach(it => {
        const idx = newItems.findIndex(pi => (pi.productId === it.productId) || (pi.productName === it.productName));
        if (idx !== -1) {
          // Jika ada, cek apakah qty berbeda
          if (Number(newItems[idx].qty) !== Number(it.qty)) {
            newItems[idx] = { ...newItems[idx], qty: it.qty };
            hasChange = true;
          }
        } else {
          // Jika tidak ada di pembelian, tambahkan sebagai item PO baru
          newItems.push({
            productId: it.productId,
            productName: it.productName,
            qty: it.qty,
            unit: it.unit,
            costPerUnit: it.purchaseCost || 0
          });
          hasChange = true;
        }
      });

      // (Opsional) Jika Anda ingin Sinkronisasi "Balik": Menghapus item PO yang tadinya ada di pembelian tapi sekarang sudah dihapus dari PO aslinya.
      // Kita lakukan ini hanya jika item tersebut BUKAN manual (yakni ada productId).
      // Namun untuk keamanan data user, kita lewati dulu bagian "hapus" ini agar tidak membingungkan.

      if (hasChange) {
        const subtotal = newItems.reduce((sum, item) => sum + (item.costPerUnit * (Number(item.qty) || 0)), 0);
        let discountAmount = 0;
        if (p.discountType === 'percent') {
          discountAmount = (subtotal * (Number(p.discountValue) || 0)) / 100;
        } else {
          discountAmount = Number(p.discountValue) || 0;
        }
        const totalCost = subtotal - discountAmount;

        // reconciliation stock (Aman)
        const stockDiffs = {}; // productId -> diff
        pItems.forEach(it => {
          if (it.productId) stockDiffs[it.productId] = (stockDiffs[it.productId] || 0) - (Number(it.qty) || 0);
        });
        newItems.forEach(it => {
          if (it.productId) stockDiffs[it.productId] = (stockDiffs[it.productId] || 0) + (Number(it.qty) || 0);
        });

        for (const pid of Object.keys(stockDiffs)) {
          const diff = stockDiffs[pid];
          if (diff === 0) continue;
          const prod = prods.find(pr => pr.id === pid);
          if (prod) {
            prod.stock = (Number(prod.stock) || 0) + diff;
            await ProductStore.update(pid, { stock: prod.stock });
          }
        }

        const updated = { ...p, invoiceIds: currentIds, items: newItems, totalCost };
        if (updated.invoiceId) delete updated.invoiceId;
        
        await PurchaseStore.update(p.id, updated);
        return updated;
      }
      return p;
    }));

    setInvoices(invs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    setProducts(prods);
    setPurchases(updatedPurchases);
  }

  function getCustomerNames(p) {
    const currentIds = p.invoiceIds || (p.invoiceId ? [p.invoiceId] : []);
    if (currentIds.length === 0) return 'Stok / Umum';
    
    return currentIds.map(id => {
      const inv = invoices.find(i => i.id === id);
      return inv ? inv.customerName : 'Unknown';
    }).join(', ');
  }

  // Get unique individual customers for folders
  const allCustomerFolders = Array.from(new Set(purchases.flatMap(p => {
    const ids = p.invoiceIds || (p.invoiceId ? [p.invoiceId] : []);
    if (ids.length === 0) return ['Stok / Umum'];
    return ids.map(id => {
      const inv = invoices.find(i => i.id === id);
      return inv ? inv.customerName : 'Unknown';
    });
  })));
  
  const filtered = purchases
    .filter(p => {
      const q = search.toLowerCase();
      const matchesSearch = (p.supplier || '').toLowerCase().includes(q) ||
        (p.items || []).some(item => (item.productName || '').toLowerCase().includes(q));
      
      const currentIds = p.invoiceIds || (p.invoiceId ? [p.invoiceId] : []);
      const matchesFolder = selectedFolder === 'All' || currentIds.some(id => {
        const inv = invoices.find(i => i.id === id);
        return inv && inv.customerName === selectedFolder;
      }) || (currentIds.length === 0 && selectedFolder === 'Stok / Umum');
      
      return matchesSearch && matchesFolder;
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const totalSpent = filtered.reduce((sum, p) => sum + (p.totalCost || 0), 0);

  function openAdd() {
    const latestInvoice = invoices.length > 0 ? invoices[0] : null;
    let initialItems = [];
    if (latestInvoice && latestInvoice.items) {
      initialItems = latestInvoice.items.map(item => ({
        productId: item.productId,
        productName: item.productName,
        qty: item.qty,
        costPerUnit: item.purchaseCost || 0,
        unit: item.unit
      }));
    }

    setForm({ 
      supplier: '', 
      invoiceIds: latestInvoice ? [latestInvoice.id] : [],
      items: initialItems, 
      notes: latestInvoice ? `Pembelian untuk PO: ${latestInvoice.invoiceNumber}` : '',
      discountType: 'nominal',
      discountValue: 0
    });
    setEditingId(null);
    setModalOpen(true);
  }

  function openEdit(purchase) {
    setForm({
      supplier: purchase.supplier || '',
      invoiceIds: purchase.invoiceIds || (purchase.invoiceId ? [purchase.invoiceId] : []),
      items: (purchase.items || []).map(item => ({...item})),
      notes: purchase.notes || '',
      discountType: purchase.discountType || 'nominal',
      discountValue: purchase.discountValue || 0
    });
    setEditingId(purchase.id);
    setModalOpen(true);
  }

  function toggleInvoice(invoiceId) {
    setForm(f => {
      let newIds = [...(f.invoiceIds || [])];
      if (newIds.includes(invoiceId)) {
        newIds = newIds.filter(id => id !== invoiceId);
      } else {
        newIds.push(invoiceId);
      }

      // Merge items from all selected invoices
      const combinedMap = {};
      const selectedInvs = invoices.filter(i => newIds.includes(i.id));
      
      selectedInvs.forEach(inv => {
        (inv.items || []).forEach(it => {
          const key = it.productId || it.productName;
          if (combinedMap[key]) {
            combinedMap[key].qty = Number(combinedMap[key].qty) + Number(it.qty);
          } else {
            combinedMap[key] = {
              productId: it.productId,
              productName: it.productName,
              qty: it.qty,
              costPerUnit: it.purchaseCost || 0,
              unit: it.unit
            };
          }
        });
      });

      const newItems = Object.values(combinedMap);
      const notes = newIds.length > 0 
        ? `Pembelian untuk PO: ${selectedInvs.map(i => i.invoiceNumber).join(', ')}` 
        : '';

      return { ...f, invoiceIds: newIds, items: newItems, notes };
    });
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
        item.qty = value;
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

    const subtotal = form.items.reduce((sum, item) => sum + (item.costPerUnit * (Number(item.qty) || 0)), 0);
    let discountAmount = 0;
    if (form.discountType === 'percent') {
      discountAmount = (subtotal * (Number(form.discountValue) || 0)) / 100;
    } else {
      discountAmount = Number(form.discountValue) || 0;
    }
    const totalCost = subtotal - discountAmount;
    
    const itemData = form.items.map(i => ({...i, qty: Number(i.qty) || 0}));
    const stockDiffs = {}; // productId -> totalDiff (new - old)

    if (editingId) {
      const oldP = purchases.find(p => p.id === editingId);
      if (oldP && oldP.items) {
        oldP.items.forEach(it => {
          if (it.productId) stockDiffs[it.productId] = (stockDiffs[it.productId] || 0) - (Number(it.qty) || 0);
        });
      }
      await PurchaseStore.update(editingId, { ...form, items: itemData, totalCost });
    } else {
      await PurchaseStore.create({ ...form, items: itemData, totalCost });
    }

    // Tambah kuantitas baru
    itemData.forEach(it => {
      if (it.productId) stockDiffs[it.productId] = (stockDiffs[it.productId] || 0) + it.qty;
    });

    // Update Stok Final (Sekali jalan per produk)
    for (const pid of Object.keys(stockDiffs)) {
      const diff = stockDiffs[pid];
      if (diff === 0) continue;
      const product = await ProductStore.getById(pid);
      if (product) {
        const updatePayload = { stock: (product.stock || 0) + diff };
        // Update purchaseCost dari nota terakhir (itemData lebih baru daripada oldP)
        const match = itemData.find(it => it.productId === pid);
        if (match) updatePayload.purchaseCost = match.costPerUnit;
        
        await ProductStore.update(pid, updatePayload);
      }
    }

    setModalOpen(false);
    await reload();
  }

  async function confirmDelete() {
    if (!deleteId) return;
    const oldP = purchases.find(p => p.id === deleteId);
    if (oldP && oldP.items) {
      const stockDiffs = {};
      oldP.items.forEach(it => {
        if (it.productId) stockDiffs[it.productId] = (stockDiffs[it.productId] || 0) - (Number(it.qty) || 0);
      });
      for (const pid of Object.keys(stockDiffs)) {
        const product = await ProductStore.getById(pid);
        if (product) {
          await ProductStore.update(pid, { stock: (product.stock || 0) + stockDiffs[pid] });
        }
      }
    }
    await PurchaseStore.delete(deleteId);
    setDeleteId(null);
    await reload();
  }

  return (
    <div className="animate-in">
      <div className="page-header page-header-actions">
        <div>
          <h1>Pembelian</h1>
          <p>Catat pembelian &amp; restock barang</p>
        </div>
        <div className="flex gap-sm">
          <button className="btn btn-secondary" onClick={() => exportPurchasesToExcel(filtered)}>
            <FiDownload /> Export Excel
          </button>
          <button className="btn btn-primary" onClick={openAdd}>
            <FiPlus /> Catat Pembelian
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card orange">
          <div className="stat-card-header">
            <div className="stat-card-icon"><FiShoppingCart /></div>
          </div>
          <div className="stat-card-value">{filtered.length}</div>
          <div className="stat-card-label">Jumlah Transaksi {selectedFolder !== 'All' ? `(${selectedFolder})` : ''}</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-card-header">
            <div className="stat-card-icon">💰</div>
          </div>
          <div className="stat-card-value">{formatCurrency(totalSpent)}</div>
          <div className="stat-card-label">Total Pengeluaran {selectedFolder !== 'All' ? `(${selectedFolder})` : ''}</div>
        </div>
      </div>

      <div className="folders-layout">
        {/* Sidebar Folder */}
        <aside className="folders-sidebar">
          <div className="folders-header">
            <FiFolder /> <span>Folders Pelanggan</span>
          </div>
          <div className="folders-list">
            <button 
              className={`folder-item ${selectedFolder === 'All' ? 'active' : ''}`} 
              onClick={() => setSelectedFolder('All')}
            >
              <FiGrid className="icon" /> <span>Semua Pembelian</span>
            </button>
            <button 
              className={`folder-item ${selectedFolder === 'Stok / Umum' ? 'active' : ''}`} 
              onClick={() => setSelectedFolder('Stok / Umum')}
            >
              <FiFolder className="icon" /> <span>Stok / Umum</span>
            </button>
            {allCustomerFolders.filter(c => c !== 'Stok / Umum').sort().map(c => (
              <button 
                key={c}
                className={`folder-item ${selectedFolder === c ? 'active' : ''}`} 
                onClick={() => setSelectedFolder(c)}
              >
                <FiFolder className="icon" /> <span>{c}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* Content Area */}
        <div className="folders-content">
          <div className="toolbar">
            <div className="search-box">
              <FiSearch className="search-icon" />
              <input name="input_1_2" type="text" placeholder={`Cari di folder ${selectedFolder}...`} value={search} onChange={e => setSearch(e.target.value)} />
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
                        <h3>Belum ada pembelian di folder ini</h3>
                      </div>
                    </td>
                  </tr>
                ) : filtered.map(p => (
                  <tr key={p.id}>
                    <td className="text-muted text-sm">{formatDateShort(p.createdAt)}</td>
                    <td>
                      <strong>{p.supplier || '-'}</strong>
                      {selectedFolder === 'All' && (
                        <div className="text-xs text-muted mt-xs flex-center gap-xs">
                          <FiFolder size={10} /> {getCustomerNames(p)}
                        </div>
                      )}
                    </td>
                    <td>
                      {(p.items || []).map((item, i) => (
                        <div key={i} className="text-sm">{item.productName} × {formatNumber(item.qty)} {item.unit}</div>
                      ))}
                    </td>
                    <td className="text-right" style={{ fontWeight: 600 }}>{formatCurrency(p.totalCost)}</td>
                    <td>
                      <div className="table-actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}><FiEdit2 /></button>
                        <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleDelete(p.id)}><FiTrash2 /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style>{`
        .folders-layout {
          display: grid;
          grid-template-columns: 240px 1fr;
          gap: 20px;
          margin-top: 20px;
        }
        .folders-sidebar {
          background: rgba(255, 255, 255, 0.03);
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.05);
          height: fit-content;
          overflow: hidden;
        }
        .folders-header {
          padding: 16px;
          background: rgba(255, 255, 255, 0.02);
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 600;
          color: #818cf8;
        }
        .folders-list {
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .folder-item {
          width: 100%;
          text-align: left;
          padding: 10px 12px;
          border-radius: 8px;
          border: none;
          background: transparent;
          color: #94a3b8;
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 14px;
        }
        .folder-item:hover {
          background: rgba(255, 255, 255, 0.05);
          color: white;
        }
        .folder-item.active {
          background: rgba(129, 140, 248, 0.15);
          color: #818cf8;
          font-weight: 500;
        }
        .folder-item .icon {
          flex-shrink: 0;
        }
        .folder-item span {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        @media (max-width: 1024px) {
          .folders-layout {
            grid-template-columns: 1fr;
          }
          .folders-sidebar {
            display: flex;
            overflow-x: auto;
            flex-direction: row;
          }
          .folders-list {
            flex-direction: row;
          }
          .folders-header {
            display: none;
          }
        }
      `}</style>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Edit Pembelian" : "Catat Pembelian"} size="lg" persistent={true}>
        <form onSubmit={handleSave}>
          <div className="modal-body" style={{ position: 'relative' }}>
            {openIndex !== null && (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 90 }} onClick={() => setOpenIndex(null)} />
            )}
            
            <div className="form-group mb-md">
              <label className="form-label">Referensi Invoice (PO)</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Dropdown untuk memilih PO (tambah ke list) */}
                <select 
                  className="form-select" 
                  value="" 
                  onChange={e => {
                    if (e.target.value) toggleInvoice(e.target.value);
                  }}
                >
                  <option value="">-- Tambah Referensi PO --</option>
                  {invoices
                    .filter(inv => !(form.invoiceIds || []).includes(inv.id))
                    .map(inv => (
                      <option key={inv.id} value={inv.id}>{inv.invoiceNumber} - {inv.customerName}</option>
                    ))
                  }
                </select>

                {/* List PO yang terpilih (Tags) */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {(form.invoiceIds || []).map(id => {
                    const inv = invoices.find(i => i.id === id);
                    if (!inv) return null;
                    return (
                      <div 
                        key={id} 
                        style={{ 
                          background: 'rgba(129, 140, 248, 0.15)', 
                          color: '#818cf8', 
                          padding: '6px 12px', 
                          borderRadius: 20, 
                          fontSize: 12, 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 8,
                          border: '1px solid rgba(129, 140, 248, 0.2)'
                        }}
                      >
                        <span>{inv.invoiceNumber} - {inv.customerName}</span>
                        <button 
                          type="button" 
                          onClick={() => toggleInvoice(id)}
                          style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', display: 'flex', padding: 2 }}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                  {(form.invoiceIds || []).length === 0 && (
                    <span className="text-muted text-xs">Belum ada PO terpilih (Stok / Umum)</span>
                  )}
                </div>
              </div>
            </div>

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
                                >
                                  {p.name}
                                </div>
                              ))}
                          </div>
                        )}
                      </td>
                      <td>
                        <input name="qty_8" className="form-input" type="text" value={formatNumberInput(item.qty)} onChange={e => {
                          const val = e.target.value.replace(/\./g, '').replace(',', '.');
                          if (/^\d*\.?\d*$/.test(val) || val === '') {
                            updateItem(i, 'qty', val);
                          }
                        }} style={{ width: 80 }} />
                      </td>
                      <td>
                        <input name="costPerUnit_10" className="form-input" type="text" value={formatNumberInput(item.costPerUnit)} onChange={e => {
                          const val = e.target.value.replace(/\./g, '').replace(',', '.');
                          if (/^\d*\.?\d*$/.test(val) || val === '') {
                            updateItem(i, 'costPerUnit', val);
                          }
                        }} style={{ width: 130 }} />
                      </td>
                      <td className="text-right" style={{ fontWeight: 600 }}>{formatCurrency(item.costPerUnit * (Number(item.qty) || 0))}</td>
                      <td>
                        <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => removeItem(i)}><FiTrash2 /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {form.items.length > 0 && (
              <div className="discount-section mt-lg p-md" style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="flex-between mb-sm">
                  <span className="text-sm font-medium">Diskon</span>
                  <div className="flex gap-xs">
                    <button 
                      type="button" 
                      className={`btn btn-xs ${form.discountType === 'nominal' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setForm({...form, discountType: 'nominal'})}
                    >
                      Rp
                    </button>
                    <button 
                      type="button" 
                      className={`btn btn-xs ${form.discountType === 'percent' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setForm({...form, discountType: 'percent'})}
                    >
                      %
                    </button>
                  </div>
                </div>
                <input 
                  className="form-input text-right" 
                  type="text" 
                  placeholder={form.discountType === 'nominal' ? "Nominal Diskon (Rp)" : "Persentase Diskon (%)"}
                  value={formatNumberInput(form.discountValue)} 
                  onChange={e => {
                    const val = e.target.value.replace(/\./g, '').replace(',', '.');
                    if (/^\d*\.?\d*$/.test(val) || val === '') {
                      setForm({...form, discountValue: val});
                    }
                  }} 
                />
                
                <div className="mt-md pt-md" style={{ borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
                  <div className="flex-between text-sm text-muted mb-xs">
                    <span>Subtotal</span>
                    <span>{formatCurrency(form.items.reduce((sum, item) => sum + (item.costPerUnit * (Number(item.qty) || 0)), 0))}</span>
                  </div>
                  <div className="flex-between text-sm text-danger mb-xs">
                    <span>Potongan Diskon</span>
                    <span>-{formatCurrency(form.discountType === 'percent' 
                      ? (form.items.reduce((sum, item) => sum + (item.costPerUnit * (Number(item.qty) || 0)), 0) * (Number(form.discountValue) || 0) / 100)
                      : (Number(form.discountValue) || 0)
                    )}</span>
                  </div>
                  <div className="flex-between text-lg font-bold" style={{ color: '#818cf8' }}>
                    <span>Total Akhir</span>
                    <span>{formatCurrency(
                      form.items.reduce((sum, item) => sum + (item.costPerUnit * (Number(item.qty) || 0)), 0) - 
                      (form.discountType === 'percent' 
                        ? (form.items.reduce((sum, item) => sum + (item.costPerUnit * (Number(item.qty) || 0)), 0) * (Number(form.discountValue) || 0) / 100)
                        : (Number(form.discountValue) || 0))
                    )}</span>
                  </div>
                </div>
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

      <ConfirmModal 
        isOpen={!!deleteId} 
        onClose={() => setDeleteId(null)} 
        onConfirm={confirmDelete}
        title="Hapus Pembelian"
        message="Apakah Anda yakin ingin menghapus catatan pembelian ini? Stok produk akan dikurangi secara otomatis."
      />
    </div>
  );
}
