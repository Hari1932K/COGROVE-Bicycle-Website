import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/community")({
  head: () => ({
    meta: [
      { title: "Rider Community | Cogrove" },
      {
        name: "description",
        content:
          "Meet the riders behind the listings: mechanics, commuters, racers and weekend explorers on Cogrove.",
      },
      { property: "og:title", content: "Rider Community | Cogrove" },
      {
        property: "og:description",
        content: "The people behind the bikes — mechanics, commuters, racers and explorers.",
      },
    ],
  }),
  component: Community,
});

function Community() {
  const { data, isLoading } = useQuery({
    queryKey: ["community-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,display_name,bio,location,avatar_url")
        .order("created_at", { ascending: false })
        .limit(24);
      if (error) throw error;
      return data;
    },
  });

  const riders = data ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <p className="label-track text-primary">Community</p>
      <h1 className="mt-3 text-5xl sm:text-6xl">The people behind the bikes</h1>
      <p className="mt-4 max-w-xl text-muted-foreground">
        Cogrove is a rider-to-rider network. Sellers, renters and wrenchers all share one profile, so
        you always know who you're dealing with.
      </p>

      {isLoading ? (
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-40 w-full" />
          ))}
        </div>
      ) : riders.length === 0 ? (
        <Card className="mt-10 border-border bg-card">
          <CardContent className="p-10 text-center">
            <Users className="mx-auto size-8 text-primary" aria-hidden="true" />
            <h2 className="mt-4 text-3xl">Be the first rider on the board</h2>
            <p className="mt-2 text-muted-foreground">
              Create an account and your profile shows up here for other riders.
            </p>
            <Button
              asChild
              className="mt-6 bg-heat text-primary-foreground shadow-heat hover:opacity-90"
            >
              <Link to="/auth">Join the crew</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {riders.map((rider) => (
            <Card key={rider.id} className="border-border bg-card">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <Avatar className="size-12">
                    {rider.avatar_url ? (
                      <AvatarImage src={rider.avatar_url} alt={rider.display_name} />
                    ) : null}
                    <AvatarFallback className="bg-secondary font-display text-xl">
                      {rider.display_name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-2xl">{rider.display_name}</h2>
                    {rider.location ? (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="size-3" aria-hidden="true" />
                        {rider.location}
                      </p>
                    ) : null}
                  </div>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  {rider.bio ?? "Rider on Cogrove."}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
