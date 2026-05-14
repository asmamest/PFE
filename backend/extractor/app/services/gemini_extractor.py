from google import genai
from PIL import Image
from dotenv import load_dotenv

import os
import json

load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")

client = genai.Client(api_key=API_KEY)


PROMPT = """
Analyze this document carefully and extract ALL relevant information dynamically.

The document type may vary:
- identity card
- passport
- diploma
- certificate
- invoice
- driving license
- administrative document
- or any other official document

Instructions:
- Detect the document structure automatically.
- Identify and extract ALL meaningful fields dynamically based on the document content.
- Do NOT use fixed predefined keys.
- Generate appropriate field names according to the detected information.
- Preserve the original language of the content.
- If a value is missing or unclear, return null.
- Keep dates, numbers, and identifiers exactly as written.
- Organize the response in clean JSON.
- Return ONLY valid JSON.
"""


def extract_document_data(image_path: str):

    image = Image.open(image_path)

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[
            PROMPT,
            image
        ]
    )

    cleaned_response = response.text.strip()

    # Remove markdown if Gemini returns ```json
    cleaned_response = cleaned_response.replace("```json", "")
    cleaned_response = cleaned_response.replace("```", "")

    try:
        parsed_json = json.loads(cleaned_response)
        return parsed_json

    except Exception:
        return {
            "raw_response": cleaned_response
        }