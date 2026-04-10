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
          .pdf-container {
            width: 100%;
            max-width: 210mm;
            margin: 0 auto;
            background: white;
            box-sizing: border-box;
          }
          .header {
            text-align: center;
            padding: 15mm 15mm 20mm 15mm;
            border-bottom: 2px solid #1e40af;
            margin-bottom: 15mm;
            page-break-after: avoid;
          }
          .section-title {
            font-size: 13px;
            font-weight: bold;
            margin: 0 0 8mm 0;
            text-transform: uppercase;
            padding-left: 4mm;
            border-left: 3px solid;
            page-break-inside: avoid;
          }
          .table-container {
            margin: 0 0 10mm 0;
            page-break-inside: avoid;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
            page-break-inside: avoid;
          }
          thead {
            background: #f8fafc;
            font-weight: bold;
            border: 1px solid #cbd5e1;
          }
          th {
            padding: 6mm 4mm;
            text-align: left;
            border: 1px solid #e2e8f0;
          }
          th.text-center {
            text-align: center;
          }
          th.text-right {
            text-align: right;
          }
          td {
            padding: 6mm 4mm;
            border: 1px solid #e2e8f0;
            page-break-inside: avoid;
          }
          td.text-center {
            text-align: center;
          }
          td.text-right {
            text-align: right;
            font-weight: 600;
          }
          tfoot {
            background: #f1f5f9;
            font-weight: bold;
            border: 1px solid #cbd5e1;
          }
          .total-row td {
            background: #eff6ff;
            font-weight: bold;
          }
          .net-total-row td {
            background: #0f172a;
            color: white;
            font-weight: bold;
          }
          .footer {
            margin-top: 20mm;
            padding: 0 15mm 20mm 15mm;
            border-top: 2px solid #1e40af;
            page-break-before: always;
          }
          .signature-section {
            display: flex;
            justify-content: space-between;
            margin-top: 15mm;
            padding: 0 10mm 0 10mm;
            page-break-inside: avoid;
            page-break-after: avoid;
          }
          .signature-item {
            width: 150px;
            text-align: center;
          }
          .signature-item p {
            margin: 0;
            font-size: 11px;
          }
          .signature-item strong {
            margin: 0 0 3mm 0;
            font-size: 12px;
          }
          .signature-line {
            width: 100%;
            height: 1px;
            background: black;
            margin: 3mm 0;
          }
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
          <div style={{ marginBottom: 10 }}>
            <img src="/logo-kdmp.png" alt="Logo" style={{ maxWidth: 120, maxHeight: 50, objectFit: 'contain' }} />
          </div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 'bold', color: '#1e40af' }}>
            KOPERASI DESA MERAH PUTIH SINDANGJAYA
          </h1>
          <h2 style={{ margin: 0, fontSize: 14, color: '#475569' }}>
            LAPORAN PEMBELIAN & PENJUALAN KOMPREHENSIF
          </h2>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
            GRUP: <span style={{ color: '#3b82f6', fontWeight: 'bold' }}>{groupName.toUpperCase()}</span> | TANGGAL: {formatDateShort(date)}
          </p>
        </div>

        {/* SESSION 1: Rekap Invoice Gabungan */}
        <div className="section-title" style={{ borderColor: '#3b82f6' }}>
          Session 1: Rekap Penjualan Gabungan
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th style={{ width: '5%' }}>No</th>
                <th>Komoditas</th>
                {uniqueCustomers.map(cust => (
                  <th key={cust} className="text-center">{cust}</th>
                ))}
                <th className="text-center">Total</th>
                <th className="text-center">Satuan</th>
                <th className="text-right">Harga Satuan</th>
                <th className="text-right">Total (Rp)</th>
              </tr>
            </thead>
            <tbody>
              {session1Pivot.map((row, idx) => (
                <tr key={idx}>
                  <td className="text-center">{idx + 1}</td>
                  <td style={{ fontWeight: 600 }}>{row.name}</td>
                  {uniqueCustomers.map(cust => (
                    <td key={cust} className="text-center">
                      {row.customerQty[cust] ? formatNumber(row.customerQty[cust]) : '-'}
                    </td>
                  ))}
                  <td className="text-center" style={{ fontWeight: 'bold', color: '#312e81' }}>
                    {formatNumber(row.totalQty)}
                  </td>
                  <td className="text-center">{row.unit}</td>
                  <td className="text-right">{formatCurrency(row.price)}</td>
                  <td className="text-right" style={{ fontWeight: 'bold' }}>
                    {formatCurrency(row.totalRowValue)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="total-row">
                <td colSpan={uniqueCustomers.length + 5} style={{ textAlign: 'right', color: '#15803d' }}>
                  Total Penjualan Gabungan:
                </td>
                <td className="text-right" style={{ color: '#15803d' }}>
                  {formatCurrency(session1Total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* SESSION 2: Rekap Pembelian Semua Bahan Baku */}
        <div className="section-title" style={{ borderColor: '#10b981' }}>
          Session 2: Rekap Pembelian Gabungan Bahan Baku
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Bahan Baku</th>
                <th className="text-center">Qty Beli</th>
                <th className="text-right">H. Pembelian</th>
                <th className="text-right">H. Penjualan</th>
                <th className="text-right">Laba</th>
                <th className="text-center">Margin %</th>
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
                      color: item.isSubItem ? '#64748b' : '#1e293b',
                      fontWeight: isMixVegParent ? 'bold' : 'normal',
                      paddingLeft: item.isSubItem ? '5mm' : '4mm'
                    }}>
                      {item.isSubItem ? '↳ ' : ''}{item.materialName}
                    </td>
                    <td className="text-center">
                      {displayQty !== '' ? `${formatNumber(displayQty)} ${item.unit}` : ''}
                    </td>
                    <td className="text-right">
                      {displayPricePerUnit > 0 ? formatCurrency(displayPricePerUnit) : '-'}
                    </td>
                    <td className="text-right">
                      {sellPrice > 0 ? formatCurrency(sellPrice) : '-'}
                    </td>
                    <td className="text-right" style={{
                      color: rowLaba >= 0 ? '#166534' : '#991b1b',
                      fontWeight: 'bold'
                    }}>
                      {(totalJual > 0 || isMixVegParent) ? formatCurrency(rowLaba) : (item.isSubItem ? '-' : formatCurrency(rowLaba))}
                    </td>
                    <td className="text-center" style={{
                      color: margin >= 0 ? '#166534' : '#991b1b'
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
        <div className="section-title" style={{ borderColor: '#8b5cf6' }}>
          Session 3: Rincian Pembelian per Supplier
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th style={{ width: '5%' }}>No</th>
                <th>Supplier</th>
                <th>Item Pembelian</th>
                <th className="text-center">Qty Pembelian</th>
                <th className="text-right">H. Pembelian</th>
                <th className="text-right">Total Beli</th>
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
                            color: item.isSubItem ? '#64748b' : '#1e293b',
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
        <div className="section-title" style={{ borderColor: '#f59e0b' }}>
          Session 4: Laporan Laba Rugi per Pelanggan
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th className="text-right">Total Penjualan</th>
                <th className="text-right">Total Pembelian</th>
                <th className="text-right">Laba / Rugi</th>
                <th className="text-center">Margin %</th>
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
                    <td style={{ fontSize: 13, color: '#15803d' }}>
                      {formatCurrency(totalRev)}
                    </td>
                    <td style={{ fontSize: 13, color: '#dc2626' }}>
                      {formatCurrency(totalPurchase)}
                    </td>
                    <td style={{ fontSize: 13, color: totalProfit >= 0 ? '#166534' : '#991b1b' }}>
                      {formatCurrency(totalProfit)}
                    </td>
                    <td className="text-center" style={{ fontSize: 13, color: totalMargin >= 0 ? '#166534' : '#991b1b' }}>
                      {totalMargin.toFixed(1)}%
                    </td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>

        {/* SESSION 5: Tabel Pembayaran Supplier */}
        <div className="section-title" style={{ borderColor: '#06b6d4' }}>
          Session 5: Tabel Pembayaran Supplier
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th style={{ width: '5%' }}>No</th>
                <th style={{ width: '25%' }}>Nama Supplier</th>
                <th className="text-right" style={{ width: '15%' }}>Subtotal</th>
                <th className="text-right" style={{ width: '10%' }}>Diskon</th>
                <th className="text-right" style={{ width: '15%' }}>Net Bayar</th>
                <th style={{ width: '25%' }}>Keterangan</th>
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
                    <td className="text-center">{idx + 1}</td>
                    <td style={{ fontWeight: 'bold', color: '#1e40af' }}>{s}</td>
                    <td className="text-right">{formatCurrency(subtotal)}</td>
                    <td className="text-right" style={{ color: discount > 0 ? '#dc2626' : 'inherit' }}>
                      {discount > 0 ? `-${formatCurrency(discount)}` : '-'}
                    </td>
                    <td className="text-right" style={{ fontWeight: 'bold', color: '#15803d' }}>
                      {formatCurrency(netToPay)}
                    </td>
                    <td style={{ fontSize: 10 }}>
                      {suppInfo && suppInfo.bankName ? (
                        <div>
                          <div style={{ fontWeight: 600 }}>{suppInfo.bankName}</div>
                          <div style={{ color: '#64748b' }}>{suppInfo.accountNumber} a/n {suppInfo.accountName}</div>
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>Belum diatur</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              {totalAdditionalCosts > 0 && (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'right', color: '#8b5cf6', fontWeight: 'bold' }}>
                    + Biaya Tambahan:
                  </td>
                  <td className="text-right" style={{ color: '#8b5cf6', fontWeight: 'bold' }}>
                    {formatCurrency(totalAdditionalCosts)}
                  </td>
                </tr>
              )}
              <tr className="net-total-row">
                <td colSpan="5" style={{ textAlign: 'right', fontSize: 14 }}>
                  GRAND TOTAL TRANSFER:
                </td>
                <td className="text-right" style={{ fontSize: 14 }}>
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
              <p style={{ margin: 0, fontSize: 10, color: '#64748b', fontWeight: 600 }}>
                Diperiksa Oleh,
              </p>
              <strong style={{ color: '#1e40af' }}>Bagian Operasional</strong>
              <div className="signature-line" />
            </div>
            <div className="signature-item">
              <p style={{ margin: 0, fontSize: 10, color: '#64748b', fontWeight: 600 }}>
                Dibuat Oleh,
              </p>
              <strong style={{ color: '#1e40af' }}>Admin Pembelian</strong>
              <div className="signature-line" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
