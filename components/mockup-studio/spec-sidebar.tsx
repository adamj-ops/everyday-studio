import Link from "next/link";
import type { RoomSpec } from "@/lib/specs/schema";
import { Badge } from "@/components/ui/badge";

type Props = {
  spec: RoomSpec;
  version: number;
  propertyId: string;
  roomId: string;
};

export function SpecSidebar({ spec, version, propertyId, roomId }: Props) {
  const sections = buildSections(spec);

  return (
    <aside className="flex h-full flex-col gap-4 overflow-y-auto rounded-xl border p-4">
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">Locked spec</p>
          <h2 className="text-sm font-medium text-balance">{spec.room_name}</h2>
        </div>
        <Badge variant="secondary">v{version}</Badge>
      </header>

      <dl className="space-y-3 text-xs">
        {sections.map((section) => (
          <div key={section.label}>
            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {section.label}
            </dt>
            <dd className="mt-1 text-pretty text-foreground">{section.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-auto border-t pt-3 text-xs">
        <Link
          href={`/properties/${propertyId}/rooms/${roomId}/spec`}
          className="text-muted-foreground underline-offset-4 hover:underline"
        >
          Edit spec →
        </Link>
      </div>
    </aside>
  );
}

type Section = { label: string; value: string };

function buildSections(spec: RoomSpec): Section[] {
  const out: Section[] = [];

  out.push({
    label: "Room",
    value: `${spec.room_name} — ${spec.dimensions}, ${spec.ceiling_height} ceilings`,
  });

  if (spec.existing_to_keep.length) {
    out.push({ label: "Preserve", value: spec.existing_to_keep.join(", ") });
  }

  out.push({
    label: "Walls",
    value: `${spec.paint.walls.color_name}${
      spec.paint.walls.color_code ? ` (${spec.paint.walls.color_code})` : ""
    }, ${spec.paint.walls.sheen}`,
  });

  out.push({
    label: "Flooring",
    value: `${spec.flooring.color_tone.replace(/_/g, " ")} ${spec.flooring.material.replace(
      /_/g,
      " ",
    )}, ${spec.flooring.plank_or_tile_size}`,
  });

  if (spec.room_type === "kitchen") {
    out.push({
      label: "Cabinets",
      value: `${spec.cabinetry.style}, ${spec.cabinetry.color.color_name}, ${spec.cabinetry.hardware.finish.replace(/_/g, " ")} ${spec.cabinetry.hardware.type}`,
    });
    out.push({
      label: "Counters",
      value: `${spec.counters.material}${
        spec.counters.pattern_name ? ` (${spec.counters.pattern_name})` : ""
      }, ${spec.counters.thickness}`,
    });
    if (spec.backsplash.material !== "none") {
      out.push({
        label: "Backsplash",
        value: `${spec.backsplash.material.replace(/_/g, " ")}, ${spec.backsplash.tile_size}, ${spec.backsplash.pattern.replace(/_/g, " ")}`,
      });
    }
    if (spec.cabinetry.island.present) {
      out.push({
        label: "Island",
        value: `${spec.cabinetry.island.size}, ${spec.cabinetry.island.color.color_name}`,
      });
    }
  }

  if (
    spec.room_type === "primary_bath" ||
    spec.room_type === "secondary_bath" ||
    spec.room_type === "powder"
  ) {
    if (spec.vanity) {
      out.push({
        label: "Vanity",
        value: `${spec.vanity.width} ${spec.vanity.single_or_double}, ${spec.vanity.color.color_name}, ${spec.vanity.top_material}`,
      });
    }
    out.push({
      label: "Shower/tub",
      value: spec.shower_type.replace(/_/g, " "),
    });
  }

  const headlineFixtures = spec.lighting.fixtures.slice(0, 2).map(
    (f) => `${f.quantity}× ${f.finish.replace(/_/g, " ")} ${f.fixture_type.replace(/_/g, " ")}`,
  );
  if (headlineFixtures.length) {
    out.push({ label: "Lighting", value: headlineFixtures.join("; ") });
  }

  return out;
}
