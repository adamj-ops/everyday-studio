"use client";

import { z } from "zod";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FieldRenderer, type FieldContext } from "@/components/specs/field";
import { getVariantSchema, sectionsFor, unwrap } from "@/lib/specs/variant";
import type { RoomSpec } from "@/lib/specs/schema";

interface Props {
  spec: RoomSpec;
  errors?: Record<string, string[]>;
  onChange: (path: string, value: unknown) => void;
  context: FieldContext;
}

/**
 * Data-driven form: sections come from sectionsFor(room_type), field schemas
 * come from <Variant>Schema.shape, widgets come from FieldRenderer. No
 * variant-specific logic here — the four "variant forms" the plan called for
 * collapsed into this one component because they shared 100% of the
 * scaffolding. Adding per-variant customization means adding a case to
 * sectionsFor(); no code changes here.
 */
export function VariantForm({ spec, errors, onChange, context }: Props) {
  const sections = sectionsFor(spec.room_type);
  const schema = getVariantSchema(spec.room_type);
  const shape =
    unwrap(schema) instanceof z.ZodObject
      ? (unwrap(schema) as z.ZodObject<z.ZodRawShape>).shape
      : ({} as Record<string, z.ZodTypeAny>);

  return (
    <Accordion multiple defaultValue={sections.map((s) => s.key)}>
      {sections.map((section) => (
        <AccordionItem key={section.key} value={section.key}>
          <AccordionTrigger className="text-base font-medium">
            {section.label}
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pt-2">
              {section.fields.map((fieldPath) => {
                const topKey = fieldPath.split(".")[0];
                const fieldSchema = shape[topKey];
                if (!fieldSchema) return null;
                const value = (spec as unknown as Record<string, unknown>)[topKey];
                return (
                  <FieldRenderer
                    key={fieldPath}
                    schema={fieldSchema}
                    path={topKey}
                    value={value}
                    onChange={onChange}
                    context={context}
                    errors={errors}
                    suggestable={isSuggestable(topKey)}
                  />
                );
              })}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

/**
 * Fields worth surfacing a ✨ Suggest button on. Anything that's a high-level
 * material choice or object group gets one; housekeeping fields (room_name,
 * dimensions, estimated cost) don't — Sonnet doesn't add value there.
 */
function isSuggestable(topKey: string): boolean {
  const suggestable = new Set([
    "cabinetry",
    "counters",
    "backsplash",
    "paint",
    "flooring",
    "lighting",
    "vanity",
    "tile_surfaces",
    "appliances",
    "plumbing",
    "fireplace",
  ]);
  return suggestable.has(topKey);
}
