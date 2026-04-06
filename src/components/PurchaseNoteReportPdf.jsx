import React from 'react';
import { formatCurrency, formatDateShort, formatNumber } from '../utils/formatter';

export default function PurchaseNoteReportPdf({ 
  groupName, 
  date, 
  groupRecap, 
  purchaseItems, 
  supplierName,
  supplierDiscounts = {}, 
  invoicesList = [],
  suppliersData = [], 
  additionalCosts = {}, 
  forPrint = false 
}) {
  if (!groupName) return null;

  const containerStyle = {
    width: '210mm',
    minHeight: '100%',
    background: 'white',
    color: 'black',
    padding: '15mm',
    margin: '0',
    boxSizing: 'border-box',
    fontFamily: 'Arial, sans-serif',
    fontSize: '11px',
    maxWidth: '100%',
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
  
  // Debug logging
  console.log('PDF Render Debug:', {
    purchaseItemsCount: purchaseItems?.length || 0,
    supplierDiscounts,
    additionalCosts,
    sampleItem: purchaseItems?.[0],
    totalItemsCost: (purchaseItems || []).reduce((n, it) => n + (Number(it.totalCost) || 0), 0)
  });

  const totalItemsCost = (purchaseItems || []).reduce((n, it) => n + (Number(it.totalCost) || 0), 0);
  const totalDiscounts = Object.values(supplierDiscounts || {}).reduce((s, d) => s + (Number(d) || 0), 0);
  const totalAdditionalCosts = Object.values(additionalCosts || {}).reduce((s, c) => s + (Number(c) || 0), 0);

  // Calculate grand total by summing supplier net totals (after discounts) + additional costs
  // This ensures the grand total matches the sum of all "TOTAL BAYAR KE [SUPPLIER]" values
  let totalFromSuppliers = 0;
  supplierGroups.forEach(([s, items]) => {
    const discount = Number(supplierDiscounts[s]) || 0;
    const subtotal = items.reduce((sum, it) => sum + (Number(it.totalCost) || 0), 0);
    const netToPay = Math.max(0, subtotal - discount);
    totalFromSuppliers += netToPay;
  });

  const grandTotalNet = totalFromSuppliers + totalAdditionalCosts;

  console.log('Calculated totals:', {
    totalItemsCost,
    totalDiscounts,
    totalAdditionalCosts,
    totalFromSuppliers,
    grandTotalNet
  });

  return (
    <div id="purchase-note-report-render" className="print-only" style={containerStyle}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', borderBottom: '2px solid #1e293b', paddingBottom: 10, marginBottom: 20, gap: 8 }}>
        <div style={{ width: 55, height: 55, marginRight: 15, flexShrink: 0 }}>
          <img src="/logo-kdmp.png" alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        </div>
        <div style={{ flex: '1 1 220px', textAlign: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 13, fontWeight: 'bold', color: '#1e293b', textTransform: 'uppercase' }}>KOPERASI DESA MERAH PUTIH SINDANGJAYA</h2>
          <h3 style={{ margin: '3px 0 0 0', fontSize: 10, color: '#475569' }}>LAPORAN REKAP PEMBELIAN BAHAN BAKU</h3>
          <p style={{ margin: '4px 0 0 0', fontSize: 9, fontWeight: '600' }}>
            GRUP: <span style={{ color: '#ef4444' }}>{groupName.toUpperCase()}</span> | TANGGAL: {formatDateShort(date)}
          </p>
        </div>
      </div>

      {/* SECTION 1: REKAP KEBUTUHAN GRUP (AGGREGATE) */}
      <div className="print-section">
        <h4 style={{ margin: '0 0 8px 0', fontSize: 10, borderLeft: '4px solid #3b82f6', paddingLeft: 8, textTransform: 'uppercase', color: '#1e293b' }}>1. Rekap Kebutuhan Gabungan (Agregat)</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', borderSpacing: 0, fontSize: '9px' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '6px 8px', background: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '8px', fontWeight: 'bold' }}>Nama Bahan Baku</th>
              <th style={{ textAlign: 'center', width: '20%', padding: '6px 8px', background: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '8px', fontWeight: 'bold' }}>Total Kebutuhan</th>
              <th style={{ textAlign: 'center', width: '15%', padding: '6px 8px', background: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '8px', fontWeight: 'bold' }}>Satuan</th>
            </tr>
          </thead>
          <tbody>
            {(groupRecap || []).map((it, idx) => (
              <tr key={idx}>
                <td style={{ fontWeight: '600', padding: '5px 6px', border: '1px solid #e2e8f0', fontSize: '8px' }}>{it.name}</td>
                <td style={{ textAlign: 'center', fontWeight: 'bold', padding: '5px 6px', border: '1px solid #e2e8f0', fontSize: '8px' }}>{formatNumber(it.totalQty)}</td>
                <td style={{ textAlign: 'center', padding: '5px 6px', border: '1px solid #e2e8f0', fontSize: '8px' }}>{it.unit || 'kg'}</td>
              </tr>
            ))}
            {(!groupRecap || groupRecap.length === 0) && (
              <tr><td colSpan="3" style={{ padding: 8, textAlign: 'center', color: '#94a3b8', border: '1px solid #e2e8f0', fontSize: '8px' }}>Tidak ada data rekap grup</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* SECTION 2: REKAP & REALISASI PEMBELIAN PER SUPPLIER */}
      <h4 style={{ margin: '16px 0 12px 0', fontSize: 10, borderLeft: '4px solid #10b981', paddingLeft: 8, textTransform: 'uppercase', color: '#1e293b' }}>2. Rekap & Realisasi Pembelian per Supplier</h4>
      
      {supplierGroups.map(([s, items], idx) => {
        const discount = Number(supplierDiscounts[s]) || 0;
        const subtotal = items.reduce((sum, it) => sum + (Number(it.totalCost) || 0), 0);
        const netToPay = Math.max(0, subtotal - discount);
        const suppInfo = (suppliersData || []).find(sd => 
          (sd.name || '').toLowerCase() === s.toLowerCase() || 
          (sd.company || '').toLowerCase() === s.toLowerCase()
        );

        return (
          <div key={idx} className="print-section" style={{ border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'visible', marginBottom: 20, marginTop: 16, pageBreakInside: 'avoid', pageBreakBefore: idx > 0 ? 'auto' : 'auto', width: '100%', minHeight: 'auto' }}>
            {/* Supplier Header Box */}
            <div style={{ background: '#f8fafc', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', gap: 10 }}>
               <div>
                  <span style={{ fontSize: '7px', textTransform: 'uppercase', color: '#64748b', fontWeight: '600' }}>Penyedia Barang:</span>
                  <h5 style={{ margin: '1px 0 0 0', fontSize: '9px', fontWeight: '700', color: '#0f172a' }}>{s.toUpperCase()}</h5>
               </div>
               <div style={{ textAlign: 'right', fontSize: '7px' }}>
                  <div style={{ textTransform: 'uppercase', color: '#64748b', fontWeight: '600', marginBottom: '2px' }}>Info Pembayaran (Bank):</div>
                  <div style={{ fontSize: '7px', fontWeight: '600', color: '#1e293b' }}>
                    {suppInfo && suppInfo.bankName ? `${suppInfo.bankName} / ${suppInfo.accountName}` : 'Informasi rekening belum diatur'}
                  </div>
                  {suppInfo && suppInfo.accountNumber && (
                    <div style={{ fontSize: '7px', fontWeight: '600', color: '#1e293b' }}>No: {suppInfo.accountNumber}</div>
                  )}
               </div>
            </div>

            {/* Items Table for this Supplier */}
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', color: '#475569', padding: '5px 6px', background: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '7px', fontWeight: 'bold' }}>Bahan Baku / Material</th>
                  <th style={{ textAlign: 'center', color: '#475569', width: '15%', padding: '5px 6px', background: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '7px', fontWeight: 'bold' }}>Qty</th>
                  <th style={{ textAlign: 'right', color: '#475569', width: '18%', padding: '5px 6px', background: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '7px', fontWeight: 'bold' }}>Harga Satuan</th>
                  <th style={{ textAlign: 'right', color: '#475569', width: '18%', padding: '5px 6px', background: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '7px', fontWeight: 'bold' }}>Total Biaya</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, iIdx) => (
                  <tr key={iIdx}>
                    <td style={{ color: '#1e293b', wordBreak: 'break-word', padding: '4px 6px', border: '1px solid #e2e8f0', fontSize: '7px' }}>{it.isSubItem ? '↳ ' : ''}{it.materialName}</td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', padding: '4px 6px', border: '1px solid #e2e8f0', fontSize: '7px' }}>{formatNumber(it.qtyNota)} {it.unit}</td>
                    <td style={{ textAlign: 'right', padding: '4px 6px', border: '1px solid #e2e8f0', fontSize: '7px' }}>{formatCurrency(it.pricePerUnit)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', padding: '4px 6px', border: '1px solid #e2e8f0', fontSize: '7px' }}>{formatCurrency(it.totalCost)}</td>
                  </tr>
                ))}
                {/* Summary Rows for this Supplier */}
                <tr style={{ background: '#fafafa' }}>
                  <td colSpan="3" style={{ textAlign: 'right', color: '#64748b', fontSize: '7px', fontWeight: '600', padding: '4px 6px', border: '1px solid #e2e8f0' }}>Subtotal:</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold', padding: '4px 6px', border: '1px solid #e2e8f0', fontSize: '7px' }}>{formatCurrency(subtotal)}</td>
                </tr>
                {discount > 0 && (
                  <tr style={{ background: '#fafafa' }}>
                    <td colSpan="3" style={{ textAlign: 'right', color: '#ef4444', fontSize: '7px', fontWeight: '600', padding: '4px 6px', border: '1px solid #e2e8f0' }}>Potongan Diskon:</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#ef4444', padding: '4px 6px', border: '1px solid #e2e8f0', fontSize: '7px' }}>-{formatCurrency(discount)}</td>
                  </tr>
                )}
                <tr style={{ background: '#f0fdf4' }}>
                  <td colSpan="3" style={{ textAlign: 'right', fontSize: '8px', fontWeight: '700', color: '#166534', padding: '5px 6px', border: '1px solid #e2e8f0' }}>TOTAL BAYAR KE {s.toUpperCase()}:</td>
                  <td style={{ textAlign: 'right', fontSize: '9px', fontWeight: '800', color: '#15803d', padding: '5px 6px', border: '1px solid #e2e8f0' }}>{formatCurrency(netToPay)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}

      {/* SECTION 3: RELATED INVOICES */}
      {(invoicesList || []).length > 0 && (
        <div className="print-section">
          <h4 style={{ margin: '16px 0 12px 0', fontSize: 10, borderLeft: '4px solid #f59e0b', paddingLeft: 8, textTransform: 'uppercase', color: '#1e293b' }}>3. Invoice Terhubung</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto', borderSpacing: 0, fontSize: '8px' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '6px 8px', background: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '7px', fontWeight: 'bold' }}>No Invoice</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', background: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '7px', fontWeight: 'bold' }}>Tanggal</th>
                <th style={{ textAlign: 'center', padding: '6px 8px', background: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '7px', fontWeight: 'bold' }}>Jumlah Item</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', background: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '7px', fontWeight: 'bold' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {invoicesList.map((inv, idx) => (
                <tr key={idx}>
                  <td style={{ padding: '5px 6px', border: '1px solid #e2e8f0', fontSize: '7px', fontWeight: '600' }}>{inv.number || inv.id}</td>
                  <td style={{ padding: '5px 6px', border: '1px solid #e2e8f0', fontSize: '7px' }}>{formatDateShort(inv.date)}</td>
                  <td style={{ textAlign: 'center', padding: '5px 6px', border: '1px solid #e2e8f0', fontSize: '7px' }}>{(inv.items || []).length}</td>
                  <td style={{ textAlign: 'right', padding: '5px 6px', border: '1px solid #e2e8f0', fontSize: '7px', fontWeight: '600' }}>
                    {formatCurrency((inv.items || []).reduce((sum, it) => sum + (Number(it.qty || 0) * Number(it.price || 0)), 0))}
                  </td>
                </tr>
              ))}
              {(!invoicesList || invoicesList.length === 0) && (
                <tr>
                  <td colSpan="4" style={{ padding: 8, textAlign: 'center', color: '#94a3b8', border: '1px solid #e2e8f0', fontSize: '7px' }}>Tidak ada invoice terhubung</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* SECTION 4: ADDITIONAL COSTS */}
      {totalAdditionalCosts > 0 && (
        <div className="print-section">
          <h4 style={{ margin: '16px 0 12px 0', fontSize: 10, borderLeft: '4px solid #8b5cf6', paddingLeft: 8, textTransform: 'uppercase', color: '#1e293b' }}>4. Biaya Tambahan</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto', borderSpacing: 0, fontSize: '8px' }}>
            <tbody>
              {Number(additionalCosts?.labor) > 0 && (
                <tr>
                  <td style={{ padding: '5px 6px', border: '1px solid #e2e8f0', fontSize: '7px', fontWeight: '600', width: '60%' }}>Biaya Tenaga Kerja</td>
                  <td style={{ textAlign: 'right', padding: '5px 6px', border: '1px solid #e2e8f0', fontSize: '7px', fontWeight: '600' }}>{formatCurrency(additionalCosts.labor)}</td>
                </tr>
              )}
              {Number(additionalCosts?.shipping) > 0 && (
                <tr>
                  <td style={{ padding: '5px 6px', border: '1px solid #e2e8f0', fontSize: '7px', fontWeight: '600' }}>Biaya Pengiriman</td>
                  <td style={{ textAlign: 'right', padding: '5px 6px', border: '1px solid #e2e8f0', fontSize: '7px', fontWeight: '600' }}>{formatCurrency(additionalCosts.shipping)}</td>
                </tr>
              )}
              {Number(additionalCosts?.productionMaterial) > 0 && (
                <tr>
                  <td style={{ padding: '5px 6px', border: '1px solid #e2e8f0', fontSize: '7px', fontWeight: '600' }}>Biaya Bahan Produksi</td>
                  <td style={{ textAlign: 'right', padding: '5px 6px', border: '1px solid #e2e8f0', fontSize: '7px', fontWeight: '600' }}>{formatCurrency(additionalCosts.productionMaterial)}</td>
                </tr>
              )}
              <tr style={{ background: '#f3f4f6', fontWeight: '700' }}>
                <td style={{ padding: '6px 8px', border: '1px solid #cbd5e1', fontSize: '8px' }}>Total Biaya Tambahan</td>
                <td style={{ textAlign: 'right', padding: '6px 8px', border: '1px solid #cbd5e1', fontSize: '8px', color: '#8b5cf6' }}>{formatCurrency(totalAdditionalCosts)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

        {/* Global Grand Total Area */}
        <div style={{ marginTop: 24, background: '#0f172a', color: 'white', padding: '12px 16px', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h4 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 10, opacity: 0.8, fontWeight: '600' }}>Grand Total Keseluruhan</h4>
            <div style={{ fontSize: 7, marginTop: 2, opacity: 0.6 }}>(Total setelah potongan + biaya tambahan)</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 16, fontWeight: '900', color: '#10b981' }}>{formatCurrency(grandTotalNet)}</span>
          </div>
        </div>

      {/* Signatures */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 26, fontSize: 8, padding: '0 20px' }}>
        <div style={{ textAlign: 'center', width: 160 }}>
          <p style={{ marginBottom: 45, margin: 0, fontSize: 8 }}>Diperiksa Oleh,</p>
          <div style={{ borderBottom: '1px solid #1e293b', width: '100%', marginBottom: 3 }}></div>
          <p style={{ fontWeight: 'bold', margin: 0, fontSize: 8 }}>Bagian Operasional</p>
        </div>
        <div style={{ textAlign: 'center', width: 160 }}>
          <p style={{ marginBottom: 45, margin: 0, fontSize: 8 }}>Dibuat Oleh,</p>
          <div style={{ borderBottom: '1px solid #1e293b', width: '100%', marginBottom: 3 }}></div>
          <p style={{ fontWeight: 'bold', margin: 0, fontSize: 8 }}>Admin Pembelian</p>
        </div>
      </div>
    </div>
  );
}
