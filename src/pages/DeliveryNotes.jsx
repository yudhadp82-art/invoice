import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiPlus, FiSearch, FiTruck, FiPrinter, FiEdit2, FiTrash2, FiDownload } from 'react-icons/fi';
import { DeliveryNotes as SJStore, Invoices as InvoiceStore } from '../utils/storage';
import { formatCurrency, formatDateShort, formatNumber } from '../utils/formatter';
import { exportDeliveryNotesToExcel } from '../utils/excel';
import ConfirmModal from '../components/ConfirmModal';

export default function DeliveryNotes() {
  const [notes, setNotes] = useState([]);
  const [search, setSearch] = useState('');
  const [printId, setPrintId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [customerFilter, setCustomerFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    reload();
    window.addEventListener('app-data-mutation', reload);
    return () => window.removeEventListener('app-data-mutation', reload);
  }, []);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const allNotes = await SJStore.getAll();
      const allInvoices = await InvoiceStore.getAll();
      const validInvoiceIds = new Set(allInvoices.map(i => i.id));

      let hasDeleted = false;
      const notesToKeep = [];
      for (const n of allNotes) {
        if (n.invoiceId && !validInvoiceIds.has(n.invoiceId)) {
          await SJStore.delete(n.id);
          hasDeleted = true;
        } else {
          notesToKeep.push(n);
        }
      }

      setNotes(notesToKeep);
    } catch (err) {
      console.error('DeliveryNotes reload error:', err);
      setError(err.message || 'Gagal memuat data surat jalan.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    setDeleteId(id);
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await SJStore.delete(deleteId);
    setDeleteId(null);
    await reload();
  }

  const filtered = notes
    .filter(n => {
      const q = search.toLowerCase();
      const matchesSearch = (n.noteNumber || '').toLowerCase().includes(q) || (n.customerName || '').toLowerCase().includes(q);
      const matchesCustomer = customerFilter === 'all' || n.customerName === customerFilter;
      return matchesSearch && matchesCustomer;
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const uniqueCustomers = [...new Set(notes.map(n => n.customerName))].filter(Boolean).sort();

  const printNote = printId ? notes.find(n => n.id === printId) : null;

  if (printNote) {
    return (
      <div className="print-view" id="print-sj">
        <div className="no-print" style={{ marginBottom: 20 }}>
          <button className="btn btn-primary" onClick={() => window.print()} style={{ marginRight: 10 }}>
            <FiPrinter /> Print / Download PDF
          </button>
          <button className="btn btn-secondary" onClick={() => setPrintId(null)}>Kembali</button>
        </div>
        
        {/* PRINTABLE AREA */}
        <div style={{ background: 'white', color: 'black', padding: '0px 20px', fontFamily: '"Arial", sans-serif', maxWidth: '800px', margin: '0 auto' }}>
          
          {/* Header */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', borderBottom: '2px solid #ccc', paddingBottom: 6, marginBottom: 10 }}>
            <div style={{ position: 'absolute', left: 0, top: 0, fontSize: 10, fontWeight: 'bold' }}>SJ</div>
            {/* Logo KDMP */}
            <div style={{ width: 55, height: 55, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 30, marginRight: 15 }}>
              <img src="/logo-kdmp.png" alt="(Logo)" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            </div>
            
            <div style={{ flex: 1, textAlign: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase' }}>KOPERASI DESA MERAH PUTIH</h2>
              <h3 style={{ margin: 0, fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' }}>SINDANGJAYA KECAMATAN CIPANAS</h3>
              <p style={{ margin: '1px 0', fontSize: 9, fontWeight: 'bold' }}>NOMOR AHU-0025573.AH.01.29.TAHUN 2025</p>
              <p style={{ margin: 0, fontSize: 9, color: '#555' }}>Jl. Pakalongan No. 06 Desa Sindangjaya, Kecamatan Cipanas, Kabupaten Cianjur, Provinsi Jawa Barat, Indonesia, 43253.</p>
            </div>
          </div>

          {/* Title and Info */}
          <div style={{ marginBottom: 10 }}>
            <h3 style={{ margin: '0 0 5px 0', fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase' }}>surat jalan</h3>
            
            <table style={{ fontSize: 11, marginLeft: 20 }}>
              <tbody>
                <tr>
                  <td style={{ width: 80, paddingBottom: 2 }}>No</td>
                  <td style={{ paddingBottom: 2 }}>: {printNote.noteNumber}</td>
                </tr>
                <tr>
                  <td style={{ paddingBottom: 6 }}>Alamat</td>
                  <td style={{ paddingBottom: 6 }}>: {printNote.customerAddress || printNote.customerName}</td>
                </tr>
                  <td>Tanggal</td>
                  <td>: {formatDateShort(printNote.date || printNote.createdAt)}</td>
              </tbody>
            </table>
          </div>
          
          <div style={{ fontSize: 11, marginBottom: 6 }}>
            bersama ini dikirimkan barang-barang sebagai berikut :
          </div>

          {/* Items Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10, fontSize: 11 }}>
            <thead>
              <tr>
                <th rowSpan="2" style={{ border: '1px solid black', padding: '3px', textAlign: 'center', width: '5%' }}>No</th>
                <th rowSpan="2" style={{ border: '1px solid black', padding: '3px', textAlign: 'center', width: '35%' }}>Jenis Sayuran</th>
                <th rowSpan="2" style={{ border: '1px solid black', padding: '3px', textAlign: 'center', width: '10%' }}>Jumlah</th>
                <th rowSpan="2" style={{ border: '1px solid black', padding: '3px', textAlign: 'center', width: '10%' }}>Satuan</th>
                <th style={{ border: '1px solid black', padding: '3px', textAlign: 'center', width: '10%' }}>sayur kurang</th>
                <th style={{ border: '1px solid black', padding: '3px', textAlign: 'center', width: '10%' }}>sayur lebih</th>
                <th rowSpan="2" style={{ border: '1px solid black', padding: '3px', textAlign: 'center', width: '20%' }}>keterangan</th>
              </tr>
              <tr>
                <th style={{ border: '1px solid black', padding: '1px', textAlign: 'center', fontWeight: 'normal' }}>(-)</th>
                <th style={{ border: '1px solid black', padding: '1px', textAlign: 'center', fontWeight: 'normal' }}>(+)</th>
              </tr>
            </thead>
            <tbody>
              {printNote.items.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ border: '1px solid black', padding: '3px', textAlign: 'center' }}>Kosong</td>
                </tr>
              )}
              {printNote.items.map((item, i) => (
                <tr key={i}>
                  <td style={{ border: '1px solid black', padding: '3px', textAlign: 'center' }}>{i + 1}</td>
                  <td style={{ border: '1px solid black', padding: '3px' }}>{item.productName}</td>
                  <td style={{ border: '1px solid black', padding: '3px', textAlign: 'center' }}>{formatNumber(item.qty)}</td>
                  <td style={{ border: '1px solid black', padding: '3px', textAlign: 'center' }}>{item.unit}</td>
                  <td style={{ border: '1px solid black', padding: '3px' }}></td>
                  <td style={{ border: '1px solid black', padding: '3px' }}></td>
                  <td style={{ border: '1px solid black', padding: '3px' }}>{item.notes || ''}</td>
                </tr>
              ))}
              <tr>
                <td colSpan="7" style={{ borderLeft: '1px solid black', borderRight: '1px solid black', borderBottom: '1px solid black', padding: '3px' }}></td>
              </tr>
            </tbody>
          </table>

          {/* Signatures */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 10, padding: '0 40px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ marginBottom: 30 }}>Pengirim</div>
              <div>( Ujang Rukmana )</div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ marginBottom: 30 }}>Penerima</div>
              <div>(&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)</div>
            </div>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="animate-in">
      <div className="page-header page-header-actions">
        <div>
          <h1>Surat Jalan</h1>
          <p>Kelola surat jalan pengiriman barang</p>
        </div>
        <div className="flex gap-sm">
          <button className="btn btn-secondary" onClick={() => exportDeliveryNotesToExcel(filtered)}>
            <FiDownload /> Export Excel
          </button>
          <Link to="/delivery-notes/new" className="btn btn-primary shadow-glow">
            <FiPlus /> Buat Surat Jalan
          </Link>
        </div>
      </div>

      {loading && (
        <div className="card p-xl text-center animate-in">
          <div className="loading-spinner mb-md" style={{ margin: '0 auto' }}></div>
          <p className="text-secondary">Memuat data surat jalan...</p>
        </div>
      )}

      {error && (
        <div className="card p-xl text-center animate-in" style={{ borderColor: 'var(--accent-danger)', background: 'rgba(239, 68, 68, 0.05)' }}>
          <div className="stat-card-icon mb-md" style={{ margin: '0 auto', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)' }}>
            <FiTruck />
          </div>
          <h3 className="text-danger mb-sm">Gagal Memuat Data</h3>
          <p className="text-secondary mb-lg">{error}</p>
          <button className="btn btn-primary" onClick={reload}>Coba Lagi</button>
        </div>
      )}

      {(!loading && !error) && (
        <>
          <div className="stats-grid">
            <div className="stat-card cyan">
              <div className="stat-card-header">
                <div className="stat-card-icon"><FiTruck /></div>
              </div>
              <div className="stat-card-value">{notes.length}</div>
              <div className="stat-card-label">Total Surat Jalan</div>
            </div>
            
            <div className="stat-card purple">
              <div className="stat-card-header">
                <div className="stat-card-icon"><FiPrinter /></div>
              </div>
              <div className="stat-card-value">{filtered.length}</div>
              <div className="stat-card-label">Surat Jalan Terfilter</div>
            </div>
          </div>

          <div className="toolbar bg-glass p-md rounded-lg mb-lg border border-white-05">
            <div className="search-box">
              <FiSearch className="search-icon" />
              <input type="text" placeholder="Cari surat jalan atau customer..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="tabs-container mb-lg border-bottom border-white-05 pb-sm">
            <button 
              className={`btn btn-sm ${customerFilter === 'all' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setCustomerFilter('all')}
            >
              Semua Customer
            </button>
            {uniqueCustomers.map(customer => {
              const isSelected = customerFilter === customer;
              return (
                <button 
                  key={customer}
                  className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setCustomerFilter(customer)}
                >
                  {customer}
                </button>
              );
            })}
          </div>

          <div className="table-container shadow-lg">
            <table className="table">
              <thead>
                <tr>
                  <th>No. Surat Jalan</th>
                  <th>Customer</th>
                  <th>Ref. Invoice</th>
                  <th>Driver</th>
                  <th>Tanggal</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="card p-xl text-center border-dashed" style={{ background: 'transparent' }}>
                        <div className="stat-card-icon mb-md" style={{ margin: '0 auto', background: 'var(--bg-glass)', color: 'var(--text-muted)' }}>
                          <FiTruck />
                        </div>
                        <h3 className="text-secondary">Belum ada surat jalan</h3>
                        <p className="text-muted">Klik tombol "Buat Surat Jalan" untuk mencatat pengiriman baru.</p>
                      </div>
                    </td>
                  </tr>
                ) : filtered.map(n => (
                  <tr key={n.id} className="hover-bright transition-fast">
                    <td>
                      <div className="font-bold text-primary">{n.noteNumber}</div>
                    </td>
                    <td>
                      <div className="text-primary">{n.customerName}</div>
                    </td>
                    <td>
                      <span className="badge badge-info">{n.invoiceNumber || '-'}</span>
                    </td>
                    <td className="text-secondary">{n.driver || '-'}</td>
                    <td className="text-muted">{formatDateShort(n.date || n.createdAt)}</td>
                    <td className="text-right">
                      <div className="table-actions justify-end">
                        <button className="btn btn-ghost btn-sm text-info" onClick={() => setPrintId(n.id)} title="Cetak"><FiPrinter /></button>
                        <Link to={`/delivery-notes/${n.id}/edit`} className="btn btn-ghost btn-sm text-primary" title="Edit"><FiEdit2 /></Link>
                        <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleDelete(n.id)} title="Hapus"><FiTrash2 /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      
      <ConfirmModal 
        isOpen={!!deleteId} 
        onClose={() => setDeleteId(null)} 
        onConfirm={confirmDelete}
        title="Hapus Surat Jalan"
        message="Apakah Anda yakin ingin menghapus surat jalan ini?"
      />
    </div>
  );
}
