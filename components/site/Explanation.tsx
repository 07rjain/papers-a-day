import type { Inline } from "@/content/types";

export function Explanation({ paragraphs }: { paragraphs: Inline[][] }) {
  return (
    <div className="explanation">
      {paragraphs.map((paragraph, paragraphIndex) => (
        <p key={paragraphIndex}>
          {paragraph.map((part, partIndex) =>
            typeof part === "string" ? (
              <span key={partIndex}>{part}</span>
            ) : (
              <a key={partIndex} href={part.href} target="_blank" rel="noreferrer">
                {part.text}
              </a>
            ),
          )}
        </p>
      ))}
    </div>
  );
}
