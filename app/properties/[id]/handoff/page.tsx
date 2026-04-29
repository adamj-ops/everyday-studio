import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HandoffPrintButton } from "@/components/handoff/handoff-print-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { questionsForSpace } from "@/lib/briefs/questions";
import { spaceTypeLabel } from "@/lib/briefs/space-types";
import { budgetTierLabel, themePresetLabel } from "@/lib/briefs/themes";
import {
  buildDesignDirectionSummary,
  loadHandoffData,
} from "@/lib/handoff/query";
import { buyerPersonaLabel, formatUsd } from "@/lib/properties/property";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata = { title: "GC handoff — Everyday Studio" };

function NonNegotiablesBlock({ text }: { text: string | null }) {
  const t = (text ?? "").trim();
  if (!t) return null;
  const lines = t
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (lines.length <= 1) {
    return (
      <div>
        <h3 className="text-sm font-semibold text-foreground">Must-haves and constraints</h3>
        <p className="mt-2 text-pretty text-sm leading-relaxed text-foreground">{t}</p>
      </div>
    );
  }
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">Must-haves and constraints</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-pretty text-sm leading-relaxed">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

export default async function HandoffPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: propertyId } = await params;
  const supabase = await createClient();
  const data = await loadHandoffData(supabase, propertyId);
  if (!data) notFound();

  const { property, theme, spaces } = data;
  const summary = buildDesignDirectionSummary(data);
  const generatedLabel = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div
      data-handoff-page
      className="handoff-document mx-auto max-w-[1000px] space-y-10 pb-16 pt-4 leading-relaxed"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href={`/properties/${propertyId}`}
            className="text-sm text-muted-foreground underline-offset-4 hover:underline print:hidden"
          >
            ← Property
          </Link>
          <h1 className="mt-3 text-balance text-2xl font-semibold tracking-tight md:text-3xl">
            Project handoff
          </h1>
          <p className="mt-1 text-pretty text-sm text-muted-foreground print:hidden">
            For contractor and investor reference. Use Download PDF to save via your browser.
          </p>
        </div>
        <HandoffPrintButton />
      </div>

      <header className="space-y-4 border-b border-border pb-8">
        <h2 className="text-balance text-xl font-semibold">{property.address}</h2>
        <p className="text-pretty text-muted-foreground">
          {property.city}, {property.state} {property.zip}
        </p>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          {property.arv_estimate != null ? (
            <div>
              <dt className="text-xs text-muted-foreground">ARV</dt>
              <dd className="tabular-nums">{formatUsd(property.arv_estimate)}</dd>
            </div>
          ) : null}
          {property.buyer_persona ? (
            <div>
              <dt className="text-xs text-muted-foreground">Target buyer</dt>
              <dd>{buyerPersonaLabel(property.buyer_persona)}</dd>
            </div>
          ) : null}
          {theme ? (
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted-foreground">Theme and budget</dt>
              <dd>
                {theme.theme_preset
                  ? themePresetLabel(theme.theme_preset)
                  : "Custom direction"}
                <span className="text-muted-foreground"> · </span>
                {budgetTierLabel(theme.budget_tier)}
              </dd>
            </div>
          ) : null}
        </dl>
      </header>

      {spaces.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No room briefs yet</CardTitle>
            <CardDescription className="text-pretty">
              Add a room brief to start generating the handoff document.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href={`/properties/${propertyId}`}
              className={buttonVariants({ variant: "default", size: "sm" })}
            >
              Back to property
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <section
            className="space-y-3"
            aria-labelledby={`handoff-design-direction-${propertyId}`}
          >
            <h2
              id={`handoff-design-direction-${propertyId}`}
              className="text-balance text-lg font-semibold"
            >
              Design direction
            </h2>
            <p className="text-pretty text-sm leading-[1.65] text-foreground">{summary}</p>
          </section>

          {spaces.map((block, index) => {
            const qs = questionsForSpace(block.room.space_type);
            const answers = block.brief.creative_answers ?? {};
            const qaItems = qs
              .map((q) => {
                const raw = answers[q.key];
                const v = typeof raw === "string" ? raw.trim() : "";
                if (!v) return null;
                return { prompt: q.prompt, answer: v };
              })
              .filter((x): x is { prompt: string; answer: string } => x != null);

            return (
              <section
                key={block.room.id}
                className={cn(
                  "handoff-room space-y-6 border-b border-border pb-10",
                  index > 0 && "break-before-page pt-8",
                )}
                aria-labelledby={`room-heading-${block.room.id}`}
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <h2
                    id={`room-heading-${block.room.id}`}
                    className="text-balance text-xl font-semibold"
                  >
                    {block.room.label}
                  </h2>
                  <Badge variant="secondary" className="font-normal">
                    {spaceTypeLabel(block.room.space_type)}
                  </Badge>
                  <span className="text-xs text-muted-foreground print:inline">
                    Brief v{block.briefVersion}
                  </span>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <figure className="space-y-2">
                    <figcaption className="text-xs font-medium text-muted-foreground">
                      Before
                    </figcaption>
                    <div className="relative aspect-[4/3] overflow-hidden rounded-lg border bg-muted/30">
                      {block.beforePhoto?.signedUrl ? (
                        <Image
                          src={block.beforePhoto.signedUrl}
                          alt={`Before — ${block.room.label}`}
                          fill
                          sizes="(max-width: 768px) 100vw, 500px"
                          className="object-contain"
                          unoptimized
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center p-4 text-center text-sm text-muted-foreground">
                          No before photo for this room
                        </div>
                      )}
                    </div>
                  </figure>
                  <figure className="space-y-2">
                    <figcaption className="text-xs font-medium text-muted-foreground">
                      Render
                    </figcaption>
                    <div className="relative aspect-[4/3] overflow-hidden rounded-lg border bg-muted/30">
                      {block.latestRender?.signedUrl ? (
                        <Image
                          src={block.latestRender.signedUrl}
                          alt={`Render — ${block.room.label}`}
                          fill
                          sizes="(max-width: 768px) 100vw, 500px"
                          className="object-contain"
                          unoptimized
                        />
                      ) : (
                        <div className="flex size-full flex-col items-center justify-center gap-1 p-4 text-center text-sm text-muted-foreground">
                          <span>Render in progress</span>
                          <span className="text-xs">No completed render yet for this room.</span>
                        </div>
                      )}
                    </div>
                  </figure>
                </div>

                {qaItems.length > 0 ? (
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Creative direction</h3>
                    <dl className="mt-3 space-y-4">
                      {qaItems.map((item, qi) => (
                        <div key={`${block.room.id}-qa-${qi}`}>
                          <dt className="text-pretty text-sm font-medium text-foreground">
                            {item.prompt}
                          </dt>
                          <dd className="mt-1 text-pretty text-sm leading-relaxed text-muted-foreground">
                            {item.answer}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ) : null}

                <NonNegotiablesBlock text={block.brief.non_negotiables} />

                {block.moodboardReferences.some((g) => g.imageUrls.length > 0) ? (
                  <div className="space-y-6">
                    <h3 className="text-sm font-semibold text-foreground">Moodboard references</h3>
                    {block.moodboardReferences.map((group) =>
                      group.imageUrls.length === 0 ? null : (
                        <div key={group.categoryKey}>
                          <p className="mb-2 text-xs font-medium text-muted-foreground">
                            {group.categoryLabel}
                          </p>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                            {group.imageUrls.map((url, i) => (
                              <div
                                key={`${group.categoryKey}-${i}`}
                                className="relative aspect-square overflow-hidden rounded-md border bg-muted/20"
                              >
                                <Image
                                  src={url}
                                  alt={`${group.categoryLabel} reference ${i + 1}`}
                                  fill
                                  sizes="(max-width: 768px) 50vw, 180px"
                                  className="object-cover"
                                  unoptimized
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                ) : null}
              </section>
            );
          })}
        </>
      )}

      <footer className="border-t border-border pt-8 text-center text-xs text-muted-foreground">
        <p>Generated {generatedLabel}</p>
        <p className="mt-1">Prepared by Everyday Studio</p>
      </footer>
    </div>
  );
}
