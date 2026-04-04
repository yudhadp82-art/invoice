import React from 'react';
import { formatCurrency, formatDateShort, formatNumber } from '../utils/formatter';

export default function PurchaseNoteReportPdf({ 
  groupName, 
  date, 
  groupRecap, 
  purchaseItems, 
  supplierName,
  supplierDiscounts = {}, 
  invoicesList, 
  suppliersData = [], 
  forPrint = false 
}) {
  if (!groupName) return null;

  const containerStyle = forPrint 
    ? { width: '800px', margin: '0 auto', background: 'white', color: 'black', padding: '20px' }
    : { 
        position: 'fixed', 
        top: 0,
        left: 0, 
        width: '800px', 
        minHeight: 'min-content', 
        background: 'white', 
        color: 'black', 
        padding: '0', 
        zIndex: -9999,
        opacity: 0, // Hidden but in the render tree for full-height calculation!
        pointerEvents: 'none',
        overflow: 'visible'
      };
 
  // Aggregate items by Supplier for grouping (Case-insensitive)
  const supplierMap = {};
  const displayNames = {}; // Normalized Key -> Original Display Name for rendering

  (purchaseItems || []).forEach(it => {
    const rawSup = (it.supplier || supplierName || 'Penyedia Barang').trim();
    const key = rawSup.toUpperCase();
    
    if (!supplierMap[key]) {
      supplierMap[key] = [];
      displayNames[key] = rawSup; 
    }
    supplierMap[key].push(it);
  });

  // Sort by name and convert back to entries for the component to map over
  const supplierGroups = Object.keys(supplierMap).sort().map(key => [displayNames[key], supplierMap[key]]);
  
  const totalItemsCost = (purchaseItems || []).reduce((n, it) => n + (Number(it.totalCost) || 0), 0);
  const totalDiscounts = Object.values(supplierDiscounts).reduce((s, d) => s + (Number(d) || 0), 0);
  const grandTotalNet = Math.max(0, totalItemsCost - totalDiscounts);

  return (
    <div id="purchase-note-report-render" style={containerStyle}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '3px solid #1e293b', paddingBottom: 15, marginBottom: 30 }}>
        <div style={{ width: 70, height: 70, marginRight: 25 }}>
          <img src="/logo-kdmp.png" alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 'bold', color: '#1e293b', textTransform: 'uppercase' }}>KOPERASI DESA MERAH PUTIH SINDANGJAYA</h2>
          <h3 style={{ margin: '5px 0 0 0', fontSize: 15, color: '#475569' }}>LAPORAN REKAP PEMBELIAN BAHAN BAKU</h3>
          <p style={{ margin: '8px 0 0 0', fontSize: 13, fontWeight: '600' }}>
            GRUP: <span style={{ color: '#ef4444' }}>{groupName.toUpperCase()}</span> | TANGGAL: {formatDateShort(date)}
          </p>
        </div>
      </div>

      {/* SECTION 1: DAFTAR INVOICE ASAL (DETAIL) */}
      <div style={{ marginBottom: 40 }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: 14, borderLeft: '5px solid #ef4444', paddingLeft: 12, textTransform: 'uppercase', color: '#1e293b' }}>1. Rincian Invoice per Customer</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f1f5f9' }}>
              <th style={{ border: '1px solid #cbd5e1', padding: '10px', textAlign: 'left', width: '20%' }}>No. Invoice</th>
              <th style={{ border: '1px solid #cbd5e1', padding: '10px', textAlign: 'left', width: '25%' }}>Nama Pelanggan</th>
              <th style={{ border: '1px solid #cbd5e1', padding: '10px', textAlign: 'left', width: '35%' }}>Daftar Bahan/Produk</th>
              <th style={{ border: '1px solid #cbd5e1', padding: '10px', textAlign: 'right', width: '20%' }}>Total Penjualan</th>
            </tr>
          </thead>
          <tbody>
            {invoicesList && invoicesList.length > 0 ? (
              invoicesList.map((inv, idx) => (
                <tr key={idx}>
                  <td style={{ border: '1px solid #cbd5e1', padding: '10px', fontWeight: 'bold' }}>{inv.invoiceNumber}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '10px' }}>{inv.customerName}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '10px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {(inv.items || []).map((it, i) => (
                        <span key={i} style={{ background: '#f8fafc', padding: '3px 8px', borderRadius: 4, fontSize: 11, border: '1px solid #e2e8f0' }}>
                          {it.productName} ({formatNumber(it.qty)})
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>
                    {formatCurrency(inv.grandTotal || Number(inv.total) || 0)}
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="4" style={{ padding: 15, textAlign: 'center', color: '#94a3b8' }}>Tidak ada data invoice asal</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* SECTION 2: REKAP KEBUTUHAN GRUP (AGGREGATE) */}
      <div style={{ marginBottom: 40 }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: 14, borderLeft: '5px solid #3b82f6', paddingLeft: 12, textTransform: 'uppercase', color: '#1e293b' }}>2. Rekap Kebutuhan Gabungan (Agregat)</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#eff6ff' }}>
              <th style={{ border: '1px solid #bfdbfe', padding: '10px', textAlign: 'left' }}>Nama Bahan Baku</th>
              <th style={{ border: '1px solid #bfdbfe', padding: '10px', textAlign: 'center', width: '20%' }}>Total Kebutuhan</th>
              <th style={{ border: '1px solid #bfdbfe', padding: '10px', textAlign: 'center', width: '15%' }}>Satuan</th>
            </tr>
          </thead>
          <tbody>
            {(groupRecap || []).map((it, idx) => (
              <tr key={idx}>
                <td style={{ border: '1px solid #dbeafe', padding: '10px', fontWeight: '600' }}>{it.name}</td>
                <td style={{ border: '1px solid #dbeafe', padding: '10px', textAlign: 'center', fontWeight: 'bold', fontSize: 13 }}>{formatNumber(it.totalQty)}</td>
                <td style={{ border: '1px solid #dbeafe', padding: '10px', textAlign: 'center' }}>{it.unit || 'kg'}</td>
              </tr>
            ))}
            {(!groupRecap || groupRecap.length === 0) && (
              <tr><td colSpan="3" style={{ padding: 15, textAlign: 'center', color: '#94a3b8' }}>Tidak ada data rekap grup</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* SECTION 3 & 4 REDESIGN: REKAP PEMBELIAN PER SUPPLIER */}
      <div style={{ marginBottom: 50 }}>
        <h4 style={{ margin: '0 0 20px 0', fontSize: 14, borderLeft: '5px solid #10b981', paddingLeft: 12, textTransform: 'uppercase', color: '#1e293b' }}>3. Rekap & Realisasi Pembelian per Supplier</h4>
        
        {supplierGroups.map(([s, items], idx) => {
          const discount = Number(supplierDiscounts[s]) || 0;
          const subtotal = items.reduce((sum, it) => sum + (Number(it.totalCost) || 0), 0);
          const netToPay = Math.max(0, subtotal - discount);
          const suppInfo = (suppliersData || []).find(sd => 
            (sd.name || '').toLowerCase() === s.toLowerCase() || 
            (sd.company || '').toLowerCase() === s.toLowerCase()
          );

          return (
            <div key={idx} style={{ marginBottom: 40, border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
              {/* Supplier Header Box */}
              <div style={{ background: '#f8fafc', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e2e8f0' }}>
                 <div>
                    <span style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: '600' }}>Penyedia Barang:</span>
                    <h5 style={{ margin: '2px 0 0 0', fontSize: 16, fontWeight: '800', color: '#0f172a' }}>{s.toUpperCase()}</h5>
                 </div>
                 <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: '600' }}>Info Pembayaran (Bank):</span>
                    <div style={{ fontSize: 12, fontWeight: '700', color: '#1e293b', marginTop: 2 }}>
                      {suppInfo && suppInfo.bankName ? `${suppInfo.bankName} / ${suppInfo.accountName} / ${suppInfo.accountNumber}` : 'Informasi rekening belum diatur'}
                    </div>
                 </div>
              </div>

              {/* Items Table for this Supplier */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#fff', borderBottom: '1.5px solid #f1f5f9' }}>
                    <th style={{ padding: '10px 20px', textAlign: 'left', color: '#475569' }}>Bahan Baku / Material</th>
                    <th style={{ padding: '10px 20px', textAlign: 'center', color: '#475569', width: '15%' }}>Qty</th>
                    <th style={{ padding: '10px 20px', textAlign: 'right', color: '#475569', width: '20%' }}>Harga Satuan</th>
                    <th style={{ padding: '10px 20px', textAlign: 'right', color: '#475569', width: '20%' }}>Total Biaya</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, iIdx) => (
                    <tr key={iIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 20px', color: '#1e293b' }}>{it.isSubItem ? '↳ ' : ''}{it.materialName}</td>
                      <td style={{ padding: '10px 20px', textAlign: 'center', fontWeight: 'bold' }}>{formatNumber(it.qtyNota)} {it.unit}</td>
                      <td style={{ padding: '10px 20px', textAlign: 'right' }}>{formatCurrency(it.pricePerUnit)}</td>
                      <td style={{ padding: '10px 20px', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(it.totalCost)}</td>
                    </tr>
                  ))}
                  {/* Summary Rows for this Supplier */}
                  <tr style={{ background: '#fafafa' }}>
                    <td colSpan="3" style={{ padding: '8px 20px', textAlign: 'right', color: '#64748b', fontSize: 11 }}>Subtotal:</td>
                    <td style={{ padding: '8px 20px', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(subtotal)}</td>
                  </tr>
                  {discount > 0 && (
                    <tr style={{ background: '#fafafa' }}>
                      <td colSpan="3" style={{ padding: '8px 20px', textAlign: 'right', color: '#ef4444', fontSize: 11 }}>Potongan Diskon:</td>
                      <td style={{ padding: '8px 20px', textAlign: 'right', fontWeight: 'bold', color: '#ef4444' }}>-{formatCurrency(discount)}</td>
                    </tr>
                  )}
                  <tr style={{ background: '#f0fdf4', borderTop: '2px solid #bbf7d0' }}>
                    <td colSpan="3" style={{ padding: '12px 20px', textAlign: 'right', fontSize: 13, fontWeight: '700', color: '#166534' }}>TOTAL NET KE {s.toUpperCase()}:</td>
                    <td style={{ padding: '12px 20px', textAlign: 'right', fontSize: 14, fontWeight: '900', color: '#15803d' }}>{formatCurrency(netToPay)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })}

        {/* Global Grand Total Area */}
        <div style={{ marginTop: 40, background: '#0f172a', color: 'white', padding: '20px 25px', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
          <div>
            <h4 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: 1.5, fontSize: 14, opacity: 0.8 }}>Grand Total Keseluruhan</h4>
            <div style={{ fontSize: 11, marginTop: 4, opacity: 0.6 }}>(Total bersih setelah seluruh potongan diskon)</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 24, fontWeight: '900', color: '#10b981' }}>{formatCurrency(grandTotalNet)}</span>
          </div>
        </div>
      </div>
      
      {/* Signatures */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 40, fontSize: 12, padding: '0 40px' }}>
        <div style={{ textAlign: 'center', width: 220 }}>
          <p style={{ marginBottom: 80 }}>Diperiksa Oleh,</p>
          <div style={{ borderBottom: '2px solid #1e293b', width: '100%', marginBottom: 5 }}></div>
          <p style={{ fontWeight: 'bold', margin: 0 }}>Bagian Operasional</p>
        </div>
        <div style={{ textAlign: 'center', width: 220 }}>
          <p style={{ marginBottom: 80 }}>Dibuat Oleh,</p>
          <div style={{ borderBottom: '2px solid #1e293b', width: '100%', marginBottom: 5 }}></div>
          <p style={{ fontWeight: 'bold', margin: 0 }}>Admin Pembelian</p>
        </div>
      </div>
      
      <div style={{ marginTop: 60, fontSize: 10, color: '#94a3b8', textAlign: 'center', fontStyle: 'italic', borderTop: '1px dashed #e2e8f0', paddingTop: 20 }}>
        Dokumen ini dihasilkan secara otomatis oleh Sistem Invoicing & Purchase Desa Merah Putih
      </div>
    </div>
  );
}
