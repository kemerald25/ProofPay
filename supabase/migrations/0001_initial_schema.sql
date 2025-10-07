-- Drop existing tables in reverse order of dependency to handle foreign keys
DROP TABLE IF EXISTS disputes CASCADE;
DROP TABLE IF EXISTS escrows CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. Users Table
-- Stores user information, linking their phone number to a Privy ID and wallet address.
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    privy_user_id TEXT UNIQUE,
    phone_number TEXT UNIQUE NOT NULL,
    wallet_address TEXT,
    ipfs_cid TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    transaction_count INT DEFAULT 0,
    dispute_count INT DEFAULT 0
);

-- 2. Escrows Table
-- Manages all escrow transaction details.
CREATE TABLE escrows (
    id TEXT PRIMARY KEY, -- Short, human-readable ID (e.g., BP-XYZ123)
    escrow_id TEXT UNIQUE NOT NULL, -- The on-chain bytes32 ID
    buyer_id UUID REFERENCES users(id),
    seller_id UUID REFERENCES users(id),
    buyer_phone TEXT NOT NULL,
    seller_phone TEXT NOT NULL,
    buyer_wallet TEXT,
    seller_wallet TEXT,
    amount NUMERIC(20, 6) NOT NULL,
    status TEXT NOT NULL DEFAULT 'CREATED', -- e.g., CREATED, FUNDED, COMPLETED, DISPUTED
    item_description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    funded_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    auto_release_time TIMESTAMPTZ,
    dispute_raised BOOLEAN DEFAULT FALSE,
    dispute_raised_by UUID REFERENCES users(id),
    dispute_raised_at TIMESTAMPTZ,
    tx_hash TEXT,
    release_tx_hash TEXT
);

-- 3. Disputes Table
-- Stores information related to transaction disputes.
CREATE TABLE disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    escrow_id TEXT REFERENCES escrows(id) ON DELETE CASCADE,
    raised_by UUID REFERENCES users(id),
    reason TEXT, -- e.g., 'NOT_RECEIVED', 'NOT_AS_DESCRIBED'
    description TEXT,
    evidence_urls TEXT[],
    status TEXT NOT NULL DEFAULT 'OPEN', -- e.g., OPEN, UNDER_REVIEW, RESOLVED
    resolution TEXT,
    resolved_by TEXT, -- Could be an admin ID
    resolved_at TIMESTAMPTZ,
    buyer_percentage NUMERIC(5, 2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for faster lookups
CREATE INDEX ON users (phone_number);
CREATE INDEX ON escrows (status);
CREATE INDEX ON escrows (buyer_id);
CREATE INDEX ON escrows (seller_id);
CREATE INDEX ON escrows (auto_release_time);

-- Log a success message
COMMENT ON TABLE users IS 'User data table created successfully.';
