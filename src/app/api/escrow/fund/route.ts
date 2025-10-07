import { NextRequest, NextResponse } from 'next/server';
import EscrowService from '@/services/escrow.service';
import { Sentry } from '@/config/sentry';

export async function POST(req: NextRequest) {
    try {
        const { escrowId, buyerPhone } = await req.json();

        if (!escrowId || !buyerPhone) {
            return NextResponse.json({ error: 'escrowId and buyerPhone are required' }, { status: 400 });
        }

        const result = await EscrowService.fundEscrow(escrowId, buyerPhone);

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('[API FUND] Funding error:', error);
        Sentry.captureException(error);

        return NextResponse.json({
            error: error.message || 'Failed to fund escrow',
            details: error.toString()
        }, { status: 500 });
    }
}
