import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { supabase } from "./supabase";
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine
} from "recharts";

const API = "https://creditlens-1zzy.onrender.com";

const C = {
  bg:"#F5F0E8",paper:"#FFFDF7",ink:"#1C1A14",inkLight:"#3D3A30",
  rule:"#D4C9B0",faint:"#EDE8DC",amber:"#C17D00",amberBg:"#FFF8E6",
  green:"#1A6B3C",greenBg:"#EBF7F0",red:"#B02020",redBg:"#FBF0F0",
  blue:"#1A3A6B",blueBg:"#EBF0FB",sub:"#7A7260",hint:"#A89E8A",
};

const rc   = t => t==="low"?C.green:t==="medium"?C.amber:C.red;
const rbg  = t => t==="low"?C.greenBg:t==="medium"?C.amberBg:C.redBg;
const SM = {
  income_statement:{short:"INC",label:"Income Statement"},
  balance_sheet:{short:"BAL",label:"Balance Sheet"},
  cash_flow:{short:"CF",label:"Cash Flow"},
  bank_statement:{short:"BNK",label:"Bank Statement"},
  credit_application:{short:"CRD",label:"Credit Application"},
};
const LCOLORS=[C.blue,C.green,C.amber,C.red,"#6B3A8A"];
const BANKS=["TD","RBC","BMO","Scotiabank","CIBC"];

// ── Shared components ────────────────────────────────────────────────────────
function Ring({score,size=120,animate=true}){
  const[d,setD]=useState(animate?0:score);
  useEffect(()=>{
    if(!animate){setD(score);return;}
    let s=null;
    const f=ts=>{if(!s)s=ts;const p=Math.min((ts-s)/1100,1);setD(Math.round(score*(1-Math.pow(1-p,3))));if(p<1)requestAnimationFrame(f);};
    requestAnimationFrame(f);
  },[score,animate]);
  const color=rc(score<40?"low":score<70?"medium":"high");
  const r=size*0.38,circ=2*Math.PI*r,off=circ-(d/100)*circ;
  return(
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.faint} strokeWidth={size*0.06}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={size*0.06}
        strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="square"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{transition:animate?"none":"stroke-dashoffset 0.8s ease"}}/>
      <text x={size/2} y={size/2+2} textAnchor="middle" fontSize={size*0.28}
        fontWeight="700" fill={color} fontFamily="'Lora',serif">{d}</text>
      <text x={size/2} y={size/2+size*0.22} textAnchor="middle" fontSize={size*0.085}
        fill={C.hint} fontFamily="'JetBrains Mono',monospace" letterSpacing="0.1em">SCORE</text>
    </svg>
  );
}

function Tag({tier,sm}){
  const color=rc(tier),bg=rbg(tier);
  return(
    <span style={{display:"inline-flex",alignItems:"center",gap:4,
      padding:sm?"1px 6px":"3px 8px",fontSize:sm?9:10,fontWeight:700,
      letterSpacing:"0.12em",textTransform:"uppercase",
      background:bg,color,border:`1px solid ${color}44`,
      fontFamily:"'JetBrains Mono',monospace",borderRadius:2}}>
      ▪ {tier}
    </span>
  );
}

function ChartTip({active,payload,label}){
  if(!active||!payload?.length)return null;
  return(
    <div style={{background:C.ink,border:`1px solid ${C.inkLight}`,padding:"8px 12px",
      fontFamily:"'JetBrains Mono',monospace",borderRadius:2}}>
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

// ── Auth screen ──────────────────────────────────────────────────────────────
function AuthScreen(){
  const[mode,setMode]=useState("login");
  const[email,setEmail]=useState("");
  const[pass,setPass]=useState("");
  const[err,setErr]=useState(null);
  const[msg,setMsg]=useState(null);
  const[busy,setBusy]=useState(false);
  const go=async()=>{
    setBusy(true);setErr(null);setMsg(null);
    if(mode==="login"){const{error}=await supabase.auth.signInWithPassword({email,password:pass});if(error)setErr(error.message);}
    else{const{error}=await supabase.auth.signUp({email,password:pass});if(error)setErr(error.message);else setMsg("Check your email to confirm.");}
    setBusy(false);
  };
  return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",
  justifyContent:"center",fontFamily:"'Plus Jakarta Sans',sans-serif",
  backgroundImage:`repeating-linear-gradient(0deg,transparent,transparent 39px,${C.rule}44 39px,${C.rule}44 40px),repeating-linear-gradient(90deg,transparent,transparent 39px,${C.rule}44 39px,${C.rule}44 40px)`}}>
  <div style={{width:"100%",maxWidth:380,padding:"0 24px",boxSizing:"border-box"}}>
        <div style={{marginBottom:36,textAlign:"center"}}>
          <div style={{display:"inline-block",borderBottom:`3px solid ${C.ink}`,paddingBottom:8,marginBottom:8}}>
            <span style={{fontSize:32,fontWeight:700,color:C.ink,fontFamily:"'Lora',serif",letterSpacing:"-0.01em"}}>CreditLens</span>
          </div>
          <p style={{fontSize:10,color:C.hint,letterSpacing:"0.14em",fontFamily:"'JetBrains Mono',monospace"}}>FINANCIAL RISK INTELLIGENCE</p>
        </div>
        <div style={{background:C.paper,border:`1px solid ${C.rule}`,padding:28,boxShadow:`4px 4px 0 ${C.rule}`}}>
          <p style={{fontSize:10,color:C.hint,letterSpacing:"0.14em",marginBottom:20,fontFamily:"'JetBrains Mono',monospace"}}>
            {mode==="login"?"— SIGN IN":"— CREATE ACCOUNT"}
          </p>
          {[["EMAIL","email","you@company.com",email,setEmail],
            ["PASSWORD","password","••••••••",pass,setPass]].map(([label,type,ph,val,set],i)=>(
            <div key={label} style={{marginBottom:i===0?14:18}}>
              <label style={{fontSize:9,color:C.hint,display:"block",marginBottom:5,letterSpacing:"0.14em",fontFamily:"'JetBrains Mono',monospace"}}>{label}</label>
              <input type={type} value={val} onChange={e=>set(e.target.value)}
                placeholder={ph} onKeyDown={e=>e.key==="Enter"&&go()}
                style={{width:"100%",padding:"10px 12px",border:`1px solid ${C.rule}`,
                  background:C.faint,color:C.ink,fontSize:12,
                  fontFamily:"'Plus Jakarta Sans',sans-serif",outline:"none",transition:"border 0.15s"}}
                onFocus={e=>e.target.style.borderColor=C.ink}
                onBlur={e=>e.target.style.borderColor=C.rule}/>
            </div>
          ))}
          {err&&<p style={{fontSize:10,color:C.red,marginBottom:12,fontFamily:"'JetBrains Mono',monospace"}}>{err}</p>}
          {msg&&<p style={{fontSize:10,color:C.green,marginBottom:12,fontFamily:"'JetBrains Mono',monospace"}}>{msg}</p>}
          <button onClick={go} disabled={busy||!email||!pass} style={{
            width:"100%",padding:"12px",border:"none",
            background:email&&pass?C.ink:C.rule,color:email&&pass?C.bg:C.hint,
            fontSize:11,fontWeight:600,cursor:email&&pass?"pointer":"not-allowed",
            fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.1em",transition:"all 0.15s",marginBottom:16}}>
            {busy?"PROCESSING...":(mode==="login"?"SIGN IN →":"CREATE ACCOUNT →")}
          </button>
          <p style={{fontSize:9,color:C.hint,letterSpacing:"0.08em",textAlign:"center",fontFamily:"'JetBrains Mono',monospace"}}>
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

// ── Landing page ─────────────────────────────────────────────────────────────
function Landing({onSelect}){
  const[hovered,setHovered]=useState(null);
  return(
    <div style={{minHeight:"calc(100vh - 52px)",display:"flex",flexDirection:"column",
      justifyContent:"center",padding:"60px 24px",animation:"riseIn 0.5s ease both"}}>
      <div style={{maxWidth:900,margin:"0 auto",width:"100%"}}>
        <div style={{marginBottom:56,borderBottom:`2px solid ${C.ink}`,paddingBottom:32}}>
          <p style={{fontSize:10,color:C.hint,letterSpacing:"0.16em",marginBottom:12,
            fontFamily:"'JetBrains Mono',monospace"}}>CREDITLENS — SELECT MODE</p>
          <h1 style={{fontSize:52,fontWeight:700,lineHeight:0.95,
            fontFamily:"'Lora',serif",letterSpacing:"-0.02em",color:C.ink}}>
            What are you<br/>analyzing today?
          </h1>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          {[
            {
              id:"business",
              label:"BUSINESS CREDIT",
              title:"Company\nFinancial Analysis",
              desc:"Analyze a company's financial health across income statements, balance sheets, and cash flow. Track risk year-over-year and detect deterioration before it becomes critical.",
              stats:[["5","DOCUMENT TYPES"],["AUTO","YEAR DETECTION"],["YOY","TREND TRACKING"],["ALL","INDUSTRIES"]],
              cta:"ANALYZE A COMPANY →",
              color:C.blue,
            },
            {
              id:"personal",
              label:"PERSONAL CREDIT",
              title:"Personal Approval\nLikelihood",
              desc:"See your approval odds across Canada's Big 5 banks for mortgages, lines of credit, and personal loans. Based on real bank underwriting criteria.",
              stats:[["BIG 5","CANADIAN BANKS"],["3","PRODUCT TYPES"],["GDS/TDS","RATIOS USED"],["REAL","THRESHOLDS"]],
              cta:"CHECK MY APPROVAL ODDS →",
              color:C.green,
            }
          ].map(card=>(
            <div key={card.id}
              onMouseEnter={()=>setHovered(card.id)}
              onMouseLeave={()=>setHovered(null)}
              onClick={()=>onSelect(card.id)}
              style={{
                background:hovered===card.id?card.id==="business"?C.blueBg:C.greenBg:C.paper,
                border:`2px solid ${hovered===card.id?card.color:C.rule}`,
                borderTop:`4px solid ${card.color}`,
                padding:32,cursor:"pointer",transition:"all 0.18s",
                transform:hovered===card.id?"translateY(-3px)":"none",
                boxShadow:hovered===card.id?`6px 6px 0 ${card.color}22`:`4px 4px 0 ${C.rule}`,
              }}>
              <p style={{fontSize:9,color:card.color,letterSpacing:"0.16em",marginBottom:16,
                fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{card.label}</p>
              <h2 style={{fontSize:30,fontWeight:700,lineHeight:1.05,marginBottom:20,
                fontFamily:"'Lora',serif",letterSpacing:"-0.01em",color:C.ink,
                whiteSpace:"pre-line"}}>{card.title}</h2>
              <p style={{fontSize:13,color:C.sub,lineHeight:1.8,marginBottom:28,
                fontFamily:"'Plus Jakarta Sans',sans-serif"}}>{card.desc}</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:28}}>
                {card.stats.map(([n,l])=>(
                  <div key={l} style={{borderTop:`1px solid ${C.rule}`,paddingTop:8}}>
                    <p style={{fontSize:16,fontWeight:700,color:card.color,marginBottom:2,
                      fontFamily:"'Lora',serif"}}>{n}</p>
                    <p style={{fontSize:9,color:C.hint,letterSpacing:"0.1em",
                      fontFamily:"'JetBrains Mono',monospace"}}>{l}</p>
                  </div>
                ))}
              </div>
              <div style={{borderTop:`1px solid ${C.rule}`,paddingTop:16,display:"flex",
                alignItems:"center",justifyContent:"space-between"}}>
                <span style={{fontSize:11,fontWeight:700,color:card.color,letterSpacing:"0.1em",
                  fontFamily:"'JetBrains Mono',monospace"}}>{card.cta}</span>
                <div style={{width:32,height:32,border:`1px solid ${card.color}`,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:16,transition:"all 0.15s",
                  background:hovered===card.id?card.color:"transparent",
                  color:hovered===card.id?C.paper:card.color}}>→</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Metric explainer data ────────────────────────────────────────────────────
const METRIC_INFO={
  gds:{
    name:"GDS — Gross Debt Service",category:"Mortgage",
    what:"GDS measures how much of your gross monthly income goes toward housing costs — specifically your mortgage payment, property taxes, and heating. It tells lenders whether you can afford the home itself, before accounting for any other debt.",
    why:"Banks use GDS to ensure housing costs alone don't overwhelm your income. A high GDS means you'd be house-poor — technically making payments but with no room for anything else. It's the first filter in any mortgage application.",
    formula:"GDS = Monthly mortgage payment ÷ Gross monthly income × 100",
    thresholds:[{l:"Excellent",v:"< 28%",c:C.green},{l:"Good",v:"28–32%",c:C.amber},{l:"Borderline",v:"32–39%",c:"#E07000"},{l:"Over limit",v:"> 39%",c:C.red}],
    benchmark:"All Big 5 banks cap GDS at 39%. BMO tightens this to 35% for higher-risk applicants. Stress test rate (5.25%) is used — not your actual rate.",
  },
  tds:{
    name:"TDS — Total Debt Service",category:"Mortgage",
    what:"TDS is the complete picture of your debt obligations. It adds your mortgage payment to all existing monthly debts — car loans, student loans, minimum credit card payments — and divides by gross income. It's the true measure of your total debt burden.",
    why:"A borrower can pass GDS but fail TDS if they carry heavy other debts. TDS catches this. It's the number most lenders focus on because it reflects your real monthly cash flow obligations — not just housing.",
    formula:"TDS = (Mortgage + all monthly debts) ÷ Gross monthly income × 100",
    thresholds:[{l:"Excellent",v:"< 36%",c:C.green},{l:"Good",v:"36–40%",c:C.amber},{l:"Borderline",v:"40–44%",c:"#E07000"},{l:"Over limit",v:"> 44%",c:C.red}],
    benchmark:"The hard ceiling across all Big 5 is 44%. BMO caps at 42%. Applicants near 44% often face higher rates, reduced loan amounts, or mandatory mortgage insurance.",
  },
  dti:{
    name:"DTI — Debt-to-Income",category:"LOC & Personal Loans",
    what:"DTI is used for non-mortgage credit products. It measures the share of your income already committed to debt repayments, excluding housing costs. For lines of credit and personal loans, this is the primary qualifying ratio.",
    why:"For unsecured lending, banks need confidence you have enough free cash flow to service a new credit line without defaulting. A high DTI signals you're already stretched — adding more debt increases the bank's risk significantly.",
    formula:"DTI = Total monthly debt payments ÷ Gross monthly income × 100",
    thresholds:[{l:"Strong",v:"< 30%",c:C.green},{l:"Acceptable",v:"30–40%",c:C.amber},{l:"High risk",v:"40–44%",c:"#E07000"},{l:"Likely declined",v:"> 44%",c:C.red}],
    benchmark:"TD and BMO cap DTI at 40%. RBC and CIBC at 42%. Scotiabank is most flexible at 44%. Self-employed applicants face stricter scrutiny at all banks.",
  },
  stress:{
    name:"Stress Test Rate",category:"Mortgage — Regulatory",
    what:"Canada's mortgage stress test requires you to qualify at a rate higher than your actual contract rate. Your GDS and TDS are calculated using the higher of: your contract rate + 2%, or the floor rate of 5.25%. This means you qualify for less than your actual rate might suggest.",
    why:"Introduced after the 2008 financial crisis and tightened in 2021, the stress test ensures borrowers can still afford their mortgage if rates rise after signing. It's mandated by OSFI and applies to all federally regulated lenders — including all Big 5 banks.",
    formula:"Qualifying rate = max(contract rate + 2%, 5.25%)",
    thresholds:[{l:"Current floor",v:"5.25%",c:C.blue},{l:"If contract = 6%",v:"Qualify at 8%",c:C.amber}],
    benchmark:"All Big 5 must apply this stress test by law. Credit unions and private lenders are exempt — they can qualify you at your actual rate. This is why some borrowers go to B-lenders after failing Big 5 qualification.",
  },
  score:{
    name:"Credit Score",category:"All Products",
    what:"Canadian credit scores run from 300 to 900, calculated by Equifax and TransUnion. The score reflects: payment history (35%), credit utilization (30%), length of credit history (15%), credit mix (10%), and new inquiries (10%). A higher score means lower perceived default risk.",
    why:"Your credit score is a lender's primary proxy for your repayment reliability. Even a 20-point difference can change your rate by 0.25–0.5%, or flip an application from approved to declined. It affects both your eligibility and the interest rate you're offered.",
    formula:"Score = f(payment history 35%, utilization 30%, history length 15%, mix 10%, inquiries 10%)",
    thresholds:[{l:"Exceptional",v:"800–900",c:C.green},{l:"Very good",v:"740–799",c:"#2A8A50"},{l:"Good",v:"670–739",c:C.amber},{l:"Fair",v:"580–669",c:"#E07000"},{l:"Poor",v:"300–579",c:C.red}],
    benchmark:"TD and BMO require 700+ for mortgages. RBC, Scotiabank, and CIBC accept 680+. For LOC and personal loans, most Big 5 accept 650+. Below 600, you'll likely need a co-signer or private lender.",
  },
};

function MetricModal({metric,onClose}){
  if(!metric)return null;
  const m=METRIC_INFO[metric];
  if(!m)return null;
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(28,26,20,0.65)",zIndex:200,
      display:"flex",alignItems:"center",justifyContent:"center",padding:24}}
      onClick={onClose}>
      <div style={{background:C.paper,border:`1px solid ${C.rule}`,maxWidth:580,width:"100%",
        maxHeight:"85vh",overflowY:"auto",boxShadow:`8px 8px 0 ${C.ink}`,position:"relative"}}
        onClick={e=>e.stopPropagation()}>
        <div style={{position:"sticky",top:0,background:C.paper,borderBottom:`1px solid ${C.rule}`,
          padding:"16px 24px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <p style={{fontSize:8,color:C.hint,letterSpacing:"0.14em",marginBottom:3,
              fontFamily:"'JetBrains Mono',monospace"}}>{m.category}</p>
            <h3 style={{fontSize:18,fontWeight:700,fontFamily:"'Lora',serif",
              letterSpacing:"-0.01em",color:C.ink}}>{m.name}</h3>
          </div>
          <button onClick={onClose} style={{background:"none",border:`1px solid ${C.rule}`,
            cursor:"pointer",width:28,height:28,display:"flex",alignItems:"center",
            justifyContent:"center",color:C.hint,fontSize:13,flexShrink:0}}>✕</button>
        </div>
        <div style={{padding:24}}>
          <p style={{fontSize:9,color:C.hint,letterSpacing:"0.12em",marginBottom:6,
            fontFamily:"'JetBrains Mono',monospace"}}>WHAT IT IS</p>
          <p style={{fontSize:13,color:C.sub,lineHeight:1.8,marginBottom:20,
            fontFamily:"'Plus Jakarta Sans',sans-serif"}}>{m.what}</p>
          <p style={{fontSize:9,color:C.hint,letterSpacing:"0.12em",marginBottom:6,
            fontFamily:"'JetBrains Mono',monospace"}}>WHY LENDERS USE IT</p>
          <p style={{fontSize:13,color:C.sub,lineHeight:1.8,marginBottom:20,
            fontFamily:"'Plus Jakarta Sans',sans-serif"}}>{m.why}</p>
          <p style={{fontSize:9,color:C.hint,letterSpacing:"0.12em",marginBottom:6,
            fontFamily:"'JetBrains Mono',monospace"}}>FORMULA</p>
          <div style={{background:C.faint,padding:"10px 14px",marginBottom:20,
            fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:C.sub,
            borderLeft:`3px solid ${C.blue}`,lineHeight:1.6}}>{m.formula}</div>
          <p style={{fontSize:9,color:C.hint,letterSpacing:"0.12em",marginBottom:10,
            fontFamily:"'JetBrains Mono',monospace"}}>THRESHOLDS</p>
          {m.thresholds.map(t=>(
            <div key={t.l} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
              <span style={{fontSize:11,color:C.sub,minWidth:90,fontFamily:"'JetBrains Mono',monospace"}}>{t.l}</span>
              <div style={{flex:1,height:3,background:C.faint,borderRadius:0}}>
                <div style={{height:"100%",background:t.c,
                  width:t.l==="Exceptional"||t.l==="Strong"||t.l==="Excellent"||t.l==="Current floor"?"100%":
                        t.l==="Very good"?"80%":t.l==="Good"||t.l==="Acceptable"?"60%":
                        t.l==="Fair"||t.l==="Borderline"||t.l==="High risk"?"40%":"25%"}}/>
              </div>
              <span style={{fontSize:11,fontWeight:600,color:t.c,minWidth:90,textAlign:"right",
                fontFamily:"'JetBrains Mono',monospace"}}>{t.v}</span>
            </div>
          ))}
          <div style={{marginTop:20,padding:"12px 14px",background:C.blueBg,
            borderLeft:`3px solid ${C.blue}`}}>
            <p style={{fontSize:9,color:C.blue,letterSpacing:"0.1em",marginBottom:4,
              fontWeight:600,fontFamily:"'JetBrains Mono',monospace"}}>BIG 5 BENCHMARKS</p>
            <p style={{fontSize:12,color:C.sub,lineHeight:1.7,
              fontFamily:"'Plus Jakarta Sans',sans-serif"}}>{m.benchmark}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Personal credit flow ─────────────────────────────────────────────────────
function PersonalCredit(){
  const[step,setStep]=useState("form");
  const[form,setForm]=useState({
    annual_income:"",monthly_debts:"",credit_score:"",
    employment:"salaried",tenure:"",
    down_payment:"",property_value:"",
  });
  const[results,setResults]=useState(null);
  const[loading,setLoading]=useState(false);
  const[explainMetric,setExplainMetric]=useState(null);

  const set=(k,v)=>setForm(f=>({...f,[k]:v}));



  const STRESS_RATE = 0.0525; // BoC stress test rate


  const analyze=()=>{
    setLoading(true);
    setTimeout(()=>{
      const income=parseFloat(form.annual_income)||0;
      const monthlyIncome=income/12;
      const debts=parseFloat(form.monthly_debts)||0;
      const score=parseInt(form.credit_score)||0;
      const tenure=parseFloat(form.tenure)||0;
      const down=parseFloat(form.down_payment)||0;
      const propVal=parseFloat(form.property_value)||0;
      const loanAmt=propVal-down;
      const downPct=propVal>0?(down/propVal)*100:0;
      const monthlyMortgage=loanAmt>0?(loanAmt*(STRESS_RATE/12)*Math.pow(1+STRESS_RATE/12,300))/(Math.pow(1+STRESS_RATE/12,300)-1):0;
      const gds=monthlyIncome>0?((monthlyMortgage)/monthlyIncome)*100:0;
      const tds=monthlyIncome>0?((monthlyMortgage+debts)/monthlyIncome)*100:0;
      const dti=monthlyIncome>0?(debts/monthlyIncome)*100:0;

      const bankRules={
        TD:     {mortgageScore:680,locScore:650,loanScore:640,maxGDS:39,maxTDS:44,maxDTI:40,maxLTV:95},
        RBC:    {mortgageScore:680,locScore:660,loanScore:650,maxGDS:39,maxTDS:44,maxDTI:42,maxLTV:95},
        BMO:    {mortgageScore:700,locScore:660,loanScore:650,maxGDS:35,maxTDS:42,maxDTI:40,maxLTV:95},
        Scotiabank:{mortgageScore:680,locScore:650,loanScore:640,maxGDS:39,maxTDS:44,maxDTI:44,maxLTV:95},
        CIBC:   {mortgageScore:700,locScore:660,loanScore:650,maxGDS:38,maxTDS:44,maxDTI:40,maxLTV:95},
      };

      const res={};
      BANKS.forEach(bank=>{
        const r=bankRules[bank];
        res[bank]={};

        // Mortgage
        if(propVal>0&&down>0){
          const reasons=[];
          let approved=true;
          if(score<r.mortgageScore){approved=false;reasons.push(`Credit score ${score} below ${r.mortgageScore} minimum`);}
          if(gds>r.maxGDS){approved=false;reasons.push(`GDS ${gds.toFixed(1)}% exceeds ${r.maxGDS}% max`);}
          if(tds>r.maxTDS){approved=false;reasons.push(`TDS ${tds.toFixed(1)}% exceeds ${r.maxTDS}% max`);}
          if(downPct<5){approved=false;reasons.push("Minimum 5% down payment required");}
          if(tenure<0.5){reasons.push("Employment tenure under 6 months — may require letter");}
          const borderline=approved&&(gds>r.maxGDS*0.9||tds>r.maxTDS*0.9||score<r.mortgageScore+40);
          res[bank].mortgage={
            status:approved?(borderline?"borderline":"approved"):"declined",
            gds:gds.toFixed(1),tds:tds.toFixed(1),reasons,
            maxGDS:r.maxGDS,maxTDS:r.maxTDS
          };
        }

        // Line of credit
        const locReasons=[];
        let locApproved=true;
        if(score<r.locScore){locApproved=false;locReasons.push(`Credit score ${score} below ${r.locScore} minimum`);}
        if(dti>r.maxDTI){locApproved=false;locReasons.push(`DTI ${dti.toFixed(1)}% exceeds ${r.maxDTI}% max`);}
        const locBorderline=locApproved&&(dti>r.maxDTI*0.85||score<r.locScore+30);
        res[bank].loc={
          status:locApproved?(locBorderline?"borderline":"approved"):"declined",
          dti:dti.toFixed(1),reasons:locReasons,maxDTI:r.maxDTI
        };

        // Personal loan
        const loanReasons=[];
        let loanApproved=true;
        if(score<r.loanScore){loanApproved=false;loanReasons.push(`Credit score ${score} below ${r.loanScore} minimum`);}
        if(dti>r.maxDTI+4){loanApproved=false;loanReasons.push(`DTI ${dti.toFixed(1)}% too high for personal loan`);}
        const loanBorderline=loanApproved&&(dti>r.maxDTI*0.8||score<r.loanScore+30);
        res[bank].loan={
          status:loanApproved?(loanBorderline?"borderline":"approved"):"declined",
          dti:dti.toFixed(1),reasons:loanReasons,maxDTI:r.maxDTI
        };
      });

      setResults({banks:res,gds,tds,dti,income,score,monthlyMortgage,downPct,stress:STRESS_RATE*100});
      setStep("results");
      setLoading(false);
    },800);
  };

  const statusColor=s=>s==="approved"?C.green:s==="borderline"?C.amber:C.red;
  const statusLabel=s=>s==="approved"?"✓ LIKELY":s==="borderline"?"~ BORDERLINE":"✗ UNLIKELY";

  const fields=[
    {k:"annual_income",label:"ANNUAL GROSS INCOME",ph:"$85,000",type:"number",required:true},
    {k:"monthly_debts",label:"MONTHLY DEBT PAYMENTS (car, loans, etc.)",ph:"$500",type:"number",required:true},
    {k:"credit_score",label:"CREDIT SCORE (300–900)",ph:"720",type:"number",required:true},
    {k:"employment",label:"EMPLOYMENT TYPE",ph:"",type:"select",options:["salaried","self-employed","contract","part-time"],required:true},
    {k:"tenure",label:"YEARS AT CURRENT JOB",ph:"3.5",type:"number",required:false},
    {k:"down_payment",label:"DOWN PAYMENT (for mortgage)",ph:"$100,000",type:"number",required:false},
    {k:"property_value",label:"PROPERTY VALUE (for mortgage)",ph:"$500,000",type:"number",required:false},
  ];

  const isValid=form.annual_income&&form.monthly_debts&&form.credit_score;

  if(step==="form") return(
    <div style={{animation:"riseIn 0.5s ease both",maxWidth:700,margin:"0 auto"}}>
      <div style={{borderBottom:`2px solid ${C.ink}`,paddingBottom:20,marginBottom:32}}>
        <p style={{fontSize:9,color:C.hint,letterSpacing:"0.16em",marginBottom:8,
          fontFamily:"'JetBrains Mono',monospace"}}>PERSONAL CREDIT ANALYSIS</p>
        <h2 style={{fontSize:40,fontWeight:700,fontFamily:"'Lora',serif",
          letterSpacing:"-0.02em",color:C.ink,lineHeight:1,marginBottom:8}}>
          Your Approval Profile
        </h2>
        <p style={{fontSize:13,color:C.sub,fontFamily:"'Plus Jakarta Sans',sans-serif",lineHeight:1.7}}>
          Enter your financial details below. We'll calculate your GDS, TDS, and DTI ratios and
          benchmark them against each Big 5 bank's underwriting criteria.
        </p>
      </div>

      <div style={{background:C.paper,border:`1px solid ${C.rule}`,padding:28,
        boxShadow:`4px 4px 0 ${C.rule}`,marginBottom:16}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          {fields.map(f=>(
            <div key={f.k} style={{gridColumn:f.k==="annual_income"||f.k==="monthly_debts"?"span 1":"span 1"}}>
              <label style={{fontSize:9,color:C.hint,display:"block",marginBottom:6,
                letterSpacing:"0.12em",fontFamily:"'JetBrains Mono',monospace"}}>
                {f.label}{f.required&&<span style={{color:C.red}}> *</span>}
              </label>
              {f.type==="select"?(
                <select value={form[f.k]} onChange={e=>set(f.k,e.target.value)}
                  style={{width:"100%",padding:"10px 12px",border:`1px solid ${C.rule}`,
                    background:C.faint,color:C.ink,fontSize:12,
                    fontFamily:"'Plus Jakarta Sans',sans-serif",outline:"none"}}>
                  {f.options.map(o=>(
                    <option key={o} value={o}>{o.charAt(0).toUpperCase()+o.slice(1)}</option>
                  ))}
                </select>
              ):(
                <input type={f.type} value={form[f.k]} onChange={e=>set(f.k,e.target.value)}
                  placeholder={f.ph}
                  style={{width:"100%",padding:"10px 12px",border:`1px solid ${C.rule}`,
                    background:C.faint,color:C.ink,fontSize:12,
                    fontFamily:"'Plus Jakarta Sans',sans-serif",outline:"none",transition:"border 0.15s"}}
                  onFocus={e=>e.target.style.borderColor=C.ink}
                  onBlur={e=>e.target.style.borderColor=C.rule}/>
              )}
            </div>
          ))}
        </div>
        <div style={{marginTop:8,padding:"10px 12px",background:C.amberBg,
          border:`1px solid ${C.amber}44`,borderLeft:`3px solid ${C.amber}`}}>
          <p style={{fontSize:10,color:C.amber,fontFamily:"'JetBrains Mono',monospace",
            letterSpacing:"0.06em",lineHeight:1.6}}>
            ℹ Mortgage calculated using BoC stress test rate (5.25%). Results are estimates only — consult a licensed mortgage broker for official qualification.
          </p>
        </div>
      </div>

      <button onClick={analyze} disabled={!isValid||loading} style={{
        width:"100%",padding:"14px",border:"none",
        background:isValid?C.ink:C.rule,color:isValid?C.bg:C.hint,
        fontSize:11,fontWeight:600,cursor:isValid?"pointer":"not-allowed",
        fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.12em",transition:"all 0.15s"}}>
        {loading?"CALCULATING...":"RUN ANALYSIS →"}
      </button>
    </div>
  );

  if(step==="results"&&results) return(
    <div style={{animation:"riseIn 0.5s ease both"}}>
      <div style={{borderBottom:`2px solid ${C.ink}`,paddingBottom:20,marginBottom:28,
        display:"flex",alignItems:"flex-end",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
        <div>
          <p style={{fontSize:9,color:C.hint,letterSpacing:"0.16em",marginBottom:8,
            fontFamily:"'JetBrains Mono',monospace"}}>PERSONAL CREDIT RESULTS</p>
          <h2 style={{fontSize:36,fontWeight:700,fontFamily:"'Lora',serif",
            letterSpacing:"-0.02em",color:C.ink,lineHeight:1}}>Approval Overview</h2>
        </div>
        <button className="ghost" onClick={()=>setStep("form")}>← EDIT PROFILE</button>
      </div>

      <MetricModal metric={explainMetric} onClose={()=>setExplainMetric(null)}/>

      {/* Key ratios */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:20}}>
        {[
          {label:"CREDIT SCORE",value:results.score,unit:"",metric:"score",color:results.score>=700?C.green:results.score>=650?C.amber:C.red},
          {label:"GDS RATIO",value:results.gds.toFixed(1),unit:"%",metric:"gds",color:results.gds<=32?C.green:results.gds<=39?C.amber:C.red,note:"max 39%"},
          {label:"TDS RATIO",value:results.tds.toFixed(1),unit:"%",metric:"tds",color:results.tds<=36?C.green:results.tds<=44?C.amber:C.red,note:"max 44%"},
          {label:"DTI RATIO",value:results.dti.toFixed(1),unit:"%",metric:"dti",color:results.dti<=36?C.green:results.dti<=42?C.amber:C.red,note:"max ~42%"},
        ].map(m=>(
          <div key={m.label} style={{background:C.paper,border:`1px solid ${C.rule}`,
            borderTop:`3px solid ${m.color}`,padding:16}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
              <p style={{fontSize:8,color:C.hint,letterSpacing:"0.12em",
                fontFamily:"'JetBrains Mono',monospace"}}>{m.label}</p>
              <button onClick={()=>setExplainMetric(m.metric)}
                style={{background:"none",border:`1px solid ${C.rule}`,cursor:"pointer",
                  width:16,height:16,display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:9,color:C.hint,fontFamily:"'JetBrains Mono',monospace",flexShrink:0,
                  lineHeight:1}}>?</button>
            </div>
            <p style={{fontSize:28,fontWeight:700,color:m.color,lineHeight:1,
              fontFamily:"'Lora',serif"}}>{m.value}{m.unit}</p>
            {m.note&&<p style={{fontSize:9,color:C.hint,marginTop:4,
              fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.06em"}}>{m.note}</p>}
          </div>
        ))}
      </div>

      {/* Bank grid */}
      <div style={{background:C.paper,border:`1px solid ${C.rule}`,
        borderTop:`2px solid ${C.ink}`,marginBottom:16,overflow:"hidden"}}>
        <div style={{padding:"16px 20px",borderBottom:`1px solid ${C.rule}`,
          display:"flex",alignItems:"center",gap:16}}>
          <p style={{fontSize:9,color:C.hint,letterSpacing:"0.14em",
            fontFamily:"'JetBrains Mono',monospace"}}>BANK APPROVAL MATRIX</p>
          <div style={{display:"flex",gap:6,marginLeft:"auto"}}>
            {[["GDS","gds"],["TDS","tds"],["DTI","dti"],["STRESS TEST","stress"]].map(([l,k])=>(
              <button key={k} onClick={()=>setExplainMetric(k)}
                style={{background:"none",border:`1px solid ${C.rule}`,cursor:"pointer",
                  padding:"2px 7px",fontSize:9,color:C.hint,fontFamily:"'JetBrains Mono',monospace",
                  letterSpacing:"0.06em",transition:"all 0.12s"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=C.blue;e.currentTarget.style.color=C.blue;}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=C.rule;e.currentTarget.style.color=C.hint;}}>
                ? {l}
              </button>
            ))}
          </div>
          <div style={{display:"flex",gap:12}}>
            {[["✓ LIKELY",C.green],["~ BORDERLINE",C.amber],["✗ UNLIKELY",C.red]].map(([l,c])=>(
              <div key={l} style={{display:"flex",alignItems:"center",gap:4}}>
                <div style={{width:6,height:6,background:c,borderRadius:1}}/>
                <span style={{fontSize:9,color:C.hint,fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.06em"}}>{l}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
            <thead>
              <tr style={{borderBottom:`2px solid ${C.rule}`}}>
                <th style={{padding:"10px 16px",textAlign:"left",fontSize:9,color:C.hint,
                  letterSpacing:"0.12em",fontFamily:"'JetBrains Mono',monospace",fontWeight:500,
                  background:C.faint}}>BANK</th>
                {["MORTGAGE","LINE OF CREDIT","PERSONAL LOAN"].map(h=>(
                  <th key={h} style={{padding:"10px 16px",textAlign:"center",fontSize:9,color:C.hint,
                    letterSpacing:"0.12em",fontFamily:"'JetBrains Mono',monospace",fontWeight:500,
                    background:C.faint}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {BANKS.map((bank,i)=>(
                <tr key={bank} style={{borderBottom:`1px solid ${C.faint}`,
                  background:i%2===0?C.paper:"#FFFEF9"}}>
                  <td style={{padding:"14px 16px",fontWeight:700,fontFamily:"'Lora',serif",
                    fontSize:14,color:C.ink,letterSpacing:"-0.01em"}}>{bank}</td>
                  {["mortgage","loc","loan"].map(prod=>{
                    const d=results.banks[bank][prod];
                    if(!d) return(
                      <td key={prod} style={{padding:"14px 16px",textAlign:"center"}}>
                        <span style={{fontSize:9,color:C.hint,fontFamily:"'JetBrains Mono',monospace",
                          letterSpacing:"0.06em"}}>N/A</span>
                      </td>
                    );
                    const color=statusColor(d.status);
                    return(
                      <td key={prod} style={{padding:"14px 16px",textAlign:"center"}}>
                        <div style={{display:"inline-flex",flexDirection:"column",alignItems:"center",gap:4}}>
                          <span style={{fontSize:10,fontWeight:700,color,
                            fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.08em"}}>
                            {statusLabel(d.status)}
                          </span>
                          {prod==="mortgage"&&d.gds&&(
                            <span style={{fontSize:9,color:C.hint,fontFamily:"'JetBrains Mono',monospace"}}>
                              GDS {d.gds}% · TDS {d.tds}%
                            </span>
                          )}
                          {prod!=="mortgage"&&d.dti&&(
                            <span style={{fontSize:9,color:C.hint,fontFamily:"'JetBrains Mono',monospace"}}>
                              DTI {d.dti}%
                            </span>
                          )}
                          {d.reasons?.length>0&&(
                            <span style={{fontSize:9,color:color,fontFamily:"'JetBrains Mono',monospace",
                              maxWidth:160,textAlign:"center",lineHeight:1.5,opacity:0.8}}>
                              {d.reasons[0]}
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* What to improve */}
      <div style={{background:C.paper,border:`1px solid ${C.rule}`,
        borderTop:`3px solid ${C.blue}`,padding:24}}>
        <p style={{fontSize:9,color:C.hint,letterSpacing:"0.14em",marginBottom:4,
          fontFamily:"'JetBrains Mono',monospace"}}>GUIDANCE</p>
        <h3 style={{fontSize:20,fontWeight:700,marginBottom:16,fontFamily:"'Lora',serif",
          letterSpacing:"-0.01em",color:C.ink}}>How to improve your profile</h3>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
          {[
            {title:"Credit Score",tip:results.score<700?"Paying down revolving debt and avoiding new inquiries can raise your score 20–40 pts within 6 months.":"Your score is strong. Maintain low utilization (<30%) to keep it there.",good:results.score>=700},
            {title:"GDS Ratio",tip:results.gds>32?"Your GDS is elevated. Consider a larger down payment or a lower purchase price to bring this below 32%.":"Your GDS is within healthy range for all Big 5 banks.",good:results.gds<=32},
            {title:"TDS Ratio",tip:results.tds>44?"Your TDS exceeds most bank maximums. Paying down existing debt before applying would significantly improve approval odds.":results.tds>36?"TDS is manageable but could be improved by reducing monthly debt payments.":"Excellent TDS — most banks will view this favorably.",good:results.tds<=36},
          ].map(g=>(
            <div key={g.title} style={{padding:"14px 16px",background:g.good?C.greenBg:C.amberBg,
              borderLeft:`3px solid ${g.good?C.green:C.amber}`}}>
              <p style={{fontSize:10,fontWeight:700,color:g.good?C.green:C.amber,marginBottom:6,
                letterSpacing:"0.08em",fontFamily:"'JetBrains Mono',monospace"}}>{g.title}</p>
              <p style={{fontSize:12,color:C.sub,lineHeight:1.7,
                fontFamily:"'Plus Jakarta Sans',sans-serif"}}>{g.tip}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return null;
}

// ── Business credit flow ─────────────────────────────────────────────────────
function BusinessCredit({session}){
  const[view,setView]=useState("upload");
  const[file,setFile]=useState(null);
  const[result,setResult]=useState(null);
  const[loading,setLoad]=useState(false);
  const[error,setError]=useState(null);
  const[history,setHist]=useState([]);
  const[cos,setCos]=useState([]);
  const[yr,setYr]=useState(null);
  const[hco,setHco]=useState(null);
  const ref=useRef();

  useEffect(()=>{
    axios.get(`${API}/companies`,{headers:{Authorization:`Bearer ${session.access_token}`}})
      .then(r=>setCos(r.data)).catch(()=>{});
  },[result,session]);

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

  const yrs=result?.results
    ?Object.entries(result.results).sort(([a],[b])=>Number(b)-Number(a)).map(([y,r])=>({year:Number(y),...r})):[];
  const cur=yrs.find(r=>r.year===yr)||yrs[0];
  const trend=[...yrs].reverse().map(r=>({year:r.year,score:r.overall_score,
    ...Object.fromEntries(Object.entries(r.sections||{}).map(([k,v])=>[SM[k]?.short||k,v.score]))}));
  const htd=history.map(h=>({year:h.fiscal_year,score:h.overall_score,
    INC:h.income_score,BAL:h.balance_score,CF:h.cashflow_score}));

  const SCard=({skey,s,delay})=>{
    const meta=SM[skey]||{short:"?",label:skey};
    const color=rc(s.tier);
    return(
      <div style={{background:C.paper,border:`1px solid ${C.rule}`,borderTop:`3px solid ${color}`,
        padding:"20px 18px",position:"relative",overflow:"hidden",
        animation:`riseIn 0.5s ease ${delay}ms both`}}>
        <div style={{position:"absolute",top:0,left:0,width:`${s.score}%`,height:3,background:color,transition:"width 1.2s ease"}}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
          <div>
            <p style={{fontSize:9,color:C.hint,marginBottom:5,letterSpacing:"0.14em",
              fontFamily:"'JetBrains Mono',monospace"}}>{meta.short}</p>
            <div style={{display:"flex",alignItems:"baseline",gap:4}}>
              <span style={{fontSize:32,fontWeight:700,color,lineHeight:1,
                fontFamily:"'Lora',serif"}}>{s.score}</span>
              <span style={{fontSize:11,color:C.hint,fontFamily:"'JetBrains Mono',monospace"}}>/100</span>
            </div>
          </div>
          <Tag tier={s.tier} sm/>
        </div>
        <div style={{height:2,background:C.faint,marginBottom:14}}>
          <div style={{height:"100%",background:color,width:`${s.score}%`,transition:"width 1.2s ease"}}/>
        </div>
        <div style={{borderTop:`1px solid ${C.faint}`,paddingTop:12}}>
          {s.findings.slice(0,3).map((f,i)=>(
            <p key={i} style={{fontSize:10,color:C.sub,marginBottom:4,lineHeight:1.6,
              fontFamily:"'JetBrains Mono',monospace",paddingLeft:10,borderLeft:`2px solid ${color}44`}}>{f}</p>
          ))}
        </div>
      </div>
    );
  };

  return(
    <div>
      {/* Sub nav */}
      <div style={{borderBottom:`1px solid ${C.rule}`,marginBottom:32,
        display:"flex",gap:0,paddingBottom:0}}>
        {[["upload","ANALYZE"],["companies","COMPANIES"]].map(([v,l])=>(
          <button key={v} className={`nb${view===v?" on":""}`} onClick={()=>setView(v)}>{l}</button>
        ))}
      </div>

      {/* Upload */}
      {view==="upload"&&!result&&!loading&&(
        <div style={{animation:"riseIn 0.5s ease both"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:0,
            marginBottom:40,borderBottom:`2px solid ${C.ink}`,paddingBottom:32}}>
            <div>
              <p style={{fontSize:10,color:C.hint,letterSpacing:"0.16em",marginBottom:12,
                fontFamily:"'JetBrains Mono',monospace"}}>BUSINESS CREDIT ANALYSIS</p>
              <h1 style={{fontSize:48,fontWeight:700,lineHeight:0.95,marginBottom:16,
                fontFamily:"'Lora',serif",letterSpacing:"-0.02em",color:C.ink}}>
                READ<br/>THE<br/>NUMBERS.
              </h1>
              <p style={{fontSize:12,color:C.sub,lineHeight:1.8,maxWidth:320,
                fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
                Upload any financial PDF. Fiscal years detected automatically. Each section scored independently.
              </p>
            </div>
            <div style={{display:"flex",flexDirection:"column",justifyContent:"flex-end",
              paddingLeft:32,borderLeft:`1px solid ${C.rule}`}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
                {[["5","DOCUMENT TYPES"],["AUTO","YEAR DETECTION"],["YOY","TREND HISTORY"],["JWT","SECURE AUTH"]].map(([n,l])=>(
                  <div key={l} style={{borderTop:`2px solid ${C.rule}`,paddingTop:10}}>
                    <p style={{fontSize:22,fontWeight:700,color:C.ink,marginBottom:3,fontFamily:"'Lora',serif"}}>{n}</p>
                    <p style={{fontSize:9,color:C.hint,letterSpacing:"0.1em",fontFamily:"'JetBrains Mono',monospace"}}>{l}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{maxWidth:560}}>
            <div onDragOver={e=>{e.preventDefault();}}
              onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f?.type==="application/pdf")setFile(f);}}
              onClick={()=>ref.current.click()}
              style={{border:`2px solid ${file?C.green:C.rule}`,padding:"40px 28px",
                textAlign:"center",cursor:"pointer",
                background:file?C.greenBg:C.faint,transition:"all 0.15s",marginBottom:20}}>
              <input ref={ref} type="file" accept=".pdf"
                onChange={e=>setFile(e.target.files[0])} style={{display:"none"}}/>
              <p style={{margin:"0 0 6px",fontSize:16,fontWeight:700,
                color:file?C.green:C.ink,fontFamily:"'Lora',serif"}}>
                {file?file.name:"DROP FINANCIAL PDF"}
              </p>
              <p style={{margin:0,fontSize:10,color:C.hint,fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.08em"}}>
                {file?`${(file.size/1024).toFixed(1)} KB · YEARS AUTO-DETECTED`:"INCOME · BALANCE · CASH FLOW · BANK"}
              </p>
            </div>
            <button onClick={upload} disabled={!file} style={{
              width:"100%",padding:"14px",border:"none",
              background:file?C.ink:C.rule,color:file?C.bg:C.hint,
              fontSize:11,fontWeight:600,cursor:file?"pointer":"not-allowed",
              fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.14em",transition:"all 0.15s"}}>
              {file?"RUN ANALYSIS →":"SELECT A DOCUMENT FIRST"}
            </button>
            {error&&<p style={{marginTop:10,color:C.red,fontSize:10,letterSpacing:"0.06em",fontFamily:"'JetBrains Mono',monospace"}}>{error}</p>}
          </div>
        </div>
      )}

      {loading&&(
        <div style={{padding:"100px 0",animation:"riseIn 0.3s ease both"}}>
          <p style={{fontSize:11,color:C.hint,letterSpacing:"0.14em",marginBottom:20,fontFamily:"'JetBrains Mono',monospace"}}>ANALYZING DOCUMENT</p>
          <div style={{height:2,background:C.faint,width:"100%",maxWidth:400,overflow:"hidden"}}>
            <div style={{height:"100%",background:C.ink,animation:"tick 2s ease-in-out infinite alternate"}}/>
          </div>
        </div>
      )}

      {result&&!loading&&(
        <div>
          <div style={{borderBottom:`2px solid ${C.ink}`,paddingBottom:20,marginBottom:28,
            display:"flex",alignItems:"flex-end",justifyContent:"space-between",flexWrap:"wrap",gap:16,
            animation:"riseIn 0.5s ease both"}}>
            <div>
              <p style={{fontSize:9,color:C.hint,letterSpacing:"0.16em",marginBottom:8,fontFamily:"'JetBrains Mono',monospace"}}>ANALYSIS COMPLETE</p>
              <h2 style={{fontSize:36,fontWeight:700,letterSpacing:"-0.02em",fontFamily:"'Lora',serif",
                color:C.ink,lineHeight:1,marginBottom:8}}>{result.business_name.toUpperCase()}</h2>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                <span style={{fontSize:9,color:C.hint,fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.1em"}}>FY ·</span>
                {result.years_detected?.map(y=>(
                  <span key={y} style={{padding:"1px 7px",background:C.faint,color:C.sub,fontSize:10,
                    border:`1px solid ${C.rule}`,fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.06em"}}>{y}</span>
                ))}
              </div>
            </div>
            <button className="ghost" onClick={()=>{setResult(null);setFile(null);setHist([]);}}>← NEW ANALYSIS</button>
          </div>

          <div style={{display:"flex",gap:6,marginBottom:24,flexWrap:"wrap"}}>
            {yrs.map(r=>(
              <button key={r.year} className={`yb${yr===r.year?" on":""}`} onClick={()=>setYr(r.year)}>
                <span style={{fontSize:8,display:"block",letterSpacing:"0.14em",opacity:0.5,marginBottom:2,fontFamily:"'JetBrains Mono',monospace"}}>FY</span>
                <span style={{fontSize:18,fontWeight:700,display:"block",fontFamily:"'Lora',serif",
                  color:yr===r.year?C.bg:rc(r.overall_tier),lineHeight:1}}>{r.year}</span>
                <span style={{fontSize:8,display:"block",opacity:0.5,marginTop:2,fontFamily:"'JetBrains Mono',monospace"}}>{r.overall_score}/100</span>
              </button>
            ))}
          </div>

          {cur&&(
            <>
              <div style={{display:"grid",gridTemplateColumns:"180px 1fr",gap:12,marginBottom:12,animation:"riseIn 0.5s ease 0.1s both"}}>
                <div style={{background:C.paper,border:`1px solid ${C.rule}`,borderTop:`3px solid ${rc(cur.overall_tier)}`,
                  padding:"24px 20px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                  <Ring score={cur.overall_score} size={120}/>
                  <div style={{marginTop:14,textAlign:"center"}}>
                    <Tag tier={cur.overall_tier}/>
                    <p style={{marginTop:10,fontSize:9,color:C.hint,fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.08em"}}>
                      RECOMMEND: <span style={{color:rc(cur.overall_tier),fontWeight:600}}>{cur.overall_recommendation.toUpperCase()}</span>
                    </p>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8}}>
                  {Object.entries(cur.sections||{}).map(([k,s],i)=>{
                    const meta=SM[k]||{short:"?",label:k};
                    const color=rc(s.tier);
                    return(
                      <div key={k} style={{background:C.paper,border:`1px solid ${C.rule}`,borderTop:`3px solid ${color}`,
                        padding:14,animation:`riseIn 0.5s ease ${i*60+150}ms both`}}>
                        <p style={{fontSize:8,color:C.hint,marginBottom:6,letterSpacing:"0.14em",fontFamily:"'JetBrains Mono',monospace"}}>{meta.short}</p>
                        <p style={{fontSize:28,fontWeight:700,color,lineHeight:1,marginBottom:6,fontFamily:"'Lora',serif"}}>{s.score}</p>
                        <div style={{height:2,background:C.faint,marginBottom:8}}>
                          <div style={{height:"100%",background:color,width:`${s.score}%`,transition:"width 1s ease"}}/>
                        </div>
                        <p style={{fontSize:9,color:C.sub,lineHeight:1.5,fontFamily:"'JetBrains Mono',monospace"}}>{s.findings[0]||"—"}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:8,marginBottom:16}}>
                {Object.entries(cur.sections||{}).map(([k,s],i)=>(<SCard key={k} skey={k} s={s} delay={i*80}/>))}
              </div>
            </>
          )}

          {trend.length>1&&(
            <div style={{background:C.paper,border:`1px solid ${C.rule}`,borderTop:`2px solid ${C.ink}`,
              padding:28,marginBottom:12,animation:"riseIn 0.5s ease 0.3s both"}}>
              <p style={{fontSize:9,color:C.hint,letterSpacing:"0.14em",marginBottom:4,fontFamily:"'JetBrains Mono',monospace"}}>TRAJECTORY</p>
              <h3 style={{fontSize:22,fontWeight:700,fontFamily:"'Lora',serif",letterSpacing:"-0.01em",color:C.ink,marginBottom:24}}>YEAR-OVER-YEAR TREND</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trend} margin={{top:4,right:4,left:-20,bottom:0}}>
                  <CartesianGrid strokeDasharray="1 4" stroke={C.faint} vertical={false}/>
                  <XAxis dataKey="year" stroke={C.rule} tick={{fill:C.hint,fontSize:9,fontFamily:"'JetBrains Mono',monospace"}}/>
                  <YAxis domain={[0,100]} stroke={C.rule} tick={{fill:C.hint,fontSize:9,fontFamily:"'JetBrains Mono',monospace"}}/>
                  <Tooltip content={<ChartTip/>}/>
                  <ReferenceLine y={70} stroke={C.red} strokeDasharray="3 4" strokeOpacity={0.3}/>
                  <ReferenceLine y={40} stroke={C.green} strokeDasharray="3 4" strokeOpacity={0.3}/>
                  <Line type="monotone" dataKey="score" name="OVERALL" stroke={C.blue} strokeWidth={2} dot={{r:4,fill:C.blue,strokeWidth:0}}/>
                  {Object.keys(cur?.sections||{}).map((k,i)=>(
                    <Line key={k} type="monotone" dataKey={SM[k]?.short||k} name={SM[k]?.short||k}
                      stroke={LCOLORS[i+1]} strokeWidth={1.5} strokeDasharray="5 3" dot={{r:3,strokeWidth:0}}/>
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {view==="companies"&&!hco&&(
        <div style={{animation:"riseIn 0.5s ease both"}}>
          <div style={{borderBottom:`2px solid ${C.ink}`,paddingBottom:16,marginBottom:28}}>
            <p style={{fontSize:9,color:C.hint,letterSpacing:"0.16em",marginBottom:6,fontFamily:"'JetBrains Mono',monospace"}}>DATABASE</p>
            <h2 style={{fontSize:32,fontWeight:700,fontFamily:"'Lora',serif",letterSpacing:"-0.02em",color:C.ink}}>COMPANIES</h2>
          </div>
          {cos.length===0?(
            <div style={{border:`1px dashed ${C.rule}`,padding:"60px 32px",textAlign:"center"}}>
              <p style={{fontSize:11,color:C.hint,letterSpacing:"0.08em",lineHeight:1.8,fontFamily:"'JetBrains Mono',monospace"}}>
                NO COMPANIES ON RECORD<br/><span style={{fontSize:9}}>UPLOAD A FINANCIAL DOCUMENT TO BEGIN</span>
              </p>
            </div>
          ):cos.map((c,i)=>(
            <div key={c.id} className="cr" style={{animation:`riseIn 0.5s ease ${i*60}ms both`}}
              onClick={()=>{loadH(c.id);setHco(c);}}>
              <div>
                <p style={{fontWeight:700,fontSize:14,marginBottom:3,color:C.ink,
                  fontFamily:"'Lora',serif",letterSpacing:"-0.01em"}}>{c.name}</p>
                <p style={{fontSize:9,color:C.hint,letterSpacing:"0.08em",fontFamily:"'JetBrains Mono',monospace"}}>
                  ADDED {new Date(c.created_at).toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric"}).toUpperCase()}
                </p>
              </div>
              <span style={{color:C.hint,fontSize:12,letterSpacing:"0.06em",fontFamily:"'JetBrains Mono',monospace"}}>VIEW →</span>
            </div>
          ))}
        </div>
      )}

      {view==="companies"&&hco&&history.length>0&&(
        <div style={{animation:"riseIn 0.5s ease both"}}>
          <div style={{borderBottom:`2px solid ${C.ink}`,paddingBottom:16,marginBottom:28,
            display:"flex",alignItems:"flex-end",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
            <div>
              <p style={{fontSize:9,color:C.hint,letterSpacing:"0.16em",marginBottom:6,fontFamily:"'JetBrains Mono',monospace"}}>HISTORY</p>
              <h2 style={{fontSize:32,fontWeight:700,fontFamily:"'Lora',serif",letterSpacing:"-0.02em",color:C.ink}}>{hco.name.toUpperCase()}</h2>
            </div>
            <button className="ghost" onClick={()=>setHco(null)}>← BACK</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8,marginBottom:16}}>
            {history.map((h,i)=>(
              <div key={h.id} style={{background:C.paper,border:`1px solid ${C.rule}`,
                borderTop:`3px solid ${rc(h.overall_tier)}`,padding:"16px 14px",textAlign:"center",
                animation:`riseIn 0.5s ease ${i*80}ms both`}}>
                <p style={{fontSize:8,color:C.hint,letterSpacing:"0.14em",marginBottom:10,fontFamily:"'JetBrains Mono',monospace"}}>FY {h.fiscal_year}</p>
                <Ring score={h.overall_score} size={72} animate={false}/>
                <div style={{marginTop:10}}><Tag tier={h.overall_tier} sm/></div>
              </div>
            ))}
          </div>
          {htd.length>1&&(
            <div style={{background:C.paper,border:`1px solid ${C.rule}`,borderTop:`2px solid ${C.ink}`,padding:28,marginBottom:12}}>
              <p style={{fontSize:9,color:C.hint,letterSpacing:"0.14em",marginBottom:4,fontFamily:"'JetBrains Mono',monospace"}}>RISK TREND</p>
              <h3 style={{fontSize:20,fontWeight:700,marginBottom:24,fontFamily:"'Lora',serif",letterSpacing:"-0.01em",color:C.ink}}>SCORE OVER TIME</h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={htd} margin={{top:4,right:4,left:-20,bottom:0}}>
                  <defs>
                    <linearGradient id="ag2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.blue} stopOpacity={0.1}/>
                      <stop offset="100%" stopColor={C.blue} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="1 4" stroke={C.faint} vertical={false}/>
                  <XAxis dataKey="year" stroke={C.rule} tick={{fill:C.hint,fontSize:9,fontFamily:"'JetBrains Mono',monospace"}}/>
                  <YAxis domain={[0,100]} stroke={C.rule} tick={{fill:C.hint,fontSize:9,fontFamily:"'JetBrains Mono',monospace"}}/>
                  <Tooltip content={<ChartTip/>}/>
                  <ReferenceLine y={70} stroke={C.red} strokeDasharray="3 4" strokeOpacity={0.3}/>
                  <ReferenceLine y={40} stroke={C.green} strokeDasharray="3 4" strokeOpacity={0.3}/>
                  <Area type="monotone" dataKey="score" name="OVERALL" stroke={C.blue} strokeWidth={2} fill="url(#ag2)" dot={{r:4,fill:C.blue,strokeWidth:0}}/>
                  <Line type="monotone" dataKey="INC" name="INCOME" stroke={C.green} strokeWidth={1.5} strokeDasharray="5 3" dot={false}/>
                  <Line type="monotone" dataKey="BAL" name="BALANCE" stroke={C.amber} strokeWidth={1.5} strokeDasharray="5 3" dot={false}/>
                  <Line type="monotone" dataKey="CF" name="CASH FLOW" stroke={C.red} strokeWidth={1.5} strokeDasharray="5 3" dot={false}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
          <div style={{background:C.paper,border:`1px solid ${C.rule}`,borderTop:`2px solid ${C.ink}`,padding:28}}>
            <p style={{fontSize:9,color:C.hint,letterSpacing:"0.14em",marginBottom:4,fontFamily:"'JetBrains Mono',monospace"}}>FINANCIALS</p>
            <h3 style={{fontSize:20,fontWeight:700,marginBottom:20,fontFamily:"'Lora',serif",letterSpacing:"-0.01em",color:C.ink}}>METRICS BY YEAR</h3>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:10}}>
                <thead>
                  <tr style={{borderBottom:`2px solid ${C.ink}`}}>
                    {["YEAR","REVENUE","NET INCOME","TOTAL ASSETS","LIABILITIES","OP. CASH"].map(h=>(
                      <th key={h} style={{padding:"8px 12px",textAlign:"left",color:C.hint,fontWeight:500,
                        fontSize:8,letterSpacing:"0.14em",fontFamily:"'JetBrains Mono',monospace"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map(h=>(
                    <tr key={h.id} style={{borderBottom:`1px solid ${C.faint}`}}>
                      <td style={{padding:"10px 12px",fontWeight:700,fontFamily:"'Lora',serif",color:C.ink,fontSize:14}}>{h.fiscal_year}</td>
                      {[h.revenue,h.net_income,h.total_assets,h.total_liabilities,h.operating_cash].map((v,i)=>(
                        <td key={i} style={{padding:"10px 12px",fontFamily:"'JetBrains Mono',monospace",fontSize:10,
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
  );
}

// ── Root app ──────────────────────────────────────────────────────────────────
export default function App(){
  const[session,setSess]   = useState(null);
  const[ready,setReady]    = useState(false);
  const[mode,setMode]      = useState(null); // null=landing | business | personal

  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{setSess(session);setReady(true);});
    const{data:{subscription}}=supabase.auth.onAuthStateChange((_,s)=>setSess(s));
    return()=>subscription.unsubscribe();
  },[]);

  const logout=async()=>{await supabase.auth.signOut();setMode(null);};

  if(!ready) return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <p style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:C.hint,letterSpacing:"0.1em",animation:"blink 1s step-end infinite"}}>LOADING...</p>
      <style>{`@keyframes blink{0%,100%{opacity:1;}50%{opacity:0;}}`}</style>
    </div>
  );
  if(!session) return <AuthScreen/>;

  return(
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:wght@600;700&family=Plus+Jakarta+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        body{background:${C.bg};color:${C.ink};font-family:'Plus Jakarta Sans',sans-serif;min-height:100vh;
          background-image:repeating-linear-gradient(0deg,transparent,transparent 39px,${C.rule}33 39px,${C.rule}33 40px),
            repeating-linear-gradient(90deg,transparent,transparent 39px,${C.rule}33 39px,${C.rule}33 40px);}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-thumb{background:${C.rule};}
        @keyframes riseIn{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}
        @keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
        @keyframes blink{0%,100%{opacity:1;}50%{opacity:0;}}
        @keyframes tick{0%{width:0;}100%{width:100%;}}
        .nb{background:transparent;border:none;padding:6px 14px;font-family:'JetBrains Mono',monospace;
          font-size:10px;font-weight:600;color:${C.hint};cursor:pointer;transition:all 0.12s;
          letter-spacing:0.12em;border-bottom:2px solid transparent;}
        .nb:hover{color:${C.ink};}
        .nb.on{color:${C.ink};border-bottom:2px solid ${C.ink};}
        .yb{background:transparent;border:1px solid ${C.rule};padding:8px 14px;cursor:pointer;
          transition:all 0.12s;font-family:'JetBrains Mono',monospace;text-align:left;}
        .yb:hover{border-color:${C.ink};background:${C.faint};}
        .yb.on{background:${C.ink};border-color:${C.ink};color:${C.bg};}
        .cr{background:${C.paper};border:1px solid ${C.rule};border-left:3px solid ${C.rule};
          padding:14px 18px;cursor:pointer;transition:all 0.15s;margin-bottom:6px;
          display:flex;align-items:center;justify-content:space-between;}
        .cr:hover{border-left-color:${C.ink};transform:translateX(2px);}
        .ghost{padding:6px 12px;border:1px solid ${C.rule};background:transparent;
          color:${C.sub};font-size:9px;cursor:pointer;font-family:'JetBrains Mono',monospace;
          transition:all 0.12s;letter-spacing:0.1em;}
        .ghost:hover{color:${C.ink};border-color:${C.ink};}
        input,select{border-radius:0!important;}
      `}</style>

      {/* Ticker */}
      <div style={{background:C.ink,padding:"4px 36px",display:"flex",gap:32,alignItems:"center",overflowX:"auto"}}>
        {["CREDITLENS RISK PLATFORM","BUSINESS & PERSONAL CREDIT","BIG 5 BANK BENCHMARKING",
          "MULTI-YEAR TREND ANALYSIS","SUPABASE SECURE STORAGE"].map((t,i)=>(
          <span key={i} style={{fontSize:9,color:C.hint,letterSpacing:"0.12em",whiteSpace:"nowrap",
            fontFamily:"'JetBrains Mono',monospace"}}>— {t}</span>
        ))}
      </div>

      {/* Nav */}
      <nav style={{background:C.bg,borderBottom:`2px solid ${C.ink}`,padding:"0 36px",
        display:"flex",alignItems:"center",justifyContent:"space-between",height:52,
        position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <button onClick={()=>setMode(null)} style={{background:"none",border:"none",cursor:"pointer",padding:0}}>
            <span style={{fontSize:22,fontWeight:700,color:C.ink,fontFamily:"'Lora',serif",letterSpacing:"-0.01em"}}>CreditLens</span>
          </button>
          {mode&&(
            <>
              <div style={{width:1,height:20,background:C.rule}}/>
              <span style={{fontSize:10,color:C.hint,letterSpacing:"0.1em",fontFamily:"'JetBrains Mono',monospace"}}>
                {mode==="business"?"BUSINESS CREDIT":"PERSONAL CREDIT"}
              </span>
              <button className="ghost" onClick={()=>setMode(null)} style={{fontSize:9}}>← SWITCH MODE</button>
            </>
          )}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:10,color:C.hint,letterSpacing:"0.06em",fontFamily:"'JetBrains Mono',monospace"}}>
            {session.user.email}
          </span>
          <button className="ghost" onClick={logout}>SIGN OUT</button>
        </div>
      </nav>

      <div style={{maxWidth:1060,margin:"0 auto",padding:"40px 24px"}}>
        {!mode&&<Landing onSelect={setMode}/>}
        {mode==="business"&&<BusinessCredit session={session}/>}
        {mode==="personal"&&<PersonalCredit/>}
      </div>
    </>
  );
}