import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspect() {
    console.log("Checking purchase_notes...");
    const { data: pNotes, error: error1 } = await supabase.from('purchase_notes').select('*').limit(3);
    if (error1) console.error(error1);
    else console.log("purchase_notes samples:", JSON.stringify(pNotes, null, 2));

    console.log("Checking purchases...");
    const { data: purchases, error: error2 } = await supabase.from('purchases').select('*').limit(3);
    if (error2) console.error(error2);
    else console.log("purchases samples:", JSON.stringify(purchases, null, 2));
}

inspect();
