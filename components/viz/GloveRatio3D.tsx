"use client";

import { useEffect, useRef, useState } from "react";
import type * as THREE from "three";
import { useReducedMotion, VizNote } from "@/components/viz/shell";

// Ice/steam probabilities are the real figures from Table 1 of the GloVe paper.
// Depth is only so the labels do not sit on the same line.
const PROBES = [
  { k: "solid", ice: 1.9e-4, steam: 2.2e-5, z: 0.4 },
  { k: "gas", ice: 6.6e-5, steam: 7.8e-4, z: -0.4 },
  { k: "water", ice: 3.0e-3, steam: 2.2e-3, z: 0.9 },
  { k: "fashion", ice: 1.7e-5, steam: 1.8e-5, z: -0.9 },
];

export function GloveRatio3D() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduced = useReducedMotion();
  const [probe, setProbe] = useState("solid");
  const probeRef = useRef(probe);
  probeRef.current = probe;

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
      scene.add(new THREE.AmbientLight(0xffffff, 1));
      const resize = () => {
        const w = canvas.clientWidth || 700;
        const h = canvas.clientHeight || 380;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      resize();
      const meshes = PROBES.map((item) => {
        const ratio = Math.log10(item.ice / item.steam);
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.18, 18, 12),
          new THREE.MeshStandardMaterial({ color: Math.abs(ratio) < 0.3 ? 0x8aa0b8 : ratio > 0 ? 0x7eb0f0 : 0xfacc15 }),
        );
        mesh.position.set(ratio * 1.4, Math.log10(item.ice) + 4, item.z);
        scene.add(mesh);
        const board = document.createElement("canvas");
        board.width = 256;
        board.height = 64;
        const ctx = board.getContext("2d");
        if (ctx) {
          ctx.font = "600 32px sans-serif";
          ctx.fillStyle = "#e8eef6";
          ctx.fillText(item.k, 8, 42);
        }
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(board), transparent: true, depthTest: false }),
        );
        sprite.position.copy(mesh.position);
        sprite.position.y += 0.4;
        sprite.scale.set(1.1, 0.28, 1);
        scene.add(sprite);
        mesh.userData.k = item.k;
        return mesh;
      });
      const axis = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(-2.2, 0, 0), 4.4, 0x5c6b7a);
      scene.add(axis);
      const ray = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      const onPointer = (event: PointerEvent) => {
        const rect = canvas.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        ray.setFromCamera(pointer, camera);
        const hit = ray.intersectObjects(meshes)[0];
        if (hit) setProbe(String(hit.object.userData.k));
      };
      canvas.addEventListener("pointerdown", onPointer);
      let ang = 0.4;
      const loop = () => {
        if (dead) return;
        if (!reduced) ang += 0.003;
        camera.position.set(Math.sin(ang) * 6, 1.6, Math.cos(ang) * 6);
        camera.lookAt(0, 0.2, 0);
        for (const mesh of meshes) {
          const mat = mesh.material as THREE.MeshStandardMaterial;
          mat.emissive.set(mesh.userData.k === probeRef.current ? 0xfacc15 : 0x000000);
          mat.emissiveIntensity = mesh.userData.k === probeRef.current ? 0.45 : 0;
        }
        renderer.render(scene, camera);
        raf = requestAnimationFrame(loop);
      };
      loop();
      cleanup = () => {
        cancelAnimationFrame(raf);
        canvas.removeEventListener("pointerdown", onPointer);
        renderer.dispose();
      };
    });
    return () => {
      dead = true;
      cleanup();
    };
  }, [reduced]);

  const item = PROBES.find((row) => row.k === probe)!;
  const ratio = item.ice / item.steam;
  return (
    <div>
      <VizNote>
        Horizontal position is the log of P(word|ice) / P(word|steam) from Table 1 of the GloVe paper
        (6 billion word corpus). Height is log P(word|ice). Depth is only so the four labels can be
        read apart.
      </VizNote>
      <canvas ref={canvasRef} className="lora-canvas" />
      <p className="viz-note">
        {probe}: P(ice) {item.ice.toExponential(1)}, P(steam) {item.steam.toExponential(1)}, ratio{" "}
        {ratio.toFixed(2)}. Click a sphere.
      </p>
    </div>
  );
}
