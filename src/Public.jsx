import { useEffect, useRef, useState } from 'react';
import { useSite, useAuth, useTheme, logout } from './store';
import { DEFAULT_PHOTO, DEFAULT_RESUME } from './defaults';

const SOCIAL = [
  ['github', 'GitHub', '#8b949e', 'wt'],
  ['linkedin', 'LinkedIn', '#0a66c2', 'wt'],
  ['leetcode', 'LeetCode', '#ffa116', 'wt'],
  ['instagram', 'Instagram', '#e1306c', 'nt'],
  ['snapchat', 'Snapchat', '#fffc00', 'nt'],
  ['pinterest', 'Pinterest', '#e60023', 'wt'],
  ['x', 'X', '#8b949e', 'wt'],
];

const splitList = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);

function useRotate(words) {
  const list = splitList(words);
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => x + 1), 1800);
    return () => clearInterval(t);
  }, [words]);
  return list.length ? list[i % list.length] : '';
}

function Reveal({ id, children }) {
  const ref = useRef(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!ref.current || typeof IntersectionObserver === 'undefined') { setOn(true); return undefined; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { threshold: 0.06 });
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return <section id={id} ref={ref} className={`sec rv ${on ? 'in' : ''}`}>{children}</section>;
}

const Head = ({ n, label, title }) => (<><div className="m">{n} / {label}</div><h2>{title}</h2></>);

function Zoomable({ src, alt, onOpen }) {
  return (
    <span className="sk zwrap">
      <img className="zm" src={src} alt={alt} loading="lazy" onClick={() => onOpen(src)} />
    </span>
  );
}

export function PublicView({ data, loading, admin, onTheme, onLogout, themeName }) {
  const [menu, setMenu] = useState(false);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [lb, setLb] = useState(null);
  const { t, links, anim } = data;
  const word = useRotate(t.words);
  const photo = data.photo || DEFAULT_PHOTO;
  const resume = data.resume && data.resume.url ? data.resume : DEFAULT_RESUME;
  const has = { gal: data.gal.length > 0, vid: data.vid.length > 0 };

  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') { setLb(null); setMenu(false); setResumeOpen(false); } };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  if (loading) return <div className="boot" role="status" aria-label="Loading"><span className="spin big" /></div>;

  const nav = [['about', 'About'], ['timeline', 'Timeline'], ['work', 'Projects'], has.gal && ['gallery', 'Gallery'], has.vid && ['vlogs', 'Vlogs'], ['sports', 'Sports']].filter(Boolean);

  return (
    <div className="site" style={{ '--dur': `${anim.speed}s`, '--ent': anim.ent }}>
      <i className="orb o1" /><i className="orb o2" />
      {(menu || resumeOpen) && <div className="scrim" onClick={() => { setMenu(false); setResumeOpen(false); }} />}
      <div className="wrap">
        <header className="g nav">
          <div className="pw">
            {admin && (
              <>
                <button className="avb" onClick={() => setMenu(!menu)} aria-label="Admin menu"><img className="avi" src={photo} alt="" /></button>
                {menu && (
                  <div className="dd" role="menu">
                    <button className="ddc" onClick={() => setMenu(false)} aria-label="Close menu">✕</button>
                    <div className="ddh"><b>{t.name}</b><small>{t.email}</small></div>
                    <a className="di" href="/admin">Admin page</a>
                    <button className="di" onClick={onTheme}><span>{themeName === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}</span><span className="sw"><span className={`swk ${themeName === 'light' ? 'on' : ''}`} /></span></button>
                    <button className="di" onClick={onLogout}>Log out</button>
                  </div>
                )}
              </>
            )}
            <b className="logo">aditya<span>.dev</span></b>
          </div>
          <nav className="navl">{nav.map(([id, l]) => <a key={id} href={`#${id}`}>{l}</a>)}</nav>
          <div className="navr">
            <div className="rwrap">
              <button className="rsb" onClick={() => setResumeOpen(!resumeOpen)} aria-haspopup="true" aria-expanded={resumeOpen}>Resume <small>▾</small></button>
              {resumeOpen && (
                <div className="rpop" role="menu">
                  <a className="di" href={resume.url} target="_blank" rel="noopener noreferrer">View resume</a>
                  <a className="di" href={resume.url} download={resume.name || 'resume.pdf'} target="_blank" rel="noopener noreferrer">Download resume</a>
                </div>
              )}
            </div>
            <a className="btn-p" href="#contact">Hire me</a>
          </div>
        </header>

        <section id="about" className="hero">
          <div className="h-t">
            <div className="m">Computer Science &amp; Design · {t.loc}</div>
            <h1>{t.name}.<br />Where <em>code</em> meets <em>craft</em>.</h1>
            <div className="rot">&gt; <span key={word} className="rotw">{word}</span><i className="cur">▍</i></div>
            <p className="bio">{t.bio}</p>
            <div className="cta">
              <a className="btn-p" href="#work">View projects</a>
              <a className="btn-o" href={resume.url} target="_blank" rel="noopener noreferrer" download={resume.name || 'resume.pdf'}>Download resume</a>
            </div>
          </div>
          <div className="h-p"><div className="pt sk"><img src={photo} alt={t.name} /></div></div>
          <div className="h-d g">
            {[['Studying', 'BE CS & Design, Year 3'], ['University', 'SPPU'], ['Role', t.role], ['Community', 'GDG Mumbai · Pune · Gandhinagar']].map(([k, v]) => <div key={k} className="kv"><span>{k}</span><span>{v}</span></div>)}
            <div className="kv"><span>Email</span><a href={`mailto:${t.email}`}>{t.email}</a></div>
            <div className="kv"><span>Status</span><span className="hl">{t.status}</span></div>
          </div>
        </section>

        <Reveal id="skills">
          <Head n="" label="Skills" title="Toolkit" />
          <div className="grid g3">
            {data.skill.map((g, i) => (
              <div className="g card" key={i}><b>{g.n}</b><div className="chips">{splitList(g.i).map((c) => <span className="chip" key={c}>{c}</span>)}</div></div>
            ))}
          </div>
        </Reveal>

        <Reveal id="timeline">
          <Head n="01" label="Achievements & timeline" title="The journey so far" />
          <div className="grid g4">
            {data.ach.map((a, i) => <div className="g card" key={i}><div className="m">{a.y}</div><h3>{a.t}</h3><p>{a.x}</p></div>)}
          </div>
        </Reveal>

        <Reveal id="work">
          <Head n="02" label="Projects" title="Selected work" />
          <div className="grid g2">
            {data.proj.map((p, i) => (
              <div className="g card proj" key={i}>
                <h3>{p.t}</h3><p>{p.x}</p>
                {p.s && <div className="m">{p.s}</div>}
                <div className="links">
                  {p.u && <a href={p.u} target="_blank" rel="noopener noreferrer">Live demo ↗</a>}
                  {p.v && <a href={p.v} target="_blank" rel="noopener noreferrer">Source ↗</a>}
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal id="certs">
          <Head n="03" label="Certifications" title="Always learning" />
          <div className="grid g4">
            {data.cert.map((c, i) => (
              <div className="g card" key={i}>
                <div className="m">{c.y}</div><h3 className="sm">{c.t}</h3><p>{c.i}</p>
                {c.c && <Zoomable src={c.c} alt={`Certificate: ${c.t}`} onOpen={setLb} />}
              </div>
            ))}
          </div>
        </Reveal>

        {has.gal && (
          <Reveal id="gallery">
            <Head n="04" label="Gallery" title="Moments and achievements" />
            <div className="gal">
              {data.gal.map((src, i) => (
                <button key={src + i} className={`ph ga sk ${i === 0 && data.gal.length > 2 ? 'big' : ''}`} onClick={() => setLb(src)} aria-label={`Open photo ${i + 1}`}>
                  <img src={src} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          </Reveal>
        )}

        {has.vid && (
          <Reveal id="vlogs">
            <Head n="05" label="Video & mini vlogs" title="On camera" />
            <div className="grid g3">
              {data.vid.map((v, i) => (
                <div className="g card va" key={i}>
                  <video className="sk" controls preload="metadata" playsInline src={v.u} />
                  <b>{v.n || 'Video'}</b>
                </div>
              ))}
            </div>
          </Reveal>
        )}

        <Reveal id="sports">
          <Head n="06" label="Sports" title="Off the keyboard" />
          <div className="grid g4">
            {data.sport.map((s, i) => (
              <div className="g card" key={i}><h3 className="sm">{s.t}</h3>{s.x && <p>{s.x}</p>}{s.c && <Zoomable src={s.c} alt={`Certificate: ${s.t}`} onOpen={setLb} />}</div>
            ))}
          </div>
        </Reveal>

        <Reveal id="contact">
          <div className="g ct">
            <div className="m">07 / Find me online</div>
            <h2>Let&apos;s build something</h2>
            <div className="icons">
              {SOCIAL.filter(([k]) => links[k]).map(([k, name, c, cls]) => (
                <a key={k} href={links[k]} target="_blank" rel="noopener noreferrer" aria-label={name} className={`g ic ${cls}`} style={{ '--c': c }}><img className="ico" src={`/icons/${k}.svg`} alt="" /></a>
              ))}
              <a href={`mailto:${t.email}`} aria-label="Email" className="g ic wt" style={{ '--c': '#ea4335' }}><img className="ico" src="/icons/gmail.svg" alt="" /></a>
            </div>
          </div>
        </Reveal>
        <footer className="foot">© {new Date().getFullYear()} {t.name} · Designed and built by me</footer>
      </div>

      {lb && (
        <div className="lb" onClick={() => setLb(null)} role="dialog" aria-modal="true">
          <div className="lbi" onClick={(e) => e.stopPropagation()}>
            <img src={lb} alt="Enlarged" />
            <button className="lbx" onClick={() => setLb(null)} aria-label="Close">✕</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Public() {
  const { data, loading } = useSite();
  const { isAdmin } = useAuth();
  const [theme, toggle] = useTheme();
  return <PublicView data={data} loading={loading} admin={isAdmin} themeName={theme} onTheme={toggle} onLogout={logout} />;
}
