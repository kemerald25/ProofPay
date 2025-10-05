import { monitorPayments } from '@/jobs/payment-monitor';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    await monitorPayments();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Payment monitor job failed:', error);
    return NextResponse.json({ success: false, message: 'Payment monitor job failed' }, { status: 500 });
  }
}
