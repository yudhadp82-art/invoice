import { Products } from './src/utils/storage.js';

async function main() {
  const all = await Products.getAll();
  console.log(`Found ${all.length} products.`);
  all.forEach(p => {
    if (typeof p.unit !== 'string' && p.unit !== undefined && p.unit !== null) {
      console.log(`[!] Anomalous Unit found in product:`, p.id, p.name, `Unit type:`, typeof p.unit, p.unit);
    }
    if (p.unit && typeof p.unit === 'string' && p.unit.trim() === '') {
       console.log(`[!] Empty/space Unit found:`, p.id, p.name);
    }
  });
  console.log("Inspection complete.");
}

main().catch(console.error);
