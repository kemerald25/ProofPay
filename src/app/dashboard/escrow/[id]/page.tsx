// src/app/dashboard/escrow/[id]/page.tsx
import { createClient } from '@supabase/supabase-js';
import type { Escrow } from '@/lib/definitions';
import EscrowDetailsClient from './escrow-details-client';
import { notFound } from 'next/navigation';

// This is now a Server Component
const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

async function getEscrow(id: string): Promise<Escrow | null> {
    const { data, error } = await supabase
        .from('escrows')
        .select('*')
        .eq('id', id)
        .single();
    
    if (error && error.code !== 'PGRST116') {
        console.error('Error fetching escrow:', error);
        return null;
    }

    return data as Escrow | null;
}

export default async function EscrowDetailPage({ params }: { params: { id: string } }) {
  const escrow = await getEscrow(params.id);

  if (!escrow) {
    notFound();
  }

  return <EscrowDetailsClient escrow={escrow} />;
}
