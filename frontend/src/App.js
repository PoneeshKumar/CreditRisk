import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine
} from "recharts";

const API = "http://localhost:8000";

// ─── Design tokens ───────────────────────────────────────────────────────────
const T = {
  bg:       "#0A0E1A",
  surface:  "#111827",
  card:     "#161D2E",
  border:   "#1E2D45",
  muted:    "#2A3A55",
  text:     "#E8EEF8",
  sub:      "#7A8FAD",
  low:      "#22D3A0",
  lowBg:    "rgba(34,211,160,0.1)",
  medium:   "#F59E0B",
  medBg:    "rgba(245,158,11,0.1)",
  high:     "#F43F5E",
  highBg:   "rgba(244,63,94,0.1)",
  accent:   "#4F8EF7",
  accentBg: "rgba(79,142,247,0.1)",
  purple:   "#A78BFA",
};

const riskColor = (tier) => tier === "low" ? T.low : tier === "medium" ? T.medium : T.high;
const riskBg    = (tier) => tier === "low" ? T.lowBg : tier === "medium" ? T.medBg : T.highBg;

const SECTION_META = {
  income_statement:   { label: "Income",        icon: "📈" },
  balance_sheet:      { label: "Balance Sheet",  icon: "⚖️" },
  cash_flow:          { label: "Cash Flow",      icon: "💧" },
  bank_statement:     { label: "Bank",           icon: "🏦" },
  credit_application: { label: "Credit App",     icon: "📋" },
};

// ─── Animated counter ────────────────────────────────────────────────────────
function Counter({ value, duration = 800 }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setV(Math.round(value * ease));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [value, duration]);
  return <>{v}</>;
}

// ─── Score arc ────────────────────────────────────────────────────────────────
function ScoreArc({ score, size = 140, animate = true }) {
  const [displayed, setDisplayed] = useState(animate ? 0 : score);
  useEffect(() => {
    if (!animate) { setDisplayed(score); return; }
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / 900, 1);
      setDisplayed(Math.round(score * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [score, animate]);

  const tier = score < 40 ? "low" : score < 70 ? "medium" : "high";
  const color = riskColor(tier);
  const r = size * 0.38;
  const circ = 2 * Math.PI * r;
  const offset = circ - (displayed / 100) * circ;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={T.border} strokeWidth={size*0.07}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={size*0.07}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} filter="url(#glow)"
        style={{ transition: animate ? "none" : "stroke-dashoffset 0.8s cubic-bezier(.4,0,.2,1)" }}/>
      <text x={size/2} y={size/2 - 4} textAnchor="middle"
        fontSize={size * 0.26} fontWeight="700" fill={color}
        fontFamily="'Space Grotesk', monospace">{displayed}</text>
      <text x={size/2} y={size/2 + size*0.18} textAnchor="middle"
        fontSize={size * 0.09} fill={T.sub} fontFamily="'Inter', sans-serif"
        letterSpacing="0.05em">RISK SCORE</text>
    </svg>
  );
}

// ─── Mini sparkline ──────────────────────────────────────────────────────────
function Sparkline({ data, color }) {
  if (!data || data.length < 2) return null;
  return (
    <ResponsiveContainer width="100%" height={40}>
      <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`sg${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3}/>
            <stop offset="100%" stopColor={color} stopOpacity={0}/>
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5}
          fill={`url(#sg${color.replace('#','')})`} dot={false}/>
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Upload dropzone ─────────────────────────────────────────────────────────
function DropZone({ file, setFile }) {
  const [drag, setDrag] = useState(false);
  const ref = useRef();
  const onDrop = (e) => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f?.type === "application/pdf") setFile(f);
  };
  return (
    <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)} onDrop={onDrop}
      onClick={() => ref.current.click()}
      style={{
        border: `2px dashed ${drag ? T.accent : file ? T.low : T.border}`,
        borderRadius: 16, padding: "44px 24px", textAlign: "center",
        cursor: "pointer", background: drag ? T.accentBg : file ? T.lowBg : T.surface,
        transition: "all 0.2s", marginBottom: 20, position: "relative", overflow: "hidden"
      }}>
      {!file && (
        <div style={{ position: "absolute", inset: 0, opacity: 0.03,
          backgroundImage: "repeating-linear-gradient(0deg,#fff 0,#fff 1px,transparent 1px,transparent 40px),repeating-linear-gradient(90deg,#fff 0,#fff 1px,transparent 1px,transparent 40px)" }}/>
      )}
      <input ref={ref} type="file" accept=".pdf"
        onChange={(e) => setFile(e.target.files[0])} style={{ display: "none" }}/>
      <div style={{ fontSize: 36, marginBottom: 12 }}>{file ? "✓" : "⬆"}</div>
      <p style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 600,
        color: file ? T.low : T.text, fontFamily: "'Space Grotesk', sans-serif" }}>
        {file ? file.name : "Drop financial PDF here"}
      </p>
      <p style={{ margin: 0, fontSize: 13, color: T.sub }}>
        {file ? `${(file.size/1024).toFixed(1)} KB · Fiscal years auto-detected` : "Income statements · Balance sheets · Cash flow · Bank statements"}
      </p>
    </div>
  );
}

// ─── Custom tooltip ──────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10,
      padding: "10px 14px" }}>
      <p style={{ color: T.sub, fontSize: 11, marginBottom: 6, fontFamily: "'Space Grotesk', monospace",
        letterSpacing: "0.05em" }}>FY {label}</p>
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: p.color }}/>
          <span style={{ color: T.text, fontSize: 13, fontWeight: 600 }}>{p.name}: {p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Section card ────────────────────────────────────────────────────────────
function SectionCard({ skey, section, delay = 0 }) {
  const meta = SECTION_META[skey] || { label: skey, icon: "📊" };
  const tier = section.tier;
  const color = riskColor(tier);
  const pct = section.score;

  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`, borderRadius: 16,
      padding: 20, animation: `fadeUp 0.4s ease ${delay}ms both`,
      position: "relative", overflow: "hidden"
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, ${color} ${pct}%, transparent ${pct}%)` }}/>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <p style={{ fontSize: 11, color: T.sub, marginBottom: 4, letterSpacing: "0.08em",
            fontFamily: "'Space Grotesk', monospace" }}>{meta.icon} {meta.label.toUpperCase()}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color, fontFamily: "'Space Grotesk', monospace" }}>
              {pct}
            </span>
            <span style={{ fontSize: 12, color: T.sub }}>/100</span>
          </div>
        </div>
        <span style={{ padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600,
          background: riskBg(tier), color, border: `1px solid ${color}22`,
          letterSpacing: "0.06em", textTransform: "uppercase" }}>{tier}</span>
      </div>
      <div style={{ height: 3, background: T.border, borderRadius: 99, marginBottom: 14 }}>
        <div style={{ height: "100%", borderRadius: 99, background: color,
          width: `${pct}%`, transition: "width 0.8s cubic-bezier(.4,0,.2,1)" }}/>
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {section.findings.slice(0, 3).map((f, i) => (
          <li key={i} style={{ fontSize: 12, color: T.sub, padding: "3px 0",
            borderBottom: i < section.findings.length - 1 ? `1px solid ${T.border}` : "none",
            display: "flex", alignItems: "flex-start", gap: 6 }}>
            <span style={{ color: color, marginTop: 1 }}>·</span>{f}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Year tab ────────────────────────────────────────────────────────────────
function YearTab({ year, score, tier, active, onClick }) {
  const color = riskColor(tier);
  return (
    <button onClick={onClick} style={{
      background: active ? T.card : "transparent",
      border: `1px solid ${active ? T.border : "transparent"}`,
      borderRadius: 12, padding: "10px 20px", cursor: "pointer",
      transition: "all 0.2s", textAlign: "left", minWidth: 90
    }}>
      <p style={{ fontSize: 11, color: T.sub, marginBottom: 4, fontFamily: "'Space Grotesk', monospace",
        letterSpacing: "0.06em" }}>FY {year}</p>
      <p style={{ fontSize: 20, fontWeight: 700, color, margin: 0,
        fontFamily: "'Space Grotesk', monospace" }}>{score}</p>
    </button>
  );
}

// ─── Main app ────────────────────────────────────────────────────────────────
export default function App() {
  const [file, setFile]           = useState(null);
  const [result, setResult]       = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [history, setHistory]     = useState([]);
  const [companies, setCompanies] = useState([]);
  const [view, setView]           = useState("upload");
  const [activeYear, setActiveYear] = useState(null);
  const [historyCompany, setHistoryCompany] = useState(null);

  useEffect(() => {
    axios.get(`${API}/companies`).then(r => setCompanies(r.data)).catch(() => {});
  }, [result]);

  const upload = async () => {
    if (!file) return;
    setLoading(true); setError(null); setResult(null); setHistory([]);
    const fd = new FormData(); fd.append("file", file);
    try {
      const res = await axios.post(`${API}/analyze-pdf`, fd);
      setResult(res.data);
      const yrs = Object.keys(res.data.results || {}).map(Number).sort((a,b) => b-a);
      if (yrs.length) setActiveYear(yrs[0]);
      if (res.data.company_id) loadHistory(res.data.company_id);
    } catch { setError("Upload failed — make sure backend is running on port 8000."); }
    finally { setLoading(false); }
  };

  const loadHistory = async (id) => {
    const res = await axios.get(`${API}/companies/${id}/history`);
    setHistory(res.data);
  };

  const yearResults = result?.results
    ? Object.entries(result.results)
        .sort(([a],[b]) => Number(b)-Number(a))
        .map(([y,r]) => ({ year: Number(y), ...r }))
    : [];

  const currentYear = yearResults.find(r => r.year === activeYear) || yearResults[0];

  const trendData = [...yearResults].reverse().map(r => ({
    year: r.year,
    score: r.overall_score,
    ...Object.fromEntries(
      Object.entries(r.sections || {}).map(([k,v]) => [SECTION_META[k]?.label || k, v.score])
    )
  }));

  const historyTrend = history.map(h => ({
    year: h.fiscal_year, score: h.overall_score,
    income: h.income_score, balance: h.balance_score,
    cashflow: h.cashflow_score
  }));

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${T.bg}; color: ${T.text}; font-family: 'Inter', sans-serif;
          min-height: 100vh; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${T.muted}; border-radius: 99px; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .btn-primary {
          background: ${T.accent}; color: #fff; border: none; border-radius: 12px;
          padding: 14px 28px; font-size: 15px; font-weight: 600; cursor: pointer;
          font-family: 'Space Grotesk', sans-serif; transition: all 0.2s;
          letter-spacing: 0.01em; width: 100%;
        }
        .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(79,142,247,0.3); }
        .btn-primary:disabled { background: ${T.muted}; color: ${T.sub}; cursor: not-allowed; transform: none; box-shadow: none; }
        .btn-ghost {
          background: transparent; color: ${T.sub}; border: 1px solid ${T.border};
          border-radius: 10px; padding: 8px 16px; font-size: 13px; font-weight: 500;
          cursor: pointer; font-family: 'Inter', sans-serif; transition: all 0.15s;
        }
        .btn-ghost:hover { color: ${T.text}; border-color: ${T.muted}; }
        .nav-item {
          background: transparent; border: none; padding: 8px 16px; border-radius: 10px;
          font-size: 14px; font-weight: 500; cursor: pointer; color: ${T.sub};
          font-family: 'Inter', sans-serif; transition: all 0.15s;
        }
        .nav-item:hover { color: ${T.text}; }
        .nav-item.active { background: ${T.surface}; color: ${T.text}; }
        .company-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 20px; border-radius: 14px; cursor: pointer;
          border: 1px solid ${T.border}; background: ${T.card}; transition: all 0.2s;
          margin-bottom: 10px;
        }
        .company-row:hover { border-color: ${T.accent}44; background: ${T.surface}; transform: translateX(4px); }
      `}</style>

      {/* ── Nav ── */}
      <nav style={{ borderBottom: `1px solid ${T.border}`, padding: "0 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 60, position: "sticky", top: 0, zIndex: 100,
        background: `${T.bg}cc`, backdropFilter: "blur(12px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: T.accent,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>◈</div>
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em",
            fontFamily: "'Space Grotesk', sans-serif", color: T.text }}>CreditLens</span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {[["upload","Analyze"],["companies","Companies"]].map(([v,l]) => (
            <button key={v} className={`nav-item${view===v?" active":""}`} onClick={() => setView(v)}>{l}</button>
          ))}
        </div>
      </nav>

      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "40px 24px" }}>

        {/* ── Upload view ── */}
        {view === "upload" && !result && !loading && (
          <div style={{ maxWidth: 560, margin: "0 auto", animation: "fadeUp 0.5s ease both" }}>
            <div style={{ textAlign: "center", marginBottom: 36 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px",
                borderRadius: 99, background: T.accentBg, border: `1px solid ${T.accent}33`,
                marginBottom: 16 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.accent,
                  animation: "pulse 2s infinite" }}/>
                <span style={{ fontSize: 12, color: T.accent, fontWeight: 600, letterSpacing: "0.06em" }}>
                  AI-POWERED ANALYSIS
                </span>
              </div>
              <h1 style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.15, marginBottom: 12,
                fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.03em" }}>
                Financial Risk<br/>
                <span style={{ color: T.accent }}>Intelligence</span>
              </h1>
              <p style={{ color: T.sub, fontSize: 15, lineHeight: 1.6 }}>
                Upload any financial document. We detect fiscal years automatically and analyze every section.
              </p>
            </div>
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 20, padding: 28 }}>
              <DropZone file={file} setFile={setFile}/>
              <button className="btn-primary" onClick={upload} disabled={!file}>
                Analyze Document →
              </button>
              {error && <p style={{ marginTop: 12, color: T.high, fontSize: 13, textAlign: "center" }}>{error}</p>}
            </div>
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div style={{ textAlign: "center", padding: "100px 0" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%",
              border: `3px solid ${T.border}`, borderTopColor: T.accent,
              animation: "spin 0.7s linear infinite", margin: "0 auto 20px" }}/>
            <p style={{ color: T.sub, fontSize: 15 }}>Scanning document and detecting fiscal years...</p>
          </div>
        )}

        {/* ── Results view ── */}
        {result && !loading && (
          <div>
            {/* Top bar */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between",
              marginBottom: 32, flexWrap: "wrap", gap: 16, animation: "fadeUp 0.4s ease both" }}>
              <div>
                <p style={{ fontSize: 11, color: T.sub, letterSpacing: "0.1em", marginBottom: 6,
                  fontFamily: "'Space Grotesk', monospace" }}>ANALYSIS COMPLETE</p>
                <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em",
                  fontFamily: "'Space Grotesk', sans-serif", marginBottom: 10 }}>
                  {result.business_name}
                </h2>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {result.years_detected?.map(y => (
                    <span key={y} style={{ padding: "3px 10px", borderRadius: 6,
                      background: T.surface, color: T.sub, fontSize: 12,
                      fontFamily: "'Space Grotesk', monospace", border: `1px solid ${T.border}` }}>{y}</span>
                  ))}
                </div>
              </div>
              <button className="btn-ghost" onClick={() => { setResult(null); setFile(null); }}>
                ← New analysis
              </button>
            </div>

            {/* Year tabs */}
            <div style={{ display: "flex", gap: 8, marginBottom: 28, flexWrap: "wrap" }}>
              {yearResults.map(r => (
                <YearTab key={r.year} year={r.year} score={r.overall_score}
                  tier={r.overall_tier} active={activeYear === r.year}
                  onClick={() => setActiveYear(r.year)}/>
              ))}
            </div>

            {currentYear && (
              <>
                {/* Hero row */}
                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 20,
                  marginBottom: 20, animation: "fadeUp 0.4s ease 0.1s both" }}>

                  {/* Score card */}
                  <div style={{ background: T.card, border: `1px solid ${T.border}`,
                    borderRadius: 20, padding: 28, display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center", minWidth: 200 }}>
                    <ScoreArc score={currentYear.overall_score} size={140}/>
                    <div style={{ marginTop: 16, textAlign: "center" }}>
                      <span style={{
                        padding: "5px 14px", borderRadius: 99, fontSize: 12, fontWeight: 700,
                        background: riskBg(currentYear.overall_tier),
                        color: riskColor(currentYear.overall_tier),
                        border: `1px solid ${riskColor(currentYear.overall_tier)}33`,
                        letterSpacing: "0.08em", textTransform: "uppercase"
                      }}>{currentYear.overall_tier} risk</span>
                      <p style={{ marginTop: 10, fontSize: 13, color: T.sub }}>
                        Recommendation:{" "}
                        <span style={{ color: riskColor(currentYear.overall_tier), fontWeight: 600,
                          textTransform: "capitalize" }}>
                          {currentYear.overall_recommendation}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                    {Object.entries(currentYear.sections || {}).map(([k, s], i) => {
                      const meta = SECTION_META[k] || { label: k, icon: "📊" };
                      const color = riskColor(s.tier);
                      return (
                        <div key={k} className="metric-card" style={{
                          background: T.card, border: `1px solid ${T.border}`,
                          borderRadius: 14, padding: 16, position: "relative", overflow: "hidden",
                          animation: `fadeUp 0.4s ease ${i * 60 + 200}ms both`
                        }}>
                          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2,
                            background: color, opacity: 0.6 }}/>
                          <p style={{ fontSize: 11, color: T.sub, marginBottom: 8,
                            letterSpacing: "0.07em", fontFamily: "'Space Grotesk', monospace" }}>
                            {meta.icon} {meta.label.toUpperCase()}
                          </p>
                          <p style={{ fontSize: 26, fontWeight: 700, color, marginBottom: 4,
                            fontFamily: "'Space Grotesk', monospace" }}>{s.score}</p>
                          <div style={{ height: 3, background: T.border, borderRadius: 99, marginBottom: 10 }}>
                            <div style={{ height: "100%", background: color, borderRadius: 99,
                              width: `${s.score}%`, transition: "width 0.8s ease" }}/>
                          </div>
                          <p style={{ fontSize: 11, color: T.sub, lineHeight: 1.5 }}>
                            {s.findings[0] || "No data"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Section detail cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))",
                  gap: 14, marginBottom: 24 }}>
                  {Object.entries(currentYear.sections || {}).map(([k, s], i) => (
                    <SectionCard key={k} skey={k} section={s} delay={i * 80}/>
                  ))}
                </div>
              </>
            )}

            {/* Trend chart */}
            {trendData.length > 1 && (
              <div style={{ background: T.card, border: `1px solid ${T.border}`,
                borderRadius: 20, padding: 28, marginBottom: 20,
                animation: "fadeUp 0.4s ease 0.3s both" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                  <div>
                    <p style={{ fontSize: 11, color: T.sub, letterSpacing: "0.08em", marginBottom: 4,
                      fontFamily: "'Space Grotesk', monospace" }}>RISK TRAJECTORY</p>
                    <h3 style={{ fontSize: 17, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif" }}>
                      Year-over-Year Trend
                    </h3>
                  </div>
                  <div style={{ display: "flex", gap: 16 }}>
                    {["score"].concat(Object.keys(currentYear?.sections || {}).map(k => SECTION_META[k]?.label)).map((label, i) => (
                      <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2,
                          background: [T.accent, T.low, T.medium, T.purple, T.high, T.text][i] }}/>
                        <span style={{ fontSize: 12, color: T.sub, textTransform: "capitalize" }}>
                          {label === "score" ? "Overall" : label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={trendData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false}/>
                    <XAxis dataKey="year" stroke={T.sub} tick={{ fill: T.sub, fontSize: 12 }}/>
                    <YAxis domain={[0, 100]} stroke={T.sub} tick={{ fill: T.sub, fontSize: 12 }}/>
                    <Tooltip content={<ChartTooltip/>}/>
                    <ReferenceLine y={70} stroke={T.high} strokeDasharray="4 4" strokeOpacity={0.4}/>
                    <ReferenceLine y={40} stroke={T.low} strokeDasharray="4 4" strokeOpacity={0.4}/>
                    <Line type="monotone" dataKey="score" name="Overall" stroke={T.accent}
                      strokeWidth={2.5} dot={{ r: 5, fill: T.accent, strokeWidth: 0 }}/>
                    {Object.keys(currentYear?.sections || {}).map((k, i) => (
                      <Line key={k} type="monotone"
                        dataKey={SECTION_META[k]?.label || k}
                        name={SECTION_META[k]?.label || k}
                        stroke={[T.low, T.medium, T.purple, T.high, T.text][i]}
                        strokeWidth={1.5} strokeDasharray="4 4"
                        dot={{ r: 3, strokeWidth: 0 }}/>
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* ── Companies view ── */}
        {view === "companies" && !historyCompany && (
          <div style={{ animation: "fadeUp 0.4s ease both" }}>
            <div style={{ marginBottom: 28 }}>
              <p style={{ fontSize: 11, color: T.sub, letterSpacing: "0.1em", marginBottom: 6,
                fontFamily: "'Space Grotesk', monospace" }}>DATABASE</p>
              <h2 style={{ fontSize: 26, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif",
                letterSpacing: "-0.02em" }}>Companies</h2>
            </div>
            {companies.length === 0 ? (
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 20,
                padding: "60px 40px", textAlign: "center" }}>
                <p style={{ fontSize: 32, marginBottom: 12 }}>🏢</p>
                <p style={{ color: T.sub, fontSize: 15 }}>No companies yet — upload a financial document to get started</p>
              </div>
            ) : companies.map((c, i) => (
              <div key={c.id} className="company-row"
                style={{ animationDelay: `${i * 60}ms`, animation: `fadeUp 0.4s ease ${i*60}ms both` }}
                onClick={() => { loadHistory(c.id); setHistoryCompany(c); }}>
                <div>
                  <p style={{ fontWeight: 600, fontSize: 15, marginBottom: 3,
                    fontFamily: "'Space Grotesk', sans-serif" }}>{c.name}</p>
                  <p style={{ fontSize: 12, color: T.sub }}>
                    Added {new Date(c.created_at).toLocaleDateString("en-US", { year:"numeric", month:"short", day:"numeric" })}
                  </p>
                </div>
                <span style={{ color: T.sub, fontSize: 18 }}>→</span>
              </div>
            ))}
          </div>
        )}

        {/* ── History view ── */}
        {view === "companies" && historyCompany && history.length > 0 && (
          <div style={{ animation: "fadeUp 0.4s ease both" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 32 }}>
              <button className="btn-ghost" onClick={() => setHistoryCompany(null)}>← Back</button>
              <div>
                <p style={{ fontSize: 11, color: T.sub, letterSpacing: "0.1em", marginBottom: 3,
                  fontFamily: "'Space Grotesk', monospace" }}>HISTORY</p>
                <h2 style={{ fontSize: 24, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif",
                  letterSpacing: "-0.02em" }}>{historyCompany.name}</h2>
              </div>
            </div>

            {/* Year score cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px,1fr))",
              gap: 12, marginBottom: 24 }}>
              {history.map((h, i) => {
                const color = riskColor(h.overall_tier);
                return (
                  <div key={h.id} style={{ background: T.card, border: `1px solid ${T.border}`,
                    borderRadius: 16, padding: 20, textAlign: "center",
                    animation: `fadeUp 0.4s ease ${i*80}ms both` }}>
                    <p style={{ fontSize: 11, color: T.sub, letterSpacing: "0.08em", marginBottom: 12,
                      fontFamily: "'Space Grotesk', monospace" }}>FY {h.fiscal_year}</p>
                    <ScoreArc score={h.overall_score} size={80} animate={false}/>
                    <span style={{ display: "inline-block", marginTop: 10, padding: "3px 10px",
                      borderRadius: 99, fontSize: 11, fontWeight: 700, background: riskBg(h.overall_tier),
                      color, border: `1px solid ${color}33`, letterSpacing: "0.06em",
                      textTransform: "uppercase" }}>{h.overall_tier}</span>
                  </div>
                );
              })}
            </div>

            {/* Trend chart */}
            {historyTrend.length > 1 && (
              <div style={{ background: T.card, border: `1px solid ${T.border}`,
                borderRadius: 20, padding: 28, marginBottom: 24 }}>
                <p style={{ fontSize: 11, color: T.sub, letterSpacing: "0.08em", marginBottom: 4,
                  fontFamily: "'Space Grotesk', monospace" }}>RISK TREND</p>
                <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 24,
                  fontFamily: "'Space Grotesk', sans-serif" }}>Score Over Time</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={historyTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={T.accent} stopOpacity={0.3}/>
                        <stop offset="100%" stopColor={T.accent} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false}/>
                    <XAxis dataKey="year" stroke={T.sub} tick={{ fill: T.sub, fontSize: 12 }}/>
                    <YAxis domain={[0, 100]} stroke={T.sub} tick={{ fill: T.sub, fontSize: 12 }}/>
                    <Tooltip content={<ChartTooltip/>}/>
                    <ReferenceLine y={70} stroke={T.high} strokeDasharray="4 4" strokeOpacity={0.4}/>
                    <ReferenceLine y={40} stroke={T.low} strokeDasharray="4 4" strokeOpacity={0.4}/>
                    <Area type="monotone" dataKey="score" name="Overall" stroke={T.accent}
                      strokeWidth={2.5} fill="url(#areaGrad)" dot={{ r: 5, fill: T.accent, strokeWidth: 0 }}/>
                    <Line type="monotone" dataKey="income" name="Income" stroke={T.low}
                      strokeWidth={1.5} strokeDasharray="4 4" dot={false}/>
                    <Line type="monotone" dataKey="balance" name="Balance" stroke={T.medium}
                      strokeWidth={1.5} strokeDasharray="4 4" dot={false}/>
                    <Line type="monotone" dataKey="cashflow" name="Cash Flow" stroke={T.purple}
                      strokeWidth={1.5} strokeDasharray="4 4" dot={false}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Metrics table */}
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 20, padding: 28 }}>
              <p style={{ fontSize: 11, color: T.sub, letterSpacing: "0.08em", marginBottom: 4,
                fontFamily: "'Space Grotesk', monospace" }}>FINANCIALS</p>
              <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 20,
                fontFamily: "'Space Grotesk', sans-serif" }}>Metrics by Year</h3>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      {["Year","Revenue","Net Income","Total Assets","Liabilities","Op. Cash"].map(h => (
                        <th key={h} style={{ padding: "10px 14px", textAlign: "left",
                          color: T.sub, fontWeight: 500, fontSize: 11, letterSpacing: "0.06em",
                          borderBottom: `1px solid ${T.border}`,
                          fontFamily: "'Space Grotesk', monospace" }}>{h.toUpperCase()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(h => (
                      <tr key={h.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                        <td style={{ padding: "12px 14px", fontWeight: 700,
                          fontFamily: "'Space Grotesk', monospace", color: T.accent }}>
                          {h.fiscal_year}
                        </td>
                        {[h.revenue, null, h.total_assets, h.total_liabilities, h.operating_cash].map((v, i) => {
                          const isIncome = i === 1;
                          const val = isIncome ? h.net_income : v;
                          return (
                            <td key={i} style={{ padding: "12px 14px",
                              color: isIncome ? (val > 0 ? T.low : T.high) : T.text }}>
                              {val != null ? `$${Number(val).toLocaleString()}` : "—"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}