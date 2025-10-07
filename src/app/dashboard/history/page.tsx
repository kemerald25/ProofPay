// src/app/dashboard/history/page.tsx
'use server';

import { createClient } from '@supabase/supabase-js';
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
import Link from 'next/link';

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

async function getEscrows(): Promise<Escrow[]> {
    const { data, error } = await supabase
        .from('escrows')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error('Error fetching escrows:', error);
        return [];
    }

    return data as Escrow[];
}


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

export default async function HistoryPage() {
  const escrows = await getEscrows();

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
                <TableHead>Seller</TableHead>
                <TableHead>Buyer</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {escrows.map((escrow) => (
                <TableRow key={escrow.id}>
                    <TableCell className="font-medium">
                        <Link href={`/dashboard/escrow/${escrow.id}`} className="hover:underline text-primary">
                            {escrow.id}
                        </Link>
                    </TableCell>
                  <TableCell>{escrow.item_description}</TableCell>
                  <TableCell>
                    <StatusBadge status={escrow.status} />
                  </TableCell>
                  <TableCell className="text-right">${escrow.amount}</TableCell>
                  <TableCell>{escrow.seller_phone}</TableCell>
                  <TableCell>{escrow.buyer_phone}</TableCell>
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
