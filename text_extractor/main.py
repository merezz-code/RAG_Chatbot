from fastapi import FastAPI, UploadFile, File, HTTPException
from loguru import logger
import pypdf, docx, openpyxl
from pptx import Presentation
import tempfile, os

app = FastAPI(title="Text Extractor Service", version="1.0.0")

@app.get("/health")
async def health():
    return {"status": "ok", "service": "text_extractor"}
@app.post("/extract")     
@app.post("/v1/extract")
async def extract_text(file: UploadFile = File(...)):
    
    # Sauvegarder temporairement
    suffix = os.path.splitext(file.filename)[1].lower()
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    
    try:
        text = ""
        
        if suffix == ".pdf":
            reader = pypdf.PdfReader(tmp_path)
            text = "\n".join(page.extract_text() for page in reader.pages)
            
        elif suffix == ".docx":
            doc = docx.Document(tmp_path)
            text = "\n".join(p.text for p in doc.paragraphs)
            
        elif suffix == ".xlsx":
            wb = openpyxl.load_workbook(tmp_path)
            for sheet in wb.worksheets:
                for row in sheet.iter_rows(values_only=True):
                    text += " ".join(str(c) for c in row if c) + "\n"
                    
        elif suffix == ".pptx":
            prs = Presentation(tmp_path)
            for slide in prs.slides:
                for shape in slide.shapes:
                    if hasattr(shape, "text"):
                        text += shape.text + "\n"
                        
        elif suffix in [".txt", ".md"]:
            text = content.decode("utf-8")
            
        else:
            raise HTTPException(400, f"Format {suffix} non supporté")
        
        logger.info(f"✅ Extrait {len(text)} caractères de {file.filename}")
        
        return {
            "text": text,
            "metadata": {
                "filename": file.filename,
                "file_type": suffix,
                "char_count": len(text)
            }
        }
    finally:
        os.unlink(tmp_path)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=6000)