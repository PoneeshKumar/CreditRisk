import { useState } from "react";
import axios from "axios";

export default function App() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await axios.post("http://localhost:8000/analyze-pdf", formData);
      setResult(res.data);
    } catch (err) {
      setError("Failed to analyze PDF. Make sure your backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const tierColor = (tier) => {
    if (tier === "low") return "#1D9E75";
    if (tier === "medium") return "#BA7517";
    return "#E24B4A";
  };

  const sectionLabel = (key) => ({
    income_statement: "Income Statement",
    balance_sheet: "Balance Sheet",
    cash_flow: "Cash Flow",
    bank_statement: "Bank Statement",
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

  return (
    <div style={{ minHeight: "100vh", background: "#f8f8f6", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #eee", padding: "16px 40px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "#378ADD", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        </div>
        <span style={{ fontSize: 16, fontWeight: 500 }}>Credit Risk Analyzer</span>
      </div>

      <div style={{ maxWidth: 820, margin: "40px auto", padding: "0 20px" }}>
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #eee", padding: 32, marginBottom: 24 }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 500 }}>Upload financial document</h2>
          <p style={{ margin: "0 0 24px", fontSize: 14, color: "#888" }}>Supports income statements, balance sheets, cash flow, bank statements, and credit applications</p>
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
            <p style={{ color: "#888", fontSize: 14 }}>Analyzing all financial sections...</p>
          </div>
        )}

        {result && (
          <div>
            {/* Overall score */}
            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #eee", padding: 24, marginBottom: 20, display: "flex", alignItems: "center", gap: 32 }}>
              <ScoreGauge score={result.overall_score} size={140}/>
              <div>
                <p style={{ margin: "0 0 4px", fontSize: 13, color: "#888" }}>Company</p>
                <p style={{ margin: "0 0 12px", fontSize: 20, fontWeight: 500 }}>{result.business_name}</p>
                <p style={{ margin: "0 0 4px", fontSize: 13, color: "#888" }}>Overall risk</p>
                <span style={{ display: "inline-block", padding: "4px 14px", borderRadius: 20, background: tierColor(result.overall_tier) + "20", color: tierColor(result.overall_tier), fontWeight: 500, fontSize: 14, textTransform: "capitalize", marginBottom: 12 }}>{result.overall_tier} risk</span>
                <p style={{ margin: "0 0 4px", fontSize: 13, color: "#888" }}>Recommendation</p>
                <span style={{ display: "inline-block", padding: "4px 14px", borderRadius: 20, background: tierColor(result.overall_tier) + "20", color: tierColor(result.overall_tier), fontWeight: 500, fontSize: 14, textTransform: "capitalize" }}>{result.overall_recommendation}</span>
              </div>
            </div>

            {/* Section breakdown */}
            <p style={{ fontSize: 13, color: "#888", margin: "0 0 12px" }}>Section breakdown — {Object.keys(result.sections).length} document{Object.keys(result.sections).length > 1 ? "s" : ""} detected</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
              {Object.entries(result.sections).map(([key, section]) => (
                <div key={key} style={{ background: "#fff", borderRadius: 14, border: `1.5px solid ${tierColor(section.tier)}30`, padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>{sectionLabel(key)}</p>
                    <ScoreGauge score={section.score} size={56}/>
                  </div>
                  <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, background: tierColor(section.tier) + "20", color: tierColor(section.tier), fontWeight: 500, fontSize: 12, textTransform: "capitalize", marginBottom: 10 }}>{section.tier} risk</span>
                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                    {section.findings.map((f, i) => (
                      <li key={i} style={{ fontSize: 12, color: "#555", marginBottom: 3, lineHeight: 1.5 }}>{f}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}