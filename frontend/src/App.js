import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { supabase } from "./supabase";
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine
} from "recharts";

const API = "http://localhost:8000";

// Warm brutalist palette — amber/cream/ink
const C = {
  bg:       "#F5F0E8",
  paper:    "#FFFDF7",
  ink:      "#1C1A14",
  inkLight: "#3D3A30",
  rule:     "#D4C9B0",
  faint:    "#EDE8DC",
  amber:    "#C17D00",
  amberBg:  "#FFF8E6",
  green:    "#1A6B3C",
  greenBg:  "#EBF7F0",
  red:      "#B02020",
  redBg:    "#FBF0F0",
  blue:     "#1A3A6B",
  blueBg:   "#EBF0FB",
  sub:      "#7A7260",
  hint:     "#A89E8A",
};

const rc   = t => t==="low"?C.green:t==="medium"?C.amber:C.red;
const rbg  = t => t==="low"?C.greenBg:t==="medium"?C.amberBg:C.redBg;

const SM = {
  income_statement:   { short:"INC",  label:"Income Statement"   },
  balance_sheet:      { short:"BAL",  label:"Balance Sheet"       },
  cash_flow:          { short:"CF",   label:"Cash Flow"           },
  bank_statement:     { short:"BNK",  label:"Bank Statement"      },
  credit_application: { short:"CRD",  label:"Credit Application"  },
};

const LCOLORS = [C.blue, C.green, C.amber, C.red, "#6B3A8A"];

// Score ring — stark, no frills
function Ring({ score, size=120, animate=true }) {
  const [d,setD] = useState(animate?0:score);
  useEffect(()=>{
    if(!animate){setD(score);return;}
    let s=null;
    const f=ts=>{if(!s)s=ts;const p=Math.min((ts-s)/1100,1);setD(Math.round(score*(1-Math.pow(1-p,3))));if(p<1)requestAnimationFrame(f);};
    requestAnimationFrame(f);
  },[score,animate]);
  const color=rc(score<40?"low":score<70?"medium":"high");
  const r=size*0.38,circ=2*Math.PI*r,off=circ-(d/100)*circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.faint} strokeWidth={size*0.06}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={size*0.06}
        strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="square"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{transition:animate?"none":"stroke-dashoffset 0.8s ease"}}/>
      <text x={size/2} y={size/2+2} textAnchor="middle" fontSize={size*0.28}
        fontWeight="700" fill={color} fontFamily="'Bebas Neue',sans-serif"
        letterSpacing="0.02em">{d}</text>
      <text x={size/2} y={size/2+size*0.22} textAnchor="middle" fontSize={size*0.085}
        fill={C.hint} fontFamily="'IBM Plex Mono',monospace" letterSpacing="0.1em">SCORE</text>
    </svg>
  );
}

function Tag({ tier, sm }) {
  const color=rc(tier);
  const bg=rbg(tier);
  return (
    <span style={{
      display:"inline-flex",alignItems:"center",gap:4,
      padding:sm?"1px 6px":"3px 8px",
      fontSize:sm?9:10,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",
      background:bg,color:color,
      border:`1px solid ${color}44`,
      fontFamily:"'IBM Plex Mono',monospace",
      borderRadius:2,
    }}>▪ {tier}</span>
  );
}

function Drop({ file, setFile }) {
  const [drag,setDrag]=useState(false);
  const ref=useRef();
  return (
    <div
      onDragOver={e=>{e.preventDefault();setDrag(true);}}
      onDragLeave={()=>setDrag(false)}
      onDrop={e=>{e.preventDefault();setDrag(false);const f=e.dataTransfer.files[0];if(f?.type==="application/pdf")setFile(f);}}
      onClick={()=>ref.current.click()}
      style={{
        border:`2px solid ${drag?C.blue:file?C.green:C.rule}`,
        padding:"40px 28px",textAlign:"center",cursor:"pointer",
        background:drag?C.blueBg:file?C.greenBg:C.faint,
        transition:"all 0.15s",marginBottom:20,
        position:"relative",
      }}>
      <input ref={ref} type="file" accept=".pdf"
        onChange={e=>setFile(e.target.files[0])} style={{display:"none"}}/>
      {/* corner ticks */}
      {[["0,0","10,0 0,0 0,10"],["calc(100% - 0px),0","calc(100% - 10px),0 calc(100%),0 calc(100%),10px"],
        ["0,calc(100% - 0px)","0,calc(100% - 10px) 0,100% 10px,100%"],
        ["calc(100%),calc(100%)","calc(100% - 10px),100% 100%,100% 100%,calc(100% - 10px)"]
      ].map(([pos,pts],i)=>(
        <svg key={i} width="12" height="12" style={{position:"absolute",
          top:i<2?6:"auto",bottom:i>=2?6:"auto",
          left:i%2===0?6:"auto",right:i%2===1?6:"auto"}}>
          <polyline points={i===0?"10,2 2,2 2,10":i===1?"2,2 10,2 10,10":i===2?"2,2 2,10 10,10":"10,2 10,10 2,10"}
            fill="none" stroke={drag?C.blue:file?C.green:C.hint} strokeWidth="1.5"/>
        </svg>
      ))}
      <p style={{margin:"0 0 6px",fontSize:15,fontWeight:700,color:file?C.green:C.ink,
        fontFamily:"'Bebas Neue',sans-serif",letterSpacing:"0.06em",fontSize:18}}>
        {file?file.name:"DROP FINANCIAL PDF"}
      </p>
      <p style={{margin:0,fontSize:10,color:C.hint,fontFamily:"'IBM Plex Mono',monospace",
        letterSpacing:"0.08em"}}>
        {file?`${(file.size/1024).toFixed(1)} KB  ·  YEARS AUTO-DETECTED`
          :"INCOME STATEMENTS  ·  BALANCE SHEETS  ·  CASH FLOW  ·  BANK STATEMENTS"}
      </p>
    </div>
  );
}

function ChartTip({ active, payload, label }) {
  if(!active||!payload?.length) return null;
  return (
    <div style={{background:C.ink,border:`1px solid ${C.inkLight}`,padding:"8px 12px",
      fontFamily:"'IBM Plex Mono',monospace",borderRadius:2}}>
      <p style={{color:C.hint,fontSize:9,marginBottom:5,letterSpacing:"0.1em"}}>FY {label}</p>
      {payload.map((p,i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
          <div style={{width:6,height:6,background:p.color,borderRadius:1}}/>
          <span style={{color:"#fff",fontSize:11,fontWeight:500}}>{p.name}: {p.value}</span>
        </div>
      ))}
    </div>
  );
}

function SCard({ skey, s, delay }) {
  const meta=SM[skey]||{short:"?",label:skey};
  const color=rc(s.tier);
  return (
    <div style={{
      background:C.paper,borderTop:`3px solid ${color}`,
      border:`1px solid ${C.rule}`,borderTop:`3px solid ${color}`,
      padding:"20px 18px",
      animation:`riseIn 0.5s ease ${delay}ms both`,
    }}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
        <div>
          <p style={{fontSize:9,color:C.hint,marginBottom:5,letterSpacing:"0.14em",
            fontFamily:"'IBM Plex Mono',monospace"}}>{meta.short}</p>
          <div style={{display:"flex",alignItems:"baseline",gap:4}}>
            <span style={{fontSize:36,fontWeight:700,color,lineHeight:1,
              fontFamily:"'Bebas Neue',sans-serif",letterSpacing:"0.02em"}}>{s.score}</span>
            <span style={{fontSize:11,color:C.hint,fontFamily:"'IBM Plex Mono',monospace"}}>/100</span>
          </div>
        </div>
        <Tag tier={s.tier} sm/>
      </div>
      <div style={{height:2,background:C.faint,marginBottom:14}}>
        <div style={{height:"100%",background:color,
          width:`${s.score}%`,transition:"width 1.2s cubic-bezier(.22,1,.36,1)"}}/>
      </div>
      <div style={{borderTop:`1px solid ${C.faint}`,paddingTop:12}}>
        {s.findings.slice(0,3).map((f,i)=>(
          <p key={i} style={{fontSize:10,color:C.sub,marginBottom:4,lineHeight:1.6,
            fontFamily:"'IBM Plex Mono',monospace",
            paddingLeft:10,borderLeft:`2px solid ${color}44`}}>{f}</p>
        ))}
      </div>
    </div>
  );
}

function AuthScreen() {
  const [mode,setMode]=useState("login");
  const [email,setEmail]=useState("");
  const [pass,setPass]=useState("");
  const [err,setErr]=useState(null);
  const [msg,setMsg]=useState(null);
  const [busy,setBusy]=useState(false);
  const go=async()=>{
    setBusy(true);setErr(null);setMsg(null);
    if(mode==="login"){const{error}=await supabase.auth.signInWithPassword({email,password:pass});if(error)setErr(error.message);}
    else{const{error}=await supabase.auth.signUp({email,password:pass});if(error)setErr(error.message);else setMsg("Check your email to confirm.");}
    setBusy(false);
  };
  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",
      alignItems:"center",justifyContent:"center",fontFamily:"'IBM Plex Mono',monospace",
      backgroundImage:`repeating-linear-gradient(0deg,transparent,transparent 39px,${C.rule}44 39px,${C.rule}44 40px),
        repeating-linear-gradient(90deg,transparent,transparent 39px,${C.rule}44 39px,${C.rule}44 40px)`}}>
      <div style={{width:"100%",maxWidth:380,padding:"0 24px"}}>
        {/* Logo */}
        <div style={{marginBottom:36,textAlign:"center"}}>
          <div style={{display:"inline-block",borderBottom:`3px solid ${C.ink}`,paddingBottom:8,marginBottom:8}}>
            <span style={{fontSize:32,fontWeight:700,color:C.ink,fontFamily:"'Bebas Neue',sans-serif",
              letterSpacing:"0.08em"}}>CREDITLENS</span>
          </div>
          <p style={{fontSize:9,color:C.hint,letterSpacing:"0.16em"}}>
            FINANCIAL RISK INTELLIGENCE PLATFORM
          </p>
        </div>

        <div style={{background:C.paper,border:`1px solid ${C.rule}`,padding:28,
          boxShadow:`4px 4px 0 ${C.rule}`}}>
          <p style={{fontSize:9,color:C.hint,letterSpacing:"0.16em",marginBottom:20}}>
            {mode==="login"?"— SIGN IN":"— CREATE ACCOUNT"}
          </p>
          {[["EMAIL","email","you@company.com",email,setEmail],
            ["PASSWORD","password","••••••••",pass,setPass]].map(([label,type,ph,val,set],i)=>(
            <div key={label} style={{marginBottom:i===0?14:18}}>
              <label style={{fontSize:9,color:C.hint,display:"block",marginBottom:5,
                letterSpacing:"0.14em"}}>{label}</label>
              <input type={type} value={val}
                onChange={e=>set(e.target.value)}
                placeholder={ph}
                onKeyDown={e=>e.key==="Enter"&&go()}
                style={{width:"100%",padding:"10px 12px",border:`1px solid ${C.rule}`,
                  background:C.faint,color:C.ink,fontSize:12,
                  fontFamily:"'IBM Plex Mono',monospace",outline:"none",
                  transition:"border 0.15s",borderRadius:0}}
                onFocus={e=>e.target.style.borderColor=C.ink}
                onBlur={e=>e.target.style.borderColor=C.rule}/>
            </div>
          ))}
          {err&&<p style={{fontSize:10,color:C.red,marginBottom:12,letterSpacing:"0.04em"}}>{err}</p>}
          {msg&&<p style={{fontSize:10,color:C.green,marginBottom:12,letterSpacing:"0.04em"}}>{msg}</p>}
          <button onClick={go} disabled={busy||!email||!pass} style={{
            width:"100%",padding:"12px",border:"none",
            background:email&&pass?C.ink:C.rule,
            color:email&&pass?C.bg:C.hint,
            fontSize:11,fontWeight:700,cursor:email&&pass?"pointer":"not-allowed",
            fontFamily:"'IBM Plex Mono',monospace",letterSpacing:"0.12em",
            transition:"all 0.15s",marginBottom:16,borderRadius:0}}>
            {busy?"PROCESSING...":(mode==="login"?"SIGN IN →":"CREATE ACCOUNT →")}
          </button>
          <p style={{fontSize:9,color:C.hint,letterSpacing:"0.08em",textAlign:"center"}}>
            {mode==="login"?"NO ACCOUNT? ":"HAVE ONE? "}
            <span onClick={()=>{setMode(mode==="login"?"signup":"login");setErr(null);setMsg(null);}}
              style={{color:C.blue,cursor:"pointer",textDecoration:"underline",textUnderlineOffset:3}}>
              {mode==="login"?"SIGN UP":"SIGN IN"}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [session,setSess]   = useState(null);
  const [ready,setReady]    = useState(false);
  const [file,setFile]      = useState(null);
  const [result,setResult]  = useState(null);
  const [loading,setLoad]   = useState(false);
  const [error,setError]    = useState(null);
  const [history,setHist]   = useState([]);
  const [cos,setCos]        = useState([]);
  const [view,setView]      = useState("upload");
  const [yr,setYr]          = useState(null);
  const [hco,setHco]        = useState(null);

  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{setSess(session);setReady(true);});
    const{data:{subscription}}=supabase.auth.onAuthStateChange((_,s)=>setSess(s));
    return()=>subscription.unsubscribe();
  },[]);

  useEffect(()=>{
    if(session) axios.get(`${API}/companies`,{headers:{Authorization:`Bearer ${session.access_token}`}})
      .then(r=>setCos(r.data)).catch(()=>{});
  },[result,session]);

  const logout=async()=>{await supabase.auth.signOut();setResult(null);setFile(null);setCos([]);setHist([]);};

  const upload=async()=>{
    if(!file||!session)return;
    setLoad(true);setError(null);setResult(null);setHist([]);
    const fd=new FormData();fd.append("file",file);
    try{
      const res=await axios.post(`${API}/analyze-pdf`,fd,{headers:{Authorization:`Bearer ${session.access_token}`}});
      setResult(res.data);
      const yrs=Object.keys(res.data.results||{}).map(Number).sort((a,b)=>b-a);
      if(yrs.length)setYr(yrs[0]);
      if(res.data.company_id)loadH(res.data.company_id);
    }catch{setError("Upload failed — check that backend is running on port 8000.");}
    finally{setLoad(false);}
  };

  const loadH=async id=>{
    const res=await axios.get(`${API}/companies/${id}/history`,{headers:{Authorization:`Bearer ${session.access_token}`}});
    setHist(res.data);
  };

  if(!ready) return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <p style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:C.hint,letterSpacing:"0.1em",
        animation:"blink 1s step-end infinite"}}>LOADING...</p>
      <style>{`@keyframes blink{0%,100%{opacity:1;}50%{opacity:0;}}`}</style>
    </div>
  );
  if(!session) return <AuthScreen/>;

  const yrs=result?.results
    ?Object.entries(result.results).sort(([a],[b])=>Number(b)-Number(a)).map(([y,r])=>({year:Number(y),...r})):[];
  const cur=yrs.find(r=>r.year===yr)||yrs[0];
  const trend=[...yrs].reverse().map(r=>({year:r.year,score:r.overall_score,
    ...Object.fromEntries(Object.entries(r.sections||{}).map(([k,v])=>[SM[k]?.short||k,v.score]))}));
  const htd=history.map(h=>({year:h.fiscal_year,score:h.overall_score,
    INC:h.income_score,BAL:h.balance_score,CF:h.cashflow_score}));

  return(
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:wght@600;700&family=Plus+Jakarta+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        body{background:${C.bg};color:${C.ink};font-family:'IBM Plex Mono',monospace;min-height:100vh;
          background-image:repeating-linear-gradient(0deg,transparent,transparent 39px,${C.rule}33 39px,${C.rule}33 40px),
            repeating-linear-gradient(90deg,transparent,transparent 39px,${C.rule}33 39px,${C.rule}33 40px);}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-thumb{background:${C.rule};}
        @keyframes riseIn{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}
        @keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
        @keyframes blink{0%,100%{opacity:1;}50%{opacity:0;}}
        @keyframes tick{0%{width:0;}100%{width:100%;}}
        .nb{background:transparent;border:none;padding:6px 14px;font-family:'IBM Plex Mono',monospace;
          font-size:10px;font-weight:600;color:${C.hint};cursor:pointer;transition:all 0.12s;
          letter-spacing:0.12em;border-bottom:2px solid transparent;}
        .nb:hover{color:${C.ink};}
        .nb.on{color:${C.ink};border-bottom:2px solid ${C.ink};}
        .yb{background:transparent;border:1px solid ${C.rule};padding:8px 14px;
          cursor:pointer;transition:all 0.12s;font-family:'IBM Plex Mono',monospace;
          text-align:left;border-radius:0;}
        .yb:hover{border-color:${C.ink};background:${C.faint};}
        .yb.on{background:${C.ink};border-color:${C.ink};color:${C.bg};}
        .cr{background:${C.paper};border:1px solid ${C.rule};border-left:3px solid ${C.rule};
          padding:14px 18px;cursor:pointer;transition:all 0.15s;margin-bottom:6px;
          display:flex;align-items:center;justify-content:space-between;}
        .cr:hover{border-left-color:${C.ink};transform:translateX(2px);}
        .ghost{padding:6px 12px;border:1px solid ${C.rule};background:transparent;
          color:${C.sub};font-size:9px;cursor:pointer;font-family:'IBM Plex Mono',monospace;
          transition:all 0.12s;letter-spacing:0.1em;border-radius:0;}
        .ghost:hover{color:${C.ink};border-color:${C.ink};}
        input{border-radius:0!important;}
      `}</style>

      {/* Ticker bar at very top */}
      <div style={{background:C.ink,padding:"4px 36px",display:"flex",gap:32,
        alignItems:"center",overflowX:"auto"}}>
        {["CREDIT RISK INTELLIGENCE PLATFORM","POWERED BY CREDITLENS","MULTI-YEAR TREND ANALYSIS",
          "5 DOCUMENT TYPES SUPPORTED","SUPABASE SECURE STORAGE"].map((t,i)=>(
          <span key={i} style={{fontSize:9,color:C.hint,letterSpacing:"0.12em",whiteSpace:"nowrap",
            fontFamily:"'Lora',serif"}}>— {t}</span>
        ))}
      </div>

      {/* Nav */}
      <nav style={{background:C.bg,borderBottom:`2px solid ${C.ink}`,padding:"0 36px",
        display:"flex",alignItems:"center",justifyContent:"space-between",height:52,
        position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <span style={{fontSize:22,fontWeight:700,color:C.ink,fontFamily:"'Bebas Neue',sans-serif",
            letterSpacing:"0.08em"}}>CREDITLENS</span>
          <div style={{width:1,height:20,background:C.rule}}/>
          <div style={{display:"flex",gap:0}}>
            {[["upload","ANALYZE"],["companies","COMPANIES"]].map(([v,l])=>(
              <button key={v} className={`nb${view===v?" on":""}`} onClick={()=>setView(v)}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:10,color:C.hint,letterSpacing:"0.08em"}}>
            {session.user.email}
          </span>
          <button className="ghost" onClick={logout}>SIGN OUT</button>
        </div>
      </nav>

      <div style={{maxWidth:1060,margin:"0 auto",padding:"40px 24px"}}>

        {/* Upload */}
        {view==="upload"&&!result&&!loading&&(
          <div style={{animation:"riseIn 0.5s ease both"}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:0,
              marginBottom:40,borderBottom:`2px solid ${C.ink}`,paddingBottom:32}}>
              <div>
                <p style={{fontSize:10,color:C.hint,letterSpacing:"0.16em",marginBottom:12}}>
                  RISK ANALYSIS ENGINE v2.0
                </p>
                <h1 style={{fontSize:56,fontWeight:700,lineHeight:0.95,marginBottom:16,
                  fontFamily:"'Bebas Neue',sans-serif",letterSpacing:"0.04em",color:C.ink}}>
                  READ<br/>THE<br/>NUMBERS.
                </h1>
                <p style={{fontSize:11,color:C.sub,lineHeight:1.8,maxWidth:320,
                  letterSpacing:"0.03em"}}>
                  Upload any financial PDF. Fiscal years are detected automatically.
                  Each section scored independently. Trends tracked over time.
                </p>
              </div>
              <div style={{display:"flex",flexDirection:"column",justifyContent:"flex-end",
                paddingLeft:32,borderLeft:`1px solid ${C.rule}`}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
                  {[["5","DOCUMENT TYPES"],["AUTO","YEAR DETECTION"],["JWT","SECURE AUTH"],["SQL","TREND HISTORY"]].map(([n,l])=>(
                    <div key={l} style={{borderTop:`2px solid ${C.rule}`,paddingTop:10}}>
                      <p style={{fontSize:24,fontWeight:700,color:C.ink,marginBottom:3,
                        fontFamily:"'Bebas Neue',sans-serif",letterSpacing:"0.04em"}}>{n}</p>
                      <p style={{fontSize:9,color:C.hint,letterSpacing:"0.1em"}}>{l}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{maxWidth:560}}>
              <Drop file={file} setFile={setFile}/>
              <button onClick={upload} disabled={!file} style={{
                width:"100%",padding:"14px",border:"none",
                background:file?C.ink:C.rule,
                color:file?C.bg:C.hint,fontSize:11,fontWeight:700,
                cursor:file?"pointer":"not-allowed",
                fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.14em",
                transition:"all 0.15s",borderRadius:0}}>
                {file?"RUN ANALYSIS →":"SELECT A DOCUMENT FIRST"}
              </button>
              {error&&<p style={{marginTop:10,color:C.red,fontSize:10,
                letterSpacing:"0.06em"}}>{error}</p>}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading&&(
          <div style={{padding:"100px 0",animation:"fadeIn 0.3s ease both"}}>
            <p style={{fontSize:11,color:C.hint,letterSpacing:"0.14em",marginBottom:20,
              fontFamily:"'IBM Plex Mono',monospace"}}>ANALYZING DOCUMENT</p>
            <div style={{height:2,background:C.faint,width:"100%",maxWidth:400,overflow:"hidden"}}>
              <div style={{height:"100%",background:C.ink,
                animation:"tick 2s ease-in-out infinite alternate"}}/>
            </div>
          </div>
        )}

        {/* Results */}
        {result&&!loading&&(
          <div>
            {/* Header strip */}
            <div style={{borderBottom:`2px solid ${C.ink}`,paddingBottom:20,marginBottom:28,
              display:"flex",alignItems:"flex-end",justifyContent:"space-between",
              flexWrap:"wrap",gap:16,animation:"riseIn 0.5s ease both"}}>
              <div>
                <p style={{fontSize:9,color:C.hint,letterSpacing:"0.16em",marginBottom:8}}>
                  ANALYSIS COMPLETE  ·  {new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}).toUpperCase()}
                </p>
                <h2 style={{fontSize:40,fontWeight:700,letterSpacing:"0.02em",
                  fontFamily:"'Bebas Neue',sans-serif",color:C.ink,lineHeight:1,marginBottom:8}}>
                  {result.business_name.toUpperCase()}
                </h2>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                  <span style={{fontSize:9,color:C.hint,letterSpacing:"0.1em"}}>FISCAL YEARS ·</span>
                  {result.years_detected?.map(y=>(
                    <span key={y} style={{padding:"1px 7px",background:C.faint,
                      color:C.sub,fontSize:10,border:`1px solid ${C.rule}`,
                      fontFamily:"'IBM Plex Mono',monospace",letterSpacing:"0.06em"}}>{y}</span>
                  ))}
                </div>
              </div>
              <button className="ghost" onClick={()=>{setResult(null);setFile(null);setHist([]);}}>
                ← NEW ANALYSIS
              </button>
            </div>

            {/* Year tabs */}
            <div style={{display:"flex",gap:6,marginBottom:24,flexWrap:"wrap"}}>
              {yrs.map(r=>(
                <button key={r.year} className={`yb${yr===r.year?" on":""}`}
                  onClick={()=>setYr(r.year)}>
                  <span style={{fontSize:8,display:"block",letterSpacing:"0.14em",
                    opacity:0.5,marginBottom:2}}>FY</span>
                  <span style={{fontSize:20,fontWeight:700,display:"block",
                    fontFamily:"'Bebas Neue',sans-serif",letterSpacing:"0.04em",
                    color:yr===r.year?C.bg:rc(r.overall_tier),lineHeight:1}}>
                    {r.year}
                  </span>
                  <span style={{fontSize:8,display:"block",opacity:0.5,marginTop:2,
                    letterSpacing:"0.08em"}}>{r.overall_score}/100</span>
                </button>
              ))}
            </div>

            {cur&&(
              <>
                {/* Hero — score + mini cards */}
                <div style={{display:"grid",gridTemplateColumns:"180px 1fr",gap:12,
                  marginBottom:12,animation:"riseIn 0.5s ease 0.1s both"}}>

                  <div style={{background:C.paper,border:`1px solid ${C.rule}`,
                    borderTop:`3px solid ${rc(cur.overall_tier)}`,
                    padding:"24px 20px",display:"flex",flexDirection:"column",
                    alignItems:"center",justifyContent:"center"}}>
                    <Ring score={cur.overall_score} size={120}/>
                    <div style={{marginTop:14,textAlign:"center"}}>
                      <Tag tier={cur.overall_tier}/>
                      <p style={{marginTop:10,fontSize:9,color:C.hint,letterSpacing:"0.1em"}}>
                        RECOMMEND: <span style={{color:rc(cur.overall_tier),fontWeight:600}}>
                          {cur.overall_recommendation.toUpperCase()}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8}}>
                    {Object.entries(cur.sections||{}).map(([k,s],i)=>{
                      const meta=SM[k]||{short:"?",label:k};
                      const color=rc(s.tier);
                      return(
                        <div key={k} style={{background:C.paper,border:`1px solid ${C.rule}`,
                          borderTop:`3px solid ${color}`,padding:14,
                          animation:`riseIn 0.5s ease ${i*60+150}ms both`}}>
                          <p style={{fontSize:8,color:C.hint,marginBottom:6,
                            letterSpacing:"0.14em"}}>{meta.short}</p>
                          <p style={{fontSize:30,fontWeight:700,color,lineHeight:1,marginBottom:6,
                            fontFamily:"'Bebas Neue',sans-serif",letterSpacing:"0.02em"}}>{s.score}</p>
                          <div style={{height:2,background:C.faint,marginBottom:8}}>
                            <div style={{height:"100%",background:color,
                              width:`${s.score}%`,transition:"width 1s ease"}}/>
                          </div>
                          <p style={{fontSize:9,color:C.sub,lineHeight:1.5,letterSpacing:"0.02em"}}>
                            {s.findings[0]||"—"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Detail cards */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",
                  gap:8,marginBottom:16}}>
                  {Object.entries(cur.sections||{}).map(([k,s],i)=>(
                    <SCard key={k} skey={k} s={s} delay={i*80}/>
                  ))}
                </div>
              </>
            )}

            {/* Trend chart */}
            {trend.length>1&&(
              <div style={{background:C.paper,border:`1px solid ${C.rule}`,
                borderTop:`2px solid ${C.ink}`,padding:28,marginBottom:12,
                animation:"riseIn 0.5s ease 0.3s both"}}>
                <div style={{display:"flex",justifyContent:"space-between",
                  alignItems:"flex-start",marginBottom:24,flexWrap:"wrap",gap:12}}>
                  <div>
                    <p style={{fontSize:9,color:C.hint,letterSpacing:"0.14em",marginBottom:4}}>
                      RISK TRAJECTORY</p>
                    <h3 style={{fontSize:24,fontWeight:700,fontFamily:"'Bebas Neue',sans-serif",
                      letterSpacing:"0.04em",color:C.ink}}>YEAR-OVER-YEAR TREND</h3>
                  </div>
                  <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                    {[["OVERALL",C.blue],...Object.keys(cur?.sections||{}).map((k,i)=>[SM[k]?.short||k,LCOLORS[i+1]])].map(([l,c])=>(
                      <div key={l} style={{display:"flex",alignItems:"center",gap:5}}>
                        <div style={{width:14,height:2,background:c}}/>
                        <span style={{fontSize:9,color:C.hint,letterSpacing:"0.1em"}}>{l}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={trend} margin={{top:4,right:4,left:-20,bottom:0}}>
                    <CartesianGrid strokeDasharray="1 4" stroke={C.faint} vertical={false}/>
                    <XAxis dataKey="year" stroke={C.rule} tick={{fill:C.hint,fontSize:9,fontFamily:"'IBM Plex Mono',monospace",letterSpacing:"0.08em"}}/>
                    <YAxis domain={[0,100]} stroke={C.rule} tick={{fill:C.hint,fontSize:9,fontFamily:"'IBM Plex Mono',monospace"}}/>
                    <Tooltip content={<ChartTip/>}/>
                    <ReferenceLine y={70} stroke={C.red} strokeDasharray="3 4" strokeOpacity={0.3}/>
                    <ReferenceLine y={40} stroke={C.green} strokeDasharray="3 4" strokeOpacity={0.3}/>
                    <Line type="monotone" dataKey="score" name="OVERALL" stroke={C.blue}
                      strokeWidth={2} dot={{r:4,fill:C.blue,strokeWidth:0}}/>
                    {Object.keys(cur?.sections||{}).map((k,i)=>(
                      <Line key={k} type="monotone" dataKey={SM[k]?.short||k}
                        name={SM[k]?.short||k} stroke={LCOLORS[i+1]}
                        strokeWidth={1.5} strokeDasharray="5 3" dot={{r:3,strokeWidth:0}}/>
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* Companies */}
        {view==="companies"&&!hco&&(
          <div style={{animation:"riseIn 0.5s ease both"}}>
            <div style={{borderBottom:`2px solid ${C.ink}`,paddingBottom:16,marginBottom:28}}>
              <p style={{fontSize:9,color:C.hint,letterSpacing:"0.16em",marginBottom:6}}>DATABASE</p>
              <h2 style={{fontSize:36,fontWeight:700,fontFamily:"'Bebas Neue',sans-serif",
                letterSpacing:"0.04em",color:C.ink}}>COMPANIES</h2>
            </div>
            {cos.length===0?(
              <div style={{border:`1px dashed ${C.rule}`,padding:"60px 32px",textAlign:"center"}}>
                <p style={{fontSize:11,color:C.hint,letterSpacing:"0.08em",lineHeight:1.8}}>
                  NO COMPANIES ON RECORD<br/>
                  <span style={{fontSize:9}}>UPLOAD A FINANCIAL DOCUMENT TO BEGIN</span>
                </p>
              </div>
            ):cos.map((c,i)=>(
              <div key={c.id} className="cr"
                style={{animation:`riseIn 0.5s ease ${i*60}ms both`}}
                onClick={()=>{loadH(c.id);setHco(c);}}>
                <div>
                  <p style={{fontWeight:600,fontSize:13,marginBottom:3,color:C.ink,
                    fontFamily:"'Bebas Neue',sans-serif",letterSpacing:"0.06em"}}>
                    {c.name.toUpperCase()}
                  </p>
                  <p style={{fontSize:9,color:C.hint,letterSpacing:"0.08em"}}>
                    ADDED {new Date(c.created_at).toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric"}).toUpperCase()}
                  </p>
                </div>
                <span style={{color:C.hint,fontSize:12,letterSpacing:"0.06em"}}>VIEW →</span>
              </div>
            ))}
          </div>
        )}

        {/* History */}
        {view==="companies"&&hco&&history.length>0&&(
          <div style={{animation:"riseIn 0.5s ease both"}}>
            <div style={{borderBottom:`2px solid ${C.ink}`,paddingBottom:16,marginBottom:28,
              display:"flex",alignItems:"flex-end",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
              <div>
                <p style={{fontSize:9,color:C.hint,letterSpacing:"0.16em",marginBottom:6}}>HISTORY</p>
                <h2 style={{fontSize:36,fontWeight:700,fontFamily:"'Bebas Neue',sans-serif",
                  letterSpacing:"0.04em",color:C.ink}}>{hco.name.toUpperCase()}</h2>
              </div>
              <button className="ghost" onClick={()=>setHco(null)}>← BACK</button>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",
              gap:8,marginBottom:16}}>
              {history.map((h,i)=>(
                <div key={h.id} style={{background:C.paper,
                  border:`1px solid ${C.rule}`,borderTop:`3px solid ${rc(h.overall_tier)}`,
                  padding:"16px 14px",textAlign:"center",
                  animation:`riseIn 0.5s ease ${i*80}ms both`}}>
                  <p style={{fontSize:8,color:C.hint,letterSpacing:"0.14em",marginBottom:10}}>
                    FY {h.fiscal_year}
                  </p>
                  <Ring score={h.overall_score} size={72} animate={false}/>
                  <div style={{marginTop:10}}><Tag tier={h.overall_tier} sm/></div>
                </div>
              ))}
            </div>

            {htd.length>1&&(
              <div style={{background:C.paper,border:`1px solid ${C.rule}`,
                borderTop:`2px solid ${C.ink}`,padding:28,marginBottom:12}}>
                <p style={{fontSize:9,color:C.hint,letterSpacing:"0.14em",marginBottom:4}}>RISK TREND</p>
                <h3 style={{fontSize:22,fontWeight:700,marginBottom:24,
                  fontFamily:"'Bebas Neue',sans-serif",letterSpacing:"0.04em",
                  color:C.ink}}>SCORE OVER TIME</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={htd} margin={{top:4,right:4,left:-20,bottom:0}}>
                    <defs>
                      <linearGradient id="ag2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={C.blue} stopOpacity={0.1}/>
                        <stop offset="100%" stopColor={C.blue} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="1 4" stroke={C.faint} vertical={false}/>
                    <XAxis dataKey="year" stroke={C.rule} tick={{fill:C.hint,fontSize:9,fontFamily:"'IBM Plex Mono',monospace"}}/>
                    <YAxis domain={[0,100]} stroke={C.rule} tick={{fill:C.hint,fontSize:9,fontFamily:"'IBM Plex Mono',monospace"}}/>
                    <Tooltip content={<ChartTip/>}/>
                    <ReferenceLine y={70} stroke={C.red} strokeDasharray="3 4" strokeOpacity={0.3}/>
                    <ReferenceLine y={40} stroke={C.green} strokeDasharray="3 4" strokeOpacity={0.3}/>
                    <Area type="monotone" dataKey="score" name="OVERALL" stroke={C.blue}
                      strokeWidth={2} fill="url(#ag2)" dot={{r:4,fill:C.blue,strokeWidth:0}}/>
                    <Line type="monotone" dataKey="INC" name="INCOME" stroke={C.green}
                      strokeWidth={1.5} strokeDasharray="5 3" dot={false}/>
                    <Line type="monotone" dataKey="BAL" name="BALANCE" stroke={C.amber}
                      strokeWidth={1.5} strokeDasharray="5 3" dot={false}/>
                    <Line type="monotone" dataKey="CF" name="CASH FLOW" stroke={C.red}
                      strokeWidth={1.5} strokeDasharray="5 3" dot={false}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            <div style={{background:C.paper,border:`1px solid ${C.rule}`,
              borderTop:`2px solid ${C.ink}`,padding:28}}>
              <p style={{fontSize:9,color:C.hint,letterSpacing:"0.14em",marginBottom:4}}>FINANCIALS</p>
              <h3 style={{fontSize:22,fontWeight:700,marginBottom:20,
                fontFamily:"'Bebas Neue',sans-serif",letterSpacing:"0.04em",
                color:C.ink}}>METRICS BY YEAR</h3>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:10}}>
                  <thead>
                    <tr style={{borderBottom:`2px solid ${C.ink}`}}>
                      {["YEAR","REVENUE","NET INCOME","TOTAL ASSETS","LIABILITIES","OP. CASH"].map(h=>(
                        <th key={h} style={{padding:"8px 12px",textAlign:"left",color:C.hint,
                          fontWeight:500,fontSize:8,letterSpacing:"0.14em",
                          fontFamily:"'IBM Plex Mono',monospace"}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(h=>(
                      <tr key={h.id} style={{borderBottom:`1px solid ${C.faint}`}}>
                        <td style={{padding:"10px 12px",fontWeight:700,
                          fontFamily:"'Bebas Neue',sans-serif",color:C.ink,
                          fontSize:16,letterSpacing:"0.04em"}}>{h.fiscal_year}</td>
                        {[h.revenue,h.net_income,h.total_assets,h.total_liabilities,h.operating_cash].map((v,i)=>(
                          <td key={i} style={{padding:"10px 12px",
                            fontFamily:"'IBM Plex Mono',monospace",fontSize:10,
                            color:i===1?(v>0?C.green:C.red):C.sub}}>
                            {v!=null?`$${Number(v).toLocaleString()}`:"—"}
                          </td>
                        ))}
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