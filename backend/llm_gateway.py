import uuid
import json
import httpx
from typing import AsyncGenerator, List, Dict, Any
from config import settings

MODEL_NAME_MAP = {
    "deepseek-v4-pro-free": "agnes-2.0-flash",
    "qwen-2.5-max-free": "qwen-3.8-max-free",
}
_cached_active_model = "qwen-3.8-max-free"
async def _resolve_active_model(client: httpx.AsyncClient, requested_model: str) -> str:
    global _cached_active_model
    mapped_target = MODEL_NAME_MAP.get(requested_model, requested_model)
    return mapped_target or _cached_active_model
    try:
        res = await client.get(
            f"{settings.NARA_ROUTER_BASE_URL}/models",
            headers={"Authorization": f"Bearer {settings.NARA_ROUTER_API_KEY}"},
            timeout=10.0,
        )
        if res.status_code == 200:
            active_ids = [m["id"] for m in res.json().get("data", [])]
            # Strictly filter for free-tier or flash models only
            free_models = [m for m in active_ids if "-free" in m or "flash" in m]
            if mapped_target in free_models:
                return mapped_target
            if free_models:
                return free_models[0]
    except Exception:
        pass
    # Strict default fallback to known working free-tier model
    return "qwen-3.8-max-free"

def _build_prompt(query: str, chunks: List[Dict[str, Any]]) -> str:
    if chunks:
        context = "\n\n".join(
            f"[Page {c['page']}]\n{c['content'].strip()}" for c in chunks
        )
        return (
            f"You are an intelligent document and general AI assistant. "
            f"Answer the user's question accurately using the document context below when relevant. "
            f"If the question is general knowledge, a greeting, or not found in the context, answer it directly and helpfully.\n\n"
            f"--- DOCUMENT CONTEXT ---\n{context}\n--- END CONTEXT ---\n\n"
            f"User Question: {query}"
        )
    else:
        return (
            f"You are an intelligent AI assistant. Answer the user's question clearly and helpfully.\n\n"
            f"User Question: {query}"
        )

async def generate_sse_chat_stream(
    query: str,
    retrieved_chunks: List[Dict[str, Any]],
    model: str,
    doc_id: str = None,
    chat_logs_db: Dict[str, List[Dict[str, Any]]] = None,
) -> AsyncGenerator[str, None]:

    citations = sorted(list(set(c["page"] for c in retrieved_chunks))) if retrieved_chunks else []
    prompt = _build_prompt(query, retrieved_chunks)
    yield f"data: {json.dumps({'token': ''})}\n\n"
    full_response = ""

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            llm_model = await _resolve_active_model(client, model)

            async with client.stream(
                "POST",
                f"{settings.NARA_ROUTER_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.NARA_ROUTER_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": llm_model,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": settings.LLM_TEMPERATURE,
                    "stream": True,
                },
            ) as response:
                if response.status_code != 200:
                    error_body = await response.aread()
                    try:
                        err_json = json.loads(error_body.decode())
                        err_msg = err_json.get("error", {}).get("message", error_body.decode())
                    except Exception:
                        err_msg = f"HTTP {response.status_code}"
                    error_str = f"\n[Error: {err_msg}]"
                    full_response += error_str
                    yield f"data: {json.dumps({'token': error_str})}\n\n"
                else:
                    async for line in response.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        raw = line[6:].strip()
                        if raw == "[DONE]":
                            break
                        try:
                            chunk = json.loads(raw)
                            choices = chunk.get("choices", [])
                            if choices and len(choices) > 0:
                                token = choices[0].get("delta", {}).get("content", "")
                                if token:
                                    full_response += token
                                    yield f"data: {json.dumps({'token': token})}\n\n"
                        except (json.JSONDecodeError, KeyError, IndexError):
                            continue

    except Exception as e:
        error_msg = f"\n[Error: {str(e)}]"
        full_response += error_msg
        yield f"data: {json.dumps({'token': error_msg})}\n\n"

    yield f"data: {json.dumps({'citations': citations})}\n\n"

    if doc_id and chat_logs_db is not None:
        chat_logs_db[doc_id].append({
            "id": f"assistant-{uuid.uuid4()}",
            "role": "assistant",
            "content": full_response,
            "citations": citations,
        })

