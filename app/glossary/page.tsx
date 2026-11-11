import type { Metadata } from "next";
import Link from "next/link";
import { glossary } from "@/content/study";

export const metadata: Metadata = {
  title: "Glossary",
  description: "Short definitions for terms used across the Papers a Day reading path.",
};

export default function GlossaryPage() {
  return (
    <div className="home">
      <header className="home-intro">
        <h1>Glossary</h1>
        <p className="lede">
          Short definitions for this reading path. They are reminders, not substitutes for the papers.
        </p>
      </header>
      <dl className="glossary">
        {glossary.map((entry) => (
          <div key={entry.id} id={entry.id}>
            <dt>{entry.term}</dt>
            <dd>{entry.definition}</dd>
          </div>
        ))}
      </dl>
      <p className="lede">
        <Link href="/">Back to all papers</Link>
      </p>
    </div>
  );
}
