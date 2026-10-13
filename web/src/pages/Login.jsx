import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";

const DEMO = [
  { role: "Admin", who: "Daniel Dumile", email: "daniel.dumile@allcaps.example" },
  { role: "Payroll", who: "Jeffery Williams", email: "jeffery.williams@allcaps.example" },
  { role: "Manager", who: "Aubrey Graham", email: "aubrey.graham@allcaps.example" },
  { role: "Employee", who: "LeBron James", email: "lebron.james@allcaps.example" },
];

const SLIDES = [
  { title: ["Payroll for everyone,", "in a single click"], text: "A stored procedure walks every active employee with a cursor and writes each payslip." },
  { title: ["Every rule lives", "in the database"], text: "Constraints, triggers and Row Level Security guard the data, not just the buttons." },
  { title: ["One system,", "four points of view"], text: "Admin, Payroll, Manager and Employee each see exactly what they should." },
];

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 5000);
    return () => clearInterval(t);
  }, [slide]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await signIn(email.trim(), password);
    if (error) setError(error.message === "Invalid login credentials" ? "Incorrect e-mail or password." : error.message);
    setBusy(false);
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <section className="auth-visual" aria-label="About All Caps Payroll">
          <Scene />
          <div className="auth-visual-top">
            <div className="auth-logo">All Caps</div>
            <span className="auth-chip">BCSE302L · DBMS Project</span>
          </div>
          <div className="auth-caption">
            {SLIDES.map((s, i) => (
              <div key={i} className={`auth-slide ${i === slide ? "is-active" : ""}`} aria-hidden={i !== slide}>
                <h2>{s.title[0]}<br />{s.title[1]}</h2>
                <p>{s.text}</p>
              </div>
            ))}
            <div className="auth-dots" role="tablist" aria-label="Slides">
              {SLIDES.map((_, i) => (
                <button key={i} role="tab" aria-selected={i === slide} aria-label={`Slide ${i + 1}`}
                        className={`auth-dot ${i === slide ? "is-active" : ""}`} onClick={() => setSlide(i)} />
              ))}
            </div>
          </div>
        </section>

        <section className="auth-form-side">
          <div className="auth-form-wrap">
            <h1>Welcome back</h1>
            <p className="auth-sub">Sign in with your work e-mail. Accounts are created by HR.</p>

            <form onSubmit={submit} className="auth-form">
              <input className="auth-input" type="email" required placeholder="Work e-mail" aria-label="Work e-mail"
                     value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
              <div className="auth-pass">
                <input className="auth-input" type={show ? "text" : "password"} required placeholder="Enter your password"
                       aria-label="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                <button type="button" className="auth-eye" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"}>
                  <EyeIcon off={show} />
                </button>
              </div>
              {error && <div className="auth-error" role="alert">{error}</div>}
              <button className="auth-submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
            </form>

            <div className="auth-divider"><span>Or sign in as</span></div>
            <div className="auth-demos">
              {DEMO.map((d) => (
                <button key={d.role} type="button" className={`auth-demo ${email === d.email ? "is-picked" : ""}`}
                        onClick={() => { setEmail(d.email); setError(null); }}>
                  <span className="auth-demo-role">{d.role}</span>
                  <span className="auth-demo-who">{d.who}</span>
                </button>
              ))}
            </div>
            <p className="auth-foot">Demo accounts share the project's demo password.</p>
          </div>
        </section>
      </div>
    </div>
  );
}

function EyeIcon({ off }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  );
}

/* Night landscape: layered hills, moon and stars (pure SVG, no image file). */
function Scene() {
  const stars = [
    [62, 70, 1.2], [140, 40, 0.9], [210, 96, 1.1], [300, 56, 0.8], [372, 120, 1.3], [446, 34, 1], [520, 88, 0.9],
    [96, 150, 0.8], [252, 170, 1], [418, 196, 0.8], [560, 150, 1.1], [30, 220, 0.9], [330, 230, 0.7], [482, 250, 1],
  ];
  return (
    <svg className="auth-scene" viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b2a24" />
          <stop offset="0.45" stopColor="#1d5a4a" />
          <stop offset="0.75" stopColor="#3f8a6c" />
          <stop offset="1" stopColor="#c99a4a" />
        </linearGradient>
        <radialGradient id="glow" cx="0.72" cy="0.3" r="0.45">
          <stop offset="0" stopColor="#f3d79a" stopOpacity="0.55" />
          <stop offset="1" stopColor="#f3d79a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="h1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2c6b57" /><stop offset="1" stopColor="#1a4a3d" /></linearGradient>
        <linearGradient id="h2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1d4f42" /><stop offset="1" stopColor="#123a30" /></linearGradient>
        <linearGradient id="h3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#123b31" /><stop offset="1" stopColor="#0b261f" /></linearGradient>
        <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.45" stopColor="#081c17" stopOpacity="0" />
          <stop offset="1" stopColor="#081c17" stopOpacity="0.92" />
        </linearGradient>
      </defs>
      <rect width="600" height="800" fill="url(#sky)" />
      <rect width="600" height="800" fill="url(#glow)" />
      {stars.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill="#fff" opacity={0.55 + (i % 3) * 0.15} />)}
      <circle cx="432" cy="236" r="46" fill="#f6e2b0" />
      <circle cx="450" cy="226" r="46" fill="#255f4f" opacity="0.35" />
      <path d="M0 470 C 90 420 170 430 250 455 S 420 500 600 410 L 600 800 L 0 800 Z" fill="url(#h1)" />
      <path d="M0 560 C 120 500 220 520 320 548 S 500 590 600 520 L 600 800 L 0 800 Z" fill="url(#h2)" />
      <path d="M-20 640 C 110 590 230 620 330 650 S 520 690 620 630 L 620 800 L -20 800 Z" fill="url(#h3)" />
      <path d="M250 455 C 300 470 330 500 320 548" stroke="#4d9a7b" strokeOpacity="0.35" strokeWidth="2" fill="none" />
      <rect width="600" height="800" fill="url(#fade)" />
    </svg>
  );
}
