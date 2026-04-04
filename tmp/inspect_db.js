import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspect() {
    const tables = ['products', 'customers', 'invoices', 'purchase_notes', 'purchases', 'supporting_material_items'];
    for (const table of tables) {
        const { count, error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true });
        
        if (error) {
            console.error(`Error counting ${table}:`, error.message);
        } else {
            console.log(`Table ${table} has ${count} rows.`);
        }
    }
}

inspect();
