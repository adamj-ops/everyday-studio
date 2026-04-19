"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { CreativeQuestion } from "@/lib/briefs/questions";

function AutoGrowTextarea({
  value,
  placeholder,
  onChange,
  id,
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  id: string;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      id={id}
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={3}
      className={cn(
        "w-full rounded-md border border-input bg-transparent px-3 py-2 text-base leading-relaxed",
        "resize-none overflow-hidden transition-colors outline-none placeholder:text-muted-foreground",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "dark:bg-input/30",
      )}
    />
  );
}

export function CreativeQuestions({
  questions,
  answers,
  onChange,
}: {
  questions: CreativeQuestion[];
  answers: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  return (
    <div className="space-y-6">
      {questions.map((q) => {
        const id = `q-${q.key}`;
        return (
          <div key={q.key} className="space-y-2">
            <label
              htmlFor={id}
              className="block text-pretty font-heading text-base font-medium text-foreground"
            >
              {q.prompt}
            </label>
            <AutoGrowTextarea
              id={id}
              value={answers[q.key] ?? ""}
              placeholder={q.placeholder}
              onChange={(v) => onChange({ ...answers, [q.key]: v })}
            />
          </div>
        );
      })}
    </div>
  );
}
