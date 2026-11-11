"use client";

import Link from "next/link";
import { learningOrder } from "@/content/catalog";
import { padNumber } from "@/content/format";
import { pathLinks } from "@/content/study";
import { usePaperProgress, type PaperProgress } from "@/components/study/progress";

function quizLabel(entry: PaperProgress | undefined): string {
  if (!entry?.answered) return "Quiz not started";
  return `Quiz ${entry.correct ?? 0}/${entry.answered} correct`;
}

export function LearningPath() {
  const papers = learningOrder();
  const progress = usePaperProgress();
  return (
    <ol className="path-map">
      {papers.map((paper) => {
        const note = pathLinks.find((item) => item.slug === paper.slug);
        const entry = progress[paper.slug];
        const read = Boolean(entry?.read);
        const quizzed = Boolean(entry?.answered);
        return (
          <li key={paper.slug} className="path-step">
            <Link className="paper-row" href={`/papers/${paper.slug}`}>
              <span className="num">{padNumber(paper.number)}</span>
              <span className="row-body">
                <span className="row-title">{paper.title}</span>
                <span className="row-meta">
                  {paper.authors} — {paper.year}
                </span>
                <span className="row-hook">{paper.hook}</span>
                <span className="builds-on">
                  {note?.buildsOn ? (
                    <>
                      <span className="builds-label">Builds on</span> {note.buildsOn}
                    </>
                  ) : (
                    <span className="builds-label">Starts the path</span>
                  )}
                </span>
                <span className="path-progress">
                  <span className={read ? "path-pill is-on" : "path-pill"}>{read ? "Read" : "Not read"}</span>
                  <span className={quizzed ? "path-pill is-on" : "path-pill"}>{quizLabel(entry)}</span>
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
