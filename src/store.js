import { useEffect, useState } from 'react';
import { supabase, ADMIN_EMAIL, BUCKET } from './supabase';
import { DEFAULTS } from './defaults';

const TABLE = 'site_content';
const ROW = 'main';
const MAX_UPLOAD = 50 * 1024 * 1024; // Supabase free plan limit per file

/** Built-in content, overridden by whatever is saved in the database. */
export function merge(raw = {}) {
  return {
    ...DEFAULTS,
    ...raw,
    t: { ...DEFAULTS.t, ...(raw.t || {}) },
    links: { ...DEFAULTS.links, ...(raw.links || {}) },
    anim: { ...DEFAULTS.anim, ...(raw.anim || {}) },
  };
}

/** Live site content. Updates in open browsers the moment the admin saves (Supabase Realtime). */
export function useSite() {
  const [raw, setRaw] = useState(null);
  useEffect(() => {
    if (!supabase) { setRaw({}); return undefined; }
    let alive = true;
    const load = async () => {
      const { data, error } = await supabase.from(TABLE).select('data').eq('id', ROW).maybeSingle();
      if (!alive) return;
      if (error) console.error(error);
      setRaw((data && data.data) || {});
    };
    load();
    const channel = supabase
      .channel('site-content')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE, filter: `id=eq.${ROW}` }, (p) => {
        if (alive) setRaw(p.eventType === 'DELETE' ? {} : (p.new && p.new.data) || {});
      })
      .subscribe();
    const onVisible = () => { if (document.visibilityState === 'visible') load(); }; // safety net if realtime is off
    document.addEventListener('visibilitychange', onVisible);
    return () => { alive = false; document.removeEventListener('visibilitychange', onVisible); supabase.removeChannel(channel); };
  }, []);
  return { data: merge(raw || {}), loading: raw === null };
}

export function useAuth() {
  const [user, setUser] = useState(supabase ? undefined : null);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    if (!supabase) return undefined;

    // Check for errors returned in query string or hash fragment
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const urlErr = searchParams.get('error_description') || searchParams.get('error')
      || hashParams.get('error_description') || hashParams.get('error');

    if (urlErr) {
      setAuthError(decodeURIComponent(urlErr.replace(/\+/g, ' ')));
    }

    // Explicitly exchange PKCE code if present in the URL
    const code = searchParams.get('code');
    if (code) {
      supabase.auth.exchangeCodeForSession(code)
        .then(({ data, error }) => {
          if (error) {
            console.error('Code exchange error:', error);
            setAuthError(error.message);
          } else if (data?.session?.user) {
            setUser(data.session.user);
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        })
        .catch((err) => {
          console.error(err);
          setAuthError(err.message || String(err));
        });
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data?.session?.user) {
        setUser(data.session.user);
      } else if (!code) {
        setUser(null);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser((session && session.user) || null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  // This only controls what the screen shows. The database rules (schema.sql) are what actually protect your data.
  const isAdmin = Boolean(user && ADMIN_EMAIL && user.email && user.email.toLowerCase() === ADMIN_EMAIL);
  return { user, isAdmin, authError, clearAuthError: () => setAuthError('') };
}

export function useTheme() {
  const system = typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('theme') || system; } catch { return system; } });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('theme', theme); } catch { /* private mode */ }
  }, [theme]);
  return [theme, () => setTheme((t) => (t === 'light' ? 'dark' : 'light'))];
}

/** Merge `patch` into the saved content (text maps are merged one level deep, lists are replaced). */
export async function saveSite(patch) {
  if (!supabase) throw new Error('Supabase is not configured yet (see README step 5).');
  const { data: row, error: readError } = await supabase.from(TABLE).select('data').eq('id', ROW).maybeSingle();
  if (readError) throw readError;
  const cur = (row && row.data) || {};
  const next = { ...cur, ...patch };
  ['t', 'links', 'anim'].forEach((k) => { if (patch[k] && typeof patch[k] === 'object') next[k] = { ...(cur[k] || {}), ...patch[k] }; });
  const { error } = await supabase.from(TABLE).upsert({ id: ROW, data: next, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function resetSite() {
  const { error } = await supabase.from(TABLE).delete().eq('id', ROW);
  if (error) throw error;
}

/** Signs in directly with email & password (instant and immune to link/browser issues). */
export async function loginWithPassword(email, password) {
  if (!supabase) throw new Error('Supabase is not configured yet.');
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw error;
  return data;
}

/** Sends a one-time sign-in link and OTP code. */
export async function loginWithEmail(email) {
  if (!supabase) throw new Error('Supabase is not configured yet.');
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/admin` }
  });
  if (error) throw error;
}

/** Verifies a 6-digit confirmation code from email. */
export async function verifyOtpCode(email, token) {
  if (!supabase) throw new Error('Supabase is not configured yet.');
  const { data, error } = await supabase.auth.verifyOtp({
    email: email.trim(),
    token: token.trim(),
    type: 'email'
  });
  if (error) throw error;
  return data;
}

export async function loginWithGoogle() {
  if (!supabase) throw new Error('Supabase is not configured yet.');
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/admin` } });
  if (error) throw error;
}
export const logout = () => supabase.auth.signOut();

/** Shrink a photo in the browser before uploading (keeps pages fast and storage small). */
export function resizeImage(file, max = 1600, type = 'image/jpeg', quality = 0.85) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process the image'))), type, quality);
    };
    img.onerror = () => reject(new Error('That file is not a readable image'));
    img.src = url;
  });
}

/** Upload to Supabase Storage and return a public URL. Swap this one function to use another file host. */
export async function uploadMedia(file, name) {
  if (!supabase) throw new Error('Supabase is not configured yet (see README step 5).');
  if (file.size > MAX_UPLOAD) throw new Error('That file is over 50 MB, the free-plan limit. Use a smaller file or a video link.');
  const safe = String(name || file.name || 'file').replace(/[^\w.\-]+/g, '_');
  const path = `${Date.now()}-${safe}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined, cacheControl: '31536000', upsert: false });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
