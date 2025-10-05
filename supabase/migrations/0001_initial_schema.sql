
-- Create Users Table
create table users (
  id uuid primary key default gen_random_uuid(),
  phone_number text unique not null,
  wallet_address text,
  username text,
  created_at timestamptz default now(),
  total_transactions integer default 0,
  successful_transactions integer default 0,
  dispute_count integer default 0,
  reputation_score numeric default 100,
  is_verified boolean default false
);

-- Create Escrows Table
create table escrows (
  id text primary key, -- Short ID like 'BP-123XYZ'
  escrow_id text not null, -- Blockchain ID (bytes32)
  buyer_id uuid not null references users(id),
  seller_id uuid not null references users(id),
  buyer_phone text not null,
  seller_phone text not null,
  buyer_wallet text,
  seller_wallet text not null,
  amount numeric not null,
  status text not null,
  item_description text,
  created_at timestamptz default now(),
  funded_at timestamptz,
  completed_at timestamptz,
  auto_release_time timestamptz,
  dispute_raised boolean default false,
  dispute_raised_by uuid references users(id),
  dispute_raised_at timestamptz,
  tx_hash text,
  release_tx_hash text
);

-- Create Disputes Table
create table disputes (
  id uuid primary key default gen_random_uuid(),
  escrow_id text not null references escrows(id),
  raised_by uuid not null references users(id),
  reason text,
  description text,
  evidence_urls text[],
  status text not null,
  resolution text,
  resolved_by uuid references users(id),
  resolved_at timestamptz,
  buyer_percentage numeric,
  created_at timestamptz default now()
);

-- Create Transactions Table for logging blockchain interactions
create table transactions (
    id bigserial primary key,
    escrow_id text references escrows(id),
    type text,
    tx_hash text,
    from_address text,
    to_address text,
    amount numeric,
    status text,
    created_at timestamptz default now(),
    confirmed_at timestamptz
);

-- Add Indexes for performance
create index on escrows (status);
create index on escrows (buyer_id);
create index on escrows (seller_id);
create index on escrows (auto_release_time);
create index on disputes (escrow_id);
create index on transactions (escrow_id);
create index on transactions (tx_hash);
