import { sendDeliveryReminders } from '@/jobs/delivery-reminder';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    await sendDeliveryReminders();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delivery reminder job failed:', error);
    return NextResponse.json({ success: false, message: 'Delivery reminder job failed' }, { status: 500 });
  }
}
