"use client";

import { useState, type KeyboardEvent } from "react";
import { z } from "zod";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { unwrap } from "@/lib/specs/variant";
import { SuggestPopover } from "@/components/specs/suggest-popover";
import type { RoomSpec } from "@/lib/specs/schema";

// ---------------------------------------------------------------------------
// Humanize a field path segment. "color_name" -> "Color name".
// ---------------------------------------------------------------------------
function humanizeSegment(seg: string): string {
  return seg
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bUrl\b/, "URL")
    .replace(/\bSku\b/, "SKU");
}

function lastSegment(path: string): string {
  const parts = path.split(".");
  return parts[parts.length - 1];
}

// ---------------------------------------------------------------------------
// The suggest target: every field may offer one, but by convention we only
// expose it at the object level (cabinetry, counters, paint, etc.). The
// FieldRenderer accepts `suggestable` to control this; variant forms pass
// `true` only for the top of each section.
// ---------------------------------------------------------------------------
export interface FieldContext {
  roomType: RoomSpec["room_type"];
  roomId: string;
  getPartialSpec: () => Record<string, unknown>;
}

interface FieldProps {
  schema: z.ZodTypeAny;
  path: string;
  value: unknown;
  onChange: (path: string, value: unknown) => void;
  context: FieldContext;
  errors?: Record<string, string[]>;
  /** Show a ✨ Suggest button beside the label. Only the caller knows if it's appropriate. */
  suggestable?: boolean;
  /** Override the human label; default is derived from the last path segment. */
  label?: string;
}

export function FieldRenderer(props: FieldProps) {
  const { schema, path, value, onChange, errors, suggestable = false, label } = props;
  const leaf = unwrap(schema);

  // Handle object recursion.
  if (leaf instanceof z.ZodObject) {
    return <ObjectField {...props} schema={leaf} />;
  }

  // Handle arrays.
  if (leaf instanceof z.ZodArray) {
    return <ArrayField {...props} schema={leaf} />;
  }

  // Handle unions (e.g., cabinetry.island present:true | present:false).
  if (leaf instanceof z.ZodUnion) {
    return <UnionField {...props} schema={leaf} />;
  }

  // Leaf scalar: label + widget + error + optional suggest.
  const displayLabel = label ?? humanizeSegment(lastSegment(path));
  const fieldErrors = errors?.[path];

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Label htmlFor={path} className="text-sm font-medium">
          {displayLabel}
        </Label>
        {suggestable ? (
          <SuggestPopover
            fieldPath={path}
            context={props.context}
            onAccept={(v) => onChange(path, v)}
          />
        ) : null}
      </div>
      <LeafWidget
        schema={leaf}
        path={path}
        value={value}
        onChange={(v) => onChange(path, v)}
      />
      {fieldErrors?.length ? (
        <p className="text-xs text-destructive">{fieldErrors[0]}</p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Leaf widget: picks the right HTML based on the (already-unwrapped) Zod type.
// ---------------------------------------------------------------------------
function LeafWidget({
  schema,
  path,
  value,
  onChange,
}: {
  schema: z.ZodTypeAny;
  path: string;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (schema instanceof z.ZodEnum) {
    const options = schema.options as readonly string[];
    return (
      <Select
        value={typeof value === "string" ? value : ""}
        onValueChange={(v) => onChange(v)}
      >
        <SelectTrigger id={path}>
          <SelectValue placeholder="Select…" />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {humanizeSegment(opt)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (schema instanceof z.ZodBoolean) {
    return (
      <label className="inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-input"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>Yes</span>
      </label>
    );
  }

  if (schema instanceof z.ZodNumber) {
    return (
      <Input
        id={path}
        type="number"
        value={typeof value === "number" ? value : ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? undefined : Number(e.target.value))
        }
      />
    );
  }

  // ZodString and anything else fall back to text input. Long fields (notes,
  // reasoning) get a textarea based on the last path segment heuristic.
  const seg = lastSegment(path);
  const isLongText = /notes?$/i.test(seg) || seg === "reasoning";

  if (isLongText) {
    return (
      <Textarea
        id={path}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
        rows={3}
      />
    );
  }

  return (
    <Input
      id={path}
      type="text"
      value={typeof value === "string" ? value : ""}
      onChange={(e) => {
        const v = e.target.value;
        // If the original schema was nullable and the field is empty, preserve
        // null. Otherwise send an empty string (required-string Zod will flag it).
        onChange(v === "" ? null : v);
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// ObjectField: renders a sub-form for a Zod object, recursing per key. The
// first property inherits the `suggestable` flag (Suggest is at the top of
// the object); nested properties never get their own suggest.
// ---------------------------------------------------------------------------
function ObjectField({
  schema,
  path,
  value,
  onChange,
  context,
  errors,
  suggestable,
  label,
}: FieldProps & { schema: z.ZodObject<z.ZodRawShape> }) {
  const obj =
    typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const displayLabel = label ?? humanizeSegment(lastSegment(path));
  const shape = schema.shape as Record<string, z.ZodTypeAny>;
  // Depth heuristic from path: "paint" -> depth 0, "paint.walls" -> depth 1,
  // "cabinetry.hardware.product" -> depth 2. Controls visual prominence so a
  // designer reading the Paint block can scan Walls/Trim/Ceiling headings.
  const depth = path ? path.split(".").length - 1 : 0;

  return (
    <fieldset
      className={
        depth === 0
          ? "space-y-3 rounded-md border border-border p-3"
          : "space-y-2.5 rounded-md border border-border/60 bg-muted/30 p-3"
      }
    >
      {displayLabel ? (
        <div className="flex items-center gap-2">
          <legend
            className={
              depth === 0
                ? "text-sm font-semibold"
                : "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            }
          >
            {displayLabel}
          </legend>
          {suggestable ? (
            <SuggestPopover
              fieldPath={path}
              context={context}
              onAccept={(v) => onChange(path, v)}
            />
          ) : null}
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {Object.entries(shape).map(([key, child]) => {
          const childPath = path ? `${path}.${key}` : key;
          return (
            <FieldRenderer
              key={childPath}
              schema={child}
              path={childPath}
              value={obj[key]}
              onChange={onChange}
              context={context}
              errors={errors}
              suggestable={false}
            />
          );
        })}
      </div>
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// ArrayField: repeating rows. Scalar arrays (strings) render as a simple
// one-input-per-row list. Object arrays (appliances, tile_surfaces) render
// each item in a bordered card.
// ---------------------------------------------------------------------------
function ArrayField({
  schema,
  path,
  value,
  onChange,
  context,
  errors,
  label,
}: FieldProps & { schema: z.ZodArray<z.ZodTypeAny> }) {
  const items = Array.isArray(value) ? value : [];
  const element = schema.element;
  const elementLeaf = unwrap(element);
  const displayLabel = label ?? humanizeSegment(lastSegment(path));

  // Arrays of strings (existing_to_keep, location_notes lists) get a chip
  // input instead of a repeating-row-of-text-boxes. Nicer UX for tag-style
  // data where no per-item sub-fields exist.
  if (elementLeaf instanceof z.ZodString) {
    return (
      <StringArrayField
        items={items as string[]}
        onChange={(next) => onChange(path, next)}
        label={displayLabel}
      />
    );
  }

  function update(nextItems: unknown[]) {
    onChange(path, nextItems);
  }

  function addItem() {
    const blank = blankFor(elementLeaf);
    update([...items, blank]);
  }

  function removeItem(index: number) {
    update(items.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">{displayLabel}</Label>
        <Button type="button" variant="outline" size="sm" onClick={addItem}>
          <Plus className="mr-1 size-3" /> Add
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">No entries yet.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div
              key={i}
              className="relative rounded-md border border-border p-3 pr-10"
            >
              <button
                type="button"
                className="absolute right-2 top-2 text-muted-foreground hover:text-destructive"
                onClick={() => removeItem(i)}
                aria-label={`Remove item ${i + 1}`}
              >
                <Trash2 className="size-4" />
              </button>
              <FieldRenderer
                schema={element}
                path={`${path}.${i}`}
                value={item}
                onChange={(_subpath, newVal) => {
                  // Replace by index when the whole item changes
                  const next = [...items];
                  next[i] = applyPath(next[i], _subpath, newVal, `${path}.${i}`);
                  update(next);
                }}
                context={context}
                errors={errors}
                suggestable={false}
                label=""
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StringArrayField: chip input. Enter or comma adds a chip; Backspace on an
// empty input removes the last. Designed for fields like `existing_to_keep`
// where items are short freeform strings.
// ---------------------------------------------------------------------------
function StringArrayField({
  items,
  onChange,
  label,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  label: string;
}) {
  const [draft, setDraft] = useState("");

  function commit() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (items.includes(trimmed)) {
      setDraft("");
      return;
    }
    onChange([...items, trimmed]);
    setDraft("");
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && draft === "" && items.length > 0) {
      onChange(items.slice(0, -1));
    }
  }

  function removeAt(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-background p-1.5">
        {items.map((item, i) => (
          <span
            key={`${item}-${i}`}
            className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs"
          >
            {item}
            <button
              type="button"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => removeAt(i)}
              aria-label={`Remove ${item}`}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKey}
          onBlur={commit}
          placeholder={items.length === 0 ? "Type and press Enter" : ""}
          className="flex-1 min-w-[8ch] border-0 bg-transparent text-sm outline-none focus:ring-0"
        />
      </div>
    </div>
  );
}

/**
 * When a nested onChange fires with a path deeper than the array item root,
 * splice in the new value at the correct leaf. `itemPathPrefix` is the
 * array-item root (e.g. "appliances.0"); `incomingPath` is relative to the
 * full spec root.
 */
function applyPath(
  item: unknown,
  incomingPath: string,
  newValue: unknown,
  itemPathPrefix: string,
): unknown {
  if (incomingPath === itemPathPrefix) return newValue;
  if (!incomingPath.startsWith(`${itemPathPrefix}.`)) return item;
  const rel = incomingPath.slice(itemPathPrefix.length + 1);
  const segments = rel.split(".");
  const clone =
    typeof item === "object" && item !== null
      ? Array.isArray(item)
        ? [...item]
        : { ...item }
      : {};
  let cursor: Record<string, unknown> | unknown[] = clone as Record<string, unknown>;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    const key = /^\d+$/.test(seg) ? Number(seg) : seg;
    const existing = (cursor as Record<string, unknown>)[key as string];
    const next =
      typeof existing === "object" && existing !== null
        ? Array.isArray(existing)
          ? [...existing]
          : { ...existing }
        : /^\d+$/.test(segments[i + 1])
          ? []
          : {};
    (cursor as Record<string, unknown>)[key as string] = next;
    cursor = next as Record<string, unknown>;
  }
  const lastSeg = segments[segments.length - 1];
  const lastKey = /^\d+$/.test(lastSeg) ? Number(lastSeg) : lastSeg;
  (cursor as Record<string, unknown>)[lastKey as string] = newValue;
  return clone;
}

/**
 * Produce a reasonable blank for an array element. Objects recurse; scalars
 * get empty defaults matching lib/specs/defaults.ts conventions.
 */
function blankFor(schema: z.ZodTypeAny): unknown {
  const s = unwrap(schema);
  if (s instanceof z.ZodObject) {
    const shape = s.shape as Record<string, z.ZodTypeAny>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(shape)) {
      out[k] = blankFor(v);
    }
    return out;
  }
  if (s instanceof z.ZodArray) return [];
  if (s instanceof z.ZodBoolean) return false;
  if (s instanceof z.ZodNumber) return 0;
  if (s instanceof z.ZodEnum) return "";
  if (schema instanceof z.ZodNullable) return null;
  return "";
}

// ---------------------------------------------------------------------------
// UnionField: used for cabinetry.island { present: true | false }. Renders a
// simple toggle that switches between variants. Keeps the code honest —
// switches by inspecting literal types inside each union option.
// ---------------------------------------------------------------------------
function UnionField({
  schema,
  path,
  value,
  onChange,
  context,
  errors,
  label,
}: FieldProps & { schema: z.ZodUnion<[z.ZodTypeAny, ...z.ZodTypeAny[]]> }) {
  const options = schema.options;
  // Look for a z.literal("true/false") discriminator on a "present" field.
  const hasPresent = options.every(
    (o) =>
      o instanceof z.ZodObject &&
      (o.shape as Record<string, z.ZodTypeAny>)["present"] instanceof z.ZodLiteral,
  );
  const displayLabel = label ?? humanizeSegment(lastSegment(path));
  const current = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const present = current.present === true;

  if (!hasPresent) {
    // Fallback: render as readonly JSON — unsupported union shape.
    return (
      <div className="text-xs text-muted-foreground">
        Unsupported union at {path}; edit via raw JSON.
      </div>
    );
  }

  const presentOption = options.find(
    (o) =>
      o instanceof z.ZodObject &&
      (o.shape as Record<string, z.ZodTypeAny>)["present"] instanceof z.ZodLiteral &&
      ((o.shape as Record<string, z.ZodTypeAny>)["present"] as z.ZodLiteral<boolean>)
        ._def.value === true,
  ) as z.ZodObject<z.ZodRawShape> | undefined;

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">{displayLabel}</Label>
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-input"
            checked={present}
            onChange={(e) => {
              if (e.target.checked) {
                onChange(path, blankFor(presentOption ?? options[0]));
              } else {
                onChange(path, { present: false });
              }
            }}
          />
          <span>Present</span>
        </label>
      </div>
      {present && presentOption ? (
        <ObjectField
          schema={presentOption}
          path={path}
          value={value}
          onChange={onChange}
          context={context}
          errors={errors}
          label=""
        />
      ) : null}
    </div>
  );
}
