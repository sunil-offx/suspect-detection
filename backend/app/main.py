from fastapi import FastAPI, UploadFile, File, Form, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.logging_config import setup_logging
from app.api.auth import router as auth_router
from app.api.cases import router as cases_router
from app.services.file_validation import validate_image, validate_audio
from app.services.storage import storage
from app.database.session import Base, engine

setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    import app.models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    try:
        from scripts.seed_admin import seed_admin
        seed_admin()
    except Exception as e:
        import logging
        logging.getLogger("crimesketch").warning(f"Admin seed note: {e}")
    yield


app = FastAPI(
    title="CrimeSketch AI API",
    description="Forensic Facial Composite & Case Investigation Platform",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", "http://127.0.0.1:3000"],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.responses import JSONResponse
from app.providers.exceptions import ProviderUnavailable, ProviderResponseError

from app.api.inputs import router as inputs_router
from app.api.reports import router as reports_router
from app.api.files import router as files_router
from app.api.sketches import router as sketches_router

app.include_router(auth_router)
app.include_router(cases_router)
app.include_router(inputs_router)
app.include_router(reports_router)
app.include_router(files_router)
app.include_router(sketches_router)


@app.exception_handler(ProviderUnavailable)
async def provider_unavailable_handler(request, exc: ProviderUnavailable):
    return JSONResponse(
        status_code=503,
        content={"detail": str(exc), "code": "PROVIDER_UNAVAILABLE"}
    )


@app.exception_handler(ProviderResponseError)
async def provider_response_error_handler(request, exc: ProviderResponseError):
    return JSONResponse(
        status_code=502,
        content={"detail": str(exc), "code": "PROVIDER_ERROR"}
    )


@app.get("/")
def root():
    return {
        "title": "CrimeSketch AI API",
        "status": "online",
        "version": "1.0.0",
        "documentation": "http://127.0.0.1:8000/docs",
        "frontend_app": "http://127.0.0.1:5173"
    }


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/api/test/analyze")
def test_analyze():
    from app.providers import get_provider
    provider = get_provider("llm")
    return provider.analyze("Witness saw tall man with short dark hair")


# Validation test endpoints for Phase 3 gate
@app.post("/api/test/upload-image")
async def test_upload_image(file: UploadFile = File(...)):
    content = await file.read()
    ext = validate_image(content, file.filename or "image.jpg")
    token = storage.save_file(content, ext, prefix="test_img_")
    return {"status": "valid", "token": token}


@app.post("/api/test/upload-audio")
async def test_upload_audio(file: UploadFile = File(...)):
    content = await file.read()
    ext = validate_audio(content, file.filename or "audio.mp3")
    token = storage.save_file(content, ext, prefix="test_aud_")
    return {"status": "valid", "token": token}
