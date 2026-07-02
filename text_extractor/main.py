import os
import tempfile
import shutil
import docx2txt
import pandas as pd
import sys
import re
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

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

app = FastAPI(title="Text Extractor Service", version="1.0.2")

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
    """
    FIX FINAL : remplace pypdf par pdfplumber.
    pypdf ratait complètement les tableaux multi-colonnes (ex: tableau
    Updates/Changes du TDCS) — les cellules de certaines colonnes étaient
    silencieusement ignorées, rendant ETXADM-493 introuvable même après
    extraction.
    pdfplumber extrait page par page en combinant :
    - extract_tables() pour les tableaux structurés → chaque ligne devient
      "COL1 | COL2 | COL3" avec les valeurs nettoyées
    - extract_text() pour le texte hors tableau
    """
    import pdfplumber

    text_blocks = []

    with pdfplumber.open(path) as pdf:
        pages = len(pdf.pages)

        for page_num, page in enumerate(pdf.pages, start=1):

            # 1. Extraire les tableaux de la page
            tables = page.extract_tables()
            table_bboxes = []

            for table in tables:
                # Récupérer les bounding boxes des tableaux pour les exclure
                # du texte brut (évite les doublons)
                bbox = page.find_tables()
                if bbox:
                    for t in bbox:
                        table_bboxes.append(t.bbox)

                # Convertir chaque ligne du tableau en phrase lisible
                for row in table:
                    if not row:
                        continue
                    cells = []
                    for cell in row:
                        if cell is None:
                            continue
                        # Nettoyer les retours à la ligne internes aux cellules
                        clean = str(cell).replace("\n", " ").strip()
                        clean = re.sub(r'-\s+(\d)', r'-\1', clean)
                        if clean:
                            cells.append(clean)
                    if cells:
                        text_blocks.append(" | ".join(cells))

            # 2. Extraire le texte hors tableau
            try:
                if table_bboxes:
                    # Exclure les zones de tableau du texte brut
                    remaining = page
                    for bbox in table_bboxes:
                        try:
                            remaining = remaining.outside_bbox(bbox)
                        except Exception:
                            pass
                    page_text = remaining.extract_text() or ""
                else:
                    page_text = page.extract_text() or ""
            except Exception:
                page_text = page.extract_text() or ""

            if page_text.strip():
                text_blocks.append(page_text.strip())

    return "\n\n".join(text_blocks), pages


def extract_docx(path: str):
    text = docx2txt.process(path)
    return text, 1


def _row_contains_header_keywords(row) -> bool:
    for val in row.values:
        if pd.isna(val):
            continue
        s = str(val)
        if "GDSSRC" in s or "3RDNAM" in s:
            return True
    return False


def _looks_like_header_row(row) -> bool:
    non_null = [v for v in row.values if pd.notna(v)]
    if len(non_null) < 2:
        return False

    def is_text_like(v) -> bool:
        if not isinstance(v, str):
            return False
        stripped = v.replace('.', '', 1).replace('-', '', 1).strip()
        return not stripped.isdigit()

    text_like_count = sum(1 for v in non_null if is_text_like(v))
    return text_like_count >= 2


def detect_header_row(df_raw: pd.DataFrame) -> tuple[int, bool]:
    for idx, row in df_raw.iterrows():
        if _row_contains_header_keywords(row):
            return idx, True
    for idx, row in df_raw.iterrows():
        if _looks_like_header_row(row):
            return idx, False
    return 0, False


def extract_xlsx(path: str):
    text_blocks = []
    ext = os.path.splitext(path)[1].lower()

    if ext == ".csv":
        encoding_used = "utf-8"
        try:
            df_raw = pd.read_csv(path, header=None, encoding=encoding_used)
        except UnicodeDecodeError:
            encoding_used = "latin-1"
            df_raw = pd.read_csv(path, header=None, encoding=encoding_used)

        if df_raw.empty:
            return "", 1

        df = pd.read_csv(path, skiprows=0, encoding=encoding_used)
        df.columns = [str(c).strip().replace("\n", "") for c in df.columns]

        text_blocks.append("## Feuille : CSV_Data")
        for index, row in df.iterrows():
            row_items = []
            for col_name in df.columns:
                val = row[col_name]
                if "Unnamed:" in str(col_name):
                    continue
                if pd.notna(val) and str(val).strip() != "":
                    row_items.append(f"{str(col_name).upper().strip()}: {str(val).strip().replace(chr(10), ' ')}")
            if row_items:
                text_blocks.append(" | ".join(row_items))

        return "\n\n".join(text_blocks), 1

    with pd.ExcelFile(path) as excel_file:
        total_sheets = len(excel_file.sheet_names)

        for sheet_name in excel_file.sheet_names:
            df_raw = pd.read_excel(excel_file, sheet_name=sheet_name, header=None)
            if df_raw.empty:
                continue

            header_row_index, has_specific_header = detect_header_row(df_raw)
            df = pd.read_excel(excel_file, sheet_name=sheet_name, skiprows=header_row_index)
            df.columns = [str(c).strip().replace("\n", "") for c in df.columns]
            df.dropna(how='all', inplace=True)

            if has_specific_header and 'GDSSRC' in df.columns:
                df = df[df['GDSSRC'] != 'good/service']

            text_blocks.append(f"## Feuille : {sheet_name}")
            for index, row in df.iterrows():
                row_items = []
                for col_name in df.columns:
                    val = row[col_name]
                    if "Unnamed:" in str(col_name):
                        continue
                    if pd.notna(val) and str(val).strip() != "":
                        clean_col = str(col_name).upper().strip()
                        clean_val = str(val).strip().replace("\n", " ")
                        row_items.append(f"{clean_col}: {clean_val}")
                if row_items:
                    text_blocks.append(" | ".join(row_items))

    return "\n\n".join(text_blocks), total_sheets


def extract_pptx(path: str):
    try:
        from pptx import Presentation
        prs = Presentation(path)
        text_runs = []
        for slide in prs.slides:
            for shape in slide.shapes:
                if hasattr(shape, "text") and shape.text.strip():
                    text_runs.append(shape.text.strip())
        return "\n".join(text_runs), len(prs.slides)
    except Exception:
        return "Extraction PPTX non configurée ou fichier corrompu.", 1


def extract_txt(path: str):
    with open(path, "r", encoding="utf-8") as f:
        return f.read(), 1

# ─────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "text_extractor"}


@app.post("/extract", response_model=ExtractResponse)
@app.post("/v1/extract", response_model=ExtractResponse)
async def extract(file: UploadFile = File(...)):

    filename = file.filename
    ext = os.path.splitext(filename)[1].lower()

    supported = [
        ".pdf", ".docx", ".xlsx", ".pptx", ".txt", ".md",
        ".adoc", ".html", ".xml", ".json", ".jsonl", ".yaml",
        ".xls", ".csv"
    ]

    if ext not in supported:
        raise HTTPException(status_code=400, detail=f"Format non supporté : {ext}")

    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        if ext == ".pdf":
            text, pages = extract_pdf(tmp_path)
        elif ext == ".docx":
            text, pages = extract_docx(tmp_path)
        elif ext in [".xlsx", ".xls", ".csv"]:
            text, pages = extract_xlsx(tmp_path)
        elif ext == ".pptx":
            text, pages = extract_pptx(tmp_path)
        else:
            text, pages = extract_txt(tmp_path)

        if not text.strip():
            raise HTTPException(status_code=422, detail="Aucun texte extrait.")

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
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=settings.text_extractor_port)