import { useState, useEffect } from "react";
import axios from "axios";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function App() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [view, setView] = useState("upload");

  useEffect(() => {
    axios.get("http://localhost:8000/companies")
      .then(res => setCompanies(res.data))
      .catch(() => {});
  }, [result]);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setHistory([]);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await axios.post("http://localhost:8000/analyze-pdf", formData);
      setResult(res.data);
      if (res.data.company_id) loadHistory(res.data.company_id);
    } catch (err) {
      setError("Failed to analyze PDF. Make sure your backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async (companyId) => {
    const res = await axios.get(`http://localhost:8000/companies/${companyId}/history`);
    setHistory(res.data);
  };

  const tierColor = (tier) => {
    if (tier === "low") return "#1D9E75";
    if (tier === "medium") return "#BA7517";
    return "#E24B4A";
  };

  const sectionLabel = (key) => ({
    income_statement:   "Income Statement",
    balance_sheet:      "Balance Sheet",
    cash_flow:          "Cash Flow",
    bank_statement:     "Bank Statement",
    credit_application: "Credit Application",
  }[key] || key);

  const ScoreGauge = ({ score, size = 120 }) => {
    const color = score < 40 ? "#1D9E75" : score < 70 ? "#BA7517" : "#E24B4A";
    const r = size * 0.38;
    const circ = 2 * Math.PI * r;
    const offset = circ - (score / 100) * circ;
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#eee" strokeWidth={size*0.08}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={size*0.08}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}/>
        <text x={size/2} y={size/2 - 4} textAnchor="middle" fontSize={size*0.22} fontWeight="500" fill={color}>{score}</text>
        <text x={size/2} y={size/2 + size*0.14} textAnchor="middle" fontSize={size*0.1} fill="#888">/100</text>
      </svg>
    );
  };

  // Flatten results_by_year into a sorted array for display
  const yearResults = result?.results
    ? Object.entries(result.results)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([year, r]) => ({ year: Number(year), ...r }))
    : [];

  return (
    <div style={{ minHeight: "100vh", background: "#f8f8f6", fontFamily: "system-ui, sans-serif" }}>

      {/* Nav */}
      <div style={{ background: "#fff", borderBottom: "1px solid #eee", padding: "16px 40px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "#378ADD", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <span style={{ fontSize: 16, fontWeight: 500 }}>Credit Risk Analyzer</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {["upload", "companies"].map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{ padding: "7px 16px", borderRadius: 8, border: "none", fontSize: 13, cursor: "pointer", background: view === v ? "#378ADD" : "transparent", color: view === v ? "#fff" : "#888", fontWeight: view === v ? 500 : 400 }}>
              {v === "upload" ? "Analyze" : "Companies"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: "40px auto", padding: "0 20px" }}>

        {/* Upload view */}
        {view === "upload" && (
          <div>
            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #eee", padding: 32, marginBottom: 24 }}>
              <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 500 }}>Upload financial document</h2>
              <p style={{ margin: "0 0 24px", fontSize: 14, color: "#888" }}>Upload a PDF — fiscal years are detected automatically from the document</p>

              <div style={{ border: "2px dashed #ddd", borderRadius: 12, padding: "32px 24px", textAlign: "center", marginBottom: 20, background: file ? "#f0f9f4" : "#fafafa", borderColor: file ? "#1D9E75" : "#ddd" }}>
                <input type="file" accept=".pdf" id="file-input" onChange={(e) => setFile(e.target.files[0])} style={{ display: "none" }}/>
                <label htmlFor="file-input" style={{ cursor: "pointer" }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={file ? "#1D9E75" : "#aaa"} strokeWidth="1.5" style={{ display: "block", margin: "0 auto 12px" }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  <p style={{ margin: "0 0 4px", fontSize: 14, color: file ? "#1D9E75" : "#555", fontWeight: 500 }}>{file ? file.name : "Click to upload PDF"}</p>
                  <p style={{ margin: 0, fontSize: 12, color: "#aaa" }}>{file ? `${(file.size / 1024).toFixed(1)} KB` : "PDF files only"}</p>
                </label>
              </div>

              <button onClick={handleUpload} disabled={!file || loading}
                style={{ width: "100%", padding: "12px", borderRadius: 10, border: "none", background: !file || loading ? "#ccc" : "#378ADD", color: "#fff", fontSize: 15, fontWeight: 500, cursor: !file || loading ? "not-allowed" : "pointer" }}>
                {loading ? "Analyzing document..." : "Analyze PDF"}
              </button>
              {error && <p style={{ margin: "16px 0 0", color: "#E24B4A", fontSize: 14 }}>{error}</p>}
            </div>

            {loading && (
              <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #eee", padding: 40, textAlign: "center" }}>
                <p style={{ color: "#888", fontSize: 14 }}>Detecting years and analyzing all sections...</p>
              </div>
            )}

            {result && (
              <div>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <div>
                    <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 500 }}>{result.business_name}</h2>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, color: "#888" }}>Years detected:</span>
                      {result.years_detected?.map(y => (
                        <span key={y} style={{ padding: "2px 10px", borderRadius: 20, background: "#E6F1FB", color: "#0C447C", fontSize: 12, fontWeight: 500 }}>{y}</span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Year cards */}
                {yearResults.map(({ year, overall_score, overall_tier, overall_recommendation, sections }) => (
                  <div key={year} style={{ background: "#fff", borderRadius: 16, border: "1px solid #eee", padding: 24, marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 20 }}>
                      <ScoreGauge score={overall_score} size={100}/>
                      <div>
                        <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 500 }}>FY {year}</p>
                        <span style={{ display: "inline-block", padding: "3px 12px", borderRadius: 20, background: tierColor(overall_tier) + "20", color: tierColor(overall_tier), fontWeight: 500, fontSize: 13, textTransform: "capitalize", marginBottom: 8 }}>{overall_tier} risk</span>
                        <p style={{ margin: 0, fontSize: 13, color: "#888" }}>Recommendation: <span style={{ color: tierColor(overall_tier), fontWeight: 500, textTransform: "capitalize" }}>{overall_recommendation}</span></p>
                      </div>
                    </div>

                    {/* Section breakdown */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
                      {Object.entries(sections).map(([key, section]) => (
                        <div key={key} style={{ background: "#f9f9f9", borderRadius: 10, padding: 14 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                            <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: "#555" }}>{sectionLabel(key)}</p>
                            <ScoreGauge score={section.score} size={44}/>
                          </div>
                          <ul style={{ margin: 0, paddingLeft: 14 }}>
                            {section.findings.map((f, i) => (
                              <li key={i} style={{ fontSize: 11, color: "#666", marginBottom: 2, lineHeight: 1.5 }}>{f}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Trend chart */}
                {yearResults.length > 1 && (
                  <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #eee", padding: 24, marginBottom: 16 }}>
                    <p style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 500 }}>Risk score trend</p>
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={yearResults}>
                        <XAxis dataKey="year"/>
                        <YAxis domain={[0, 100]}/>
                        <Tooltip/>
                        <Legend/>
                        <Line type="monotone" dataKey="overall_score" stroke="#378ADD" name="Overall" strokeWidth={2} dot={{ r: 5 }}/>
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Companies view */}
        {view === "companies" && (
          <div>
            <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 500 }}>All companies</h2>
            {companies.length === 0 && (
              <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #eee", padding: 40, textAlign: "center" }}>
                <p style={{ color: "#888", fontSize: 14 }}>No companies yet — upload a PDF to get started</p>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
              {companies.map(c => (
                <div key={c.id} onClick={() => { loadHistory(c.id); setView("history"); }}
                  style={{ background: "#fff", borderRadius: 14, border: "1px solid #eee", padding: 20, cursor: "pointer" }}>
                  <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 500 }}>{c.name}</p>
                  <p style={{ margin: 0, fontSize: 12, color: "#aaa" }}>Added {new Date(c.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* History view */}
        {view === "history" && history.length > 0 && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <button onClick={() => setView("companies")}
                style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #ddd", background: "transparent", fontSize: 13, cursor: "pointer", color: "#555" }}>
                Back
              </button>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 500 }}>{history[0]?.business_name || "Company"}</h2>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
              {history.map(h => (
                <div key={h.id} style={{ background: "#fff", borderRadius: 14, border: "1px solid #eee", padding: 20, textAlign: "center" }}>
                  <p style={{ margin: "0 0 8px", fontSize: 13, color: "#888" }}>FY {h.fiscal_year}</p>
                  <ScoreGauge score={h.overall_score} size={80}/>
                  <span style={{ display: "inline-block", marginTop: 8, padding: "3px 10px", borderRadius: 20, background: tierColor(h.overall_tier) + "20", color: tierColor(h.overall_tier), fontWeight: 500, fontSize: 12, textTransform: "capitalize" }}>{h.overall_tier}</span>
                </div>
              ))}
            </div>

            {history.length > 1 && (
              <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #eee", padding: 24, marginBottom: 16 }}>
                <p style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 500 }}>Risk trend</p>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={history}>
                    <XAxis dataKey="fiscal_year"/>
                    <YAxis domain={[0, 100]}/>
                    <Tooltip/>
                    <Legend/>
                    <Line type="monotone" dataKey="overall_score" stroke="#378ADD" name="Overall" strokeWidth={2} dot={{ r: 5 }}/>
                    <Line type="monotone" dataKey="income_score" stroke="#1D9E75" name="Income" strokeWidth={1.5} strokeDasharray="4 4"/>
                    <Line type="monotone" dataKey="balance_score" stroke="#BA7517" name="Balance sheet" strokeWidth={1.5} strokeDasharray="4 4"/>
                    <Line type="monotone" dataKey="cashflow_score" stroke="#7F77DD" name="Cash flow" strokeWidth={1.5} strokeDasharray="4 4"/>
                    <Line type="monotone" dataKey="bank_score" stroke="#E24B4A" name="Bank" strokeWidth={1.5} strokeDasharray="4 4"/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #eee", padding: 24 }}>
              <p style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 500 }}>Financial metrics by year</p>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f5f5f5" }}>
                      {["Year", "Revenue", "Net Income", "Total Assets", "Total Liabilities", "Operating Cash"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 500, color: "#555" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(h => (
                      <tr key={h.id} style={{ borderTop: "1px solid #f0f0f0" }}>
                        <td style={{ padding: "8px 12px", fontWeight: 500 }}>FY {h.fiscal_year}</td>
                        <td style={{ padding: "8px 12px" }}>{h.revenue ? `$${Number(h.revenue).toLocaleString()}` : "—"}</td>
                        <td style={{ padding: "8px 12px", color: h.net_income > 0 ? "#1D9E75" : "#E24B4A" }}>{h.net_income ? `$${Number(h.net_income).toLocaleString()}` : "—"}</td>
                        <td style={{ padding: "8px 12px" }}>{h.total_assets ? `$${Number(h.total_assets).toLocaleString()}` : "—"}</td>
                        <td style={{ padding: "8px 12px" }}>{h.total_liabilities ? `$${Number(h.total_liabilities).toLocaleString()}` : "—"}</td>
                        <td style={{ padding: "8px 12px" }}>{h.operating_cash ? `$${Number(h.operating_cash).toLocaleString()}` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}