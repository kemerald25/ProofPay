import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { Escrow } from '@/lib/definitions';
import { format, parseISO } from 'date-fns';

const mockAllEscrows: Escrow[] = [
  {
    id: 'BP-123',
    escrow_id: '0x...',
    buyer_id: 'user-b',
    seller_id: 'user-a',
    buyer_phone: '+15550001',
    seller_phone: '+15550002',
    seller_wallet: '0xabc',
    amount: '100.00',
    status: 'FUNDED',
    item_description: 'Vintage Leather Jacket',
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    funded_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    dispute_raised: false,
  },
  {
    id: 'BP-456',
    escrow_id: '0x...',
    buyer_id: 'user-a',
    seller_id: 'user-c',
    buyer_phone: '+15550002',
    seller_phone: '+15550003',
    seller_wallet: '0xdef',
    amount: '50.00',
    status: 'CREATED',
    item_description: 'Handmade Ceramic Mug',
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    dispute_raised: false,
  },
  {
    id: 'BP-789',
    escrow_id: '0x...',
    buyer_id: 'user-d',
    seller_id: 'user-a',
    buyer_phone: '+15550004',
    seller_phone: '+15550002',
    seller_wallet: '0xghi',
    amount: '250.00',
    status: 'DISPUTED',
    item_description: 'Antique Pocket Watch',
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    funded_at: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
    dispute_raised: true,
  },
   {
    id: 'BP-987',
    escrow_id: '0x...',
    buyer_id: 'user-a',
    seller_id: 'user-e',
    buyer_phone: '+15550002',
    seller_phone: '+15550005',
    seller_wallet: '0xjkl',
    amount: '1200.00',
    status: 'COMPLETED',
    item_description: 'Custom Gaming PC',
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    funded_at: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString(),
    completed_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
    dispute_raised: false,
  },
];


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

export default function HistoryPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold font-headline">Transaction History</h1>
      <Card>
        <CardHeader>
          <CardTitle>All Escrows</CardTitle>
          <CardDescription>
            A complete list of all your past and present transactions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Escrow ID</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockAllEscrows.map((escrow) => (
                <TableRow key={escrow.id}>
                  <TableCell className="font-medium">{escrow.id}</TableCell>
                  <TableCell>{escrow.item_description}</TableCell>
                  <TableCell>
                    <StatusBadge status={escrow.status} />
                  </TableCell>
                  <TableCell className="text-right">${escrow.amount}</TableCell>
                  <TableCell>{escrow.seller_id === 'user-a' ? 'Seller' : 'Buyer'}</TableCell>
                  <TableCell>
                    {format(parseISO(escrow.created_at), 'MMM d, yyyy')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
