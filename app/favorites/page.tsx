import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FavoritesClient } from "./favorites-client";

export const metadata = { title: "Favorites — Everyday Studio" };

export default async function FavoritesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <FavoritesClient />;
}
