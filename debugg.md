# Production Debugging & Architecture Report: Serverless RAG System

This document outlines the complete architectural migration, critical issues encountered during cloud deployment, root-cause analyses, and solutions implemented to bring the full-stack Conversational RAG system into production on **AWS Lambda**, **AWS S3**, **Supabase (PostgreSQL + pgvector)**, and **Firebase Hosting**.

---

## 1. High-Level Architecture Overview

```text
+-----------------------------------------------------------------------------------------+
|                                    Next.js Frontend                                     |
|                       (Hosted on Firebase Hosting: .web.app)                            |
+-----------------------------------------------------------------------------------------+
                    |                                            ^
                    | HTTPS / SSE (Bearer Token Auth)            | Real-time Token Stream
                    v                                            |
+-----------------------------------------------------------------------------------------+
|                                AWS Lambda Backend (FastAPI)                             |
|                        (Function URL in ap-south-1, Python 3.11)                        |
|                                                                                         |
|   +-----------------------+   +-----------------------+   +-------------------------+   |
|   |   Auth & Security     |   |     RAG Pipeline      |   |       LLM Gateway       |   |
|   |  - Dual Auth (Bearer) |   |  - PyPDF Text Parser  |   |  - NaraRouter Proxy     |   |
|   |  - PBKDF2 Password    |   |  - 384-d Embeddings   |   |  - SSE Event Streamer   |   |
|   +-----------------------+   +-----------------------+   +-------------------------+   |
+-----------------------------------------------------------------------------------------+
                    |                                            |
        Read / Write PDF Objects                    Query Vectors & Relational Data
                    v                                            v
+----------------------------------------+   +--------------------------------------------+
|             AWS S3 Bucket              |   |           Supabase (PostgreSQL)            |
|       (rag-backend-docs-prod-*)        |   | - users: User Auth & Credentials           |
|  - Encrypted PDF Storage               |   | - documents: Metadata & Status             |
|  - CORS & Block Public Access Enabled  |   | - document_chunks: pgvector (384-d index)  |
|                                        |   | - chat_logs: Multi-tenant History          |
+----------------------------------------+   +--------------------------------------------+
```

---

## 2. Key Issues Encountered, Root Causes & Fixes

### Issue 1: Ephemeral In-Memory State & Local Disk Limitations on Serverless
- **Symptom / Problem**: The initial backend stored documents, chat history, and vectors in local Python dictionaries (`vector_store_db`, `db_documents`, `db_chat_logs`) and saved uploaded PDFs to local disk (`backend/uploads/`). In AWS Lambda, containers spin down and recycle, causing data loss between requests.
- **Root Cause**: Lambda execution environments are ephemeral and stateless with a read-only root filesystem.
- **Resolution**:
  1. **AWS S3 Integration**: Migrated PDF binary storage to an AWS S3 bucket (`rag-backend-docs-prod-*`).
  2. **Supabase & pgvector Database**: Built a PostgreSQL schema with `vector(384)` embeddings and custom RPC cosine similarity function (`match_document_chunks`).
  3. **Dual State Adapter**: Updated backend endpoints to query Supabase and S3 with graceful fallbacks.

---

### Issue 2: AWS Lambda Reserved Environment Variable Collision
- **Error**:
  ```text
  InvalidParameterValueException: Lambda was unable to configure your environment variables 
  because the environment variables you have provided contains reserved keys: AWS_REGION
  ```
- **Root Cause**: AWS Lambda automatically defines `AWS_REGION` and `AWS_DEFAULT_REGION` inside the execution container. Explicitly defining `AWS_REGION` in Terraform's `environment.variables` block violates AWS Lambda constraints.
- **Resolution**: Removed `AWS_REGION` from the explicit Terraform environment variables map in `terraform/main.tf` and allowed the Lambda runtime to inject it natively.

---

### Issue 3: C-Extension Binary Wheel Mismatch (`ImportModuleError: pydantic_core`)
- **Error**:
  ```text
  {"errorMessage": "Unable to import module 'main': No module named 'pydantic_core._pydantic_core'", 
   "errorType": "Runtime.ImportModuleError"}
  ```
- **Root Cause**: When dependencies were packaged on a Windows/WSL host using `pip install --target`, compiled C-extensions (`pydantic_core`, `cryptography`, etc.) were installed as Windows/host-specific binaries rather than Linux `x86_64` Python 3.11 wheels.
- **Resolution**: Packaged dependencies targeting the exact Lambda Linux environment using pip binary platform flags:
  ```bash
  pip install \
    --platform manylinux2014_x86_64 \
    --target ./lambda_dist \
    --implementation cp \
    --python-version 3.11 \
    --only-binary=:all: \
    --upgrade \
    -r backend/requirements.txt
  ```

---

### Issue 4: Read-Only Filesystem in Lambda (`[Errno 30] Read-only file system: '/var/task/uploads'`)
- **Error**:
  ```text
  {"errorMessage": "[Errno 30] Read-only file system: '/var/task/uploads'", "errorType": "OSError"}
  ```
- **Root Cause**: The module initialization code in `backend/main.py` attempted to create a local directory `os.makedirs(UPLOAD_DIR, exist_ok=True)` in `/var/task`, which is strictly read-only in Lambda.
- **Resolution**: Updated `UPLOAD_DIR` in `backend/main.py` to use `tempfile.gettempdir()` (`/tmp/uploads`), which is the only writable scratch space in Lambda:
  ```python
  import tempfile
  UPLOAD_DIR = os.path.join(tempfile.gettempdir(), "uploads")
  ```

---

### Issue 5: Duplicate `Access-Control-Allow-Origin` CORS Header
- **Error**:
  ```text
  The 'Access-Control-Allow-Origin' header contains multiple values 
  'https://rag-pdf-assistant-35992.web.app, https://rag-pdf-assistant-35992.web.app', 
  but only one is allowed.
  ```
- **Root Cause**: Both AWS Lambda Function URL (via its native CORS config) and FastAPI (via `CORSMiddleware`) were attaching the `Access-Control-Allow-Origin` header simultaneously, creating an illegal multi-value header.
- **Resolution**: Cleared CORS from the Lambda Function URL so FastAPI's `CORSMiddleware` handles all CORS negotiation:
  ```bash
  aws lambda update-function-url-config \
    --function-name rag-backend-prod \
    --cors '{}' \
    --region ap-south-1
  ```

---

### Issue 6: Cross-Domain Cookie Blocking & Redirect Flickering
- **Symptom / Problem**: The frontend dashboard would flicker between `/` and `/login` on initial sign-in.
- **Root Cause**: Because the frontend is on Firebase (`.web.app`) and the backend is on AWS (`.lambda-url.ap-south-1.on.aws`), modern browsers enforce strict third-party cookie restrictions, discarding cross-site `Set-Cookie` headers. When `/` called `/api/documents`, it returned `401 Unauthorized`, triggering an immediate redirect back to `/login`.
- **Resolution**:
  1. **Backend**: Added token return to JSON bodies (`{"token": token}`) and updated `get_current_user_id` to inspect `Authorization: Bearer <token>` headers as a robust fallback to cookies.
  2. **Frontend**: Updated `apiFetch` and `streamChatQuery` in `frontend/src/lib/api.ts` to automatically store and attach `Authorization: Bearer <token>` from `localStorage`.

---

### Issue 7: Missing Bearer Token on Document Upload & Slow Skeleton Animation
- **Symptom / Problem**: Document upload failed with `Failed to upload PDF` while login succeeded. Skeleton progress animations felt sluggish.
- **Root Cause**: `DocumentUploader.tsx` used raw browser `fetch()` rather than the authenticated `apiFetch` utility, omitting the `Authorization` header. Step timer delays were hardcoded to 1.8 seconds.
- **Resolution**:
  1. Replaced raw `fetch()` in `DocumentUploader.tsx` with `apiFetch<Document>("/documents/upload", { method: "POST", body: formData })`.
  2. Reduced step transition delays from 600ms/1200ms/1800ms down to responsive 150ms intervals.

---

### Issue 8: Browser Cache & Stale Session in Regular Chrome
- **Symptom**: Application ran cleanly in Incognito mode but failed in regular Chrome.
- **Root Cause**: Chrome persisted old compiled Next.js chunks (`.next` build assets) and stale `localStorage` keys from previous test runs.
- **Resolution**: Performed an **"Empty Cache and Hard Reload"** in Chrome DevTools, purging stale client assets.

---

## 3. Production Verification Summary

| Component | Status | Verification Check |
| :--- | :--- | :--- |
| **AWS Lambda Backend** | ✅ Active | Swagger docs live at `https://56m5fybhdqlyfeqe2qdjtjjzna0madwo.lambda-url.ap-south-1.on.aws/docs` |
| **AWS S3 Storage** | ✅ Active | PDF binaries uploaded to `rag-backend-docs-prod-8h1hvq` with IAM Least Privilege |
| **Supabase Database** | ✅ Active | Relational tables (`users`, `documents`, `chat_logs`) & `document_chunks` pgvector index live |
| **Next.js Frontend** | ✅ Active | Hosted on `https://rag-pdf-assistant-35992.web.app` with Bearer auth & fast ingestion UI |
| **RAG LLM Gateway** | ✅ Active | SSE streaming verified with multi-page citations |
