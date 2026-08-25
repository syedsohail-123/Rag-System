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
        samesite="none",
        secure=True,
        path="/",
    )
    return {"message": "User registered successfully", "user_id": user_id, "token": token}


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
        samesite="none",
        secure=True,
        path="/",
    )
    return {"message": "Signed in successfully", "token": token}



@app.post("/api/auth/signout")
async def signout(response: Response):
    response.delete_cookie(settings.COOKIE_NAME, path="/", httponly=True, samesite="none", secure=True)
    return {"message": "Signed out successfully"}

from db import (
    supabase_client,
    upload_file_to_s3,
    get_file_from_s3,
    delete_file_from_s3,
    generate_s3_presigned_url,
)

# --------------------- Document Endpoints ---------------------

@app.get("/api/documents")
def get_user_documents(user_id: str = Depends(get_current_user_id)):
    if supabase_client:
        try:
            res = (
                supabase_client.table("documents")
                .select("id, user_id, filename, status, summary, file_url, created_at")
                .eq("user_id", user_id)
                .order("created_at", desc=True)
                .execute()
            )
            return res.data or []
        except Exception as e:
            print(f"Error fetching documents from Supabase: {e}")

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
import tempfile
from urllib.parse import quote

UPLOAD_DIR = os.path.join(tempfile.gettempdir(), "uploads")
try:
    os.makedirs(UPLOAD_DIR, exist_ok=True)
except Exception:
    pass


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
    s3_key = f"documents/{doc_id}.pdf"

    # 1. Upload to AWS S3 (with local disk fallback)
    s3_uploaded = upload_file_to_s3(file_bytes, s3_key)
    if not s3_uploaded:
        file_path = os.path.join(UPLOAD_DIR, f"{doc_id}.pdf")
        with open(file_path, "wb") as f:
            f.write(file_bytes)

    # 2. Run parsing, chunking, embedding, and summary extraction
    summary = process_and_index_document(doc_id, user_id, file_bytes)

    doc_record = {
        "id": doc_id,
        "user_id": user_id,
        "filename": file.filename,
        "status": "Ready",
        "summary": summary,
        "file_url": f"/api/documents/{doc_id}/file",
    }

    # 3. Save to Supabase (with in-memory fallback)
    if supabase_client:
        try:
            supabase_client.table("documents").insert({
                **doc_record,
                "s3_key": s3_key if s3_uploaded else None,
            }).execute()
        except Exception as e:
            print(f"Error inserting document to Supabase: {e}")
            db_documents[doc_id] = {**doc_record, "file_bytes": file_bytes}
    else:
        db_documents[doc_id] = {**doc_record, "file_bytes": file_bytes}

    return doc_record


@app.get("/api/documents/{doc_id}/file")
def get_document_file(
    doc_id: str,
    user_id: str = Depends(get_current_user_id),
):
    raw_filename = "document.pdf"
    content = None

    # Try fetching metadata from Supabase
    if supabase_client:
        try:
            res = supabase_client.table("documents").select("*").eq("id", doc_id).eq("user_id", user_id).execute()
            if res.data:
                raw_filename = res.data[0].get("filename", "document.pdf")
                s3_key = res.data[0].get("s3_key") or f"documents/{doc_id}.pdf"
                content = get_file_from_s3(s3_key)
        except Exception as e:
            print(f"Error reading document from Supabase/S3: {e}")

    # Fallback to local disk or memory
    if content is None:
        doc = db_documents.get(doc_id)
        if doc and doc.get("user_id") == user_id:
            raw_filename = doc.get("filename", "document.pdf")
            content = doc.get("file_bytes")

        file_path = os.path.join(UPLOAD_DIR, f"{doc_id}.pdf")
        if content is None and os.path.exists(file_path):
            with open(file_path, "rb") as f:
                content = f.read()

    if content is None:
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
    if supabase_client:
        try:
            res = supabase_client.table("documents").select("summary").eq("id", doc_id).eq("user_id", user_id).execute()
            if res.data:
                return res.data[0].get("summary", {})
        except Exception as e:
            print(f"Error fetching review from Supabase: {e}")

    doc = db_documents.get(doc_id)
    if not doc or doc["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc.get("summary", {})


@app.get("/api/documents/{doc_id}/history")
def get_chat_history(doc_id: str, user_id: str = Depends(get_current_user_id)):
    if supabase_client:
        try:
            res = (
                supabase_client.table("chat_logs")
                .select("id, role, content, citations, created_at")
                .eq("document_id", doc_id)
                .eq("user_id", user_id)
                .order("created_at", desc=False)
                .execute()
            )
            if res.data is not None:
                return res.data
        except Exception as e:
            print(f"Error fetching chat history from Supabase: {e}")

    return db_chat_logs.get(doc_id, [])


@app.delete("/api/documents/{doc_id}")
def delete_document(doc_id: str, user_id: str = Depends(get_current_user_id)):
    # 1. Delete vector indices
    delete_vector_indices(doc_id, user_id)

    # 2. Delete S3 object
    delete_file_from_s3(f"documents/{doc_id}.pdf")

    # 3. Delete from Supabase
    if supabase_client:
        try:
            supabase_client.table("chat_logs").delete().eq("document_id", doc_id).eq("user_id", user_id).execute()
            supabase_client.table("documents").delete().eq("id", doc_id).eq("user_id", user_id).execute()
        except Exception as e:
            print(f"Error deleting document records from Supabase: {e}")

    # In-memory and local disk cleanup
    if doc_id in db_chat_logs:
        del db_chat_logs[doc_id]
    if doc_id in db_documents:
        del db_documents[doc_id]
    local_file = os.path.join(UPLOAD_DIR, f"{doc_id}.pdf")
    if os.path.exists(local_file):
        try:
            os.remove(local_file)
        except Exception:
            pass

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

    user_msg_id = f"user-{uuid.uuid4()}"
    user_msg = {
        "id": user_msg_id,
        "role": "user",
        "content": payload.query,
    }

    # Persist user message to Supabase and in-memory
    if supabase_client:
        try:
            supabase_client.table("chat_logs").insert({
                "id": user_msg_id,
                "document_id": payload.document_id,
                "user_id": user_id,
                "role": "user",
                "content": payload.query,
            }).execute()
        except Exception as e:
            print(f"Error persisting user chat to Supabase: {e}")

    if payload.document_id not in db_chat_logs:
        db_chat_logs[payload.document_id] = []
    db_chat_logs[payload.document_id].append(user_msg)

    return StreamingResponse(
        generate_sse_chat_stream(
            query=payload.query,
            retrieved_chunks=retrieved_chunks,
            model=payload.model,
            doc_id=payload.document_id,
            chat_logs_db=db_chat_logs,
            user_id=user_id,
            supabase_client=supabase_client,
        ),
        media_type="text/event-stream",
    )




# --------------------- Entry Point ---------------------

from mangum import Mangum

handler = Mangum(app)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True,reload_includes=["*.py"])
