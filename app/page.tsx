import Link from "next/link";
import { papersNewestFirst } from "@/content/catalog";
import { formatSent, padNumber } from "@/content/format";

export default function HomePage() {
  const papers = papersNewestFirst();
  return (
    <div className="home">
      <header className="home-intro">
        <h1>Papers a Day</h1>
        <p className="lede">
          One AI research paper a day, in the order they were sent. Read the plain-English note,
          play with the page, then answer the question at the bottom.
        </p>
      </header>
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
