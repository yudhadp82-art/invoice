import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspect() {
    console.log("Inspecting Supabase...");
    
    // Check if we can reach the DB
    const { data: tables, error } = await supabase.rpc('get_tables'); // This might not exist
    if (error) {
        console.log("No RPC get_tables, trying to query purchase_notes directly...");
        const { data, count, error: err2 } = await supabase.from('purchase_notes').select('*', { count: 'exact' });
        if (err2) {
            console.error("Error querying purchase_notes:", err2.message);
        } else {
            console.log(`Found ${count} rows in purchase_notes.`);
        }
    } else {
        console.log("Tables found:", tables);
    }
}
inspect();
