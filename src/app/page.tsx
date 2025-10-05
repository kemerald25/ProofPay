import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, ShieldCheck, MessageCircle, ArrowRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { PlaceHolderImages } from '@/lib/placeholder-images';

const features = [
  {
    icon: <MessageCircle className="h-8 w-8 text-primary" />,
    title: 'WhatsApp Native',
    description: 'Create escrows, confirm payments, and release funds entirely through WhatsApp commands.',
  },
  {
    icon: <ShieldCheck className="h-8 w-8 text-primary" />,
    title: 'Powered by Base',
    description: 'Leverage the security and low fees of the Base blockchain for every transaction.',
  },
  {
    icon: <CheckCircle className="h-8 w-8 text-primary" />,
    title: 'Simple & Secure',
    description: 'No complex apps needed. Your funds are locked in a smart contract until you confirm delivery.',
  },
];

export default function Home() {
  const heroImage = PlaceHolderImages.find(p => p.id === 'hero-image');

  return (
    <main className="flex-1">
      <section className="w-full py-12 md:py-24 lg:py-32">
        <div className="container px-4 md:px-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-12 xl:grid-cols-[1fr_600px]">
            <div className="flex flex-col justify-center space-y-4">
              <div className="space-y-2">
                <h1 className="font-headline text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none text-primary">
                  BasePay
                </h1>
                <p className="text-2xl font-medium tracking-tight">
                  The simplest way to do escrow.
                </p>
                <p className="max-w-[600px] text-muted-foreground md:text-xl">
                  Securely transact with anyone, right from WhatsApp. Powered by the Base blockchain for fast, cheap, and secure payments.
                </p>
              </div>
              <div className="flex flex-col gap-2 min-[400px]:flex-row">
                <Button asChild size="lg">
                  <Link href="/dashboard">
                    Go to Dashboard
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
            <Image
              src={heroImage?.imageUrl || "https://picsum.photos/seed/1/600/600"}
              width={600}
              height={600}
              alt="Hero"
              data-ai-hint="abstract blockchain security"
              className="mx-auto aspect-square overflow-hidden rounded-xl object-cover sm:w-full lg:order-last lg:aspect-square"
            />
          </div>
        </div>
      </section>

      <section className="w-full py-12 md:py-24 lg:py-32 bg-secondary">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
              <div className="inline-block rounded-lg bg-muted px-3 py-1 text-sm">Key Features</div>
              <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl font-headline">Frictionless, Secure Escrow</h2>
              <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                BasePay brings the security of blockchain escrow to the most popular messaging app in the world.
              </p>
            </div>
          </div>
          <div className="mx-auto grid max-w-5xl items-start gap-8 sm:grid-cols-2 md:gap-12 lg:grid-cols-3 lg:max-w-none mt-12">
            {features.map((feature) => (
              <Card key={feature.title} className="bg-background">
                <CardHeader className="flex flex-row items-center gap-4">
                  {feature.icon}
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="w-full py-12 md:py-24 lg:py-32">
        <div className="container grid items-center gap-6 px-4 md:px-6 lg:grid-cols-2 lg:gap-10">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tighter md:text-4xl/tight font-headline">How It Works</h2>
            <p className="max-w-[600px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
              A simple 4-step process to ensure both buyer and seller are protected.
            </p>
          </div>
          <div className="flex space-x-4">
            <ul className="grid gap-6">
              <li>
                <div className="grid gap-1">
                  <h3 className="text-xl font-bold">1. Create</h3>
                  <p className="text-muted-foreground">Seller initiates the escrow via a simple WhatsApp message.</p>
                </div>
              </li>
              <li>
                <div className="grid gap-1">
                  <h3 className="text-xl font-bold">2. Fund</h3>
                  <p className="text-muted-foreground">Buyer receives instructions and sends USDC to the secure escrow contract.</p>
                </div>
              </li>
              <li>
                <div className="grid gap-1">
                  <h3 className="text-xl font-bold">3. Confirm</h3>
                  <p className="text-muted-foreground">Buyer confirms receipt of the item via WhatsApp message.</p>
                </div>
              </li>
              <li>
                <div className="grid gap-1">
                  <h3 className="text-xl font-bold">4. Release</h3>
                  <p className="text-muted-foreground">Funds are automatically released to the seller. Simple and safe!</p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
