import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { money, prettyLabel } from "@/lib/format";

const CATEGORIES = ["all", "road", "mountain", "gravel", "city", "ebike", "bmx", "kids"] as const;

export const Route = createFileRoute("/marketplace")({
  head: () => ({
    meta: [
      { title: "Used Bike Marketplace | Cogrove" },
      {
        name: "description",
        content:
          "Browse condition-graded used road, gravel, mountain, city and electric bikes listed by riders on Cogrove.",
      },
      { property: "og:title", content: "Used Bike Marketplace | Cogrove" },
      {
        property: "og:description",
        content: "Condition-graded used bikes from riders near you, listed on Cogrove.",
      },
    ],
  }),
  component: Marketplace,
});

function Marketplace() {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("all");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["listings", category],
    queryFn: async () => {
      let query = supabase
        .from("listings")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (category !== "all") query = query.eq("category", category);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const term = search.trim().toLowerCase();
  const bikes = (data ?? []).filter((bike) =>
    term
      ? `${bike.title} ${bike.brand} ${bike.model ?? ""} ${bike.location ?? ""}`
          .toLowerCase()
          .includes(term)
      : true,
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <p className="label-track text-primary">Marketplace</p>
      <h1 className="mt-3 text-5xl sm:text-6xl">Second-hand, first-rate</h1>
      <p className="mt-4 max-w-xl text-muted-foreground">
        Every bike is graded on condition before it goes live. Filter by discipline, then message the
        seller from your garage.
      </p>

      <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((value) => (
            <Button
              key={value}
              size="sm"
              variant={category === value ? "default" : "outline"}
              className={category === value ? "bg-heat text-primary-foreground" : ""}
              onClick={() => setCategory(value)}
            >
              {value === "all" ? "All bikes" : prettyLabel(value)}
            </Button>
          ))}
        </div>
        <div className="lg:ml-auto lg:w-72">
          <label htmlFor="listing-search" className="label-track text-muted-foreground">
            Search
          </label>
          <Input
            id="listing-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Brand, model or city"
            className="mt-2"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="aspect-[4/3] w-full" />
          ))}
        </div>
      ) : bikes.length === 0 ? (
        <p className="mt-16 text-center text-muted-foreground">
          No bikes match that filter yet. Try another discipline.
        </p>
      ) : (
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bikes.map((bike) => (
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
                <div className="flex items-center justify-between gap-2">
                  <p className="label-track text-primary">{prettyLabel(bike.category)}</p>
                  <Badge variant="outline">{prettyLabel(bike.condition)}</Badge>
                </div>
                <h2 className="mt-2 text-2xl">{bike.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {bike.brand}
                  {bike.model ? ` ${bike.model}` : ""}
                  {bike.year ? ` · ${bike.year}` : ""}
                  {bike.frame_size ? ` · ${bike.frame_size}` : ""}
                </p>
                {bike.description ? (
                  <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                    {bike.description}
                  </p>
                ) : null}
                <div className="mt-5 flex items-end justify-between">
                  <p className="font-display text-3xl">{money(bike.price_cents)}</p>
                  <span className="text-xs text-muted-foreground">
                    {bike.location ?? "Local pickup"}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-16 rounded-sm border border-border bg-card/50 p-8 text-center">
        <h2 className="text-3xl">Got a bike gathering dust?</h2>
        <p className="mt-2 text-muted-foreground">
          List it in under a minute from your garage and reach riders in your city.
        </p>
        <Button asChild className="mt-6 bg-heat text-primary-foreground shadow-heat hover:opacity-90">
          <Link to="/dashboard">List a bike</Link>
        </Button>
      </div>
    </div>
  );
}
