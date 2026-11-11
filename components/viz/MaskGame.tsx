"use client";

import { useEffect, useRef, useState } from "react";
import { VizNote } from "@/components/viz/shell";

const ROUNDS = [
  {
    prompt: "the man went to the ___ to buy milk",
    answers: [
      ["store", 0.62],
      ["shop", 0.18],
      ["market", 0.14],
      ["park", 0.06],
    ] as [string, number][],
  },
  {
    prompt: "she took her dog to the ___ for a checkup",
    answers: [
      ["vet", 0.7],
      ["clinic", 0.16],
      ["park", 0.09],
      ["store", 0.05],
    ] as [string, number][],
  },
];

export function MaskGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [round, setRound] = useState(0);
  const [guess, setGuess] = useState("");
  const [note, setNote] = useState("Type a guess, then check it.");
  const answersRef = useRef(ROUNDS[0].answers);
  answersRef.current = ROUNDS[round].answers;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let dead = false;
    let raf = 0;
    let cleanup = () => {};
    import("three").then((THREE) => {
      if (dead) return;
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x141820);
      const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 30);
      camera.position.set(0, 2.2, 6.5);
      camera.lookAt(0, 0.7, 0);
      scene.add(new THREE.AmbientLight(0xffffff, 0.9));
      const resize = () => {
        const w = canvas.clientWidth || 700;
        const h = canvas.clientHeight || 300;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      resize();
      const bars = [0, 1, 2, 3].map((i) => {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.7, 1, 0.7),
          new THREE.MeshStandardMaterial({ color: i === 0 ? 0xfacc15 : 0x7eb0f0 }),
        );
        mesh.position.x = (i - 1.5) * 1.3;
        scene.add(mesh);
        return mesh;
      });
      const loop = () => {
        if (dead) return;
        const answers = answersRef.current;
        bars.forEach((mesh, i) => {
          const h = 0.2 + answers[i][1] * 3.2;
          mesh.scale.y = h;
          mesh.position.y = h / 2;
        });
        renderer.render(scene, camera);
        raf = requestAnimationFrame(loop);
      };
      loop();
      cleanup = () => {
        cancelAnimationFrame(raf);
        renderer.dispose();
      };
    });
    return () => {
      dead = true;
      cleanup();
    };
  }, []);

  const answers = ROUNDS[round].answers;
  const check = () => {
    const hit = answers.find((item) => item[0] === guess.trim().toLowerCase());
    setNote(
      hit
        ? `“${hit[0]}” is in this toy list, with weight ${(hit[1] * 100).toFixed(0)}%. The list is made up, not BERT’s output.`
        : `“${guess.trim() || "…"}” is not in this toy answer list. The made-up top guess is “${answers[0][0]}”.`,
    );
  };

  return (
    <div>
      <VizNote>
        Toy masked-word game. The bars are a made-up distribution, not a sample from BERT. The idea is
        the one in the paper: the blank is filled from both sides of the sentence.
      </VizNote>
      <div className="viz-controls">
        {ROUNDS.map((item, i) => (
          <button key={item.prompt} type="button" className={i === round ? "k-btn primary" : "k-btn"} onClick={() => { setRound(i); setNote("Type a guess, then check it."); }}>
            Blank {i + 1}
          </button>
        ))}
      </div>
      <p>{ROUNDS[round].prompt}</p>
      <div className="viz-controls">
        <label>
          Your guess
          <input type="text" value={guess} onChange={(event) => setGuess(event.target.value)} aria-label="Guess for the blank" />
        </label>
        <button type="button" className="k-btn primary" onClick={check}>
          Check guess
        </button>
      </div>
      <canvas ref={canvasRef} className="lora-canvas" />
      <p className="viz-note">
        {answers.map((item) => `${item[0]} ${(item[1] * 100).toFixed(0)}%`).join(" · ")}. {note}
      </p>
    </div>
  );
}
