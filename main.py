from fastapi import FastAPI, UploadFile, File
from pydantic import BaseModel
from dotenv import load_dotenv
import os
import pdfplumber
import json
import io
from fastapi.middleware.cors import CORSMiddleware
import re

load_dotenv()

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

# create a function to extract financial data from the etxt of a PDF for scoring.
def extract_financials(text: str) -> dict:
    patterns = {
        "revenue":          r"(?:total revenue|net revenue|revenue)[^\d]*([\d,]+)",
        "net_income":       r"(?:net income|net profit|net earnings)[^\d]*([\d,]+)",
        "gross_profit":     r"(?:gross profit|gross income)[^\d]*([\d,]+)",
        "total_debt":       r"(?:total debt|long.term debt|total liabilities)[^\d]*([\d,]+)",
        "cash":             r"(?:cash and cash equivalents|cash)[^\d]*([\d,]+)",
        "operating_income": r"(?:operating income|income from operations)[^\d]*([\d,]+)",
    }
    results = {}
    text_lower = text.lower()
    for key, pattern in patterns.items():
        match = re.search(pattern, text_lower)
        if match:
            results[key] = float(match.group(1).replace(",", ""))
        else:
            results[key] = None
    return results

# make a function that takes in the financial data and calculates a risk score, tier and reccomendation
def score_from_financials(data: dict, business_name: str) -> dict:
    score = 50

    if data["net_income"] is not None:
        if data["net_income"] > 0:
            score -= 20
        else:
            score += 30

    if data["revenue"] and data["total_debt"]:
        debt_ratio = data["total_debt"] / data["revenue"]
        if debt_ratio > 2:
            score += 20
        elif debt_ratio < 0.5:
            score -= 10

    if data["cash"] and data["total_debt"]:
        if data["cash"] > data["total_debt"]:
            score -= 15

    score = max(0, min(100, score))

    if score < 40:
        tier = "low"
        recommendation = "approve"
    elif score < 70:
        tier = "medium"
        recommendation = "review"
    else:
        tier = "high"
        recommendation = "reject"

    findings = []
    for k, v in data.items():
        if v is not None:
            findings.append(f"{k.replace('_', ' ').title()}: ${v:,.0f}")
    if not findings:
        findings = ["No structured financial data found in document"]

    return {
        "business_name": business_name,
        "risk_score": score,
        "risk_tier": tier,
        "recommendation": recommendation,
        "key_findings": findings,
        "summary": f"{business_name} has a {tier} risk score of {score}/100. Recommendation: {recommendation}.",
        "raw_data": data
    }

# make a function that takes in a PDF file, extracts the text, and returns the financial data and risk assessment
@app.post("/analyze-pdf")
async def analyze_pdf(file: UploadFile = File(...)):
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

    financials = extract_financials(text)
    result = score_from_financials(financials, business_name)

    global next_id
    result["id"] = next_id
    next_id += 1
    application_data[result["id"]] = result

    return result


# create an endpoint to apply for credit based on the document analysis, this will take in the same information as the DocumentRequest model, calculate a credit score and risk tier, and return a response with the application ID, status, credit score, and risk tier
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



# create a function to calculate a credit score based on the information provided in the DocumentRequest model, this is a simple scoring algorithm for demonstration purposes and can be adjusted to be more complex and accurate based on real-world credit scoring models
def calculate_credit_score(application: DocumentRequest):
    score = 700
    # Adjust score based on annual revenue
    if application.annual_revenue < 100000:
        score -= 50
    # Adjust score based on years in business
    if application.years_in_business < 2:
        score -= 50
    # Adjust score based on outstanding debt
    if application.outstanding_debt > 50000:
        score -= 50
    # Adjust score based on missed payments
    if application.missed_payments > 3:
        score -= 50
    # Ensure score does not go below 300
    return max(score, 300)


# create a function to determine the risk tier based on the credit score, this is a simple categorization for demonstration purposes and can be adjusted to be more complex and accurate based on real-world credit risk assessment models
def get_risk_tier(credit_score: int):
    # Determine risk tier based on credit score
    if credit_score >= 650:
        return "low"
    elif credit_score >= 550:
        return "medium"
    else:
        return "high"
    
# create an endpoint to list all applications and their data, this is for demonstration purposes and in a real-world application you would want to implement proper authentication and authorization to protect sensitive application data
@app.get("/applications")
def list_applications():
    return application_data



        



