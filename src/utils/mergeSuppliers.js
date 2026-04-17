// Script untuk menggabungkan dua supplier
import { Suppliers, PurchaseNotes } from './storage';

/**
 * Menggabungkan dua supplier menjadi satu
 * @param {string} oldSupplierName - Nama supplier yang akan digabungkan (akan dihapus)
 * @param {string} newSupplierName - Nama supplier target (akan tetap ada)
 * @param {object} options - Opsi tambahan
 * @param {boolean} options.mergeContactInfo - Apakah menggabungkan info kontak dari supplier lama
 * @param {boolean} options.dryRun - Jika true, hanya simulasi tanpa eksekusi
 */
export async function mergeSuppliers(oldSupplierName, newSupplierName, options = {}) {
  const { mergeContactInfo = true, dryRun = false } = options;

  console.log(`🔀 Mulai merge supplier: "${oldSupplierName}" → "${newSupplierName}"`);
  if (dryRun) console.log(`⚠️  MODE: DRY RUN (tidak akan melakukan perubahan)`);

  try {
    // 1. Cari kedua supplier
    const allSuppliers = await Suppliers.getAll();
    const oldSupplier = allSuppliers.find(s =>
      s.name === oldSupplierName || s.company === oldSupplierName
    );
    const newSupplier = allSuppliers.find(s =>
      s.name === newSupplierName || s.company === newSupplierName
    );

    if (!oldSupplier) {
      throw new Error(`Supplier "${oldSupplierName}" tidak ditemukan`);
    }

    if (!newSupplier) {
      throw new Error(`Supplier "${newSupplierName}" tidak ditemukan`);
    }

    console.log(`✅ Ditemukan supplier lama:`, oldSupplier);
    console.log(`✅ Ditemukan supplier baru:`, newSupplier);

    // 2. Jika mergeContactInfo, gabungkan informasi kontak
    if (mergeContactInfo && !dryRun) {
      const updatedContact = {
        ...newSupplier,
        // Gunakan info dari supplier lama jika supplier baru tidak memilikinya
        phone: newSupplier.phone || oldSupplier.phone,
        email: newSupplier.email || oldSupplier.email,
        address: newSupplier.address || oldSupplier.address,
        bankName: newSupplier.bankName || oldSupplier.bankName,
        accountName: newSupplier.accountName || oldSupplier.accountName,
        accountNumber: newSupplier.accountNumber || oldSupplier.accountNumber,
        notes: [
          newSupplier.notes || '',
          oldSupplier.notes || '',
          `Digabungkan dari "${oldSupplierName}" pada ${new Date().toLocaleDateString('id-ID')}`
        ].filter(Boolean).join('\n\n---\n\n')
      };

      await Suppliers.update(newSupplier.id, updatedContact);
      console.log(`✅ Informasi kontak berhasil digabungkan ke supplier baru`);
    } else if (mergeContactInfo && dryRun) {
      console.log(`📋 [DRY RUN] Akan menggabungkan info kontak dari supplier lama ke baru`);
    }

    // 3. Update semua Purchase Notes yang menggunakan nama supplier lama
    const allPurchaseNotes = await PurchaseNotes.getAll();
    const notesToUpdate = allPurchaseNotes.filter(note =>
      note.supplierName === oldSupplierName
    );

    console.log(`📝 Ditemukan ${notesToUpdate.length} purchase notes yang menggunakan supplier "${oldSupplierName}"`);

    if (!dryRun) {
      for (const note of notesToUpdate) {
        await PurchaseNotes.update(note.id, {
          supplierName: newSupplierName
        });
      }
      console.log(`✅ Berhasil update ${notesToUpdate.length} purchase notes`);
    } else {
      console.log(`📋 [DRY RUN] Akan update ${notesToUpdate.length} purchase notes`);
      if (notesToUpdate.length > 0) {
        console.log(`   IDs: ${notesToUpdate.map(n => n.id).join(', ')}`);
      }
    }

    // 4. Hapus supplier lama
    if (!dryRun) {
      await Suppliers.delete(oldSupplier.id);
      console.log(`✅ Supplier "${oldSupplierName}" berhasil dihapus`);
    } else {
      console.log(`📋 [DRY RUN] Akan menghapus supplier "${oldSupplierName}"`);
    }

    console.log(`✨ Merge selesai!`);

    return {
      success: true,
      oldSupplier,
      newSupplier,
      notesUpdated: notesToUpdate.length,
      dryRun
    };

  } catch (error) {
    console.error(`❌ Error merge suppliers:`, error);
    throw error;
  }
}

/**
 * Jalankan merge dari console browser
 * Contoh: await mergeSuppliers('SPPG SINDANGJAYA 3 (LOTUS)', 'SPPG SINDANGJAYA 3', { dryRun: true })
 */
export default mergeSuppliers;