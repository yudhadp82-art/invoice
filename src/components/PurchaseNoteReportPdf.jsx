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
        position: 'absolute', 
        top: -30000, // Further away
        left: 0, 
        width: '1000px', 
        minHeight: 'auto', // Important: let it expand!
        background: 'white', 
        color: 'black', 
        padding: '40px',
        zIndex: -9999
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
              <th style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'left', width: '35%' }}>Daftar Bahan/Produk</th>
              <th style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'right', width: '20%' }}>Total Penjualan</th>
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
                  <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'right', fontWeight: 'bold' }}>
                    {formatCurrency(inv.grandTotal || Number(inv.total) || 0)}
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="4" style={{ padding: 10, textAlign: 'center', color: '#999' }}>Tidak ada data invoice asal</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* SECTION 2: REKAP KEBUTUHAN GRUP (AGGREGATE) */}
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

      {/* SECTION 3 & 4 REDESIGN: REKAP PEMBELIAN PER SUPPLIER */}
      <div style={{ marginBottom: 40 }}>
        <h4 style={{ margin: '0 0 15px 0', fontSize: 13, borderLeft: '4px solid #10b981', paddingLeft: 10, textTransform: 'uppercase' }}>3. Rekap & Realisasi Pembelian per Supplier</h4>
        
        {supplierGroups.map(([s, items], idx) => {
          const discount = Number(supplierDiscounts[s]) || 0;
          const subtotal = items.reduce((sum, it) => sum + (Number(it.totalCost) || 0), 0);
          const netToPay = Math.max(0, subtotal - discount);
          const suppInfo = (suppliersData || []).find(sd => 
            (sd.name || '').toLowerCase() === s.toLowerCase() || 
            (sd.company || '').toLowerCase() === s.toLowerCase()
          );

          return (
            <div key={idx} style={{ marginBottom: 25, border: '1px solid #eee', borderRadius: 8, overflow: 'hidden' }}>
              {/* Supplier Header Box */}
              <div style={{ background: '#f1f5f9', padding: '10px 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ddd' }}>
                 <div>
                    <span style={{ fontSize: 10, textTransform: 'uppercase', color: '#64748b' }}>Penyedia Barang:</span>
                    <h5 style={{ margin: 0, fontSize: 14, fontWeight: '800', color: '#1e293b' }}>{s.toUpperCase()}</h5>
                 </div>
                 <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 10, textTransform: 'uppercase', color: '#64748b' }}>Info Pembayaran (Bank):</span>
                    <div style={{ fontSize: 11, fontWeight: 'bold', color: '#0f172a' }}>
                      {suppInfo && suppInfo.bankName ? `${suppInfo.bankName} / ${suppInfo.accountName} / ${suppInfo.accountNumber}` : 'Informasi rekening tidak tersedia'}
                    </div>
                 </div>
              </div>

              {/* Items Table for this Supplier */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                <thead>
                  <tr style={{ background: '#fff', borderBottom: '1px solid #eee' }}>
                    <th style={{ padding: '6px 15px', textAlign: 'left', color: '#666' }}>Bahan Baku</th>
                    <th style={{ padding: '6px 15px', textAlign: 'center', color: '#666', width: '15%' }}>Qty</th>
                    <th style={{ padding: '6px 15px', textAlign: 'right', color: '#666', width: '20%' }}>Harga Satuan</th>
                    <th style={{ padding: '6px 15px', textAlign: 'right', color: '#666', width: '20%' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, iIdx) => (
                    <tr key={iIdx} style={{ borderBottom: '1px solid #f8fafc' }}>
                      <td style={{ padding: '6px 15px' }}>{it.isSubItem ? '↳ ' : ''}{it.materialName}</td>
                      <td style={{ padding: '6px 15px', textAlign: 'center', fontWeight: 'bold' }}>{formatNumber(it.qtyNota)} {it.unit}</td>
                      <td style={{ padding: '6px 15px', textAlign: 'right' }}>{formatCurrency(it.pricePerUnit)}</td>
                      <td style={{ padding: '6px 15px', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(it.totalCost)}</td>
                    </tr>
                  ))}
                  {/* Summary Rows for this Supplier */}
                  <tr style={{ background: '#fcfcfc' }}>
                    <td colSpan="3" style={{ padding: '6px 15px', textAlign: 'right', color: '#666' }}>Subtotal:</td>
                    <td style={{ padding: '6px 15px', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(subtotal)}</td>
                  </tr>
                  {discount > 0 && (
                    <tr style={{ background: '#fcfcfc' }}>
                      <td colSpan="3" style={{ padding: '6px 15px', textAlign: 'right', color: '#ef4444' }}>Potongan Diskon:</td>
                      <td style={{ padding: '6px 15px', textAlign: 'right', fontWeight: 'bold', color: '#ef4444' }}>-{formatCurrency(discount)}</td>
                    </tr>
                  )}
                  <tr style={{ background: '#ecfdf5', fontWeight: 'bold' }}>
                    <td colSpan="3" style={{ padding: '10px 15px', textAlign: 'right', fontSize: 11 }}>TOTAL DIBAYAR KE {s.toUpperCase()}:</td>
                    <td style={{ padding: '10px 15px', textAlign: 'right', fontSize: 12, color: '#059669' }}>{formatCurrency(netToPay)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })}

        {/* Global Grand Total Header */}
        <div style={{ marginTop: 30, background: '#1e293b', color: 'white', padding: '15px 20px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>Grand Total Seluruh Nota</h4>
          <span style={{ fontSize: 18, fontWeight: '800', color: '#10b981' }}>{formatCurrency(grandTotalNet)}</span>
        </div>
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
