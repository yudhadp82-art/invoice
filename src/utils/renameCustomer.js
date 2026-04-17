// Script untuk mengubah nama customer (rename)
import { Customers, Invoices, PurchaseNotes, TelegramOrders } from './storage';

/**
 * Mengubah nama customer dan update semua referensi terkait
 * @param {string} oldName - Nama customer lama
 * @param {string} newName - Nama customer baru
 * @param {object} options - Opsi tambahan
 * @param {boolean} options.dryRun - Jika true, hanya simulasi tanpa eksekusi
 */
export async function renameCustomer(oldName, newName, options = {}) {
  const { dryRun = false } = options;

  console.log(`🔄 Mulai rename customer: "${oldName}" → "${newName}"`);
  if (dryRun) console.log(`⚠️  MODE: DRY RUN (tidak akan melakukan perubahan)`);

  try {
    // 1. Cari customer yang akan diubah namanya
    const allCustomers = await Customers.getAll();
    const customer = allCustomers.find(c =>
      c.name === oldName
    );

    if (!customer) {
      throw new Error(`Customer "${oldName}" tidak ditemukan`);
    }

    console.log(`✅ Ditemukan customer:`, customer);

    // 2. Update nama customer
    if (!dryRun) {
      await Customers.update(customer.id, {
        name: newName,
        notes: [
          customer.notes || '',
          `Nama diubah dari "${oldName}" menjadi "${newName}" pada ${new Date().toLocaleDateString('id-ID')}`
        ].filter(Boolean).join('\n\n---\n\n')
      });
      console.log(`✅ Nama customer berhasil diubah`);
    } else {
      console.log(`📋 [DRY RUN] Akan mengubah nama customer`);
    }

    // 3. Update semua Invoices yang menggunakan customer lama
    const allInvoices = await Invoices.getAll();
    const invoicesToUpdate = allInvoices.filter(inv =>
      inv.customerName === oldName || inv.customerId === customer.id
    );

    console.log(`📝 Ditemukan ${invoicesToUpdate.length} invoice yang menggunakan customer "${oldName}"`);

    if (!dryRun) {
      for (const invoice of invoicesToUpdate) {
        await Invoices.update(invoice.id, {
          customerName: newName
        });
      }
      console.log(`✅ Berhasil update ${invoicesToUpdate.length} invoice`);
    } else {
      console.log(`📋 [DRY RUN] Akan update ${invoicesToUpdate.length} invoice`);
      if (invoicesToUpdate.length > 0) {
        console.log(`   IDs: ${invoicesToUpdate.map(i => i.id).join(', ')}`);
      }
    }

    // 4. Update semua Purchase Notes yang menggunakan customer lama
    const allPurchaseNotes = await PurchaseNotes.getAll();
    const purchaseNotesToUpdate = allPurchaseNotes.filter(note =>
      note.customerName === oldName
    );

    console.log(`📝 Ditemukan ${purchaseNotesToUpdate.length} purchase notes yang menggunakan customer "${oldName}"`);

    if (!dryRun) {
      for (const note of purchaseNotesToUpdate) {
        await PurchaseNotes.update(note.id, {
          customerName: newName
        });
      }
      console.log(`✅ Berhasil update ${purchaseNotesToUpdate.length} purchase notes`);
    } else {
      console.log(`📋 [DRY RUN] Akan update ${purchaseNotesToUpdate.length} purchase notes`);
      if (purchaseNotesToUpdate.length > 0) {
        console.log(`   IDs: ${purchaseNotesToUpdate.map(n => n.id).join(', ')}`);
      }
    }

    // 5. Update Telegram Orders yang menggunakan customer lama
    const allTelegramOrders = await TelegramOrders.getAll();
    const telegramOrdersToUpdate = allTelegramOrders.filter(order =>
      order.matchedCustomerName === oldName || order.matchedCustomerId === customer.id
    );

    console.log(`📝 Ditemukan ${telegramOrdersToUpdate.length} telegram orders yang menggunakan customer "${oldName}"`);

    if (!dryRun) {
      for (const order of telegramOrdersToUpdate) {
        await TelegramOrders.update(order.id, {
          matchedCustomerName: newName
        });
      }
      console.log(`✅ Berhasil update ${telegramOrdersToUpdate.length} telegram orders`);
    } else {
      console.log(`📋 [DRY RUN] Akan update ${telegramOrdersToUpdate.length} telegram orders`);
      if (telegramOrdersToUpdate.length > 0) {
        console.log(`   IDs: ${telegramOrdersToUpdate.map(o => o.id).join(', ')}`);
      }
    }

    const totalAffected = invoicesToUpdate.length + purchaseNotesToUpdate.length + telegramOrdersToUpdate.length;
    console.log(`✨ Rename selesai! Total affected records: ${totalAffected}`);

    return {
      success: true,
      customer,
      oldName,
      newName,
      invoicesUpdated: invoicesToUpdate.length,
      purchaseNotesUpdated: purchaseNotesToUpdate.length,
      telegramOrdersUpdated: telegramOrdersToUpdate.length,
      totalAffected,
      dryRun
    };

  } catch (error) {
    console.error(`❌ Error rename customer:`, error);
    throw error;
  }
}

/**
 * Jalankan rename dari console browser
 * Contoh: await renameCustomer('SPPG SINDANGJAYA 3', 'SPPG SINDANGJAYA 3 (LOTUS)', { dryRun: true })
 */
export default renameCustomer;