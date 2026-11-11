import Link from "next/link";

export default function NotFound() {
  return (
    <div className="home">
      <header className="home-intro">
        <h1>That page is not here</h1>
        <p className="lede">
          Papers a Day is a visual guide to landmark AI papers. This address does not match a paper
          or a section of the site.
        </p>
        <p className="lede">
          <Link href="/">Back to all papers</Link>
        </p>
      </header>
    </div>
  );
}
