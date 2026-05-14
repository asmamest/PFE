from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

import traceback
import os

from app.services.gemini_extractor import extract_document_data
from app.utils.file_handler import save_uploaded_file
from app.models.response_model import ExtractionResponse

# =========================================================
# FASTAPI APP
# =========================================================

app = FastAPI(
    title="Document AI API",
    description="AI-powered document extraction service using Gemini",
    version="1.0.0"
)

# =========================================================
# CORS CONFIGURATION
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Change in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================================================
# HEALTH CHECK
# =========================================================

@app.get("/")
def root():

    return {
        "status": "ok",
        "service": "Document AI API",
        "version": "1.0.0"
    }


# =========================================================
# EXTRACT ENDPOINT
# =========================================================

@app.post("/extract", response_model=ExtractionResponse)
async def extract_document(file: UploadFile = File(...)):

    try:

        print("\n========================================")
        print("📥 NEW FILE RECEIVED")
        print("========================================")

        print("📄 Filename:", file.filename)
        print("📦 Content-Type:", file.content_type)

        # -------------------------------------------------
        # SAVE FILE
        # -------------------------------------------------

        file_path = save_uploaded_file(file)

        print("💾 File saved successfully")
        print("📁 Path:", file_path)

        # -------------------------------------------------
        # VALIDATE FILE
        # -------------------------------------------------

        if not os.path.exists(file_path):

            raise FileNotFoundError(
                f"File not found after saving: {file_path}"
            )

        print("✅ File exists")

        # -------------------------------------------------
        # GEMINI EXTRACTION
        # -------------------------------------------------

        print("🤖 Sending document to Gemini...")

        extracted_data = extract_document_data(file_path)

        print("✅ Extraction completed successfully")

        # -------------------------------------------------
        # SUCCESS RESPONSE
        # -------------------------------------------------

        return ExtractionResponse(
            success=True,
            filename=file.filename,
            data=extracted_data
        )

    except Exception as e:

        print("\n========================================")
        print("❌ ERROR OCCURRED IN /extract")
        print("========================================")

        traceback.print_exc()

        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "filename": file.filename if file else None,
                "error": str(e),
                "type": type(e).__name__
            }
        )