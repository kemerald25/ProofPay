import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Escrow } from '@/lib/definitions';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { Check, Clock, Copy, ShieldAlert, User, Milestone } from 'lucide-react';

const mockEscrow: Escrow = {
  id: 'BP-123',
  escrow_id: '0x1234567890123456789012345678901234567890',
  buyer_id: 'user-b',
  seller_id: 'user-a',
  buyer_phone: '+15550001',
  seller_phone: '+15550002',
  seller_wallet: '0xabcdef1234567890abcdef1234567890abcdef12',
  amount: '100.00',
  status: 'FUNDED',
  item_description: 'Vintage Leather Jacket',
  created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  funded_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  auto_release_time: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
  dispute_raised: false,
};

const StatusBadge = ({ status }: { status: Escrow['status'] }) => {
    const variants = {
      CREATED: 'secondary',
      FUNDED: 'default',
      COMPLETED: 'outline',
      DISPUTED: 'destructive',
      REFUNDED: 'outline',
      CANCELLED: 'secondary',
    } as const;
    
    return <Badge variant={variants[status]}>{status}</Badge>;
};

const TimelineStep = ({ title, timestamp, isCompleted, isLast = false }: { title: string, timestamp?: string, isCompleted: boolean, isLast?: boolean }) => (
    <div className="flex gap-4">
        <div className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isCompleted ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                {isCompleted ? <Check className="w-5 h-5" /> : <Clock className="w-5 h-5 text-muted-foreground" />}
            </div>
            {!isLast && <div className={`w-0.5 grow ${isCompleted ? 'bg-primary' : 'bg-border'}`}></div>}
        </div>
        <div>
            <p className="font-medium">{title}</p>
            {timestamp && <p className="text-sm text-muted-foreground">{format(parseISO(timestamp), "MMM d, yyyy 'at' h:mm a")}</p>}
        </div>
    </div>
)

export default function EscrowDetailPage({ params }: { params: { id: string } }) {
  const escrow = mockEscrow; // In a real app, fetch escrow by params.id
  const isBuyer = escrow.buyer_id === 'user-a'; // Mock current user

  const autoReleaseDistance = escrow.auto_release_time ? formatDistanceToNow(parseISO(escrow.auto_release_time), { addSuffix: true }) : '';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold font-headline">Escrow Details</h1>
        <StatusBadge status={escrow.status} />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <main className="lg:col-span-2 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>{escrow.item_description}</CardTitle>
                    <CardDescription>Escrow ID: {escrow.id}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Amount</span>
                        <span className="font-bold text-lg">{escrow.amount} USDC</span>
                    </div>
                     <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Your Role</span>
                        <span className="font-medium">{isBuyer ? 'Buyer' : 'Seller'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">{isBuyer ? 'Seller' : 'Buyer'}</span>
                        <span className="font-mono text-sm">{isBuyer ? escrow.seller_phone : escrow.buyer_phone}</span>
                    </div>
                     <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Auto-release</span>
                        <span className="font-medium text-amber-600">{autoReleaseDistance}</span>
                    </div>
                </CardContent>
            </Card>

            {escrow.status === 'CREATED' && isBuyer && (
                 <Card>
                    <CardHeader>
                        <CardTitle>Action Required: Fund Escrow</CardTitle>
                        <CardDescription>Send USDC to the contract to secure your funds.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <Label>Send exactly {escrow.amount} USDC (on Base) to:</Label>
                         <div className="flex items-center space-x-2 rounded-md border p-2 bg-secondary">
                            <code className="font-code text-sm flex-1">{escrow.escrow_id}</code>
                            <Button variant="ghost" size="icon"><Copy className="h-4 w-4" /></Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {escrow.status === 'FUNDED' && (
                <Card className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
                    <CardHeader>
                        <CardTitle className="text-green-800 dark:text-green-200">
                            {isBuyer ? "Action Required: Confirm Delivery" : "Waiting for Buyer"}
                        </CardTitle>
                        <CardDescription className="text-green-700 dark:text-green-300">
                            {isBuyer 
                                ? "Once you receive your item, click below to release funds to the seller."
                                : "The buyer has been notified to confirm delivery. Funds will be released to you upon their confirmation."}
                        </CardDescription>
                    </CardHeader>
                    {isBuyer && (
                        <CardContent>
                            <div className="flex gap-4">
                                <Button>
                                    <Check className="mr-2 h-4 w-4"/>
                                    Confirm Delivery & Release Funds
                                </Button>
                                <Button variant="destructive">
                                    <ShieldAlert className="mr-2 h-4 w-4"/>
                                    Raise a Dispute
                                </Button>
                            </div>
                        </CardContent>
                    )}
                </Card>
            )}

        </main>
        <aside className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Timeline</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <TimelineStep title="Escrow Created" timestamp={escrow.created_at} isCompleted={!!escrow.created_at} />
                    <TimelineStep title="Escrow Funded" timestamp={escrow.funded_at} isCompleted={!!escrow.funded_at} />
                    <TimelineStep title="Delivery Confirmed" timestamp={escrow.completed_at} isCompleted={!!escrow.completed_at} />
                    <TimelineStep title="Funds Released" timestamp={escrow.completed_at} isCompleted={!!escrow.completed_at} isLast={true} />
                </CardContent>
            </Card>
        </aside>
      </div>
    </div>
  );
}
