"""
RRE Telegram Resume Bot - Fixed for Groups
============================================
- Works in Telegram groups
- Matches your sheet structure (headers in row 2)
- Receives resumes via Telegram (PDF, DOC, DOCX)
- OpenAI analyzes and extracts candidate info
- Stores in Google Sheets (newest at top - row 3)
- Chatbot for queries

INSTALL:
  pip install python-telegram-bot gspread google-auth openai PyPDF2 python-docx

RUN:
  python main.py
"""

import os
import sys
import json
import logging
import re
from datetime import datetime, date
from io import BytesIO

import gspread
import openai
from google.oauth2.service_account import Credentials
from telegram import Update
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    filters,
    ContextTypes,
)

# PDF parsing
try:
    import PyPDF2
    HAS_PDF = True
except ImportError:
    HAS_PDF = False
    print("WARNING: PyPDF2 not installed. Run: pip install PyPDF2")

# DOCX parsing
try:
    import docx
    HAS_DOCX = True
except ImportError:
    HAS_DOCX = False
    print("WARNING: python-docx not installed. Run: pip install python-docx")

# PDF report generation
try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet
    HAS_REPORTLAB = True
except ImportError:
    HAS_REPORTLAB = False
    print("WARNING: reportlab not installed. Run: pip install reportlab")

# ─────────────────────────────────────────────
#  CONFIG
# ─────────────────────────────────────────────
TELEGRAM_BOT_TOKEN = "8487733387:AAFViAfeDPDnMUoOZReq4NJr-XZ4LDrC_gY"

SPREADSHEET_ID = "1sdC6VSvyigGLIZPrByei-ZEQRtxEoH0hdf94xSaMdec"
SHEET_NAME = "Candidates"

DRIVE_FOLDER_ID = "1724bX3ASsAsuE70aP3BDJ821t1wCFR39"
DOC_ID = "1_0n0qhdCx0HMyA0l-GqH9sPjLRlBLfHDgpVKFzYjlBs"

OPENAI_API_KEY = (
    "sk-proj-iEIvU6lHEA3gyNGQUdvwiE9sD69tt-Qd196iSEe_0BgqJbuUUkPCs4xIe230"
    "PLSXGzIPUNhCJzT3BlbkFJupSfAKiy78XG6w4v_TaPDSyEofyZxV-V9pysTF_IEfIo_"
    "zoaL7wEiMqMem_dBYmVeaYHHoFJsA"
)

GOOGLE_SA = {
    "type": "service_account",
    "project_id": "rre-gift-website",
    "private_key_id": "28bd6c93bc8edf74743b86be716beb092628ab9e",
    "private_key": (
        "-----BEGIN PRIVATE KEY-----\n"
        "MIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQDHC8Fk/KcXwptG\n"
        "GYEdEzTzv5ivNm95ShTtQ7++LueycotDCThryRzGKTplOGek7gImnfi1wycm1fh7\n"
        "1juFTYmtgC+qi8rKxYbvFnigO7X7twXk1Vkzdsc0k0xkRSEF/Fphu0WYfZXmg50X\n"
        "l0hZY5MsiFN25Wb67db+sxDHtSvIt0ncyakipfvW0wnY+WwzwUUQWEv1ZqFZSgCw\n"
        "B9pXuoNpWOKXnjGFLvVluQWhqv4bfjkH6/uKE2lrxUIjWGDsLZK1iRFYLmmSrb6p\n"
        "NLeQ5mzcp1VcflnQA2ianlFJFnt0FLfeLWhb+lA/RJq8ynuJ/K6fCfNfiuXSG3Rc\n"
        "YYYhL7sRAgMBAAECggEAEgyOFyD06unl6Bugclk/RDoTt5GlVpeB4cjyrmV086DA\n"
        "4Y2IvPdh4VM0PSD5/wHpFoTdHGhLmNEuxNX2lD4ldaLpz5p5A12ZgH0mZ4s6k45z\n"
        "XZ5+BfVnl2wi8XW2SqNpM7MGWs9KhDpbiJvafuaRXiinfuDK74aZKAPnSeCzDXJu\n"
        "altVTbmUNBbGFSQ7/vCGyw/RW3a65NL1pSIqukYpDfoAKb1zdhqFXvHxjiGRAFC7\n"
        "RkGgqzxUpbJMPKg7Cg22Q+m2VavV1Ey7DrEOIuLQXnccKRm0qjAyXshaB9YtrI+X\n"
        "moGaZLwNzwyERVn0eIgiB9kMOiQ/nQ91+1yn0XxWcQKBgQDrKvfSSCNoNeAJ0E2m\n"
        "A2+GnOV/fiP3RYvtcTpp4gyAiQwy9TQukvaVLbkhpdGto+iWPhRF/tyLfDFIVOTi\n"
        "O7fiCsxczTEweE4mgSjstbeILPC6ZB4CtFShWTtFv0xpvEDGW0olIKowtDPys53x\n"
        "5Q1qX7Vg/ggy9rTe6W+rj09pmQKBgQDYraFkOKaSOLD/abNcVt91pVahHhi5PPag\n"
        "czQvgwcityhw4aLw1yWKjgiipHinLUa2s55lwk+Lc5/TNfUeNF0UOZKu3JewW5nq\n"
        "vV68M5dukOnlC0WLl5SFHEmVW3NEZkJzwKF3O8R+6a6WRZ+xKGoAxxuerqRoIB4B\n"
        "vkKbHv34OQKBgQC0EMmDDNN3ptDuEr5x4G2T0Cz16xsU6f6Th8BndLuH6+gYWKJl\n"
        "Cwid/02jEvmzEC82Y0BYvCYY87Y0oTREed95yDTk1gTVDTkhyIISha2LKoYE4kYM\n"
        "YhHvHYkCBdE3oPqkJyBlv1YxRroEGz5UCsOz8KbMJpcWlsq1aF6mKWxv+QKBgQCY\n"
        "EmRvHoNppHg1Ck5jxGTZAM2oDqNzfqHpQnGh1ugvKTUs5G+jcJxcfgr5e01ip5g1\n"
        "qiLFcHa7fM7zQa9jH4UkKLQWHaQolmGUKoxOsjbZ1sMRibOpoR0Pvya1uJVRsCN7\n"
        "cfrg4AWsvP1XYk4N3DtpiFSOLiwdGE13E71TeZDtoQKBgQDXjudLoU1wuG63+aOK\n"
        "lSJzBjmrtr+EORnRVBFan7eVYocnBUtsRPKQd3m8iNmhhGJPnxmUf9yGrsJBzwbi\n"
        "lHwBG2Kt7oH8NbZdf+env2hb1q+KN7CxaoWEVprHAupuzjCoPzRFruJyZf+KHA8H\n"
        "KeN9GNSgHsOorSAAxfQNM8h6Iw==\n"
        "-----END PRIVATE KEY-----\n"
    ),
    "client_email": "rre-corp-gift@rre-gift-website.iam.gserviceaccount.com",
    "client_id": "101882928938270679752",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": (
        "https://www.googleapis.com/robot/v1/metadata/x509/"
        "rre-corp-gift%40rre-gift-website.iam.gserviceaccount.com"
    ),
    "universe_domain": "googleapis.com",
}

SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

# Your sheet columns (Row 2 headers)
HEADERS = ["time stamp", "name", "contact number", "email id", "role", "experience", "education", "location", "short notes"]

# ─────────────────────────────────────────────
#  LOGGING
# ─────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[
        logging.FileHandler("resume_bot.log", encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger("ResumeBot")

# ─────────────────────────────────────────────
#  GOOGLE SHEETS
# ─────────────────────────────────────────────
def get_credentials():
    return Credentials.from_service_account_info(GOOGLE_SA, scopes=SCOPES)


def get_sheet() -> gspread.Worksheet:
    """Get the Candidates worksheet."""
    gc = gspread.authorize(get_credentials())
    wb = gc.open_by_key(SPREADSHEET_ID)

    try:
        ws = wb.worksheet(SHEET_NAME)
    except gspread.WorksheetNotFound:
        ws = wb.add_worksheet(SHEET_NAME, rows=5000, cols=15)
        log.info(f"Created sheet: {SHEET_NAME}")
        ws.update(range_name="A2:I2", values=[HEADERS], value_input_option="RAW")

    return ws


def add_candidate(data: dict) -> bool:
    """Insert candidate at row 3 (after row 2 headers, newest first)."""
    try:
        ws = get_sheet()

        row = [
            datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            data.get("name", ""),
            format_phone(data.get("contact_number", "")),
            data.get("email", ""),
            data.get("role", ""),
            data.get("experience", ""),
            data.get("education", ""),
            data.get("location", ""),
            data.get("short_notes", ""),
        ]

        ws.insert_row(values=row, index=3, value_input_option="RAW")
        log.info(f"Added candidate: {data.get('name', 'Unknown')}")
        return True

    except Exception as e:
        log.error(f"Error adding candidate: {e}")
        return False


def format_phone(raw: str) -> str:
    """Format phone number with country code."""
    if not raw:
        return ""

    digits = re.sub(r"[^\d]", "", str(raw).strip())
    if not digits:
        return ""

    if digits.startswith("00"):
        digits = digits[2:]

    CC_MAP = {
        "971": ("+971", 9),
        "966": ("+966", 9),
        "965": ("+965", 8),
        "974": ("+974", 8),
        "91": ("+91", 10),
    }

    for cc_digits in sorted(CC_MAP.keys(), key=len, reverse=True):
        if digits.startswith(cc_digits):
            prefix, local_len = CC_MAP[cc_digits]
            local = digits[len(cc_digits):]
            if len(local) >= local_len - 1:
                return f"{prefix}-{local}"

    if len(digits) == 10:
        return f"+91-{digits}"

    return f"+{digits}"


def get_all_candidates() -> list:
    """Get all candidate rows from sheet (skip rows 1-2 headers)."""
    try:
        ws = get_sheet()
        rows = ws.get_all_values()
        return rows[2:] if len(rows) > 2 else []
    except Exception as e:
        log.error(f"Error getting candidates: {e}")
        return []


def check_duplicate(email: str, phone: str, name: str) -> tuple:
    """Check if candidate already exists. Returns (is_duplicate, match_reason)."""
    candidates = get_all_candidates()

    email = email.strip().lower() if email else ""
    phone = re.sub(r"[^\d]", "", str(phone)) if phone else ""
    name = name.strip().lower() if name else ""

    for row in candidates:
        if len(row) < 5:
            continue

        existing_phone = re.sub(r"[^\d]", "", str(row[2])) if len(row) > 2 else ""
        existing_email = str(row[3]).strip().lower() if len(row) > 3 else ""
        existing_name = str(row[1]).strip().lower() if len(row) > 1 else ""

        if email and existing_email and email == existing_email:
            log.info(f"Duplicate found - Email match: {email}")
            return (True, f"Email already exists: {email}")

        if phone and existing_phone and len(phone) >= 8:
            if phone[-8:] == existing_phone[-8:]:
                log.info(f"Duplicate found - Phone match: {phone}")
                return (True, f"Phone number already exists: {row[2]}")

        if name and existing_name and name == existing_name:
            log.warning(f"Same name found: {name}")

    return (False, "")


def get_today_count() -> int:
    """Count candidates added today."""
    today = date.today().strftime("%Y-%m-%d")
    candidates = get_all_candidates()
    return sum(1 for row in candidates if row and row[0].startswith(today))


def get_total_count() -> int:
    """Get total candidate count."""
    return len([r for r in get_all_candidates() if any(c.strip() for c in r)])


def search_candidates(query: str) -> list:
    """Search candidates by name, role, or location."""
    query = query.lower().strip()
    candidates = get_all_candidates()
    results = []

    for row in candidates:
        if len(row) >= 5:
            searchable = f"{row[1]} {row[4]} {row[7]}".lower()
            if query in searchable:
                results.append(row)

    return results[:10]


# ─────────────────────────────────────────────
#  DOCUMENT PARSING
# ─────────────────────────────────────────────
def extract_text_from_pdf(file_bytes: bytes) -> str:
    if not HAS_PDF:
        log.error("PyPDF2 not installed!")
        return ""
    try:
        reader = PyPDF2.PdfReader(BytesIO(file_bytes))
        text = ""
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
        log.info(f"Extracted {len(text)} chars from PDF")
        return text.strip()
    except Exception as e:
        log.error(f"PDF extraction error: {e}")
        return ""


def extract_text_from_docx(file_bytes: bytes) -> str:
    if not HAS_DOCX:
        log.error("python-docx not installed!")
        return ""
    try:
        doc = docx.Document(BytesIO(file_bytes))
        text = "\n".join([para.text for para in doc.paragraphs])
        log.info(f"Extracted {len(text)} chars from DOCX")
        return text.strip()
    except Exception as e:
        log.error(f"DOCX extraction error: {e}")
        return ""


def extract_text_from_file(file_bytes: bytes, filename: str) -> str:
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    log.info(f"Extracting text from {filename} (type: {ext})")

    if ext == "pdf":
        return extract_text_from_pdf(file_bytes)
    elif ext in ("docx", "doc"):
        return extract_text_from_docx(file_bytes)
    elif ext == "txt":
        return file_bytes.decode("utf-8", errors="ignore")
    return ""


# ─────────────────────────────────────────────
#  OPENAI ANALYSIS
# ─────────────────────────────────────────────
openai.api_key = OPENAI_API_KEY


def analyze_resume(text: str) -> dict:
    """Use OpenAI to extract candidate information from resume text."""
    if not text or len(text.strip()) < 50:
        log.warning("Resume text too short or empty")
        return {}

    log.info(f"Sending to OpenAI for analysis ({len(text)} chars)...")

    try:
        response = openai.chat.completions.create(
            model="gpt-4o",
            messages=[{
                "role": "user",
                "content": f"""You are a resume parser. Extract candidate information from the resume text below.

IMPORTANT: Return ONLY a valid JSON object, no markdown, no explanation.

JSON format required:
{{
  "name": "Full Name",
  "contact_number": "Phone number with country code",
  "email": "email@example.com",
  "role": "Job title or position",
  "experience": "Years and summary",
  "education": "Highest qualification",
  "location": "City, Country",
  "short_notes": "Brief 1-2 sentence summary"
}}

If a field is not found, use empty string "".

RESUME TEXT:
{text[:5000]}"""
            }],
            temperature=0.1,
            max_tokens=800,
        )

        result = response.choices[0].message.content.strip()
        log.info(f"OpenAI raw response: {result[:500]}")

        clean_result = result
        if "```json" in clean_result:
            clean_result = clean_result.split("```json")[1]
        if "```" in clean_result:
            clean_result = clean_result.split("```")[0]
        clean_result = clean_result.strip()

        if not clean_result.startswith("{"):
            start = clean_result.find("{")
            end = clean_result.rfind("}") + 1
            if start >= 0 and end > start:
                clean_result = clean_result[start:end]

        data = json.loads(clean_result)
        log.info(f"Parsed candidate: {data.get('name', 'NO NAME')} | {data.get('email', 'NO EMAIL')}")
        return data

    except json.JSONDecodeError as e:
        log.error(f"JSON parse error: {e}")
        return {}
    except Exception as e:
        log.error(f"OpenAI error: {e}")
        return {}


def generate_pdf_report() -> str:
    """Generate a PDF report of candidates and return file path."""
    if not HAS_REPORTLAB:
        log.error("reportlab not installed")
        return ""

    try:
        candidates = get_all_candidates()
        today = date.today().strftime("%Y-%m-%d")
        filename = f"candidates_report_{today}.pdf"

        doc = SimpleDocTemplate(filename, pagesize=landscape(A4))
        elements = []
        styles = getSampleStyleSheet()

        elements.append(Paragraph("<b>RRE Candidates Report</b>", styles['Title']))
        elements.append(Paragraph(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}", styles['Normal']))
        elements.append(Paragraph(f"Total Candidates: {len(candidates)}", styles['Normal']))
        elements.append(Spacer(1, 20))

        headers = ["#", "Name", "Contact", "Email", "Role", "Location"]
        table_data = [headers]

        for i, row in enumerate(candidates[:50], 1):
            table_data.append([
                str(i),
                row[1] if len(row) > 1 else "",
                row[2] if len(row) > 2 else "",
                row[3] if len(row) > 3 else "",
                row[4] if len(row) > 4 else "",
                row[7] if len(row) > 7 else "",
            ])

        table = Table(table_data, repeatRows=1)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.darkgreen),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.lightgrey]),
        ]))

        elements.append(table)
        doc.build(elements)

        log.info(f"PDF report generated: {filename}")
        return filename

    except Exception as e:
        log.error(f"PDF generation error: {e}")
        return ""


def chat_with_ai(question: str) -> str:
    """Use OpenAI for general conversation."""
    try:
        response = openai.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a helpful HR assistant for RRE company. Be friendly and concise."},
                {"role": "user", "content": question}
            ],
            temperature=0.7,
            max_tokens=500,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        log.error(f"Chat AI error: {e}")
        return "Sorry, I couldn't process that. Please try again."


def answer_query(question: str) -> tuple:
    """Answer user queries. Returns (response_text, pdf_path or None)."""
    q = question.lower().strip()

    # PDF report requests
    if any(w in q for w in ["report", "pdf", "download", "export"]):
        pdf_path = generate_pdf_report()
        if pdf_path:
            return ("Here's your candidates report!", pdf_path)
        else:
            return ("Could not generate PDF. Install reportlab: `pip install reportlab`", None)

    # Today's count
    if any(w in q for w in ["today", "aaj"]) and any(w in q for w in ["how many", "count", "candidate", "resume"]):
        count = get_today_count()
        return (f"*Today's candidates:* {count}", None)

    # Total count
    if any(w in q for w in ["total", "all", "sab"]) and any(w in q for w in ["candidate", "resume", "how many"]):
        count = get_total_count()
        return (f"*Total candidates:* {count}", None)

    # List all roles
    if any(w in q for w in ["role", "roles", "position", "positions"]):
        candidates = get_all_candidates()
        roles = {}
        for row in candidates:
            if len(row) > 4 and row[4].strip():
                role = row[4].strip()
                roles[role] = roles.get(role, 0) + 1

        if roles:
            response = "*Roles in database:*\n\n"
            for role, count in sorted(roles.items(), key=lambda x: -x[1])[:15]:
                response += f"- {role}: {count}\n"
            return (response, None)
        return ("No roles found in database.", None)

    # Search by name/role/location
    if any(w in q for w in ["find", "search", "show", "list", "who"]):
        for word in ["find", "search", "show", "list", "for", "named", "called"]:
            q = q.replace(word, " ")
        search_term = q.strip().split()[0] if q.strip() else ""

        if search_term and len(search_term) > 1:
            results = search_candidates(search_term)
            if results:
                response = f"Found {len(results)} candidates for '{search_term}':\n\n"
                for r in results[:5]:
                    name = r[1] if len(r) > 1 else "?"
                    role = r[4] if len(r) > 4 else "?"
                    phone = r[2] if len(r) > 2 else "?"
                    response += f"*{name}*\n  {role}\n  {phone}\n\n"
                return (response, None)
            return (f"No candidates found for '{search_term}'", None)

    # Stats
    if any(w in q for w in ["stats", "statistics", "summary", "status"]):
        total = get_total_count()
        today = get_today_count()
        candidates = get_all_candidates()

        roles = {}
        for row in candidates:
            if len(row) > 4 and row[4].strip():
                role = row[4].strip()[:30]
                roles[role] = roles.get(role, 0) + 1

        top_roles = sorted(roles.items(), key=lambda x: -x[1])[:5]
        roles_text = "\n".join([f"  - {r}: {c}" for r, c in top_roles])

        return (f"""*Database Statistics*

Total Candidates: *{total}*
Added Today: *{today}*

*Top Roles:*
{roles_text}

[Open Sheet](https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID})""", None)

    # Greetings
    if q in ["hi", "hello", "hey", "hii", "helo", "hai"]:
        return ("Hello! I'm your RRE Resume Bot. Send me a resume or ask about candidates!", None)

    if q in ["thanks", "thank you", "thx"]:
        return ("You're welcome! Let me know if you need anything else.", None)

    # General AI chat
    ai_response = chat_with_ai(question)
    return (ai_response, None)


# ─────────────────────────────────────────────
#  TELEGRAM HANDLERS
# ─────────────────────────────────────────────
async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    log.info(f"/start from {user.first_name} (ID: {user.id})")

    welcome = """*Welcome to RRE Resume Bot!*

*Send me a resume* (PDF, DOCX) and I'll:
- Extract candidate details
- Save to Google Sheet
- Confirm the entry

*Ask me:*
- How many candidates today?
- Total candidates
- Find [name]
- Stats

/help for more info"""

    await update.message.reply_text(welcome, parse_mode="Markdown")


async def stats_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    log.info(f"/stats from {update.effective_user.first_name}")
    total = get_total_count()
    today = get_today_count()

    stats = f"""*Resume Statistics*

Total Candidates: *{total}*
Added Today: *{today}*

[Open Sheet](https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID})"""

    await update.message.reply_text(stats, parse_mode="Markdown", disable_web_page_preview=True)


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    log.info(f"/help from {update.effective_user.first_name}")
    help_text = """*Resume Bot Help*

*Send files:* PDF, DOCX, DOC, TXT

*Ask questions:*
- "How many candidates today?"
- "Total candidates"
- "Find Ahmed"
- "What roles"
- "Stats"
- "Report" (get PDF)

*Commands:*
/start - Welcome message
/stats - Quick statistics
/check - Find duplicates in database
/help - This help

*Features:*
- Auto-extracts candidate info
- Saves to Google Sheet
- Detects duplicate entries
- Generates PDF reports
- Normal chat support"""

    await update.message.reply_text(help_text, parse_mode="Markdown")


async def check_duplicates_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    log.info(f"/check from {update.effective_user.first_name}")

    await update.message.reply_text("Scanning for duplicates...")

    candidates = get_all_candidates()
    emails = {}
    phones = {}
    duplicates = []

    for i, row in enumerate(candidates):
        if len(row) < 5:
            continue

        name = row[1] if len(row) > 1 else ""
        phone = re.sub(r"[^\d]", "", str(row[2])) if len(row) > 2 else ""
        email = str(row[3]).strip().lower() if len(row) > 3 else ""

        if email:
            if email in emails:
                duplicates.append(f"*{name}* - Same email as *{emails[email]}*")
            else:
                emails[email] = name

        if phone and len(phone) >= 8:
            phone_key = phone[-8:]
            if phone_key in phones:
                duplicates.append(f"*{name}* - Same phone as *{phones[phone_key]}*")
            else:
                phones[phone_key] = name

    if duplicates:
        response = f"*Found {len(duplicates)} potential duplicates:*\n\n"
        response += "\n".join(duplicates[:20])
        if len(duplicates) > 20:
            response += f"\n\n_{len(duplicates) - 20} more not shown_"
    else:
        response = "*No duplicates found!* Database is clean."

    await update.message.reply_text(response, parse_mode="Markdown")


async def handle_document(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle document/file uploads - works in groups and direct messages."""
    document = update.message.document
    if not document:
        return

    filename = document.file_name or "unknown"
    user = update.effective_user

    log.info(f"DOCUMENT RECEIVED: {filename} from {user.first_name} (ID: {user.id})")

    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    if ext not in ("pdf", "doc", "docx", "txt"):
        await update.message.reply_text(f"Please send PDF, DOCX, or TXT file.\nReceived: .{ext}")
        return

    processing_msg = await update.message.reply_text("Processing resume...")

    try:
        file = await document.get_file()
        file_bytes = await file.download_as_bytearray()
        log.info(f"Downloaded {len(file_bytes)} bytes")

        text = extract_text_from_file(bytes(file_bytes), filename)

        if not text or len(text.strip()) < 50:
            await processing_msg.edit_text(
                f"Could not extract text from {filename}\n\n"
                "Make sure the PDF is not scanned/image-based."
            )
            return

        data = analyze_resume(text)

        if not data:
            await processing_msg.edit_text("Could not parse resume. Please try another file.")
            return

        if not data.get("name"):
            name_from_file = filename.replace(".pdf", "").replace(".docx", "").replace("CV_", "").replace("_", " ")
            data["name"] = name_from_file

        is_duplicate, duplicate_reason = check_duplicate(
            email=data.get("email", ""),
            phone=data.get("contact_number", ""),
            name=data.get("name", "")
        )

        if is_duplicate:
            await processing_msg.edit_text(
                f"*Duplicate Candidate Detected!*\n\n"
                f"*Name:* {data.get('name', '-')}\n"
                f"*Reason:* {duplicate_reason}\n\n"
                f"_This resume was not added to avoid duplicates._",
                parse_mode="Markdown"
            )
            log.info(f"Skipped duplicate: {data.get('name')} - {duplicate_reason}")
            return

        success = add_candidate(data)

        if success:
            phone = format_phone(data.get("contact_number", ""))
            response = f"""*Resume Saved!*

*Name:* {data.get('name', '-')}
*Contact:* {phone or 'Not found'}
*Email:* {data.get('email', '-')}
*Role:* {data.get('role', '-')}
*Experience:* {data.get('experience', '-')}
*Education:* {data.get('education', '-')}
*Location:* {data.get('location', '-')}

*Notes:* {data.get('short_notes', '-')}"""

            await processing_msg.edit_text(response, parse_mode="Markdown")
            log.info(f"Successfully processed: {data.get('name')}")
        else:
            await processing_msg.edit_text("Error saving to Google Sheet. Please try again.")

    except Exception as e:
        log.error(f"Document handling error: {e}", exc_info=True)
        await processing_msg.edit_text(f"Error: {str(e)[:100]}")


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle text messages."""
    if not update.message or not update.message.text:
        return

    text = update.message.text.strip()
    user = update.effective_user

    if len(text) < 2:
        return

    log.info(f"Message from {user.first_name}: {text[:50]}")

    response, pdf_path = answer_query(text)

    if pdf_path:
        try:
            await update.message.reply_text(response, parse_mode="Markdown")
            with open(pdf_path, 'rb') as pdf_file:
                await update.message.reply_document(
                    document=pdf_file,
                    filename=pdf_path,
                    caption="Candidates Report"
                )
            os.remove(pdf_path)
        except Exception as e:
            log.error(f"Error sending PDF: {e}")
            await update.message.reply_text(f"Error sending PDF: {e}")
    else:
        await update.message.reply_text(response, parse_mode="Markdown", disable_web_page_preview=True)


async def handle_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    log.info(f"Photo received from {update.effective_user.first_name}")
    await update.message.reply_text(
        "Please send the resume as a *file*, not a photo.\n\nTap attachment > File > Select resume",
        parse_mode="Markdown"
    )


# ─────────────────────────────────────────────
#  MAIN
# ─────────────────────────────────────────────
def main():
    log.info("Starting RRE Resume Bot...")

    if not HAS_PDF:
        log.warning("PyPDF2 not installed - PDF parsing won't work!")
    if not HAS_DOCX:
        log.warning("python-docx not installed - DOCX parsing won't work!")

    try:
        ws = get_sheet()
        log.info(f"Connected to Google Sheet: {SHEET_NAME}")
    except Exception as e:
        log.error(f"Sheet error: {e}")
        sys.exit(1)

    app = Application.builder().token(TELEGRAM_BOT_TOKEN).build()

    app.add_handler(CommandHandler("start", start_command))
    app.add_handler(CommandHandler("stats", stats_command))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(CommandHandler("check", check_duplicates_command))
    app.add_handler(MessageHandler(filters.Document.ALL, handle_document))
    app.add_handler(MessageHandler(filters.PHOTO, handle_photo))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    log.info("Bot is running! Press Ctrl+C to stop.")
    app.run_polling(allowed_updates=Update.ALL_TYPES, drop_pending_updates=True)


if __name__ == "__main__":
    main()
