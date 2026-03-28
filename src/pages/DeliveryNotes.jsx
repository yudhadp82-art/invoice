import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiPlus, FiSearch, FiTruck, FiPrinter, FiEdit2, FiTrash2, FiDownload } from 'react-icons/fi';
import { DeliveryNotes as DNStore } from '../utils/storage';
import { formatCurrency, formatDateShort } from '../utils/formatter';
import { exportDeliveryNotesToExcel } from '../utils/excel';
import ConfirmModal from '../components/ConfirmModal';

export default function DeliveryNotes() {
  const [notes, setNotes] = useState([]);
  const [search, setSearch] = useState('');
  const [printId, setPrintId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    reload();
    window.addEventListener('app-data-mutation', reload);
    return () => window.removeEventListener('app-data-mutation', reload);
  }, []);
  async function reload() { setNotes(await DNStore.getAll()); }

  async function handleDelete(id) {
    setDeleteId(id);
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await DNStore.delete(deleteId);
    setDeleteId(null);
    await reload();
  }

  const filtered = notes
    .filter(n => {
      const q = search.toLowerCase();
      return (n.noteNumber || '').toLowerCase().includes(q) || (n.customerName || '').toLowerCase().includes(q);
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

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
                  <td style={{ border: '1px solid black', padding: '3px', textAlign: 'center' }}>{item.qty}</td>
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
          <p>Kelola surat jalan pengiriman</p>
        </div>
        <div className="flex gap-sm">
          <button className="btn btn-secondary" onClick={() => exportDeliveryNotesToExcel(filtered)}>
            <FiDownload /> Export Excel
          </button>
          <Link to="/delivery-notes/new" className="btn btn-primary">
            <FiPlus /> Buat Surat Jalan
          </Link>
        </div>
      </div>

      <div className="toolbar">
        <div className="search-box">
          <FiSearch className="search-icon" />
          <input name="input_1_2" type="text" placeholder="Cari surat jalan..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="table-container">
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
                  <div className="empty-state">
                    <div className="empty-state-icon"><FiTruck /></div>
                    <h3>Belum ada surat jalan</h3>
                  </div>
                </td>
              </tr>
            ) : filtered.map(n => (
              <tr key={n.id}>
                <td><strong>{n.noteNumber}</strong></td>
                <td>{n.customerName}</td>
                <td className="text-muted">{n.invoiceNumber || '-'}</td>
                <td>{n.driver || '-'}</td>
                <td className="text-muted">{formatDateShort(n.date || n.createdAt)}</td>
                <td>
                  <div className="table-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => setPrintId(n.id)} title="Print"><FiPrinter /></button>
                    <Link to={`/delivery-notes/${n.id}/edit`} className="btn btn-ghost btn-sm"><FiEdit2 /></Link>
                    <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleDelete(n.id)}><FiTrash2 /></button>
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
        title="Hapus Surat Jalan"
        message="Apakah Anda yakin ingin menghapus surat jalan ini?"
      />
    </div>
  );
}
