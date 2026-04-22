from fastapi import FastAPI, UploadFile, File
from pydantic import BaseModel
from dotenv import load_dotenv
import os
import pdfplumber
import google.generativeai as genai
import json
import io

#load dotenv to access environment variables
load_dotenv()

# Configure the Gemini API client with the API key from environment variables
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-1.5-flash")

# Initialize FastAPI app
app = FastAPI()

application_data = {}
next_id = 1

# Create a class to represent the document request
class DocumentRequest(BaseModel):
    business_name: str
    annual_revenue: float
    years_in_business: int
    outstanding_debt: float
    missed_payments: int

@app.get("/")
def root():
    return("Welcome to the Credit Risk Assesment API")

@app.post("/analyze-pdf")
async def analyze_pdf(file: UploadFile = File(...)):
    content = await file.read()

    with pdfplumber.open(io.BytesIO(content)) as pdf:
        text = ""
        for page in pdf.pages:
            text += page.extract_text()
            
    if not text.strip():
        return {"error": "No text found in the PDF."}

    prompt = f""" You are a senior credit risk analyst, analyze the following business information and provide a credit risk assessment. Return said credit risk assessment only as a JSON, with no extra text or markdown.
    The JSON must have these fields only:
        {{
        "business_name": "name of the business or Unknown",
        "risk_score": a number from 0 to 100 where 100 is highest risk,
        "risk_tier": "low" or "medium" or "high",
        "key_findings": ["finding 1", "finding 2", "finding 3"],
        "recommendation": "approve" or "review" or "reject",
        "summary": "2-3 sentence plain English explanation of the risk"
        }}

    Financial Document:
    {text[:4000]}
    """
    response = model.generate_content(prompt)

    raw = response.text.strip()
    raw = raw.replace("```json", "").replace("```", "").strip()
    result = json.loads(raw)

    global next_id
    application_id = next_id
    next_id += 1
    application_data[result["id"]] = result

    return result


    
        



