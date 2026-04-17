// Script untuk memindahkan SPPG SINDANGJAYA 3 ke SPPG SINDANGJAYA 3 (LOTUS)
import { Customers, TelegramOrders, Invoices, PurchaseNotes } from './storage';

/**
 * Melakukan perubahan:
 * 1. Rename customer "SPPG SINDANGJAYA 3" → "SPPG SINDANGJAYA 3 (LOTUS)"
 * 2. Update telegram orders yang menggunakan "SPPG SINDANGJAYA 3" → "SPPG SINDANGJAYA 3 (LOTUS)"
 */
export async function fixSppgNames() {
  console.log('🔄 Mulai perubahan nama SPPG SINDANGJAYA 3...');

  try {
    // 1. Rename customer "SPPG SINDANGJAYA 3" menjadi "SPPG SINDANGJAYA 3 (LOTUS)"
    const allCustomers = await Customers.getAll();
    const customer = allCustomers.find(c =>
      c.name === 'SPPG SINDANGJAYA 3'
    );

    if (!customer) {
      throw new Error('Customer "SPPG SINDANGJAYA 3" tidak ditemukan');
    }

    console.log('✅ Ditemukan customer:', customer);

    // Update nama customer
    await Customers.update(customer.id, {
      name: 'SPPG SINDANGJAYA 3 (LOTUS)',
      notes: [
        customer.notes || '',
        `Nama diubah dari "SPPG SINDANGJAYA 3" menjadi "SPPG SINDANGJAYA 3 (LOTUS)" pada ${new Date().toLocaleDateString('id-ID')}`
      ].filter(Boolean).join('\n\n---\n\n')
    });

    console.log('✅ Nama customer berhasil diubah');

    // 2. Update semua invoice yang menggunakan nama lama
    const allInvoices = await Invoices.getAll();
    const invoicesToUpdate = allInvoices.filter(inv =>
      inv.customerName === 'SPPG SINDANGJAYA 3' || inv.customerId === customer.id
    );

    console.log(`📝 Ditemukan ${invoicesToUpdate.length} invoice yang perlu diupdate`);

    for (const invoice of invoicesToUpdate) {
      await Invoices.update(invoice.id, {
        customerName: 'SPPG SINDANGJAYA 3 (LOTUS)'
      });
    }
    console.log(`✅ Berhasil update ${invoicesToUpdate.length} invoice`);

    // 3. Update semua purchase notes yang menggunakan nama lama
    const allPurchaseNotes = await PurchaseNotes.getAll();
    const purchaseNotesToUpdate = allPurchaseNotes.filter(note =>
      note.customerName === 'SPPG SINDANGJAYA 3'
    );

    console.log(`📝 Ditemukan ${purchaseNotesToUpdate.length} purchase notes yang perlu diupdate`);

    for (const note of purchaseNotesToUpdate) {
      await PurchaseNotes.update(note.id, {
        customerName: 'SPPG SINDANGJAYA 3 (LOTUS)'
      });
    }
    console.log(`✅ Berhasil update ${purchaseNotesToUpdate.length} purchase notes`);

    // 4. Update telegram orders yang menggunakan "SPPG SINDANGJAYA 3" ke "SPPG SINDANGJAYA 3 (LOTUS)"
    const allTelegramOrders = await TelegramOrders.getAll();
    const telegramOrdersToUpdate = allTelegramOrders.filter(order =>
      order.matchedCustomerName === 'SPPG SINDANGJAYA 3'
    );

    console.log(`📝 Ditemukan ${telegramOrdersToUpdate.length} telegram order yang perlu diupdate`);

    for (const order of telegramOrdersToUpdate) {
      await TelegramOrders.update(order.id, {
        matchedCustomerName: 'SPPG SINDANGJAYA 3 (LOTUS)'
      });
    }
    console.log(`✅ Berhasil update ${telegramOrdersToUpdate.length} telegram order`);

    const totalAffected = invoicesToUpdate.length + purchaseNotesToUpdate.length + telegramOrdersToUpdate.length;
    console.log(`✨ Perubahan selesai! Total affected records: ${totalAffected}`);

    return {
      success: true,
      customer,
      invoicesUpdated: invoicesToUpdate.length,
      purchaseNotesUpdated: purchaseNotesToUpdate.length,
      telegramOrdersUpdated: telegramOrdersToUpdate.length,
      totalAffected
    };

  } catch (error) {
    console.error('❌ Error fixSppgNames:', error);
    throw error;
  }
}

/**
 * Jalankan dari console browser
 * Contoh: await fixSppgNames()
 */
export default fixSppgNames;