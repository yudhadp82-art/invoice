import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function resetStock() {
  const tables = ['products', 'supporting_material_items']
  
  for (const table of tables) {
    console.log(`\nProcessing table: ${table}...`)
    const { data: rows, error } = await supabase.from(table).select('*')
    
    if (error) {
      console.error(`Error fetching ${table}:`, error.message)
      continue
    }
    
    if (!rows || rows.length === 0) {
      console.log(`Table ${table} is empty.`)
      continue
    }
    
    console.log(`Found ${rows.length} rows in ${table}.`)
    let updatedCount = 0
    
    for (const row of rows) {
      // Logic from storage.js: data is in 'data' JSONB or stored flat
      const newData = { ...(row.data || {}), stock: 0 }
      
      const updatePayload = { 
        data: newData,
        updated_at: new Date().toISOString()
      }
      
      // If there's a flat stock column, update it too
      if ('stock' in row) {
        updatePayload.stock = 0
      }
      
      const { error: updateError } = await supabase
        .from(table)
        .update(updatePayload)
        .eq('id', row.id)
        
      if (updateError) {
        console.error(`Error updating row ${row.id}:`, updateError.message)
      } else {
        updatedCount++
      }
    }
    console.log(`Done. Reset ${updatedCount} items in ${table}.`)
  }
}

resetStock()
  .then(() => {
    console.log('\nAll stock quantities have been reset successfully.')
    process.exit(0)
  })
  .catch(err => {
    console.error('Critical error:', err)
    process.exit(1)
  })
