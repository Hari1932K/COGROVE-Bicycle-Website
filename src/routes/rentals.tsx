import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { dayCount, money, prettyLabel } from "@/lib/format";

export const Route = createFileRoute("/rentals")({
  head: () => ({
    meta: [
      { title: "Bike Rentals by the Day | Cogrove" },
      {
        name: "description",
        content:
          "Reserve a serviced road, gravel, mountain, city or electric bike by the day. Helmet, pedals and spares included.",
      },
      { property: "og:title", content: "Bike Rentals by the Day | Cogrove" },
      {
        property: "og:description",
        content: "Serviced rental bikes booked by the day, with gear included.",
      },
    ],
  }),
  component: Rentals,
});

type Bike = {
  id: string;
  name: string;
  category: string;
  daily_rate_cents: number;
  image_url: string | null;
  description: string | null;
  frame_size: string | null;
  is_available: boolean;
};

function today(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

function Rentals() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Bike | null>(null);
  const [start, setStart] = useState(today(1));
  const [end, setEnd] = useState(today(3));

  const { data, isLoading } = useQuery({
    queryKey: ["rental-bikes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rental_bikes")
        .select("*")
        .order("daily_rate_cents");
      if (error) throw error;
      return data as Bike[];
    },
  });

  const days = dayCount(start, end);
  const total = selected ? selected.daily_rate_cents * days : 0;

  const book = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("No bike selected");
      const { error } = await supabase.from("rental_bookings").insert({
        rental_bike_id: selected.id,
        user_id: user!.id,
        start_date: start,
        end_date: end,
        total_cents: total,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rental reserved", { description: "Track it in your garage." });
      queryClient.invalidateQueries({ queryKey: ["my-rentals"] });
      setSelected(null);
    },
    onError: (error: Error) => toast.error("Could not reserve", { description: error.message }),
  });

  function onReserve(bike: Bike) {
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    setSelected(bike);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <p className="label-track text-primary">Rentals</p>
      <h1 className="mt-3 text-5xl sm:text-6xl">Borrow the good stuff</h1>
      <p className="mt-4 max-w-xl text-muted-foreground">
        Serviced bikes, day rates, no deposit games. Helmet, pedals and a spare tube travel with every
        booking.
      </p>

      {isLoading ? (
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="aspect-[4/3] w-full" />
          ))}
        </div>
      ) : (
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(data ?? []).map((bike) => (
            <Card key={bike.id} className="overflow-hidden border-border bg-card p-0">
              <img
                src={bike.image_url ?? "/images/bike-city.jpg"}
                alt={bike.name}
                loading="lazy"
                width={1200}
                height={800}
                className="aspect-[3/2] w-full object-cover"
              />
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-2">
                  <p className="label-track text-primary">{prettyLabel(bike.category)}</p>
                  <Badge variant={bike.is_available ? "outline" : "secondary"}>
                    {bike.is_available ? "Available" : "Out on loan"}
                  </Badge>
                </div>
                <h2 className="mt-2 text-2xl">{bike.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {bike.description ?? "Ready to ride."}
                  {bike.frame_size ? ` · Size ${bike.frame_size}` : ""}
                </p>
                <div className="mt-5 flex items-center justify-between">
                  <p className="font-display text-3xl">
                    {money(bike.daily_rate_cents)}
                    <span className="ml-1 font-sans text-xs text-muted-foreground">/ day</span>
                  </p>
                  <Button
                    size="sm"
                    disabled={!bike.is_available}
                    onClick={() => onReserve(bike)}
                    className="bg-heat text-primary-foreground hover:opacity-90"
                  >
                    Reserve
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-3xl">Reserve {selected?.name}</DialogTitle>
            <DialogDescription>
              Pick your dates — you can change them up to 24 hours before pickup.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="start-date">Pickup</Label>
              <Input
                id="start-date"
                type="date"
                min={today()}
                value={start}
                onChange={(event) => setStart(event.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="end-date">Return</Label>
              <Input
                id="end-date"
                type="date"
                min={start}
                value={end}
                onChange={(event) => setEnd(event.target.value)}
                className="mt-2"
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {days} day{days === 1 ? "" : "s"} ·{" "}
            <span className="font-display text-2xl text-foreground">{money(total)}</span> total
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => book.mutate()}
              disabled={book.isPending}
              className="bg-heat text-primary-foreground hover:opacity-90"
            >
              {book.isPending ? "Reserving…" : "Confirm reservation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
