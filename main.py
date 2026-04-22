from fastapi import FastAPI, UploadFile, File
from pydantic import BaseModel
from dotenv import load_dotenv
from google import genai
import os
import pdfplumber
import json
import io

from typer import prompt

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

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

# create a root endpoint to verify the API is working
@app.get("/")
def root():
    return("Welcome to the Credit Risk Assesment API")

# create an endpoint to analyze the PDF and return a credit risk assessment
@app.post("/analyze-pdf")
async def analyze_pdf(file: UploadFile = File(...)):
    content = await file.read()

    # Use pdfplumber to extract text from the PDF file
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        text = ""
        for page in pdf.pages:
            text += page.extract_text()
    # If no text is extracted, return an error message  
    if not text.strip():
        return {"error": "No text found in the PDF."}
    # create a prompt for the gemini model to analyze the extracted text and return a credit risk assessment in the specified JSON format
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
    # send the prompt to the Gemini model and get the response
    response = client.models.generate_content(
    model="gemini-1.5-flash",
    contents=prompt
    )
    raw = response.text.strip()
    raw = raw.replace("```json", "").replace("```", "").strip()
    result = json.loads(raw)
    # assign next id to the application and increment the next_id variable for the next application
    global next_id
    application_id = next_id
    next_id += 1
    application_data[result["id"]] = result
    # return the credit risk assessment as a JSON response
    return result


# create an endpoint to apply for credit based on the document analysis, this will take in the same information as the DocumentRequest model, calculate a credit score and risk tier, and return a response with the application ID, status, credit score, and risk tier
@app.post("/apply")
def apply(application: DocumentRequest):
    # assign next id to the application and increment the next_id variable for the next application
    global next_id
    application_id = next_id
    next_id += 1
    # assign the application data to the application_data dictionary with the application ID as the key, and include the calculated credit score and risk tier in the application data
    application_data = application.dict()
    application_data["id"] = application_id
    application_data["status"] = "pending"
    application_data["credit score"] = calculate_credit_score(application)
    application_data["risk_tier"] = get_risk_tier(application_data["credit_score"])
    application_data[application_id] = application_data
    return {"application_id": application_id, "status": "pending", "credit_score": application_data["credit_score"], "risk_tier": application_data["risk_tier"]}



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



        



