// Script untuk menggabungkan dua customer
import { Customers, Invoices, PurchaseNotes, TelegramOrders } from './storage';

/**
 * Menggabungkan dua customer menjadi satu
 * @param {string} oldCustomerName - Nama customer yang akan digabungkan (akan dihapus)
 * @param {string} newCustomerName - Nama customer target (akan tetap ada)
 * @param {object} options - Opsi tambahan
 * @param {boolean} options.mergeContactInfo - Apakah menggabungkan info kontak dari customer lama
 * @param {boolean} options.dryRun - Jika true, hanya simulasi tanpa eksekusi
 */
export async function mergeCustomers(oldCustomerName, newCustomerName, options = {}) {
  const { mergeContactInfo = true, dryRun = false } = options;

  console.log(`🔀 Mulai merge customer: "${oldCustomerName}" → "${newCustomerName}"`);
  if (dryRun) console.log(`⚠️  MODE: DRY RUN (tidak akan melakukan perubahan)`);

  try {
    // 1. Cari kedua customer
    const allCustomers = await Customers.getAll();
    const oldCustomer = allCustomers.find(c =>
      c.name === oldCustomerName
    );
    const newCustomer = allCustomers.find(c =>
      c.name === newCustomerName
    );

    if (!oldCustomer) {
      throw new Error(`Customer "${oldCustomerName}" tidak ditemukan`);
    }

    if (!newCustomer) {
      throw new Error(`Customer "${newCustomerName}" tidak ditemukan`);
    }

    console.log(`✅ Ditemukan customer lama:`, oldCustomer);
    console.log(`✅ Ditemukan customer baru:`, newCustomer);

    // 2. Jika mergeContactInfo, gabungkan informasi kontak
    if (mergeContactInfo && !dryRun) {
      const updatedContact = {
        ...newCustomer,
        // Gunakan info dari customer lama jika customer baru tidak memilikinya
        phone: newCustomer.phone || oldCustomer.phone,
        email: newCustomer.email || oldCustomer.email,
        address: newCustomer.address || oldCustomer.address,
        company: newCustomer.company || oldCustomer.company,
        notes: [
          newCustomer.notes || '',
          oldCustomer.notes || '',
          `Digabungkan dari "${oldCustomerName}" pada ${new Date().toLocaleDateString('id-ID')}`
        ].filter(Boolean).join('\n\n---\n\n')
      };

      await Customers.update(newCustomer.id, updatedContact);
      console.log(`✅ Informasi kontak berhasil digabungkan ke customer baru`);
    } else if (mergeContactInfo && dryRun) {
      console.log(`📋 [DRY RUN] Akan menggabungkan info kontak dari customer lama ke baru`);
    }

    // 3. Update semua Invoices yang menggunakan customer lama
    const allInvoices = await Invoices.getAll();
    const invoicesToUpdate = allInvoices.filter(inv =>
      inv.customerName === oldCustomerName || inv.customerId === oldCustomer.id
    );

    console.log(`📝 Ditemukan ${invoicesToUpdate.length} invoice yang menggunakan customer "${oldCustomerName}"`);

    if (!dryRun) {
      for (const invoice of invoicesToUpdate) {
        await Invoices.update(invoice.id, {
          customerName: newCustomerName,
          customerId: newCustomer.id
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
      note.customerName === oldCustomerName
    );

    console.log(`📝 Ditemukan ${purchaseNotesToUpdate.length} purchase notes yang menggunakan customer "${oldCustomerName}"`);

    if (!dryRun) {
      for (const note of purchaseNotesToUpdate) {
        await PurchaseNotes.update(note.id, {
          customerName: newCustomerName
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
      order.matchedCustomerName === oldCustomerName || order.matchedCustomerId === oldCustomer.id
    );

    console.log(`📝 Ditemukan ${telegramOrdersToUpdate.length} telegram orders yang menggunakan customer "${oldCustomerName}"`);

    if (!dryRun) {
      for (const order of telegramOrdersToUpdate) {
        await TelegramOrders.update(order.id, {
          matchedCustomerName: newCustomerName,
          matchedCustomerId: newCustomer.id
        });
      }
      console.log(`✅ Berhasil update ${telegramOrdersToUpdate.length} telegram orders`);
    } else {
      console.log(`📋 [DRY RUN] Akan update ${telegramOrdersToUpdate.length} telegram orders`);
      if (telegramOrdersToUpdate.length > 0) {
        console.log(`   IDs: ${telegramOrdersToUpdate.map(o => o.id).join(', ')}`);
      }
    }

    // 6. Hapus customer lama
    if (!dryRun) {
      await Customers.delete(oldCustomer.id);
      console.log(`✅ Customer "${oldCustomerName}" berhasil dihapus`);
    } else {
      console.log(`📋 [DRY RUN] Akan menghapus customer "${oldCustomerName}"`);
    }

    const totalAffected = invoicesToUpdate.length + purchaseNotesToUpdate.length + telegramOrdersToUpdate.length;
    console.log(`✨ Merge selesai! Total affected records: ${totalAffected}`);

    return {
      success: true,
      oldCustomer,
      newCustomer,
      invoicesUpdated: invoicesToUpdate.length,
      purchaseNotesUpdated: purchaseNotesToUpdate.length,
      telegramOrdersUpdated: telegramOrdersToUpdate.length,
      totalAffected,
      dryRun
    };

  } catch (error) {
    console.error(`❌ Error merge customers:`, error);
    throw error;
  }
}

/**
 * Jalankan merge dari console browser
 * Contoh: await mergeCustomers('SPPG SINDANGJAYA 3 (LOTUS)', 'SPPG SINDANGJAYA 3', { dryRun: true })
 */
export default mergeCustomers;