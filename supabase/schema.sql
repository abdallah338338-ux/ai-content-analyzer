CREATE TABLE IF NOT EXISTS content_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_url TEXT,
    title TEXT,
    status TEXT NOT NULL DEFAULT 'processing',
    analysis_mode TEXT,
    analysis JSONB,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS content_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES content_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    references JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS content_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES content_sessions(id) ON DELETE CASCADE,
    asset_type TEXT NOT NULL,
    file_name TEXT,
    storage_path TEXT,
    mime_type TEXT,
    size_bytes BIGINT,
    public_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
