import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { money, prettyLabel } from "@/lib/format";
import type { Database } from "@/integrations/supabase/types";

type Category = Database["public"]["Enums"]["bike_category"];
type Condition = Database["public"]["Enums"]["bike_condition"];

const CATEGORIES: Category[] = ["road", "mountain", "gravel", "city", "ebike", "bmx", "kids"];
const CONDITIONS: Condition[] = ["new", "like_new", "good", "fair", "project"];

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "My Garage — Listings, Rentals & Orders | Cogrove" },
      {
        name: "description",
        content:
          "Manage your Cogrove bike listings, rental reservations, workshop bookings and gear orders in one place.",
      },
      { property: "og:title", content: "My Garage | Cogrove" },
      {
        property: "og:description",
        content: "Your listings, rentals, workshop bookings and orders.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const [form, setForm] = useState({
    title: "",
    brand: "",
    model: "",
    price: "",
    category: "road" as Category,
    condition: "good" as Condition,
    location: "",
    description: "",
  });

  const listings = useQuery({
    queryKey: ["my-listings", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("seller_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const rentals = useQuery({
    queryKey: ["my-rentals", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rental_bookings")
        .select("*, rental_bikes(name, image_url)")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const services = useQuery({
    queryKey: ["my-services", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_bookings")
        .select("*, service_types(name, price_cents)")
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const orders = useQuery({
    queryKey: ["my-orders", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createListing = useMutation({
    mutationFn: async () => {
      const priceCents = Math.round(Number(form.price) * 100);
      if (!priceCents || priceCents < 0) throw new Error("Enter a valid price");
      const { error } = await supabase.from("listings").insert({
        seller_id: userId!,
        title: form.title,
        brand: form.brand,
        model: form.model || null,
        price_cents: priceCents,
        category: form.category,
        condition: form.condition,
        location: form.location || null,
        description: form.description || null,
        image_url: `/images/bike-${form.category === "ebike" ? "ebike" : form.category === "mountain" ? "mountain" : form.category === "gravel" ? "gravel" : form.category === "city" ? "city" : "road"}.jpg`,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Listing published");
      setForm({
        title: "",
        brand: "",
        model: "",
        price: "",
        category: "road",
        condition: "good",
        location: "",
        description: "",
      });
      queryClient.invalidateQueries({ queryKey: ["my-listings"] });
      queryClient.invalidateQueries({ queryKey: ["listings"] });
    },
    onError: (error: Error) => toast.error("Could not publish", { description: error.message }),
  });

  const removeListing = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("listings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Listing removed");
      queryClient.invalidateQueries({ queryKey: ["my-listings"] });
      queryClient.invalidateQueries({ queryKey: ["listings"] });
    },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <p className="label-track text-primary">My garage</p>
      <h1 className="mt-3 text-5xl sm:text-6xl">
        {user?.email ? user.email.split("@")[0] : "Rider"}'s garage
      </h1>

      <Tabs defaultValue="listings" className="mt-10">
        <TabsList className="flex w-full flex-wrap">
          <TabsTrigger value="listings">Listings</TabsTrigger>
          <TabsTrigger value="rentals">Rentals</TabsTrigger>
          <TabsTrigger value="workshop">Workshop</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="listings" className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]">
          <div className="grid gap-4">
            {(listings.data ?? []).length === 0 ? (
              <p className="text-muted-foreground">
                No listings yet. Publish your first bike on the right.
              </p>
            ) : (
              (listings.data ?? []).map((bike) => (
                <Card key={bike.id} className="border-border bg-card">
                  <CardContent className="flex flex-wrap items-center gap-4 p-5">
                    <img
                      src={bike.image_url ?? "/images/bike-road.jpg"}
                      alt={bike.title}
                      loading="lazy"
                      width={1200}
                      height={800}
                      className="h-20 w-28 rounded-sm object-cover"
                    />
                    <div className="min-w-40 flex-1">
                      <h2 className="text-2xl">{bike.title}</h2>
                      <p className="text-sm text-muted-foreground">
                        {prettyLabel(bike.category)} · {prettyLabel(bike.condition)}
                      </p>
                    </div>
                    <p className="font-display text-2xl">{money(bike.price_cents)}</p>
                    <Badge variant="outline">{prettyLabel(bike.status)}</Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeListing.mutate(bike.id)}
                    >
                      Remove
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          <Card className="h-fit border-border bg-card">
            <CardContent className="p-6">
              <h2 className="text-2xl">List a bike</h2>
              <form
                className="mt-5 grid gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  createListing.mutate();
                }}
              >
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    required
                    value={form.title}
                    onChange={(event) => setForm({ ...form, title: event.target.value })}
                    className="mt-2"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="brand">Brand</Label>
                    <Input
                      id="brand"
                      required
                      value={form.brand}
                      onChange={(event) => setForm({ ...form, brand: event.target.value })}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="model">Model</Label>
                    <Input
                      id="model"
                      value={form.model}
                      onChange={(event) => setForm({ ...form, model: event.target.value })}
                      className="mt-2"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="price">Price (USD)</Label>
                    <Input
                      id="price"
                      type="number"
                      min="1"
                      required
                      value={form.price}
                      onChange={(event) => setForm({ ...form, price: event.target.value })}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="location">City</Label>
                    <Input
                      id="location"
                      value={form.location}
                      onChange={(event) => setForm({ ...form, location: event.target.value })}
                      className="mt-2"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Category</Label>
                    <Select
                      value={form.category}
                      onValueChange={(value) => setForm({ ...form, category: value as Category })}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((value) => (
                          <SelectItem key={value} value={value}>
                            {prettyLabel(value)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Condition</Label>
                    <Select
                      value={form.condition}
                      onValueChange={(value) => setForm({ ...form, condition: value as Condition })}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONDITIONS.map((value) => (
                          <SelectItem key={value} value={value}>
                            {prettyLabel(value)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={form.description}
                    onChange={(event) => setForm({ ...form, description: event.target.value })}
                    className="mt-2"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={createListing.isPending}
                  className="bg-heat text-primary-foreground shadow-heat hover:opacity-90"
                >
                  {createListing.isPending ? "Publishing…" : "Publish listing"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rentals" className="mt-6 grid gap-4">
          {(rentals.data ?? []).length === 0 ? (
            <p className="text-muted-foreground">No rental reservations yet.</p>
          ) : (
            (rentals.data ?? []).map((booking) => (
              <Card key={booking.id} className="border-border bg-card">
                <CardContent className="flex flex-wrap items-center gap-4 p-5">
                  <div className="min-w-40 flex-1">
                    <h2 className="text-2xl">{booking.rental_bikes?.name ?? "Rental bike"}</h2>
                    <p className="text-sm text-muted-foreground">
                      {booking.start_date} → {booking.end_date}
                    </p>
                  </div>
                  <p className="font-display text-2xl">{money(booking.total_cents)}</p>
                  <Badge variant="outline">{prettyLabel(booking.status)}</Badge>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="workshop" className="mt-6 grid gap-4">
          {(services.data ?? []).length === 0 ? (
            <p className="text-muted-foreground">No workshop bookings yet.</p>
          ) : (
            (services.data ?? []).map((booking) => (
              <Card key={booking.id} className="border-border bg-card">
                <CardContent className="flex flex-wrap items-center gap-4 p-5">
                  <div className="min-w-40 flex-1">
                    <h2 className="text-2xl">{booking.service_types?.name ?? "Service"}</h2>
                    <p className="text-sm text-muted-foreground">
                      {new Date(booking.scheduled_at).toLocaleString()} · {booking.bike_description}
                    </p>
                  </div>
                  <p className="font-display text-2xl">
                    {money(booking.service_types?.price_cents ?? 0)}
                  </p>
                  <Badge variant="outline">{prettyLabel(booking.status)}</Badge>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="orders" className="mt-6 grid gap-4">
          {(orders.data ?? []).length === 0 ? (
            <p className="text-muted-foreground">No gear orders yet.</p>
          ) : (
            (orders.data ?? []).map((order) => (
              <Card key={order.id} className="border-border bg-card">
                <CardContent className="flex flex-wrap items-center gap-4 p-5">
                  <div className="min-w-40 flex-1">
                    <h2 className="text-2xl">Order {order.id.slice(0, 8)}</h2>
                    <p className="text-sm text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString()} ·{" "}
                      {Array.isArray(order.items) ? order.items.length : 0} item(s)
                    </p>
                  </div>
                  <p className="font-display text-2xl">{money(order.total_cents)}</p>
                  <Badge variant="outline">{prettyLabel(order.status)}</Badge>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
