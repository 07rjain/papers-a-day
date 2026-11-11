"use client";

import Link from "next/link";
import { learningOrder } from "@/content/catalog";
import { pathLinks } from "@/content/study";
import { usePaperProgress } from "@/components/study/progress";

export function LearningPath() {
  const papers = learningOrder();
  const progress = usePaperProgress();
  return (
    <ol className="path-map">
      {papers.map((paper, index) => {
        const note = pathLinks.find((item) => item.slug === paper.slug);
        const entry = progress[paper.slug];
        return (
          <li key={paper.slug}>
            <Link href={`/papers/${paper.slug}`}>
              <span className="path-index">{String(index + 1).padStart(2, "0")}</span>
              <span>
                <strong>{paper.title}</strong>
                <span className="path-note">{note?.leadsTo}</span>
                {entry?.read ? <span className="path-read">Read</span> : null}
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
