import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiPlus, FiSearch, FiFileText, FiCalendar, FiArrowRight, FiTrash2, FiEdit2 } from 'react-icons/fi';
import { PurchaseNotes as Store } from '../utils/storage';
import { formatCurrency, formatDateShort } from '../utils/formatter';
import ConfirmModal from '../components/ConfirmModal';

export default function PurchaseNotes() {
  const [notes, setNotes] = useState([]);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    reload();
    window.addEventListener('app-data-mutation', reload);
    return () => window.removeEventListener('app-data-mutation', reload);
  }, []);

  async function reload() {
    const all = await Store.getAll();
    setNotes(all.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)));
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await Store.delete(deleteId);
    setDeleteId(null);
    await reload();
  }

  const filtered = notes.filter(n => 
    (n.supplierName || '').toLowerCase().includes(search.toLowerCase()) ||
    (n.notes || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-in">
      <div className="page-header page-header-actions">
        <div>
          <h1>Nota Pembelian</h1>
          <p>Daftar nota pembelian bahan baku dan split S5/S3</p>
        </div>
        <Link to="/purchase-notes/new" className="btn btn-primary">
          <FiPlus /> Buat Nota Baru
        </Link>
      </div>

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
