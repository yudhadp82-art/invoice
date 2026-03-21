import * as XLSX from 'xlsx';
const templateData = [
  { 'Nama Produk': 'Contoh: Semen Portland 50kg', 'SKU': 'SMN-001', 'Kategori': 'Bahan Bangunan', 'Modal (Rp)': 55000, 'Harga Jual (Rp)': 68000, 'Stok': 100, 'Satuan': 'sak' },
  { 'Nama Produk': '', 'SKU': '', 'Kategori': '', 'Modal (Rp)': '', 'Harga Jual (Rp)': '', 'Stok': '', 'Satuan': '' },
];
try {
  const ws = XLSX.utils.json_to_sheet(templateData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template Produk');
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  console.log("SUCCESS:", wbout.length, "bytes");
} catch(e) {
  console.error("ERROR:", e);
}
