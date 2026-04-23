from fastapi import FastAPI, UploadFile, File
from pydantic import BaseModel
from dotenv import load_dotenv
import os
import pdfplumber
import json
import io
from fastapi.middleware.cors import CORSMiddleware
import re
from supabase import create_client

load_dotenv()
supabase = create_client(
    os.getenv("SUPABASE_URL") or "",
    os.getenv("SUPABASE_KEY") or ""
)

# Initialize FastAPI app
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

application_data = {}
next_id = 1

# Create a class to represent the document request
class DocumentRequest(BaseModel):
    business_name: str
    annual_revenue: float
    years_in_business: int
    outstanding_debt: float
    missed_payments: int

# create a root endpoint to verify the API is working
@app.get("/")
def root():
    return("Welcome to the Credit Risk Assesment API")

# make a function to extract relevant sections from the PDF text based on keywords
def extract_section(text: str, keywords: list) -> str:
    # This function will look for lines containing any of the keywords and return a block of text around those lines
    lines = text.split('\n')
    section_lines = []
    in_section = False
    for line in lines:
        if any(kw in line.lower() for kw in keywords):
            in_section = True
        if in_section:
            section_lines.append(line)
        if len(section_lines) > 40:
            break
    return '\n'.join(section_lines)

# create functions to analyze each section of the financial documents and extract key financial metrics, calculate a score based on those metrics, and return the findings in a structured format

# make a function to analyze the income statement section
def analyze_income_statement(text: str) -> dict:
    patterns = {
        "revenue":          r"(?:total revenue|net revenue|revenue)[^\d]*([\d,]+)",
        "net_income":       r"(?:net income|net profit|net earnings)[^\d]*([\d,]+)",
        "gross_profit":     r"(?:gross profit|gross income)[^\d]*([\d,]+)",
        "operating_income": r"(?:operating income|income from operations)[^\d]*([\d,]+)",
        "total_debt":       r"(?:total debt|total liabilities)[^\d]*([\d,]+)",
    }
    data = {}
    for key, pattern in patterns.items():
        match = re.search(pattern, text.lower())
        data[key] = float(match.group(1).replace(",", "")) if match else None

    score = 50
    findings = []
    if data["net_income"] is not None:
        if data["net_income"] > 0:
            score -= 20
            findings.append(f"Profitable — net income ${data['net_income']:,.0f}")
        else:
            score += 30
            findings.append(f"Unprofitable — net loss ${abs(data['net_income']):,.0f}")
    if data["revenue"] and data["total_debt"]:
        ratio = data["total_debt"] / data["revenue"]
        findings.append(f"Debt-to-revenue ratio: {ratio:.2f}")
        score += 20 if ratio > 2 else (-10 if ratio < 0.5 else 0)
    if data["gross_profit"]:
        findings.append(f"Gross profit: ${data['gross_profit']:,.0f}")

    return {"score": max(0, min(100, score)), "findings": findings, "raw": data}

# make a function to analyze the balance sheet section
def analyze_balance_sheet(text: str) -> dict:
    patterns = {
        "total_assets":        r"(?:total assets)[^\d]*([\d,]+)",
        "total_liabilities":   r"(?:total liabilities)[^\d]*([\d,]+)",
        "total_equity":        r"(?:total equity|stockholders equity|shareholders equity)[^\d]*([\d,]+)",
        "current_assets":      r"(?:total current assets|current assets)[^\d]*([\d,]+)",
        "current_liabilities": r"(?:total current liabilities|current liabilities)[^\d]*([\d,]+)",
        "cash":                r"(?:cash and cash equivalents|cash)[^\d]*([\d,]+)",
    }
    data = {}
    for key, pattern in patterns.items():
        match = re.search(pattern, text.lower())
        data[key] = float(match.group(1).replace(",", "")) if match else None

    score = 50
    findings = []
    if data["total_assets"] and data["total_liabilities"]:
        ratio = data["total_liabilities"] / data["total_assets"]
        findings.append(f"Debt-to-assets ratio: {ratio:.2f}")
        score += 30 if ratio > 0.8 else (-20 if ratio < 0.4 else 0)
    if data["current_assets"] and data["current_liabilities"]:
        current_ratio = data["current_assets"] / data["current_liabilities"]
        findings.append(f"Current ratio: {current_ratio:.2f}")
        score += -20 if current_ratio > 2 else (20 if current_ratio < 1 else 0)
    if data["total_equity"]:
        findings.append(f"Total equity: ${data['total_equity']:,.0f}")

    return {"score": max(0, min(100, score)), "findings": findings, "raw": data}

# make a function to analyze the cash flow statement section
def analyze_cash_flow(text: str) -> dict:
    patterns = {
        "operating_cash":  r"(?:net cash from operating|cash from operating activities)[^\d]*([\d,]+)",
        "investing_cash":  r"(?:net cash from investing|cash from investing activities)[^\d]*([\d,]+)",
        "financing_cash":  r"(?:net cash from financing|cash from financing activities)[^\d]*([\d,]+)",
        "net_change_cash": r"(?:net increase in cash|net change in cash)[^\d]*([\d,]+)",
        "closing_balance": r"(?:closing cash balance|ending cash balance)[^\d]*([\d,]+)",
    }
    data = {}
    for key, pattern in patterns.items():
        match = re.search(pattern, text.lower())
        data[key] = float(match.group(1).replace(",", "")) if match else None

    score = 50
    findings = []
    if data["operating_cash"] is not None:
        score += -20 if data["operating_cash"] > 0 else 25
        findings.append(f"Operating cash flow: ${data['operating_cash']:,.0f}")
    if data["net_change_cash"] is not None:
        score += -10 if data["net_change_cash"] > 0 else 15
        findings.append(f"Net change in cash: ${data['net_change_cash']:,.0f}")
    if data["closing_balance"]:
        findings.append(f"Closing cash balance: ${data['closing_balance']:,.0f}")

    return {"score": max(0, min(100, score)), "findings": findings, "raw": data}

# make a function to analyze the bank statement section
def analyze_bank_statement(text: str) -> dict:
    patterns = {
        "opening_balance":   r"(?:opening balance|balance forward)[^\d]*([\d,]+)",
        "closing_balance":   r"(?:closing balance|ending balance)[^\d]*([\d,]+)",
        "total_deposits":    r"(?:total deposits|total credits)[^\d]*([\d,]+)",
        "total_withdrawals": r"(?:total withdrawals|total debits)[^\d]*([\d,]+)",
        "nsf_count":         r"(?:nsf|non.sufficient funds)[^\d]*(\d+)",
    }
    data = {}
    for key, pattern in patterns.items():
        match = re.search(pattern, text.lower())
        data[key] = float(match.group(1).replace(",", "")) if match else None

    score = 50
    findings = []
    if data["nsf_count"] is not None:
        score += int(data["nsf_count"]) * 10
        findings.append(f"NSF count: {int(data['nsf_count'])}")
    if data["closing_balance"] and data["opening_balance"]:
        if data["closing_balance"] > data["opening_balance"]:
            score -= 10
            findings.append("Balance increased over period — positive sign")
        else:
            score += 20
            findings.append("Balance decreased over period — monitor closely")
    if data["total_deposits"]:
        findings.append(f"Total deposits: ${data['total_deposits']:,.0f}")
    if data["total_withdrawals"]:
        findings.append(f"Total withdrawals: ${data['total_withdrawals']:,.0f}")

    return {"score": max(0, min(100, score)), "findings": findings, "raw": data}

# make a function to analyze the credit application section
def analyze_credit_application(text: str) -> dict:
    patterns = {
        "requested_amount":  r"(?:requested amount|credit limit requested|loan amount)[^\d]*([\d,]+)",
        "annual_income":     r"(?:annual income|annual revenue)[^\d]*([\d,]+)",
        "existing_debt":     r"(?:existing debt|outstanding debt)[^\d]*([\d,]+)",
        "years_in_business": r"(?:years in business|years operating)[^\d]*(\d+)",
        "missed_payments": r"missed payments[^:\n]*:\s*(\d+)",
    }
    data = {}
    for key, pattern in patterns.items():
        match = re.search(pattern, text.lower())
        data[key] = float(match.group(1).replace(",", "")) if match else None
    print("Credit app data:", data)
    score = 50
    findings = []
    if data["existing_debt"] and data["annual_income"]:
        dti = data["existing_debt"] / data["annual_income"]
        findings.append(f"Debt-to-income ratio: {dti:.2f}")
        # 0.27 is healthy, only penalize above 0.5
        score += 25 if dti > 0.5 else (-20 if dti < 0.3 else 0)
    if data["years_in_business"] is not None:
        findings.append(f"Years in business: {int(data['years_in_business'])}")
        score += -20 if data["years_in_business"] > 5 else (20 if data["years_in_business"] < 2 else 0)
    if data["missed_payments"] is not None and data["missed_payments"] > 0:
        score += int(data["missed_payments"]) * 15
        findings.append(f"Missed payments: {int(data['missed_payments'])}")
    if data["requested_amount"]:
        findings.append(f"Requested credit: ${data['requested_amount']:,.0f}")

    return {"score": max(0, min(100, score)), "findings": findings, "raw": data}

# make a function to determine the overall risk tier based on the average score from all sections
def get_tier(score):
    if score < 40: return "low", "approve"
    if score < 70: return "medium", "review"
    return "high", "reject"


# create a function to get or create a company record in the database based on the business name, this will return the company ID which can be used to associate the analysis results with the correct company
def get_or_create_company(name: str) -> str:
    existing = supabase.table("companies").select("id").eq("name", name).execute()
    if existing.data:
        return existing.data[0]["id"]
    new = supabase.table("companies").insert({"name": name}).execute()
    return new.data[0]["id"]

# create a function to save the analysis results to the database, this will take in the company ID, fiscal year, overall score, tier, recommendation, and the raw findings from each section and store them in a structured format in the analyses table
def save_analysis(company_id: str, fiscal_year: int, result: dict, sections: dict):
    raw = result.get("sections", {})
    income = sections.get("income_statement", {}).get("raw", {})
    balance = sections.get("balance_sheet", {}).get("raw", {})
    cashflow = sections.get("cash_flow", {}).get("raw", {})
    bank = sections.get("bank_statement", {}).get("raw", {})

    debt_ratio = None
    if income.get("total_debt") and income.get("revenue"):
        debt_ratio = income["total_debt"] / income["revenue"]

    current_ratio = None
    if balance.get("current_assets") and balance.get("current_liabilities"):
        current_ratio = balance["current_assets"] / balance["current_liabilities"]

    record = {
        "company_id": company_id,
        "fiscal_year": fiscal_year,
        "overall_score": result["overall_score"],
        "overall_tier": result["overall_tier"],
        "overall_recommendation": result["overall_recommendation"],
        "income_score": raw.get("income_statement", {}).get("score"),
        "balance_score": raw.get("balance_sheet", {}).get("score"),
        "cashflow_score": raw.get("cash_flow", {}).get("score"),
        "bank_score": raw.get("bank_statement", {}).get("score"),
        "credit_score": raw.get("credit_application", {}).get("score"),
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
        "raw_findings": raw,
    }

    supabase.table("analyses").upsert(record, on_conflict="company_id,fiscal_year").execute()

# create an endpoint to upload a PDF document, extract the text, analyze the relevant sections, and return a structured response with the findings and an overall risk assessment
@app.post("/analyze-pdf")
async def analyze_pdf(file: UploadFile = File(...), fiscal_year: int = 2024):
    contents = await file.read()

    with pdfplumber.open(io.BytesIO(contents)) as pdf:
        text = ""
        business_name = "Unknown"
        for page in pdf.pages:
            page_text = page.extract_text() or ""
            text += page_text
            if business_name == "Unknown" and page_text.strip():
                business_name = page_text.strip().split("\n")[0][:50]

    if not text.strip():
        return {"error": "Could not extract text from PDF"}

    sections = {}
    if any(k in text.lower() for k in ["net income", "gross profit", "revenue", "operating income"]):
        sections["income_statement"] = analyze_income_statement(text)
    if any(k in text.lower() for k in ["total assets", "total liabilities", "total equity"]):
        sections["balance_sheet"] = analyze_balance_sheet(text)
    if any(k in text.lower() for k in ["operating activities", "investing activities", "financing activities"]):
        sections["cash_flow"] = analyze_cash_flow(text)
    if any(k in text.lower() for k in ["total deposits", "total withdrawals", "balance forward", "nsf"]):
        sections["bank_statement"] = analyze_bank_statement(text)
    if any(k in text.lower() for k in ["credit limit requested", "requested amount", "years in business"]):
        sections["credit_application"] = analyze_credit_application(text)

    if not sections:
        return {"error": "No recognizable financial data found in document"}

    overall_score = int(sum(s["score"] for s in sections.values()) / len(sections))
    overall_tier, overall_recommendation = get_tier(overall_score)

    result = {
        "business_name": business_name,
        "fiscal_year": fiscal_year,
        "overall_score": overall_score,
        "overall_tier": overall_tier,
        "overall_recommendation": overall_recommendation,
        "sections": {
            k: {"score": v["score"], "tier": get_tier(v["score"])[0], "findings": v["findings"]}
            for k, v in sections.items()
        }
    }

    company_id = get_or_create_company(business_name)
    save_analysis(company_id, fiscal_year, result, sections)
    result["company_id"] = company_id

    return result

def calculate_credit_score(application: DocumentRequest):
    score = 700
    if application.annual_revenue < 100000:
        score -= 50
    if application.years_in_business < 2:
        score -= 50
    if application.outstanding_debt > 50000:
        score -= 50
    if application.missed_payments > 3:
        score -= 50
    return max(score, 300)

def get_risk_tier(credit_score: int):
    if credit_score >= 650:
        return "low"
    elif credit_score >= 550:
        return "medium"
    else:
        return "high"

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

@app.get("/applications")
def list_applications():
    return application_data

@app.get("/companies")
def list_companies():
    result = supabase.table("companies").select("*").order("name").execute()
    return result.data

@app.get("/companies/{company_id}/history")
def company_history(company_id: str):
    result = supabase.table("analyses").select("*").eq("company_id", company_id).order("fiscal_year").execute()
    return result.data

