import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Explanation } from "@/components/site/Explanation";
import { PaperNav } from "@/components/site/PaperNav";
import { StudyStatus } from "@/components/study/progress";
import { getPaper, learningOrder, paperNeighbors } from "@/content/catalog";
import { keyIdeas } from "@/content/study";
import { formatSent, padNumber } from "@/content/format";
import { interactives } from "@/content/interactives";

export function generateStaticParams() {
  return learningOrder().map((paper) => ({ slug: paper.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const paper = getPaper(slug);
  if (!paper) return { title: "Paper not found" };
  return {
    title: paper.title,
    description: paper.hook,
  };
}

export default async function PaperPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const paper = getPaper(slug);
  if (!paper) notFound();

  const { prev, next } = paperNeighbors(paper.slug);
  const Interactive = interactives[paper.slug];

  return (
    <article className="paper">
      <p className="kicker">
        <Link href="/">All papers</Link>
        <span aria-hidden="true"> · </span>
        Day {padNumber(paper.number)}
        <span aria-hidden="true"> · </span>
        Sent {formatSent(paper.sent)}
      </p>
      <h1>
        <a href={paper.url} target="_blank" rel="noreferrer">
          {paper.title}
          <span className="sr-only"> (opens the paper)</span>
        </a>
      </h1>
      <p className="byline">
        {paper.authors} — {paper.year}
      </p>
      <StudyStatus slug={paper.slug} />
      {keyIdeas[paper.slug] ? (
        <section className="key-ideas" aria-labelledby="ideas-heading">
          <h2 id="ideas-heading">Key ideas</h2>
          <ul>
            {keyIdeas[paper.slug].map((idea) => (
              <li key={idea}>{idea}</li>
            ))}
          </ul>
          <p>
            <Link href="/glossary">Glossary</Link>
          </p>
        </section>
      ) : null}

      <Explanation paragraphs={paper.explanation} />

      {Interactive ? (
        <Interactive />
      ) : (
        <p className="k-text">The interactive page for this paper is not wired up yet.</p>
      )}

      <section className="question" aria-labelledby="question-heading">
        <h2 id="question-heading">Question for today</h2>
        <p>{paper.question}</p>
      </section>

      <details className="answer">
        <summary>Check your answer</summary>
        <p>{paper.answer}</p>
      </details>

      <PaperNav prev={prev} next={next} />
    </article>
  );
}
