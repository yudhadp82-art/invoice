import React from 'react';
import { formatCurrency, formatDateShort, formatNumber } from '../utils/formatter';

export default function PurchaseNoteReportPdf({ groupName, date, groupRecap, purchaseItems, invoicesList, forPrint = false }) {
  if (!groupName) return null;

  const containerStyle = forPrint 
    ? { width: '800px', margin: '0 auto', background: 'white', color: 'black', padding: '20px' }
    : { position: 'absolute', top: -20000, left: -20000, width: '1000px', background: 'white', color: 'black', padding: '40px' };

  return (
    <div id="purchase-note-report-render" style={containerStyle}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '2px solid #333', paddingBottom: 10, marginBottom: 20 }}>
        <div style={{ width: 60, height: 60, marginRight: 20 }}>
          <img src="/logo-kdmp.png" alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 'bold', textTransform: 'uppercase' }}>KOPERASI DESA MERAH PUTIH SINDANGJAYA</h2>
          <h3 style={{ margin: '5px 0 0 0', fontSize: 14, color: '#444' }}>LAPORAN REKAP PEMBELIAN BAHAN BAKU</h3>
          <p style={{ margin: '5px 0 0 0', fontSize: 12, fontWeight: '600' }}>
            GRUP: <span style={{ color: '#ef4444' }}>{groupName.toUpperCase()}</span> | TANGGAL: {formatDateShort(date)}
          </p>
        </div>
      </div>

      {/* SECTION 1: DAFTAR INVOICE ASAL (DETAIL) */}
      <div style={{ marginBottom: 30 }}>
        <h4 style={{ margin: '0 0 10px 0', fontSize: 13, borderLeft: '4px solid #ef4444', paddingLeft: 10, textTransform: 'uppercase' }}>1. Rincian Invoice per Customer</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'left', width: '20%' }}>No. Invoice</th>
              <th style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'left', width: '25%' }}>Nama Pelanggan</th>
              <th style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'left', width: '40%' }}>Daftar Bahan/Produk</th>
              <th style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center', width: '15%' }}>Total Qty</th>
            </tr>
          </thead>
          <tbody>
            {invoicesList && invoicesList.length > 0 ? (
              invoicesList.map((inv, idx) => (
                <tr key={idx}>
                  <td style={{ border: '1px solid #ddd', padding: '6px', fontWeight: 'bold' }}>{inv.invoiceNumber}</td>
                  <td style={{ border: '1px solid #ddd', padding: '6px' }}>{inv.customerName}</td>
                  <td style={{ border: '1px solid #ddd', padding: '6px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {(inv.items || []).map((it, i) => (
                        <span key={i} style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, fontSize: 10 }}>
                          {it.productName} ({formatNumber(it.qty)})
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>
                    {formatNumber((inv.items || []).reduce((s, it) => s + (Number(it.qty) || 0), 0))}
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="4" style={{ padding: 10, textAlign: 'center', color: '#999' }}>Tidak ada data invoice asal</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* SECTION 2: REKAP KEBUTUHAN GRUP (DC REKAP) */}
      <div style={{ marginBottom: 30 }}>
        <h4 style={{ margin: '0 0 10px 0', fontSize: 13, borderLeft: '4px solid #3b82f6', paddingLeft: 10, textTransform: 'uppercase' }}>2. Rekap Kebutuhan Gabungan (Agregat)</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ background: '#eff6ff' }}>
              <th style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'left' }}>Nama Bahan Baku</th>
              <th style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center', width: '20%' }}>Total Kebutuhan</th>
              <th style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center', width: '15%' }}>Satuan</th>
            </tr>
          </thead>
          <tbody>
            {(groupRecap || []).map((it, idx) => (
              <tr key={idx}>
                <td style={{ border: '1px solid #ddd', padding: '6px', fontWeight: '600' }}>{it.name}</td>
                <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>{formatNumber(it.totalQty)}</td>
                <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center' }}>{it.unit || 'kg'}</td>
              </tr>
            ))}
            {(!groupRecap || groupRecap.length === 0) && (
              <tr><td colSpan="3" style={{ padding: 10, textAlign: 'center', color: '#999' }}>Tidak ada data rekap grup</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* SECTION 3: REALISASI PEMBELIAN */}
      <div style={{ marginBottom: 40 }}>
        <h4 style={{ margin: '0 0 10px 0', fontSize: 13, borderLeft: '4px solid #10b981', paddingLeft: 10, textTransform: 'uppercase' }}>3. Realisasi Pembelian Nota Ini</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ background: '#ecfdf5' }}>
              <th style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'left' }}>Bahan Baku</th>
              <th style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'left' }}>Supplier</th>
              <th style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center', width: '15%' }}>Qty Nota</th>
              <th style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'right', width: '20%' }}>Total Biaya</th>
            </tr>
          </thead>
          <tbody>
            {(purchaseItems || []).map((it, idx) => (
              <tr key={idx}>
                <td style={{ border: '1px solid #ddd', padding: '6px' }}>
                  {it.isSubItem ? '↳ ' : ''}{it.materialName}
                </td>
                <td style={{ border: '1px solid #ddd', padding: '6px' }}>{it.supplier || '-'}</td>
                <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>{formatNumber(it.qtyNota)} {it.unit}</td>
                <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'right' }}>{formatCurrency(it.totalCost)}</td>
              </tr>
            ))}
            <tr style={{ background: '#f8fafc', fontWeight: 'bold' }}>
              <td colSpan="3" style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>GRAND TOTAL PEMBELIAN:</td>
              <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', color: '#059669', fontSize: 13 }}>
                {formatCurrency((purchaseItems || []).reduce((n, it) => n + (Number(it.totalCost) || 0), 0))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Signatures */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 10 }}>
        <div style={{ textAlign: 'center', width: 200 }}>
          <p style={{ marginBottom: 60 }}>Diperiksa Oleh,</p>
          <p style={{ fontWeight: 'bold', borderBottom: '1px solid #000', display: 'inline-block', minWidth: 120 }}>&nbsp;</p>
          <p>Bagian Operasional</p>
        </div>
        <div style={{ textAlign: 'center', width: 200 }}>
          <p style={{ marginBottom: 60 }}>Dibuat Oleh,</p>
          <p style={{ fontWeight: 'bold', borderBottom: '1px solid #000', display: 'inline-block', minWidth: 120 }}>&nbsp;</p>
          <p>Admin Pembelian</p>
        </div>
      </div>
      
      <div style={{ marginTop: 30, fontSize: 9, color: '#999', textAlign: 'center', fontStyle: 'italic' }}>
        Laporan ini digenerate secara otomatis oleh Sistem Koperasi Desa Merah Putih
      </div>
    </div>
  );
}
