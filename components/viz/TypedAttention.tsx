"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type * as THREE from "three";
import { VizNote } from "@/components/viz/shell";

function embed(word: string) {
  const v = [0, 0, 0, 0];
  for (let i = 0; i < word.length; i++) v[i % 4] += word.charCodeAt(i) / 80;
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
}
function softmax(xs: number[]) {
  const m = Math.max(...xs);
  const ex = xs.map((x) => Math.exp(x - m));
  const s = ex.reduce((a, b) => a + b, 0);
  return ex.map((e) => e / s);
}

export function TypedAttention() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [sentence, setSentence] = useState("the cat sat because it was tired");
  const [query, setQuery] = useState(0);
  const words = useMemo(
    () => sentence.toLowerCase().split(/[^a-z']+/).filter(Boolean).slice(0, 8),
    [sentence],
  );
  const qi = Math.min(query, Math.max(0, words.length - 1));
  const weights = useMemo(() => {
    if (words.length === 0) return [] as number[];
    const vecs = words.map(embed);
    const scores = vecs.map((key) => {
      let dot = 0;
      for (let i = 0; i < 4; i++) dot += vecs[qi][i] * key[i];
      return dot / 2;
    });
    return softmax(scores);
  }, [words, qi]);
  const weightsRef = useRef(weights);
  const wordsRef = useRef(words);
  weightsRef.current = weights;
  wordsRef.current = words;

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
      const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 40);
      camera.position.set(0, 2.4, 7.5);
      camera.lookAt(0, 0.8, 0);
      scene.add(new THREE.AmbientLight(0xffffff, 0.9));
      const resize = () => {
        const w = canvas.clientWidth || 700;
        const h = canvas.clientHeight || 320;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      resize();
      const bars: THREE.Mesh[] = [];
      const labels: THREE.Sprite[] = [];
      for (let i = 0; i < 8; i++) {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.55, 1, 0.55),
          new THREE.MeshStandardMaterial({ color: 0x7eb0f0 }),
        );
        scene.add(mesh);
        bars.push(mesh);
        const board = document.createElement("canvas");
        board.width = 256;
        board.height = 64;
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(board), transparent: true, depthTest: false }),
        );
        sprite.scale.set(1.1, 0.28, 1);
        scene.add(sprite);
        labels.push(sprite);
      }
      const loop = () => {
        if (dead) return;
        const list = wordsRef.current;
        const wts = weightsRef.current;
        const top = wts.indexOf(Math.max(...wts, 0));
        bars.forEach((mesh, i) => {
          const on = i < list.length;
          mesh.visible = on;
          labels[i].visible = on;
          if (!on) return;
          const h = 0.2 + (wts[i] || 0) * 3;
          mesh.scale.y = h;
          mesh.position.set((i - (list.length - 1) / 2) * 1.05, h / 2, 0);
          (mesh.material as THREE.MeshStandardMaterial).color.set(i === top ? 0xfacc15 : 0x7eb0f0);
          const board = labels[i].material.map?.image as HTMLCanvasElement;
          const ctx = board?.getContext("2d");
          if (ctx && labels[i].userData.word !== list[i]) {
            labels[i].userData.word = list[i];
            ctx.clearRect(0, 0, board.width, board.height);
            ctx.font = "600 28px sans-serif";
            ctx.fillStyle = "#e8eef6";
            ctx.fillText(list[i], 8, 42);
            labels[i].material.map!.needsUpdate = true;
          }
          labels[i].position.set(mesh.position.x, -0.3, 0);
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

  const top = weights.indexOf(Math.max(...weights, 0));
  return (
    <div>
      <VizNote>
        Toy self-attention. Each word becomes four numbers from its letters, then the chosen word’s
        vector is dotted with the others. This is not a trained Transformer and not the paper’s Figure 4.
      </VizNote>
      <div className="viz-controls">
        <label>
          Sentence
          <input type="text" value={sentence} onChange={(event) => setSentence(event.target.value)} aria-label="Sentence to attend over" />
        </label>
      </div>
      <div className="viz-controls">
        {words.map((word, i) => (
          <button key={`${word}-${i}`} type="button" className={i === qi ? "k-btn primary" : "k-btn"} onClick={() => setQuery(i)}>
            {word}
          </button>
        ))}
      </div>
      <canvas ref={canvasRef} className="lora-canvas" />
      {words.length > 0 ? (
        <p className="viz-note">
          “{words[qi]}” puts {((weights[top] || 0) * 100).toFixed(0)}% of this toy attention on “{words[top]}”.
        </p>
      ) : (
        <p className="viz-note">Type a few words to see the scores.</p>
      )}
    </div>
  );
}
