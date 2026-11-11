"use client";

import { useEffect, useRef, useState } from "react";
import type * as THREE from "three";
import { useReducedMotion, VizNote } from "@/components/viz/shell";

const WORDS = [
  { w: "king", p: [1.3, 0.9, 0.5] },
  { w: "queen", p: [1.3, -0.9, 0.5] },
  { w: "man", p: [-1.3, 0.9, 0.15] },
  { w: "woman", p: [-1.3, -0.9, 0.15] },
  { w: "prince", p: [0.7, 1.2, 0.7] },
  { w: "princess", p: [0.7, -1.2, 0.7] },
  { w: "boy", p: [-1.7, 0.45, -0.1] },
  { w: "girl", p: [-1.7, -0.45, -0.1] },
  { w: "dog", p: [1.5, 0.25, -1.3] },
  { w: "puppy", p: [1.9, 0.7, -1.05] },
  { w: "cat", p: [2.05, -0.25, -1.4] },
  { w: "kitten", p: [2.4, 0.15, -1.15] },
];

const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const find = (w: string) => WORDS.find((word) => word.w === w)!;

export function WordMap3D() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduced = useReducedMotion();
  const [selected, setSelected] = useState("king");
  const [a, setA] = useState("king");
  const [b, setB] = useState("man");
  const [c, setC] = useState("woman");
  const selectedRef = useRef(selected);
  const analogyRef = useRef({ a, b, c });
  selectedRef.current = selected;
  analogyRef.current = { a, b, c };

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
      const resize = () => {
        const w = canvas.clientWidth || 700;
        const h = canvas.clientHeight || 380;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x141820);
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 50);
      scene.add(new THREE.AmbientLight(0xffffff, 0.85));
      const dir = new THREE.DirectionalLight(0xffffff, 0.7);
      dir.position.set(3, 5, 4);
      scene.add(dir);
      resize();

      const meshes = WORDS.map((word) => {
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.13, 18, 12),
          new THREE.MeshStandardMaterial({ color: 0x8aa0b8, roughness: 0.4 }),
        );
        mesh.position.set(word.p[0], word.p[1], word.p[2]);
        mesh.userData.word = word.w;
        scene.add(mesh);
        const board = document.createElement("canvas");
        board.width = 256;
        board.height = 64;
        const ctx = board.getContext("2d");
        if (ctx) {
          ctx.font = "600 32px sans-serif";
          ctx.fillStyle = "#e8eef6";
          ctx.fillText(word.w, 8, 42);
        }
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(board), transparent: true, depthTest: false }),
        );
        sprite.position.set(word.p[0], word.p[1] + 0.28, word.p[2]);
        sprite.scale.set(0.9, 0.22, 1);
        scene.add(sprite);
        return mesh;
      });

      const lineMat = new THREE.LineBasicMaterial({ color: 0xfacc15 });
      const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const line = new THREE.Line(lineGeo, lineMat);
      scene.add(line);
      const result = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 16, 12),
        new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.9 }),
      );
      scene.add(result);

      const ray = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      const pick = (event: PointerEvent) => {
        const rect = canvas.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        ray.setFromCamera(pointer, camera);
        const hit = ray.intersectObjects(meshes)[0];
        if (hit) setSelected(String(hit.object.userData.word));
      };
      canvas.addEventListener("pointerdown", pick);

      let ang = 0.6;
      let drag: { x: number; y: number } | null = null;
      const down = (event: PointerEvent) => {
        drag = { x: event.clientX, y: event.clientY };
      };
      const move = (event: PointerEvent) => {
        if (!drag) return;
        ang -= (event.clientX - drag.x) * 0.01;
        drag = { x: event.clientX, y: event.clientY };
      };
      const up = () => {
        drag = null;
      };
      canvas.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      canvas.addEventListener("pointerdown", down);

      const loop = () => {
        if (dead) return;
        if (!drag && !reduced) ang += 0.004;
        camera.position.set(Math.sin(ang) * 7, 2.2, Math.cos(ang) * 7);
        camera.lookAt(0.4, 0, -0.2);
        const focus = find(selectedRef.current);
        const { a: aa, b: bb, c: cc } = analogyRef.current;
        const A = find(aa).p;
        const B = find(bb).p;
        const C = find(cc).p;
        const R = [A[0] - B[0] + C[0], A[1] - B[1] + C[1], A[2] - B[2] + C[2]];
        (lineGeo.attributes.position as THREE.BufferAttribute).setXYZ(0, C[0], C[1], C[2]);
        (lineGeo.attributes.position as THREE.BufferAttribute).setXYZ(1, R[0], R[1], R[2]);
        (lineGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        result.position.set(R[0], R[1], R[2]);
        for (const mesh of meshes) {
          const mat = mesh.material as THREE.MeshStandardMaterial;
          const word = String(mesh.userData.word);
          mat.color.set(word === focus.w ? 0xfacc15 : word === aa || word === bb || word === cc ? 0x7eb0f0 : 0x8aa0b8);
        }
        renderer.render(scene, camera);
        raf = requestAnimationFrame(loop);
      };
      let raf = 0;
      loop();
      cleanup = () => {
        cancelAnimationFrame(raf);
        canvas.removeEventListener("pointerdown", pick);
        canvas.removeEventListener("pointerdown", down);
        canvas.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        renderer.dispose();
      };
    });
    return () => {
      dead = true;
      cleanup();
    };
  }, [reduced]);

  const focus = find(selected);
  const nearest = WORDS.filter((word) => word.w !== selected)
    .map((word) => ({ w: word.w, d: dist(focus.p, word.p) }))
    .sort((p, q) => p.d - q.d)
    .slice(0, 3);
  const A = find(a).p;
  const B = find(b).p;
  const C = find(c).p;
  const R = [A[0] - B[0] + C[0], A[1] - B[1] + C[1], A[2] - B[2] + C[2]];
  const landed = WORDS.filter((word) => word.w !== a && word.w !== b && word.w !== c)
    .map((word) => ({ w: word.w, d: dist(R, word.p) }))
    .sort((p, q) => p.d - q.d)[0];

  return (
    <div>
      <VizNote>
        Toy 3D layout for teaching, with the same clusters as the flat map on this page. Real word2vec
        vectors have about 300 dimensions. The yellow sphere is the analogy result, not a stored word.
      </VizNote>
      <div className="viz-controls">
        <label>
          Start
          <select value={a} onChange={(event) => setA(event.target.value)}>
            {WORDS.map((word) => (
              <option key={word.w}>{word.w}</option>
            ))}
          </select>
        </label>
        <label>
          Subtract
          <select value={b} onChange={(event) => setB(event.target.value)}>
            {WORDS.map((word) => (
              <option key={`b-${word.w}`}>{word.w}</option>
            ))}
          </select>
        </label>
        <label>
          Add
          <select value={c} onChange={(event) => setC(event.target.value)}>
            {WORDS.map((word) => (
              <option key={`c-${word.w}`}>{word.w}</option>
            ))}
          </select>
        </label>
      </div>
      <canvas ref={canvasRef} className="lora-canvas" />
      <p className="viz-note">
        Click a word. Nearest to {selected}: {nearest.map((item) => item.w).join(", ")}. {a} − {b} + {c}{" "}
        lands nearest {landed.w}.
      </p>
    </div>
  );
}
