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

const scoreGauge = (score) => {
  const color = score < 40 ? "#1D9E75" : score < 70 ? "#BA7517" : "#E24B4A";
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;
  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx="70" cy="70" r="54" fill="none" stroke="#eee" strokeWidth="12"/>
      <circle cx="70" cy="70" r="54" fill="none" stroke={color} strokeWidth="12"
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round" transform="rotate(-90 70 70)"
        style={{ transition: "stroke-dashoffset 0.6s ease" }}/>
      <text x="70" y="66" textAnchor="middle" fontSize="28" fontWeight="500" fill={color}>{score}</text>
      <text x="70" y="86" textAnchor="middle" fontSize="12" fill="#888">/100</text>
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

      <div style={{ maxWidth: 760, margin: "40px auto", padding: "0 20px" }}>
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #eee", padding: 32, marginBottom: 24 }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 500 }}>Upload financial document</h2>
          <p style={{ margin: "0 0 24px", fontSize: 14, color: "#888" }}>Upload a PDF — bank statement, income statement, or credit application</p>

          <div style={{ border: "2px dashed #ddd", borderRadius: 12, padding: "32px 24px", textAlign: "center", marginBottom: 20, background: file ? "#f0f9f4" : "#fafafa", borderColor: file ? "#1D9E75" : "#ddd", transition: "all 0.2s" }}>
            <input type="file" accept=".pdf" id="file-input" onChange={(e) => setFile(e.target.files[0])} style={{ display: "none" }}/>
            <label htmlFor="file-input" style={{ cursor: "pointer" }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={file ? "#1D9E75" : "#aaa"} strokeWidth="1.5" style={{ display: "block", margin: "0 auto 12px" }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <p style={{ margin: "0 0 4px", fontSize: 14, color: file ? "#1D9E75" : "#555", fontWeight: 500 }}>{file ? file.name : "Click to upload PDF"}</p>
              <p style={{ margin: 0, fontSize: 12, color: "#aaa" }}>{file ? `${(file.size / 1024).toFixed(1)} KB` : "PDF files only"}</p>
            </label>
          </div>

          <button onClick={handleUpload} disabled={!file || loading}
            style={{ width: "100%", padding: "12px", borderRadius: 10, border: "none", background: !file || loading ? "#ccc" : "#378ADD", color: "#fff", fontSize: 15, fontWeight: 500, cursor: !file || loading ? "not-allowed" : "pointer", transition: "background 0.2s" }}>
            {loading ? "Analyzing document..." : "Analyze PDF"}
          </button>

          {error && <p style={{ margin: "16px 0 0", color: "#E24B4A", fontSize: 14 }}>{error}</p>}
        </div>

        {loading && (
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #eee", padding: 40, textAlign: "center" }}>
            <p style={{ color: "#888", fontSize: 14 }}>Gemini is reading your document...</p>
          </div>
        )}

        {result && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16, marginBottom: 16 }}>
              <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #eee", padding: 24, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                {scoreGauge(result.risk_score)}
                <p style={{ margin: "8px 0 0", fontSize: 13, color: "#888" }}>Risk score</p>
              </div>

              <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #eee", padding: 24 }}>
                <p style={{ margin: "0 0 4px", fontSize: 13, color: "#888" }}>Business</p>
                <p style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 500 }}>{result.business_name}</p>

                <p style={{ margin: "0 0 4px", fontSize: 13, color: "#888" }}>Risk tier</p>
                <span style={{ display: "inline-block", padding: "4px 14px", borderRadius: 20, background: tierColor(result.risk_tier) + "20", color: tierColor(result.risk_tier), fontWeight: 500, fontSize: 14, textTransform: "capitalize", marginBottom: 16 }}>{result.risk_tier} risk</span>

                <p style={{ margin: "0 0 4px", fontSize: 13, color: "#888" }}>Recommendation</p>
                <span style={{ display: "inline-block", padding: "4px 14px", borderRadius: 20, background: tierColor(result.risk_tier) + "20", color: tierColor(result.risk_tier), fontWeight: 500, fontSize: 14, textTransform: "capitalize" }}>{result.recommendation}</span>
              </div>
            </div>

            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #eee", padding: 24, marginBottom: 16 }}>
              <p style={{ margin: "0 0 12px", fontSize: 13, color: "#888" }}>Key findings</p>
              {result.key_findings.map((f, i) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
                  <div style={{ minWidth: 6, height: 6, borderRadius: "50%", background: "#378ADD", marginTop: 6 }}/>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>{f}</p>
                </div>
              ))}
            </div>

            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #eee", padding: 24 }}>
              <p style={{ margin: "0 0 8px", fontSize: 13, color: "#888" }}>AI summary</p>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: "#333" }}>{result.summary}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

