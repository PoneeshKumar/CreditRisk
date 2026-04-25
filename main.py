from fastapi import FastAPI, UploadFile, File, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from dotenv import load_dotenv
from supabase import create_client
import os
import pdfplumber
import io
from fastapi.middleware.cors import CORSMiddleware
import re
import jwt

# load the .env file and initialize Supabase client
load_dotenv()
supabase = create_client(
    os.getenv("SUPABASE_URL") or "",
    os.getenv("SUPABASE_KEY") or ""
)


# Auth
security = HTTPBearer()

def get_user_id(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    try:
        payload = jwt.decode(credentials.credentials, options={"verify_signature": False})
        return payload["sub"]
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

# create the FastAPI app and configure CORS
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://creditlens-pi.vercel.app",
        "https://creditlensanalyze.vercel.app",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


# In-memory storage for credit applications
application_data = {}
next_id = 1

# Pydantic model for credit application

class DocumentRequest(BaseModel):
    business_name: str
    annual_revenue: float
    years_in_business: int
    outstanding_debt: float
    missed_payments: int

# detect the years from the finanicla statement that was uploaded 
def extract_year_columns(text: str) -> list:
    years = sorted(set(re.findall(r'\b(20\d{2})\b', text)), reverse=True)
    years = [int(y) for y in years if 2000 <= int(y) <= 2030][:6]
    return years

# parse line values, handling both plain numbers and those in parentheses (indicating negatives)
def parse_line_values(line: str) -> list:
    raw = re.findall(r'(\([\d,]+\)|[\d,]+)', line)
    values = []
    for v in raw:
        is_negative = v.startswith('(')
        num = float(v.replace('(','').replace(')','').replace(',',''))
        values.append(-num if is_negative else num)
    return values

# extract values for multiple years based on label patterns and detected years
def extract_multi_year(text: str, label_patterns: list, years: list) -> dict:
    lines = text.split('\n')
    for line in lines:
        line_lower = line.lower()
        if any(pat in line_lower for pat in label_patterns):
            values = parse_line_values(line)
            if len(values) > 0:
                result = {}
                for i, year in enumerate(years):
                    if i < len(values):
                        result[year] = values[i]
                return result
    return {}

# analyze each section of the financial statement, calculating scores and findings based on extracted values for each year
def analyze_income_statement_multi(text: str, years: list, user_id: str) -> dict:
    keywords = ["net sales", "net income", "gross profit", "revenue", 
                "cost of sales", "operating income", "net loss"]
    if not any(kw in text.lower() for kw in keywords):
        return {}
    fields = {
        "revenue":          ["total net sales", "net sales", "total revenue", "net revenue", "revenue"],
        "net_income":       ["net earnings", "net income", "net loss"],
        "gross_profit":     ["gross profit", "gross margin"],
        "operating_income": ["operating income", "income from operations"],
        "total_liabilities":["total liabilities"],
    }
    results = {f: extract_multi_year(text, p, years) for f, p in fields.items()}
    per_year = {}
    for year in years:
        score = 50
        findings = []
        net_income = results["net_income"].get(year)
        revenue = results["revenue"].get(year)
        total_liabilities = results["total_liabilities"].get(year)
        gross_profit = results["gross_profit"].get(year)
        if net_income is not None:
            if net_income > 0:
                score -= 20
                findings.append(f"Profitable — net income ${net_income:,.0f}")
            else:
                score += 30
                findings.append(f"Net loss ${abs(net_income):,.0f}")
        if revenue and total_liabilities:
            ratio = abs(total_liabilities) / abs(revenue)
            findings.append(f"Debt-to-revenue: {ratio:.2f}")
            score += 20 if ratio > 2 else (-10 if ratio < 0.5 else 0)
        if gross_profit:
            findings.append(f"Gross profit ${gross_profit:,.0f}")
        per_year[year] = {
            "score": max(0, min(100, score)),
            "findings": findings,
            "raw": {f: results[f].get(year) for f in fields}
        }
    return per_year

# Similar structure for balance sheet, cash flow, bank statement, and credit application analyses, each with their own relevant fields and scoring logic
def analyze_balance_sheet_multi(text: str, years: list, user_id: str) -> dict:
    keywords = ["total assets", "total liabilities", "shareholders equity",
                "current assets", "current liabilities", "balance sheet"]
    if not any(kw in text.lower() for kw in keywords):
        return {}
    fields = {
        "total_assets":        ["total assets"],
        "total_liabilities":   ["total liabilities"],
        "total_equity":        ["total equity", "stockholders equity", "shareholders equity"],
        "current_assets":      ["total current assets", "current assets"],
        "current_liabilities": ["total current liabilities", "current liabilities"],
        "cash":                ["cash and cash equivalents"],
    }
    results = {f: extract_multi_year(text, p, years) for f, p in fields.items()}
    per_year = {}
    for year in years:
        score = 50
        findings = []
        total_assets = results["total_assets"].get(year)
        total_liabilities = results["total_liabilities"].get(year)
        current_assets = results["current_assets"].get(year)
        current_liabilities = results["current_liabilities"].get(year)
        total_equity = results["total_equity"].get(year)
        if total_assets and total_liabilities:
            ratio = abs(total_liabilities) / abs(total_assets)
            findings.append(f"Debt-to-assets: {ratio:.2f}")
            score += 30 if ratio > 0.8 else (-20 if ratio < 0.4 else 0)
        if current_assets and current_liabilities:
            cr = abs(current_assets) / abs(current_liabilities)
            findings.append(f"Current ratio: {cr:.2f}")
            score += -20 if cr > 2 else (20 if cr < 1 else 0)
        if total_equity:
            findings.append(f"Total equity ${total_equity:,.0f}")
        per_year[year] = {
            "score": max(0, min(100, score)),
            "findings": findings,
            "raw": {f: results[f].get(year) for f in fields}
        }
    return per_year

# For cash flow, we look at operating cash flow and net change in cash as key indicators of liquidity and financial health, adjusting scores based on positive or negative trends
def analyze_cash_flow_multi(text: str, years: list, user_id: str) -> dict:
    keywords = ["operating activities", "investing activities", 
                "financing activities", "cash flows"]
    if not any(kw in text.lower() for kw in keywords):
        return {}
    fields = {
        "operating_cash":  ["net cash from operating", "cash from operating activities", "net cash provided by operating"],
        "investing_cash":  ["net cash from investing", "cash from investing activities"],
        "financing_cash":  ["net cash from financing", "cash from financing activities"],
        "net_change_cash": ["net increase in cash", "net change in cash", "net decrease in cash"],
    }
    results = {f: extract_multi_year(text, p, years) for f, p in fields.items()}
    per_year = {}
    for year in years:
        score = 50
        findings = []
        operating_cash = results["operating_cash"].get(year)
        net_change = results["net_change_cash"].get(year)
        if operating_cash is not None:
            score += -20 if operating_cash > 0 else 25
            findings.append(f"Operating cash flow ${operating_cash:,.0f}")
        if net_change is not None:
            score += -10 if net_change > 0 else 15
            findings.append(f"Net change in cash ${net_change:,.0f}")
        per_year[year] = {
            "score": max(0, min(100, score)),
            "findings": findings,
            "raw": {f: results[f].get(year) for f in fields}
        }
    return per_year
# For bank statements, we focus on trends in opening and closing balances, total deposits and withdrawals, and any occurrences of non-sufficient funds (NSF), which can be a strong negative indicator of cash flow issues
def analyze_bank_statement_multi(text: str, years: list, user_id: str) -> dict:
    bank_keywords = ["total deposits", "total withdrawals", "balance forward", 
                     "opening balance", "closing balance", "account number",
                     "non-sufficient funds", "nsf charge"]
    
    if not any(kw in text.lower() for kw in bank_keywords):
        return {}
    fields = {
        "opening_balance":   ["opening balance", "balance forward"],
        "closing_balance":   ["closing balance", "ending balance"],
        "total_deposits":    ["total deposits", "total credits"],
        "total_withdrawals": ["total withdrawals", "total debits"],
        "nsf_count": ["nsf charge", "nsf fee", "non-sufficient funds charge"],
    }
    results = {f: extract_multi_year(text, p, years) for f, p in fields.items()}
    per_year = {}
    for year in years:
        score = 50
        findings = []
        nsf = results["nsf_count"].get(year)

        closing = results["closing_balance"].get(year)
        opening = results["opening_balance"].get(year)
        deposits = results["total_deposits"].get(year)
        withdrawals = results["total_withdrawals"].get(year)
        if nsf:
            score += int(nsf) * 10
            findings.append(f"NSF count: {int(nsf)}")
        if closing and opening:
            if closing > opening:
                score -= 10
                findings.append("Balance increased — positive sign")
            else:
                score += 20
                findings.append("Balance decreased — monitor closely")
        if deposits:
            findings.append(f"Total deposits ${deposits:,.0f}")
        if withdrawals:
            findings.append(f"Total withdrawals ${withdrawals:,.0f}")
        per_year[year] = {
            "score": max(0, min(100, score)),
            "findings": findings,
            "raw": {f: results[f].get(year) for f in fields}
        }
    return per_year

# For credit applications, we look at the requested amount, annual income, existing debt, years in business, and any missed payments. We calculate a score based on debt-to-income ratio, business longevity, and payment history, which are key factors in credit risk assessment
def analyze_credit_application_multi(text: str, years: list, user_id: str) -> dict:
    keywords = ["operating activities", "investing activities", 
                "financing activities", "cash flows"]
    if not any(kw in text.lower() for kw in keywords):
        return {}
    fields = {
        "requested_amount":  ["requested amount", "credit limit requested", "loan amount"],
        "annual_income":     ["annual income", "annual revenue"],
        "existing_debt":     ["existing debt", "outstanding debt"],
        "years_in_business": ["years in business", "years operating"],
        "missed_payments":   ["missed payments"],
    }
    results = {f: extract_multi_year(text, p, years) for f, p in fields.items()}
    per_year = {}
    for year in years:
        score = 50
        findings = []
        existing_debt = results["existing_debt"].get(year)
        annual_income = results["annual_income"].get(year)
        years_biz = results["years_in_business"].get(year)
        missed = results["missed_payments"].get(year)
        requested = results["requested_amount"].get(year)
        if existing_debt and annual_income:
            dti = existing_debt / annual_income
            findings.append(f"Debt-to-income: {dti:.2f}")
            score += 25 if dti > 0.5 else (-20 if dti < 0.3 else 0)
        if years_biz is not None:
            findings.append(f"Years in business: {int(years_biz)}")
            score += -20 if years_biz > 5 else (20 if years_biz < 2 else 0)
        if missed and missed > 0 and missed < 13:
            score += int(missed) * 15
            findings.append(f"Missed payments: {int(missed)}")
        if requested:
            findings.append(f"Requested credit ${requested:,.0f}")
        per_year[year] = {
            "score": max(0, min(100, score)),
            "findings": findings,
            "raw": {f: results[f].get(year) for f in fields}
        }
    return per_year

# make a helper to get the overall tier and recommendation based on the average score across all sections, which simplifies the final output and provides a clear action item for lenders reviewing the analysis
def get_tier(score):
    if score < 40: return "low", "approve"
    if score < 70: return "medium", "review"
    return "high", "reject"

# helper function to get or create a company record in the database, ensuring we have a consistent company_id to link analyses to, and avoiding duplicates based on company name
def get_or_create_company(name: str, user_id: str) -> str:
    existing = supabase.table("companies").select("id").eq("name", name).eq("user_id", user_id).execute()
    if existing.data:
        return existing.data[0]["id"]
    new = supabase.table("companies").insert({"name": name, "user_id": user_id}).execute()
    return new.data[0]["id"]

# helper function to save the analysis results to the database, including both the overall scores and the raw extracted values for each section, which allows for future reference and historical tracking of a company's financial health over time
def save_analysis(company_id: str, fiscal_year: int, result: dict, sections: dict, user_id: str):
    income = sections.get("income_statement", {}).get("raw", {})
    balance = sections.get("balance_sheet", {}).get("raw", {})
    cashflow = sections.get("cash_flow", {}).get("raw", {})
    bank = sections.get("bank_statement", {}).get("raw", {})

    debt_ratio = None
    if income.get("total_liabilities") and income.get("revenue"):
        debt_ratio = abs(income["total_liabilities"]) / abs(income["revenue"])

    current_ratio = None
    if balance.get("current_assets") and balance.get("current_liabilities"):
        current_ratio = abs(balance["current_assets"]) / abs(balance["current_liabilities"])

    raw_sections = result.get("sections", {})
    record = {
        "company_id": company_id,
        "user_id": user_id,
        "fiscal_year": fiscal_year,
        "overall_score": result["overall_score"],
        "overall_tier": result["overall_tier"],
        "overall_recommendation": result["overall_recommendation"],
        "income_score": raw_sections.get("income_statement", {}).get("score"),
        "balance_score": raw_sections.get("balance_sheet", {}).get("score"),
        "cashflow_score": raw_sections.get("cash_flow", {}).get("score"),
        "bank_score": raw_sections.get("bank_statement", {}).get("score"),
        "credit_score": raw_sections.get("credit_application", {}).get("score"),
        "revenue": income.get("revenue"),
        "net_income": income.get("net_income"),
        "total_assets": balance.get("total_assets"),
        "total_liabilities": balance.get("total_liabilities"),
        "total_equity": balance.get("total_equity"),
        "operating_cash": cashflow.get("operating_cash"),
        "closing_balance": bank.get("closing_balance"),
        "nsf_count": int(bank["nsf_count"]) if bank.get("nsf_count") else 0,
        "debt_to_revenue": debt_ratio,
        "current_ratio": current_ratio,
        "raw_findings": raw_sections,
    }
    supabase.table("analyses").upsert(record, on_conflict="company_id,fiscal_year").execute()

# API endpoints for root, PDF analysis, credit application submission, and listing applications and companies, which provide the main interface for interacting with the credit risk assessment functionality
@app.get("/")
def root():
    return {"message": "Credit Risk Assessment API"}

# The main endpoint to analyze an uploaded PDF, which extracts text, detects fiscal years, runs multiple analyzers for different financial sections, calculates overall scores and tiers, and saves the results to the database for future reference
@app.post("/analyze-pdf")
async def analyze_pdf(file: UploadFile = File(...), user_id: str = Depends(get_user_id)):
    contents = await file.read()

    with pdfplumber.open(io.BytesIO(contents)) as pdf:
        text = ""
        business_name = "Unknown"
        for page in pdf.pages:
            page_text = page.extract_text() or ""
            text += page_text

        # Smart name extraction — look for known patterns first
        name_patterns = [
            r'^([A-Z][A-Z\s&\',\.]+(?:INC\.?|CORP\.?|LLC\.?|LTD\.?|CO\.?|COMPANY|CORPORATION|INCORPORATED))',
            r'([A-Z][A-Z\s&\',\.]{3,50}(?:INC\.?|CORP\.?|LLC\.?|LTD\.?|CO\.?|COMPANY|CORPORATION))',
        ]

        for pattern in name_patterns:
            match = re.search(pattern, text[:3000], re.MULTILINE)
            if match:
                candidate = match.group(1).strip()
                # Filter out garbage lines
                if 3 < len(candidate) < 80 and "SUBSIDIARIES" not in candidate:
                    business_name = candidate
                    break

    # Fallback — first short non-numeric line that isn't a header
    if business_name == "Unknown":
        for line in text.split('\n')[:30]:
            line = line.strip()
            if (5 < len(line) < 60
                and not re.match(r'^[\d\s\-/\.]+$', line)
                and "subsidiaries" not in line.lower()
                and "consolidated" not in line.lower()
                and "table of contents" not in line.lower()
                and "financial statements" not in line.lower()):
                business_name = line
                break

    if not text.strip():
        return {"error": "Could not extract text from PDF"}

    years = extract_year_columns(text)
    if not years:
        return {"error": "Could not detect fiscal years in document"}

    # Run all analyzers
    income_by_year    = analyze_income_statement_multi(text, years, user_id)
    balance_by_year   = analyze_balance_sheet_multi(text, years, user_id)
    cashflow_by_year  = analyze_cash_flow_multi(text, years, user_id)
    bank_by_year      = analyze_bank_statement_multi(text, years, user_id)
    credit_by_year    = analyze_credit_application_multi(text, years, user_id)

    company_id = get_or_create_company(business_name, user_id)
    results_by_year = {}

    for year in years:
        sections = {}
        if income_by_year.get(year, {}).get("findings"):
            sections["income_statement"] = income_by_year[year]
        if balance_by_year.get(year, {}).get("findings"):
            sections["balance_sheet"] = balance_by_year[year]
        if cashflow_by_year.get(year, {}).get("findings"):
            sections["cash_flow"] = cashflow_by_year[year]
        if bank_by_year.get(year, {}).get("findings"):
            sections["bank_statement"] = bank_by_year[year]
        if credit_by_year.get(year, {}).get("findings"):
            sections["credit_application"] = credit_by_year[year]

        if not sections:
            continue

        scores = [s["score"] for s in sections.values()]
        overall_score = int(sum(scores) / len(scores))
        overall_tier, overall_recommendation = get_tier(overall_score)

        result = {
            "business_name": business_name,
            "fiscal_year": year,
            "overall_score": overall_score,
            "overall_tier": overall_tier,
            "overall_recommendation": overall_recommendation,
            "sections": {
                k: {"score": v["score"], "tier": get_tier(v["score"])[0], "findings": v["findings"]}
                for k, v in sections.items()
            }
        }

        save_analysis(company_id, year, result, {
            "income_statement": income_by_year.get(year, {}),
            "balance_sheet":    balance_by_year.get(year, {}),
            "cash_flow":        cashflow_by_year.get(year, {}),
            "bank_statement":   bank_by_year.get(year, {}),
            "credit_application": credit_by_year.get(year, {}),
        }, user_id)

        results_by_year[year] = result

    return {
        "business_name": business_name,
        "company_id": company_id,
        "years_detected": years,
        "results": results_by_year
    }

# For credit applications, we look at the requested amount, annual income, existing debt, years in business, and any missed payments. We calculate a score based on debt-to-income ratio, business longevity, and payment history, which are key factors in credit risk assessment
def calculate_credit_score(application: DocumentRequest):
    score = 700
    if application.annual_revenue < 100000: score -= 50
    if application.years_in_business < 2:   score -= 50
    if application.outstanding_debt > 50000: score -= 50
    if application.missed_payments > 3:      score -= 50
    return max(score, 300)

# helper to convert credit score to risk tier, which provides a simple categorization for lenders to quickly assess the level of risk associated with a credit application based on the calculated score
def get_risk_tier(credit_score: int):
    if credit_score >= 650: return "low"
    elif credit_score >= 550: return "medium"
    else: return "high"

# API endpoint to submit a credit application, which calculates the credit score and risk tier based on the provided application data, stores the application in memory, and returns the results to the client for immediate feedback
@app.post("/apply")
def apply(application: DocumentRequest):
    global next_id
    application_id = next_id
    next_id += 1
    app_record = application.dict()
    app_record["id"] = application_id
    app_record["status"] = "pending"
    app_record["credit_score"] = calculate_credit_score(application)
    app_record["risk_tier"] = get_risk_tier(app_record["credit_score"])
    application_data[application_id] = app_record
    return {"application_id": application_id, "status": "pending", "credit_score": app_record["credit_score"], "risk_tier": app_record["risk_tier"]}

# API endpoint to list all submitted credit applications, which allows lenders or administrators to view the current applications and their associated scores and risk tiers for further processing or review
@app.get("/applications")
def list_applications():
    return application_data

# API endpoint to list all companies in the database, which provides a way to retrieve the companies for which analyses have been performed, and can be used to link to historical analysis data for each company
@app.get("/companies")
def list_companies(user_id: str = Depends(get_user_id)):
    result = supabase.table("companies").select("*").eq("user_id", user_id).order("name").execute()
    return result.data

# API endpoint to retrieve the historical analyses for a specific company, which allows lenders or administrators to see how a company's financial health has changed over time based on the stored analysis results in the database
@app.get("/companies/{company_id}/history")
def company_history(company_id: str, user_id: str = Depends(get_user_id)):
    result = supabase.table("analyses").select("*").eq("company_id", company_id).eq("user_id", user_id).order("fiscal_year").execute()
    return result.data