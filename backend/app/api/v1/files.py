"""
File & Document Processing Endpoints.
Handles PDF, DOCX, TXT, CSV, JSON parsing and extraction.
"""

from fastapi import APIRouter, Depends, UploadFile, File
from app.core.security import get_current_user
from app.core.rate_limit import rate_limiter
from app.models.schemas import UserProfile, FileExtractResponse
from app.services.file_service import file_service
from app.services.usage_service import usage_service

router = APIRouter(prefix="/files", tags=["File & Document Assistant"])


@router.post("/extract", response_model=FileExtractResponse)
async def extract_document_text(
    file: UploadFile = File(...),
    current_user: UserProfile = Depends(get_current_user)
):
    """
    Extracts text from uploaded documents (PDF, DOCX, TXT, CSV, JSON, MD).
    """
    rate_limiter.check_rate_limit(current_user.id)

    text, file_type, size_bytes = await file_service.process_document(file)

    words = text.split()
    word_count = len(words)
    char_count = len(text)

    # Generate summary preview of first 300 characters
    summary_preview = text[:300].strip() + ("..." if len(text) > 300 else "")

    usage_service.record_usage(
        user_id=current_user.id,
        operation_type="file_parse",
        model="document-parser",
        prompt_tokens=char_count // 4,
        completion_tokens=0
    )

    return FileExtractResponse(
        filename=file.filename or "uploaded_file",
        file_type=file_type,
        size_bytes=size_bytes,
        char_count=char_count,
        word_count=word_count,
        extracted_text=text,
        summary_preview=summary_preview,
        status="Extracted"
    )
