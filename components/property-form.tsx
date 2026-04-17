"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BUYER_PERSONA_OPTIONS } from "@/lib/specs/property";

export type PropertyFormValues = {
  address: string;
  city: string;
  state: string;
  zip: string;
  arv_estimate: number | null;
  buyer_persona: string | null;
};

type Props = {
  initial?: Partial<PropertyFormValues>;
  action: (formData: FormData) => Promise<{ error?: string } | void>;
  submitLabel?: string;
  onSuccess?: () => void;
  successToast?: string;
};

export function PropertyForm({
  initial,
  action,
  submitLabel = "Save",
  onSuccess,
  successToast,
}: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await action(formData);
      if (result && "error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      if (successToast) toast.success(successToast);
      onSuccess?.();
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <Input
          id="address"
          name="address"
          required
          maxLength={200}
          defaultValue={initial?.address ?? ""}
          placeholder="1234 Vincent Ave N"
          autoComplete="off"
        />
      </div>

      <div className="grid grid-cols-[1fr_6rem_8rem] gap-3">
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            name="city"
            required
            maxLength={80}
            defaultValue={initial?.city ?? ""}
            placeholder="Minneapolis"
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">State</Label>
          <Input
            id="state"
            name="state"
            required
            minLength={2}
            maxLength={2}
            defaultValue={initial?.state ?? "MN"}
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="zip">ZIP</Label>
          <Input
            id="zip"
            name="zip"
            required
            minLength={5}
            maxLength={10}
            defaultValue={initial?.zip ?? ""}
            placeholder="55411"
            autoComplete="off"
            inputMode="numeric"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="arv_estimate">ARV estimate (USD)</Label>
          <Input
            id="arv_estimate"
            name="arv_estimate"
            type="number"
            min={0}
            step={1000}
            defaultValue={initial?.arv_estimate ?? ""}
            placeholder="425000"
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="buyer_persona">Buyer persona</Label>
          <select
            id="buyer_persona"
            name="buyer_persona"
            defaultValue={initial?.buyer_persona ?? ""}
            className="flex h-9 w-full items-center rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          >
            <option value="">—</option>
            {BUYER_PERSONA_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
