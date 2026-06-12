import os
import tempfile
import shutil
import openpyxl
import docx2txt

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pypdf import PdfReader
from pptx import Presentation
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
sys.path.append(str(ROOT_DIR))
from shared.config import get_settings

settings = get_settings()

# ─────────────────────────────────────────────
# Models
# ─────────────────────────────────────────────

class ExtractResponse(BaseModel):
    filename: str
    text: str
    pages: int
    file_type: str
    char_count: int

# ─────────────────────────────────────────────
# App
# ─────────────────────────────────────────────

app = FastAPI(
    title="Text Extractor Service",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def extract_pdf(path: str):
    reader = PdfReader(path)

    pages = len(reader.pages)

    text = "\n".join(
        page.extract_text() or ""
        for page in reader.pages
    )

    return text, pages


def extract_docx(path: str):
    text = docx2txt.process(path)
    return text, 1


def extract_xlsx(path: str):
    workbook = openpyxl.load_workbook(path)

    text = ""

    for sheet in workbook.worksheets:
        for row in sheet.iter_rows(values_only=True):
            values = [str(cell) for cell in row if cell is not None]

            if values:
                text += " ".join(values) + "\n"

    return text, workbook.sheetnames.__len__()


def extract_pptx(path: str):
    prs = Presentation(path)

    text = ""

    for slide in prs.slides:
        for shape in slide.shapes:
            if hasattr(shape, "text"):
                text += shape.text + "\n"

    return text, len(prs.slides)


def extract_txt(path: str):
    with open(path, "r", encoding="utf-8") as f:
        return f.read(), 1

# ─────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "text_extractor"
    }


@app.post("/extract", response_model=ExtractResponse)
@app.post("/v1/extract", response_model=ExtractResponse)
async def extract(file: UploadFile = File(...)):

    filename = file.filename
    ext = os.path.splitext(filename)[1].lower()

    supported = [
        ".pdf",
        ".docx",
        ".xlsx",
        ".pptx",
        ".txt",
        ".md"
    ]

    if ext not in supported:
        raise HTTPException(
            status_code=400,
            detail=f"Format non supporté : {ext}"
        )

    with tempfile.NamedTemporaryFile(
        delete=False,
        suffix=ext
    ) as tmp:

        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:

        if ext == ".pdf":
            text, pages = extract_pdf(tmp_path)

        elif ext == ".docx":
            text, pages = extract_docx(tmp_path)

        elif ext == ".xlsx":
            text, pages = extract_xlsx(tmp_path)

        elif ext == ".pptx":
            text, pages = extract_pptx(tmp_path)

        else:
            text, pages = extract_txt(tmp_path)

        if not text.strip():
            raise HTTPException(
                status_code=422,
                detail="Aucun texte extrait."
            )

        return ExtractResponse(
            filename=filename,
            text=text,
            pages=pages,
            file_type=ext.replace(".", ""),
            char_count=len(text)
        )

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)

# ─────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=settings.text_extractor_port
    )