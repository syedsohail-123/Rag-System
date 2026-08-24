# AI PDF Document Assistant (RAG System)

A full-stack Conversational RAG (Retrieval-Augmented Generation) system built with **FastAPI**, **Next.js 15**, **PyMuPDF**, and **Zustand**.

---

## 🛠️ Prerequisites

- **Node.js** (v18 or higher)
- **Python** (v3.10 or higher)

---

## 🚀 Quick Setup Guide

### 1. Backend Setup (FastAPI)

```bash
# Navigate to backend directory
cd backend

# Create Python virtual environment
python -m venv venv

# Activate virtual environment
# Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env configuration file
cp .env.example .env   # Or create a .env file with your API keys

# Start FastAPI server
uvicorn main:app --reload --port 8000
```
Backend will run at: `http://localhost:8000`

---

### 2. Frontend Setup (Next.js)

```bash
# Navigate to frontend directory
cd frontend

# Install Node modules
npm install

# Create .env.local configuration file
# Add: NEXT_PUBLIC_API_URL=http://localhost:8000/api

# Start Next.js development server
npm run dev
```
Frontend will run at: `http://localhost:3000`

---

## 📂 Project Structure

```text
Rag-System/
├── backend/
│   ├── auth.py              # Auth & JWT management
│   ├── config.py            # Environment & server settings
│   ├── llm_gateway.py       # LLM streaming gateway
│   ├── main.py              # FastAPI routes & endpoints
│   ├── rag_pipeline.py      # PDF parsing, chunking & embeddings
│   └── uploads/             # Persistent PDF storage
└── frontend/
    └── src/
        ├── app/             # Next.js App Router pages
        ├── components/      # UI components (PdfViewer, ChatInterface, etc.)
        └── lib/             # API client & Zustand store
```
