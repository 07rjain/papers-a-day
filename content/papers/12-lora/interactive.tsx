"use client";

import {
  Page,
  Section,
  Text,
  Callout,
  Segmented,
  Button,
  Table,
  Steps,
  LinkCards,
  Metrics,
  Equation,
  useState,
  useEffect,
  useRef,
} from "grok/canvas";
import type { Vector3 } from "three";

// Parameter counts use GPT-3 175B's d_model = 12,288, from the paper.
// The low-rank picture is a toy example on a made-up 28 × 28 matrix.

const VIDEOS = [
  {
    file: "FrozenPlusLowRank.mp4",
    title: "Frozen W, plus a thin B and a flat A",
    caption: "The pre-trained matrix W0 never changes. LoRA learns a tall, thin B (d × r) and a short, wide A (r × d); their product B·A is a full-size update with rank r.",
  },
  {
    file: "ParameterCount.mp4",
    title: "How many numbers do you actually train?",
    caption: "For one GPT-3-sized matrix (d = 12,288), full fine-tuning trains d × d ≈ 151 million numbers. LoRA with rank 4 trains 2 × d × r = 98,304.",
  },
  {
    file: "MergeNoLatency.mp4",
    title: "Merge for zero extra delay, swap for a new task",
    caption: "After training, add B·A into W0. The model has exactly its original shape, so it runs exactly as fast. A new task just means swapping a different B·A in.",
  },
];

const D = 12288;
const LAYERS = 96;
const RANKS = [1, 2, 4, 8, 16, 64];
const fmt = (n: number) =>
  n >= 1e9
    ? `${(n / 1e9).toFixed(1)}B`
    : n >= 1e6
      ? `${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2)}M`
      : n >= 1e3
        ? Math.round(n).toLocaleString("en-US")
        : String(Math.round(n));
const fmtBytes = (b: number) => (b >= 1e9 ? `${(b / 1e9).toFixed(0)} GB` : `${(b / 1e6).toFixed(1)} MB`);
const ease = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const slabW = (r: number) => 0.14 + 0.95 * Math.sqrt(r / 64);

function LoraScene({ r, merged, replay }: { r: number; merged: boolean; replay: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const live = useRef({ r, merged });
  const anim = useRef({ slide: 0, merge: 0, thick: slabW(r), glow: 0 });
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  live.current = { r, merged };

  useEffect(() => {
    anim.current.slide = 0;
  }, [replay]);
  useEffect(() => {
    if (merged) anim.current.glow = 1;
  }, [merged]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let raf = 0;
    let frame = 0;
    let cleanup = () => {};

    import("three")
      .then((THREE) => {
        if (disposed) return;
        const width = canvas.clientWidth || 820;
        const height = canvas.clientHeight || 430;
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
        renderer.setSize(width, height, false);
        renderer.outputColorSpace = THREE.SRGBColorSpace;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0b1020);
        scene.fog = new THREE.Fog(0x0b1020, 22, 42);
        const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
        scene.add(new THREE.AmbientLight(0xffffff, 0.7));
        const key = new THREE.DirectionalLight(0xffffff, 1.15);
        key.position.set(6, 10, 8);
        scene.add(key);

        const floor = new THREE.GridHelper(16, 16, 0x1d4e89, 0x1d4e89);
        floor.position.y = -3.2;
        const floorMat = floor.material as { opacity: number; transparent: boolean };
        floorMat.opacity = 0.28;
        floorMat.transparent = true;
        scene.add(floor);

        const grid = document.createElement("canvas");
        grid.width = 512;
        grid.height = 512;
        const pen = grid.getContext("2d");
        if (pen) {
          pen.fillStyle = "#94a3b8";
          pen.fillRect(0, 0, 512, 512);
          pen.strokeStyle = "rgba(11,16,32,0.45)";
          pen.lineWidth = 3;
          for (let i = 1; i < 16; i++) {
            const p = (512 * i) / 16;
            pen.beginPath();
            pen.moveTo(p, 0);
            pen.lineTo(p, 512);
            pen.stroke();
            pen.beginPath();
            pen.moveTo(0, p);
            pen.lineTo(512, p);
            pen.stroke();
          }
        }
        const gridMap = new THREE.CanvasTexture(grid);
        gridMap.colorSpace = THREE.SRGBColorSpace;
        const wMat = new THREE.MeshStandardMaterial({ map: gridMap, roughness: 0.55, metalness: 0.08 });
        const bMat = new THREE.MeshStandardMaterial({ color: 0xfb923c, roughness: 0.45, metalness: 0.05, transparent: true });
        const aMat = new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.45, metalness: 0.05, transparent: true });
        const unit = new THREE.BoxGeometry(1, 1, 1);
        const wMesh = new THREE.Mesh(unit, wMat);
        const bMesh = new THREE.Mesh(unit, bMat);
        const aMesh = new THREE.Mesh(unit, aMat);
        const edgeMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 });
        for (const mesh of [wMesh, bMesh, aMesh]) {
          mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(unit), edgeMat));
          scene.add(mesh);
        }

        const label = (text: string, color: string) => {
          const board = document.createElement("canvas");
          board.width = 640;
          board.height = 64;
          const ctx = board.getContext("2d");
          if (ctx) {
            ctx.font = "600 28px sans-serif";
            ctx.fillStyle = color;
            ctx.fillText(text, 4, 42);
          }
          const sprite = new THREE.Sprite(
            new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(board), transparent: true, depthTest: false }),
          );
          sprite.scale.set(3.4, 0.36, 1);
          scene.add(sprite);
          return sprite;
        };
        const wLabel = label("W0: frozen, d × d", "#cbd5e1");
        const mergedLabel = label("W = W0 + B·A (merged, same size)", "#facc15");
        const bLabel = label("B: d × r", "#fb923c");
        const aLabel = label("A: r × d", "#4ade80");
        const xLabel = label("x", "#5aa9ff");

        const makeDot = (color: number) => {
          const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.09, 12, 8),
            new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
          );
          scene.add(mesh);
          return mesh;
        };
        const blueDots = [0, 1, 2].map(() => makeDot(0x5aa9ff));
        const yellowDots = [0, 1, 2].map(() => makeDot(0xfacc15));

        let ang = -0.7;
        let elev = 0.42;
        let drag: { x: number; y: number } | null = null;
        const down = (event: PointerEvent) => {
          drag = { x: event.clientX, y: event.clientY };
          canvas.setPointerCapture(event.pointerId);
        };
        const move = (event: PointerEvent) => {
          if (!drag) return;
          ang -= (event.clientX - drag.x) * 0.008;
          elev = Math.max(0.05, Math.min(1.15, elev + (event.clientY - drag.y) * 0.005));
          drag = { x: event.clientX, y: event.clientY };
        };
        const up = () => {
          drag = null;
        };
        canvas.addEventListener("pointerdown", down);
        canvas.addEventListener("pointermove", move);
        canvas.addEventListener("pointerup", up);
        canvas.addEventListener("pointercancel", up);

        const along = (pts: Vector3[], u: number) => {
          const span = ((u % 1) + 1) % 1;
          const t = span * (pts.length - 1);
          const i = Math.min(pts.length - 2, Math.floor(t));
          return pts[i].clone().lerp(pts[i + 1], t - i);
        };

        let last = performance.now();
        const loop = () => {
          if (disposed) return;
          frame += 1;
          const state = anim.current;
          const nowRank = live.current;
          state.slide = Math.min(1, state.slide + 0.012);
          state.merge += ((nowRank.merged ? 1 : 0) - state.merge) * 0.05;
          state.thick += (slabW(nowRank.r) - state.thick) * 0.12;
          state.glow *= 0.985;
          const now = performance.now();
          const dt = (now - last) / 1000;
          last = now;
          if (!drag) ang += dt * 0.12;

          const slideB = ease(state.slide / 0.6);
          const slideA = ease((state.slide - 0.3) / 0.6);
          const merge = ease(state.merge);
          const thick = state.thick;
          const shrink = 1 - 0.85 * merge;
          const glowW = Math.max(merge > 0.5 ? (merge - 0.5) * 2 : 0, state.glow * merge);
          const wCenter = new THREE.Vector3(-2.6, 0, 0);
          const bHome = new THREE.Vector3(1.9, 0, 0);
          const aHome = new THREE.Vector3(4.4, 2.5 - thick / 2, 0);
          const bStart = new THREE.Vector3(1.9, 7, 0);
          const aStart = new THREE.Vector3(10, 2.5 - thick / 2, 0);
          const bPos = new THREE.Vector3(
            lerp(lerp(bStart.x, bHome.x, slideB), wCenter.x, merge),
            lerp(lerp(bStart.y, bHome.y, slideB), 0, merge),
            lerp(0, 0.4, merge),
          );
          const aPos = new THREE.Vector3(
            lerp(lerp(aStart.x, aHome.x, slideA), wCenter.x, merge),
            lerp(aHome.y, 0, merge),
            lerp(0, 0.4, merge),
          );

          wMesh.position.copy(wCenter);
          wMesh.scale.set(5, 5, 0.35);
          wMat.color.setRGB(0.58 + 0.4 * glowW, 0.64 + 0.2 * glowW, 0.72 - 0.35 * glowW);
          wMat.emissive.setHex(0xfacc15);
          wMat.emissiveIntensity = glowW * 0.7;
          bMesh.position.copy(bPos);
          bMesh.scale.set(Math.max(0.05, thick * shrink), Math.max(0.05, 5 * shrink), 0.35);
          aMesh.position.copy(aPos);
          aMesh.scale.set(Math.max(0.05, 2.6 * shrink), Math.max(0.05, thick * shrink), 0.35);
          const fade = 0.95 * (1 - merge * 0.92);
          bMat.opacity = fade;
          aMat.opacity = fade;
          bMesh.visible = fade > 0.06;
          aMesh.visible = fade > 0.06;

          wLabel.visible = merge < 0.55;
          mergedLabel.visible = merge >= 0.55;
          wLabel.position.set(-2.6, 3.15, 0);
          mergedLabel.position.set(-2.6, 3.15, 0);
          bLabel.visible = merge < 0.4 && slideB > 0.5;
          bLabel.position.set(bPos.x, -2.85, 0);
          const bMap = bLabel.material.map;
          const bBoard = bMap?.image as HTMLCanvasElement | undefined;
          if (bMap && bBoard && bLabel.visible && bLabel.userData.rank !== nowRank.r) {
            bLabel.userData.rank = nowRank.r;
            const ctx = bBoard.getContext("2d");
            if (ctx) {
              ctx.clearRect(0, 0, bBoard.width, bBoard.height);
              ctx.font = "600 28px sans-serif";
              ctx.fillStyle = "#fb923c";
              ctx.fillText(`B: d × ${nowRank.r}`, 4, 42);
              bMap.needsUpdate = true;
            }
          }
          aLabel.visible = merge < 0.4 && slideA > 0.5;
          aLabel.position.set(aPos.x, aPos.y + thick / 2 + 0.45, 0);
          const aMap = aLabel.material.map;
          const aBoard = aMap?.image as HTMLCanvasElement | undefined;
          if (aMap && aBoard && aLabel.visible && aLabel.userData.rank !== nowRank.r) {
            aLabel.userData.rank = nowRank.r;
            const ctx = aBoard.getContext("2d");
            if (ctx) {
              ctx.clearRect(0, 0, aBoard.width, aBoard.height);
              ctx.font = "600 28px sans-serif";
              ctx.fillStyle = "#4ade80";
              ctx.fillText(`A: ${nowRank.r} × d`, 4, 42);
              aMap.needsUpdate = true;
            }
          }
          xLabel.position.set(-2.9, -3.55, -1.2);

          const bluePath = [
            new THREE.Vector3(-2.6, -3.6, -1.2),
            new THREE.Vector3(-2.6, 0, -0.3),
            new THREE.Vector3(-2.6, 3.6, -1.2),
          ];
          const yellowPath = [
            new THREE.Vector3(-2.6, -3.6, -1.2),
            new THREE.Vector3(4.4, aHome.y, -0.3),
            new THREE.Vector3(1.9, 0, -0.3),
            new THREE.Vector3(-2.6, 3.6, -1.2),
          ];
          blueDots.forEach((dot, index) => {
            dot.position.copy(along(bluePath, frame / 140 + index / 3));
            dot.visible = true;
          });
          yellowDots.forEach((dot, index) => {
            dot.visible = merge < 0.6;
            if (dot.visible) dot.position.copy(along(yellowPath, frame / 140 + 0.15 + index / 3));
          });

          const aspect = (canvas.clientWidth || width) / (canvas.clientHeight || height);
          camera.aspect = aspect;
          camera.updateProjectionMatrix();
          const radius = 16;
          camera.position.set(
            Math.sin(ang) * radius * Math.cos(elev),
            1.2 + radius * Math.sin(elev) * 0.55,
            Math.cos(ang) * radius * Math.cos(elev),
          );
          camera.lookAt(-0.4, 0.2, 0);
          renderer.render(scene, camera);
          raf = requestAnimationFrame(loop);
        };
        setStatus("ready");
        loop();
        cleanup = () => {
          cancelAnimationFrame(raf);
          canvas.removeEventListener("pointerdown", down);
          canvas.removeEventListener("pointermove", move);
          canvas.removeEventListener("pointerup", up);
          canvas.removeEventListener("pointercancel", up);
          renderer.dispose();
          unit.dispose();
          gridMap.dispose();
        };
      })
      .catch(() => {
        if (!disposed) setStatus("error");
      });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cleanup();
    };
  }, []);

  return (
    <div style={{ position: "relative" }}>
      <canvas ref={canvasRef} className="lora-canvas" />
      {status === "loading" ? (
        <div style={{ position: "absolute", top: 16, left: 16, color: "#94a3b8", fontSize: 13 }}>Loading the 3D scene…</div>
      ) : null}
      {status === "error" ? (
        <div style={{ position: "absolute", top: 16, left: 16, color: "#fca5a5", fontSize: 13 }}>
          This browser could not start the WebGL scene.
        </div>
      ) : null}
      <div className="igpt-legend" style={{ zIndex: 2, bottom: 10, top: "auto" }}>
        <div>
          <span style={{ color: "#94a3b8" }}>grey slab</span> = the pre-trained weight matrix (frozen)
        </div>
        <div>
          <span style={{ color: "#fb923c" }}>orange</span> = B, <span style={{ color: "#4ade80" }}>green</span> = A: the only parts that train
        </div>
        <div>
          slab thickness = rank r · <span style={{ color: "#facc15" }}>yellow dots</span> = the extra B·A path
        </div>
        <div>drag to orbit</div>
      </div>
    </div>
  );
}

function useTween(target: number) {
  const [value, setValue] = useState<number>(target);
  const current = useRef(target);
  useEffect(() => {
    let raf = 0;
    const start = current.current;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 700);
      const eased = 1 - Math.pow(1 - k, 3);
      current.current = start + (target - start) * eased;
      setValue(current.current);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return value;
}

const NT = 28;
function makeToy(): number[][] {
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647 - 0.5;
  };
  const M: number[][] = [];
  for (let i = 0; i < NT; i++) {
    const row: number[] = [];
    for (let j = 0; j < NT; j++) {
      const x = i / (NT - 1);
      const y = j / (NT - 1);
      row.push(
        1.2 * Math.sin(3 * x) * Math.cos(2 * y) +
          0.8 * Math.exp(-((x - 0.3) ** 2 + (y - 0.7) ** 2) * 18) +
          0.5 * Math.cos(7 * x + 1) * Math.sin(5 * y) +
          0.25 * (x - 0.5) * Math.sin(11 * y) +
          0.3 * Math.sin(13 * x) * Math.cos(9 * y) +
          0.25 * Math.cos(9 * x * y) +
          0.06 * rnd(),
      );
    }
    M.push(row);
  }
  return M;
}
function svd(M: number[][]) {
  const n = M[0].length;
  const S: number[][] = [];
  for (let a = 0; a < n; a++) {
    const row: number[] = [];
    for (let b = 0; b < n; b++) {
      let sum = 0;
      for (let i = 0; i < M.length; i++) sum += M[i][a] * M[i][b];
      row.push(sum);
    }
    S.push(row);
  }
  const V: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 30; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += S[p][q] * S[p][q];
    if (off < 1e-18) break;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(S[p][q]) < 1e-15) continue;
        const th = (S[q][q] - S[p][p]) / (2 * S[p][q]);
        const tt = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
        const c = 1 / Math.sqrt(tt * tt + 1);
        const s = tt * c;
        for (let k = 0; k < n; k++) {
          const a1 = S[k][p];
          const a2 = S[k][q];
          S[k][p] = c * a1 - s * a2;
          S[k][q] = s * a1 + c * a2;
        }
        for (let k = 0; k < n; k++) {
          const a1 = S[p][k];
          const a2 = S[q][k];
          S[p][k] = c * a1 - s * a2;
          S[q][k] = s * a1 + c * a2;
        }
        for (let k = 0; k < n; k++) {
          const a1 = V[k][p];
          const a2 = V[k][q];
          V[k][p] = c * a1 - s * a2;
          V[k][q] = s * a1 + c * a2;
        }
      }
    }
  }
  const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => S[b][b] - S[a][a]);
  const sv = idx.map((i) => Math.sqrt(Math.max(0, S[i][i])));
  const vs = idx.map((i) => V.map((row) => row[i]));
  const mv = vs.map((v) => M.map((row) => row.reduce((sum, x, j) => sum + x * v[j], 0)));
  return { sv, vs, mv };
}
const TOY = makeToy();
const TOY_SVD = svd(TOY);
const TOY_NORM = Math.sqrt(TOY.reduce((sum, row) => sum + row.reduce((total, x) => total + x * x, 0), 0));
const heat = (v: number) => {
  const t = Math.max(-1, Math.min(1, v / 1.6));
  return t >= 0
    ? `rgb(${(40 + 210 * t) | 0},${(60 + 150 * t) | 0},${(110 - 60 * t) | 0})`
    : `rgb(${(40 - 20 * t) | 0},${(60 - 80 * t) | 0},${(110 - 140 * t) | 0})`;
};

function LowRankToy() {
  const [k, setK] = useState<string>("1");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const kRef = useRef(1);
  const shown = useRef(0);
  kRef.current = Number(k);
  useEffect(() => {
    let raf = 0;
    let disposed = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const loop = () => {
      if (disposed) return;
      shown.current += (kRef.current - shown.current) * 0.06;
      const kk = shown.current;
      const full = Math.floor(kk);
      const frac = kk - full;
      ctx.fillStyle = "#0b1020";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const cell = 9;
      const ox1 = 20;
      const ox2 = 300;
      const oy = 40;
      ctx.fillStyle = "#cbd5e1";
      ctx.font = "13px sans-serif";
      ctx.fillText("original 28 × 28 matrix (toy example)", ox1, 26);
      ctx.fillText(`rank-${kRef.current} copy: B (28 × ${kRef.current}) × A (${kRef.current} × 28)`, ox2, 26);
      let err = 0;
      for (let i = 0; i < NT; i++) {
        for (let j = 0; j < NT; j++) {
          let v = 0;
          for (let c = 0; c <= full && c < NT; c++) {
            const w = c < full ? 1 : frac;
            if (w > 0) v += w * TOY_SVD.mv[c][i] * TOY_SVD.vs[c][j];
          }
          err += (TOY[i][j] - v) ** 2;
          ctx.fillStyle = heat(TOY[i][j]);
          ctx.fillRect(ox1 + j * cell, oy + i * cell, cell - 1, cell - 1);
          ctx.fillStyle = heat(v);
          ctx.fillRect(ox2 + j * cell, oy + i * cell, cell - 1, cell - 1);
        }
      }
      const bx = 580;
      const by = 290;
      const maxS = TOY_SVD.sv[0];
      ctx.fillStyle = "#cbd5e1";
      ctx.font = "13px sans-serif";
      ctx.fillText("strength of each direction", bx, 26);
      for (let c = 0; c < 12; c++) {
        const h = (TOY_SVD.sv[c] / maxS) * 230;
        ctx.fillStyle = c < kRef.current ? "#facc15" : "#334155";
        ctx.fillRect(bx + c * 18, by - h, 13, h);
      }
      ctx.fillStyle = "#94a3b8";
      ctx.fillText("1  →  12", bx, by + 16);
      const pct = (100 * Math.sqrt(err)) / TOY_NORM;
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "600 14px sans-serif";
      ctx.fillText(`error left: ${pct.toFixed(1)}%`, ox2, oy + NT * cell + 22);
      ctx.fillText(`numbers stored: ${kRef.current * 56} vs ${NT * NT}`, ox1, oy + NT * cell + 22);
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <div>
      <div style={{ margin: "8px 0" }}>
        <Segmented
          options={["1", "2", "3", "4", "6", "10", "28"].map((value) => ({ value, label: `rank ${value}` }))}
          value={k}
          onChange={(value: string) => setK(value)}
        />
      </div>
      <canvas ref={canvasRef} width={820} height={320} style={{ width: "100%", display: "block", borderRadius: 12, background: "#0b1020" }} />
    </div>
  );
}

const LAT = [
  { name: "Fine-tune / LoRA (merged)", ms: 19.8, c: "#4ade80" },
  { name: "Adapter (Lin et al.)", ms: 23.9, c: "#fb923c" },
  { name: "Adapter (Houlsby et al.)", ms: 25.8, c: "#f472b6" },
];
function LatencyRace() {
  return (
    <svg width="100%" viewBox="0 0 720 170" style={{ display: "block", background: "#0b1020", borderRadius: 12 }}>
      <text x={16} y={22} fill="#cbd5e1" fontSize="13">
        Time for one forward pass, GPT-2 medium, batch 1, 128 tokens (paper Table 1, ms)
      </text>
      {LAT.map((item) => {
        const w = (item.ms / 26) * 420;
        const y = 40 + LAT.indexOf(item) * 40;
        return (
          <g key={item.name}>
            <text x={200} y={y + 17} textAnchor="end" fill="#e2e8f0" fontSize="13">
              {item.name}
            </text>
            <rect x={210} y={y} height={24} rx={6} fill={item.c} fillOpacity={0.85} width={w}>
              <animate attributeName="width" values={`0;${w};${w};0`} keyTimes="0;0.5;0.92;1" dur={`${(item.ms / 19.8) * 4}s`} repeatCount="indefinite" />
            </rect>
            <text x={220 + w} y={y + 17} fill="#fff" fontSize="13">
              {item.ms} ms
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function VideoCard({ file, title, caption }: { file: string; title: string; caption: string }) {
  return (
    <figure style={{ margin: "0 0 16px" }}>
      <figcaption style={{ fontWeight: 600, marginBottom: 6 }}>{title}</figcaption>
      <video
        src={`/videos/12-lora/${file}`}
        controls
        muted
        loop
        playsInline
        style={{ width: "100%", borderRadius: 12, background: "#0b1020", display: "block" }}
      />
      <p style={{ fontSize: 13, opacity: 0.75, margin: "4px 0 0" }}>{caption}</p>
    </figure>
  );
}

type QuizItem = { q: string; options: string[]; answer: number; why: string };
const QUIZ: QuizItem[] = [
  {
    q: "During LoRA fine-tuning, which numbers get updated?",
    options: ["All 175 billion weights, just more slowly", "Only the small matrices B and A added next to some weight matrices", "Only the last layer"],
    answer: 1,
    why: "The pre-trained weights W0 are frozen and get no gradient updates. LoRA only trains B (d × r) and A (r × d); the change to the weights is their product B·A.",
  },
  {
    q: "Why does LoRA add no extra delay when the model is used?",
    options: ["Because B·A is tiny so it is fast to compute", "Because after training you add B·A into W0, giving one matrix of the original size", "Because it skips some layers"],
    answer: 1,
    why: "B·A has exactly the same shape as W0, so you compute W = W0 + B·A once and run the model as usual. Adapters add extra layers that run one after another, which the paper measured as up to about 20–30% slower at batch size 1.",
  },
  {
    q: "One GPT-3 weight matrix is 12,288 × 12,288. With rank r = 4, how many numbers does LoRA train for it?",
    options: ["About 151 million", "98,304 (that is 2 × 12,288 × 4)", "4"],
    answer: 1,
    why: "B has 12,288 × 4 numbers and A has 4 × 12,288, so 2 × 12,288 × 4 = 98,304. Full fine-tuning of that one matrix would train 12,288² ≈ 151 million, about 1,500× more.",
  },
  {
    q: "What did the paper find about the rank r on GPT-3?",
    options: ["You need r close to 12,288 to match fine-tuning", "A tiny rank, even r = 1 or 2, already works well when adapting the query and value matrices", "Bigger r is always clearly better"],
    answer: 1,
    why: "In Table 6, adapting Wq and Wv with r = 1 gave 73.4% on WikiSQL and 91.3% on MultiNLI, about the same as r = 64 (73.5% and 91.4%). The useful weight change seems to have a very low 'intrinsic rank'.",
  },
  {
    q: "Why does LoRA cut GPU memory during training (1.2TB → 350GB for GPT-3 175B)?",
    options: ["It stores the model in a smaller file format", "The optimizer (Adam) doesn't need gradients or extra state for the frozen weights", "It trains on shorter texts"],
    answer: 1,
    why: "Adam keeps extra numbers (running averages) for every trainable weight, plus gradients. Freeze almost all weights and you skip that for them, so the paper reports VRAM use falling by up to 2/3.",
  },
];

export default function App() {
  const [rs, setRs] = useState<string>("4");
  const [merged, setMerged] = useState<boolean>(false);
  const [replay, setReplay] = useState<number>(0);
  const [picks, setPicks] = useState<(number | null)[]>(QUIZ.map(() => null));
  const rank = Number(rs);
  const perMat = 2 * D * rank;
  const fullMat = D * D;
  const whole = 2 * LAYERS * perMat;
  const tPer = useTween(perMat);
  const tRatio = useTween(fullMat / perMat);
  const tWhole = useTween(whole);

  return (
    <Page title="LoRA: fine-tune a giant model by training two skinny matrices" summary="Paper #12 · Hu et al., Microsoft, 2021 · arXiv 2106.09685" width="wide">
      <Callout tone="info" lead="The big idea in one line.">
        Freeze the giant model and learn only a small low-rank update B·A for each weight matrix; that cuts GPT-3&apos;s trainable parameters by up to 10,000×, and you can fold the update back in so the model runs just as fast.
      </Callout>

      <Section heading="The plain-English version">
        <Text>
          Two days ago, InstructGPT took GPT-3 and fine-tuned it: it kept training all 175 billion numbers on new examples. That works, but it is brutal. Every fine-tuned copy is another 350GB model, and training needs memory not just for the weights but for the gradients and the optimizer&apos;s extra notes on every single one. Want one model for SQL, one for summaries, one for your company&apos;s support chat? That is three giant copies.
        </Text>
        <Text>
          LoRA&apos;s bet: the change fine-tuning makes to a weight matrix is simple, even if the matrix itself is huge. So keep the original matrix W0 frozen and write the change as two skinny matrices multiplied together, B (tall and thin) times A (short and wide). Only B and A are trained. For GPT-3 that is about 4.7 million trainable numbers instead of 175 billion, and the results match or beat full fine-tuning. When you are done you can add B·A into W0, so the finished model is exactly the original size and runs exactly as fast. A new task? Swap in a different B·A, a few megabytes.
        </Text>
      </Section>

      <Section heading="Watch: the idea, animated" caption="Rendered with Manim Community Edition">
        {VIDEOS.map((video) => (
          <VideoCard key={video.file} file={video.file} title={video.title} caption={video.caption} />
        ))}
      </Section>

      <Section heading="Demo 1: slide a low-rank update onto a frozen matrix (3D)" caption="Sizes use GPT-3 175B's d = 12,288. The counts are plain arithmetic, not a measured training run.">
        <Text>
          The big grey slab is one frozen weight matrix. B (orange) drops in, A (green) slides in, and together they make the update. Pick a rank: the slabs get thicker and the count of trainable numbers goes up, but it stays tiny next to the full matrix. Press Merge to fold B·A into the weights; the yellow side path disappears, which is why LoRA adds no delay.
        </Text>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", margin: "8px 0" }}>
          <Segmented options={RANKS.map((value) => ({ value: String(value), label: `r = ${value}` }))} value={rs} onChange={(value: string) => setRs(value)} />
          <Button label={merged ? "Un-merge (back to training)" : "Merge B·A into W"} variant="primary" onClick={() => setMerged(!merged)} />
          <Button
            label="Replay slide-in"
            onClick={() => {
              setMerged(false);
              setReplay(replay + 1);
            }}
          />
        </div>
        <LoraScene r={rank} merged={merged} replay={replay} />
        <Metrics
          metrics={[
            { value: fmt(tPer), label: "Trainable numbers, this matrix (2 × d × r)" },
            { value: `${Math.round(tRatio).toLocaleString("en-US")}×`, label: "Fewer than full fine-tuning of it (d × d ≈ 151M)", tone: "success" },
            { value: fmt(tWhole), label: "Whole GPT-3, LoRA on Wq and Wv in all 96 layers" },
            { value: fmtBytes(whole * 2), label: "LoRA file size at 16 bits per number (full model: 350GB)" },
          ]}
        />
        <Callout tone={merged ? "success" : "info"}>
          {merged
            ? "Merged: W = W0 + B·A is one matrix of the original size. One multiply, same speed as the original model."
            : `Training mode: the input goes through W0 and through A then B, and the two outputs are added. Only the ${fmt(perMat)} numbers in B and A are learning.`}
        </Callout>
        <Text>
          Check the paper&apos;s numbers: at r = 1 the whole-model count is 4.7M, the same as the paper&apos;s best GPT-3 setting in Table 4. At r = 4 it is about 18.9M; the paper calls that roughly 18M, about 35MB stored, versus 350GB for a full copy.
        </Text>
      </Section>

      <Section heading="Demo 2: how much can a few directions capture?" caption="Toy example: a made-up 28 × 28 matrix, not data from the paper.">
        <Text>
          LoRA is a bet that a weight update only needs a few directions. Here is the same idea on a small made-up matrix. Pick a rank: the right picture is rebuilt from only that many column-times-row pieces (exactly what B × A is). A handful of pieces already gets close, because the strength of each extra direction (yellow bars) falls off fast. Real weight updates aren&apos;t guaranteed to look like this; the paper tests it experimentally.
        </Text>
        <LowRankToy />
      </Section>

      <Section heading="Demo 3: why merging matters for speed">
        <Text>
          Earlier tricks for cheap fine-tuning, called adapters, insert small extra layers into the network. Those layers run one after another, so every request waits for them. LoRA, once merged, runs at the same speed as a fully fine-tuned model.
        </Text>
        <LatencyRace />
      </Section>

      <Section heading="How it works">
        <Steps
          steps={[
            { title: "Pick weight matrices to adapt", detail: "In a Transformer the paper adapts only attention matrices, mainly the query (Wq) and value (Wv) projections. The MLP layers stay frozen." },
            { title: "Freeze W0, add B and A", detail: "For a d × k matrix W0, add B (d × r) and A (r × k) with a small rank r. A starts random and B starts at zero, so B·A = 0 and training begins exactly at the pre-trained model." },
            { title: "Train only B and A", detail: "The forward pass becomes h = W0·x + B·A·x (the update is scaled by a constant α / r). Gradients and Adam state are needed only for B and A." },
            { title: "Deploy: merge or swap", detail: "Store W = W0 + B·A and run as usual. To switch tasks, subtract B·A and add another task's B′·A′." },
          ]}
        />
        <Equation>
          <span>h = W₀x + ΔWx = W₀x + BAx</span>
        </Equation>
        <Text>
          Why &quot;low rank&quot;? A d × d matrix built as B·A, where B has only r columns, can only push inputs in r independent directions. LoRA assumes the change fine-tuning needs lives in just a few directions, and the paper&apos;s experiments back that up.
        </Text>
      </Section>

      <Section heading="What the paper actually claimed">
        <Metrics
          metrics={[
            { value: "10,000×", label: "Fewer trainable parameters vs full fine-tuning of GPT-3 175B (up to)", tone: "success" },
            { value: "3×", label: "Less GPU memory: 1.2TB → 350GB during training", tone: "success" },
            { value: "0", label: "Extra inference latency once merged" },
            { value: "25%", label: "Faster training on GPT-3 175B" },
          ]}
        />
        <Table
          columns={["Finding", "What they measured"]}
          rows={[
            ["Matches or beats full fine-tuning on GPT-3", "Table 4, 4.7M trainable vs 175,255.8M: WikiSQL 73.4% vs 73.8%, MultiNLI 91.7% vs 89.5%, SAMSum ROUGE-1 53.8 vs 52.0"],
            ["Works on smaller models too (GLUE)", "RoBERTa-base: 0.3M trainable, avg 87.2 vs 86.4 for full FT (125M). DeBERTa XXL: 4.7M, avg 91.3 vs 91.1 (1.5B)"],
            ["Tiny ranks are enough", "Adapting Wq and Wv, r = 1 already gave 73.4% WikiSQL / 91.3% MultiNLI; r = 64 gave 73.5% / 91.4%"],
            ["Spread the budget over more matrices", "With a fixed 18M budget, adapting Wq and Wv at r = 4 beat putting it all into one matrix at r = 8"],
            ["Tiny checkpoints", "With r = 4 on Wq and Wv, checkpoint size drops about 10,000× (350GB → 35MB); 100 tasks need about 354GB instead of 35TB"],
            ["Adapters slow inference", "GPT-2 medium, batch 1, 128 tokens: 19.8 ms for fine-tune/LoRA vs 23.9 ms (+20.7%) and 25.8 ms (+30.3%) for adapters"],
            ["ΔW amplifies hidden features", "The update boosts directions already in W but not emphasised by it, by a large factor (about 21.5× for r = 4 in one layer)"],
          ]}
        />
        <Callout tone="warning" lead="Limits the authors name.">
          If you merge B·A into the weights, it is not straightforward to batch requests for different tasks together in one forward pass. A small rank won&apos;t work for every task: if the new task were in a different language from pre-training, retraining much more (a large r) could clearly win. They only adapted attention weights; MLP layers, LayerNorm and biases were left for future work.
        </Callout>
      </Section>

      <Section heading="Quick quiz">
        {QUIZ.map((item, index) => (
          <Section key={item.q} heading={`${index + 1}. ${item.q}`}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {item.options.map((option, oi) => (
                <Button
                  key={option}
                  label={option}
                  variant={picks[index] === oi ? "primary" : "quiet"}
                  onClick={() => setPicks(picks.map((pick, z) => (z === index ? oi : pick)))}
                />
              ))}
            </div>
            {picks[index] === null ? null : picks[index] === item.answer ? (
              <Callout tone="success" lead="Right.">
                {item.why}
              </Callout>
            ) : (
              <Callout tone="warning" lead="Not quite.">
                {item.why}
              </Callout>
            )}
          </Section>
        ))}
        <Text>
          Then tell me in chat, in your own words: why can LoRA fine-tune a huge model by training only two small matrices, and why does it add no extra delay when the model is used?
        </Text>
      </Section>

      <Section heading="Read it yourself">
        <LinkCards
          links={[
            { title: "LoRA: Low-Rank Adaptation of Large Language Models (arXiv abs)", site: "arxiv.org", date: "2021", href: "https://arxiv.org/abs/2106.09685" },
            { title: "LoRA: Low-Rank Adaptation of Large Language Models (PDF)", site: "arxiv.org", date: "2021", href: "https://arxiv.org/pdf/2106.09685" },
            { title: "Paper #10 recap: InstructGPT (full fine-tuning of GPT-3)", site: "papers-a-day", date: "2022", href: "/papers/10-instructgpt" },
            { title: "Paper #8 recap: GPT-3", site: "papers-a-day", date: "2020", href: "/papers/08-gpt3" },
          ]}
        />
      </Section>
    </Page>
  );
}
