import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Clock, Wrench } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { money } from "@/lib/format";

export const Route = createFileRoute("/services")({
  head: () => ({
    meta: [
      { title: "Bike Workshop & Service Booking | Cogrove" },
      {
        name: "description",
        content:
          "Book a tune-up, drivetrain rebuild, wheel true or full overhaul with Cogrove's certified mechanics. Written quote before work starts.",
      },
      { property: "og:title", content: "Bike Workshop & Service Booking | Cogrove" },
      {
        property: "og:description",
        content: "Certified mechanics, transparent quotes, 48-hour turnaround.",
      },
    ],
  }),
  component: Services,
});

type ServiceType = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price_cents: number;
};

function defaultSlot() {
  const date = new Date();
  date.setDate(date.getDate() + 2);
  date.setHours(9, 0, 0, 0);
  return date.toISOString().slice(0, 16);
}

function Services() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<ServiceType | null>(null);
  const [slot, setSlot] = useState(defaultSlot());
  const [bike, setBike] = useState("");
  const [notes, setNotes] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["service-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_types")
        .select("*")
        .eq("is_active", true)
        .order("price_cents");
      if (error) throw error;
      return data as ServiceType[];
    },
  });

  const book = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("No service selected");
      const { error } = await supabase.from("service_bookings").insert({
        service_type_id: selected.id,
        user_id: user!.id,
        scheduled_at: new Date(slot).toISOString(),
        bike_description: bike,
        notes: notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Workshop slot booked", { description: "We'll confirm by email." });
      queryClient.invalidateQueries({ queryKey: ["my-services"] });
      setSelected(null);
      setBike("");
      setNotes("");
    },
    onError: (error: Error) => toast.error("Could not book", { description: error.message }),
  });

  function onBook(service: ServiceType) {
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    setSelected(service);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <p className="label-track text-primary">Workshop</p>
      <h1 className="mt-3 text-5xl sm:text-6xl">Mechanics who ride</h1>
      <p className="mt-4 max-w-xl text-muted-foreground">
        Drop the bike, get a written parts and labour quote, collect it dialled. Most jobs turn around
        inside 48 hours.
      </p>

      {isLoading ? (
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-40 w-full" />
          ))}
        </div>
      ) : (
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {(data ?? []).map((service) => (
            <Card key={service.id} className="border-border bg-card">
              <CardContent className="flex h-full flex-col p-6">
                <span className="grid size-11 place-items-center rounded-sm bg-secondary text-primary">
                  <Wrench className="size-5" aria-hidden="true" />
                </span>
                <h2 className="mt-5 text-3xl">{service.name}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{service.description}</p>
                <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="size-4" aria-hidden="true" />
                  {Math.round(service.duration_minutes / 60)}h in the stand
                </div>
                <div className="mt-6 flex items-end justify-between">
                  <p className="font-display text-3xl">{money(service.price_cents)}</p>
                  <Button
                    size="sm"
                    onClick={() => onBook(service)}
                    className="bg-heat text-primary-foreground hover:opacity-90"
                  >
                    Book slot
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
            <DialogTitle className="text-3xl">Book {selected?.name}</DialogTitle>
            <DialogDescription>
              Tell us what you're riding so the right mechanic takes the job.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div>
              <Label htmlFor="slot">Preferred date &amp; time</Label>
              <Input
                id="slot"
                type="datetime-local"
                value={slot}
                onChange={(event) => setSlot(event.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="bike">Your bike</Label>
              <Input
                id="bike"
                value={bike}
                onChange={(event) => setBike(event.target.value)}
                placeholder="2021 Specialized Allez, 105 groupset"
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="notes">What's wrong? (optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Rear shifting skips under load, front rim has a wobble."
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => book.mutate()}
              disabled={book.isPending || bike.trim().length < 3}
              className="bg-heat text-primary-foreground hover:opacity-90"
            >
              {book.isPending ? "Booking…" : "Confirm booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
