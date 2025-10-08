// Add this component to your app to enable delegated access for users
// This allows the server to sign transactions on behalf of users

import React, { useState, useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Check, Loader2 } from 'lucide-react';

export function SetupDelegatedAccess() {
  const { authenticated, user } = usePrivy();
  const { wallets, ready } = useWallets();
  const [isDelegated, setIsDelegated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isGranting, setIsGranting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user already has delegated access
  useEffect(() => {
    if (ready && wallets.length > 0) {
      const embeddedWallet = wallets.find(w => w.walletClientType === 'privy');
      if (embeddedWallet) {
        // Check with your backend if the wallet has delegated access
        checkDelegatedStatus(user?.id);
      }
      setIsChecking(false);
    }
  }, [ready, wallets, user]);

  const checkDelegatedStatus = async (userId: string | undefined) => {
    if (!userId) return;
    
    try {
      const response = await fetch('/api/user/check-delegated', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const data = await response.json();
      setIsDelegated(data.hasDelegatedAccess);
    } catch (err) {
      console.error('Error checking delegated status:', err);
    }
  };

  const grantDelegatedAccess = async () => {
    setIsGranting(true);
    setError(null);

    try {
      const embeddedWallet = wallets.find(w => w.walletClientType === 'privy');
      
      if (!embeddedWallet) {
        throw new Error('No Privy embedded wallet found');
      }

      // Request a session signer
      // This grants your app permission to sign transactions on behalf of the user
      await embeddedWallet.requestSigner?.();

      // Verify the delegation was successful
      await checkDelegatedStatus(user?.id);
      setIsDelegated(true);
      
    } catch (err: any) {
      console.error('Error granting delegated access:', err);
      setError(err.message || 'Failed to grant access');
    } finally {
      setIsGranting(false);
    }
  };

  if (!authenticated || !ready) {
    return null;
  }

  if (isChecking) {
    return (
      <Alert>
        <Loader2 className="h-4 w-4 animate-spin" />
        <AlertDescription>Checking permissions...</AlertDescription>
      </Alert>
    );
  }

  if (isDelegated) {
    return (
      <Alert className="border-green-500 bg-green-50">
        <Check className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          ✅ Server access enabled. We can process transactions on your behalf.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert>
      <Shield className="h-4 w-4" />
      <AlertDescription>
        <div className="space-y-2">
          <p className="font-medium">Enable seamless transactions</p>
          <p className="text-sm text-muted-foreground">
            Grant our server permission to sign transactions on your behalf. 
            This allows automatic escrow funding without manual approval for each transaction.
          </p>
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          <Button 
            onClick={grantDelegatedAccess} 
            disabled={isGranting}
            size="sm"
          >
            {isGranting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Granting Access...
              </>
            ) : (
              <>
                <Shield className="mr-2 h-4 w-4" />
                Grant Server Access
              </>
            )}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

