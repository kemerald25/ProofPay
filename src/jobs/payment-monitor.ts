import { createClient } from '@supabase/supabase-js';
import EscrowService from '../services/escrow.service';
import WhatsAppService from '../services/whatsapp.service';
import BlockchainListener from '../services/blockchain.listener';

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

export async function monitorPayments() {
    try {
        // Find all escrows that are still in the 'CREATED' state
        const { data: escrows, error: fetchError } = await supabase
            .from('escrows')
            .select('*')
            .eq('status', 'CREATED');

        if (fetchError) throw fetchError;
        
        if (!escrows || escrows.length === 0) {
            console.log('No pending payments to monitor.');
            return;
        }
        
        console.log(`Monitoring ${escrows.length} escrows for funding...`);

        // Get all blockchain IDs to check
        const escrowIdsToCheck = escrows.map(e => e.escrow_id);

        // Get all funding events from the blockchain in one go
        const fundedEvents = await BlockchainListener.getEscrowFundedEvents(escrowIdsToCheck);

        for (const event of fundedEvents) {
            const fundedEscrow = escrows.find(e => e.escrow_id === event.escrowId);
            if (fundedEscrow) {
                try {
                    console.log(`Found funding event for escrow ${fundedEscrow.id} (Blockchain ID: ${event.escrowId})`);

                    // Update the escrow status to FUNDED
                    await EscrowService.updateEscrowStatus(fundedEscrow.id, 'FUNDED', new Date().toISOString());

                    // Notify both parties
                    await WhatsAppService.sendPaymentConfirmed(fundedEscrow.buyer_phone, 'buyer', Number(fundedEscrow.amount), fundedEscrow.id);
                    await WhatsAppService.sendPaymentConfirmed(fundedEscrow.seller_phone, 'seller', Number(fundedEscrow.amount), fundedEscrow.id);

                    console.log(`Successfully updated and notified for escrow ${fundedEscrow.id}.`);
                } catch (updateError) {
                    console.error(`Failed to process funding for escrow ${fundedEscrow.id}:`, updateError);
                }
            }
        }
        
    } catch (error) {
        console.error('Payment monitor job failed:', error);
    }
}
