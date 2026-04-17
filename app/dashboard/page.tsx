import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PropertyCard } from "@/components/property-card";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Dashboard — Everyday Studio" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    .select(
      "id, address, city, state, zip, arv_estimate, buyer_persona, updated_at, property_photos(count)",
    )
    .order("updated_at", { ascending: false });

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-semibold">Properties</h1>
        <p className="mt-4 text-sm text-destructive">
          Failed to load properties: {error.message}
        </p>
      </div>
    );
  }

  const properties = data ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Properties</h1>
        <Link href="/properties/new" className={buttonVariants()}>
          <Plus />
          New property
        </Link>
      </div>

      {properties.length === 0 ? (
        <div className="rounded-xl border border-dashed px-6 py-16 text-center">
          <h2 className="text-lg font-medium">No properties yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first property to start uploading before-photos.
          </p>
          <div className="mt-6">
            <Link href="/properties/new" className={buttonVariants()}>
              <Plus />
              Create your first property
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((p) => {
            const photoCount = Array.isArray(p.property_photos)
              ? (p.property_photos[0]?.count ?? 0)
              : 0;
            return (
              <PropertyCard
                key={p.id}
                property={{
                  id: p.id,
                  address: p.address,
                  city: p.city,
                  state: p.state,
                  zip: p.zip,
                  arv_estimate: p.arv_estimate,
                  buyer_persona: p.buyer_persona,
                  updated_at: p.updated_at,
                }}
                photoCount={photoCount}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
