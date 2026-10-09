import { createClient } from '@supabase/supabase-js';

const env = import.meta.env || {};
const rawUrl = env.VITE_SUPABASE_URL || '';
const url = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
const key = env.VITE_SUPABASE_ANON_KEY;

// Until the .env values are filled in, the site still works with its built-in content (read-only).
export const configured = Boolean(url && key);
export const supabase = configured
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;
export const ADMIN_EMAIL = String(env.VITE_ADMIN_EMAIL || '').toLowerCase();
export const BUCKET = 'uploads';
