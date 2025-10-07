-- Create the users table
CREATE TABLE
  public.users (
    id uuid NOT NULL DEFAULT gen_random_uuid (),
    privy_user_id text NULL,
    phone_number text NULL,
    wallet_address text NULL,
    ipfs_cid text NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    transaction_count integer NULL DEFAULT 0,
    dispute_count integer NULL DEFAULT 0,
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_phone_number_key UNIQUE (phone_number),
    CONSTRAINT users_privy_user_id_key UNIQUE (privy_user_id)
  ) TABLESPACE pg_default;

-- Create the escrows table
CREATE TABLE
  public.escrows (
    id text NOT NULL,
    escrow_id text NULL,
    buyer_id uuid NULL,
    seller_id uuid NULL,
    buyer_phone text NULL,
    seller_phone text NULL,
    buyer_wallet text NULL,
    seller_wallet text NULL,
    amount numeric NULL,
    status text NULL,
    item_description text NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    funded_at timestamp with time zone NULL,
    completed_at timestamp with time zone NULL,
    auto_release_time timestamp with time zone NULL,
    dispute_raised boolean NULL DEFAULT false,
    dispute_raised_by uuid NULL,
    dispute_raised_at timestamp with time zone NULL,
    tx_hash text NULL,
    release_tx_hash text NULL,
    CONSTRAINT escrows_pkey PRIMARY KEY (id),
    CONSTRAINT escrows_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES users (id),
    CONSTRAINT escrows_dispute_raised_by_fkey FOREIGN KEY (dispute_raised_by) REFERENCES users (id),
    CONSTRAINT escrows_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES users (id)
  ) TABLESPACE pg_default;

-- Create the disputes table
CREATE TABLE
  public.disputes (
    id uuid NOT NULL DEFAULT gen_random_uuid (),
    escrow_id text NULL,
    raised_by uuid NULL,
    reason text NULL,
    description text NULL,
    evidence_urls text[] NULL,
    status text NULL DEFAULT 'OPEN'::text,
    resolution text NULL,
    resolved_by text NULL,
    resolved_at timestamp with time zone NULL,
    buyer_percentage integer NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT disputes_pkey PRIMARY KEY (id),
    CONSTRAINT disputes_escrow_id_fkey FOREIGN KEY (escrow_id) REFERENCES escrows (id),
    CONSTRAINT disputes_raised_by_fkey FOREIGN KEY (raised_by) REFERENCES users (id)
  ) TABLESPACE pg_default;
