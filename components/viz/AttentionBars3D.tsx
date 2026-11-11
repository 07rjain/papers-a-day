"use client";

import { useEffect, useRef, useState } from "react";
import type * as THREE from "three";
import { VizNote } from "@/components/viz/shell";

const SRC = ["the", "European", "Economic", "Area"];
const TGT = ["la", "zone", "économique", "européenne"];
const SCORES = [
  [3.0, 0.4, 0.2, 1.6],
  [0.2, 0.3, 0.6, 3.2],
  [0.1, 0.5, 3.1, 0.6],
  [0.2, 3.3, 0.7, 0.4],
];

function softmax(xs: number[]) {
  const m = Math.max(...xs);
  const ex = xs.map((x) => Math.exp(x - m));
  const s = ex.reduce((a, b) => a + b, 0);
  return ex.map((e) => e / s);
}

export function AttentionBars3D() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [row, setRow] = useState(1);
  const rowRef = useRef(row);
  rowRef.current = row;
  const weights = softmax(SCORES[row]);

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
      camera.position.set(0, 3.2, 7);
      camera.lookAt(0, 0.6, 0);
      scene.add(new THREE.AmbientLight(0xffffff, 0.85));
      const light = new THREE.DirectionalLight(0xffffff, 0.6);
      light.position.set(2, 6, 3);
      scene.add(light);
      const resize = () => {
        const w = canvas.clientWidth || 700;
        const h = canvas.clientHeight || 360;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      resize();
      const bars = SRC.map((_, i) => {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.7, 1, 0.7),
          new THREE.MeshStandardMaterial({ color: 0x7eb0f0, roughness: 0.4 }),
        );
        mesh.position.x = (i - 1.5) * 1.3;
        scene.add(mesh);
        const board = document.createElement("canvas");
        board.width = 256;
        board.height = 64;
        const ctx = board.getContext("2d");
        if (ctx) {
          ctx.font = "600 28px sans-serif";
          ctx.fillStyle = "#e8eef6";
          ctx.fillText(SRC[i], 8, 42);
        }
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(board), transparent: true, depthTest: false }),
        );
        sprite.position.set(mesh.position.x, -0.35, 0);
        sprite.scale.set(1.3, 0.32, 1);
        scene.add(sprite);
        return mesh;
      });
      const loop = () => {
        if (dead) return;
        const wts = softmax(SCORES[rowRef.current]);
        const top = wts.indexOf(Math.max(...wts));
        bars.forEach((mesh, i) => {
          const h = 0.25 + wts[i] * 3.2;
          mesh.scale.y = h;
          mesh.position.y = h / 2;
          (mesh.material as THREE.MeshStandardMaterial).color.set(i === top ? 0xfacc15 : 0x7eb0f0);
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

  const top = weights.indexOf(Math.max(...weights));
  return (
    <div>
      <VizNote>
        Toy alignment scores, hand-made to mimic Figure 3(a) of Bahdanau, Cho and Bengio. Not taken
        from the trained model. Pick the French word being written.
      </VizNote>
      <div className="viz-controls">
        {TGT.map((word, i) => (
          <button key={word} type="button" className={i === row ? "k-btn primary" : "k-btn"} onClick={() => setRow(i)}>
            writing “{word}”
          </button>
        ))}
      </div>
      <canvas ref={canvasRef} className="lora-canvas" />
      <p className="viz-note">
        To write “{TGT[row]}”, {(weights[top] * 100).toFixed(0)}% of the attention is on “{SRC[top]}”.
      </p>
    </div>
  );
}
