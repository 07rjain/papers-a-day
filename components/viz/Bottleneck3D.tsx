"use client";

import { useEffect, useRef, useState } from "react";
import type * as THREE from "three";
import { useReducedMotion, VizNote } from "@/components/viz/shell";

export function Bottleneck3D() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduced = useReducedMotion();
  const [length, setLength] = useState(6);
  const lengthRef = useRef(length);
  lengthRef.current = length;

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
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 40);
      scene.add(new THREE.AmbientLight(0xffffff, 0.9));
      const resize = () => {
        const w = canvas.clientWidth || 700;
        const h = canvas.clientHeight || 360;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      resize();
      const cube = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 1.1, 1.1),
        new THREE.MeshStandardMaterial({ color: 0x7eb0f0, roughness: 0.35 }),
      );
      cube.position.x = 1.6;
      scene.add(cube);
      const tokens: THREE.Mesh[] = [];
      for (let i = 0; i < 12; i++) {
        const token = new THREE.Mesh(
          new THREE.BoxGeometry(0.28, 0.28, 0.28),
          new THREE.MeshStandardMaterial({ color: 0xfacc15 }),
        );
        scene.add(token);
        tokens.push(token);
      }
      let ang = 0.5;
      const loop = () => {
        if (dead) return;
        if (!reduced) ang += 0.004;
        const n = lengthRef.current;
        camera.position.set(Math.sin(ang) * 6, 1.8, Math.cos(ang) * 6);
        camera.lookAt(0, 0, 0);
        const pressure = Math.min(1, (n - 3) / 9);
        (cube.material as THREE.MeshStandardMaterial).color.setRGB(0.3 + pressure * 0.7, 0.55 - pressure * 0.3, 0.95 - pressure * 0.5);
        cube.scale.setScalar(1);
        tokens.forEach((token, i) => {
          token.visible = i < n;
          token.position.set(-3.2 + (i % 4) * 0.45, 0.8 - Math.floor(i / 4) * 0.45, 0);
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
  }, [reduced]);

  return (
    <div>
      <VizNote>
        Toy picture of the seq2seq bottleneck. The cube is the one fixed-size vector. It does not grow
        when the sentence does; it only changes colour as more tokens have to fit inside it.
      </VizNote>
      <div className="viz-controls">
        <label>
          Sentence length: {length} words
          <input type="range" min={3} max={12} value={length} onChange={(event) => setLength(Number(event.target.value))} />
        </label>
      </div>
      <canvas ref={canvasRef} className="lora-canvas" />
    </div>
  );
}
