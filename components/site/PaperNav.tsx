import Link from "next/link";
import type { PaperMeta } from "@/content/types";
import { padNumber } from "@/content/format";

export function PaperNav({
  prev,
  next,
}: {
  prev: PaperMeta | null;
  next: PaperMeta | null;
}) {
  if (!prev && !next) return null;
  return (
    <nav className="paper-nav" aria-label="Other papers">
      {prev ? (
        <Link className="prev" href={`/papers/${prev.slug}`}>
          <span className="label">Previous</span>
          <span className="dest">
            {padNumber(prev.number)} {prev.title}
          </span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link className="next" href={`/papers/${next.slug}`}>
          <span className="label">Next</span>
          <span className="dest">
            {padNumber(next.number)} {next.title}
          </span>
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
