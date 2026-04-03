import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiPlus, FiSearch, FiFileText, FiCalendar, FiArrowRight, FiTrash2, FiEdit2 } from 'react-icons/fi';
import { PurchaseNotes as Store, Invoices, SupportingMaterialItems as MasterItems } from '../utils/storage';
import { formatCurrency, formatDateShort } from '../utils/formatter';
import ConfirmModal from '../components/ConfirmModal';

export default function PurchaseNotes() {
  const [notes, setNotes] = useState([]);
  const [pendingInvoices, setPendingInvoices] = useState([]);
  const [sppgRecap, setSppgRecap] = useState([]);
  const [showRecap, setShowRecap] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    reload();
    window.addEventListener('app-data-mutation', reload);
    return () => window.removeEventListener('app-data-mutation', reload);
  }, []);

  async function reload() {
    const [allNotes, allInvoices] = await Promise.all([
      Store.getAll(),
      Invoices.getAll()
    ]);
    
    setNotes(allNotes.sort((a, b) => {
      const db = b.date || b.createdAt || 0;
      const da = a.date || a.createdAt || 0;
      const tb = db.seconds ? db.seconds * 1000 : new Date(db).getTime();
      const ta = da.seconds ? da.seconds * 1000 : new Date(da).getTime();
      return tb - ta;
    }));
    
    // Filter pending invoices (those with materials that aren't linked to a Purchase Note)
    const linkedInvoiceIds = allNotes.map(n => n.invoiceId).filter(id => !!id);
    const pending = allInvoices.filter(inv => {
      if (linkedInvoiceIds.includes(inv.id)) return false;
      const hasMaterials = (inv.items || []).some(it => it.type === 'material');
      return hasMaterials;
    });
    
    setPendingInvoices(pending.sort((a, b) => {
      const db = b.date || b.createdAt || 0;
      const da = a.date || a.createdAt || 0;
      const tb = db.seconds ? db.seconds * 1000 : new Date(db).getTime();
      const ta = da.seconds ? da.seconds * 1000 : new Date(da).getTime();
      return tb - ta;
    }));

    // Generate SPPG Recap (SPPG 2 & 5)
    const sppgInvoices = pending.filter(inv => 
      (inv.customerName || '').toUpperCase().includes('SPPG SINDANGJAYA 2') || 
      (inv.customerName || '').toUpperCase().includes('SPPG SINDANGJAYA 5')
    );

    const aggregation = {};
    sppgInvoices.forEach(inv => {
      (inv.items || []).forEach(it => {
        if (it.type !== 'material') return;
        const key = (it.productName || '').trim();
        if (!aggregation[key]) {
          aggregation[key] = { name: key, totalQty: 0, unit: it.unit || 'kg' };
        }
        aggregation[key].totalQty += (Number(it.qty) || 0);
      });
    });
    setSppgRecap(Object.values(aggregation).sort((a, b) => a.name.localeCompare(b.name)));
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await Store.delete(deleteId);
    setDeleteId(null);
    await reload();
  }

  const [isSyncing, setIsSyncing] = useState(false);

  async function handleSyncInvoices() {
    if (!window.confirm('Sinkronkan Master Bahan dari seluruh data Invoice? Ini akan menambahkan item baru ke Master Bahan secara otomatis.')) return;
    setIsSyncing(true);
    try {
      const [allInvs, allMaster] = await Promise.all([
        Invoices.getAll(),
        MasterItems.getAll()
      ]);

      let addedCount = 0;
      for (const inv of allInvs) {
        for (const item of (inv.items || [])) {
          // Identify material by type or by being in the "Bahan" category names
          const isMaterial = item.type === 'material';
          if (!isMaterial) continue;

          const exists = allMaster.some(m => 
            (item.productId && m.id === item.productId) || 
            m.name.toLowerCase() === item.productName.toLowerCase()
          );

          if (!exists) {
            const newItem = {
              name: item.productName,
              unit: item.unit || 'kg',
              defaultPrice: Number(item.unitPrice) || 0,
              stock: 0
            };
            await MasterItems.create(newItem);
            allMaster.push(newItem); // avoid duplicates in same sync
            addedCount++;
          }
        }
      }
      alert(`Berhasil sinkronisasi. ${addedCount} item bahan baru ditambahkan ke Master Bahan.`);
      await reload();
    } catch (err) {
      console.error(err);
      alert('Gagal melakukan sinkronisasi.');
    } finally {
      setIsSyncing(false);
    }
  }

  const filtered = notes.filter(n => 
    (n.supplierName || '').toLowerCase().includes(search.toLowerCase()) ||
    (n.notes || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-in">
      <div className="page-header page-header-actions">
        <div>
          <h1>Pembelian Bahan</h1>
          <p>Daftar nota pembelian bahan baku dan split S5/S3</p>
        </div>
        <div className="flex gap-sm">
          <button className="btn btn-secondary" onClick={handleSyncInvoices} disabled={isSyncing}>
            <FiPlus /> {isSyncing ? 'Sinkron Selesai...' : 'Sinkronisasi Bahan'}
          </button>
          <Link to="/purchase-notes/new" className="btn btn-primary">
            <FiPlus /> Buat Nota Baru
          </Link>
        </div>
      </div>

      {sppgRecap.length > 0 && (
        <div className="card mb-lg animate-in" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(168,85,247,0.08) 100%)', border: '1px solid rgba(99,102,241,0.2)' }}>
          <div className="card-header flex-between" style={{ padding: '12px 20px' }}>
            <h3 className="card-title text-primary flex-center gap-sm" style={{ fontSize: 16 }}>
              <FiFileText /> Rekap Kebutuhan Bahan (SPPG 2 & 5)
            </h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowRecap(!showRecap)}>
              {showRecap ? 'Sembunyikan' : 'Tampilkan'}
            </button>
          </div>
          {showRecap && (
            <div style={{ padding: '0 20px 20px' }}>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-sm">
                {sppgRecap.map((item, idx) => (
                  <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 15px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="text-xs text-muted mb-xs uppercase tracking-wider font-semibold">{item.name}</div>
                    <div className="flex-between align-baseline">
                      <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-primary-hover)' }}>{item.totalQty.toLocaleString('id-ID')}</span>
                      <span className="text-xs text-muted">{item.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted mt-md">
                * Data ini diakumulasi dari seluruh Invoice SPPG 2 & 5 yang belum dibuatkan Nota Pembelian.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="toolbar">
        <div className="search-box">
          <FiSearch className="search-icon" />
          <input 
            type="text" 
            placeholder="Cari supplier atau catatan..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
        </div>
      </div>

      {pendingInvoices.length > 0 && (
        <div className="card mb-lg animate-in" style={{ borderColor: 'var(--primary)', borderLeftWidth: 4 }}>
          <div className="card-header flex-between">
            <h3 className="card-title text-primary"><FiFileText /> Invoice Menunggu Nota Pembelian ({pendingInvoices.length})</h3>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>No. Invoice</th>
                  <th>Customer</th>
                  <th>Materials</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pendingInvoices.map(inv => (
                  <tr key={inv.id}>
                    <td className="text-muted">{formatDateShort(inv.date)}</td>
                    <td><strong>{inv.invoiceNumber}</strong></td>
                    <td>{inv.customerName}</td>
                    <td>
                      <span className="badge badge-primary">
                        {(inv.items || []).filter(it => it.type === 'material').length} Bahan
                      </span>
                    </td>
                    <td className="text-right">
                      <Link 
                        to="/purchase-notes/new" 
                        state={{ invoiceId: inv.id }} 
                        className="btn btn-primary btn-sm"
                      >
                        <FiPlus /> Buat Nota Pembelian
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Supplier</th>
              <th>Items</th>
              <th className="text-right">Total Biaya</th>
              <th>Status Split</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="empty-state">
                    <div className="empty-state-icon"><FiFileText /></div>
                    <h3>Belum ada nota pembelian</h3>
                    <p>Klik "Buat Nota Baru" untuk mencatat pembelian pertama Anda.</p>
                  </div>
                </td>
              </tr>
            ) : filtered.map(note => (
              <tr key={note.id}>
                <td className="text-muted"><FiCalendar style={{marginRight: 4}} /> {formatDateShort(note.date)}</td>
                <td><strong>{note.supplierName || 'General Supplier'}</strong></td>
                <td>
                  <div className="text-sm">
                    {(note.items || []).length} Item Bahan
                  </div>
                </td>
                <td className="text-right font-medium">{formatCurrency(note.grandTotal)}</td>
                <td>
                  <span className="badge badge-cyan">Split S5 & S3</span>
                </td>
                <td>
                  <div className="table-actions">
                    <Link to={`/purchase-notes/${note.id}/edit`} className="btn btn-ghost btn-sm">
                      <FiEdit2 />
                    </Link>
                    <button className="btn btn-ghost btn-sm text-danger" onClick={() => setDeleteId(note.id)}>
                      <FiTrash2 />
                    </button>
                    <Link to={`/purchase-notes/${note.id}/edit`} className="btn btn-primary btn-sm btn-icon-only" style={{marginLeft: 8}}>
                      <FiArrowRight />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmModal 
        isOpen={!!deleteId} 
        onClose={() => setDeleteId(null)} 
        onConfirm={confirmDelete}
        title="Hapus Nota Pembelian"
        message="Menghapus nota ini tidak akan mengoreksi stok secara otomatis. Apakah Anda yakin?"
      />
    </div>
  );
}
