import { LearningPath } from "@/components/study/LearningPath";

export default function HomePage() {
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
      <section className="reading-path" aria-labelledby="path-heading">
        <h2 id="path-heading">How the papers connect</h2>
        <p>
          One path, from the first idea to the latest. Read from 01 down to 12, or open any paper
          on its own. Read and quiz marks stay in this browser.
        </p>
        <LearningPath />
      </section>
    </div>
  );
}
