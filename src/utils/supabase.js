import { createClient } from '@supabase/supabase-js';

// Fallback to empty string if missing to avoid immediate constructor crash
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ WARNING: Supabase credentials missing. Check your Project Environment Variables!');
} else {
  // Only log success if actually initialized correctly
  if (typeof window !== 'undefined') {
    console.log('✅ Supabase initialized for project.');
  }
}

// createClient will handle empty strings by returning a non-functional object instead of crashing the entire script load
// though it will still fail on actual requests, which is caught by our page level error handling.
export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder');
