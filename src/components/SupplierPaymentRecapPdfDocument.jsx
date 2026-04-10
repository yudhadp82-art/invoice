import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { formatCurrency, formatDateShort } from '../utils/formatter';
import { chunkArray } from '../utils/purchaseReportModel';

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 42,
    paddingHorizontal: 36,
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: '#0f172a',
    lineHeight: 1.35
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
  grandRow: { backgroundColor: '#1e3a8a', color: '#ffffff', fontWeight: 700 },
  grandText: { color: '#ffffff', fontWeight: 700, fontSize: 8 },
  footNote: {
    marginTop: 14,
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
  contLabel: { fontSize: 7, color: '#64748b', marginBottom: 4, textAlign: 'center' },
  logo: { width: 90, height: 36, marginBottom: 6, alignSelf: 'center', objectFit: 'contain' }
});

export default function SupplierPaymentRecapPdfDocument({
  filteredNotes,
  startDate,
  endDate,
  suppliersData = [],
  logoSrc
}) {
  if (!filteredNotes || filteredNotes.length === 0) {
    // Return empty document just in case
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <Text>No Notes Provided</Text>
        </Page>
      </Document>
    );
  }

  // Aggregate by Supplier
  const supplierAgg = {};
  let totalAdditionalCosts = 0;

  filteredNotes.forEach(note => {
    const items = note.items || [];
    const discountMap = note.supplierDiscounts || {};

    items.forEach(item => {
      // Ignore mix vegetable parent sum from supplier subtotal to prevent double counting
      if (item.isParentItem && (item.materialName || '').toLowerCase().includes('mix vegetable')) return;
      
      const sName = (item.supplier || 'Penyedia Barang Umum').trim();
      if (!supplierAgg[sName]) {
        supplierAgg[sName] = { name: sName, subtotal: 0, discount: 0, splitNotes: {} };
      }
      supplierAgg[sName].subtotal += (Number(item.totalCost) || 0);

      if (!supplierAgg[sName].splitNotes[note.id]) {
        supplierAgg[sName].splitNotes[note.id] = { date: note.date || note.createdAt, amount: 0 };
      }
      supplierAgg[sName].splitNotes[note.id].amount += (Number(item.totalCost) || 0);
    });

    Object.entries(discountMap).forEach(([sName, disc]) => {
      const nameKey = sName.trim() || 'Penyedia Barang Umum';
      if (!supplierAgg[nameKey]) {
        supplierAgg[nameKey] = { name: nameKey, subtotal: 0, discount: 0, splitNotes: {} };
      }
      supplierAgg[nameKey].discount += (Number(disc) || 0);
    });

    if (note.additionalCosts) {
      Object.values(note.additionalCosts).forEach(cost => {
        totalAdditionalCosts += (Number(cost) || 0);
      });
    }
  });

  const sRows = Object.values(supplierAgg).sort((a, b) => a.name.localeCompare(b.name));
  let grandTotalNet = totalAdditionalCosts;
  
  const enrichedRows = sRows.map((s, idx) => {
    const netToPay = Math.max(0, s.subtotal - s.discount);
    grandTotalNet += netToPay;
    const suppInfo = (suppliersData || []).find(sd => (sd.name || '').toLowerCase() === s.name.toLowerCase());
    
    const details = Object.values(s.splitNotes || {}).sort((a, b) => new Date(a.date) - new Date(b.date));
    
    return { ...s, idx, netToPay, suppInfo, details };
  });

  const periodText = (startDate && endDate) 
    ? `${formatDateShort(startDate)} s/d ${formatDateShort(endDate)}`
    : (startDate ? `Mulai ${formatDateShort(startDate)}` : (endDate ? `Hingga ${formatDateShort(endDate)}` : 'Semua Waktu'));

  const renderHeader = (continuation) => (
    <View fixed={false}>
      {logoSrc ? (
        <Image src={logoSrc} style={styles.logo} />
      ) : null}
      <Text style={styles.headerTitle}>Koperasi Desa Merah Putih Sindangjaya</Text>
      <Text style={styles.headerSub}>Laporan Rekapitulasi Pembayaran Supplier</Text>
      {continuation ? (
        <Text style={styles.contLabel}>(Lanjutan)</Text>
      ) : null}
      <View style={styles.metaRow}>
        <Text>
          <Text style={styles.metaBold}>Periode: </Text>
          {periodText}
        </Text>
      </View>
      <View style={styles.divider} />
    </View>
  );

  const pages = [];
  const sChunks = enrichedRows.length ? chunkArray(enrichedRows, 15) : [[]];

  sChunks.forEach((chunk, si) => {
    pages.push(
      <Page key={`psup-${si}`} size="A4" style={styles.page}>
        {si === 0 ? renderHeader(false) : renderHeader(true)}
        
        <Text style={styles.sectionTitle}>V. REKAPITULASI PEMBAYARAN KE SUPPLIER{si > 0 ? ' (lanjutan)' : ''}</Text>
        
        <View style={{ marginBottom: 10 }}>
          <View style={styles.tableHeader} wrap={false}>
            <Text style={[styles.th, { width: '4%', textAlign: 'center' }]}>No</Text>
            <Text style={[styles.th, { width: '20%' }]}>Supplier</Text>
            <Text style={[styles.th, { width: '15%', textAlign: 'right' }]}>Subtotal</Text>
            <Text style={[styles.th, { width: '12%', textAlign: 'right' }]}>Diskon</Text>
            <Text style={[styles.th, { width: '15%', textAlign: 'right' }]}>Net</Text>
            <Text style={[styles.th, styles.tdLast, { width: '34%' }]}>Rekening</Text>
          </View>
          
          {chunk.length === 0 ? (
            <View style={[styles.row]} wrap={false}>
              <Text style={[styles.td, { width: '100%', textAlign: 'center', borderRightWidth: 0, color: '#64748b' }]}>
                Tidak ada data rekapitulasi.
              </Text>
            </View>
          ) : (
            chunk.map((r, ri) => (
              <View key={`s5-${si}-${ri}`} style={[styles.row, ri % 2 === 1 ? styles.rowAlt : {}]} wrap={false}>
                <Text style={[styles.td, { width: '4%', textAlign: 'center' }]}>{r.idx + 1}</Text>
                <View style={[styles.td, { width: '20%' }]}>
                  <Text style={{ fontWeight: 700 }}>{r.name}</Text>
                  {r.details && r.details.length > 0 && (
                    <View style={{ marginTop: 2 }}>
                      {r.details.map((dn, i) => (
                        <Text key={i} style={{ fontSize: 6, color: '#334155', marginBottom: 1 }}>
                          • {formatDateShort(dn.date)}: {formatCurrency(dn.amount)}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
                <Text style={[styles.td, { width: '15%', textAlign: 'right' }]}>{formatCurrency(r.subtotal)}</Text>
                <Text style={[styles.td, { width: '12%', textAlign: 'right', color: r.discount > 0 ? '#b91c1c' : '#64748b' }]}>
                  {r.discount > 0 ? `−${formatCurrency(r.discount)}` : '—'}
                </Text>
                <Text style={[styles.td, { width: '15%', textAlign: 'right', fontWeight: 700, color: '#15803d' }]}>
                  {formatCurrency(r.netToPay)}
                </Text>
                <Text style={[styles.td, styles.tdLast, { width: '34%', fontSize: 7 }]}>
                  {r.suppInfo && r.suppInfo.bankName
                    ? `${r.suppInfo.bankName} — ${r.suppInfo.accountNumber} a/n ${r.suppInfo.accountName}`
                    : <Text style={{ color: '#94a3b8' }}>Belum diatur</Text>}
                </Text>
              </View>
            ))
          )}
          
          {si === sChunks.length - 1 && (
            <>
              {totalAdditionalCosts > 0 && (
                <View style={[styles.row, { backgroundColor: '#eff6ff' }]} wrap={false}>
                  <Text style={{ flexGrow: 1, textAlign: 'right', paddingVertical: 4, paddingHorizontal: 4, fontSize: 8, fontWeight: 700 }}>
                    + Biaya tambahan
                  </Text>
                  <Text style={{ width: '15%', textAlign: 'right', paddingVertical: 4, paddingHorizontal: 4, fontSize: 8, fontWeight: 700, color: '#1e3a8a' }}>
                    {formatCurrency(totalAdditionalCosts)}
                  </Text>
                  <Text style={{ width: '34%', borderRightWidth: 0 }} />
                </View>
              )}
              <View style={[styles.row, styles.grandRow]} wrap={false}>
                <Text style={[styles.grandText, { flexGrow: 1, textAlign: 'right', paddingVertical: 4, paddingHorizontal: 4 }]}>
                  Total transfer (supplier + biaya)
                </Text>
                <Text style={[styles.grandText, { width: '15%', textAlign: 'right', paddingVertical: 4, paddingHorizontal: 4 }]}>
                  {formatCurrency(grandTotalNet)}
                </Text>
                <Text style={{ width: '34%', borderRightWidth: 0 }} />
              </View>
            </>
          )}
        </View>

        {si === sChunks.length - 1 && (
          <View style={styles.footNote}>
            <View style={styles.signCol}>
              <Text style={styles.signLabel}>Diperiksa oleh</Text>
              <Text style={styles.signName}>Bagian operasional</Text>
              <View style={styles.signLine} />
            </View>
            <View style={styles.signCol}>
              <Text style={styles.signLabel}>Disusun oleh</Text>
              <Text style={styles.signName}>Admin Keuangan</Text>
              <View style={styles.signLine} />
            </View>
          </View>
        )}
      </Page>
    );
  });

  return (
    <Document
      title={`Rekapitulasi Pembayaran Supplier`}
      author="Koperasi Desa Merah Putih Sindangjaya"
      subject="Rekap Pembayaran Supplier"
      language="id"
    >
      {pages}
    </Document>
  );
}
