"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CreatePropertyInput, PatchPropertyInput } from "@/lib/specs/property";
import { BuyerPersonaEnum } from "@/lib/specs/schema";

type ActionResult = { error?: string };

function toNumberOrNull(value: FormDataEntryValue | null): number | null | undefined {
  if (value == null) return undefined;
  const str = String(value).trim();
  if (str === "") return null;
  const n = Number(str);
  return Number.isFinite(n) ? n : undefined;
}

function toPersonaOrNull(value: FormDataEntryValue | null) {
  if (value == null) return undefined;
  const str = String(value).trim();
  if (str === "") return null;
  const parsed = BuyerPersonaEnum.safeParse(str);
  return parsed.success ? parsed.data : undefined;
}

export async function createProperty(formData: FormData): Promise<ActionResult | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const input = {
    address: String(formData.get("address") ?? "").trim(),
    city: String(formData.get("city") ?? "").trim(),
    state: String(formData.get("state") ?? "MN").trim().toUpperCase(),
    zip: String(formData.get("zip") ?? "").trim(),
    arv_estimate: toNumberOrNull(formData.get("arv_estimate")),
    buyer_persona: toPersonaOrNull(formData.get("buyer_persona")),
  };

  const parsed = CreatePropertyInput.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: first ? `${first.path.join(".")}: ${first.message}` : "Invalid input." };
  }

  const { data, error } = await supabase
    .from("properties")
    .insert({ ...parsed.data, owner_id: user.id })
    .select()
    .single();
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  redirect(`/properties/${data.id}`);
}

export async function updateProperty(
  id: string,
  formData: FormData,
): Promise<ActionResult | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const input = {
    address: String(formData.get("address") ?? "").trim(),
    city: String(formData.get("city") ?? "").trim(),
    state: String(formData.get("state") ?? "").trim().toUpperCase(),
    zip: String(formData.get("zip") ?? "").trim(),
    arv_estimate: toNumberOrNull(formData.get("arv_estimate")),
    buyer_persona: toPersonaOrNull(formData.get("buyer_persona")),
  };

  const parsed = PatchPropertyInput.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: first ? `${first.path.join(".")}: ${first.message}` : "Invalid input." };
  }

  const { error } = await supabase
    .from("properties")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath(`/properties/${id}`);
}
