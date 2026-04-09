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
    width: '210mm', minHeight: 'auto', background: 'white', color: 'black',
    padding: '0', margin: '0', boxSizing: 'border-box',
    fontFamily: 'Arial, sans-serif', fontSize: '13px', maxWidth: '100%', overflow: 'visible'
  };

  // Sesi 1: Agregasi Invoice per Item dan per Customer
  // Struktur: Item -> { Customer A: {qty, price, total}, Customer B: ... }
  const session1Data = [];
  (invoicesList || []).forEach(inv => {
    const custName = inv.customerName || '-';
    (inv.items || []).forEach(it => {
      const prodName = (it.productName || '').trim();
      if (!prodName) return;
      const qty = Number(it.qty) || 0;
      const price = Number(it.unitPrice) || 0;
      const total = qty * price;
      
      const existing = session1Data.find(x => x.name === prodName && x.customer === custName && x.price === price);
      if (existing) {
        existing.qty += qty;
        existing.total += total;
      } else {
        session1Data.push({ name: prodName, customer: custName, qty, price, total, unit: it.unit || 'kg' });
      }
    });
  });
  session1Data.sort((a, b) => a.name.localeCompare(b.name));
  const session1Total = session1Data.reduce((sum, item) => sum + item.total, 0);

  // Extract unique customers for pivot columns
  const uniqueCustomersSet = new Set();
  session1Data.forEach(it => uniqueCustomersSet.add(it.customer));
  const uniqueCustomers = Array.from(uniqueCustomersSet).sort();

  // Create Pivot Table Data
  const session1Pivot = [];
  session1Data.forEach(it => {
    let row = session1Pivot.find(r => r.name === it.name && r.price === it.price);
    if (!row) {
      row = { name: it.name, price: it.price, unit: it.unit, customerQty: {}, totalQty: 0, totalRowValue: 0 };
      session1Pivot.push(row);
    }
    
    row.customerQty[it.customer] = (row.customerQty[it.customer] || 0) + it.qty;
    row.totalQty += it.qty;
    row.totalRowValue += it.total;
  });

  // Sesi 2: Agregasi Pembelian Gabungan (Semua Supplier)
  // Hitung total pembelian item, jika Mix Vegetable, handle sub-items
  const session2Map = new Map();
  (purchaseItems || []).forEach(it => {
    const key = it.isSubItem ? `${it.materialName}_sub_${it.parentName}` : it.materialName;
    if (!session2Map.has(key)) {
      session2Map.set(key, { ...it, totalCost: 0, qtyNota: 0, invoiceQty: 0, purchaseCount: 0 });
    }
    const agg = session2Map.get(key);
    agg.totalCost += Number(it.totalCost) || 0;
    agg.qtyNota += Number(it.qtyNota) || 0;
    agg.invoiceQty += Number(it.invoiceQty) || 0;
    agg.purchaseCount += 1;
    
    // Average pricePerUnit
    if (agg.qtyNota > 0) agg.pricePerUnit = agg.totalCost / agg.qtyNota;
  });

  const session2Data = Array.from(session2Map.values());
  const grandTotalPurchases = session2Data.filter(it => !it.isParentItem).reduce((sum, it) => sum + (Number(it.totalCost) || 0), 0);

  // Cari Harga Jual untuk Sesi 2 dari Invoices (Average per item)
  const getAvgSellPrice = (name) => {
    const items = session1Data.filter(x => (x.name || '').toLowerCase() === (name || '').toLowerCase());
    if (items.length === 0) return 0;
    const totalQty = items.reduce((sum, x) => sum + x.qty, 0);
    const totalRev = items.reduce((sum, x) => sum + x.total, 0);
    return totalQty > 0 ? totalRev / totalQty : 0;
  };

  // Sesi 3: Rekap Pembelian per Supplier (Aggregated by Material)
  const supplierMap = {};
  const displayNamesForSup = {};
  (purchaseItems || []).forEach(it => {
    // SKIP: Mix Vegetable parent row (already detailed by sub-items)
    if (it.isParentItem && (it.materialName || '').toLowerCase().includes('mix vegetable')) return;

    const rawSup = (it.supplier || supplierName || 'Penyedia Barang').trim();
    const supKey = rawSup.toUpperCase();
    if (!supplierMap[supKey]) {
      supplierMap[supKey] = new Map(); // Map material name -> aggregated object
      displayNamesForSup[supKey] = rawSup; 
    }
    
    const matName = it.materialName || 'Tanpa Nama';
    const matMap = supplierMap[supKey];
    if (matMap.has(matName)) {
      const ex = matMap.get(matName);
      ex.qtyNota = (Number(ex.qtyNota) || 0) + (Number(it.qtyNota) || 0);
      ex.totalCost = (Number(ex.totalCost) || 0) + (Number(it.totalCost) || 0);
      ex.pricePerUnit = ex.qtyNota > 0 ? ex.totalCost / ex.qtyNota : ex.pricePerUnit;
    } else {
      matMap.set(matName, { ...it, totalCost: Number(it.totalCost) || 0, qtyNota: Number(it.qtyNota) || 0 });
    }
  });
  
  const supplierGroups = Object.keys(supplierMap).sort().map(key => {
    const aggItems = Array.from(supplierMap[key].values());
    return [displayNamesForSup[key], aggItems];
  });

  // Sesi 4: Laba Rugi per Customer
  // Alokasi HPP: Total HPP item dari sesi 2 / Total Qty penjualan keseluruhan = Average HPP unit
  const avgHppMap = {};
  session2Data.forEach(it => {
    if (!it.isSubItem && !it.isParentItem) {
      avgHppMap[(it.materialName || '').toLowerCase()] = it.pricePerUnit || 0;
    } else if (it.isParentItem) {
      // Mix Vegetable parent HPP per INV QTY
      const subItems = session2Data.filter(sub => sub.isSubItem && sub.parentName === it.materialName);
      const subTotalCost = subItems.reduce((s, sub) => s + (Number(sub.totalCost) || 0), 0);
      const invQty = Number(it.invoiceQty) || Number(it.qtyNota) || 1;
      avgHppMap[(it.materialName || '').toLowerCase()] = subTotalCost / invQty;
    }
  });

  const session4Data = [];
  const uniqueCustomersSet4 = new Set();
  session1Data.forEach(it => uniqueCustomersSet4.add(it.customer));
  const uniqueCustomers4 = Array.from(uniqueCustomersSet4).sort();

  uniqueCustomers4.forEach(cust => {
    let revenue = 0;
    let hpp = 0;

    session1Data.filter(it => it.customer === cust).forEach(it => {
      // Pendapatan berdasarkan barang-barang yang dibeli customer ini di sesi 1
      revenue += it.total;
      
      // HPP untuk barang tersebut
      const unitHpp = avgHppMap[(it.name || '').toLowerCase()] || 0;
      hpp += (it.qty * unitHpp);
    });

    session4Data.push({ customer: cust, revenue, hpp, profit: revenue - hpp });
  });

  // Calculate Net Supplier Payments (for Section 5)
  let totalFromSuppliers = 0;
  supplierGroups.forEach(([s, items]) => {
    const discount = Number(supplierDiscounts[s]) || 0;
    const subtotal = items.reduce((sum, it) => {
      if (it.isParentItem && (it.materialName || '').toLowerCase().includes('mix vegetable')) return sum;
      return sum + (Number(it.totalCost) || 0);
    }, 0);
    totalFromSuppliers += Math.max(0, subtotal - discount);
  });
  const totalAdditionalCosts = Object.values(additionalCosts || {}).reduce((s, c) => s + (Number(c) || 0), 0);
  const grandTotalNet = totalFromSuppliers + totalAdditionalCosts;

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          body { width: 210mm; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .print-section { page-break-inside: avoid !important; break-inside: avoid !important; position: relative !important; }
          .page-break-before { page-break-before: always !important; break-before: page !important; }
          table { page-break-inside: avoid !important; break-inside: avoid !important; width: 100% !important; }
          thead { display: table-header-group !important; }
          tfoot { display: table-footer-group !important; }
        }
        @media screen { #purchase-note-report-render { box-shadow: 0 0 10px rgba(0,0,0,0.1); margin: 20px auto; } }
      `}</style>
      <div id="purchase-note-report-render" className="print-only" style={containerStyle}>
        <div style={{ padding: '15mm' }}>
         {/* HEADER */}
          <div style={{ display: 'flex', alignItems: 'center', borderBottom: '2px solid #1e293b', paddingBottom: 10, marginBottom: 20 }}>
            <div style={{ width: 55, height: 55, marginRight: 15 }}>
              <img src="/logo-kdmp.png" alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            </div>
            <div style={{ flex: '1', textAlign: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 'bold', color: '#1e293b' }}>KOPERASI DESA MERAH PUTIH SINDANGJAYA</h2>
              <h3 style={{ margin: '3px 0 0 0', fontSize: 13, color: '#475569' }}>LAPORAN PEMBELIAN & PENJUALAN KOMPREHENSIF</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: 12, fontWeight: '600' }}>GRUP: <span style={{ color: '#ef4444' }}>{groupName.toUpperCase()}</span> | TANGGAL: {formatDateShort(date)}</p>
            </div>
          </div>

          {/* SESSION 1: Rekap Invoice Gabungan */}
          <div className="print-section">
            <h4 style={{ margin: '0 0 10px 0', fontSize: 13, borderLeft: '4px solid #3b82f6', paddingLeft: 8, textTransform: 'uppercase' }}>Session 1: Rekap Invoice Gabungan</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: 20 }}>
              <thead>
                <tr>
                  <th style={{ padding: '6px', background: '#f8fafc', border: '1px solid #cbd5e1', textAlign: 'center', width: '5%' }}>No</th>
                  <th style={{ padding: '6px', background: '#f8fafc', border: '1px solid #cbd5e1', textAlign: 'left' }}>Komoditas</th>
                  {uniqueCustomers.map(cust => (
                    <th key={cust} style={{ padding: '6px', background: '#e0f2fe', border: '1px solid #cbd5e1', textAlign: 'center' }}>{cust}</th>
                  ))}
                  <th style={{ padding: '6px', background: '#f8fafc', border: '1px solid #cbd5e1', textAlign: 'center' }}>Total</th>
                  <th style={{ padding: '6px', background: '#f8fafc', border: '1px solid #cbd5e1', textAlign: 'center' }}>Satuan</th>
                  <th style={{ padding: '6px', background: '#f8fafc', border: '1px solid #cbd5e1', textAlign: 'right' }}>Harga Satuan</th>
                  <th style={{ padding: '6px', background: '#f8fafc', border: '1px solid #cbd5e1', textAlign: 'right' }}>Total (Rp)</th>
                </tr>
              </thead>
              <tbody>
                {session1Pivot.map((row, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: '4px 6px', border: '1px solid #e2e8f0', textAlign: 'center' }}>{idx + 1}</td>
                    <td style={{ padding: '4px 6px', border: '1px solid #e2e8f0', fontWeight: '600' }}>{row.name}</td>
                    {uniqueCustomers.map(cust => (
                      <td key={cust} style={{ padding: '4px 6px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                        {row.customerQty[cust] ? formatNumber(row.customerQty[cust]) : '-'}
                      </td>
                    ))}
                    <td style={{ padding: '4px 6px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 'bold', color: '#312e81' }}>{formatNumber(row.totalQty)}</td>
                    <td style={{ padding: '4px 6px', border: '1px solid #e2e8f0', textAlign: 'center' }}>{row.unit}</td>
                    <td style={{ padding: '4px 6px', border: '1px solid #e2e8f0', textAlign: 'right' }}>{formatCurrency(row.price)}</td>
                    <td style={{ padding: '4px 6px', border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(row.totalRowValue)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={uniqueCustomers.length + 5} style={{ padding: '6px', textAlign: 'right', fontWeight: 'bold', background: '#eff6ff', border: '1px solid #cbd5e1' }}>Total Penjualan Gabungan:</td>
                  <td style={{ padding: '6px', textAlign: 'right', fontWeight: 'bold', background: '#eff6ff', border: '1px solid #cbd5e1' }}>{formatCurrency(session1Total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* SESSION 2: Rekap Pembelian Semua Bahan Baku */}
          <div className="print-section page-break-before" style={{ marginTop: 20 }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: 13, borderLeft: '4px solid #10b981', paddingLeft: 8, textTransform: 'uppercase' }}>Session 2: Rekap Pembelian Gabungan Bahan Baku</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: 20 }}>
              <thead>
                <tr>
                  <th style={{ padding: '6px', background: '#f8fafc', border: '1px solid #cbd5e1', textAlign: 'left' }}>Bahan Baku</th>
                  <th style={{ padding: '6px', background: '#f8fafc', border: '1px solid #cbd5e1', textAlign: 'center' }}>Qty Beli</th>
                  <th style={{ padding: '6px', background: '#f8fafc', border: '1px solid #cbd5e1', textAlign: 'right' }}>H. Pembelian</th>
                  <th style={{ padding: '6px', background: '#f8fafc', border: '1px solid #cbd5e1', textAlign: 'right' }}>H. Penjualan</th>
                  <th style={{ padding: '6px', background: '#f8fafc', border: '1px solid #cbd5e1', textAlign: 'right' }}>Laba</th>
                  <th style={{ padding: '6px', background: '#f8fafc', border: '1px solid #cbd5e1', textAlign: 'center' }}>Margin %</th>
                </tr>
              </thead>
              <tbody>
                {session2Data.filter(it => !it.isParentItem).map((it, idx) => {
                  const isMixVegParent = it.isParentItem;
                  let sellPrice = getAvgSellPrice(it.materialName);
                  if (sellPrice === 0) sellPrice = Number(it.sellPrice) || 0;

                  const totalBeli = isMixVegParent ? 
                    session2Data.filter(sub => sub.isSubItem && sub.parentName === it.materialName).reduce((s, sub) => s + sub.totalCost, 0)
                    : (Number(it.totalCost) || 0);

                  const invQtyTotal = Number(it.invoiceQty) || Number(it.qtyNota) || 0;
                  const displayPricePerUnit = isMixVegParent 
                    ? (invQtyTotal > 0 ? totalBeli / invQtyTotal : 0)
                    : (it.qtyNota > 0 ? totalBeli / it.qtyNota : 0);

                  const totalJual = invQtyTotal * sellPrice;
                  const rowLaba = totalJual - totalBeli;
                  const margin = totalJual > 0 ? (rowLaba / totalJual * 100) : 0;
                  const displayQty = isMixVegParent ? '' : it.qtyNota;

                  return (
                    <tr key={idx}>
                      <td style={{ padding: '4px 6px', border: '1px solid #e2e8f0', color: it.isSubItem ? '#64748b' : '#1e293b', fontWeight: isMixVegParent ? 'bold' : 'normal', paddingLeft: it.isSubItem ? '20px' : '6px' }}>
                        {it.isSubItem ? '↳ ' : ''}{it.materialName}
                      </td>
                      <td style={{ padding: '4px 6px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                        {displayQty !== '' ? `${formatNumber(displayQty)} ${it.unit}` : ''}
                      </td>
                      <td style={{ padding: '4px 6px', border: '1px solid #e2e8f0', textAlign: 'right' }}>{displayPricePerUnit > 0 ? formatCurrency(displayPricePerUnit) : '-'}</td>
                      <td style={{ padding: '4px 6px', border: '1px solid #e2e8f0', textAlign: 'right' }}>{sellPrice > 0 ? formatCurrency(sellPrice) : '-'}</td>
                      <td style={{ padding: '4px 6px', border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 'bold', color: rowLaba >= 0 ? '#166534' : '#991b1b' }}>
                        {(totalJual > 0 || isMixVegParent) ? formatCurrency(rowLaba) : (it.isSubItem ? '-' : formatCurrency(rowLaba))}
                      </td>
                      <td style={{ padding: '4px 6px', border: '1px solid #e2e8f0', textAlign: 'center', color: margin >= 0 ? '#166534' : '#991b1b' }}>
                        {totalJual > 0 ? `${margin.toFixed(1)}%` : '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* SESSION 3: Rekap Pembelian Tiap Supplier */}
          <div className="print-section" style={{ marginTop: 20 }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: 13, borderLeft: '4px solid #8b5cf6', paddingLeft: 8, textTransform: 'uppercase' }}>Session 3: Rincian Pembelian Tiap Supplier</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: 20 }}>
              <thead>
                <tr>
                  <th style={{ padding: '6px', background: '#f8fafc', border: '1px solid #cbd5e1', textAlign: 'left' }}>Supplier</th>
                  <th style={{ padding: '6px', background: '#f8fafc', border: '1px solid #cbd5e1', textAlign: 'left' }}>Item Pembelian</th>
                  <th style={{ padding: '6px', background: '#f8fafc', border: '1px solid #cbd5e1', textAlign: 'center' }}>Qty Pembelian</th>
                  <th style={{ padding: '6px', background: '#f8fafc', border: '1px solid #cbd5e1', textAlign: 'right' }}>H. Pembelian</th>
                  <th style={{ padding: '6px', background: '#f8fafc', border: '1px solid #cbd5e1', textAlign: 'right' }}>Total Beli</th>
                </tr>
              </thead>
              <tbody>
                {supplierGroups.map(([s, items], sIdx) => (
                  items.map((it, iIdx) => {
                    const isMixVegParent = it.isParentItem && (it.materialName || '').toLowerCase().includes('mix vegetable');
                    const totalBeli = isMixVegParent ? 
                      items.filter(sub => sub.isSubItem && sub.parentName === it.materialName).reduce((sum, sub) => sum + (Number(sub.totalCost) || 0), 0)
                      : (Number(it.totalCost) || 0);
                    const invQtyTotal = Number(it.invoiceQty) || Number(it.qtyNota) || 0;
                    const priceUnit = isMixVegParent ? (invQtyTotal > 0 ? totalBeli / invQtyTotal : 0) : (Number(it.pricePerUnit) || 0);
                    const displayQty = isMixVegParent ? '' : it.qtyNota;
                    
                    return (
                      <tr key={`${sIdx}-${iIdx}`}>
                        {iIdx === 0 && <td rowSpan={items.length} style={{ padding: '4px 6px', border: '1px solid #e2e8f0', fontWeight: 'bold', verticalAlign: 'top' }}>{s}</td>}
                        <td style={{ padding: '4px 6px', border: '1px solid #e2e8f0', paddingLeft: it.isSubItem ? '20px' : '6px', fontWeight: isMixVegParent ? 'bold' : 'normal', color: it.isSubItem ? '#64748b' : '#000' }}>
                          {it.isSubItem ? '↳ ' : ''}{it.materialName}
                        </td>
                        <td style={{ padding: '4px 6px', border: '1px solid #e2e8f0', textAlign: 'center' }}>{displayQty !== '' ? `${formatNumber(displayQty)} ${it.unit}` : ''}</td>
                        <td style={{ padding: '4px 6px', border: '1px solid #e2e8f0', textAlign: 'right' }}>{priceUnit > 0 ? formatCurrency(priceUnit) : '-'}</td>
                        <td style={{ padding: '4px 6px', border: '1px solid #e2e8f0', textAlign: 'right' }}>{totalBeli > 0 ? formatCurrency(totalBeli) : '-'}</td>
                      </tr>
                    );
                  })
                ))}
              </tbody>
            </table>
          </div>

          {/* SESSION 4: Laporan Laba Rugi Consolidated Summary */}
          <div className="print-section" style={{ marginTop: 20 }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: 13, borderLeft: '4px solid #f59e0b', paddingLeft: 8, textTransform: 'uppercase' }}>Session 4: Laporan Laba Rugi Summary</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: 20 }}>
              <thead>
                <tr>
                  <th style={{ padding: '6px', background: '#f8fafc', border: '1px solid #cbd5e1', textAlign: 'right' }}>Total Invoice</th>
                  <th style={{ padding: '6px', background: '#f8fafc', border: '1px solid #cbd5e1', textAlign: 'right' }}>Total Pembelian</th>
                  <th style={{ padding: '6px', background: '#f8fafc', border: '1px solid #cbd5e1', textAlign: 'right' }}>Laba / Rugi</th>
                  <th style={{ padding: '6px', background: '#f8fafc', border: '1px solid #cbd5e1', textAlign: 'center' }}>Margin %</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const totalRev = session1Total; 
                  const totalPurchase = grandTotalNet;
                  const totalProfit = totalRev - totalPurchase;
                  const totalMargin = totalRev > 0 ? (totalProfit / totalRev * 100) : 0;
                  return (
                    <tr>
                      <td style={{ padding: '8px 12px', border: '1px solid #e2e8f0', textAlign: 'right', color: '#15803d', fontWeight: 'bold', fontSize: '13px' }}>
                        {formatCurrency(totalRev)}
                      </td>
                      <td style={{ padding: '8px 12px', border: '1px solid #e2e8f0', textAlign: 'right', color: '#dc2626', fontSize: '13px' }}>
                        {formatCurrency(totalPurchase)}
                      </td>
                      <td style={{ padding: '8px 12px', border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 'bold', fontSize: '13px', color: totalProfit >= 0 ? '#166534' : '#991b1b' }}>
                        {formatCurrency(totalProfit)}
                      </td>
                      <td style={{ padding: '8px 12px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 'bold', fontSize: '13px', color: totalMargin >= 0 ? '#166534' : '#991b1b' }}>
                        {totalMargin.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>

          {/* PAGE BREAK UNTUK SESSION 5 */}
          <div className="page-break-before" style={{ paddingTop: '15mm' }}>
            {/* SESSION 5: Tabel Pembayaran Supplier */}
            <h4 style={{ margin: '0 0 10px 0', fontSize: 13, borderLeft: '4px solid #06b6d4', paddingLeft: 8, textTransform: 'uppercase' }}>Session 5: Tabel Pembayaran Supplier & Bank</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr>
                  <th style={{ padding: '6px', background: '#f8fafc', border: '1px solid #cbd5e1', textAlign: 'center', width: '5%' }}>No</th>
                  <th style={{ padding: '6px', background: '#f8fafc', border: '1px solid #cbd5e1', textAlign: 'left', width: '25%' }}>Nama Supplier</th>
                  <th style={{ padding: '6px', background: '#f8fafc', border: '1px solid #cbd5e1', textAlign: 'right', width: '15%' }}>Subtotal</th>
                  <th style={{ padding: '6px', background: '#f8fafc', border: '1px solid #cbd5e1', textAlign: 'right', width: '15%' }}>Diskon</th>
                  <th style={{ padding: '6px', background: '#f8fafc', border: '1px solid #cbd5e1', textAlign: 'right', width: '15%' }}>Net Bayar</th>
                  <th style={{ padding: '6px', background: '#f8fafc', border: '1px solid #cbd5e1', textAlign: 'left', width: '25%' }}>Keterangan Akun Bank</th>
                </tr>
              </thead>
              <tbody>
                {supplierGroups.map(([s, items], idx) => {
                  const discount = Number(supplierDiscounts[s]) || 0;
                  const subtotal = items.reduce((sum, it) => {
                    if (it.isParentItem && (it.materialName || '').toLowerCase().includes('mix vegetable')) return sum;
                    return sum + (Number(it.totalCost) || 0);
                  }, 0);
                  const netToPay = Math.max(0, subtotal - discount);
                  
                  const suppInfo = (suppliersData || []).find(sd => (sd.name || '').toLowerCase() === s.toLowerCase());

                  return (
                    <tr key={idx}>
                      <td style={{ padding: '6px', border: '1px solid #e2e8f0', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ padding: '6px', border: '1px solid #e2e8f0', fontWeight: 'bold' }}>{s}</td>
                      <td style={{ padding: '6px', border: '1px solid #e2e8f0', textAlign: 'right' }}>{formatCurrency(subtotal)}</td>
                      <td style={{ padding: '6px', border: '1px solid #e2e8f0', textAlign: 'right', color: discount > 0 ? '#ef4444' : 'inherit' }}>{discount > 0 ? `-${formatCurrency(discount)}` : '-'}</td>
                      <td style={{ padding: '6px', border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 'bold', color: '#15803d' }}>{formatCurrency(netToPay)}</td>
                      <td style={{ padding: '6px', border: '1px solid #e2e8f0', fontSize: '10px' }}>
                        {suppInfo && suppInfo.bankName ? (
                          <>
                            <div style={{ fontWeight: 'bold' }}>{suppInfo.bankName}</div>
                            <div>{suppInfo.accountNumber} a/n {suppInfo.accountName}</div>
                          </>
                        ) : <span style={{ color: '#94a3b8' }}>Belum diatur</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                {totalAdditionalCosts > 0 && (
                  <tr>
                    <td colSpan="4" style={{ padding: '6px', border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 'bold', color: '#8b5cf6' }}>+ Biaya Tambahan (Buruh/Kirim):</td>
                    <td style={{ padding: '6px', border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 'bold', color: '#8b5cf6' }}>{formatCurrency(totalAdditionalCosts)}</td>
                    <td style={{ padding: '6px', border: '1px solid #cbd5e1' }}></td>
                  </tr>
                )}
                <tr>
                  <td colSpan="4" style={{ padding: '8px 6px', background: '#0f172a', border: '1px solid #334155', textAlign: 'right', fontWeight: 'bold', color: 'white' }}>GRAND TOTAL TRANSFER:</td>
                  <td style={{ padding: '8px 6px', background: '#0f172a', border: '1px solid #334155', textAlign: 'right', fontWeight: 'bold', color: '#10b981', fontSize: '14px' }}>{formatCurrency(grandTotalNet)}</td>
                  <td style={{ padding: '8px 6px', background: '#0f172a', border: '1px solid #334155' }}></td>
                </tr>
              </tfoot>
            </table>
            
            {/* Tanda Tangan */}
            <div className="no-break" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 40, padding: '0 20px', pageBreakInside: 'avoid' }}>
              <div style={{ textAlign: 'center', width: 160 }}>
                <p style={{ margin: '0 0 45px 0' }}>Diperiksa Oleh,</p>
                <div style={{ borderBottom: '1px solid black' }}></div>
                <p style={{ margin: '3px 0 0 0', fontWeight: 'bold' }}>Bagian Operasional</p>
              </div>
              <div style={{ textAlign: 'center', width: 160 }}>
                <p style={{ margin: '0 0 45px 0' }}>Dibuat Oleh,</p>
                <div style={{ borderBottom: '1px solid black' }}></div>
                <p style={{ margin: '3px 0 0 0', fontWeight: 'bold' }}>Admin Pembelian</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
