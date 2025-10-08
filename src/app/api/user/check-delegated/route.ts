// API endpoint to check delegated status: /api/user/check-delegated
// Add this to your API routes:

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    
    const privyAppId = process.env.PRIVY_APP_ID;
    const privyAppSecret = process.env.PRIVY_APP_SECRET;
    const authHeader = 'Basic ' + Buffer.from(privyAppId + ':' + privyAppSecret).toString('base64');

    const response = await fetch(`https://auth.privy.io/api/v1/users/${userId}`, {
      headers: {
        'Authorization': authHeader,
        'privy-app-id': privyAppId!,
      },
    });

    const userData = await response.json();
    
    const hasDelegatedWallet = userData.linked_accounts?.some(
      (account: any) => 
        account.type === 'wallet' && 
        account.chain_type === 'ethereum' && 
        account.delegated === true
    );

    return NextResponse.json({ 
      hasDelegatedAccess: hasDelegatedWallet 
    });
  } catch (error) {
    return NextResponse.json({ 
      hasDelegatedAccess: false 
    }, { status: 500 });
  }
}
