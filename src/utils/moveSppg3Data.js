// Script untuk memindahkan data SPPG SINDANGJAYA 3 ke SPPG SINDANGJAYA 3 (LOTUS)
import { Customers, TelegramOrders, Invoices, PurchaseNotes } from './storage';

/**
 * Memindahkan semua data dari nama lama ke nama baru
 * Ini akan:
 * 1. Mencari semua referensi ke nama lama
 * 2. Update ke nama baru
 * 3. Membuat ulang customer lama jika perlu
 */
export async function moveSppg3Data() {
  console.log('🔄 Mulai pemindahan data SPPG SINDANGJAYA 3 → SPPG SINDANGJAYA 3 (LOTUS)...');

  try {
    const oldName = 'SPPG SINDANGJAYA 3';
    const newName = 'SPPG SINDANGJAYA 3 (LOTUS)';

    // 1. Cek apakah customer tujuan sudah ada
    const allCustomers = await Customers.getAll();
    const targetCustomer = allCustomers.find(c =>
      c.name === newName
    );

    if (!targetCustomer) {
      throw new Error('Customer tujuan "SPPG SINDANGJAYA 3 (LOTUS)" tidak ditemukan!');
    }

    console.log('✅ Customer tujuan ditemukan:', targetCustomer);

    // 2. Cek apakah customer sumber masih ada
    const sourceCustomer = allCustomers.find(c =>
      c.name === oldName
    );

    if (!sourceCustomer) {
      console.log('⚠️ Customer sumber "' + oldName + '" tidak ditemukan, akan membuat baru...');
      // Buat customer sumber baru
      const newSourceCustomer = await Customers.create({
        name: oldName,
        phone: targetCustomer.phone || '',
        email: targetCustomer.email || '',
        address: targetCustomer.address || '',
        company: targetCustomer.company || '',
        notes: `Dibuat ulang untuk memindahkan data ke "${newName}" pada ${new Date().toLocaleDateString('id-ID')}`
      });
      console.log('✅ Customer sumber berhasil dibuat ulang');
    } else {
      console.log('✅ Customer sumber ditemukan:', sourceCustomer);
    }

    // 3. Update semua invoice yang menggunakan nama lama
    const allInvoices = await Invoices.getAll();
    const invoicesToUpdate = allInvoices.filter(inv =>
      inv.customerName === oldName
    );

    console.log(`📝 Ditemukan ${invoicesToUpdate.length} invoice yang perlu diupdate`);

    for (const invoice of invoicesToUpdate) {
      await Invoices.update(invoice.id, {
        customerName: newName
      });
    }
    console.log(`✅ Berhasil update ${invoicesToUpdate.length} invoice`);

    // 4. Update semua purchase notes yang menggunakan nama lama
    const allPurchaseNotes = await PurchaseNotes.getAll();
    const purchaseNotesToUpdate = allPurchaseNotes.filter(note =>
      note.customerName === oldName
    );

    console.log(`📝 Ditemukan ${purchaseNotesToUpdate.length} purchase notes yang perlu diupdate`);

    for (const note of purchaseNotesToUpdate) {
      await PurchaseNotes.update(note.id, {
        customerName: newName
      });
    }
    console.log(`✅ Berhasil update ${purchaseNotesToUpdate.length} purchase notes`);

    // 5. Update telegram orders yang menggunakan nama lama ke nama baru
    const allTelegramOrders = await TelegramOrders.getAll();
    const telegramOrdersToUpdate = allTelegramOrders.filter(order =>
      order.matchedCustomerName === oldName
    );

    console.log(`📝 Ditemukan ${telegramOrdersToUpdate.length} telegram order yang perlu diupdate`);

    for (const order of telegramOrdersToUpdate) {
      await TelegramOrders.update(order.id, {
        matchedCustomerName: newName
      });
    }
    console.log(`✅ Berhasil update ${telegramOrdersToUpdate.length} telegram order ke nama baru`);

    const totalAffected = invoicesToUpdate.length + purchaseNotesToUpdate.length + telegramOrdersToUpdate.length;
    console.log(`✨ Pemindahan selesai! Total affected records: ${totalAffected}`);

    return {
      success: true,
      oldName,
      newName,
      invoicesMoved: invoicesToUpdate.length,
      purchaseNotesMoved: purchaseNotesToUpdate.length,
      telegramOrdersMoved: telegramOrdersToUpdate.length,
      targetCustomerCreated: !sourceCustomer,
      totalAffected
    };

  } catch (error) {
    console.error('❌ Error moveSppg3Data:', error);
    throw error;
  }
}

/**
 * Jalankan dari console browser
 * Contoh: await moveSppg3Data()
 */
export default moveSppg3Data;