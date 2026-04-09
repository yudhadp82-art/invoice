import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function probe() {
    const { data, error: fError } = await supabase.from('purchase_notes').select('*').limit(1);
    if (fError) {
        console.error("Fetch error:", fError.message);
        return;
    }
    const note = data[0];
    console.log("Probing note:", note.id);
    
    const { error: uError } = await supabase
        .from('purchase_notes')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', note.id);
    
    if (uError) {
        console.error("Update error:", uError.message, uError.details);
    } else {
        console.log("Update success!");
    }
}
probe();
