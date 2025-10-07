export type User = {
    id: string; // uuid from supabase
    privy_user_id: string;
    phone_number: string;
    wallet_address: string;
    ipfs_cid?: string;
    created_at: string;
};

export type Escrow = {
    id: string; // short id
    escrow_id: string; // blockchain id
    buyer_id: string;
    seller_id: string;
    buyer_phone: string;
    seller_phone: string;
    buyer_wallet: string;
    seller_wallet: string;
    amount: string;
    status: 'CREATED' | 'FUNDED' | 'COMPLETED' | 'DISPUTED' | 'REFUNDED' | 'CANCELLED';
    item_description?: string;
    created_at: string;
    funded_at?: string;
    completed_at?: string;
    auto_release_time?: string;
    dispute_raised: boolean;
    dispute_raised_by?: string;
    dispute_raised_at?: string;
    tx_hash?: string;
    release_tx_hash?: string;
};

export type Dispute = {
    id: string;
    escrow_id: string;
    raised_by: string;
    reason: 'NOT_RECEIVED' | 'NOT_AS_DESCRIBED' | 'PAYMENT_ISSUE' | 'OTHER';
    description?: string;
    evidence_urls?: string[];
    status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED';
    resolution?: string;
    resolved_by?: string;
    resolved_at?: string;
    buyer_percentage?: number;
    created_at: string;
};
