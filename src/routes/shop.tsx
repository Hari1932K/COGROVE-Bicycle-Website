import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { money, prettyLabel } from "@/lib/format";

export const Route = createFileRoute("/shop")({
  head: () => ({
    meta: [
      { title: "Cycling Gear Shop — Helmets, Lights, Tools | Cogrove" },
      {
        name: "description",
        content:
          "Shop helmets, lights, apparel, tools and bikepacking bags picked by Cogrove mechanics and stocked for real riding.",
      },
      { property: "og:title", content: "Cycling Gear Shop | Cogrove" },
      {
        property: "og:description",
        content: "Helmets, lights, apparel, tools and bags chosen by working mechanics.",
      },
    ],
  }),
  component: Shop,
});

type Product = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  price_cents: number;
  image_url: string | null;
  stock: number;
};

function Shop() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [cart, setCart] = useState<Record<string, number>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("category");
      if (error) throw error;
      return data as Product[];
    },
  });

  const products = data ?? [];

  const lines = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, qty]) => {
          const product = products.find((item) => item.id === id);
          return product ? { product, qty } : null;
        })
        .filter((line): line is { product: Product; qty: number } => Boolean(line)),
    [cart, products],
  );

  const total = lines.reduce((sum, line) => sum + line.product.price_cents * line.qty, 0);

  const checkout = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("orders").insert({
        user_id: user!.id,
        total_cents: total,
        items: lines.map((line) => ({
          product_id: line.product.id,
          name: line.product.name,
          quantity: line.qty,
          price_cents: line.product.price_cents,
        })),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Order placed", { description: "Receipt is in your garage." });
      queryClient.invalidateQueries({ queryKey: ["my-orders"] });
      setCart({});
    },
    onError: (error: Error) => toast.error("Checkout failed", { description: error.message }),
  });

  function add(id: string) {
    setCart((current) => ({ ...current, [id]: (current[id] ?? 0) + 1 }));
  }

  function remove(id: string) {
    setCart((current) => {
      const next = { ...current };
      const qty = (next[id] ?? 0) - 1;
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });
  }

  function onCheckout() {
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    checkout.mutate();
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <p className="label-track text-primary">Gear shop</p>
      <h1 className="mt-3 text-5xl sm:text-6xl">Kit that survives you</h1>
      <p className="mt-4 max-w-xl text-muted-foreground">
        Chosen by the mechanics who fix your bike, not by a marketing team.
      </p>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_20rem]">
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="aspect-[4/3] w-full" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => (
              <Card key={product.id} className="overflow-hidden border-border bg-card p-0">
                <img
                  src={product.image_url ?? "/images/gear-tools.jpg"}
                  alt={product.name}
                  loading="lazy"
                  width={1200}
                  height={800}
                  className="aspect-[3/2] w-full object-cover"
                />
                <CardContent className="p-5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="label-track text-primary">{prettyLabel(product.category)}</p>
                    {product.stock > 0 ? null : <Badge variant="secondary">Backorder</Badge>}
                  </div>
                  <h2 className="mt-2 text-2xl">{product.name}</h2>
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                    {product.description}
                  </p>
                  <div className="mt-5 flex items-center justify-between">
                    <p className="font-display text-3xl">{money(product.price_cents)}</p>
                    {cart[product.id] ? (
                      <div className="flex items-center gap-2">
                        <Button
                          size="icon"
                          variant="outline"
                          aria-label={`Remove one ${product.name}`}
                          onClick={() => remove(product.id)}
                        >
                          <Minus className="size-4" aria-hidden="true" />
                        </Button>
                        <span className="w-6 text-center font-display text-xl">
                          {cart[product.id]}
                        </span>
                        <Button
                          size="icon"
                          aria-label={`Add one ${product.name}`}
                          onClick={() => add(product.id)}
                          className="bg-heat text-primary-foreground hover:opacity-90"
                        >
                          <Plus className="size-4" aria-hidden="true" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => add(product.id)}
                        className="bg-heat text-primary-foreground hover:opacity-90"
                      >
                        Add
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <aside className="h-fit rounded-sm border border-border bg-card p-6 lg:sticky lg:top-24">
          <h2 className="flex items-center gap-2 text-2xl">
            <ShoppingBag className="size-5 text-primary" aria-hidden="true" />
            Your cart
          </h2>
          {lines.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Nothing in the cart yet. Add some kit.
            </p>
          ) : (
            <>
              <ul className="mt-5 space-y-3 text-sm">
                {lines.map(({ product, qty }) => (
                  <li key={product.id} className="flex justify-between gap-3">
                    <span className="text-muted-foreground">
                      {qty} × {product.name}
                    </span>
                    <span>{money(product.price_cents * qty)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex items-end justify-between border-t border-border pt-4">
                <span className="label-track text-muted-foreground">Total</span>
                <span className="font-display text-3xl">{money(total)}</span>
              </div>
              <Button
                onClick={onCheckout}
                disabled={checkout.isPending}
                className="mt-5 w-full bg-heat text-primary-foreground shadow-heat hover:opacity-90"
              >
                {checkout.isPending ? "Placing order…" : user ? "Checkout" : "Sign in to checkout"}
              </Button>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
