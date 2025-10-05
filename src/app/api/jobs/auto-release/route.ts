import { checkAutoReleases } from '@/jobs/auto-release';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    await checkAutoReleases();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Auto-release job failed:', error);
    return NextResponse.json({ success: false, message: 'Auto-release job failed' }, { status: 500 });
  }
}
