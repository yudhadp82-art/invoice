import { useState, useEffect } from 'react';
import { FiPlus, FiSearch, FiTrash2, FiEdit2, FiTool, FiFileText } from 'react-icons/fi';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import { ProductionNeeds as NeedStore, Invoices, SupportingMaterialItems } from '../utils/storage';
import { formatCurrency, formatDateShort } from '../utils/formatter';

const CATEGORY_OPTIONS = [
  'Alat Produksi',
  'Bahan Bakar',
  'Kemasan',
  'Perawatan Mesin',
  'Utilitas (Listrik/Air)',
  'Lainnya',
];

const emptyForm = {
  date: new Date().toISOString().slice(0, 10),
  itemName: '',
  category: 'Lainnya',
  qty: '',
  unit: '',
  pricePerUnit: '',
  totalCost: 0,
  notes: '',
  invoiceIds: [], // Link ke satu atau beberapa invoice
};

export default function ProductionNeedsPage() {
  const [items, setItems] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [invoiceSearch, setInvoiceSearch] = useState('');

  useEffect(() => {
    reload();
    window.addEventListener('app-data-mutation', reload);
    return () => window.removeEventListener('app-data-mutation', reload);
  }, []);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const [data, invs] = await Promise.all([
        NeedStore.getAll(),
        Invoices.getAll()
      ]);
      setItems(data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
      setInvoices(invs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    } catch (err) {
      console.error('ProductionNeeds reload error:', err);
      setError('Gagal memuat data kebutuhan produksi. Silakan periksa koneksi internet Anda.');
    } finally {
      setLoading(false);
    }
  }

  function calcTotal(f = form) {
    const qty = parseFloat(String(f.qty).replace(/\./g, '').replace(',', '.')) || 0;
    const price = parseFloat(String(f.pricePerUnit).replace(/\./g, '').replace(',', '.')) || 0;
    return qty * price;
  }

  function handleFieldChange(field, value) {
    setForm(prev => {
      const updated = { ...prev, [field]: value };
      updated.totalCost = calcTotal(updated);
      return updated;
    });
  }

  function openAdd() {
    setForm({ ...emptyForm, date: new Date().toISOString().slice(0, 10) });
    setEditingId(null);
    setModalOpen(true);
    setInvoiceSearch('');
  }

  function openEdit(item) {
    setForm({
      date: item.date || new Date().toISOString().slice(0, 10),
      itemName: item.itemName || '',
      category: item.category || 'Lainnya',
      qty: item.qty || '',
      unit: item.unit || '',
      pricePerUnit: item.pricePerUnit || '',
      totalCost: item.totalCost || 0,
      notes: item.notes || '',
      invoiceIds: item.invoiceIds || [],
    });
    setEditingId(item.id);
    setModalOpen(true);
    setInvoiceSearch('');
  }

  async function handleSave(e) {
    e.preventDefault();
    const qty = parseFloat(String(form.qty).replace(/\./g, '').replace(',', '.')) || 0;
    const pricePerUnit = parseFloat(String(form.pricePerUnit).replace(/\./g, '').replace(',', '.')) || 0;
    const payload = { ...form, qty, pricePerUnit, totalCost: qty * pricePerUnit };

    // Stock Sync
    const allMats = await SupportingMaterialItems.getAll();
    const match = allMats.find(m => (m.name || '').toLowerCase() === (form.itemName || '').toLowerCase());
    
    if (editingId) {
      const oldItem = items.find(it => it.id === editingId);
      if (oldItem && match) {
        const oldQty = Number(oldItem.qty) || 0;
        const diff = oldQty - qty; // restore old, subtract new
        if (diff !== 0) {
          await SupportingMaterialItems.update(match.id, { stock: (match.stock || 0) + diff });
        }
      }
      await NeedStore.update(editingId, payload);
    } else {
      if (match) {
        await SupportingMaterialItems.update(match.id, { stock: (match.stock || 0) - qty });
      }
      await NeedStore.create(payload);
    }
    setModalOpen(false);
    await reload();
  }

  async function confirmDelete() {
    const id = deleteId;
    if (!id) return;
    
    // Restore Stock
    const oldItem = items.find(it => it.id === id);
    if (oldItem) {
      const allMats = await SupportingMaterialItems.getAll();
      const match = allMats.find(m => (m.name || '').toLowerCase() === (oldItem.itemName || '').toLowerCase());
      if (match) {
        await SupportingMaterialItems.update(match.id, { stock: (match.stock || 0) + (Number(oldItem.qty) || 0) });
      }
    }

    await NeedStore.delete(id);
    setDeleteId(null);
    await reload();
  }

  const filtered = items.filter(it => {
    const q = search.toLowerCase();
    const matchSearch = (it.itemName || '').toLowerCase().includes(q) || (it.notes || '').toLowerCase().includes(q);
    const matchCat = filterCategory ? it.category === filterCategory : true;
    return matchSearch && matchCat;
  });

  const totalAll = items.reduce((s, it) => s + (it.totalCost || 0), 0);
  const totalMonth = items
    .filter(it => {
      const d = new Date(it.createdAt);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((s, it) => s + (it.totalCost || 0), 0);

  const CATEGORY_COLORS = {
    'Alat Produksi': '#38bdf8',
    'Bahan Bakar': '#fb923c',
    'Kemasan': '#a78bfa',
    'Perawatan Mesin': '#facc15',
    'Utilitas (Listrik/Air)': '#4ade80',
    'Lainnya': '#94a3b8',
  };

  return (
    <div className="animate-in">
      <div className="page-header page-header-actions">
        <div>
          <h1>Kebutuhan Produksi</h1>
          <p>Operasional produksi & operasional pabrik</p>
        </div>
        <button className="btn btn-primary shadow-glow" onClick={openAdd}>
          <FiPlus /> Tambah Kebutuhan
        </button>
      </div>

      {loading && (
        <div className="card p-xl text-center animate-in">
          <div className="loading-spinner mb-md" style={{ margin: '0 auto' }}></div>
          <p className="text-secondary">Memuat data kebutuhan produksi...</p>
        </div>
      )}

      {error && (
        <div className="card p-xl text-center animate-in" style={{ borderColor: 'var(--accent-danger)', background: 'rgba(239, 68, 68, 0.05)' }}>
          <div className="stat-card-icon mb-md" style={{ margin: '0 auto', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)' }}>
            <FiTool />
          </div>
          <h3 className="text-danger mb-sm">Gagal Memuat Data</h3>
          <p className="text-secondary mb-lg">{error}</p>
          <button className="btn btn-primary" onClick={reload}>Coba Lagi</button>
        </div>
      )}

      {(!loading && !error) && (
        <>
          <div className="stats-grid">
            <div className="stat-card blue">
              <div className="stat-card-header">
                <div className="stat-card-icon"><FiTool /></div>
                <div className="stat-card-trend">Total</div>
              </div>
              <div className="stat-card-value">{items.length}</div>
              <div className="stat-card-label">Jumlah Transaksi</div>
            </div>
            
            <div className="stat-card orange">
              <div className="stat-card-header">
                <div className="stat-card-icon">⚡</div>
                <div className="stat-card-trend up">Bulan Ini</div>
              </div>
              <div className="stat-card-value font-mono">{formatCurrency(totalMonth)}</div>
              <div className="stat-card-label">Biaya Produksi Terkini</div>
            </div>

            <div className="stat-card purple">
              <div className="stat-card-header">
                <div className="stat-card-icon">💰</div>
              </div>
              <div className="stat-card-value font-mono">{formatCurrency(totalAll)}</div>
              <div className="stat-card-label">Akumulasi Pengeluaran</div>
            </div>
          </div>

          <div className="toolbar bg-glass p-md rounded-lg mb-lg border border-white-05">
            <div className="search-box">
              <FiSearch className="search-icon" />
              <input type="text" placeholder="Cari item atau catatan..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select
              className="form-select bg-glass"
              style={{ width: 220 }}
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
            >
              <option value="">Semua Kategori</option>
              {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="table-container shadow-lg">
            <table className="table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Nama Item</th>
                  <th>Kategori</th>
                  <th>Qty</th>
                  <th className="text-right">Harga/Unit</th>
                  <th className="text-right">Total</th>
                  <th>HPP Ref</th>
                  <th>Catatan</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <div className="card p-xl text-center border-dashed" style={{ background: 'transparent' }}>
                        <div className="stat-card-icon mb-md" style={{ margin: '0 auto', background: 'var(--bg-glass)', color: 'var(--text-muted)' }}>
                          <FiTool />
                        </div>
                        <h3 className="text-secondary">Belum ada data kebutuhan</h3>
                        <p className="text-muted">Klik tombol "Tambah Kebutuhan" untuk mencatat operasional baru.</p>
                      </div>
                    </td>
                  </tr>
                ) : filtered.map(it => (
                  <tr key={it.id} className="hover-bright transition-fast">
                    <td className="text-muted">{formatDateShort(it.date || it.createdAt)}</td>
                    <td>
                      <div className="font-bold text-primary">{it.itemName}</div>
                    </td>
                    <td>
                      <span className="badge" style={{ 
                        background: `${(CATEGORY_COLORS[it.category] || '#94a3b8')}22`, 
                        color: CATEGORY_COLORS[it.category] || '#94a3b8' 
                      }}>
                        {it.category}
                      </span>
                    </td>
                    <td className="text-secondary">{it.qty} {it.unit}</td>
                    <td className="text-right text-muted">{formatCurrency(it.pricePerUnit)}</td>
                    <td className="text-right font-bold text-success font-mono">
                      {formatCurrency(it.totalCost)}
                    </td>
                    <td>
                      <div className="flex flex-col gap-xs">
                        {(it.invoiceIds || []).map(id => {
                          const inv = invoices.find(i => i.id === id);
                          return inv ? (
                            <span key={id} className="badge badge-info" style={{ fontSize: 10 }}>
                              {inv.invoiceNumber}
                            </span>
                          ) : null;
                        })}
                        {(!it.invoiceIds || it.invoiceIds.length === 0) && <span className="text-muted text-xs">-</span>}
                      </div>
                    </td>
                    <td className="text-muted text-sm" style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {it.notes || '-'}
                    </td>
                    <td className="text-right">
                      <div className="table-actions justify-end">
                        <button className="btn btn-ghost btn-sm text-primary" onClick={() => openEdit(it)} title="Edit"><FiEdit2 /></button>
                        <button className="btn btn-ghost btn-sm text-danger" onClick={() => setDeleteId(it.id)} title="Hapus"><FiTrash2 /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Kebutuhan Produksi' : 'Tambah Kebutuhan'} size="md" closeOnOverlay={false} closeOnEsc={true}>
        <form onSubmit={handleSave} className="p-lg">
          <div className="grid gap-lg">
            <div className="form-group mb-0">
              <label className="form-label text-xs uppercase tracking-widest opacity-60">Tanggal</label>
              <input type="date" className="form-input bg-glass" value={form.date} onChange={e => handleFieldChange('date', e.target.value)} required />
            </div>

            <div className="grid grid-2 gap-md">
              <div className="form-group mb-0">
                <label className="form-label text-xs uppercase tracking-widest opacity-60">Nama Item</label>
                <input className="form-input bg-glass" value={form.itemName} onChange={e => handleFieldChange('itemName', e.target.value)} placeholder="Nama operasional" required />
              </div>
              <div className="form-group mb-0">
                <label className="form-label text-xs uppercase tracking-widest opacity-60">Kategori</label>
                <select className="form-select bg-glass" value={form.category} onChange={e => handleFieldChange('category', e.target.value)}>
                  {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-2 gap-md">
              <div className="form-group mb-0">
                <label className="form-label text-xs uppercase tracking-widest opacity-60">Qty</label>
                <input className="form-input bg-glass" value={form.qty} onChange={e => handleFieldChange('qty', e.target.value)} placeholder="0" required />
              </div>
              <div className="form-group mb-0">
                <label className="form-label text-xs uppercase tracking-widest opacity-60">Satuan</label>
                <input className="form-input bg-glass" value={form.unit} onChange={e => handleFieldChange('unit', e.target.value)} placeholder="pcs, ltr, etc..." />
              </div>
            </div>

            <div className="form-group mb-0">
              <label className="form-label text-xs uppercase tracking-widest opacity-60">Harga Satuan (Rp)</label>
              <input className="form-input bg-glass font-bold" value={form.pricePerUnit} onChange={e => handleFieldChange('pricePerUnit', e.target.value)} placeholder="0" required />
              
              <div className="mt-md p-md bg-glass rounded-lg border border-white-05 flex-between">
                <span className="text-secondary text-sm">Estimasi Total</span>
                <span className="text-xl font-black text-success">{formatCurrency(calcTotal())}</span>
              </div>
            </div>

            <div className="form-group mb-0">
              <label className="form-label text-xs uppercase tracking-widest opacity-60">Catatan</label>
              <textarea className="form-input bg-glass" value={form.notes} onChange={e => handleFieldChange('notes', e.target.value)} placeholder="Detail tambahan..." rows={2} />
            </div>

            <div className="p-md rounded-xl border border-white-05 bg-glass">
              <label className="form-label text-xs uppercase tracking-widest opacity-60 mb-md flex items-center gap-xs">
                <FiFileText /> Hubungkan ke HPP Invoice
              </label>
              <div className="relative mb-md">
                <FiSearch className="absolute left-md top-half -translate-y-half opacity-40 text-xs" />
                <input 
                  className="form-input bg-white-05 p-sm pl-xl text-xs" 
                  placeholder="Cari no. invoice / customer..." 
                  value={invoiceSearch}
                  onChange={e => setInvoiceSearch(e.target.value)}
                />
              </div>
              <div className="grid gap-xs max-h-40 overflow-y-auto pr-xs">
                {invoices
                  .filter(inv => {
                    const q = invoiceSearch.toLowerCase();
                    return inv.invoiceNumber?.toLowerCase().includes(q) || inv.customerName?.toLowerCase().includes(q);
                  })
                  .map(inv => {
                    const isSelected = (form.invoiceIds || []).includes(inv.id);
                    return (
                      <label key={inv.id} className={`flex items-center gap-md p-sm rounded-lg cursor-pointer transition-fast ${isSelected ? 'bg-indigo-500-10 border-indigo-500-20' : 'hover-bg-white-05'}`} style={{ border: '1px solid transparent' }}>
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          className="w-4 h-4 accent-indigo-500"
                          onChange={() => {
                            const current = [...(form.invoiceIds || [])];
                            if (isSelected) {
                              handleFieldChange('invoiceIds', current.filter(id => id !== inv.id));
                            } else {
                              handleFieldChange('invoiceIds', [...current, inv.id]);
                            }
                          }}
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-primary truncate">{inv.invoiceNumber}</div>
                          <div className="text-xxs text-muted truncate">{inv.customerName}</div>
                        </div>
                      </label>
                    );
                  })}
              </div>
              <div className="mt-md text-xxs text-muted italic">
                {form.invoiceIds?.length || 0} invoice terpilih. Biaya ini akan didistribusikan ke laporan margin terkait.
              </div>
            </div>
          </div>

          <div className="modal-footer mt-xl pt-lg border-top border-white-05">
            <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>Batal</button>
            <button type="submit" className="btn btn-primary shadow-glow px-xl">Simpan Kebutuhan</button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        title="Hapus Kebutuhan Produksi"
        message="Data ini akan dihapus permanen dan stok material terkait akan dikembalikan (jika ada)."
      />
    </div>
  );
}
