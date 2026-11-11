import Link from "next/link";
import { LearningPath } from "@/components/study/LearningPath";
import { papersNewestFirst } from "@/content/catalog";
import { formatSent, padNumber } from "@/content/format";

export default function HomePage() {
  const papers = papersNewestFirst();
  return (
    <div className="home">
      <header className="home-intro">
        <h1>Papers a Day</h1>
        <p className="lede">
          A beginner-friendly visual guide to landmark AI papers. Read the plain-English note, play
          with the figures, then try the question at the bottom.
        </p>
      </header>
      <section className="about" id="about" aria-labelledby="about-heading">
        <h2 id="about-heading">About this reading path</h2>
        <p>
          The list runs from word vectors to modern language-model training, in the order the
          papers were added. Start at word2vec if you want the story in sequence, or open any paper
          on its own. Each page credits the authors and links the abstract. Many figures use
          made-up numbers so the mechanism is easy to see, and those are labelled on the page.
          Measured results are taken from the papers.
        </p>
      </section>
      <section className="about" aria-labelledby="path-heading">
        <h2 id="path-heading">How the papers connect</h2>
        <p>Read from 01 to 12 if you want each idea to set up the next one. A “Read” mark is stored in this browser.</p>
        <LearningPath />
      </section>
      <ol className="paper-list">
        {papers.map((paper) => (
          <li key={paper.slug}>
            <Link className="paper-row" href={`/papers/${paper.slug}`}>
              <span className="num">{padNumber(paper.number)}</span>
              <span className="row-body">
                <span className="row-date">{formatSent(paper.sent)}</span>
                <span className="row-title">{paper.title}</span>
                <span className="row-meta">
                  {paper.authors} — {paper.year}
                </span>
                <span className="row-hook">{paper.hook}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
