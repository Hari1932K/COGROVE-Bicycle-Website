import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarClock, ShieldCheck, ShoppingBag, Store, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { money, prettyLabel } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cogrove — Buy, Rent, Service & Kit Out Your Bike" },
      {
        name: "description",
        content:
          "Cogrove is the full-stack bike hub: a used-bike marketplace, weekend rental fleet, workshop booking and a gear shop — all in one garage.",
      },
      { property: "og:title", content: "Cogrove — Buy, Rent, Service & Kit Out Your Bike" },
      {
        property: "og:description",
        content:
          "Marketplace, rentals, workshop bookings and gear for riders who put in the miles.",
      },
    ],
  }),
  component: Home,
});

const PILLARS = [
  {
    icon: Store,
    title: "Marketplace",
    body: "Vetted used road, gravel, mountain and city bikes from riders near you.",
    to: "/marketplace" as const,
  },
  {
    icon: CalendarClock,
    title: "Rentals",
    body: "Book a machine by the day. Helmets, pedals and spares included.",
    to: "/rentals" as const,
  },
  {
    icon: Wrench,
    title: "Workshop",
    body: "Tune-ups, drivetrain rebuilds and wheel truing by certified mechanics.",
    to: "/services" as const,
  },
  {
    icon: ShoppingBag,
    title: "Gear shop",
    body: "Helmets, lights, apparel, tools and bags stocked for real riding.",
    to: "/shop" as const,
  },
];

function Home() {
  const { data: listings } = useQuery({
    queryKey: ["featured-listings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("id,title,brand,category,price_cents,image_url,location,condition")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(3);
      if (error) throw error;
      return data;
    },
  });

  return (
    <>
      <section className="relative isolate overflow-hidden">
        <img
          src="/images/hero-bike.jpg"
          alt="Matte black performance road bike lit from the side in a dark studio"
          width={1600}
          height={1008}
          className="absolute inset-0 -z-10 size-full object-cover opacity-60"
        />
        <div
          className="absolute inset-0 -z-10"
          style={{ background: "var(--gradient-carbon)" }}
          aria-hidden="true"
        />
        <div className="mx-auto max-w-7xl px-4 pb-24 pt-24 sm:px-6 sm:pb-32 sm:pt-32">
          <Badge className="label-track bg-secondary text-foreground">Est. 2019 · Ride owned</Badge>
          <h1 className="mt-6 max-w-3xl text-6xl sm:text-7xl lg:text-8xl">
            Every bike. <span className="text-heat">One garage.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Buy or sell a used frame, rent for the weekend, book the workshop and restock your kit —
            without leaving one account.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button
              asChild
              size="lg"
              className="bg-heat text-primary-foreground shadow-heat hover:opacity-90"
            >
              <Link to="/marketplace">
                Shop bikes
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/rentals">Book a rental</Link>
            </Button>
          </div>
          <dl className="mt-16 grid max-w-2xl grid-cols-3 gap-6 border-t border-border pt-8">
            {[
              ["1.2k", "Bikes rehomed"],
              ["48h", "Workshop turnaround"],
              ["4.9★", "Rider rating"],
            ].map(([value, label]) => (
              <div key={label}>
                <dt className="label-track text-muted-foreground">{label}</dt>
                <dd className="font-display text-4xl text-foreground">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <h2 className="text-4xl sm:text-5xl">Four ways to roll</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map(({ icon: Icon, title, body, to }) => (
            <Link key={title} to={to} className="group">
              <Card className="h-full border-border bg-card transition-colors group-hover:border-primary">
                <CardContent className="p-6">
                  <span className="grid size-11 place-items-center rounded-sm bg-secondary text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 text-2xl">{title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{body}</p>
                  <span className="label-track mt-5 inline-flex items-center gap-1 text-primary">
                    Explore
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-card/30">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-4xl sm:text-5xl">Fresh on the marketplace</h2>
            <Button asChild variant="outline">
              <Link to="/marketplace">See all listings</Link>
            </Button>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {(listings ?? []).map((bike) => (
              <Card key={bike.id} className="overflow-hidden border-border bg-card p-0">
                <img
                  src={bike.image_url ?? "/images/bike-road.jpg"}
                  alt={bike.title}
                  loading="lazy"
                  width={1200}
                  height={800}
                  className="aspect-[3/2] w-full object-cover"
                />
                <CardContent className="p-5">
                  <p className="label-track text-primary">{prettyLabel(bike.category)}</p>
                  <h3 className="mt-2 text-2xl">{bike.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {bike.brand} · {prettyLabel(bike.condition)} · {bike.location ?? "Local pickup"}
                  </p>
                  <p className="mt-4 font-display text-3xl">{money(bike.price_cents)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <img
            src="/images/bike-gravel.jpg"
            alt="Gravel bike photographed against a dark studio backdrop"
            loading="lazy"
            width={1200}
            height={800}
            className="w-full rounded-sm object-cover shadow-panel"
          />
          <div>
            <h2 className="text-4xl sm:text-5xl">Bought with confidence</h2>
            <ul className="mt-6 space-y-4">
              {[
                "Every marketplace bike is condition-graded before it goes live.",
                "Rentals ship serviced, with a 48-point safety check on return.",
                "Workshop bookings come with a written parts and labour quote.",
              ].map((line) => (
                <li key={line} className="flex gap-3 text-muted-foreground">
                  <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <Button asChild className="mt-8 bg-heat text-primary-foreground shadow-heat hover:opacity-90">
              <Link to="/services">Book the workshop</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
