import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspect() {
    const { data: pNotes } = await supabase.from('purchase_notes').select('*');
    if (pNotes && pNotes.length > 0) {
        console.log("Found", pNotes.length, "purchase notes.");
        pNotes.forEach(n => {
            console.log(`ID: ${n.id}`);
            console.log(`Keys in data: ${Object.keys(n.data || {}).join(', ')}`);
            console.log(`Date value: ${n.data?.date}`);
            console.log(`Supplier: ${n.data?.supplierName}`);
        });
    } else {
        console.log("No purchase notes found.");
    }
}
inspect();
