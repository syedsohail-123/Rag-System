-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- 1. Users Table
create table if not exists users (
    id text primary key,
    email text unique not null,
    password_hash text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Documents Table
create table if not exists documents (
    id text primary key,
    user_id text not null,
    filename text not null,
    status text default 'Ready',
    summary jsonb,
    s3_key text,
    file_url text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Document Chunks Table (with 384-dimensional vector embeddings)
create table if not exists document_chunks (
    id text primary key,
    document_id text not null references documents(id) on delete cascade,
    user_id text not null,
    page integer not null,
    chunk_index integer not null,
    content text not null,
    embedding vector(384),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Index for fast vector similarity search using cosine distance
create index if not exists document_chunks_embedding_idx 
on document_chunks 
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

-- 4. Chat Logs Table
create table if not exists chat_logs (
    id text primary key,
    document_id text not null references documents(id) on delete cascade,
    user_id text not null,
    role text not null,
    content text not null,
    citations jsonb default '[]'::jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Vector Match Function (RPC for Cosine Similarity Search)
create or replace function match_document_chunks (
    query_embedding vector(384),
    match_count int,
    p_document_id text,
    p_user_id text
)
returns table (
    id text,
    document_id text,
    user_id text,
    page integer,
    chunk_index integer,
    content text,
    similarity float
)
language plpgsql
as $$
begin
    return query
    select
        dc.id,
        dc.document_id,
        dc.user_id,
        dc.page,
        dc.chunk_index,
        dc.content,
        1 - (dc.embedding <=> query_embedding) as similarity
    from document_chunks dc
    where dc.document_id = p_document_id
      and dc.user_id = p_user_id
    order by dc.embedding <=> query_embedding
    limit match_count;
end;
$$;
