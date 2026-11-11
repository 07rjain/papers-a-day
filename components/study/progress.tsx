"use client";

import { useEffect, useState } from "react";

const KEY = "pad-progress-v1";

export type PaperProgress = { read?: boolean; correct?: number; answered?: number; total?: number };

export function readProgress(): Record<string, PaperProgress> {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "{}") as Record<string, PaperProgress>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeProgress(all: Record<string, PaperProgress>) {
  localStorage.setItem(KEY, JSON.stringify(all));
  window.dispatchEvent(new Event("pad-progress"));
}

export function markRead(slug: string) {
  const all = readProgress();
  all[slug] = { ...all[slug], read: true };
  writeProgress(all);
}

export function rememberQuiz(slug: string, correct: number, answered: number, total: number) {
  const all = readProgress();
  all[slug] = { ...all[slug], correct, answered, total, read: answered === total ? true : all[slug]?.read };
  writeProgress(all);
}

export function usePaperProgress() {
  const [progress, setProgress] = useState<Record<string, PaperProgress>>({});
  useEffect(() => {
    const load = () => setProgress(readProgress());
    load();
    window.addEventListener("pad-progress", load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener("pad-progress", load);
      window.removeEventListener("storage", load);
    };
  }, []);
  return progress;
}

export function StudyStatus({ slug }: { slug: string }) {
  const progress = usePaperProgress();
  const entry = progress[slug];
  return (
    <div className="study-status">
      <button type="button" className="k-btn" onClick={() => markRead(slug)}>
        {entry?.read ? "Marked as read" : "Mark as read"}
      </button>
      <p>
        {entry?.answered
          ? `Quiz so far: ${entry.correct ?? 0} correct out of ${entry.answered} answered (${entry.total ?? "?"} questions).`
          : "Quiz answers on this page are saved in this browser only."}
      </p>
    </div>
  );
}

export function QuizSync({
  slug,
  picks,
  answers,
}: {
  slug: string;
  picks: (number | null)[];
  answers: number[];
}) {
  const signature = `${picks.join(",")}|${answers.join(",")}`;
  useEffect(() => {
    const answered = picks.filter((pick) => pick !== null).length;
    if (!answered) return;
    let correct = 0;
    picks.forEach((pick, index) => {
      if (pick !== null && pick === answers[index]) correct += 1;
    });
    rememberQuiz(slug, correct, answered, answers.length);
  }, [slug, signature, picks, answers]);
  return null;
}
