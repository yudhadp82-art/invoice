import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { formatCurrency, formatDateShort, formatNumber } from '../utils/formatter';
import { computePurchaseReportModel } from '../utils/purchaseReportModel';

const styles = StyleSheet.create({
  page: {
    paddingTop: 65, // Decreased since the main logo and title are removed
    paddingBottom: 42,
    paddingHorizontal: 36,
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: '#0f172a',
    lineHeight: 1.35
  },
  fixedHeader: {
    position: 'absolute',
    top: 36,
    left: 36,
    right: 36
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: '#1e3a8a',
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: 4
  },
  headerSub: {
    fontSize: 9,
    textAlign: 'center',
    color: '#334155',
    marginBottom: 6
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
    fontSize: 8,
    color: '#475569'
  },
  metaBold: { fontWeight: 700, color: '#0f172a' },
  divider: {
    borderBottomWidth: 2,
    borderBottomColor: '#1e3a8a',
    marginBottom: 10
  },
  sectionTitle: {
    fontSize: 8,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#1e3a8a',
    backgroundColor: '#eff6ff',
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginTop: 10,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#2563eb'
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1e3a8a',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#1e3a8a'
  },
  th: {
    color: '#ffffff',
    fontWeight: 700,
    fontSize: 7,
    paddingVertical: 4,
    paddingHorizontal: 3,
    borderRightWidth: 1,
    borderRightColor: '#1e3a8a'
  },
  row: {
    flexDirection: 'row',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff'
  },
  rowAlt: { backgroundColor: '#f8fafc' },
  td: {
    fontSize: 7,
    paddingVertical: 3,
    paddingHorizontal: 3,
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0'
  },
  tdLast: { borderRightWidth: 0 },
  totalRow: { backgroundColor: '#dbeafe', fontWeight: 700 },
  grandRow: { backgroundColor: '#1e3a8a', color: '#ffffff', fontWeight: 700 },
  grandText: { color: '#ffffff', fontWeight: 700, fontSize: 8 },
  profitPos: { color: '#15803d', fontWeight: 700 },
  profitNeg: { color: '#b91c1c', fontWeight: 700 },
  footNote: {
    marginTop: 18,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#cbd5e1',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  signCol: { width: '40%', alignItems: 'center' },
  signLabel: { fontSize: 7, color: '#64748b', fontWeight: 700, marginBottom: 4 },
  signName: { fontSize: 8, fontWeight: 700, color: '#1e3a8a', marginBottom: 24 },
  signLine: { width: 120, borderBottomWidth: 1, borderBottomColor: '#0f172a' },
  logo: { width: 90, height: 36, marginBottom: 6, alignSelf: 'center', objectFit: 'contain' }
});

export default function PurchaseNoteReportPdfDocument({
  groupName,
  date,
  purchaseItems,
  supplierName,
  supplierDiscounts = {},
  invoicesList = [],
  suppliersData = [],
  additionalCosts = {},
  logoSrc
}) {
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

  const pivotFont = custColCount > 10 ? 5.5 : custColCount > 6 ? 6.5 : 7;
  const custWidthPct = `${(47 / Math.max(uniqueCustomers.length, 1)).toFixed(2)}%`;

  const session2Rows = session2Data.filter(it => !it.isParentItem);

  const section3Flat = supplierGroups.flatMap(([s, items], sIdx) =>
    items.map((item, iIdx) => ({
      supplierName: s,
      supplierIndex: sIdx,
      rowInGroup: iIdx,
      item
    }))
  );

  const docRef = `${formatDateShort(date)} · ${String(groupName || '').slice(0, 40)}`;

  const renderHeader = () => (
    <View style={styles.fixedHeader} fixed>
      <View style={styles.metaRow}>
        <Text>
          <Text style={styles.metaBold}>Grup: </Text>
          {groupName}
        </Text>
        <Text>
          <Text style={styles.metaBold}>Tanggal: </Text>
          {formatDateShort(date)}
        </Text>
        <Text>
          <Text style={styles.metaBold}>Ref: </Text>
          {docRef}
        </Text>
      </View>
      <View style={styles.divider} />
    </View>
  );

  return (
    <Document
      title={`Laporan Pembelian — ${groupName}`}
      author="Koperasi Desa Merah Putih Sindangjaya"
      subject="Laporan pembelian & penjualan"
      language="id"
    >
      <Page size="A4" style={styles.page} wrap>
        {renderHeader()}

        {/* ========== SECTION 1 ========== */}
        <Text style={styles.sectionTitle}>I. Rekap penjualan per komoditas dan pelanggan</Text>
        {session1Pivot.length === 0 ? (
          <Text style={{ fontSize: 8, color: '#64748b', marginTop: 6 }}>Tidak ada data penjualan untuk grup ini.</Text>
        ) : (
          <View style={{ marginBottom: 10 }}>
            <View style={styles.tableHeader} wrap={false}>
              <Text style={[styles.th, { width: '3%', textAlign: 'center' }]}>No</Text>
              <Text style={[styles.th, { width: '16%' }]}>Komoditas</Text>
              {uniqueCustomers.map(c => (
                <Text key={c} style={[styles.th, { width: custWidthPct, textAlign: 'center', fontSize: pivotFont }]}>
                  {c.length > 12 ? `${c.slice(0, 10)}…` : c}
                </Text>
              ))}
              <Text style={[styles.th, { width: '6%', textAlign: 'center' }]}>Tot.qty</Text>
              <Text style={[styles.th, { width: '5%', textAlign: 'center' }]}>Sat.</Text>
              <Text style={[styles.th, { width: '11%', textAlign: 'right' }]}>Harga/u</Text>
              <Text style={[styles.th, styles.tdLast, { width: '12%', textAlign: 'right' }]}>Jumlah</Text>
            </View>
            {session1Pivot.map((row, idx) => (
              <View key={`s1-${idx}`} style={[styles.row, idx % 2 === 1 ? styles.rowAlt : {}]} wrap={false}>
                <Text style={[styles.td, { width: '3%', textAlign: 'center' }]}>{idx + 1}</Text>
                <Text style={[styles.td, { width: '16%', fontWeight: 700 }]}>{row.name}</Text>
                {uniqueCustomers.map(c => (
                  <Text key={c} style={[styles.td, { width: custWidthPct, textAlign: 'center', fontSize: pivotFont }]}>
                    {row.customerQty[c] ? formatNumber(row.customerQty[c]) : '—'}
                  </Text>
                ))}
                <Text style={[styles.td, { width: '6%', textAlign: 'center', fontWeight: 700 }]}>{formatNumber(row.totalQty)}</Text>
                <Text style={[styles.td, { width: '5%', textAlign: 'center' }]}>{row.unit}</Text>
                <Text style={[styles.td, { width: '11%', textAlign: 'right' }]}>{formatCurrency(row.price)}</Text>
                <Text style={[styles.td, styles.tdLast, { width: '12%', textAlign: 'right', fontWeight: 700 }]}>
                  {formatCurrency(row.totalRowValue)}
                </Text>
              </View>
            ))}
            <View style={[styles.row, styles.totalRow]} wrap={false}>
              <Text style={{ flexGrow: 1, textAlign: 'right', paddingVertical: 4, paddingHorizontal: 4, fontSize: 8, fontWeight: 700 }}>
                Total penjualan gabungan
              </Text>
              <Text style={{ width: '12%', textAlign: 'right', paddingVertical: 4, paddingHorizontal: 4, fontSize: 8, fontWeight: 700 }}>
                {formatCurrency(session1Total)}
              </Text>
            </View>
          </View>
        )}

        {/* ========== SECTION 2 ========== */}
        <Text style={styles.sectionTitle} wrap={false}>II. Rekapitulasi pembelian bahan baku & margin</Text>
        {session2Rows.length === 0 ? (
          <Text style={{ fontSize: 8, color: '#64748b' }}>Tidak ada baris pembelian bahan.</Text>
        ) : (
          <View style={{ marginBottom: 10 }}>
            <View style={styles.tableHeader} wrap={false}>
              <Text style={[styles.th, { width: '32%' }]}>Bahan baku</Text>
              <Text style={[styles.th, { width: '11%', textAlign: 'center' }]}>Qty beli</Text>
              <Text style={[styles.th, { width: '14%', textAlign: 'right' }]}>H.beli/u</Text>
              <Text style={[styles.th, { width: '14%', textAlign: 'right' }]}>H.jual rata2</Text>
              <Text style={[styles.th, { width: '14%', textAlign: 'right' }]}>Laba</Text>
              <Text style={[styles.th, styles.tdLast, { width: '15%', textAlign: 'center' }]}>Mar.%</Text>
            </View>
            {session2Rows.map((item, idx) => {
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
              const margin = totalJual > 0 ? (rowLaba / totalJual) * 100 : 0;
              const displayQty = isMixVegParent ? '' : item.qtyNota;
              const labaStr = (totalJual > 0 || isMixVegParent) ? formatCurrency(rowLaba) : (item.isSubItem ? '—' : formatCurrency(rowLaba));
              
              return (
                <View key={`s2-${idx}`} style={[styles.row, idx % 2 === 1 ? styles.rowAlt : {}]} wrap={false}>
                  <Text style={[styles.td, { width: '32%', color: item.isSubItem ? '#6d28d9' : '#0f172a' }]}>
                    {item.isSubItem ? '↳ ' : ''}{item.materialName}
                  </Text>
                  <Text style={[styles.td, { width: '11%', textAlign: 'center' }]}>
                    {displayQty !== '' ? `${formatNumber(displayQty)} ${item.unit || ''}` : '—'}
                  </Text>
                  <Text style={[styles.td, { width: '14%', textAlign: 'right' }]}>
                    {displayPricePerUnit > 0 ? formatCurrency(displayPricePerUnit) : '—'}
                  </Text>
                  <Text style={[styles.td, { width: '14%', textAlign: 'right' }]}>{sellPrice > 0 ? formatCurrency(sellPrice) : '—'}</Text>
                  <Text style={[styles.td, { width: '14%', textAlign: 'right', color: rowLaba >= 0 ? '#15803d' : '#b91c1c' }]}>{labaStr}</Text>
                  <Text style={[styles.td, styles.tdLast, { width: '15%', textAlign: 'center', color: margin >= 0 ? '#15803d' : '#b91c1c' }]}>
                    {totalJual > 0 ? `${margin.toFixed(1)}%` : '—'}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* ========== SECTION 3 ========== */}
        <Text style={styles.sectionTitle} wrap={false}>III. Rincian pembelian per supplier</Text>
        {section3Flat.length === 0 ? (
          <Text style={{ fontSize: 8, color: '#64748b' }}>Tidak ada rincian pembelian per supplier.</Text>
        ) : (
          <View style={{ marginBottom: 10 }}>
            <View style={styles.tableHeader} wrap={false}>
              <Text style={[styles.th, { width: '4%', textAlign: 'center' }]}>No</Text>
              <Text style={[styles.th, { width: '17%' }]}>Supplier</Text>
              <Text style={[styles.th, { width: '26%' }]}>Item</Text>
              <Text style={[styles.th, { width: '13%', textAlign: 'center' }]}>Qty</Text>
              <Text style={[styles.th, { width: '14%', textAlign: 'right' }]}>Harga/u</Text>
              <Text style={[styles.th, styles.tdLast, { width: '16%', textAlign: 'right' }]}>Subtotal</Text>
            </View>
            {section3Flat.map((row, idx) => {
              const { item, supplierName: s, supplierIndex, rowInGroup } = row;
              const isMixVegParent = item.isParentItem && (item.materialName || '').toLowerCase().includes('mix vegetable');
              const items = supplierGroups[supplierIndex][1];
              const totalBeli = isMixVegParent
                ? items.filter(sub => sub.isSubItem && sub.parentName === item.materialName).reduce((acc, sub) => acc + (Number(sub.totalCost) || 0), 0)
                : (Number(item.totalCost) || 0);
              const invQtyTotal = Number(item.invoiceQty) || Number(item.qtyNota) || 0;
              const priceUnit = isMixVegParent
                ? (invQtyTotal > 0 ? totalBeli / invQtyTotal : 0)
                : (Number(item.pricePerUnit) || 0);
              const displayQty = isMixVegParent ? '' : item.qtyNota;
              
              return (
                <View key={`s3-${idx}`} style={[styles.row, idx % 2 === 1 ? styles.rowAlt : {}]} wrap={false}>
                  <Text style={[styles.td, { width: '4%', textAlign: 'center', fontWeight: 700 }]}>
                    {rowInGroup === 0 ? String(supplierIndex + 1) : ''}
                  </Text>
                  <Text style={[styles.td, { width: '17%', fontWeight: 700 }]}>{rowInGroup === 0 ? s : ''}</Text>
                  <Text style={[styles.td, { width: '26%', color: item.isSubItem ? '#6d28d9' : '#0f172a' }]}>
                    {item.isSubItem ? '↳ ' : ''}{item.materialName}
                  </Text>
                  <Text style={[styles.td, { width: '13%', textAlign: 'center' }]}>
                    {displayQty !== '' ? `${formatNumber(displayQty)} ${item.unit || ''}` : '—'}
                  </Text>
                  <Text style={[styles.td, { width: '14%', textAlign: 'right' }]}>{priceUnit > 0 ? formatCurrency(priceUnit) : '—'}</Text>
                  <Text style={[styles.td, styles.tdLast, { width: '16%', textAlign: 'right', fontWeight: 700 }]}>
                    {totalBeli > 0 ? formatCurrency(totalBeli) : '—'}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* ========== SECTION 4 ========== */}
        <Text style={styles.sectionTitle} wrap={false}>IV. Laba rugi per pelanggan & ringkasan grup</Text>
        <View style={{ marginBottom: 14 }}>
          <View style={styles.tableHeader} wrap={false}>
            <Text style={[styles.th, { width: '28%' }]}>Pelanggan</Text>
            <Text style={[styles.th, { width: '18%', textAlign: 'right' }]}>Omset</Text>
            <Text style={[styles.th, { width: '18%', textAlign: 'right' }]}>HPP</Text>
            <Text style={[styles.th, { width: '18%', textAlign: 'right' }]}>Laba</Text>
            <Text style={[styles.th, styles.tdLast, { width: '18%', textAlign: 'center' }]}>Mar.%</Text>
          </View>
          {session4Data.map((row, i) => {
            const m = row.revenue > 0 ? (row.profit / row.revenue) * 100 : 0;
            return (
              <View key={`s4-${i}`} style={[styles.row, i % 2 === 1 ? styles.rowAlt : {}]} wrap={false}>
                <Text style={[styles.td, { width: '28%', fontWeight: 700 }]}>{row.customer}</Text>
                <Text style={[styles.td, { width: '18%', textAlign: 'right' }]}>{formatCurrency(row.revenue)}</Text>
                <Text style={[styles.td, { width: '18%', textAlign: 'right' }]}>{formatCurrency(row.hpp)}</Text>
                <Text style={[styles.td, { width: '18%', textAlign: 'right', color: row.profit >= 0 ? '#15803d' : '#b91c1c' }]}>
                  {formatCurrency(row.profit)}
                </Text>
                <Text style={[styles.td, styles.tdLast, { width: '18%', textAlign: 'center', color: m >= 0 ? '#15803d' : '#b91c1c' }]}>
                  {row.revenue > 0 ? `${m.toFixed(1)}%` : '—'}
                </Text>
              </View>
            );
          })}
          <View style={[styles.row, styles.totalRow]} wrap={false}>
            <Text style={[styles.td, { width: '28%', textAlign: 'right' }]}>Jumlah</Text>
            <Text style={[styles.td, { width: '18%', textAlign: 'right' }]}>{formatCurrency(session4SumRev)}</Text>
            <Text style={[styles.td, { width: '18%', textAlign: 'right' }]}>{formatCurrency(session4SumHpp)}</Text>
            <Text style={[styles.td, { width: '18%', textAlign: 'right', color: session4SumProfit >= 0 ? '#15803d' : '#b91c1c' }]}>
              {formatCurrency(session4SumProfit)}
            </Text>
            <Text style={[styles.td, styles.tdLast, { width: '18%', textAlign: 'center' }]}>
              {session4SumRev > 0 ? `${((session4SumProfit / session4SumRev) * 100).toFixed(1)}%` : '—'}
            </Text>
          </View>
        </View>

        {/* ========== RINGKASAN ARUS KAS ========== */}
        <View wrap={false} style={{ marginBottom: 14 }}>
          <Text style={[styles.sectionTitle, { marginTop: 0 }]}>Ringkasan arus kas & laba grup</Text>
          <View style={[styles.row]} wrap={false}>
            <Text style={[styles.td, { width: '62%', fontWeight: 700, borderRightWidth: 0 }]}>Total penjualan (invoice gabungan)</Text>
            <Text style={[styles.td, styles.tdLast, { width: '38%', textAlign: 'right', fontWeight: 700 }]}>{formatCurrency(session1Total)}</Text>
          </View>
          <View style={[styles.row, styles.rowAlt]} wrap={false}>
            <Text style={[styles.td, { width: '62%', fontWeight: 700, borderRightWidth: 0 }]}>Total pembayaran supplier (net) + biaya tambahan</Text>
            <Text style={[styles.td, styles.tdLast, { width: '38%', textAlign: 'right', fontWeight: 700, color: '#b91c1c' }]}>
              {formatCurrency(grandTotalNet)}
            </Text>
          </View>
          <View style={[styles.row, styles.grandRow]} wrap={false}>
            <Text style={[styles.grandText, { width: '62%', borderRightWidth: 0, paddingVertical: 4, paddingHorizontal: 4 }]}>Laba / (rugi) grup</Text>
            <Text style={[styles.grandText, { width: '38%', textAlign: 'right', paddingVertical: 4, paddingHorizontal: 4 }]}>{formatCurrency(groupProfit)}</Text>
          </View>
          <View style={[styles.row, styles.totalRow]} wrap={false}>
            <Text style={[styles.td, { width: '62%', fontWeight: 700, borderRightWidth: 0 }]}>Margin atas omset grup</Text>
            <Text style={[styles.td, styles.tdLast, { width: '38%', textAlign: 'right', fontWeight: 700 }]}>{groupMarginPct.toFixed(1)}%</Text>
          </View>
        </View>

        {/* ========== SECTION 5 ========== */}
        <Text style={styles.sectionTitle} wrap={false}>V. Rekapitulasi pembayaran ke supplier</Text>
        <View style={{ marginBottom: 10 }}>
          <View style={styles.tableHeader} wrap={false}>
            <Text style={[styles.th, { width: '4%', textAlign: 'center' }]}>No</Text>
            <Text style={[styles.th, { width: '18%' }]}>Supplier</Text>
            <Text style={[styles.th, { width: '15%', textAlign: 'right' }]}>Subtotal</Text>
            <Text style={[styles.th, { width: '12%', textAlign: 'right' }]}>Diskon</Text>
            <Text style={[styles.th, { width: '15%', textAlign: 'right' }]}>Net</Text>
            <Text style={[styles.th, styles.tdLast, { width: '36%' }]}>Rekening</Text>
          </View>
          {supplierGroups.length === 0 ? (
            <View style={[styles.row]} wrap={false}>
              <Text style={[styles.td, { width: '100%', textAlign: 'center', borderRightWidth: 0, color: '#64748b' }]}>
                Tidak ada data supplier.
              </Text>
            </View>
          ) : (
            supplierGroups.map(([s, items], idx) => {
              const discount = Number(supplierDiscounts[s]) || 0;
              const subtotal = items.reduce((sum, item) => {
                if (item.isParentItem && (item.materialName || '').toLowerCase().includes('mix vegetable')) return sum;
                return sum + (Number(item.totalCost) || 0);
              }, 0);
              const netToPay = Math.max(0, subtotal - discount);
              const suppInfo = (suppliersData || []).find(sd => (sd.name || '').toLowerCase() === s.toLowerCase());
              
              return (
                <View key={`s5-${idx}`} style={[styles.row, idx % 2 === 1 ? styles.rowAlt : {}]} wrap={false}>
                  <Text style={[styles.td, { width: '4%', textAlign: 'center' }]}>{idx + 1}</Text>
                  <Text style={[styles.td, { width: '18%', fontWeight: 700 }]}>{s}</Text>
                  <Text style={[styles.td, { width: '15%', textAlign: 'right' }]}>{formatCurrency(subtotal)}</Text>
                  <Text style={[styles.td, { width: '12%', textAlign: 'right', color: discount > 0 ? '#b91c1c' : '#64748b' }]}>
                    {discount > 0 ? `−${formatCurrency(discount)}` : '—'}
                  </Text>
                  <Text style={[styles.td, { width: '15%', textAlign: 'right', fontWeight: 700, color: '#15803d' }]}>
                    {formatCurrency(netToPay)}
                  </Text>
                  <Text style={[styles.td, styles.tdLast, { width: '36%', fontSize: 7 }]}>
                    {suppInfo && suppInfo.bankName
                      ? `${suppInfo.bankName} — ${suppInfo.accountNumber} a/n ${suppInfo.accountName}`
                      : <Text style={{ color: '#94a3b8' }}>Belum diatur</Text>}
                  </Text>
                </View>
              );
            })
          )}
          {totalAdditionalCosts > 0 && (
            <View style={[styles.row, { backgroundColor: '#eff6ff' }]} wrap={false}>
              <Text style={{ flexGrow: 1, textAlign: 'right', paddingVertical: 4, paddingHorizontal: 4, fontSize: 8, fontWeight: 700 }}>
                + Biaya tambahan
              </Text>
              <Text style={{ width: '18%', textAlign: 'right', paddingVertical: 4, paddingHorizontal: 4, fontSize: 8, fontWeight: 700, color: '#1e3a8a' }}>
                {formatCurrency(totalAdditionalCosts)}
              </Text>
              <Text style={{ width: '36%' }} />
            </View>
          )}
          <View style={[styles.row, styles.grandRow]} wrap={false}>
            <Text style={[styles.grandText, { flexGrow: 1, textAlign: 'right', paddingVertical: 4, paddingHorizontal: 4 }]}>
              Total transfer (supplier + biaya)
            </Text>
            <Text style={[styles.grandText, { width: '22%', textAlign: 'right', paddingVertical: 4, paddingHorizontal: 4 }]}>
              {formatCurrency(grandTotalNet)}
            </Text>
            <Text style={{ width: '29%', borderRightWidth: 0 }} />
          </View>
        </View>

        {/* ========== FOOTER ========== */}
        <View style={styles.footNote} wrap={false}>
          <View style={styles.signCol}>
            <Text style={styles.signLabel}>Diperiksa oleh</Text>
            <Text style={styles.signName}>Bagian operasional</Text>
            <View style={styles.signLine} />
          </View>
          <View style={styles.signCol}>
            <Text style={styles.signLabel}>Disusun oleh</Text>
            <Text style={styles.signName}>Admin pembelian</Text>
            <View style={styles.signLine} />
          </View>
        </View>

      </Page>
    </Document>
  );
}
