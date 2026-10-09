import { useEffect, useRef, useState } from 'react';
import { useSite, useAuth, useTheme, saveSite, resetSite, loginWithEmail, loginWithPassword, verifyOtpCode, loginWithGoogle, logout, resizeImage, uploadMedia } from './store';
import { configured, ADMIN_EMAIL } from './supabase';
import { DEFAULT_PHOTO, DEFAULT_RESUME } from './defaults';

/* ---------- small building blocks ---------- */
const Field = ({ label, req, error, children }) => (
  <label className="fld">
    <span>{label}{req && <b className="rq"> *</b>}</span>
    {children}
    {error && <em className="er">Required</em>}
  </label>
);
const Card = ({ title, children }) => <div className="g acard"><h3>{title}</h3>{children}</div>;

const ENTRANCE = [['Fade up', 'up'], ['Zoom in', 'zoom'], ['Slide from left', 'slide'], ['None', 'none']];

const LISTS = {
  ach: { title: 'Achievements', add: 'Add achievement', label: (a) => `${a.y ? `${a.y} · ` : ''}${a.t}`,
    fields: [{ k: 't', l: 'Title', req: 1 }, { k: 'y', l: 'Year', req: 1 }, { k: 'x', l: 'Description', area: 1, req: 1 }] },
  proj: { title: 'Projects', add: 'Add project', label: (a) => a.t,
    fields: [{ k: 't', l: 'Project name', req: 1 }, { k: 'x', l: 'Description', area: 1, req: 1 }, { k: 's', l: 'Tech stack' }, { k: 'u', l: 'Live URL', req: 1 }, { k: 'v', l: 'Source URL', req: 1 }] },
  skill: { title: 'Skills', add: 'Add skill group', label: (a) => `${a.n} · ${String(a.i || '').split(',').filter((x) => x.trim()).length} skills`,
    fields: [{ k: 'n', l: 'Group name', req: 1 }, { k: 'i', l: 'Skills (separate with commas)', area: 1, req: 1 }] },
  cert: { title: 'Certifications', add: 'Add certification', label: (a) => `${a.y ? `${a.y} · ` : ''}${a.t}${a.c ? ' · copy attached' : ''}`,
    fields: [{ k: 't', l: 'Certification title', req: 1 }, { k: 'i', l: 'Issued by', req: 1 }, { k: 'y', l: 'Date (e.g. Aug 2026)', req: 1 }, { k: 'c', l: 'Copy of the certificate (optional)', image: 1 }] },
  sport: { title: 'Sports', add: 'Add sport', label: (a) => `${a.t}${a.c ? ' · certificate attached' : ''}`,
    fields: [{ k: 't', l: 'Sport', req: 1 }, { k: 'x', l: 'Level, teams, medals', area: 1 }, { k: 'c', l: 'Competition certificate (optional)', image: 1 }] },
};

/* ---------- portrait cropper ---------- */
function Cropper({ file, onCancel, onDone }) {
  const F = 280;
  const [img, setImg] = useState(null);
  const [z, setZ] = useState(1);
  const [px, setPx] = useState(0);
  const [py, setPy] = useState(0);
  const drag = useRef(null);
  useEffect(() => {
    const u = URL.createObjectURL(file);
    const i = new Image();
    i.onload = () => setImg(i);
    i.src = u;
    return () => URL.revokeObjectURL(u);
  }, [file]);
  if (!img) return <div className="modal"><span className="spin big" /></div>;
  const sc = Math.max(F / img.width, F / img.height) * z;
  const dw = img.width * sc, dh = img.height * sc;
  const mx = Math.max(0, (dw - F) / 2), my = Math.max(0, (dh - F) / 2);
  const ox = px * mx, oy = py * my;
  const clamp = (v) => Math.max(-1, Math.min(1, v));
  const down = (e) => { drag.current = { x: e.clientX, y: e.clientY, px, py }; e.currentTarget.setPointerCapture(e.pointerId); };
  const move = (e) => {
    if (!drag.current) return;
    setPx(mx ? clamp(drag.current.px + (e.clientX - drag.current.x) / mx) : 0);
    setPy(my ? clamp(drag.current.py + (e.clientY - drag.current.y) / my) : 0);
  };
  const apply = () => {
    const cv = document.createElement('canvas');
    cv.width = 480; cv.height = 480;
    const cx = cv.getContext('2d');
    cx.beginPath(); cx.arc(240, 240, 240, 0, Math.PI * 2); cx.clip();
    cx.drawImage(img, (dw / 2 - F / 2 - ox) / sc, (dh / 2 - F / 2 - oy) / sc, F / sc, F / sc, 0, 0, 480, 480);
    cv.toBlob((b) => onDone(b), 'image/webp', 0.9);
  };
  return (
    <div className="modal" role="dialog" aria-modal="true">
      <div className="g acard crop">
        <h3>Choose the part that shows in the circle</h3>
        <div className="cframe" onPointerDown={down} onPointerMove={move} onPointerUp={() => { drag.current = null; }}>
          <img src={img.src} alt="" style={{ width: dw, height: dh, left: (F - dw) / 2 + ox, top: (F - dh) / 2 + oy }} draggable={false} />
        </div>
        <Field label="Zoom"><input type="range" min="100" max="300" value={Math.round(z * 100)} onChange={(e) => setZ(e.target.value / 100)} /></Field>
        <Field label="Left / right"><input type="range" min="-100" max="100" value={Math.round(px * 100)} onChange={(e) => setPx(e.target.value / 100)} /></Field>
        <Field label="Up / down"><input type="range" min="-100" max="100" value={Math.round(py * 100)} onChange={(e) => setPy(e.target.value / 100)} /></Field>
        <div className="row"><button className="bt" onClick={apply}>Use this crop</button><button className="bt ghost" onClick={onCancel}>Cancel</button></div>
      </div>
    </div>
  );
}

/* ---------- tabs ---------- */
function PersonalTab({ data, save, upload, run }) {
  const [f, setF] = useState(data.t);
  const [err, setErr] = useState({});
  const [crop, setCrop] = useState(null);
  const sig = JSON.stringify(data.t);
  useEffect(() => { setF(data.t); }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k, v) => { setF((x) => ({ ...x, [k]: v })); setErr((e) => ({ ...e, [k]: false })); };
  const need = ['name', 'loc', 'role', 'status'];
  const submit = () => {
    const bad = Object.fromEntries(need.filter((k) => !String(f[k] || '').trim()).map((k) => [k, true]));
    setErr(bad);
    if (Object.keys(bad).length) return;
    run(() => save({ t: f }), 'Personal info saved');
  };
  const resume = data.resume && data.resume.url ? data.resume : null;
  return (
    <>
      <Card title="Basic details">
        <div className="two">
          <Field label="Name" req error={err.name}><input value={f.name || ''} onChange={(e) => set('name', e.target.value)} /></Field>
          <Field label="Rotating words (comma separated)"><input value={f.words || ''} onChange={(e) => set('words', e.target.value)} /></Field>
          <Field label="Location" req error={err.loc}><input value={f.loc || ''} onChange={(e) => set('loc', e.target.value)} /></Field>
          <Field label="Role" req error={err.role}><input value={f.role || ''} onChange={(e) => set('role', e.target.value)} /></Field>
          <Field label="Email"><input type="email" value={f.email || ''} onChange={(e) => set('email', e.target.value)} /></Field>
          <Field label="Status" req error={err.status}><input value={f.status || ''} onChange={(e) => set('status', e.target.value)} /></Field>
        </div>
        <Field label="Bio"><textarea rows="6" value={f.bio || ''} onChange={(e) => set('bio', e.target.value)} /></Field>
        <button className="bt" onClick={submit}>Save personal info</button>
      </Card>
      <Card title="Portrait photo">
        <div className="row">
          <div className="avatar-prev"><img src={data.photo || DEFAULT_PHOTO} alt="Portrait preview" /></div>
          <div className="col">
            <label className="bt"><input hidden type="file" accept="image/*" onChange={(e) => { if (e.target.files[0]) setCrop(e.target.files[0]); e.target.value = ''; }} />Upload new portrait</label>
            {data.photo && <button className="bt ghost" onClick={() => run(() => save({ photo: '' }), 'Using the sample portrait')}>Remove (use sample photo)</button>}
          </div>
        </div>
      </Card>
      <Card title="Resume (optional)">
        <p className="mut">Visitors see a Resume button on your public page. Upload a PDF to replace the default one.</p>
        <div className="rw"><span>{resume ? `${resume.name} (uploaded)` : `${DEFAULT_RESUME.name} (default)`}</span></div>
        <div className="row">
          <label className="bt"><input hidden type="file" accept="application/pdf" onChange={(e) => {
            const file = e.target.files[0]; e.target.value = '';
            if (!file) return;
            if (file.type !== 'application/pdf') return run(async () => { throw new Error('Please choose a PDF file'); });
            run(async () => { const url = await upload(file, { name: file.name }); await save({ resume: { url, name: file.name } }); }, 'Resume updated');
          }} />Upload resume (PDF)</label>
          {resume && <button className="bt ghost" onClick={() => run(() => save({ resume: null }), 'Using the default resume')}>Use default resume</button>}
        </div>
      </Card>
      {crop && <Cropper file={crop} onCancel={() => setCrop(null)} onDone={(blob) => { setCrop(null); run(async () => { const url = await upload(blob, { name: `portrait.${blob.type === 'image/webp' ? 'webp' : 'png'}` }); await save({ photo: url }); }, 'Portrait updated'); }} />}
    </>
  );
}

function ListTab({ k, data, save, upload, run }) {
  const cfg = LISTS[k];
  const items = data[k] || [];
  const blank = Object.fromEntries(cfg.fields.map((f) => [f.k, '']));
  const [form, setForm] = useState(blank);
  const [edit, setEdit] = useState(null);
  const [err, setErr] = useState({});
  const set = (key, v) => { setForm((f) => ({ ...f, [key]: v })); setErr((e) => ({ ...e, [key]: false })); };
  const reset = () => { setForm(blank); setEdit(null); setErr({}); };
  const submit = () => {
    const bad = {};
    cfg.fields.forEach((f) => {
      const wasEmpty = edit != null && !items[edit][f.k];
      if (f.req && !wasEmpty && !String(form[f.k] || '').trim()) bad[f.k] = true;
    });
    setErr(bad);
    if (Object.keys(bad).length) return;
    const next = [...items];
    if (edit != null) next[edit] = { ...next[edit], ...form }; else next.push(form);
    run(async () => { await save({ [k]: next }); reset(); }, edit != null ? 'Changes saved' : 'Added');
  };
  return (
    <>
      <Card title={`${edit != null ? 'Edit' : 'Add'} ${cfg.title.toLowerCase()}`}>
        {cfg.fields.map((f) => (
          <Field key={f.k} label={f.l} req={f.req} error={err[f.k]}>
            {f.image ? (
              <div className="row">
                <label className="bt"><input hidden type="file" accept="image/*" onChange={(e) => {
                  const file = e.target.files[0]; e.target.value = '';
                  if (file) run(async () => set(f.k, await upload(file, { image: true, max: 1400 })), 'Image attached');
                }} />Upload image</label>
                {form[f.k] && <><img className="thumb" src={form[f.k]} alt="Preview" /><button className="ib" onClick={() => set(f.k, '')} aria-label="Remove image">✕</button></>}
              </div>
            ) : f.area ? <textarea rows="3" value={form[f.k]} onChange={(e) => set(f.k, e.target.value)} /> : <input value={form[f.k]} onChange={(e) => set(f.k, e.target.value)} />}
          </Field>
        ))}
        <div className="row"><button className="bt" onClick={submit}>{edit != null ? 'Save changes' : cfg.add}</button>{edit != null && <button className="bt ghost" onClick={reset}>Cancel edit</button>}</div>
      </Card>
      <Card title={`${cfg.title} on your page`}>
        {items.length === 0 && <p className="mut">Nothing added yet.</p>}
        {items.map((it, i) => (
          <div className="rw" key={i}>
            <span>{cfg.label(it)}</span>
            <span className="row">
              <button className="ib" onClick={() => { setForm({ ...blank, ...it }); setEdit(i); setErr({}); }}>Edit</button>
              <button className="ib" aria-label="Remove" onClick={() => run(() => save({ [k]: items.filter((_, j) => j !== i) }), 'Removed')}>✕</button>
            </span>
          </div>
        ))}
      </Card>
    </>
  );
}

function GalleryTab({ data, save, upload, run }) {
  return (
    <Card title="Photo gallery">
      <label className="dz"><input hidden multiple type="file" accept="image/*" onChange={(e) => {
        const files = [...e.target.files]; e.target.value = '';
        run(async () => { const urls = []; for (const f of files) urls.push(await upload(f, { image: true })); await save({ gal: [...data.gal, ...urls] }); }, 'Photos added');
      }} />Add photos (click to choose, several at once)</label>
      {data.gal.length === 0 && <p className="mut">No photos yet. The gallery section stays hidden until you add one.</p>}
      {data.gal.map((src, i) => (
        <div className="rw" key={src + i}><img className="thumb" src={src} alt="" /><button className="ib" aria-label="Remove photo" onClick={() => run(() => save({ gal: data.gal.filter((_, j) => j !== i) }), 'Removed')}>✕</button></div>
      ))}
    </Card>
  );
}

function VideosTab({ data, save, upload, run }) {
  const [n, setN] = useState('');
  const [u, setU] = useState('');
  const [bad, setBad] = useState(false);
  return (
    <Card title="Videos & vlogs">
      <label className="dz"><input hidden type="file" accept="video/*" onChange={(e) => {
        const f = e.target.files[0]; e.target.value = '';
        if (f) run(async () => { const url = await upload(f, { name: f.name }); await save({ vid: [...data.vid, { n: f.name.replace(/\.[^.]+$/, ''), u: url }] }); }, 'Video uploaded');
      }} />Upload a video file (up to 50 MB on the free plan; it streams on your public page)</label>
      <p className="mut">Or add a direct video link (.mp4 or .webm):</p>
      <Field label="Title"><input value={n} onChange={(e) => setN(e.target.value)} /></Field>
      <Field label="Video URL" req error={bad}><input value={u} onChange={(e) => { setU(e.target.value); setBad(false); }} /></Field>
      <button className="bt" onClick={() => { if (!u.trim()) return setBad(true); run(async () => { await save({ vid: [...data.vid, { n, u: u.trim() }] }); setN(''); setU(''); }, 'Video added'); }}>Add video link</button>
      {data.vid.length === 0 && <p className="mut">No videos yet. The vlogs section stays hidden until you add one.</p>}
      {data.vid.map((v, i) => (
        <div className="rw" key={i}><span>{v.n || v.u}</span><button className="ib" aria-label="Remove video" onClick={() => run(() => save({ vid: data.vid.filter((_, j) => j !== i) }), 'Removed')}>✕</button></div>
      ))}
    </Card>
  );
}

function SocialTab({ data, save, run }) {
  const [l, setL] = useState(data.links);
  const names = [['github', 'GitHub'], ['linkedin', 'LinkedIn'], ['instagram', 'Instagram'], ['leetcode', 'LeetCode'], ['snapchat', 'Snapchat'], ['pinterest', 'Pinterest'], ['x', 'X']];
  return (
    <Card title="Social links">
      <p className="mut">Icons only appear on your page for links you fill in.</p>
      <div className="two">
        {names.map(([k, n]) => (
          <Field key={k} label={<span className="ico-l"><img src={`/icons/${k}.svg`} alt="" />{n}</span>}>
            <input placeholder="https://…" value={l[k] || ''} onChange={(e) => setL({ ...l, [k]: e.target.value })} />
          </Field>
        ))}
      </div>
      <button className="bt" onClick={() => run(() => save({ links: l }), 'Social links saved')}>Save social links</button>
    </Card>
  );
}

function AnimTab({ data, save, run }) {
  const [a, setA] = useState(data.anim);
  return (
    <Card title="Animations">
      <p className="mut">Applies to photo tiles and cards on the public page.</p>
      <div className="row wrapr">{ENTRANCE.map(([l, v]) => <button key={v} className={`bt ${a.ent === v ? 'on' : 'ghost'}`} onClick={() => setA({ ...a, ent: v })}>{l}</button>)}</div>
      <Field label="Speed (lower is faster)"><div className="row"><input type="range" min="3" max="15" value={Math.round(a.speed * 10)} onChange={(e) => setA({ ...a, speed: e.target.value / 10 })} /><b className="readout">{Number(a.speed).toFixed(1)} s</b></div></Field>
      <button className="bt" onClick={() => run(() => save({ anim: a }), 'Animation settings saved')}>Save animation settings</button>
    </Card>
  );
}

function SettingsTab({ user, theme, toggleTheme, run, data }) {
  const [sure, setSure] = useState(false);
  return (
    <>
      <Card title="Appearance"><div className="row"><button className={`bt ${theme === 'dark' ? 'on' : 'ghost'}`} onClick={() => theme !== 'dark' && toggleTheme()}>Dark</button><button className={`bt ${theme === 'light' ? 'on' : 'ghost'}`} onClick={() => theme !== 'light' && toggleTheme()}>Light</button></div></Card>
      <Card title="Account"><p>Signed in as <b>{user.email}</b></p><button className="bt ghost" onClick={logout}>Log out</button></Card>
      <Card title="Data">
        <p className="mut">Content is stored in your Supabase database (table site_content) and files in Supabase Storage (bucket uploads).</p>
        <button className="bt ghost" onClick={() => navigator.clipboard && navigator.clipboard.writeText(JSON.stringify(data, null, 2))}>Copy backup (JSON)</button>
        <button className="bt danger" onClick={() => { if (!sure) { setSure(true); setTimeout(() => setSure(false), 4000); return; } setSure(false); run(() => resetSite(), 'Content reset to the built-in defaults'); }}>{sure ? 'Click again to confirm reset' : 'Reset all content to defaults'}</button>
      </Card>
      <Card title="Help & support"><p className="mut">Something not working? Check the README troubleshooting section, or email yourself the details.</p><a className="bt" href={`mailto:${ADMIN_EMAIL}?subject=Portfolio%20admin%20support`}>Contact support</a></Card>
    </>
  );
}

/* ---------- shell ---------- */
const TABS = [['profile', 'Personal info'], ['ach', 'Achievements'], ['proj', 'Projects'], ['skill', 'Skills'], ['cert', 'Certifications'], ['gal', 'Photo gallery'], ['vid', 'Videos & vlogs'], ['sport', 'Sports'], ['social', 'Social links'], ['anim', 'Animations'], ['settings', 'Settings']];

function Gate({ children }) {
  return <div className="gate"><div className="g acard gatec">{children}</div></div>;
}

export default function Admin() {
  const { user, isAdmin, authError, clearAuthError } = useAuth();
  const { data } = useSite();
  const [theme, toggleTheme] = useTheme();
  const [tab, setTab] = useState('profile');
  const [drawer, setDrawer] = useState(false);
  const [busy, setBusy] = useState(0);
  const [msg, setMsg] = useState({ t: 'Changes you save here go live instantly.' });

  const run = async (fn, ok) => {
    setBusy((b) => b + 1);
    try { await fn(); if (ok) setMsg({ t: `● ${ok} · live ${new Date().toLocaleTimeString()}` }); }
    catch (e) { console.error(e); setMsg({ t: `Error: ${e.message || e}`, bad: true }); }
    finally { setBusy((b) => b - 1); }
  };
  const upload = (file, o = {}) => uploadMediaWithProgress(file, o, setMsg);

  if (!configured) return <Gate><h2>Supabase is not connected yet</h2><p className="mut">Fill in the values in your <code>.env</code> file (see README step 5), restart <code>npm run dev</code>, and reload this page.</p><a className="bt" href="/">Back to the site</a></Gate>;
  if (user === undefined) return <div className="boot"><span className="spin big" /></div>;
  if (!user) return <SignIn authError={authError} clearAuthError={clearAuthError} />;
  if (!isAdmin) return <Gate><h2>Not authorised</h2><p className="mut">{user.email} is not the admin account.</p><button className="bt ghost" onClick={logout}>Sign out</button></Gate>;

  const common = { data, save: saveSite, upload, run };
  let body;
  if (LISTS[tab]) body = <ListTab key={tab} k={tab} {...common} />;
  else if (tab === 'profile') body = <PersonalTab {...common} />;
  else if (tab === 'gal') body = <GalleryTab {...common} />;
  else if (tab === 'vid') body = <VideosTab {...common} />;
  else if (tab === 'social') body = <SocialTab {...common} />;
  else if (tab === 'anim') body = <AnimTab {...common} />;
  else body = <SettingsTab user={user} theme={theme} toggleTheme={toggleTheme} run={run} data={data} />;

  return (
    <div className="adm">
      <div className="mtb"><button className="ib" onClick={() => setDrawer(true)} aria-label="Open menu">☰</button><b>aditya.dev admin</b></div>
      {drawer && <div className="scrim" onClick={() => setDrawer(false)} />}
      <aside className={`side ${drawer ? 'open' : ''}`}>
        <b className="logo">aditya<span>.dev</span> <small className="m">admin</small></b>
        {TABS.map(([k, l]) => <button key={k} className={`tab ${tab === k ? 'on' : ''}`} onClick={() => { setTab(k); setDrawer(false); }}>{l}</button>)}
        <a className="tab live" href="/" target="_blank" rel="noopener noreferrer">View live site ↗</a>
      </aside>
      <main className="main">
        <div className="m">Dashboard</div>
        <h1>Edit your portfolio</h1>
        <div className={`status ${msg.bad ? 'bad' : ''}`}>{busy > 0 && <span className="spin" />}{msg.t}</div>
        <div className="panel" key={tab}>{body}</div>
      </main>
    </div>
  );
}

function SignIn({ authError, clearAuthError }) {
  const [mode, setMode] = useState('password'); // 'password' | 'magic'
  const [email, setEmail] = useState(ADMIN_EMAIL);
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [state, setState] = useState({ sent: false, err: '', busy: false });

  const handlePasswordLogin = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (clearAuthError) clearAuthError();
    setState({ sent: false, err: '', busy: true });
    try {
      await loginWithPassword(email.trim(), password);
    } catch (err) {
      setState({ sent: false, err: err.message || String(err), busy: false });
    }
  };

  const handleSendLink = async () => {
    if (clearAuthError) clearAuthError();
    setState({ sent: false, err: '', busy: true });
    try {
      await loginWithEmail(email.trim());
      setState({ sent: true, err: '', busy: false });
    } catch (err) {
      setState({ sent: false, err: err.message || String(err), busy: false });
    }
  };

  const handleVerifyOtp = async () => {
    if (clearAuthError) clearAuthError();
    setState((s) => ({ ...s, err: '', busy: true }));
    try {
      await verifyOtpCode(email.trim(), otp);
    } catch (err) {
      setState((s) => ({ ...s, err: err.message || String(err), busy: false }));
    }
  };

  return (
    <Gate>
      <h2>Admin sign-in</h2>
      <p className="mut">Sign in to edit your portfolio. Only the admin account can access.</p>

      {(authError || state.err) && (
        <div style={{ background: 'color-mix(in srgb, var(--bad) 15%, transparent)', padding: '12px 14px', borderRadius: 10, width: '100%', border: '1px solid var(--bad)' }}>
          <p className="er" style={{ margin: 0 }} role="alert">
            {authError ? `Link note: ${authError}` : state.err}
          </p>
          {authError && (
            <p className="mut" style={{ fontSize: 12, marginTop: 4 }}>
              Email links can expire or fail if opened in a different browser. Sign in directly with your password below.
            </p>
          )}
        </div>
      )}

      <div className="row" style={{ width: '100%', gap: 8 }}>
        <button
          type="button"
          className={`bt ${mode === 'password' ? 'on' : 'ghost'}`}
          style={{ flex: 1 }}
          onClick={() => { setMode('password'); setState((s) => ({ ...s, err: '' })); }}
        >
          Password
        </button>
        <button
          type="button"
          className={`bt ${mode === 'magic' ? 'on' : 'ghost'}`}
          style={{ flex: 1 }}
          onClick={() => { setMode('magic'); setState((s) => ({ ...s, err: '' })); }}
        >
          Email link / OTP
        </button>
      </div>

      <Field label="Admin email">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </Field>

      {mode === 'password' ? (
        <form onSubmit={handlePasswordLogin} style={{ display: 'contents' }}>
          <Field label="Password">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your admin password"
              autoComplete="current-password"
            />
          </Field>
          <button
            type="submit"
            className="bt"
            style={{ width: '100%' }}
            disabled={state.busy || !email.trim() || !password}
          >
            {state.busy ? 'Signing in…' : 'Sign in with password'}
          </button>
        </form>
      ) : (
        <>
          <button
            type="button"
            className="bt"
            style={{ width: '100%' }}
            disabled={state.busy || !email.trim()}
            onClick={handleSendLink}
          >
            {state.busy ? 'Sending…' : 'Send sign-in link & OTP code'}
          </button>

          {state.sent && (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p className="mut" style={{ fontSize: 13 }}>
                ✓ Check your inbox for the login email. Either click the link in <b>this same browser</b>, or enter the 6-digit confirmation code below:
              </p>
              <Field label="6-Digit OTP code from email">
                <input
                  type="text"
                  placeholder="e.g. 123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  maxLength={10}
                />
              </Field>
              <button
                type="button"
                className="bt"
                style={{ width: '100%' }}
                disabled={state.busy || !otp.trim()}
                onClick={handleVerifyOtp}
              >
                {state.busy ? 'Verifying…' : 'Verify code'}
              </button>
            </div>
          )}
        </>
      )}

      <button
        type="button"
        className="bt ghost"
        style={{ width: '100%' }}
        onClick={() => loginWithGoogle().catch((e) => setState({ sent: false, err: e.message, busy: false }))}
      >
        Sign in with Google (if configured)
      </button>

      <a className="mut" href="/" style={{ alignSelf: 'center', marginTop: 4 }}>
        Back to the public site
      </a>
    </Gate>
  );
}

async function uploadMediaWithProgress(file, o, setMsg) {
  setMsg({ t: 'Uploading…' });
  const blob = o.image ? await resizeImage(file, o.max || 1600) : file;
  const name = o.image ? (o.name || file.name).replace(/\.[^.]+$/, '') + '.jpg' : (o.name || file.name);
  return uploadMedia(blob, name);
}
