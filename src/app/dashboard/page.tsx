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
import { DollarSign, CheckCircle, Clock } from 'lucide-react';
import type { Escrow } from '@/lib/definitions';
import { format } from 'date-fns';
import Link from 'next/link';

// Mock data, to be replaced by API calls
const mockEscrows: Escrow[] = [
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

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold font-headline">Dashboard</h1>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$4,231.89</div>
            <p className="text-xs text-muted-foreground">+20.1% from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Escrows</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+23</div>
            <p className="text-xs text-muted-foreground">+180.1% from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Escrows</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5</div>
            <p className="text-xs text-muted-foreground">+2 since last hour</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Escrows</CardTitle>
          <CardDescription>
            A list of your ongoing transactions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockEscrows.map((escrow) => (
                <TableRow key={escrow.id} className="cursor-pointer">
                  <TableCell>
                    <Link href={`/dashboard/escrow/${escrow.id}`}>
                      <div className="font-medium">{escrow.item_description}</div>
                      <div className="hidden text-sm text-muted-foreground md:inline">
                        ID: {escrow.id}
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={escrow.status} />
                  </TableCell>
                  <TableCell className="text-right">${escrow.amount}</TableCell>
                   <TableCell>{escrow.seller_id === 'user-a' ? 'Seller' : 'Buyer'}</TableCell>
                  <TableCell>{format(new Date(escrow.created_at), 'MMM d, yyyy')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
