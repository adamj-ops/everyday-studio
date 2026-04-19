import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { RoomBriefRow, ProjectThemeRow } from "@/lib/briefs/schema";
import { budgetTierLabel, themePresetLabel } from "@/lib/briefs/themes";
import { questionsForRoom } from "@/lib/briefs/questions";
import { categoriesForRoom } from "@/lib/briefs/categories";
import { roomTypeLabel } from "@/lib/briefs/room-types";

type Props = {
  brief: RoomBriefRow | null;
  projectTheme: ProjectThemeRow | null;
  roomType: string;
  roomLabel: string;
  propertyId: string;
  roomId: string;
};

export function BriefSidebar({
  brief,
  projectTheme,
  roomType,
  roomLabel,
  propertyId,
  roomId,
}: Props) {
  return (
    <aside className="flex h-full flex-col gap-4 overflow-y-auto rounded-xl border border-border p-4 text-sm">
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">Brief</p>
          <h2 className="text-pretty text-sm font-medium">
            {roomLabel} · {roomTypeLabel(roomType)}
          </h2>
        </div>
        {brief ? (
          <Badge variant="secondary" className="tabular-nums">
            v{brief.version}
          </Badge>
        ) : (
          <Badge variant="outline">no brief</Badge>
        )}
      </header>

      {projectTheme && (
        <section className="space-y-1">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Theme
          </p>
          <p className="text-xs">
            {budgetTierLabel(projectTheme.budget_tier)}
            {projectTheme.theme_preset ? ` · ${themePresetLabel(projectTheme.theme_preset)}` : ""}
          </p>
        </section>
      )}

      {brief && (
        <>
          <section className="space-y-1">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Creative direction
            </p>
            <BriefAnswers brief={brief} roomType={roomType} />
          </section>

          {brief.non_negotiables && brief.non_negotiables.trim() && (
            <section className="space-y-1">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Non-negotiables
              </p>
              <p className="text-pretty text-xs text-foreground">
                {brief.non_negotiables}
              </p>
            </section>
          )}

          <section className="space-y-1">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Moodboard
            </p>
            <BriefCategoryCounts brief={brief} roomType={roomType} />
          </section>
        </>
      )}

      <div className="mt-auto border-t pt-3 text-xs">
        <Link
          href={`/properties/${propertyId}/rooms/${roomId}/brief`}
          className="text-muted-foreground underline-offset-4 hover:underline"
        >
          Edit brief →
        </Link>
      </div>
    </aside>
  );
}

function BriefAnswers({ brief, roomType }: { brief: RoomBriefRow; roomType: string }) {
  const questions = questionsForRoom(roomType);
  const lines = questions
    .map((q) => {
      const a = brief.creative_answers[q.key];
      if (typeof a !== "string" || a.trim() === "") return null;
      return { prompt: q.prompt, answer: a.trim() };
    })
    .filter((x): x is { prompt: string; answer: string } => x !== null);

  if (lines.length === 0) {
    return <p className="text-xs text-muted-foreground">(none)</p>;
  }
  return (
    <dl className="space-y-2">
      {lines.map((l, idx) => (
        <div key={idx}>
          <dt className="text-[11px] text-muted-foreground line-clamp-1">{l.prompt}</dt>
          <dd className="text-pretty text-xs text-foreground line-clamp-3">{l.answer}</dd>
        </div>
      ))}
    </dl>
  );
}

function BriefCategoryCounts({ brief, roomType }: { brief: RoomBriefRow; roomType: string }) {
  const categories = categoriesForRoom(roomType);
  const byKey = new Map(
    brief.category_moodboards.map((cm) => [cm.category_key, cm]),
  );
  return (
    <ul className="space-y-1 text-xs">
      {categories.map((cat) => {
        const cm = byKey.get(cat.key);
        const count = cm?.image_storage_paths.length ?? 0;
        return (
          <li key={cat.key} className="flex items-center justify-between gap-2">
            <span className="truncate">{cat.label}</span>
            <span className="tabular-nums text-muted-foreground">{count}</span>
          </li>
        );
      })}
    </ul>
  );
}
