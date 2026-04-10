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

  // Sesi 1: Agregasi Invoice per Item dan per Customer
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

    if (agg.qtyNota > 0) agg.pricePerUnit = agg.totalCost / agg.qtyNota;
  });

  const session2Data = Array.from(session2Map.values());
  const grandTotalPurchases = session2Data.filter(it => !it.isParentItem).reduce((sum, it) => sum + (Number(it.totalCost) || 0), 0);

  // Cari Harga Jual untuk Sesi 2 dari Invoices
  const getAvgSellPrice = (name) => {
    const items = session1Data.filter(x => (x.name || '').toLowerCase() === (name || '').toLowerCase());
    if (items.length === 0) return 0;
    const totalQty = items.reduce((sum, x) => sum + x.qty, 0);
    const totalRev = items.reduce((sum, x) => sum + x.total, 0);
    return totalQty > 0 ? totalRev / totalQty : 0;
  };

  // Sesi 3: Rekap Pembelian per Supplier
  const supplierMap = {};
  const displayNamesForSup = {};
  (purchaseItems || []).forEach(it => {
    if (it.isParentItem && (it.materialName || '').toLowerCase().includes('mix vegetable')) return;

    const rawSup = (it.supplier || supplierName || 'Penyedia Barang').trim();
    const supKey = rawSup.toUpperCase();
    if (!supplierMap[supKey]) {
      supplierMap[supKey] = new Map();
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
  const avgHppMap = {};
  session2Data.forEach(it => {
    if (!it.isSubItem && !it.isParentItem) {
      avgHppMap[(it.materialName || '').toLowerCase()] = it.pricePerUnit || 0;
    } else if (it.isParentItem) {
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
      revenue += it.total;
      const unitHpp = avgHppMap[(it.name || '').toLowerCase()] || 0;
      hpp += (it.qty * unitHpp);
    });

    session4Data.push({ customer: cust, revenue, hpp, profit: revenue - hpp });
  });

  // Calculate Net Supplier Payments
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
          @page {
            size: A4 portrait;
            margin: 15mm 15mm 15mm;
          }
          body {
            width: 210mm;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            font-family: 'Arial', sans-serif;
          }
        }
        
        .pdf-container {
          width: 100%;
          max-width: 210mm;
          margin: 0 auto;
          background: white;
          box-sizing: border-box;
          color: #000000;
          font-family: 'Arial', sans-serif;
        }
        .pdf-container * {
          color: #000000;
        }
        .pdf-container .header {
          text-align: center;
          padding: 15mm 15mm 20mm 15mm;
          border-bottom: 2px solid #1e40af;
          margin-bottom: 15mm;
          page-break-after: avoid;
        }
        .pdf-container .section-title {
          font-size: 12px;
          font-weight: bold;
          margin: 12px 0 8px 0;
          text-transform: uppercase;
          padding: 4px 0 4px 4mm;
          border-left: 4px solid;
          background: #f8fafc;
          page-break-inside: avoid;
        }
        .pdf-container .table-container {
          margin: 8px 0 12px 0;
          page-break-inside: avoid;
        }
        .pdf-container table {
          width: 100%;
          border-collapse: collapse;
          font-size: 9.5px;
          page-break-inside: avoid;
          table-layout: fixed;
          word-wrap: break-word;
        }
        .pdf-container thead {
          background: #e8f0fe;
          font-weight: bold;
          border: 1px solid #2c3e50;
        }
        .pdf-container th {
          padding: 6mm 4mm;
          text-align: left;
          border: 1px solid #2c3e50;
          color: #1e40af !important;
          font-weight: bold;
        }
        .pdf-container th.text-center {
          text-align: center;
        }
        .pdf-container th.text-right {
          text-align: right;
        }
        .pdf-container td {
          padding: 6mm 4mm;
          border: 1px solid #2c3e50;
          page-break-inside: avoid;
          color: #000000 !important;
        }
        .pdf-container td.text-center {
          text-align: center;
        }
        .pdf-container td.text-right {
          text-align: right;
          font-weight: 600;
        }
        .pdf-container tfoot {
          background: #e8f0fe;
          font-weight: bold;
          border: 1px solid #2c3e50;
        }
        .pdf-container .total-row td {
          background: #d4e8ff;
          font-weight: bold;
          color: #1e293b !important; /* It's ok since we want dark blue */
        }
        .pdf-container .net-total-row td {
          background: #1e3a8a;
          color: white !important;
          font-weight: bold;
          border: 2px solid #1e3a8a;
        }
        .pdf-container .footer {
          margin-top: 20mm;
          padding: 0 15mm 20mm 15mm;
          border-top: 2px solid #1e40af;
          page-break-before: always;
        }
        .pdf-container .signature-section {
          display: flex;
          justify-content: space-between;
          margin-top: 15mm;
          padding: 0 10mm 0 10mm;
          page-break-inside: avoid;
          page-break-after: avoid;
        }
        .pdf-container .signature-item {
          width: 150px;
          text-align: center;
        }
        .pdf-container .signature-item p {
          margin: 0;
          font-size: 11px;
        }
        .pdf-container .signature-item strong {
          margin: 0 0 3mm 0;
          font-size: 12px;
        }
        .pdf-container .signature-line {
          width: 100%;
          height: 1px;
          background: black;
          margin: 3mm 0;
        }
        @media screen {
          #purchase-note-report-render {
            box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
            margin: 20px auto;
            padding: 20px;
            background: white;
          }
        }
      `}</style>

      <div id="purchase-note-report-render" className="pdf-container print-only">
        {/* HEADER */}
        <div className="header">
          <div style={{ marginBottom: 12 }}>
            <img src="/logo-kdmp.png" alt="Logo" style={{ maxWidth: 120, maxHeight: 50, objectFit: 'contain' }} />
          </div>
          <h1 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 'bold', color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            KOPERASI DESA MERAH PUTIH SINDANGJAYA
          </h1>
          <h2 style={{ margin: '0 0 12px 0', fontSize: 13, color: '#3b82f6', fontWeight: '600' }}>
            LAPORAN PEMBELIAN & PENJUALAN KOMPREHENSIF
          </h2>
          <p style={{ margin: 0, fontSize: 11, fontWeight: '600', textTransform: 'uppercase' }}>
            <span style={{ color: '#1e40af' }}>GRUP: {groupName}</span> <span style={{ color: '#3b82f6' }}>|</span> TANGGAL: <span style={{ color: '#1e40af' }}>{formatDateShort(date)}</span>
          </p>
        </div>

        {/* SESSION 1: Rekap Invoice Gabungan */}
        <div className="section-title" style={{ borderColor: '#3b82f6', color: '#3b82f6' }}>
          Session 1: Rekap Penjualan Gabungan
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th style={{ width: '4%', fontSize: 10 }}>No</th>
                <th style={{ width: '25%', fontSize: 10 }}>Komoditas</th>
                {uniqueCustomers.map(cust => (
                  <th key={cust} className="text-center" style={{ fontSize: 10 }}>{cust}</th>
                ))}
                <th className="text-center" style={{ width: '6%', fontSize: 10 }}>Total</th>
                <th className="text-center" style={{ width: '8%', fontSize: 10 }}>Satuan</th>
                <th className="text-right" style={{ width: '15%', fontSize: 10 }}>Harga Satuan</th>
                <th className="text-right" style={{ width: '15%', fontSize: 10 }}>Total (Rp)</th>
              </tr>
            </thead>
            <tbody>
              {session1Pivot.map((row, idx) => (
                <tr key={idx}>
                  <td className="text-center" style={{ fontSize: 9.5 }}>{idx + 1}</td>
                  <td style={{ fontWeight: 600, fontSize: 9.5 }}>{row.name}</td>
                  {uniqueCustomers.map(cust => (
                    <td key={cust} className="text-center" style={{ fontSize: 9.5 }}>
                      {row.customerQty[cust] ? formatNumber(row.customerQty[cust]) : '-'}
                    </td>
                  ))}
                  <td className="text-center" style={{ fontWeight: 'bold', color: '#1e40af', fontSize: 9.5 }}>
                    {formatNumber(row.totalQty)}
                  </td>
                  <td className="text-center" style={{ fontSize: 9.5 }}>{row.unit}</td>
                  <td className="text-right" style={{ fontSize: 9.5 }}>{formatCurrency(row.price)}</td>
                  <td className="text-right" style={{ fontWeight: 'bold', color: '#1e40af', fontSize: 9.5 }}>
                    {formatCurrency(row.totalRowValue)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="total-row">
                <td colSpan={uniqueCustomers.length + 5} style={{ textAlign: 'right', fontSize: 10, fontWeight: 'bold', color: '#1e3a8a' }}>
                  Total Penjualan Gabungan:
                </td>
                <td className="text-right" style={{ fontSize: 10, fontWeight: 'bold', color: '#1e3a8a' }}>
                  {formatCurrency(session1Total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* SESSION 2: Rekap Pembelian Semua Bahan Baku */}
        <div className="section-title" style={{ borderColor: '#10b981', color: '#10b981' }}>
          Session 2: Rekap Pembelian Gabungan Bahan Baku
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th style={{ width: '40%', fontSize: 10 }}>Bahan Baku</th>
                <th className="text-center" style={{ width: '12%', fontSize: 10 }}>Qty Beli</th>
                <th className="text-right" style={{ width: '16%', fontSize: 10 }}>H. Pembelian</th>
                <th className="text-right" style={{ width: '16%', fontSize: 10 }}>H. Penjualan</th>
                <th className="text-right" style={{ width: '16%', fontSize: 10 }}>Laba</th>
                <th className="text-center" style={{ width: '10%', fontSize: 10 }}>Margin %</th>
              </tr>
            </thead>
            <tbody>
              {session2Data.filter(it => !it.isParentItem).map((item, idx) => {
                const isMixVegParent = item.isParentItem;
                let sellPrice = getAvgSellPrice(item.materialName);
                if (sellPrice === 0) sellPrice = Number(item.sellPrice) || 0;

                const totalBeli = isMixVegParent ?
                  session2Data.filter(sub => sub.isSubItem && sub.parentName === item.materialName).reduce((s, sub) => s + (Number(sub.totalCost) || 0), 0)
                    : (Number(item.totalCost) || 0);

                const invQtyTotal = Number(item.invoiceQty) || Number(item.qtyNota) || 0;
                const displayPricePerUnit = isMixVegParent ?
                  (invQtyTotal > 0 ? totalBeli / invQtyTotal : 0)
                  : (item.qtyNota > 0 ? totalBeli / item.qtyNota : 0);

                const totalJual = invQtyTotal * sellPrice;
                const rowLaba = totalJual - totalBeli;
                const margin = totalJual > 0 ? (rowLaba / totalJual * 100) : 0;
                const displayQty = isMixVegParent ? '' : item.qtyNota;

                return (
                  <tr key={idx}>
                    <td style={{
                      color: item.isSubItem ? '#8b5cf6' : '#000000',
                      fontWeight: isMixVegParent ? 'bold' : 'normal',
                      paddingLeft: item.isSubItem ? '5mm' : '4mm',
                      fontSize: 9.5
                    }}>
                      {item.isSubItem ? '↳ ' : ''}{item.materialName}
                    </td>
                    <td className="text-center" style={{ fontSize: 9.5 }}>
                      {displayQty !== '' ? `${formatNumber(displayQty)} ${item.unit}` : ''}
                    </td>
                    <td className="text-right" style={{ fontSize: 9.5 }}>
                      {displayPricePerUnit > 0 ? formatCurrency(displayPricePerUnit) : '-'}
                    </td>
                    <td className="text-right" style={{ fontSize: 9.5 }}>
                      {sellPrice > 0 ? formatCurrency(sellPrice) : '-'}
                    </td>
                    <td className="text-right" style={{
                      color: rowLaba >= 0 ? '#15803d' : '#dc2626',
                      fontWeight: 'bold',
                      fontSize: 9.5
                    }}>
                      {(totalJual > 0 || isMixVegParent) ? formatCurrency(rowLaba) : (item.isSubItem ? '-' : formatCurrency(rowLaba))}
                    </td>
                    <td className="text-center" style={{
                      color: margin >= 0 ? '#15803d' : '#dc2626',
                      fontSize: 9.5
                    }}>
                      {totalJual > 0 ? `${margin.toFixed(1)}%` : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* SESSION 3: Rekap Pembelian per Supplier */}
        <div className="section-title" style={{ borderColor: '#8b5cf6', color: '#8b5cf6' }}>
          Session 3: Rincian Pembelian per Supplier
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th style={{ width: '4%', fontSize: 10 }}>No</th>
                <th style={{ width: '20%', fontSize: 10 }}>Supplier</th>
                <th style={{ width: '30%', fontSize: 10 }}>Item Pembelian</th>
                <th className="text-center" style={{ width: '15%', fontSize: 10 }}>Qty Pembelian</th>
                <th className="text-right" style={{ width: '15%', fontSize: 10 }}>H. Pembelian</th>
                <th className="text-right" style={{ width: '16%', fontSize: 10 }}>Total Beli</th>
              </tr>
            </thead>
            <tbody>
              {supplierGroups.map(([s, items], sIdx) => {
                return (
                  <React.Fragment key={`${sIdx}-${items.length}`}>
                    {items.map((item, iIdx) => {
                      const isMixVegParent = item.isParentItem && (item.materialName || '').toLowerCase().includes('mix vegetable');
                      const totalBeli = isMixVegParent ?
                        items.filter(sub => sub.isSubItem && sub.parentName === item.materialName).reduce((s, sub) => s + (Number(sub.totalCost) || 0), 0)
                          : (Number(item.totalCost) || 0);
                      const invQtyTotal = Number(item.invoiceQty) || Number(item.qtyNota) || 0;
                      const priceUnit = isMixVegParent ?
                        (invQtyTotal > 0 ? totalBeli / invQtyTotal : 0)
                        : (Number(item.pricePerUnit) || 0);
                      const displayQty = isMixVegParent ? '' : item.qtyNota;

                      return (
                        <tr key={iIdx}>
                          {iIdx === 0 && (
                            <td rowSpan={items.length} style={{
                              verticalAlign: 'top',
                              fontWeight: 'bold',
                              color: '#1e40af'
                            }}>
                              {s}
                            </td>
                          )}
                          <td style={{
                            color: item.isSubItem ? '#8b5cf6' : '#000000',
                            fontWeight: isMixVegParent ? 'bold' : 'normal',
                            paddingLeft: item.isSubItem ? '5mm' : '4mm'
                          }}>
                            {item.isSubItem ? '↳ ' : ''}{item.materialName}
                          </td>
                          <td className="text-center">
                            {displayQty !== '' ? `${formatNumber(displayQty)} ${item.unit}` : ''}
                          </td>
                          <td className="text-right">
                            {priceUnit > 0 ? formatCurrency(priceUnit) : '-'}
                          </td>
                          <td className="text-right" style={{ fontWeight: 'bold' }}>
                            {totalBeli > 0 ? formatCurrency(totalBeli) : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* SESSION 4: Laporan Laba Rugi */}
        <div className="section-title" style={{ borderColor: '#f59e0b', color: '#f59e0b' }}>
          Session 4: Laporan Laba Rugi per Pelanggan
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th className="text-right" style={{ width: '25%', fontSize: 10 }}>Total Penjualan</th>
                <th className="text-right" style={{ width: '25%', fontSize: 10 }}>Total Pembelian</th>
                <th className="text-right" style={{ width: '25%', fontSize: 10 }}>Laba / Rugi</th>
                <th className="text-center" style={{ width: '25%', fontSize: 10 }}>Margin %</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const totalRev = session1Total;
                const totalPurchase = grandTotalNet;
                const totalProfit = totalRev - totalPurchase;
                const totalMargin = totalRev > 0 ? (totalProfit / totalRev * 100) : 0;
                return (
                  <tr className="total-row">
                    <td style={{ fontSize: 11, fontWeight: 'bold', color: '#1e3a8a' }}>
                      {formatCurrency(totalRev)}
                    </td>
                    <td style={{ fontSize: 11, fontWeight: 'bold', color: '#dc2626' }}>
                      {formatCurrency(totalPurchase)}
                    </td>
                    <td style={{ fontSize: 11, fontWeight: 'bold', color: totalProfit >= 0 ? '#15803d' : '#dc2626' }}>
                      {formatCurrency(totalProfit)}
                    </td>
                    <td className="text-center" style={{ fontSize: 11, fontWeight: 'bold', color: totalMargin >= 0 ? '#15803d' : '#dc2626' }}>
                      {totalMargin.toFixed(1)}%
                    </td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>

        {/* SESSION 5: Tabel Pembayaran Supplier */}
        <div className="section-title" style={{ borderColor: '#06b6d4', color: '#06b6d4' }}>
          Session 5: Tabel Pembayaran Supplier
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th style={{ width: '4%', fontSize: 10 }}>No</th>
                <th style={{ width: '20%', fontSize: 10 }}>Nama Supplier</th>
                <th className="text-right" style={{ width: '16%', fontSize: 10 }}>Subtotal</th>
                <th className="text-right" style={{ width: '12%', fontSize: 10 }}>Diskon</th>
                <th className="text-right" style={{ width: '16%', fontSize: 10 }}>Net Bayar</th>
                <th style={{ width: '32%', fontSize: 10 }}>Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {supplierGroups.map(([s, items], idx) => {
                const discount = Number(supplierDiscounts[s]) || 0;
                const subtotal = items.reduce((sum, item) => {
                  if (item.isParentItem && (item.materialName || '').toLowerCase().includes('mix vegetable')) return sum;
                  return sum + (Number(item.totalCost) || 0);
                }, 0);
                const netToPay = Math.max(0, subtotal - discount);

                const suppInfo = (suppliersData || []).find(sd => (sd.name || '').toLowerCase() === s.toLowerCase());

                return (
                  <tr key={idx}>
                    <td className="text-center" style={{ fontSize: 9.5 }}>{idx + 1}</td>
                    <td style={{ fontWeight: 'bold', color: '#1e40af', fontSize: 9.5 }}>{s}</td>
                    <td className="text-right" style={{ fontSize: 9.5 }}>{formatCurrency(subtotal)}</td>
                    <td className="text-right" style={{ color: discount > 0 ? '#dc2626' : '#3b82f6', fontSize: 9.5 }}>
                      {discount > 0 ? `-${formatCurrency(discount)}` : '-'}
                    </td>
                    <td className="text-right" style={{ fontWeight: 'bold', color: '#15803d', fontSize: 9.5 }}>
                      {formatCurrency(netToPay)}
                    </td>
                    <td style={{ fontSize: 9 }}>
                      {suppInfo && suppInfo.bankName ? (
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 9 }}>{suppInfo.bankName}</div>
                          <div style={{ color: '#06b6d4', fontSize: 9 }}>{suppInfo.accountNumber} a/n {suppInfo.accountName}</div>
                        </div>
                      ) : (
                        <span style={{ color: '#06b6d4', fontStyle: 'italic', fontSize: 9 }}>Belum diatur</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              {totalAdditionalCosts > 0 && (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'right', fontSize: 10, fontWeight: 'bold', color: '#1e3a8a' }}>
                    + Biaya Tambahan:
                  </td>
                  <td className="text-right" style={{ fontSize: 10, fontWeight: 'bold', color: '#1e3a8a' }}>
                    {formatCurrency(totalAdditionalCosts)}
                  </td>
                </tr>
              )}
              <tr className="net-total-row">
                <td colSpan="5" style={{ textAlign: 'right', fontSize: 12, fontWeight: 'bold' }}>
                  GRAND TOTAL TRANSFER:
                </td>
                <td className="text-right" style={{ fontSize: 12, fontWeight: 'bold' }}>
                  {formatCurrency(grandTotalNet)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* FOOTER - Tanda Tangan */}
        <div className="footer">
          <div className="signature-section">
            <div className="signature-item">
              <p style={{ margin: '0 0 8px 0', fontSize: 10, color: '#3b82f6', fontWeight: 600, textTransform: 'uppercase' }}>
                Diperiksa Oleh,
              </p>
              <strong style={{ display: 'block', marginBottom: '25px', color: '#1e40af', fontSize: 12 }}>Bagian Operasional</strong>
              <div className="signature-line" />
            </div>
            <div className="signature-item">
              <p style={{ margin: '0 0 8px 0', fontSize: 10, color: '#3b82f6', fontWeight: 600, textTransform: 'uppercase' }}>
                Dibuat Oleh,
              </p>
              <strong style={{ display: 'block', marginBottom: '25px', color: '#1e40af', fontSize: 12 }}>Admin Pembelian</strong>
              <div className="signature-line" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
