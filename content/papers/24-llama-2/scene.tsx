"use client";

import { useEffect, useRef, useState } from "react";

export type Block = {
  x: number;
  z?: number;
  height: number;
  color: string;
};

export function Scene({ blocks, description }: { blocks: Block[]; description: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const data = useRef(blocks);
  const update = useRef<(() => void) | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    data.current = blocks;
    update.current?.();
  }, [blocks]);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const surface = element;
    let cancelled = false;
    let dispose = () => {};
    import("three").then((three) => {
      if (cancelled) return;
      let renderer;
      try {
        renderer = new three.WebGLRenderer({ canvas: surface, antialias: true });
      } catch {
        setUnavailable(true);
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      const scene = new three.Scene();
      scene.background = new three.Color("#101623");
      const camera = new three.OrthographicCamera(-4, 4, 2, -2, 0.1, 100);
      camera.position.set(3, 5, 10);
      camera.lookAt(0, 0.5, 0);
      scene.add(new three.HemisphereLight("#ffffff", "#68789a", 2.4));
      const key = new three.DirectionalLight("#ffffff", 2);
      key.position.set(3, 6, 5);
      scene.add(key);
      const grid = new three.GridHelper(8, 8, "#55617b", "#283146");
      scene.add(grid);
      const geometry = new three.BoxGeometry(0.74, 1, 0.72);
      const meshes = data.current.map(() => {
        const mesh = new three.Mesh(geometry, new three.MeshStandardMaterial({ roughness: 0.75 }));
        scene.add(mesh);
        return mesh;
      });

      const draw = () => {
        const { clientWidth, clientHeight } = surface;
        if (!clientWidth || !clientHeight) return;
        renderer.setSize(clientWidth, clientHeight, false);
        const aspect = clientWidth / clientHeight;
        const halfWidth = Math.max(3.2, 1.7 * aspect);
        camera.left = -halfWidth;
        camera.right = halfWidth;
        camera.top = halfWidth / aspect;
        camera.bottom = -camera.top;
        meshes.forEach((mesh, index) => {
          const { x, z = 0, height, color } = data.current[index];
          mesh.scale.y = height;
          mesh.position.set(x, height / 2, z);
          mesh.material.color.set(color);
        });
        camera.updateProjectionMatrix();
        renderer.render(scene, camera);
      };
      const observer = new ResizeObserver(draw);
      observer.observe(surface);
      update.current = draw;
      draw();
      dispose = () => {
        observer.disconnect();
        update.current = null;
        geometry.dispose();
        for (const mesh of meshes) mesh.material.dispose();
        grid.geometry.dispose();
        grid.material.dispose();
        renderer.dispose();
      };
    });
    return () => {
      cancelled = true;
      dispose();
    };
  }, []);

  return (
    <>
      {!unavailable && (
        <canvas
          ref={canvas}
          role="img"
          aria-label={description}
          style={{ display: "block", width: "100%", height: "clamp(170px, 34vw, 270px)", borderRadius: 12 }}
        />
      )}
      <p className="viz-note" aria-live="polite">{description}</p>
    </>
  );
}
