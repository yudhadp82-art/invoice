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
    minHeight: 'auto',
    background: 'white',
    color: 'black',
    padding: '0',
    margin: '0',
    boxSizing: 'border-box',
    fontFamily: 'Arial, sans-serif',
    fontSize: '12px',
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
    <>
      <style>{`
        @media print {
          /* A4 page size and margins */
          @page {
            size: A4 portrait;
            margin: 0;
          }

          /* Ensure body fits A4 */
          body {
            width: 210mm;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Prevent breaks inside important elements */
          .print-section {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            position: relative !important;
          }

          /* Force page breaks before major sections */
          .page-break-before {
            page-break-before: always !important;
            break-before: page !important;
          }

          /* Force page breaks after major sections */
          .page-break-after {
            page-break-after: always !important;
            break-after: page !important;
          }

          /* Prevent breaks after headings */
          h4 {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }

          /* Keep tables together - more aggressive */
          table {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            width: 100% !important;
          }

          /* Keep table headers with data */
          thead {
            page-break-after: avoid !important;
            break-after: avoid !important;
            display: table-header-group !important;
          }

          /* Keep table footers with data */
          tfoot {
            display: table-footer-group !important;
          }

          /* Prevent breaks in summary rows */
          tr.summary-row {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          /* Keep grand total and signatures together */
          .no-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-before: avoid !important;
            break-before: avoid !important;
          }

          /* Ensure print container fits A4 */
          #purchase-note-report-render {
            width: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }

          /* Force supplier sections to stay together */
          .supplier-section {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }

        /* Screen styles for preview */
        @media screen {
          #purchase-note-report-render {
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            margin: 20px auto;
          }
        }
      `}</style>
      <div id="purchase-note-report-render" className="print-only" style={containerStyle}>
      {/* Content wrapper with padding for A4 margins */}
      <div style={{ padding: '15mm' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', borderBottom: '2px solid #1e293b', paddingBottom: 10, marginBottom: 20, gap: 8 }}>
        <div style={{ width: 55, height: 55, marginRight: 15, flexShrink: 0 }}>
          <img src="/logo-kdmp.png" alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        </div>
        <div style={{ flex: '1 1 220px', textAlign: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 'bold', color: '#1e293b', textTransform: 'uppercase' }}>KOPERASI DESA MERAH PUTIH SINDANGJAYA</h2>
          <h3 style={{ margin: '3px 0 0 0', fontSize: 12, color: '#475569' }}>LAPORAN REKAP PEMBELIAN BAHAN BAKU</h3>
          <p style={{ margin: '4px 0 0 0', fontSize: 11, fontWeight: '600' }}>
            GRUP: <span style={{ color: '#ef4444' }}>{groupName.toUpperCase()}</span> | TANGGAL: {formatDateShort(date)}
          </p>
        </div>
      </div>

      {/* SECTION 1: REKAP KEBUTUHAN GRUP (AGGREGATE) */}
      <div className="print-section" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: 13, borderLeft: '4px solid #3b82f6', paddingLeft: 8, textTransform: 'uppercase', color: '#1e293b', pageBreakAfter: 'avoid', breakAfter: 'avoid' }}>1. Rekap Kebutuhan Gabungan (Agregat)</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', borderSpacing: 0, fontSize: '11px', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '6px 8px', background: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '10px', fontWeight: 'bold' }}>Nama Bahan Baku</th>
              <th style={{ textAlign: 'center', width: '20%', padding: '6px 8px', background: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '10px', fontWeight: 'bold' }}>Total Kebutuhan</th>
              <th style={{ textAlign: 'center', width: '15%', padding: '6px 8px', background: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '10px', fontWeight: 'bold' }}>Satuan</th>
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

      {/* Page break before section 2 */}
      <div className="page-break-before" style={{ pageBreakBefore: 'always', breakBefore: 'page' }}></div>

      {/* SECTION 2: REKAP & REALISASI PEMBELIAN PER SUPPLIER */}
      <h4 style={{ margin: '16px 0 12px 0', fontSize: 10, borderLeft: '4px solid #10b981', paddingLeft: 8, textTransform: 'uppercase', color: '#1e293b', pageBreakAfter: 'avoid', breakAfter: 'avoid' }}>2. Rekap & Realisasi Pembelian per Supplier</h4>

      {supplierGroups.map(([s, items], idx) => {
        const discount = Number(supplierDiscounts[s]) || 0;
        const subtotal = items.reduce((sum, it) => sum + (Number(it.totalCost) || 0), 0);
        const netToPay = Math.max(0, subtotal - discount);
        const suppInfo = (suppliersData || []).find(sd =>
          (sd.name || '').toLowerCase() === s.toLowerCase() ||
          (sd.company || '').toLowerCase() === s.toLowerCase()
        );

        return (
          <div key={idx} className="print-section supplier-section" style={{
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            overflow: 'visible',
            marginBottom: 20,
            marginTop: 16,
            pageBreakInside: 'avoid',
            breakInside: 'avoid',
            pageBreakBefore: idx > 0 ? 'always' : 'auto',
            breakBefore: idx > 0 ? 'page' : 'auto',
            pageBreakAfter: 'auto',
            breakAfter: 'auto',
            width: '100%',
            minHeight: 'auto'
          }}>
            {/* Supplier Header Box */}
            <div style={{ background: '#f8fafc', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', gap: 10 }}>
               <div>
                  <span style={{ fontSize: '9px', textTransform: 'uppercase', color: '#64748b', fontWeight: '600' }}>Penyedia Barang:</span>
                  <h5 style={{ margin: '1px 0 0 0', fontSize: '11px', fontWeight: '700', color: '#0f172a' }}>{s.toUpperCase()}</h5>
               </div>
               <div style={{ textAlign: 'right', fontSize: '9px' }}>
                  <div style={{ textTransform: 'uppercase', color: '#64748b', fontWeight: '600', marginBottom: '2px' }}>Info Pembayaran (Bank):</div>
                  <div style={{ fontSize: '9px', fontWeight: '600', color: '#1e293b' }}>
                    {suppInfo && suppInfo.bankName ? `${suppInfo.bankName} / ${suppInfo.accountName}` : 'Informasi rekening belum diatur'}
                  </div>
                  {suppInfo && suppInfo.accountNumber && (
                    <div style={{ fontSize: '9px', fontWeight: '600', color: '#1e293b' }}>No: {suppInfo.accountNumber}</div>
                  )}
               </div>
            </div>

            {/* Items Table for this Supplier */}
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', borderSpacing: 0, pageBreakInside: 'avoid', breakInside: 'avoid' }}>
              <thead style={{ pageBreakAfter: 'avoid', breakAfter: 'avoid' }}>
                <tr>
                  <th style={{ textAlign: 'left', color: '#475569', padding: '5px 6px', background: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '10px', fontWeight: 'bold' }}>Bahan Baku / Material</th>
                  <th style={{ textAlign: 'center', color: '#475569', width: '15%', padding: '5px 6px', background: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '10px', fontWeight: 'bold' }}>Qty</th>
                  <th style={{ textAlign: 'right', color: '#475569', width: '18%', padding: '5px 6px', background: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '10px', fontWeight: 'bold' }}>Harga Satuan</th>
                  <th style={{ textAlign: 'right', color: '#475569', width: '18%', padding: '5px 6px', background: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '10px', fontWeight: 'bold' }}>Total Biaya</th>
                </tr>
              </thead>
              <tbody style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                {items.map((it, iIdx) => (
                  <tr key={iIdx}>
                    <td style={{ color: '#1e293b', wordBreak: 'break-word', padding: '4px 6px', border: '1px solid #e2e8f0', fontSize: '10px' }}>{it.isSubItem ? '↳ ' : ''}{it.materialName}</td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', padding: '4px 6px', border: '1px solid #e2e8f0', fontSize: '10px' }}>{formatNumber(it.qtyNota)} {it.unit}</td>
                    <td style={{ textAlign: 'right', padding: '4px 6px', border: '1px solid #e2e8f0', fontSize: '10px' }}>{formatCurrency(it.pricePerUnit)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', padding: '4px 6px', border: '1px solid #e2e8f0', fontSize: '10px' }}>{formatCurrency(it.totalCost)}</td>
                  </tr>
                ))}
                {/* Summary Rows for this Supplier */}
                <tr className="summary-row" style={{ background: '#fafafa', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                  <td colSpan="3" style={{ textAlign: 'right', color: '#64748b', fontSize: '10px', fontWeight: '600', padding: '4px 6px', border: '1px solid #e2e8f0' }}>Subtotal:</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold', padding: '4px 6px', border: '1px solid #e2e8f0', fontSize: '10px' }}>{formatCurrency(subtotal)}</td>
                </tr>
                {discount > 0 && (
                  <tr className="summary-row" style={{ background: '#fafafa', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                    <td colSpan="3" style={{ textAlign: 'right', color: '#ef4444', fontSize: '10px', fontWeight: '600', padding: '4px 6px', border: '1px solid #e2e8f0' }}>Potongan Diskon:</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#ef4444', padding: '4px 6px', border: '1px solid #e2e8f0', fontSize: '10px' }}>-{formatCurrency(discount)}</td>
                  </tr>
                )}
                <tr className="summary-row" style={{ background: '#f0fdf4', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                  <td colSpan="3" style={{ textAlign: 'right', fontSize: '11px', fontWeight: '700', color: '#166534', padding: '5px 6px', border: '1px solid #e2e8f0' }}>TOTAL BAYAR KE {s.toUpperCase()}:</td>
                  <td style={{ textAlign: 'right', fontSize: '12px', fontWeight: '800', color: '#15803d', padding: '5px 6px', border: '1px solid #e2e8f0' }}>{formatCurrency(netToPay)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}

      {/* SECTION 3: RELATED INVOICES */}
      {(invoicesList || []).length > 0 && (
        <div className="print-section page-break-before" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
          <h4 style={{ margin: '16px 0 12px 0', fontSize: 13, borderLeft: '4px solid #f59e0b', paddingLeft: 8, textTransform: 'uppercase', color: '#1e293b', pageBreakAfter: 'avoid', breakAfter: 'avoid' }}>3. Invoice Terhubung</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto', borderSpacing: 0, fontSize: '10px', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '6px 8px', background: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '10px', fontWeight: 'bold' }}>No Invoice</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', background: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '10px', fontWeight: 'bold' }}>Nama Pembeli</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', background: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '10px', fontWeight: 'bold' }}>Tanggal</th>
                <th style={{ textAlign: 'center', padding: '6px 8px', background: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '10px', fontWeight: 'bold' }}>Jumlah Item</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', background: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '10px', fontWeight: 'bold' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {invoicesList.map((inv, idx) => (
                <tr key={idx}>
                  <td style={{ padding: '5px 6px', border: '1px solid #e2e8f0', fontSize: '10px', fontWeight: '600' }}>{inv.invoiceNumber || inv.id}</td>
                  <td style={{ padding: '5px 6px', border: '1px solid #e2e8f0', fontSize: '10px', fontWeight: '600' }}>{inv.customerName || '-'}</td>
                  <td style={{ padding: '5px 6px', border: '1px solid #e2e8f0', fontSize: '10px' }}>{formatDateShort(inv.date)}</td>
                  <td style={{ textAlign: 'center', padding: '5px 6px', border: '1px solid #e2e8f0', fontSize: '10px' }}>{(inv.items || []).length}</td>
                  <td style={{ textAlign: 'right', padding: '5px 6px', border: '1px solid #e2e8f0', fontSize: '10px', fontWeight: '600' }}>
                    {formatCurrency(inv.grandTotal || 0)}
                  </td>
                </tr>
              ))}
              {(!invoicesList || invoicesList.length === 0) && (
                <tr>
                  <td colSpan="5" style={{ padding: 8, textAlign: 'center', color: '#94a3b8', border: '1px solid #e2e8f0', fontSize: '10px' }}>Tidak ada invoice terhubung</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* SECTION 4: ADDITIONAL COSTS */}
      {totalAdditionalCosts > 0 && (
        <div className="print-section page-break-before" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
          <h4 style={{ margin: '16px 0 12px 0', fontSize: 13, borderLeft: '4px solid #8b5cf6', paddingLeft: 8, textTransform: 'uppercase', color: '#1e293b', pageBreakAfter: 'avoid', breakAfter: 'avoid' }}>4. Biaya Tambahan</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto', borderSpacing: 0, fontSize: '10px', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
            <tbody>
              {Number(additionalCosts?.labor) > 0 && (
                <tr>
                  <td style={{ padding: '5px 6px', border: '1px solid #e2e8f0', fontSize: '10px', fontWeight: '600', width: '60%' }}>Biaya Tenaga Kerja</td>
                  <td style={{ textAlign: 'right', padding: '5px 6px', border: '1px solid #e2e8f0', fontSize: '10px', fontWeight: '600' }}>{formatCurrency(additionalCosts.labor)}</td>
                </tr>
              )}
              {Number(additionalCosts?.shipping) > 0 && (
                <tr>
                  <td style={{ padding: '5px 6px', border: '1px solid #e2e8f0', fontSize: '10px', fontWeight: '600' }}>Biaya Pengiriman</td>
                  <td style={{ textAlign: 'right', padding: '5px 6px', border: '1px solid #e2e8f0', fontSize: '10px', fontWeight: '600' }}>{formatCurrency(additionalCosts.shipping)}</td>
                </tr>
              )}
              {Number(additionalCosts?.productionMaterial) > 0 && (
                <tr>
                  <td style={{ padding: '5px 6px', border: '1px solid #e2e8f0', fontSize: '10px', fontWeight: '600' }}>Biaya Bahan Produksi</td>
                  <td style={{ textAlign: 'right', padding: '5px 6px', border: '1px solid #e2e8f0', fontSize: '10px', fontWeight: '600' }}>{formatCurrency(additionalCosts.productionMaterial)}</td>
                </tr>
              )}
              <tr style={{ background: '#f3f4f6', fontWeight: '700' }}>
                <td style={{ padding: '6px 8px', border: '1px solid #cbd5e1', fontSize: '10px' }}>Total Biaya Tambahan</td>
                <td style={{ textAlign: 'right', padding: '6px 8px', border: '1px solid #cbd5e1', fontSize: '10px', color: '#8b5cf6' }}>{formatCurrency(totalAdditionalCosts)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

        {/* SECTION 5: RINGKASAN PEMBAYARAN PER SUPPLIER */}
        {supplierGroups.length > 0 && (
          <div className="print-section" style={{ pageBreakInside: 'avoid', breakInside: 'avoid', marginTop: 20 }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: 13, borderLeft: '4px solid #06b6d4', paddingLeft: 8, textTransform: 'uppercase', color: '#1e293b', pageBreakAfter: 'avoid', breakAfter: 'avoid' }}>5. Ringkasan Pembayaran per Supplier</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', borderSpacing: 0, pageBreakInside: 'avoid', breakInside: 'avoid' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '6px 8px', background: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '10px', fontWeight: 'bold', width: '10%' }}>No</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', background: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '10px', fontWeight: 'bold' }}>Nama Supplier</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', background: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '10px', fontWeight: 'bold', width: '20%' }}>Subtotal</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', background: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '10px', fontWeight: 'bold', width: '20%' }}>Diskon</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', background: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '10px', fontWeight: 'bold', width: '22%' }}>Total Bayar</th>
                </tr>
              </thead>
              <tbody>
                {supplierGroups.map(([s, items], idx) => {
                  const discount = Number(supplierDiscounts[s]) || 0;
                  const subtotal = items.reduce((sum, it) => sum + (Number(it.totalCost) || 0), 0);
                  const netToPay = Math.max(0, subtotal - discount);
                  return (
                    <tr key={idx}>
                      <td style={{ padding: '5px 8px', border: '1px solid #e2e8f0', fontSize: '10px', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ padding: '5px 8px', border: '1px solid #e2e8f0', fontSize: '10px', fontWeight: '600' }}>{s}</td>
                      <td style={{ textAlign: 'right', padding: '5px 8px', border: '1px solid #e2e8f0', fontSize: '10px' }}>{formatCurrency(subtotal)}</td>
                      <td style={{ textAlign: 'right', padding: '5px 8px', border: '1px solid #e2e8f0', fontSize: '10px', color: discount > 0 ? '#ef4444' : '#94a3b8' }}>{discount > 0 ? `-${formatCurrency(discount)}` : '-'}</td>
                      <td style={{ textAlign: 'right', padding: '5px 8px', border: '1px solid #e2e8f0', fontSize: '11px', fontWeight: '700', color: '#15803d' }}>{formatCurrency(netToPay)}</td>
                    </tr>
                  );
                })}
                {totalAdditionalCosts > 0 && (
                  <tr style={{ background: '#f8fafc' }}>
                    <td colSpan="4" style={{ textAlign: 'right', padding: '5px 8px', border: '1px solid #e2e8f0', fontSize: '10px', fontWeight: '600', color: '#8b5cf6' }}>+ Biaya Tambahan:</td>
                    <td style={{ textAlign: 'right', padding: '5px 8px', border: '1px solid #e2e8f0', fontSize: '11px', fontWeight: '700', color: '#8b5cf6' }}>{formatCurrency(totalAdditionalCosts)}</td>
                  </tr>
                )}
                <tr style={{ background: '#0f172a' }}>
                  <td colSpan="4" style={{ textAlign: 'right', padding: '6px 8px', border: '1px solid #334155', fontSize: '11px', fontWeight: '700', color: 'white' }}>GRAND TOTAL:</td>
                  <td style={{ textAlign: 'right', padding: '6px 8px', border: '1px solid #334155', fontSize: '13px', fontWeight: '900', color: '#10b981' }}>{formatCurrency(grandTotalNet)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Global Grand Total Area */}
        <div className="no-break" style={{ marginTop: 24, background: '#0f172a', color: 'white', padding: '12px 16px', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
          <div>
            <h4 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 13, opacity: 0.8, fontWeight: '600' }}>Grand Total Keseluruhan</h4>
            <div style={{ fontSize: 10, marginTop: 2, opacity: 0.6 }}>(Total setelah potongan + biaya tambahan)</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 20, fontWeight: '900', color: '#10b981' }}>{formatCurrency(grandTotalNet)}</span>
          </div>
        </div>

        {/* Profit/Loss Calculation */}
        {(invoicesList || []).length > 0 && (
          <div className="no-break print-section" style={{ marginTop: 20, pageBreakInside: 'avoid', breakInside: 'avoid' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: 13, borderLeft: '4px solid #f59e0b', paddingLeft: 8, textTransform: 'uppercase', color: '#1e293b', pageBreakAfter: 'avoid', breakAfter: 'avoid' }}>6. Analisis Profit & Loss</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', borderSpacing: 0, fontSize: '11px', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '8px 12px', border: '1px solid #e2e8f0', fontSize: '11px', fontWeight: '600', background: '#f0fdf4', width: '60%' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#166534', marginBottom: 2 }}>Total Penjualan (Invoice)</div>
                    <div style={{ fontSize: '9px', opacity: 0.7 }}>Jumlah dari semua invoice terhubung</div>
                  </td>
                  <td style={{ textAlign: 'right', padding: '8px 12px', border: '1px solid #e2e8f0', fontSize: '13px', fontWeight: '800', background: '#f0fdf4', color: '#15803d' }}>
                    {formatCurrency((invoicesList || []).reduce((sum, inv) => sum + (Number(inv.grandTotal) || 0), 0))}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 12px', border: '1px solid #e2e8f0', fontSize: '11px', fontWeight: '600', background: '#fef2f2', width: '60%' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#991b1b', marginBottom: 2 }}>Total Biaya Pembelian</div>
                    <div style={{ fontSize: '9px', opacity: 0.7 }}>Biaya bahan + biaya tambahan</div>
                  </td>
                  <td style={{ textAlign: 'right', padding: '8px 12px', border: '1px solid #e2e8f0', fontSize: '13px', fontWeight: '800', background: '#fef2f2', color: '#dc2626' }}>
                    -{formatCurrency(grandTotalNet)}
                  </td>
                </tr>
                <tr style={{ background: (() => {
                  const totalRevenue = (invoicesList || []).reduce((sum, inv) => sum + (Number(inv.grandTotal) || 0), 0);
                  const profit = totalRevenue - grandTotalNet;
                  return profit >= 0 ? '#f0fdf4' : '#fef2f2';
                })() }}>
                  <td style={{ padding: '10px 12px', border: '1px solid #e2e8f0', fontSize: '12px', fontWeight: '800', width: '60%', color: (() => {
                    const totalRevenue = (invoicesList || []).reduce((sum, inv) => sum + (Number(inv.grandTotal) || 0), 0);
                    const profit = totalRevenue - grandTotalNet;
                    return profit >= 0 ? '#166534' : '#991b1b';
                  })() }}>
                    {(() => {
                      const totalRevenue = (invoicesList || []).reduce((sum, inv) => sum + (Number(inv.grandTotal) || 0), 0);
                      const profit = totalRevenue - grandTotalNet;
                      return profit >= 0 ? 'PROFIT / LABA BERSIH' : 'LOSS / RUGI';
                    })()}
                  </td>
                  <td style={{ textAlign: 'right', padding: '10px 12px', border: '1px solid #e2e8f0', fontSize: '16px', fontWeight: '900', color: (() => {
                    const totalRevenue = (invoicesList || []).reduce((sum, inv) => sum + (Number(inv.grandTotal) || 0), 0);
                    const profit = totalRevenue - grandTotalNet;
                    return profit >= 0 ? '#15803d' : '#dc2626';
                  })() }}>
                    {(() => {
                      const totalRevenue = (invoicesList || []).reduce((sum, inv) => sum + (Number(inv.grandTotal) || 0), 0);
                      const profit = totalRevenue - grandTotalNet;
                      return formatCurrency(Math.abs(profit));
                    })()}
                  </td>
                </tr>
                <tr>
                  <td colSpan="2" style={{ padding: '6px 12px', border: '1px solid #e2e8f0', fontSize: '9px', textAlign: 'center', background: '#f8fafc', opacity: 0.8 }}>
                    {(() => {
                      const totalRevenue = (invoicesList || []).reduce((sum, inv) => sum + (Number(inv.grandTotal) || 0), 0);
                      const profit = totalRevenue - grandTotalNet;
                      const margin = totalRevenue > 0 ? ((profit / totalRevenue) * 100).toFixed(1) : 0;
                      return `Margin: ${margin}% (${profit >= 0 ? 'Profit' : 'Loss'} dari total penjualan)`;
                    })()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

      {/* Signatures */}
      <div className="no-break" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 26, fontSize: 11, padding: '0 20px', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
        <div style={{ textAlign: 'center', width: 160 }}>
          <p style={{ marginBottom: 45, margin: 0, fontSize: 11 }}>Diperiksa Oleh,</p>
          <div style={{ borderBottom: '1px solid #1e293b', width: '100%', marginBottom: 3 }}></div>
          <p style={{ fontWeight: 'bold', margin: 0, fontSize: 11 }}>Bagian Operasional</p>
        </div>
        <div style={{ textAlign: 'center', width: 160 }}>
          <p style={{ marginBottom: 45, margin: 0, fontSize: 11 }}>Dibuat Oleh,</p>
          <div style={{ borderBottom: '1px solid #1e293b', width: '100%', marginBottom: 3 }}></div>
          <p style={{ fontWeight: 'bold', margin: 0, fontSize: 11 }}>Admin Pembelian</p>
        </div>
      </div>
      </div>
    </div>
    </>
  );
}
