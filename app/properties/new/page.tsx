import Link from "next/link";
import { PropertyForm } from "@/components/property-form";
import { createProperty } from "@/app/actions/properties";

export const metadata = { title: "New property — Everyday Studio" };

export default function NewPropertyPage() {
  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">New property</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Quick setup — you can edit these later.
        </p>
      </div>
      <PropertyForm
        action={createProperty}
        submitLabel="Create property"
        successToast="Property created"
      />
    </div>
  );
}
