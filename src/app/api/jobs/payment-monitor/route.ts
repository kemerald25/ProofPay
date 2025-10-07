import { monitorPayments } from '@/jobs/payment-monitor';
import { NextResponse } from 'next/server';

// GET - Called by Vercel Cron
export async function GET() {
  try {
    await monitorPayments();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Payment monitor job failed:', error);
    return NextResponse.json({ success: false, message: 'Payment monitor job failed' }, { status: 500 });
  }
}

// POST - For manual testing in simulator
export async function POST() {
  try {
    console.log('Manual payment sync triggered');
    await monitorPayments();
    return NextResponse.json({ 
      success: true, 
      message: 'Payment status synced from blockchain' 
    });
  } catch (error: any) {
    console.error('Manual payment sync failed:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message || 'Payment sync failed' 
    }, { status: 500 });
  }
}