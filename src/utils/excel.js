import * as XLSX from 'xlsx';

// Helper to download base64 as a file reliably
function downloadBase64File(base64Data, filename) {
  const url = 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + base64Data;
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Export data array to Excel file
 * @param {Array} data - Array of objects to export
 * @param {string} filename - Filename without extension
 * @param {string} sheetName - Excel sheet name
 * @param {Array} columns - Column definitions [{key, header, width}]
 */
export function exportToExcel(data, filename, sheetName = 'Sheet1', columns = null) {
  let exportData;
  
  if (columns) {
    // Map data using column definitions
    exportData = data.map(row => {
      const obj = {};
      columns.forEach(col => {
        obj[col.header] = col.format ? col.format(row[col.key], row) : row[col.key];
      });
      return obj;
    });
  } else {
    exportData = data;
  }

  const ws = XLSX.utils.json_to_sheet(exportData);

  // Set column widths
  if (columns) {
    ws['!cols'] = columns.map(col => ({ wch: col.width || 15 }));
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
  downloadBase64File(wbout, `${filename}.xlsx`);
}

/**
 * Import data from Excel file
 * @param {File} file - File object from input
 * @param {Object} columnMap - Maps Excel column headers to data keys {excelHeader: dataKey}
 * @returns {Promise<Array>} Parsed data array
 */
export function importFromExcel(file, columnMap = null) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);

        if (columnMap) {
          // Remap columns from Excel headers to internal keys
          const mapped = jsonData.map(row => {
            const obj = {};
            Object.entries(columnMap).forEach(([excelHeader, dataKey]) => {
              // Try exact match first, then case-insensitive
              const val = row[excelHeader] ?? 
                row[Object.keys(row).find(k => k.toLowerCase() === excelHeader.toLowerCase())];
              if (val !== undefined) obj[dataKey] = val;
            });
            return obj;
          });
          resolve(mapped);
        } else {
          resolve(jsonData);
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Export invoice data with formatted layout
 */
export function exportInvoicesToExcel(invoices) {
  const columns = [
    { key: 'invoiceNumber', header: 'No. Invoice', width: 20 },
    { key: 'customerName', header: 'Customer', width: 25 },
    { key: 'createdAt', header: 'Tanggal', width: 15, format: (v) => v ? new Date(v).toLocaleDateString('id-ID') : '' },
    { key: 'subtotal', header: 'Subtotal', width: 18, format: (v) => v || 0 },
    { key: 'grandTotal', header: 'Grand Total', width: 18, format: (v) => v || 0 },
    { key: 'totalCost', header: 'Modal', width: 18, format: (v) => v || 0 },
    { key: 'profit', header: 'Profit', width: 18, format: (v) => v || 0 },
    { key: 'paymentStatus', header: 'Status', width: 15, format: (v) => v === 'paid' ? 'Lunas' : v === 'partial' ? 'Sebagian' : 'Belum Bayar' },
  ];
  exportToExcel(invoices, 'invoices_export', 'Invoices', columns);
}

/**
 * Export delivery notes to Excel
 */
export function exportDeliveryNotesToExcel(notes) {
  const columns = [
    { key: 'noteNumber', header: 'No. Surat Jalan', width: 20 },
    { key: 'customerName', header: 'Customer', width: 25 },
    { key: 'invoiceNumber', header: 'Ref. Invoice', width: 20 },
    { key: 'driver', header: 'Driver', width: 18 },
    { key: 'vehicleNumber', header: 'No. Kendaraan', width: 15 },
    { key: 'createdAt', header: 'Tanggal', width: 15, format: (v) => v ? new Date(v).toLocaleDateString('id-ID') : '' },
  ];
  exportToExcel(notes, 'surat_jalan_export', 'Surat Jalan', columns);
}

/**
 * Export purchases to Excel
 */
export function exportPurchasesToExcel(purchases) {
  // Flatten items
  const rows = [];
  purchases.forEach(p => {
    (p.items || []).forEach((item, i) => {
      rows.push({
        'Tanggal': p.createdAt ? new Date(p.createdAt).toLocaleDateString('id-ID') : '',
        'Supplier': i === 0 ? (p.supplier || '-') : '',
        'Produk': item.productName,
        'Qty': item.qty,
        'Satuan': item.unit || '',
        'Harga/Unit': item.costPerUnit || 0,
        'Subtotal': (item.costPerUnit || 0) * (item.qty || 0),
        'Total Pembelian': i === 0 ? (p.totalCost || 0) : '',
      });
    });
  });
  exportToExcel(rows, 'pembelian_export', 'Pembelian');
}

/**
 * Export HPP Reports to Excel
 */
export function exportHppToExcel(reports) {
  const rows = [];
  
  reports.forEach(r => {
    const items = r.itemCosts || [];
    if (items.length === 0) {
      // Baris kosong jika tidak ada item
      rows.push({
        'Tanggal': r.createdAt ? new Date(r.createdAt).toLocaleDateString('id-ID') : '',
        'No. Invoice': r.invoiceNumber,
        'Customer': r.customerName,
        'Produk': '-',
        'Qty': 0,
        'Satuan': '',
        'Harga Jual/Unit': 0,
        'Total Jual': 0,
        'Modal/Unit': 0,
        'Total Modal': 0,
        'Laba Item': 0,
        'Biaya Kirim Bahan': r.ongkosKirimBahan || 0,
        'Biaya Pengiriman': r.ongkosPengiriman || 0,
        'Biaya TK': r.biayaTenagaKerja || 0,
        'Biaya Lain': r.biayaLainnya || 0,
        'Total HPP': r.totalHPP || 0,
        'Total Penjualan': r.invoiceTotal || 0,
        'Laba Kotor': r.labaKotor || 0,
      });
    } else {
      items.forEach((item, i) => {
        const labaItem = (item.subtotalJual || 0) - (item.totalModal || 0);
        rows.push({
          'Tanggal': i === 0 && r.createdAt ? new Date(r.createdAt).toLocaleDateString('id-ID') : '',
          'No. Invoice': i === 0 ? r.invoiceNumber : '',
          'Customer': i === 0 ? r.customerName : '',
          'Produk': item.productName,
          'Qty': item.qty,
          'Satuan': item.unit || '',
          'Harga Jual/Unit': item.hargaJual || 0,
          'Total Jual': item.subtotalJual || 0,
          'Modal/Unit': (item.totalModal || 0) / (item.qty || 1),
          'Total Modal': item.totalModal || 0,
          'Laba Item': labaItem,
          'Biaya Kirim Bahan': i === 0 ? (r.ongkosKirimBahan || 0) : '',
          'Biaya Pengiriman': i === 0 ? (r.ongkosPengiriman || 0) : '',
          'Biaya TK': i === 0 ? (r.biayaTenagaKerja || 0) : '',
          'Biaya Lain': i === 0 ? (r.biayaLainnya || 0) : '',
          'Total HPP': i === 0 ? (r.totalHPP || 0) : '',
          'Total Penjualan': i === 0 ? (r.invoiceTotal || 0) : '',
          'Laba Kotor': i === 0 ? (r.labaKotor || 0) : '',
        });
      });
    }
  });

  exportToExcel(rows, 'laporan_hpp_rincian_export', 'Rincian HPP');
}

/**
 * Export report data to Excel
 */
export function exportReportToExcel(data, filename, sheetName) {
  exportToExcel(data, filename, sheetName);
}

/**
 * Download a blank Excel template for importing data
 * @param {string} type - 'products' or 'customers'
 */
export function downloadImportTemplate(type) {
  if (type === 'products') {
    const templateData = [
      { 'Nama Produk': 'Contoh: Bawang Merah Brebes', 'SKU': 'BWM-001', 'Kategori': 'Bumbu', 'Modal (Rp)': 25000, 'Harga Jual (Rp)': 35000, 'Stok': 50, 'Satuan': 'kg' },
      { 'Nama Produk': '', 'SKU': '', 'Kategori': '', 'Modal (Rp)': '', 'Harga Jual (Rp)': '', 'Stok': '', 'Satuan': '' },
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 18 }, { wch: 10 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template Produk');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
    downloadBase64File(wbout, 'template_import_produk.xlsx');
  } else if (type === 'customers') {
    const templateData = [
      { 'Nama': 'Contoh: CV Bangun Jaya', 'Perusahaan': 'CV Bangun Jaya', 'Telepon': '081234567890', 'Email': 'email@contoh.com', 'Alamat': 'Jl. Sudirman No. 45', 'Kategori Harga': 'Grosir' },
      { 'Nama': '', 'Perusahaan': '', 'Telepon': '', 'Email': '', 'Alamat': '', 'Kategori Harga': '' },
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = [{ wch: 25 }, { wch: 25 }, { wch: 18 }, { wch: 25 }, { wch: 35 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template Customer');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
    downloadBase64File(wbout, 'template_import_customer.xlsx');
  } else if (type === 'suppliers') {
    const templateData = [
      { 'Nama Kontak': 'Contoh: Agus Petani', 'Perusahaan': 'Kelompok Tani', 'Telepon': '081234567890', 'Email': 'agus@tani.com', 'Alamat': 'Desa Makmur', 'Catatan': 'Supplier sayuran' },
      { 'Nama Kontak': '', 'Perusahaan': '', 'Telepon': '', 'Email': '', 'Alamat': '', 'Catatan': '' },
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = [{ wch: 25 }, { wch: 25 }, { wch: 18 }, { wch: 25 }, { wch: 35 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template Supplier');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
    downloadBase64File(wbout, 'template_import_supplier.xlsx');
  }
}

/**
 * Create a file input trigger for importing
 * @param {Function} onImport - Callback receiving parsed data array
 * @param {Object} columnMap - Column mapping
 */
export function triggerImportExcel(onImport, columnMap = null) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.xlsx,.xls,.csv';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = await importFromExcel(file, columnMap);
      onImport(data);
    } catch (err) {
      alert('Gagal membaca file: ' + err.message);
    }
  };
  input.click();
}

/**
 * Export pricing matrix to Excel
 */
export function exportPricingToExcel(products, categories) {
  const exportData = products.map(p => {
    const row = {
      'Nama Produk': p.name,
      'SKU': p.sku,
      'Modal (Rp)': p.purchaseCost,
      'Harga Jual Utama (Default)': p.sellPrice,
    };
    categories.forEach(c => {
      row[`Harga Jual: ${c.name}`] = p.categoryPrices?.[c.id] || '';
    });
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(exportData);
  const cols = [{ wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 25 }, ...categories.map(() => ({ wch: 20 }))];
  ws['!cols'] = cols;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Daftar Harga Jual');
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
  downloadBase64File(wbout, 'daftar_harga_jual.xlsx');
}

/**
 * Download template for pricing matrix import
 */
export function downloadPricingTemplate(categories) {
  const row1 = {
    'Nama Produk': 'Bawang Merah Brebes',
    'SKU': 'BWM-001',
    'Modal (Rp)': 25000,
    'Harga Jual Utama (Default)': 35000,
  };
  categories.forEach(c => {
    row1[`Harga Jual: ${c.name}`] = 32000;
  });

  const row2 = { 'Nama Produk': '', 'SKU': '', 'Modal (Rp)': '', 'Harga Jual Utama (Default)': '' };
  categories.forEach(c => { row2[`Harga Jual: ${c.name}`] = ''; });

  const ws = XLSX.utils.json_to_sheet([row1, row2]);
  const cols = [{ wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 25 }, ...categories.map(() => ({ wch: 20 }))];
  ws['!cols'] = cols;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template Daftar Harga');
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
  downloadBase64File(wbout, 'template_daftar_harga.xlsx');
}
