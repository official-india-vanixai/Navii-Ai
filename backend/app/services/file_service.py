"""
Document Extraction & Parsing Service for N.A.V.I.I.
Extracts structured text from PDF, DOCX, TXT, CSV, JSON, and MD files.
"""

import io
from typing import Tuple
from fastapi import HTTPException, UploadFile, status

MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB


class FileProcessingService:
    @staticmethod
    async def process_document(file: UploadFile) -> Tuple[str, str, int]:
        """
        Extracts plain text from an uploaded document.
        Returns: (extracted_text, file_extension, file_size_bytes)
        """
        contents = await file.read()
        file_size = len(contents)

        if file_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="File size exceeds maximum permitted limit (25 MB)."
            )

        filename = file.filename or "unknown"
        ext = filename.split(".")[-1].lower() if "." in filename else "txt"

        extracted_text = ""

        try:
            if ext == "pdf":
                extracted_text = FileProcessingService._extract_pdf(contents)
            elif ext in ["docx", "doc"]:
                extracted_text = FileProcessingService._extract_docx(contents)
            elif ext in ["txt", "csv", "json", "md", "py", "js", "html", "css"]:
                extracted_text = contents.decode("utf-8", errors="replace")
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Unsupported document format '.{ext}'. Supported: PDF, DOCX, TXT, CSV, JSON, MD."
                )
        except Exception as e:
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Failed to parse document contents: {str(e)}"
            )

        if not extracted_text.strip():
            extracted_text = "[Notice: Document contains no parseable text or consists exclusively of raster images.]"

        return extracted_text, ext.upper(), file_size

    @staticmethod
    def _extract_pdf(contents: bytes) -> str:
        try:
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(contents))
            text_parts = []
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    text_parts.append(text)
            return "\n\n".join(text_parts)
        except Exception as e:
            raise ValueError(f"Error reading PDF structure: {str(e)}")

    @staticmethod
    def _extract_docx(contents: bytes) -> str:
        try:
            import docx
            doc = docx.Document(io.BytesIO(contents))
            return "\n\n".join([p.text for p in doc.paragraphs if p.text.strip()])
        except Exception as e:
            # Fallback for plain doc or binary stream
            return contents.decode("utf-8", errors="ignore")


file_service = FileProcessingService()
