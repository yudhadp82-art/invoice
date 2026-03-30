import React from 'react';
import { formatCurrency, formatDateShort, formatNumber } from '../utils/formatter';

export default function HppPdfTemplate({ report }) {
  if (!report) return null;

  const labaKotor = report.labaKotor || 0;
  const isLoss = labaKotor < 0;

  return (
    <div id={`pdf-hpp-${report.id}`} style={{ position: 'absolute', top: -20000, left: -20000, width: '794px', background: 'white', color: 'black', padding: '30px 40px', boxSizing: 'border-box', fontFamily: '"Arial", sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '2px solid #ccc', paddingBottom: 6, marginBottom: 15 }}>
        <div style={{ width: 55, height: 55, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: 15 }}>
          <img src="/logo-kdmp.png" alt="(Logo)" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase' }}>KOPERASI DESA MERAH PUTIH</h2>
          <h3 style={{ margin: 0, fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' }}>SINDANGJAYA KECAMATAN CIPANAS</h3>
          <p style={{ margin: 0, fontSize: 8, color: '#555' }}>Jl. Pakalongan No. 06 Desa Sindangjaya, Cipanas, Cianjur, Jawa Barat.</p>
        </div>
      </div>

      <h3 style={{ textAlign: 'center', fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 15 }}>LAPORAN HPP (HARGA POKOK PENJUALAN)</h3>

      {/* Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 15 }}>
        <table>
          <tbody>
            <tr><td style={{ width: 70 }}>No. Invoice</td><td>: {report.invoiceNumber}</td></tr>
            <tr><td>Pelanggan</td><td>: {report.customerName}</td></tr>
          </tbody>
        </table>
        <table>
          <tbody>
            <tr><td>Tanggal HPP</td><td>: {formatDateShort(report.createdAt)}</td></tr>
          </tbody>
        </table>
      </div>

      {/* Item Cost Breakdown */}
      <div style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 5 }}>1. Rincian Modal per Item</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 15, fontSize: 10 }}>
        <thead>
          <tr style={{ background: '#f2f2f2' }}>
            <th style={{ border: '1px solid black', padding: '4px', width: '35%' }}>Nama Produk</th>
            <th style={{ border: '1px solid black', padding: '4px', width: '10%' }}>Qty</th>
            <th style={{ border: '1px solid black', padding: '4px', width: '15%', textAlign: 'right' }}>Harga Jual</th>
            <th style={{ border: '1px solid black', padding: '4px', width: '15%', textAlign: 'right' }}>Total Jual</th>
            <th style={{ border: '1px solid black', padding: '4px', width: '15%', textAlign: 'right' }}>Modal Item</th>
            <th style={{ border: '1px solid black', padding: '4px', width: '10%', textAlign: 'right' }}>Laba</th>
          </tr>
        </thead>
        <tbody>
          {(report.itemCosts || []).map((item, i) => {
            const labaItem = (item.subtotalJual || 0) - (item.totalModal || 0);
            return (
              <React.Fragment key={i}>
                <tr>
                  <td style={{ border: '1px solid black', padding: '4px', fontWeight: 'bold' }}>{item.productName}</td>
                  <td style={{ border: '1px solid black', padding: '4px', textAlign: 'center' }}>{formatNumber(item.qty)} {item.unit}</td>
                  <td style={{ border: '1px solid black', padding: '4px', textAlign: 'right' }}>{formatCurrency(item.hargaJual)}</td>
                  <td style={{ border: '1px solid black', padding: '4px', textAlign: 'right' }}>{formatCurrency(item.subtotalJual)}</td>
                  <td style={{ border: '1px solid black', padding: '4px', textAlign: 'right' }}>{formatCurrency(item.totalModal)}</td>
                  <td style={{ border: '1px solid black', padding: '4px', textAlign: 'right', fontWeight: 'bold', color: labaItem >= 0 ? 'green' : 'red' }}>{formatCurrency(labaItem)}</td>
                </tr>
                {item.useSubItems && (item.subItems || []).map((b, si) => (
                  <tr key={`${i}-${si}`} style={{ background: '#fafafa' }}>
                    <td style={{ border: '1px solid black', padding: '3px 4px 3px 20px', fontSize: 9, color: '#555' }}>↳ {b.nama}</td>
                    <td style={{ border: '1px solid black', padding: '3px', textAlign: 'center', fontSize: 9 }}>{formatNumber(b.qty)}</td>
                    <td style={{ border: '1px solid black', padding: '3px', textAlign: 'right', fontSize: 9 }}>{formatCurrency(b.harga)}</td>
                    <td colSpan={2} style={{ border: '1px solid black' }}></td>
                    <td style={{ border: '1px solid black', padding: '3px', textAlign: 'right', fontSize: 9 }}>{formatCurrency(b.qty * b.harga)}</td>
                  </tr>
                ))}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      {/* Extra Vegetables Breakdown */}
      {(report.extraVegetables || []).length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 5 }}>2. Sayuran & Bahan Tambahan (Global)</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 15, fontSize: 10 }}>
            <thead>
              <tr style={{ background: '#f2f2f2' }}>
                <th style={{ border: '1px solid black', padding: '4px', width: '45%' }}>Bahan / Sayuran</th>
                <th style={{ border: '1px solid black', padding: '4px', width: '15%' }}>Qty</th>
                <th style={{ border: '1px solid black', padding: '4px', width: '20%', textAlign: 'right' }}>Harga/unit</th>
                <th style={{ border: '1px solid black', padding: '4px', width: '20%', textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {report.extraVegetables.map((v, idx) => (
                <tr key={idx}>
                  <td style={{ border: '1px solid black', padding: '4px' }}>{v.nama}</td>
                  <td style={{ border: '1px solid black', padding: '4px', textAlign: 'center' }}>{formatNumber(v.qty)}</td>
                  <td style={{ border: '1px solid black', padding: '4px', textAlign: 'right' }}>{formatCurrency(v.harga)}</td>
                  <td style={{ border: '1px solid black', padding: '4px', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(v.qty * v.harga)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Overall Summary */}
      <div style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 5 }}>
        {(report.extraVegetables || []).length > 0 ? '3' : '2'}. Ringkasan Keseluruhan
      </div>
      <div style={{ background: '#f9f9f9', border: '1px solid #ccc', borderRadius: 4, padding: '10px 15px', fontSize: 11 }}>
        <table style={{ width: '100%', fontSize: 10 }}>
          <tbody>
            <tr><td>Total Modal Barang (Invoice Items)</td><td style={{ textAlign: 'right' }}>{formatCurrency(report.totalModalBarang)}</td></tr>
            {report.totalExtraVeg > 0 && (
              <tr><td>Total Sayuran & Bahan Tambahan</td><td style={{ textAlign: 'right', color: '#856404' }}>{formatCurrency(report.totalExtraVeg)}</td></tr>
            )}
            <tr><td>Biaya Kirim Bahan</td><td style={{ textAlign: 'right' }}>{formatCurrency(Number(report.ongkosKirimBahan || 0))}</td></tr>
            <tr><td>Biaya Pengiriman</td><td style={{ textAlign: 'right' }}>{formatCurrency(Number(report.ongkosPengiriman || 0))}</td></tr>
            <tr><td>Biaya Tenaga Kerja</td><td style={{ textAlign: 'right' }}>{formatCurrency(Number(report.biayaTenagaKerja || 0))}</td></tr>
            <tr><td>Biaya Lainnya</td><td style={{ textAlign: 'right' }}>{formatCurrency(Number(report.biayaLainnya || 0))}</td></tr>
            <tr style={{ borderTop: '1px solid #ddd' }}><td colSpan={2} style={{ height: 4 }}></td></tr>
            <tr style={{ fontWeight: 'bold' }}><td>Total HPP</td><td style={{ textAlign: 'right', color: 'red' }}>{formatCurrency(report.totalHPP)}</td></tr>
            <tr style={{ fontWeight: 'bold' }}><td>Total Penjualan</td><td style={{ textAlign: 'right', color: 'blue' }}>{formatCurrency(Number(report.invoiceTotal))}</td></tr>
            <tr style={{ borderTop: '2px solid #ccc' }}><td colSpan={2} style={{ height: 4 }}></td></tr>
            <tr style={{ fontSize: 12, fontWeight: 'bold' }}>
              <td>Laba Kotor</td>
              <td style={{ textAlign: 'right', color: labaKotor >= 0 ? 'green' : 'red' }}>{formatCurrency(labaKotor)}</td>
            </tr>
            <tr>
              <td>Margin (%)</td>
              <td style={{ textAlign: 'right', fontWeight: 'bold', color: labaKotor >= 0 ? 'green' : 'red' }}>{report.margin?.toFixed(1)}%</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Warning if loss */}
      {isLoss && (
        <div style={{ marginTop: 10, padding: 8, background: '#fdecec', border: '1px solid #f8d7da', color: '#721c24', fontSize: 10, borderRadius: 4, textAlign: 'center', fontWeight: 'bold' }}>
          PERINGATAN: Invoice ini mengalami kerugian sebesar {formatCurrency(Math.abs(labaKotor))}!
        </div>
      )}

      {/* Signatures */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 10, marginTop: 30 }}>
        <div style={{ width: '30%', textAlign: 'center' }}>
          <div style={{ marginBottom: 40 }}>Mengetahui</div>
          <div style={{ fontWeight: 'bold', textDecoration: 'underline' }}>Ujang Rukmana</div>
          <div>Ketua KDMP</div>
        </div>
      </div>
    </div>
  );
}
