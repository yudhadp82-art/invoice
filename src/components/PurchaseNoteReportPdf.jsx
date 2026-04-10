import React from 'react';
import { formatCurrency, formatDateShort, formatNumber } from '../utils/formatter';
import { computePurchaseReportModel } from '../utils/purchaseReportModel';

/** Pratinjau HTML laporan (opsional). PDF unduhan memakai `PurchaseNoteReportPdfDocument` (@react-pdf/renderer). */
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

  const model = computePurchaseReportModel({
    groupName,
    date,
    purchaseItems,
    supplierName,
    supplierDiscounts,
    invoicesList,
    additionalCosts
  });
  const {
    session1Total,
    uniqueCustomers,
    session1Pivot,
    session2Data,
    getAvgSellPrice,
    supplierGroups,
    session4Data,
    session4SumRev,
    session4SumHpp,
    session4SumProfit,
    totalAdditionalCosts,
    grandTotalNet,
    groupProfit,
    groupMarginPct,
    custColCount
  } = model;
  const pivotHeadFont = custColCount > 10 ? 7 : custColCount > 6 ? 8 : 9;
  const pivotCellFont = custColCount > 10 ? 7 : custColCount > 6 ? 8 : 9;

  const docRef = `${formatDateShort(date)} · ${String(groupName).slice(0, 40)}`;

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 12mm 12mm 14mm; }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }

        .pdf-container {
          width: 100%;
          max-width: 190mm;
          margin: 0 auto;
          padding: 0 0 28px 0;
          box-sizing: border-box;
          color: #0f172a;
          font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
          font-size: 10px;
          line-height: 1.35;
        }
        .pdf-container * { box-sizing: border-box; }

        .pdf-header {
          text-align: center;
          padding: 10px 8px 14px;
          border-bottom: 3px solid #1e3a8a;
          margin-bottom: 14px;
        }
        .pdf-header h1 {
          margin: 6px 0 4px;
          font-size: 15px;
          font-weight: 800;
          color: #1e3a8a;
          letter-spacing: 0.03em;
          text-transform: uppercase;
        }
        .pdf-header .subtitle {
          margin: 0 0 8px;
          font-size: 11px;
          font-weight: 600;
          color: #334155;
        }
        .pdf-meta {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 8px 16px;
          font-size: 9.5px;
          color: #475569;
          margin-top: 8px;
        }
        .pdf-meta span strong { color: #0f172a; }

        .pdf-section {
          margin-bottom: 16px;
        }
        .section-heading {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #1e3a8a;
          padding: 6px 10px;
          margin: 0 0 8px 0;
          background: linear-gradient(90deg, #eff6ff 0%, #f8fafc 100%);
          border-left: 4px solid #2563eb;
        }

        .pdf-table-wrap {
          overflow: visible;
          margin: 0;
        }

        .pdf-container table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          font-size: 9px;
        }
        .pdf-container thead {
          display: table-header-group;
        }
        .pdf-container thead th {
          background: #1e3a8a;
          color: #ffffff !important;
          font-weight: 700;
          padding: 6px 4px;
          border: 1px solid #1e3a8a;
          text-align: left;
          vertical-align: middle;
          word-wrap: break-word;
          hyphens: auto;
        }
        .pdf-container tbody td {
          padding: 5px 4px;
          border: 1px solid #cbd5e1;
          vertical-align: top;
          word-wrap: break-word;
          overflow-wrap: anywhere;
          color: #0f172a !important;
        }
        .pdf-container tbody tr:nth-child(even) td {
          background: #f8fafc;
        }
        .pdf-container tfoot td,
        .pdf-container tfoot th {
          padding: 6px 4px;
          border: 1px solid #94a3b8;
          font-weight: 700;
        }

        .th-num { width: 4%; text-align: center !important; }
        .th-right { text-align: right !important; }
        .th-center { text-align: center !important; }
        .td-num { text-align: center; }
        .td-right { text-align: right; font-variant-numeric: tabular-nums; }
        .td-strong { font-weight: 700; color: #1e3a8a; }

        .total-row td {
          background: #dbeafe !important;
          font-weight: 700;
          color: #1e3a8a !important;
        }
        .grand-row td {
          background: #1e3a8a !important;
          color: #ffffff !important;
          font-weight: 800;
        }
        .profit-pos { color: #15803d !important; font-weight: 700; }
        .profit-neg { color: #b91c1c !important; font-weight: 700; }

        .pdf-footer-sign {
          margin-top: 22px;
          padding-top: 16px;
          border-top: 2px solid #cbd5e1;
        }
        .signature-section {
          display: flex;
          justify-content: space-between;
          gap: 24px;
          max-width: 160mm;
          margin: 0 auto;
        }
        .signature-item {
          flex: 1;
          text-align: center;
          min-width: 0;
        }
        .signature-item .role {
          font-size: 9px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          margin: 0 0 6px;
        }
        .signature-item .name {
          font-size: 10px;
          font-weight: 800;
          color: #1e3a8a;
          margin: 0 0 28px;
        }
        .signature-line {
          height: 1px;
          background: #0f172a;
          margin: 0 auto;
          max-width: 140px;
        }

        @media screen {
          #purchase-note-report-render {
            box-shadow: 0 4px 24px rgba(15, 23, 42, 0.12);
            margin: 20px auto;
            padding: 24px;
            background: white;
            border-radius: 4px;
          }
        }
      `}</style>

      <div id="purchase-note-report-render" className="pdf-container print-only">
        <header className="pdf-header">
          <div style={{ marginBottom: 6 }}>
            <img src="/logo-kdmp.png" alt="" style={{ maxWidth: 100, maxHeight: 44, objectFit: 'contain' }} />
          </div>
          <h1>Koperasi Desa Merah Putih Sindangjaya</h1>
          <p className="subtitle">Laporan pembelian &amp; penjualan komprehensif</p>
          <div className="pdf-meta">
            <span><strong>Grup:</strong> {groupName}</span>
            <span><strong>Tanggal:</strong> {formatDateShort(date)}</span>
            <span><strong>Ref:</strong> {docRef}</span>
          </div>
        </header>

        {/* I — Rekap penjualan */}
        <section className="pdf-section">
          <h2 className="section-heading">I. Rekapitulasi penjualan per komoditas dan pelanggan</h2>
          <div className="pdf-table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="th-num" style={{ width: '3%' }}>No</th>
                  <th style={{ width: custColCount > 8 ? '14%' : '18%' }}>Komoditas</th>
                  {uniqueCustomers.map(cust => (
                    <th key={cust} className="th-center" style={{ fontSize: pivotHeadFont, padding: '5px 2px' }}>
                      {cust.length > 14 ? `${cust.slice(0, 12)}…` : cust}
                    </th>
                  ))}
                  <th className="th-center" style={{ width: '6%' }}>Total qty</th>
                  <th className="th-center" style={{ width: '5%' }}>Sat.</th>
                  <th className="th-right" style={{ width: '11%' }}>Harga / satuan</th>
                  <th className="th-right" style={{ width: '12%' }}>Jumlah (Rp)</th>
                </tr>
              </thead>
              <tbody>
                {session1Pivot.map((row, idx) => (
                  <tr key={`${row.name}-${row.price}-${idx}`}>
                    <td className="td-num" style={{ fontSize: pivotCellFont }}>{idx + 1}</td>
                    <td className="td-strong" style={{ fontSize: pivotCellFont }}>{row.name}</td>
                    {uniqueCustomers.map(cust => (
                      <td key={cust} className="td-num" style={{ fontSize: pivotCellFont }}>
                        {row.customerQty[cust] ? formatNumber(row.customerQty[cust]) : '—'}
                      </td>
                    ))}
                    <td className="td-num td-strong" style={{ fontSize: pivotCellFont }}>{formatNumber(row.totalQty)}</td>
                    <td className="td-num" style={{ fontSize: pivotCellFont }}>{row.unit}</td>
                    <td className="td-right" style={{ fontSize: pivotCellFont }}>{formatCurrency(row.price)}</td>
                    <td className="td-right td-strong" style={{ fontSize: pivotCellFont }}>{formatCurrency(row.totalRowValue)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="total-row">
                  <td colSpan={uniqueCustomers.length + 5} className="td-right" style={{ fontSize: 10 }}>
                    Total penjualan gabungan
                  </td>
                  <td className="td-right" style={{ fontSize: 10 }}>{formatCurrency(session1Total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {/* II — Pembelian bahan */}
        <section className="pdf-section">
          <h2 className="section-heading">II. Rekapitulasi pembelian bahan baku &amp; margin</h2>
          <div className="pdf-table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '34%' }}>Bahan baku</th>
                  <th className="th-center" style={{ width: '11%' }}>Qty beli</th>
                  <th className="th-right" style={{ width: '14%' }}>Harga beli / unit</th>
                  <th className="th-right" style={{ width: '14%' }}>Harga jual rata-rata</th>
                  <th className="th-right" style={{ width: '14%' }}>Laba (est.)</th>
                  <th className="th-center" style={{ width: '13%' }}>Margin %</th>
                </tr>
              </thead>
              <tbody>
                {session2Data.filter(it => !it.isParentItem).map((item, idx) => {
                  const isMixVegParent = item.isParentItem;
                  let sellPrice = getAvgSellPrice(item.materialName);
                  if (sellPrice === 0) sellPrice = Number(item.sellPrice) || 0;

                  const totalBeli = isMixVegParent
                    ? session2Data.filter(sub => sub.isSubItem && sub.parentName === item.materialName).reduce((s, sub) => s + (Number(sub.totalCost) || 0), 0)
                    : (Number(item.totalCost) || 0);

                  const invQtyTotal = Number(item.invoiceQty) || Number(item.qtyNota) || 0;
                  const displayPricePerUnit = isMixVegParent
                    ? (invQtyTotal > 0 ? totalBeli / invQtyTotal : 0)
                    : (item.qtyNota > 0 ? totalBeli / item.qtyNota : 0);

                  const totalJual = invQtyTotal * sellPrice;
                  const rowLaba = totalJual - totalBeli;
                  const margin = totalJual > 0 ? (rowLaba / totalJual * 100) : 0;
                  const displayQty = isMixVegParent ? '' : item.qtyNota;

                  return (
                    <tr key={`s2-${idx}-${item.materialName}`}>
                      <td
                        style={{
                          color: item.isSubItem ? '#6d28d9' : '#0f172a',
                          fontWeight: isMixVegParent ? 700 : 500,
                          paddingLeft: item.isSubItem ? '10px' : '5px'
                        }}
                      >
                        {item.isSubItem ? '↳ ' : ''}{item.materialName}
                      </td>
                      <td className="td-num">
                        {displayQty !== '' ? `${formatNumber(displayQty)} ${item.unit || ''}` : '—'}
                      </td>
                      <td className="td-right">{displayPricePerUnit > 0 ? formatCurrency(displayPricePerUnit) : '—'}</td>
                      <td className="td-right">{sellPrice > 0 ? formatCurrency(sellPrice) : '—'}</td>
                      <td className={`td-right ${rowLaba >= 0 ? 'profit-pos' : 'profit-neg'}`}>
                        {(totalJual > 0 || isMixVegParent) ? formatCurrency(rowLaba) : (item.isSubItem ? '—' : formatCurrency(rowLaba))}
                      </td>
                      <td className={`td-num ${margin >= 0 ? 'profit-pos' : 'profit-neg'}`}>
                        {totalJual > 0 ? `${margin.toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* III — Per supplier */}
        <section className="pdf-section">
          <h2 className="section-heading">III. Rincian pembelian per supplier</h2>
          <div className="pdf-table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="th-num" style={{ width: '4%' }}>No</th>
                  <th style={{ width: '18%' }}>Supplier</th>
                  <th style={{ width: '28%' }}>Item</th>
                  <th className="th-center" style={{ width: '14%' }}>Qty</th>
                  <th className="th-right" style={{ width: '14%' }}>Harga / unit</th>
                  <th className="th-right" style={{ width: '14%' }}>Subtotal (Rp)</th>
                </tr>
              </thead>
              <tbody>
                {supplierGroups.flatMap(([s, items], sIdx) =>
                  items.map((item, iIdx) => {
                    const isMixVegParent = item.isParentItem && (item.materialName || '').toLowerCase().includes('mix vegetable');
                    const totalBeli = isMixVegParent
                      ? items.filter(sub => sub.isSubItem && sub.parentName === item.materialName).reduce((acc, sub) => acc + (Number(sub.totalCost) || 0), 0)
                      : (Number(item.totalCost) || 0);
                    const invQtyTotal = Number(item.invoiceQty) || Number(item.qtyNota) || 0;
                    const priceUnit = isMixVegParent
                      ? (invQtyTotal > 0 ? totalBeli / invQtyTotal : 0)
                      : (Number(item.pricePerUnit) || 0);
                    const displayQty = isMixVegParent ? '' : item.qtyNota;

                    return (
                      <tr key={`s3-${sIdx}-${iIdx}-${item.materialName}`}>
                        {iIdx === 0 && (
                          <td rowSpan={items.length} className="td-num td-strong" style={{ verticalAlign: 'top' }}>
                            {sIdx + 1}
                          </td>
                        )}
                        {iIdx === 0 && (
                          <td rowSpan={items.length} className="td-strong" style={{ verticalAlign: 'top' }}>
                            {s}
                          </td>
                        )}
                        <td
                          style={{
                            color: item.isSubItem ? '#6d28d9' : '#0f172a',
                            fontWeight: isMixVegParent ? 700 : 500,
                            paddingLeft: item.isSubItem ? '10px' : '5px'
                          }}
                        >
                          {item.isSubItem ? '↳ ' : ''}{item.materialName}
                        </td>
                        <td className="td-num">
                          {displayQty !== '' ? `${formatNumber(displayQty)} ${item.unit || ''}` : '—'}
                        </td>
                        <td className="td-right">{priceUnit > 0 ? formatCurrency(priceUnit) : '—'}</td>
                        <td className="td-right td-strong">{totalBeli > 0 ? formatCurrency(totalBeli) : '—'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* IV — Laba rugi */}
        <section className="pdf-section">
          <h2 className="section-heading">IV. Laba rugi per pelanggan &amp; ringkasan grup</h2>
          <div className="pdf-table-wrap" style={{ marginBottom: 12 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '28%' }}>Pelanggan</th>
                  <th className="th-right" style={{ width: '18%' }}>Omset</th>
                  <th className="th-right" style={{ width: '18%' }}>Perkiraan HPP</th>
                  <th className="th-right" style={{ width: '18%' }}>Laba / (rugi)</th>
                  <th className="th-center" style={{ width: '18%' }}>Margin %</th>
                </tr>
              </thead>
              <tbody>
                {session4Data.map((row, i) => {
                  const m = row.revenue > 0 ? (row.profit / row.revenue) * 100 : 0;
                  return (
                    <tr key={`s4-${i}-${row.customer}`}>
                      <td className="td-strong">{row.customer}</td>
                      <td className="td-right">{formatCurrency(row.revenue)}</td>
                      <td className="td-right">{formatCurrency(row.hpp)}</td>
                      <td className={`td-right ${row.profit >= 0 ? 'profit-pos' : 'profit-neg'}`}>{formatCurrency(row.profit)}</td>
                      <td className={`td-num ${m >= 0 ? 'profit-pos' : 'profit-neg'}`}>{row.revenue > 0 ? `${m.toFixed(1)}%` : '—'}</td>
                    </tr>
                  );
                })}
                <tr className="total-row">
                  <td className="td-right">Jumlah (per pelanggan)</td>
                  <td className="td-right">{formatCurrency(session4SumRev)}</td>
                  <td className="td-right">{formatCurrency(session4SumHpp)}</td>
                  <td className={`td-right ${session4SumProfit >= 0 ? 'profit-pos' : 'profit-neg'}`}>{formatCurrency(session4SumProfit)}</td>
                  <td className="td-num">{session4SumRev > 0 ? `${((session4SumProfit / session4SumRev) * 100).toFixed(1)}%` : '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="pdf-table-wrap">
            <table>
              <thead>
                <tr>
                  <th colSpan={2}>Ringkasan arus kas &amp; laba grup</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ width: '55%', fontWeight: 600 }}>Total penjualan (invoice gabungan)</td>
                  <td className="td-right td-strong">{formatCurrency(session1Total)}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Total pembayaran ke supplier (net) + biaya tambahan</td>
                  <td className="td-right" style={{ fontWeight: 700, color: '#b91c1c' }}>{formatCurrency(grandTotalNet)}</td>
                </tr>
                <tr className="grand-row">
                  <td>Laba / (rugi) grup (setelah pembelian &amp; biaya)</td>
                  <td className="td-right">{formatCurrency(groupProfit)}</td>
                </tr>
                <tr className="total-row">
                  <td>Margin atas omset grup</td>
                  <td className="td-right">{groupMarginPct.toFixed(1)}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* V — Pembayaran supplier */}
        <section className="pdf-section">
          <h2 className="section-heading">V. Rekapitulasi pembayaran ke supplier</h2>
          <div className="pdf-table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="th-num" style={{ width: '4%' }}>No</th>
                  <th style={{ width: '20%' }}>Supplier</th>
                  <th className="th-right" style={{ width: '15%' }}>Subtotal</th>
                  <th className="th-right" style={{ width: '12%' }}>Diskon</th>
                  <th className="th-right" style={{ width: '15%' }}>Net bayar</th>
                  <th style={{ width: '34%' }}>Rekening / keterangan</th>
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
                    <tr key={`s5-${idx}-${s}`}>
                      <td className="td-num">{idx + 1}</td>
                      <td className="td-strong">{s}</td>
                      <td className="td-right">{formatCurrency(subtotal)}</td>
                      <td className="td-right" style={{ color: discount > 0 ? '#b91c1c' : '#64748b' }}>
                        {discount > 0 ? `−${formatCurrency(discount)}` : '—'}
                      </td>
                      <td className="td-right profit-pos">{formatCurrency(netToPay)}</td>
                      <td style={{ fontSize: 8.5, lineHeight: 1.3 }}>
                        {suppInfo && suppInfo.bankName ? (
                          <>
                            <div style={{ fontWeight: 700 }}>{suppInfo.bankName}</div>
                            <div style={{ color: '#0369a1' }}>{suppInfo.accountNumber} a/n {suppInfo.accountName}</div>
                          </>
                        ) : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Belum diatur</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                {totalAdditionalCosts > 0 && (
                  <tr>
                    <td colSpan={4} className="td-right" style={{ fontWeight: 700, background: '#eff6ff' }}>
                      + Biaya tambahan (lain-lain)
                    </td>
                    <td className="td-right" style={{ fontWeight: 800, background: '#eff6ff', color: '#1e3a8a' }}>
                      {formatCurrency(totalAdditionalCosts)}
                    </td>
                    <td style={{ background: '#eff6ff' }} />
                  </tr>
                )}
                <tr className="grand-row">
                  <td colSpan={4} className="td-right">
                    Total yang harus ditransfer (supplier + biaya)
                  </td>
                  <td className="td-right">{formatCurrency(grandTotalNet)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <footer className="pdf-footer-sign">
          <div className="signature-section">
            <div className="signature-item">
              <p className="role">Diperiksa oleh</p>
              <p className="name">Bagian operasional</p>
              <div className="signature-line" />
            </div>
            <div className="signature-item">
              <p className="role">Disusun oleh</p>
              <p className="name">Admin pembelian</p>
              <div className="signature-line" />
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
