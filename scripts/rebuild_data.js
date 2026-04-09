import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function rebuild() {
  console.log("Starting data rebuild for purchase_notes...");

  // 1. Fetch all purchase notes
  const { data: notes, error: fetchError } = await supabase
    .from('purchase_notes')
    .select('*');

  if (fetchError) {
    console.error("Error fetching purchase_notes:", fetchError.message);
    return;
  }

  console.log(`Found ${notes.length} notes to process.`);

  let updatedCount = 0;

  for (const note of notes) {
    const noteData = note.data || {};
    let items = noteData.items || [];
    
    if (!items.length) {
       console.log(`  Note ${note.id} has no items!`);
       continue;
    }
    let hasChanges = false;

    const newItems = items.map(it => {
      const invQty = Number(it.invoiceQty) || Number(it.qtyNota) || 0;
      const invPrice = Number(it.invoicePrice) || Number(it.sellPrice) || 0;
      
      const oldRevenue = Number(it.salesRevenue) || 0;
      const newRevenue = Number((invQty * invPrice).toFixed(2));
      
      if (Math.abs(oldRevenue - newRevenue) > 0.01) {
        hasChanges = true;
        
        const purchaseCost = Number(it.totalCost) || 0;
        const profit = newRevenue - purchaseCost;
        const marginPercent = newRevenue > 0 ? (profit / newRevenue) * 100 : 0;
        
        console.log(`    Item "${it.materialName}": ${oldRevenue} -> ${newRevenue}`);

        return {
          ...it,
          salesRevenue: newRevenue,
          profit: profit,
          marginPercent: marginPercent,
          invoiceQty: invQty,
          invoicePrice: invPrice
        };
      }
      return it;
    });

    if (hasChanges) {
      console.log(`  Updating Note ${note.id}...`);
      
      const updatedData = {
        ...noteData,
        items: newItems
      };

      const { error: updateError } = await supabase
        .from('purchase_notes')
        .update({ 
          data: updatedData,
          updated_at: new Date().toISOString()
        })
        .eq('id', note.id);

      if (updateError) {
        console.error(`    Failed to update ${note.id}:`, updateError.message, updateError.details);
      } else {
        console.log(`    Successfully updated ${note.id}`);
        updatedCount++;
      }
    }
  }

  console.log(`\nCOMPLETED: Updated ${updatedCount} total notes.`);
}

rebuild();
