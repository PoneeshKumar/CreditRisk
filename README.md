# CreditLens — Financial Risk Intelligence Platform

> A full-stack SaaS application that analyzes financial documents and benchmarks credit approval odds against Canada's Big 5 banks — built to solve a real problem in credit risk assessment.

**Live:** [creditlensanalyze.vercel.app](https://creditlensanalyze.vercel.app) &nbsp;|&nbsp; **Backend:** [creditlens-1zzy.onrender.com](https://creditlens-1zzy.onrender.com)

---

## The Problem

Credit risk analysis is reactive. By the time a credit team sees an NSF event or a bankruptcy filing, the exposure is already there. Existing tools alert on events — they don't predict deterioration before it becomes critical.

For individuals, the problem is opacity: applicants have no visibility into which bank will approve them, at what threshold, or why. The mortgage stress test, GDS/TDS ratios, and DTI calculations sit inside bank underwriting black boxes with no transparency for the borrower.

**CreditLens solves both problems** — one platform for business financial health tracking and personal credit approval benchmarking.

---

## What It Does

### Business Credit Analysis

Upload any financial PDF — income statements, balance sheets, cash flow statements, bank statements, or credit applications. The system auto-detects which document types are present, extracts fiscal years automatically from the document text, and scores each section independently using domain-specific financial ratios. Multiple years in a single document are detected and analyzed simultaneously — a single 10-K filing covering three fiscal years produces three independent risk scores with no manual input.

Results are stored per company in a PostgreSQL database, enabling year-over-year trend tracking. The same metrics that would have flagged Bed Bath & Beyond's deterioration — revenue declining 42% over three years, liabilities exceeding assets by $2.8B — are surfaced visually as an interactive trend chart.

### Personal Credit Analysis

Users input their financial profile and receive approval likelihood across Canada's Big 5 banks — TD, RBC, BMO, Scotiabank, and CIBC — for three product types: mortgages, lines of credit, and personal loans.

Mortgage qualification is calculated using the Bank of Canada stress test rate of 5.25%, which is the actual rate Canadian banks are legally required to use when qualifying borrowers. GDS and TDS ratios are computed and benchmarked against each bank's published underwriting thresholds. A borderline status fires when a metric sits within 10% of a bank's limit — flagging applications that would technically pass but carry elevated decline risk in practice.

Each metric includes an interactive explainer showing what it means, why lenders use it, the exact formula, threshold ranges, and Big 5 bank-specific benchmarks. The goal is financial literacy, not just data.

---

## Why I Built It This Way

### No LLM for financial parsing

The initial version used Gemini to parse and interpret PDFs. I replaced it with a rules-based extraction engine for three reasons. First, free-tier LLM APIs rate-limit under load, making the product unreliable at scale. Second, LLMs are prone to hallucinating numerical data — for a risk scoring system where a single wrong number changes an approval decision, consistency matters more than flexibility. Third, extraction runs in milliseconds with regex versus 3–8 seconds for an API round trip, which is a meaningful UX difference when analyzing a multi-year document.

### Document type detection before analysis

Each of the five analyzers only fires if the document contains the vocabulary specific to that document type. The bank statement analyzer, for example, only runs if the document contains phrases like "total deposits," "balance forward," or "nsf charge." This prevents false positives — early versions of the system were reading a restructuring expense line from BBBY's income statement as an NSF count of 330,024, because the regex was too broad. Adding keyword guards at the analyzer level fixed the issue entirely.

### Multi-year column mapping

Financial statements present multiple fiscal years side by side in columns. The extraction engine detects all four-digit years present in the document, maps them to column positions, and scores each year independently. This means a 10-K covering three years produces three separate risk assessments from a single upload, with no manual year selection required.

### Row-level security with service role separation

The backend uses the Supabase service role key, which bypasses Row Level Security, while the frontend uses the anon key, which enforces it. This means users can only read and write their own companies and analyses, there is no data leakage between accounts, and the backend can insert records on behalf of any authenticated user without needing to impersonate them. The RLS policies themselves are simple — every row in the companies and analyses tables has a user_id column, and the policy ensures you can only access rows where that column matches your authenticated identity.

### Upsert instead of insert for analyses

Re-uploading a document for the same company and fiscal year updates the existing record rather than creating a duplicate. This makes the year-over-year trend chart deterministic — the same company always shows exactly one data point per fiscal year, regardless of how many times the document is re-analyzed.

---

## Architecture

The system has three layers. The frontend is a React single-page application deployed on Vercel. The backend is a FastAPI Python server deployed on Render, responsible for PDF parsing, financial extraction, scoring, and database writes. The database layer is Supabase, which provides PostgreSQL, authentication, and Row Level Security in one managed service.

Authentication flows through Supabase Auth on the frontend. The JWT issued by Supabase is passed as a Bearer token with every API request. The FastAPI backend verifies the token without calling Supabase — it decodes the JWT directly using the PyJWT library, extracts the user ID from the payload, and scopes all database operations to that user. This avoids a network round trip to Supabase on every request.

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | React | Component model fits the multi-view dashboard architecture |
| Charts | Recharts | Composable, works well with time-series financial data |
| Backend | FastAPI | Async support for file uploads; automatic OpenAPI docs |
| PDF parsing | pdfplumber | Better text extraction than alternatives on structured financial tables |
| Database | Supabase (PostgreSQL) | Built-in auth, RLS, and REST API — no separate auth service needed |
| Auth | Supabase Auth + PyJWT | JWT verified server-side without a separate auth microservice |
| Deployment | Vercel + Render | Zero-config CI/CD on every push to main |

---

## Validated Against Real Data

The deterioration detection was tested against Bed Bath & Beyond Inc., which filed for Chapter 11 bankruptcy in April 2023.

Uploading their FY2021–FY2023 10-K filing produces the following results:

| Fiscal Year | Overall Risk Score | Net Income | Total Liabilities |
|---|---|---|---|
| FY2021 | 90/100 — High | ($150.8M) | $4.2B |
| FY2022 | 93/100 — High | ($559.6M) | $4.9B |
| FY2023 | 93/100 — High | ($3.5B) | $5.0B |

Revenue dropped 42% over three years. Liabilities exceeded assets by $2.8B by FY2023. The system correctly scored all three years as high risk with a reject recommendation — the kind of signal a credit manager should have acted on in FY2021, two years before the actual bankruptcy filing.

---

## What I Learned

### Financial domain knowledge matters as much as technical skill

Writing extraction patterns for income statements forced me to understand what GDS, TDS, and DTI actually mean, how the Bank of Canada stress test rate is applied, and why banks weight TDS more heavily than GDS. The technical implementation was straightforward — the financial research behind it was the real work. You cannot build a credible credit risk tool by treating finance as a black box.

### Regex on real-world PDFs is harder than it looks

SEC filings do not follow a consistent format. The same line item — net income — appears as net loss, net earnings, net income (loss), or income from continuing operations depending on the company, year, and accounting treatment. Building patterns that handle all cases without generating false positives required iterative testing against real documents, not synthetic examples. The BBBY NSF false positive was a direct consequence of a pattern that was too broad, and fixing it required understanding both the regex behavior and the financial statement structure that caused it.

### The difference between a demo and a product is auth

Adding Supabase authentication, row-level security, user-scoped queries, and JWT verification in FastAPI was significantly more work than the core analysis engine. But it is what makes this a real multi-user product rather than a single-user demo. Every architectural decision around auth had security implications — using the anon key on the frontend, the service role key on the backend, and scoping all queries by user ID ensures that no user can ever see another user's data, even if they know the company ID.

### Cold start latency is a real product problem

Render's free tier spins down after 15 minutes of inactivity. The first request after a cold start takes 30–50 seconds. This is acceptable for a portfolio project but would require a paid always-on instance or a keep-alive mechanism in production. Understanding the gap between free-tier infrastructure and production-grade infrastructure is itself a valuable lesson.

### System design decisions compound

Every architectural choice had downstream effects. Replacing Gemini with regex improved reliability but introduced brittleness on non-standard formats. Adding keyword guards fixed false positives but required deep knowledge of what vocabulary each document type actually contains. Choosing upsert over insert made trend charts deterministic but required a composite unique index on company and fiscal year. None of these decisions exist in isolation — each one shapes the constraints on the next.

---

## Running Locally

```bash
# Backend
pip install -r requirements.txt
# Add SUPABASE_URL and SUPABASE_KEY to .env
uvicorn main:app --reload

# Frontend
cd frontend
npm install
npm start
```

---

## Future Work

- **Weighted scoring by industry** — income statement carries more signal than bank statement for a manufacturing company; weights should reflect the industry context of the company being analyzed
- **Trend alerts** — notify users when a company's risk score increases by more than 10 points year-over-year, enabling proactive monitoring rather than reactive review
- **T4 and pay stub parsing** — auto-fill the personal credit form from uploaded tax documents, removing manual data entry entirely
- **ML scoring layer** — train a gradient boosted model on public default datasets to replace the rules-based scoring engine, with the rules-based scores as features
- **Multi-company comparison** — side-by-side risk profiles for portfolio monitoring across a credit manager's full book of business

---

*Built by Poneesh Kumar — CS + CFM @ University of Waterloo*
*[LinkedIn](https://linkedin.com/in/poneeshkumar) · [GitHub](https://github.com/PoneeshKumar/CreditRisk)*
