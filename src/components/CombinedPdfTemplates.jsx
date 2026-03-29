import React from 'react';
import { formatCurrency, formatDateShort, formatNumber } from '../utils/formatter';

export default function CombinedPdfTemplates({ inv, note }) {
  if (!inv || !note) return null;

  return (
    <div id="combined-pdf-render" style={{ position: 'absolute', top: -20000, left: -20000, width: '794px', background: 'white', color: 'black' }}>
      {/* ==================== PAGE 1: INVOICE ==================== */}
      <div id="pdf-invoice-page" style={{ padding: '20px 40px', height: '1123px', boxSizing: 'border-box', fontFamily: '"Arial", sans-serif', position: 'relative' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', borderBottom: '2px solid #ccc', paddingBottom: 6, marginBottom: 10 }}>
          <div style={{ width: 55, height: 55, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: 15 }}>
            <img src="/logo-kdmp.png" alt="(Logo)" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          </div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <h2 style={{ margin: 0, fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase' }}>KOPERASI DESA MERAH PUTIH</h2>
            <h3 style={{ margin: 0, fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' }}>SINDANGJAYA KECAMATAN CIPANAS</h3>
            <p style={{ margin: '1px 0', fontSize: 8, fontWeight: 'bold' }}>NOMOR AHU-0025573.AH.01.29.TAHUN 2025</p>
            <p style={{ margin: 0, fontSize: 8, color: '#555', lineHeight: 1.1 }}>Jl. Pakalongan No. 06 Desa Sindangjaya, Kecamatan Cipanas, Kabupaten Cianjur, Provinsi Jawa Barat, 43253.</p>
          </div>
        </div>

        {/* Invoice Info */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 10 }}>
          <table>
            <tbody>
              <tr><td style={{ width: 60, paddingBottom: 2 }}>Invoice</td><td>: {inv.invoiceNumber}</td></tr>
              <tr><td>Tanggal</td><td>: {formatDateShort(inv.date || inv.createdAt)}</td></tr>
            </tbody>
          </table>
          <div style={{ background: '#e5e7eb', padding: '2px 30px', fontWeight: 'bold', fontSize: 11, textTransform: 'lowercase' }}>invoice</div>
        </div>

        {/* Customer Info */}
        <div style={{ marginBottom: 10, fontSize: 10 }}>
          <div>Pelanggan</div>
          <table style={{ marginTop: 2 }}>
            <tbody>
              <tr><td style={{ width: 50, paddingBottom: 2 }}>Nama</td><td>: {inv.customerName}</td></tr>
              <tr><td>Alamat</td><td>: {inv.customerAddress || '-'}</td></tr>
            </tbody>
          </table>
        </div>

        {/* Items Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 5, fontSize: 10 }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid black', padding: '3px', background: '#f5f5f5',  width: '5%' }}>No.</th>
              <th style={{ border: '1px solid black', padding: '3px', background: '#f5f5f5', width: '35%' }}>item</th>
              <th style={{ border: '1px solid black', padding: '3px', background: '#f5f5f5', width: '10%' }}>qty</th>
              <th style={{ border: '1px solid black', padding: '3px', background: '#f5f5f5', width: '10%' }}>unit</th>
              <th style={{ border: '1px solid black', padding: '3px', background: '#f5f5f5', width: '20%' }}>Harga Satuan</th>
              <th style={{ border: '1px solid black', padding: '3px', background: '#f5f5f5', width: '20%' }}>Jumlah</th>
            </tr>
          </thead>
          <tbody>
            {(inv.items || []).map((item, i) => (
              <tr key={i}>
                <td style={{ border: '1px solid black', padding: '3px', textAlign: 'center' }}>{i + 1}</td>
                <td style={{ border: '1px solid black', padding: '3px' }}>{item.productName}</td>
                <td style={{ border: '1px solid black', padding: '3px', textAlign: 'center' }}>{formatNumber(item.qty)}</td>
                <td style={{ border: '1px solid black', padding: '3px', textAlign: 'center' }}>{item.unit}</td>
                <td style={{ border: '1px solid black', padding: '3px', textAlign: 'right' }}>{formatCurrency(item.unitPrice)}</td>
                <td style={{ border: '1px solid black', padding: '3px', textAlign: 'right' }}>{formatCurrency(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Total */}
        <div style={{ display: 'flex', width: '100%', fontSize: 10, marginBottom: 15 }}>
          <div style={{ flex: 1, textAlign: 'center' }}>total</div>
          <div style={{ width: '20%', border: '1px solid black', padding: '4px', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(inv.grandTotal)}</div>
        </div>

        {/* Signatures */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, marginTop: 10 }}>
          <div>
            <table>
              <tbody>
                <tr><td style={{ paddingBottom: 4 }}>NAMA BANK</td><td>: BRI</td></tr>
                <tr><td style={{ paddingBottom: 4 }}>NOMOR AKUN</td><td style={{ fontWeight: 'bold' }}>: 3453 - 01 - 000012 - 56 - 6</td></tr>
                <tr><td>ATAS NAMA</td><td>: KDMP SINDANGJAYA</td></tr>
              </tbody>
            </table>
          </div>
          <div style={{ width: '40%', textAlign: 'center' }}>
            <div style={{ marginBottom: 30 }}>Mengetahui</div>
            <div style={{ fontWeight: 'bold' }}>Ujang Rukmana</div>
            <div>Ketua KDMP</div>
          </div>
        </div>
      </div>

      {/* ==================== PAGE 2: DELIVERY NOTE ==================== */}
      <div id="pdf-note-page" style={{ padding: '20px 40px', height: '1123px', boxSizing: 'border-box', fontFamily: '"Arial", sans-serif', position: 'relative' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', borderBottom: '2px solid #ccc', paddingBottom: 6, marginBottom: 10 }}>
          <div style={{ position: 'absolute', left: 0, top: 0, fontSize: 10, fontWeight: 'bold' }}>SJ</div>
          <div style={{ width: 55, height: 55, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 30, marginRight: 15 }}>
            <img src="/logo-kdmp.png" alt="(Logo)" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          </div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <h2 style={{ margin: 0, fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase' }}>KOPERASI DESA MERAH PUTIH</h2>
            <h3 style={{ margin: 0, fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' }}>SINDANGJAYA KECAMATAN CIPANAS</h3>
          </div>
        </div>

        <div style={{ marginBottom: 10 }}>
          <h4 style={{ margin: '0 0 5px 0', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' }}>surat jalan</h4>
          <table style={{ fontSize: 10, marginLeft: 15 }}>
            <tbody>
              <tr><td style={{ width: 60 }}>No</td><td>: {note.noteNumber}</td></tr>
              <tr><td>Alamat</td><td>: {note.customerAddress || note.customerName}</td></tr>
              <tr><td>Tanggal</td><td>: {formatDateShort(note.date || note.createdAt)}</td></tr>
            </tbody>
          </table>
        </div>

        {/* Item Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10, fontSize: 10 }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid black', padding: '3px', width: '5%' }}>No</th>
              <th style={{ border: '1px solid black', padding: '3px', width: '40%' }}>Jenis Sayuran</th>
              <th style={{ border: '1px solid black', padding: '3px', width: '10%' }}>Jumlah</th>
              <th style={{ border: '1px solid black', padding: '3px', width: '10%' }}>Satuan</th>
              <th style={{ border: '1px solid black', padding: '3px', width: '25%' }}>Keterangan</th>
            </tr>
          </thead>
          <tbody>
            {(note.items || []).map((item, i) => (
              <tr key={i}>
                <td style={{ border: '1px solid black', padding: '3px', textAlign: 'center' }}>{i + 1}</td>
                <td style={{ border: '1px solid black', padding: '3px' }}>{item.productName}</td>
                <td style={{ border: '1px solid black', padding: '3px', textAlign: 'center' }}>{formatNumber(item.qty)}</td>
                <td style={{ border: '1px solid black', padding: '3px', textAlign: 'center' }}>{item.unit}</td>
                <td style={{ border: '1px solid black', padding: '3px' }}>{item.notes || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Signatures */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginTop: 20 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: 30 }}>Pengirim</div>
            <div>( Ujang Rukmana )</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: 30 }}>Penerima</div>
            <div>(&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)</div>
          </div>
        </div>
      </div>
    </div>
  );
}
