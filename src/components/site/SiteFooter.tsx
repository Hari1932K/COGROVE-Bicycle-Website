import { Link } from "@tanstack/react-router";
import { Bike } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card/40">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-sm bg-heat text-primary-foreground">
              <Bike className="size-5" aria-hidden="true" />
            </span>
            <span className="font-display text-2xl">COGROVE</span>
          </div>
          <p className="mt-4 max-w-sm text-sm text-muted-foreground">
            One garage for every ride: buy and sell used bikes, rent a machine for the weekend, book
            the workshop, and kit up with gear built to be thrashed.
          </p>
        </div>
        <div>
          <h2 className="label-track text-muted-foreground">Ride</h2>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link to="/marketplace" className="hover:text-primary">Marketplace</Link></li>
            <li><Link to="/rentals" className="hover:text-primary">Rentals</Link></li>
            <li><Link to="/services" className="hover:text-primary">Workshop</Link></li>
            <li><Link to="/shop" className="hover:text-primary">Gear shop</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="label-track text-muted-foreground">Crew</h2>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link to="/community" className="hover:text-primary">Community</Link></li>
            <li><Link to="/dashboard" className="hover:text-primary">My garage</Link></li>
            <li><Link to="/auth" className="hover:text-primary">Sign in</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border px-4 py-6 text-center text-xs text-muted-foreground sm:px-6">
        © {new Date().getFullYear()} Cogrove Cycles. Built for people who ride hard.
      </div>
    </footer>
  );
}
