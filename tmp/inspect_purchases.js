import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspect() {
    console.log("Checking purchases...");
    const { data: purchases } = await supabase.from('purchases').select('*');
    if (purchases && purchases.length > 0) {
        console.log("Found", purchases.length, "purchases.");
        purchases.forEach(n => {
            console.log(`ID: ${n.id}`);
            console.log(`Keys in data: ${Object.keys(n.data || {}).join(', ')}`);
            console.log(`Supplier: ${n.data?.supplier}`);
            console.log(`Total: ${n.data?.totalCost}`);
        });
    } else {
        console.log("No purchases found.");
    }
}
inspect();
