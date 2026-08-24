import uuid
from io import BytesIO
import uvicorn
from fastapi import FastAPI, Depends, HTTPException, status, Response, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr
from typing import List, Dict, Any, Optional
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from config import settings
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user_id,
    validate_password,
)
from rag_pipeline import (
    process_and_index_document,
    retrieve_similar_chunks,
    delete_vector_indices,
)
from llm_gateway import generate_sse_chat_stream

app = FastAPI(title=settings.PROJECT_NAME)
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS Setup for Next.js Frontend & Firebase Hosting
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://rag-pdf-assistant-35992.web.app",
        "https://rag-pdf-assistant-35992.firebaseapp.com",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.requests import Request
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    origin = request.headers.get("origin", "https://rag-pdf-assistant-35992.web.app")
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        },
    )


# In-Memory Relational Database Simulation (Users, Documents, Chat Logs)
db_users: Dict[str, Dict[str, Any]] = {}
db_documents: Dict[str, Dict[str, Any]] = {}
db_chat_logs: Dict[str, List[Dict[str, Any]]] = {}

# Schemas
class AuthRequest(BaseModel):
    email: EmailStr
    password: str

class ChatStreamRequest(BaseModel):
    document_id: str
    query: str
    model: str = "deepseek-v4-pro-free"


from db import supabase_client

# --------------------- Auth Endpoints ---------------------

@app.post("/api/auth/signup")
@limiter.limit("5/minute")
def signup(request: Request, payload: AuthRequest, response: Response):
    validate_password(payload.password)  # Validate password strength
    if supabase_client:
        existing = supabase_client.table("users").select("*").eq("email", payload.email).execute()
        if existing.data:
            raise HTTPException(status_code=400, detail="User already exists")

        user_id = str(uuid.uuid4())
        hashed = hash_password(payload.password)
        supabase_client.table("users").insert({
            "id": user_id,
            "email": payload.email,
            "password_hash": hashed,
        }).execute()
    else:
        if payload.email in db_users:
            raise HTTPException(status_code=400, detail="User already exists")
        user_id = str(uuid.uuid4())
        hashed = hash_password(payload.password)
        db_users[payload.email] = {"id": user_id, "email": payload.email, "password": hashed}

    token = create_access_token(user_id)
    response.set_cookie(
        key=settings.COOKIE_NAME,
        value=token,
        max_age=43200,
        httponly=True,
        samesite="lax",
        secure=False,
        path="/",
    )
    return {"message": "User registered successfully", "user_id": user_id}


@app.post("/api/auth/signin")
@limiter.limit("5/minute")
def signin(request: Request, payload: AuthRequest, response: Response):
    user_id = None
    if supabase_client:
        res = supabase_client.table("users").select("*").eq("email", payload.email).execute()
        if not res.data or not verify_password(payload.password, res.data[0]["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        user_id = res.data[0]["id"]
    else:
        user = db_users.get(payload.email)
        if not user or not verify_password(payload.password, user["password"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        user_id = user["id"]

    token = create_access_token(user_id)
    response.set_cookie(
        key=settings.COOKIE_NAME,
        value=token,
        max_age=43200,
        httponly=True,
        samesite="lax",
        secure=False,
        path="/",
    )
    return {"message": "Signed in successfully"}



@app.post("/api/auth/signout")
async def signout(response: Response):
    response.delete_cookie(settings.COOKIE_NAME, path="/", httponly=True, samesite="lax")
    return {"message": "Signed out successfully"}

# --------------------- Document Endpoints ---------------------

@app.get("/api/documents")
def get_user_documents(user_id: str = Depends(get_current_user_id)):
    user_docs = [
        {
            "id": doc["id"],
            "user_id": doc["user_id"],
            "filename": doc["filename"],
            "status": doc["status"],
            "summary": doc.get("summary"),
            "file_url": doc["file_url"],
        }
        for doc in db_documents.values()
        if doc["user_id"] == user_id
    ]
    return user_docs



import os

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.post("/api/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
):
    # Check 1: File extension ends with .pdf
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File extension must be .pdf")

    # Check 2: MIME type check
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are allowed.")

    file_bytes = await file.read()

    # Check 3: PDF Magic Bytes validation (%PDF)
    if not file_bytes.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="Invalid PDF file format (corrupted or fake PDF).")

    # Check 4: Size limit (25MB)
    if len(file_bytes) > 25 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File exceeds 25MB limit.")

    doc_id = str(uuid.uuid4())

    # Save PDF file to persistent disk storage
    file_path = os.path.join(UPLOAD_DIR, f"{doc_id}.pdf")
    with open(file_path, "wb") as f:
        f.write(file_bytes)

    # Run parsing, chunking, embedding, and summary extraction
    summary = process_and_index_document(doc_id, user_id, file_bytes)

    doc_record = {
        "id": doc_id,
        "user_id": user_id,
        "filename": file.filename,
        "status": "Ready",
        "summary": summary,
        "file_url": f"http://localhost:8000/api/documents/{doc_id}/file",
        "file_bytes": file_bytes,
    }
    db_documents[doc_id] = doc_record

    # Return response payload excluding raw binary file_bytes
    return {
        "id": doc_id,
        "user_id": user_id,
        "filename": file.filename,
        "status": "Ready",
        "summary": summary,
        "file_url": doc_record["file_url"],
    }




from urllib.parse import quote

@app.get("/api/documents/{doc_id}/file")
def get_document_file(
    doc_id: str,
    user_id: str = Depends(get_current_user_id),
):
    file_path = os.path.join(UPLOAD_DIR, f"{doc_id}.pdf")
    doc = db_documents.get(doc_id)
    raw_filename = doc.get("filename", "document.pdf") if doc else "document.pdf"

    if os.path.exists(file_path):
        with open(file_path, "rb") as f:
            content = f.read()
    elif doc and "file_bytes" in doc:
        content = doc["file_bytes"]
    else:
        raise HTTPException(status_code=404, detail="File not found or access denied")

    ascii_filename = raw_filename.encode("ascii", "ignore").decode("ascii") or "document.pdf"
    encoded_filename = quote(raw_filename)

    return Response(
        content=content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"inline; filename=\"{ascii_filename}\"; filename*=UTF-8''{encoded_filename}"
        },
    )


@app.get("/api/documents/{doc_id}/review")
def get_document_review(doc_id: str, user_id: str = Depends(get_current_user_id)):
    doc = db_documents.get(doc_id)
    if not doc or doc["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc.get("summary", {})


@app.get("/api/documents/{doc_id}/history")
def get_chat_history(doc_id: str, user_id: str = Depends(get_current_user_id)):
    return db_chat_logs.get(doc_id, [])


@app.delete("/api/documents/{doc_id}")
def delete_document(doc_id: str, user_id: str = Depends(get_current_user_id)):
    doc = db_documents.get(doc_id)
    if not doc or doc["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Document not found")

    # Cascading deletion across vectors, chat logs, and metadata
    delete_vector_indices(doc_id, user_id)
    if doc_id in db_chat_logs:
        del db_chat_logs[doc_id]
    del db_documents[doc_id]

    return {"message": "Document deleted successfully"}


@app.post("/api/chat/stream")
async def chat_stream(
    payload: ChatStreamRequest,
    user_id: str = Depends(get_current_user_id),
):
    retrieved_chunks = retrieve_similar_chunks(
        doc_id=payload.document_id,
        user_id=user_id,
        query=payload.query,
    )

    # Persist user message to chat logs
    if payload.document_id not in db_chat_logs:
        db_chat_logs[payload.document_id] = []

    user_msg_id = f"user-{uuid.uuid4()}"
    db_chat_logs[payload.document_id].append({
        "id": user_msg_id,
        "role": "user",
        "content": payload.query,
    })

    return StreamingResponse(
        generate_sse_chat_stream(payload.query, retrieved_chunks, payload.model, payload.document_id, db_chat_logs),
        media_type="text/event-stream",
    )



# --------------------- Entry Point ---------------------

from mangum import Mangum

handler = Mangum(app)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True,reload_includes=["*.py"])
