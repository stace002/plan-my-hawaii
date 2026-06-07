import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = 'https://scjiidyuvywtgzihuyzy.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjamlpZHl1dnl3dGd6aWh1eXp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyODU3NzMsImV4cCI6MjA5NTg2MTc3M30.DHVNtjqDaCMY-1P1H04TKXcyMiF3gtIxnTuTWAh5OK0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const SEND_ITINERARY_URL = `${SUPABASE_URL}/functions/v1/send-itinerary`;