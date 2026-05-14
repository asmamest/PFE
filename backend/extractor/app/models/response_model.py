from pydantic import BaseModel
from typing import Dict, Any


class ExtractionResponse(BaseModel):

    success: bool
    filename: str
    data: Dict[str, Any]