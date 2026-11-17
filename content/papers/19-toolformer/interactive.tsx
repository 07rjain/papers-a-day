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
  Select,
  useState,
  useEffect,
  useMemo,
  useRef,
} from "grok/canvas";
import { QuizSync } from "@/components/study/progress";
import { useReducedMotion } from "@/components/viz/shell";

// Demos 1 and 3 use toy losses and toy next-token probabilities. The sentences and calls are from the paper.
// Demo 2 uses the real Table 10 filter scores and the real Table 2 dataset sizes.

const VIDEOS = [
  {
    file: "SampleExecuteFilter.mp4",
    title: "Sample, execute, filter",
    caption:
      "Figure 2: at a promising spot in \"Pittsburgh is also known as | the Steel City\", the model writes candidate questions, the QA tool answers them, and only the call whose answer makes the next words easier to predict is kept. Bar heights in the clip are illustrative.",
  },
  {
    file: "BuildAndFinetune.mp4",
    title: "From web text to Toolformer",
    caption:
      "Each of the five tools annotates the same plain web text (CCNet). The surviving calls, Table 2 at τf = 1.0, are merged into the text, and GPT-J (6.7B) is fine-tuned with ordinary next-word training. Perplexity stays 10.5 versus 10.5 on CCNet.",
  },
  {
    file: "ToolCallAtInference.mp4",
    title: "Calling a tool while writing",
    caption:
      "Figure 1: the model writes [Calculator(400 / 1400) →, decoding pauses, the calculator returns 0.29, and the model continues with \"29%) passed the test.\" Then the math scores from Table 4.",
  },
];

const WRAW = [1, 0.8, 0.6, 0.4, 0.2];
const WSUM = WRAW.reduce((sum, value) => sum + value, 0);
const W = WRAW.map((value) => value / WSUM);
const weightedLoss = (losses: number[]) => losses.reduce((sum, value, index) => sum + (W[index] || 0) * value, 0);

type Candidate = { call: string; result: string; noAnswer: number[]; withAnswer: number[] };
type Example = { name: string; prefix: string[]; next: string[]; none: number[]; candidates: Candidate[] };

const EXAMPLES: Example[] = [
  {
    name: "Pittsburgh (QA, Figure 2)",
    prefix: ["Pittsburgh", "is", "also", "known", "as"],
    next: ["the", "Steel", "City", "."],
    none: [1.3, 4.6, 2.2, 0.9],
    candidates: [
      { call: "QA(What other name is Pittsburgh known by?)", result: "Steel City", noAnswer: [1.2, 4.4, 2.1, 0.9], withAnswer: [0.9, 0.5, 0.2, 0.8] },
      { call: "QA(Which country is Pittsburgh in?)", result: "United States", noAnswer: [1.3, 4.5, 2.2, 0.9], withAnswer: [1.3, 4.4, 2.1, 0.9] },
      { call: "QA(What is Pittsburgh famous for?)", result: "steel industry", noAnswer: [1.3, 4.4, 2.2, 0.9], withAnswer: [1.2, 2.6, 1.9, 0.9] },
    ],
  },
  {
    name: "Participants (Calculator, Figure 1)",
    prefix: ["Out", "of", "1400", "participants,", "400", "(or"],
    next: ["29", "%)", "passed", "the", "test."],
    none: [4.2, 0.8, 1.6, 0.4, 0.6],
    candidates: [
      { call: "Calculator(400 / 1400)", result: "0.29", noAnswer: [4.0, 0.8, 1.6, 0.4, 0.6], withAnswer: [0.4, 0.3, 1.5, 0.4, 0.6] },
      { call: "Calculator(1400 - 400)", result: "1000", noAnswer: [4.1, 0.8, 1.6, 0.4, 0.6], withAnswer: [4.4, 0.9, 1.6, 0.4, 0.6] },
      { call: "Calculator(400 * 1400)", result: "560000", noAnswer: [4.1, 0.8, 1.6, 0.4, 0.6], withAnswer: [4.5, 0.9, 1.6, 0.4, 0.6] },
    ],
  },
  {
    name: "Library hours (Calendar, Table 10)",
    prefix: ["Note:", "the", "WL", "will", "be", "open", "on", "Friday,"],
    next: ["March", "10,", "and", "Sunday,", "March"],
    none: [3.6, 3.1, 0.9, 1.4, 1.0],
    candidates: [
      { call: "Calendar()", result: "Today is Thursday, March 9, 2017.", noAnswer: [3.5, 3.0, 0.9, 1.4, 1.0], withAnswer: [0.7, 0.6, 0.9, 1.3, 0.4] },
      { call: "QA(When is Friday?)", result: "a day of the week", noAnswer: [3.6, 3.1, 0.9, 1.4, 1.0], withAnswer: [3.7, 3.1, 0.9, 1.4, 1.0] },
      { call: "WikiSearch(Friday)", result: "Friday is the day of the week between Thursday and Saturday", noAnswer: [3.6, 3.1, 0.9, 1.4, 1.0], withAnswer: [3.3, 3.0, 0.9, 1.4, 1.0] },
    ],
  },
  {
    name: "La tortuga (Translation, Figure 1)",
    prefix: ["derives", "from", "\"la", "tortuga\",", "the", "Spanish", "word", "for"],
    next: ["turtle", "."],
    none: [5.0, 0.7],
    candidates: [
      { call: "MT(tortuga)", result: "turtle", noAnswer: [4.9, 0.7], withAnswer: [0.3, 0.6] },
      { call: "QA(What is la tortuga?)", result: "a restaurant", noAnswer: [5.0, 0.7], withAnswer: [5.1, 0.7] },
      { call: "WikiSearch(Tortuga)", result: "Tortuga is an island off the coast of Haiti", noAnswer: [5.0, 0.7], withAnswer: [4.4, 0.7] },
    ],
  },
];

function scoreCandidate(example: Example, candidate: Candidate) {
  const noCall = weightedLoss(example.none);
  const callOnly = weightedLoss(candidate.noAnswer);
  const withAnswer = weightedLoss(candidate.withAnswer);
  const baseline = Math.min(noCall, callOnly);
  return { noCall, callOnly, withAnswer, baseline, gain: baseline - withAnswer };
}

const tokenWidth = (word: string) => Math.max(0.95, word.length * 0.2 + 0.5);

function ease(value: number) {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
}

function lossHex(value: number) {
  const mix = Math.max(0, Math.min(1, value / 4.5));
  const red = Math.round(74 + (248 - 74) * mix);
  const green = Math.round(222 + (113 - 222) * mix);
  const blue = Math.round(128 + (113 - 128) * mix);
  return (red << 16) | (green << 8) | blue;
}

function phaseText(time: number, tau: number, kept: boolean) {
  if (time < 1.4) return "1 · Find a spot where the call token is likely.";
  if (time < 2.8) return "1 · Sample candidate calls from the model.";
  if (time < 4.2) return "2 · Execute them. The tools write an answer.";
  if (time < 6.6) return "3 · Filter. Weighted loss on the next tokens, with and without each call.";
  if (time < 9) return `3 · Keep a call when L− − L+ is at least τf = ${tau}.`;
  return kept ? "The kept call slides into the text. That text is what fine-tuning sees." : "No call helped enough. The text stays as it was.";
}

function StreamScene({ example, tau, playKey }: { example: Example; tau: number; playKey: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const labelsRef = useRef<HTMLDivElement | null>(null);
  const statusRef = useRef<HTMLParagraphElement | null>(null);
  const reduced = useReducedMotion();
  const live = useRef({ example, tau, playKey, reduced, time: 0 });
  live.current.example = example;
  live.current.tau = tau;
  live.current.reduced = reduced;

  useEffect(() => {
    live.current.playKey = playKey;
    live.current.time = reduced ? 11 : 0;
  }, [playKey, reduced]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const labelLayer = labelsRef.current;
    if (!canvas || !labelLayer) return;
    let dead = false;
    let raf = 0;
    let cleanup = () => {};
    import("three").then((THREE) => {
      if (dead) return;
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x060a14);
      const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
      scene.add(new THREE.AmbientLight(0xffffff, 0.75));
      const light = new THREE.DirectionalLight(0xffffff, 0.85);
      light.position.set(4, 12, 8);
      scene.add(light);
      const grid = new THREE.GridHelper(28, 14, 0x243044, 0x1a2433);
      scene.add(grid);
      const textures: import("three").CanvasTexture[] = [];
      const planes: import("three").Mesh[] = [];
      const makeTexture = (text: string, color: string) => {
        const board = document.createElement("canvas");
        board.width = 1024;
        board.height = 160;
        const context = board.getContext("2d");
        if (!context) return null;
        context.clearRect(0, 0, 1024, 160);
        context.fillStyle = color;
        context.font = `${text.length > 36 ? 40 : 56}px sans-serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(text, 512, 80);
        const texture = new THREE.CanvasTexture(board);
        texture.needsUpdate = true;
        textures.push(texture);
        return texture;
      };
      const makePlane = (text: string, color: string, width: number, height: number) => {
        const mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(width, height),
          new THREE.MeshBasicMaterial({ map: makeTexture(text, color) ?? undefined, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
        );
        mesh.userData.label = text;
        planes.push(mesh);
        return mesh;
      };
      const setPlane = (mesh: import("three").Mesh, text: string, color: string) => {
        if (mesh.userData.label === `${color}|${text}`) return;
        mesh.userData.label = `${color}|${text}`;
        const material = mesh.material as import("three").MeshBasicMaterial;
        material.map?.dispose();
        material.map = makeTexture(text, color);
        material.needsUpdate = true;
      };
      const makeBox = (width: number, height: number, depth: number, color: number) =>
        new THREE.Mesh(
          new THREE.BoxGeometry(width, height, depth),
          new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.05 }),
        );
      type Token = { box: import("three").Mesh; label: import("three").Mesh; loss?: import("three").Mesh; weight?: import("three").Mesh };
      let prefix: Token[] = [];
      let nextTokens: Token[] = [];
      let slot = makeBox(0.16, 1.15, 0.7, 0x5aa9ff);
      (slot.material as import("three").MeshStandardMaterial).emissive = new THREE.Color(0x5aa9ff);
      scene.add(slot);
      const keptBox = makeBox(1, 0.55, 0.7, 0x166534);
      (keptBox.material as import("three").MeshStandardMaterial).emissive = new THREE.Color(0x14532d);
      const keptLabel = makePlane("", "#bbf7d0", 1, 0.32);
      scene.add(keptBox, keptLabel);
      const cards = [0, 1, 2].map(() => {
        const box = makeBox(1, 0.55, 0.35, 0x172554);
        const call = makePlane("", "#dbeafe", 1, 0.32);
        const result = makePlane("", "#fde68a", 1, 0.28);
        const bars = [0x64748b, 0x94a3b8, 0x4ade80].map((color) => makeBox(0.28, 1, 0.28, color));
        const gain = makePlane("", "#4ade80", 1.6, 0.28);
        const verdict = makePlane("", "#4ade80", 1.4, 0.3);
        scene.add(box, call, result, gain, verdict, ...bars);
        return { box, call, result, bars, gain, verdict };
      });
      const built: import("three").Mesh[] = [slot, keptBox, keptLabel];
      cards.forEach((card) => built.push(card.box, card.call, card.result, card.gain, card.verdict, ...card.bars));

      const rebuild = (current: Example) => {
        prefix.forEach((token) => {
          scene.remove(token.box, token.label);
          token.box.geometry.dispose();
          (token.box.material as { dispose: () => void }).dispose();
        });
        nextTokens.forEach((token) => {
          scene.remove(token.box, token.label);
          token.loss && scene.remove(token.loss);
          token.weight && scene.remove(token.weight);
          token.box.geometry.dispose();
          (token.box.material as { dispose: () => void }).dispose();
        });
        prefix = current.prefix.map((word) => {
          const width = tokenWidth(word);
          const box = makeBox(width, 0.55, 0.7, 0x1e293b);
          const label = makePlane(word, "#e2e8f0", width * 0.92, 0.32);
          scene.add(box, label);
          return { box, label };
        });
        nextTokens = current.next.map((word) => {
          const width = tokenWidth(word);
          const box = makeBox(width, 0.55, 0.7, 0x1e293b);
          const label = makePlane(word, "#e2e8f0", width * 0.92, 0.32);
          const loss = makePlane("0.0", "#94a3b8", width * 0.9, 0.24);
          const weight = makePlane("w", "#64748b", width * 0.9, 0.22);
          scene.add(box, label, loss, weight);
          return { box, label, loss, weight };
        });
      };
      const projector = new THREE.Vector3();
      const htmlNodes: HTMLDivElement[] = [];
      const makeHtml = (size: number) => {
        const el = document.createElement("div");
        el.style.cssText = `position:absolute;transform:translate(-50%,-140%);color:#f8fafc;font:600 ${size}px sans-serif;text-shadow:0 1px 3px #000,0 0 2px #000;white-space:nowrap;`;
        labelLayer.appendChild(el);
        htmlNodes.push(el);
        return el;
      };
      const placeHtml = (el: HTMLDivElement, x: number, y: number, z: number, show: boolean) => {
        if (!show) {
          el.style.display = "none";
          return;
        }
        projector.set(x, y, z).project(camera);
        if (projector.z > 1) {
          el.style.display = "none";
          return;
        }
        el.style.display = "block";
        el.style.left = `${(projector.x * 0.5 + 0.5) * canvas.clientWidth}px`;
        el.style.top = `${(-projector.y * 0.5 + 0.5) * canvas.clientHeight}px`;
      };
      let prefixHtml: HTMLDivElement[] = [];
      let nextHtml: HTMLDivElement[] = [];
      const callHtml = [0, 1, 2].map(() => makeHtml(13));
      const gainHtml = [0, 1, 2].map(() => makeHtml(12));
      const verdictHtml = [0, 1, 2].map(() => makeHtml(13));
      const refreshTokenHtml = (current: Example) => {
        prefixHtml.forEach((el) => el.remove());
        nextHtml.forEach((el) => el.remove());
        prefixHtml = current.prefix.map((word) => {
          const el = makeHtml(14);
          el.textContent = word;
          return el;
        });
        nextHtml = current.next.map((word) => {
          const el = makeHtml(14);
          el.textContent = word;
          return el;
        });
      };
      rebuild(live.current.example);
      refreshTokenHtml(live.current.example);
      let builtName = live.current.example.name;

      const resize = () => {
        const width = canvas.clientWidth || 760;
        const height = canvas.clientHeight || 480;
        renderer.setSize(width, height, false);
        camera.aspect = width / Math.max(1, height);
        camera.updateProjectionMatrix();
      };
      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(canvas);
      let yaw = 0.35;
      let pitch = 0.42;
      let drag: { x: number; y: number } | null = null;
      const down = (event: PointerEvent) => {
        drag = { x: event.clientX, y: event.clientY };
        canvas.setPointerCapture(event.pointerId);
      };
      const move = (event: PointerEvent) => {
        if (!drag) return;
        yaw -= (event.clientX - drag.x) * 0.008;
        pitch = Math.max(0.15, Math.min(1.05, pitch + (event.clientY - drag.y) * 0.005));
        drag = { x: event.clientX, y: event.clientY };
      };
      const up = () => {
        drag = null;
      };
      canvas.addEventListener("pointerdown", down);
      canvas.addEventListener("pointermove", move);
      canvas.addEventListener("pointerup", up);

      const loop = () => {
        raf = requestAnimationFrame(loop);
        if (dead) return;
        const current = live.current;
        if (builtName !== current.example.name) {
          builtName = current.example.name;
          rebuild(current.example);
          refreshTokenHtml(current.example);
        }
        if (current.reduced) current.time = 11;
        else current.time = Math.min(11, current.time + 1 / 60);
        const time = current.time;
        const scores = current.example.candidates.map((candidate) => scoreCandidate(current.example, candidate));
        let best = -1;
        scores.forEach((score, index) => {
          if (score.gain >= current.tau && (best < 0 || score.gain > scores[best].gain)) best = index;
        });
        const prefixWidths = current.example.prefix.map(tokenWidth);
        const nextWidths = current.example.next.map(tokenWidth);
        const keptWidth = best >= 0 ? Math.min(7.2, (current.example.candidates[best].call.length + current.example.candidates[best].result.length) * 0.11 + 1.2) : 0;
        const insert = ease((time - 7.6) / 1.4) * (best >= 0 ? 1 : 0);
        const total =
          prefixWidths.reduce((sum, width) => sum + width + 0.16, 0) +
          nextWidths.reduce((sum, width) => sum + width + 0.16, 0) +
          1.4 +
          keptWidth * insert;
        let cursor = -total / 2;
        prefix.forEach((token, index) => {
          const width = prefixWidths[index];
          token.box.scale.set(1, 1, 1);
          token.box.position.set(cursor + width / 2, 0.28, 0);
          token.label.position.set(cursor + width / 2, 0.28, 0.4);
          cursor += width + 0.16;
        });
        const gap = cursor + 0.55;
        slot.position.set(gap, 0.55, 0);
        (slot.material as import("three").MeshStandardMaterial).emissiveIntensity = time < 1.5 ? 0.35 + 0.45 * Math.sin(time * 6) : 0.2;
        keptBox.visible = insert > 0.02;
        keptLabel.visible = insert > 0.85;
        if (best >= 0) {
          const width = Math.max(0.2, keptWidth * insert);
          keptBox.scale.set(width, 1, 1);
          keptBox.position.set(gap + 0.45 + width / 2, 0.28, 0);
          keptLabel.position.set(keptBox.position.x, 0.28, 0.42);
          keptLabel.scale.set(Math.max(0.4, width * 0.9), 1, 1);
          setPlane(keptLabel, `[${current.example.candidates[best].call} → ${current.example.candidates[best].result}]`, "#bbf7d0");
        }
        cursor = gap + 1.15 + keptWidth * insert;
        const showLoss = time >= 4.2;
        const which = showLoss && time < 7.6 ? Math.min(current.example.candidates.length - 1, Math.floor((time - 4.2) / 1.1)) : best;
        nextTokens.forEach((token, index) => {
          const width = nextWidths[index];
          const lossValue = which >= 0 && showLoss ? current.example.candidates[which].withAnswer[index] : current.example.none[index];
          const color = showLoss ? lossHex(lossValue) : 0x334155;
          (token.box.material as import("three").MeshStandardMaterial).color.setHex(color);
          (token.box.material as import("three").MeshStandardMaterial).emissive.setHex(showLoss ? color : 0x000000);
          (token.box.material as import("three").MeshStandardMaterial).emissiveIntensity = showLoss ? 0.25 : 0;
          token.box.position.set(cursor + width / 2, 0.28, 0);
          token.label.position.set(cursor + width / 2, 0.28, 0.4);
          if (token.loss && token.weight) {
            token.loss.visible = showLoss;
            token.weight.visible = showLoss && index < W.length;
            token.loss.position.set(cursor + width / 2, -0.25, 0.2);
            token.weight.position.set(cursor + width / 2, -0.55, 0.2);
            setPlane(token.loss, lossValue.toFixed(1), showLoss ? "#e2e8f0" : "#94a3b8");
            setPlane(token.weight, `w ${W[index]?.toFixed(2) ?? ""}`, "#94a3b8");
          }
          cursor += width + 0.16;
        });
        const decided = time >= 6.6;
        cards.forEach((card, index) => {
          const candidate = current.example.candidates[index];
          const score = scores[index];
          const rise = ease((time - 1.4 - index * 0.3) / 0.9);
          const kept = score.gain >= current.tau;
          const isBest = index === best;
          let height = 1.05 + rise * (0.55 + index * 1.15);
          let depth = -1.7;
          let alpha = rise;
          if (decided && !kept) {
            const drop = ease((time - 6.6) / 1.2);
            height -= drop * 1.3;
            alpha *= 1 - 0.8 * drop;
          }
          if (decided && kept && isBest) {
            const slide = ease((time - 7.6) / 1.4);
            height += (0.4 - height) * slide;
            depth += (0.2 - depth) * slide;
            alpha *= 1 - slide;
          }
          if (decided && kept && !isBest) alpha *= 0.55;
          const visible = alpha > 0.04;
          card.box.visible = visible;
          card.call.visible = visible;
          card.result.visible = visible && ease((time - 2.8 - index * 0.25) / 0.6) > 0.05;
          card.gain.visible = visible && ease((time - 4.2 - index * 1.1) / 0.8) > 0.9;
          card.verdict.visible = visible && decided;
          const width = Math.min(7.4, candidate.call.length * 0.13 + 1.1);
          card.box.scale.set(width, 1, 1);
          card.box.position.set(gap, height, depth);
          (card.box.material as import("three").MeshStandardMaterial).opacity = alpha;
          (card.box.material as import("three").MeshStandardMaterial).transparent = true;
          (card.box.material as import("three").MeshStandardMaterial).color.setHex(!decided ? 0x172554 : kept ? 0x14532d : 0x450a0a);
          (card.box.material as import("three").MeshStandardMaterial).emissive.setHex(!decided ? 0x1d4ed8 : kept ? 0x166534 : 0x991b1b);
          (card.box.material as import("three").MeshStandardMaterial).emissiveIntensity = decided ? 0.35 : 0.15;
          card.call.position.set(gap, height + 0.02, depth + 0.28);
          card.call.scale.set(width * 0.92, 1, 1);
          setPlane(card.call, candidate.call, "#dbeafe");
          (card.call.material as import("three").MeshBasicMaterial).opacity = alpha;
          card.result.position.set(gap, height - 0.34, depth + 0.28);
          card.result.scale.set(Math.min(width * 0.92, candidate.result.length * 0.16 + 1.2), 1, 1);
          const resultText = candidate.result.length > 28 ? `${candidate.result.slice(0, 26)}…` : candidate.result;
          setPlane(card.result, `→ ${resultText}`, "#fde68a");
          (card.result.material as import("three").MeshBasicMaterial).opacity = alpha;
          const grow = ease((time - 4.2 - index * 1.1) / 0.8);
          [score.noCall, score.callOnly, score.withAnswer].forEach((value, barIndex) => {
            const bar = card.bars[barIndex];
            const barHeight = Math.max(0.05, value * 0.42 * grow);
            bar.visible = visible && grow > 0.02;
            bar.scale.y = barHeight;
            bar.position.set(gap - width / 2 - 1.35 + barIndex * 0.4, height - 0.2 + barHeight / 2, depth);
            (bar.material as import("three").MeshStandardMaterial).opacity = alpha;
            (bar.material as import("three").MeshStandardMaterial).transparent = true;
            if (barIndex === 2) (bar.material as import("three").MeshStandardMaterial).color.setHex(kept ? 0x4ade80 : 0xfb923c);
          });
          card.gain.position.set(gap - width / 2 - 1.7, height + 0.55, depth);
          setPlane(card.gain, `gain ${score.gain.toFixed(2)}`, kept ? "#4ade80" : "#f87171");
          (card.gain.material as import("three").MeshBasicMaterial).opacity = alpha;
          card.verdict.position.set(gap + width / 2 + 0.2, height + 0.55, depth);
          setPlane(card.verdict, kept ? (isBest ? "KEEP" : "passes too") : "DROP", kept ? "#4ade80" : "#f87171");
          (card.verdict.material as import("three").MeshBasicMaterial).opacity = alpha;
        });
        const orbit = drag || current.reduced ? yaw : 0.55 + Math.sin(time * 0.35) * 0.22;
        const aspect = Math.max(camera.aspect, 0.55);
        const distance = Math.max(12, (total * 0.62) / (Math.tan((40 * Math.PI) / 360) * aspect));
        const lift = drag ? 4.2 + Math.sin(pitch) * 2.4 : 3.6;
        camera.position.set(Math.sin(orbit) * distance, lift, Math.cos(orbit) * distance);
        camera.lookAt(0, 0.9, -0.6);
        prefix.forEach((token, index) => {
          token.label.visible = false;
          placeHtml(prefixHtml[index], token.box.position.x, 0.85, 0, true);
        });
        nextTokens.forEach((token, index) => {
          token.label.visible = false;
          if (token.loss) token.loss.visible = false;
          if (token.weight) token.weight.visible = false;
          placeHtml(nextHtml[index], token.box.position.x, showLoss ? 0.95 : 0.85, 0, true);
          if (showLoss) nextHtml[index].textContent = `${current.example.next[index]} ${current.example.candidates[which >= 0 ? which : 0]?.withAnswer[index]?.toFixed(1) ?? ""}`;
          else nextHtml[index].textContent = current.example.next[index];
        });
        cards.forEach((card, index) => {
          card.call.visible = false;
          card.result.visible = false;
          card.gain.visible = false;
          card.verdict.visible = false;
          const candidate = current.example.candidates[index];
          const score = scores[index];
          const kept = score.gain >= current.tau;
          const showCard = card.box.visible;
          callHtml[index].textContent = showCard ? candidate.call : "";
          callHtml[index].style.color = "#dbeafe";
          gainHtml[index].textContent = showCard && time > 5 ? `gain ${score.gain.toFixed(2)}` : "";
          gainHtml[index].style.color = kept ? "#4ade80" : "#f87171";
          verdictHtml[index].textContent = showCard && time >= 6.6 ? (kept ? (index === best ? "KEEP" : "passes too") : "DROP") : "";
          verdictHtml[index].style.color = kept ? "#4ade80" : "#f87171";
          placeHtml(callHtml[index], card.box.position.x, card.box.position.y + 0.7, card.box.position.z, showCard);
          placeHtml(gainHtml[index], card.box.position.x - 1.2, card.box.position.y + 0.15, card.box.position.z, Boolean(gainHtml[index].textContent));
          placeHtml(verdictHtml[index], card.box.position.x, card.box.position.y + 1.15, card.box.position.z, Boolean(verdictHtml[index].textContent));
        });
        if (statusRef.current) statusRef.current.textContent = phaseText(time, current.tau, best >= 0);
        renderer.render(scene, camera);
      };
      loop();
      cleanup = () => {
        cancelAnimationFrame(raf);
        observer.disconnect();
        canvas.removeEventListener("pointerdown", down);
        canvas.removeEventListener("pointermove", move);
        canvas.removeEventListener("pointerup", up);
        [...prefix, ...nextTokens].forEach((token) => {
          token.box.geometry.dispose();
          (token.box.material as { dispose: () => void }).dispose();
        });
        built.forEach((mesh) => {
          mesh.geometry.dispose();
          const material = mesh.material as { dispose?: () => void };
          material.dispose?.();
        });
        textures.forEach((texture) => texture.dispose());
        htmlNodes.forEach((el) => el.remove());
        renderer.dispose();
      };
    });
    return () => {
      dead = true;
      cleanup();
    };
  }, []);

  return (
    <div style={{ position: "relative" }}>
      <canvas
        ref={canvasRef}
        aria-label="Toy text stream. Tokens sit on the floor, candidate API calls rise above a gap, and loss bars decide which call is kept."
        style={{ width: "100%", height: 500, display: "block", borderRadius: 12, cursor: "grab", touchAction: "none", background: "#060a14" }}
      />
      <div ref={labelsRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }} />
      <p ref={statusRef} className="viz-note">
        Sample, execute, then filter.
      </p>
    </div>
  );
}

function StreamDemo() {
  const [name, setName] = useState(EXAMPLES[0].name);
  const [tau, setTau] = useState("1.0");
  const [seed, setSeed] = useState(0);
  const example = EXAMPLES.find((item) => item.name === name) || EXAMPLES[0];
  const threshold = Number.parseFloat(tau);
  const rows = useMemo(
    () =>
      example.candidates.map((candidate) => {
        const score = scoreCandidate(example, candidate);
        const kept = score.gain >= threshold;
        return [
          `${candidate.call} → ${candidate.result}`,
          score.noCall.toFixed(2),
          score.callOnly.toFixed(2),
          score.withAnswer.toFixed(2),
          { text: score.gain.toFixed(2), tone: kept ? ("success" as const) : ("danger" as const) },
          kept ? "keep" : "drop",
        ];
      }),
    [example, threshold],
  );
  return (
    <Section
      heading="Demo 1: sample, execute, filter"
      caption="Tokens sit on the floor. A blue slot is a place the model might call a tool. Candidate calls rise above it, the tools answer, and three bars compare no call, the call without an answer, and the call plus its answer. The sentences and calls are from the paper. The per-token losses are toy numbers."
    >
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end", marginBottom: 10 }}>
        <Select
          label="Example"
          options={EXAMPLES.map((item) => item.name)}
          value={name}
          onChange={(value) => {
            setName(value);
            setSeed((count) => count + 1);
          }}
        />
        <Segmented
          options={[
            { value: "0.5", label: "τf = 0.5" },
            { value: "1.0", label: "τf = 1.0" },
            { value: "2.0", label: "τf = 2.0" },
          ]}
          value={tau}
          onChange={(value) => {
            setTau(value);
            setSeed((count) => count + 1);
          }}
        />
        <Button label="Replay" variant="primary" onClick={() => setSeed((count) => count + 1)} />
      </div>
      <StreamScene example={example} tau={threshold} playKey={`${name}-${tau}-${seed}`} />
      <Table
        columns={["Candidate call → result", "L(no call)", "L(call, no answer)", "L+ (call + answer)", "Gain L− − L+", `τf = ${tau}`]}
        rows={rows}
      />
      <Text>
        L− is the smaller of &quot;no call&quot; and &quot;the call without its answer&quot;, so a call counts only when the answer is what helps. The next token is weighted most and the fifth least. The paper&apos;s normalised weights are {W.map((weight) => weight.toFixed(2)).join(", ")}. At τf = 2.0 none of these toy calls pass. Pittsburgh&apos;s &quot;famous for&quot; call passes only at 0.5.
      </Text>
    </Section>
  );
}

type Table10Row = { tool: string; text: string; score: number; useful: boolean };
const TABLE10: Table10Row[] = [
  { tool: "WikiSearch", text: "…the oldest war memorial in the United Kingdom. [WikiSearch(War memorial Flodden) → Battle of Flodden > Commemoration > The stained-glass Flodden Window…] Sir Richard Assheton…", score: 5.49, useful: true },
  { tool: "Calendar", text: "Note: The WL will be open on Friday, [Calendar() → Today is Thursday, March 9, 2017.] March 10, and Sunday, March 19…", score: 2.11, useful: true },
  { tool: "QA", text: "The Nile has an approximate length of [QA(What is the approximate length of the Nile?) → 6,853 km] 6,853 kilometers…", score: 2.08, useful: true },
  { tool: "Calculator", text: "…735 K which is [Calculator(735 / 499) → 1.47] 1.47 (735 / 499) times hotter than it should be.", score: 1.59, useful: true },
  { tool: "WikiSearch", text: "Catch this fast train to success! [WikiSearch(Fast train success) → Fast Train > It also peaked at #23 on the Canadian CHUM singles chart…] Don't wait weeks and…", score: 0.92, useful: false },
  { tool: "MT", text: "Os Melhores Escolas em Jersey 2020 [MT(Os Melhores Escolas em Jersey) → The Best Schools in Jersey] On this page you can search for Universities…", score: 0.7, useful: true },
  { tool: "Calendar", text: "Enjoy these pictures from the [Calendar() → Today is Friday, April 19, 2013.] Easter Egg Hunt.", score: 0.33, useful: true },
  { tool: "Calculator", text: "85 patients (23%) were hospitalised alive… Of them, [Calculator(85 / 23) → 3.70] 65% had a cardiac aetiology…", score: -0.02, useful: false },
  { tool: "Calendar", text: "But hey, after the [Calendar() → Today is Saturday, June 25, 2011.] Disneyland fiasco with the fire drill…", score: -0.41, useful: false },
  { tool: "QA", text: "The last time I was with [QA(Who was last time I was with?) → The Last Time] him I asked what he likes about me…", score: -1.23, useful: false },
];
const TABLE2: Record<string, { tool: string; count: number }[]> = {
  "0.5": [
    { tool: "Question answering", count: 51987 },
    { tool: "Wikipedia search", count: 207241 },
    { tool: "Calculator", count: 3680 },
    { tool: "Calendar", count: 61811 },
    { tool: "Machine translation", count: 3156 },
  ],
  "1.0": [
    { tool: "Question answering", count: 18526 },
    { tool: "Wikipedia search", count: 60974 },
    { tool: "Calculator", count: 994 },
    { tool: "Calendar", count: 20587 },
    { tool: "Machine translation", count: 1034 },
  ],
  "2.0": [
    { tool: "Question answering", count: 5135 },
    { tool: "Wikipedia search", count: 13944 },
    { tool: "Calculator", count: 138 },
    { tool: "Calendar", count: 3007 },
    { tool: "Machine translation", count: 229 },
  ],
};
const TOOL_COLOR: Record<string, string> = { WikiSearch: "#a78bfa", Calendar: "#4ade80", QA: "#5aa9ff", Calculator: "#fb923c", MT: "#f472b6" };
const SCORE_MIN = -2;
const SCORE_MAX = 6;

function ThresholdLine({ tau, setTau, hover, setHover }: { tau: number; setTau: (value: number) => void; hover: number; setHover: (value: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduced = useReducedMotion();
  const state = useRef({ tau, hover, reduced });
  state.current = { tau, hover, reduced };
  const setters = useRef({ setTau, setHover });
  setters.current = { setTau, setHover };
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let dead = false;
    let raf = 0;
    let dragging = false;
    const heights = TABLE10.map(() => canvas.height * 0.5);
    const xOf = (score: number) => 50 + ((score - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * (canvas.width - 100);
    const scoreOf = (pixel: number) => SCORE_MIN + ((pixel - 50) / (canvas.width - 100)) * (SCORE_MAX - SCORE_MIN);
    const local = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: (event.clientX - rect.left) * (canvas.width / rect.width), y: (event.clientY - rect.top) * (canvas.height / rect.height) };
    };
    const down = (event: PointerEvent) => {
      const point = local(event);
      const hit = TABLE10.findIndex((row, index) => Math.hypot(point.x - xOf(row.score), point.y - heights[index]) < 16);
      if (hit >= 0) {
        setters.current.setHover(hit);
        return;
      }
      dragging = true;
      setters.current.setTau(Math.round(Math.max(SCORE_MIN, Math.min(SCORE_MAX, scoreOf(point.x))) * 20) / 20);
    };
    const move = (event: PointerEvent) => {
      if (!dragging) return;
      const point = local(event);
      setters.current.setTau(Math.round(Math.max(SCORE_MIN, Math.min(SCORE_MAX, scoreOf(point.x))) * 20) / 20);
    };
    const up = () => {
      dragging = false;
    };
    canvas.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    const draw = () => {
      if (dead) return;
      const { tau: threshold, hover: active, reduced: still } = state.current;
      context.fillStyle = "#0b1020";
      context.fillRect(0, 0, canvas.width, canvas.height);
      const mid = canvas.height * 0.5;
      context.fillStyle = "rgba(74,222,128,0.08)";
      context.fillRect(xOf(threshold), 0, canvas.width - xOf(threshold), canvas.height);
      context.strokeStyle = "rgba(148,163,184,0.5)";
      context.beginPath();
      context.moveTo(50, mid);
      context.lineTo(canvas.width - 50, mid);
      context.stroke();
      context.fillStyle = "#94a3b8";
      context.font = "11px sans-serif";
      context.textAlign = "center";
      for (let tick = SCORE_MIN; tick <= SCORE_MAX; tick += 1) {
        context.fillText(String(tick), xOf(tick), mid + 18);
      }
      context.fillText("Filter score L− − L+, Table 10", canvas.width / 2, canvas.height - 8);
      TABLE10.forEach((row, index) => {
        const kept = row.score >= threshold;
        const lane = (index % 4) * 16;
        const target = kept ? mid - 42 - lane : mid + 42 + lane;
        heights[index] += (target - heights[index]) * (still ? 1 : 0.12);
        const x = xOf(row.score);
        const y = heights[index];
        context.strokeStyle = "rgba(148,163,184,0.25)";
        context.beginPath();
        context.moveTo(x, mid);
        context.lineTo(x, y);
        context.stroke();
        context.fillStyle = TOOL_COLOR[row.tool];
        context.globalAlpha = kept ? 1 : 0.5;
        context.beginPath();
        context.arc(x, y, index === active ? 9 : 7, 0, Math.PI * 2);
        context.fill();
        context.globalAlpha = 1;
        context.fillStyle = row.useful ? "#4ade80" : "#f87171";
        context.font = "bold 12px sans-serif";
        context.fillText(row.useful ? "✓" : "✗", x, y - 12);
      });
      const line = xOf(threshold);
      context.strokeStyle = "#facc15";
      context.lineWidth = 2.5;
      context.beginPath();
      context.moveTo(line, 8);
      context.lineTo(line, canvas.height - 24);
      context.stroke();
      context.lineWidth = 1;
      context.fillStyle = "#facc15";
      context.font = "bold 13px sans-serif";
      context.textAlign = "left";
      context.fillText(`τf = ${threshold.toFixed(2)}  → keep`, Math.min(line + 8, canvas.width - 150), 20);
      context.textAlign = "right";
      context.fillStyle = "#f87171";
      context.fillText("drop ←", Math.max(line - 8, 70), 20);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);
  return (
    <canvas
      ref={canvasRef}
      width={980}
      height={300}
      aria-label="Threshold for the ten real Table 10 filter scores. Drag to move τf. Click a dot to read that example."
      style={{ width: "100%", borderRadius: 12, cursor: "ew-resize", touchAction: "none", display: "block", background: "#0b1020" }}
    />
  );
}

function FilterDemo() {
  const [tau, setTau] = useState(1);
  const [hover, setHover] = useState(0);
  const [tableTau, setTableTau] = useState("1.0");
  const kept = TABLE10.filter((row) => row.score >= tau);
  const keptUseful = kept.filter((row) => row.useful).length;
  const droppedUseful = TABLE10.filter((row) => row.score < tau && row.useful).length;
  const selected = TABLE10[hover];
  const counts = TABLE2[tableTau];
  const maxCount = Math.max(...counts.map((row) => row.count));
  return (
    <Section
      heading="Demo 2: where to set the bar"
      caption="Ten real examples from Table 10, each with the paper's filter score and the authors' useful or not-useful mark. Drag the strip to move τf. Click a dot to read the text. Blue is question answering, purple is Wikipedia, orange is the calculator, green is the calendar, and pink is translation."
    >
      <ThresholdLine tau={tau} setTau={setTau} hover={hover} setHover={setHover} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0" }}>
        {[-1, 0, 0.5, 1, 2, 5].map((value) => (
          <Button key={value} label={`τf = ${value}`} variant={tau === value ? "primary" : "quiet"} onClick={() => setTau(value)} />
        ))}
      </div>
      <Metrics
        metrics={[
          { value: `${kept.length} / 10`, label: "Calls kept", detail: `at τf = ${tau.toFixed(2)}` },
          { value: `${keptUseful} / ${kept.length}`, label: "Kept calls that were useful", detail: "How precise the filter is", tone: kept.length > 0 && keptUseful === kept.length ? "success" : "warning" },
          { value: String(droppedUseful), label: "Useful calls thrown away", detail: "The cost of a higher bar", tone: droppedUseful ? "warning" : "success" },
        ]}
      />
      <Callout tone={selected.score >= tau ? "success" : "warning"} lead={`${selected.tool} · score ${selected.score.toFixed(2)} · ${selected.useful ? "useful" : "not useful"} · ${selected.score >= tau ? "kept" : "dropped"}`}>
        {selected.text}
      </Callout>
      <Text>
        At τf = 1.0 the strip keeps 4 of 10 calls, all 4 useful, and drops 2 useful calls (the Jersey schools translation at 0.70 and the Easter calendar note at 0.33). &quot;Fast train success&quot; scores 0.92 even though the authors mark it not useful. The default in the paper is 1.0, and 0.5 for the calculator and translation, which had fewer examples.
      </Text>
      <Segmented
        options={[
          { value: "0.5", label: "τf = 0.5" },
          { value: "1.0", label: "τf = 1.0" },
          { value: "2.0", label: "τf = 2.0" },
        ]}
        value={tableTau}
        onChange={setTableTau}
      />
      <svg width="100%" viewBox="0 0 760 210" role="img" aria-label="Table 2, examples kept per tool." style={{ display: "block", background: "#0b1020", borderRadius: 12, marginTop: 10 }}>
        {counts.map((row, index) => {
          const y = 16 + index * 38;
          const width = (row.count / maxCount) * 430;
          return (
            <g key={row.tool}>
              <text x={210} y={y + 16} fill="#e2e8f0" fontSize="13" textAnchor="end">
                {row.tool}
              </text>
              <rect x={224} y={y} height={18} rx={4} fill={index === 1 ? "#a78bfa" : "#94a3b8"} width={width} />
              <text x={232 + width} y={y + 14} fill="#ffffff" fontSize="12">
                {row.count.toLocaleString("en-US")}
              </text>
            </g>
          );
        })}
      </svg>
      <Text>Table 2: how many CCNet examples with a surviving call each tool contributed. Raising the bar from 0.5 to 2.0 cuts calculator examples from 3,680 to 138.</Text>
    </Section>
  );
}

type Prompt = { name: string; prefix: string; call: string; tool: string; result: string; continuation: string; withoutTool: string; rank: number; top: string[] };
const PROMPTS: Prompt[] = [
  { name: "Percentages (Calculator)", prefix: "Out of 1400 participants, 400 (or", call: "Calculator(400 / 1400)", tool: "Calculator", result: "0.29", continuation: " 29%) passed the test.", withoutTool: " 35%) passed the test.", rank: 2, top: [" 35", "<API>", " about", " 30", " 40", " so", " 25", " one", " a", " 20"] },
  { name: "Spanish word (Translation)", prefix: "The name derives from \"la tortuga\", the Spanish word for", call: "MT(\"tortuga\")", tool: "MT", result: "turtle", continuation: " turtle.", withoutTool: " lizard.", rank: 3, top: [" lizard", " fortune", "<API>", " tortoise", " the", " a", " shell", " slow", " sea", " sand"] },
  { name: "Library hours (Calendar)", prefix: "Note: the library will be open on Friday,", call: "Calendar()", tool: "Calendar", result: "Today is Thursday, March 9, 2017.", continuation: " March 10, for regular hours.", withoutTool: " June 2, for regular hours.", rank: 4, top: [" June", " the", " and", "<API>", " from", " May", " 9", " until", " but", " at"] },
  { name: "Publisher (Question answering)", prefix: "The New England Journal of Medicine is a registered trademark of", call: "QA(\"Who is the publisher of The New England Journal of Medicine?\")", tool: "QA", result: "Massachusetts Medical Society", continuation: " the MMS.", withoutTool: " Elsevier.", rank: 2, top: [" Elsevier", "<API>", " the", " NEJM", " Harvard", " Boston", " its", " a", " Wiley", " Springer"] },
  { name: "Brown Act (Wikipedia search)", prefix: "The Brown Act is California's law", call: "WikiSearch(\"Brown Act\")", tool: "WikiSearch", result: "The Ralph M. Brown Act is an act of the California State Legislature that guarantees the public's right to attend and participate in meetings of local legislative bodies.", continuation: " that requires legislative bodies, like city councils, to hold their meetings open to the public.", withoutTool: " that regulates the sale of fireworks.", rank: 1, top: ["<API>", " that", " on", " for", " which", ",", " about", " regarding", " passed", " of"] },
];

function InferenceDemo() {
  const reduced = useReducedMotion();
  const [name, setName] = useState(PROMPTS[0].name);
  const [mode, setMode] = useState("k10");
  const [seed, setSeed] = useState(0);
  const [step, setStep] = useState(0);
  const prompt = PROMPTS.find((item) => item.name === name) || PROMPTS[0];
  const k = mode === "k1" ? 1 : mode === "k10" ? 10 : 0;
  const calls = k > 0 && prompt.rank <= k;
  const prefixLength = prompt.prefix.length;
  const decide = 25;
  const callLength = prompt.call.length;
  const pause = 30;
  const resultLength = 12;
  const tail = (calls ? prompt.continuation : prompt.withoutTool).length;
  const total = prefixLength + decide + (calls ? callLength + 2 + pause + resultLength : 0) + tail + 10;
  useEffect(() => {
    if (reduced) {
      setStep(total);
      return;
    }
    setStep(0);
    const id = window.setInterval(() => setStep((value) => (value >= total ? value : value + 1)), 40);
    return () => window.clearInterval(id);
  }, [name, mode, seed, reduced, total]);
  let shown = prompt.prefix.slice(0, Math.min(prefixLength, step));
  let phase = "writing";
  let callText = "";
  let resultText = "";
  let continuation = "";
  let cursor = step - prefixLength;
  if (cursor >= 0) phase = "deciding";
  cursor -= decide;
  if (cursor >= 0 && calls) {
    phase = "calling";
    callText = ` [${prompt.call.slice(0, Math.min(callLength, cursor))}`;
    cursor -= callLength;
    if (cursor >= 0) {
      callText = ` [${prompt.call} →`;
      phase = "paused";
    }
    cursor -= 2 + pause;
    if (cursor >= 0) {
      phase = "inserting";
      const shownResult = prompt.result.slice(0, Math.ceil((Math.min(resultLength, cursor) / resultLength) * prompt.result.length));
      resultText = cursor >= resultLength ? ` ${prompt.result}]` : ` ${shownResult}`;
    }
    cursor -= resultLength;
  }
  if (cursor >= 0) {
    phase = "continuing";
    continuation = (calls ? prompt.continuation : prompt.withoutTool).slice(0, Math.min(tail, cursor));
  }
  if (step >= total) phase = "done";
  const probabilities = prompt.top.map((token, index) => ({
    token,
    value: k === 0 && token === "<API>" ? 0 : Math.round((100 * 0.62 ** index * (1 - 0.62)) / (1 - 0.62 ** 10) * 10) / 10,
  }));
  const toolLive = phase === "paused" || phase === "inserting";
  const toolDone = calls && (phase === "continuing" || phase === "done");
  const status =
    phase === "writing"
      ? "Writing token by token."
      : phase === "deciding"
        ? k === 0
          ? "The call token is forced to probability 0, so the model cannot start a call."
          : `<API> ranks #${prompt.rank}. ${calls ? `It is inside the top ${k}, so a call starts.` : `It is outside the top ${k}, so writing continues.`}`
        : phase === "calling"
          ? "Writing which tool to call, and what to ask it."
          : phase === "paused"
            ? "The arrow is written. Decoding pauses and the tool runs."
            : phase === "inserting"
              ? "The tool's answer and the closing marker are pasted into the text."
              : phase === "continuing"
                ? calls
                  ? "Writing continues, now with the answer in view."
                  : "Writing without a tool. The ending here is a toy guess."
                : calls
                  ? "Done. One call, and the result is used."
                  : "Done. No tool was used.";
  return (
    <Section
      heading="Demo 3: calling a tool mid-sentence"
      caption="After fine-tuning, the model writes until it produces the arrow. Decoding pauses, the tool runs, the answer is inserted, and writing continues. The sentences and calls are from Figure 1. The next-token ranks and the no-tool endings are made up. Only the Wikipedia sentence ranks the call token first, so greedy decoding calls a tool on that sentence alone."
    >
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end", marginBottom: 10 }}>
        <Select label="Sentence" options={PROMPTS.map((item) => item.name)} value={name} onChange={setName} />
        <Segmented
          options={[
            { value: "off", label: "Tools disabled" },
            { value: "k1", label: "Greedy, k = 1" },
            { value: "k10", label: "Top-k = 10" },
          ]}
          value={mode}
          onChange={setMode}
        />
        <Button label="Replay" variant="primary" onClick={() => setSeed((value) => value + 1)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
        <div style={{ background: "#0b1020", borderRadius: 12, padding: 16, minHeight: 170, color: "#e2e8f0", fontFamily: "ui-monospace, monospace", fontSize: 15, lineHeight: 1.7 }}>
          <span>{shown}</span>
          {callText ? <span style={{ color: "#fb923c", background: "rgba(251,146,60,0.12)", borderRadius: 4 }}>{callText}</span> : null}
          {resultText ? <span style={{ color: "#4ade80", background: "rgba(74,222,128,0.12)", borderRadius: 4 }}>{resultText}</span> : null}
          <span style={{ color: calls ? "#e2e8f0" : "#fca5a5" }}>{continuation}</span>
          {phase !== "done" ? <span style={{ opacity: Math.floor(step / 6) % 2 ? 1 : 0.2, color: "#5aa9ff" }}>▍</span> : null}
          <div style={{ marginTop: 12, fontFamily: "system-ui, sans-serif", fontSize: 13, color: "#94a3b8" }}>{status}</div>
        </div>
        <div style={{ background: "#0b1020", borderRadius: 12, padding: 12, color: "#e2e8f0", fontSize: 12 }}>
          <div style={{ marginBottom: 6, color: "#94a3b8" }}>Toy top 10 next tokens, at the decision</div>
          {probabilities.map((item, index) => {
            const isCall = item.token === "<API>";
            const inside = k > 0 && index < k;
            return (
              <div key={`${item.token}-${index}`} style={{ display: "flex", alignItems: "center", gap: 6, margin: "2px 0", opacity: k === 0 && isCall ? 0.35 : 1 }}>
                <span style={{ width: 72, fontFamily: "ui-monospace, monospace", color: isCall ? "#fb923c" : "#cbd5e1" }}>{isCall && k === 0 ? "<API> 0" : item.token}</span>
                <div style={{ height: 10, width: item.value * 3, background: isCall ? "#fb923c" : inside ? "#5aa9ff" : "#334155", borderRadius: 3 }} />
                <span style={{ color: "#64748b" }}>{item.value}%</span>
              </div>
            );
          })}
          <div style={{ marginTop: 10, padding: 8, borderRadius: 8, border: `1.5px solid ${toolLive ? "#4ade80" : "#334155"}` }}>
            <div style={{ fontWeight: 600, color: toolLive ? "#4ade80" : "#94a3b8" }}>
              {prompt.tool} {toolLive ? (phase === "paused" ? "· running" : "· answered") : toolDone ? "· answered" : "· idle"}
            </div>
            <div style={{ color: "#cbd5e1", marginTop: 4 }}>{toolLive || phase === "continuing" || phase === "done" ? (calls ? prompt.result : "not called") : "waiting"}</div>
          </div>
        </div>
      </div>
      <Text>
        The paper starts a call when the call token is among the 10 most likely next tokens, and it allows at most one call per input. In Table 9, greedy decoding (k = 1) called a tool on 40.3% of T-REx questions and 8.5% of WebQuestions. With k = 10 that rose to 98.1% and 100%, and T-REx accuracy rose from 47.8 to 53.5.
      </Text>
    </Section>
  );
}

const MATH_BARS = [
  { label: "ASDiv, GPT-J", value: 7.5 },
  { label: "ASDiv, calls disabled", value: 14.8 },
  { label: "ASDiv, GPT-3 175B", value: 14.0 },
  { label: "ASDiv, Toolformer", value: 40.4 },
  { label: "SVAMP, GPT-3 175B", value: 10.0 },
  { label: "SVAMP, Toolformer", value: 29.4 },
  { label: "MAWPS, GPT-3 175B", value: 19.8 },
  { label: "MAWPS, Toolformer", value: 44.0 },
];

type QuizItem = { q: string; options: string[]; answer: number; why: string };
const QUIZ: QuizItem[] = [
  {
    q: "Where did the tool-use training examples come from?",
    options: ["People wrote thousands of tool-use examples", "The model annotated plain web text itself, and a loss test kept the helpful calls", "They were copied from chat transcripts", "A reward model trained on human ratings wrote them"],
    answer: 1,
    why: "A handful of demonstrations per tool go in a prompt. GPT-J then proposes calls across CCNet. The tools run them, and only calls that make the following words easier to predict are kept.",
  },
  {
    q: "When is a sampled call kept?",
    options: ["Whenever the tool returns any answer", "When the model is confident in the call", "When the call plus its answer lowers the weighted next-token loss by at least τf, compared with no call or the call without its answer", "When a person marks it useful"],
    answer: 2,
    why: "Keep the call if L− − L+ is at least τf. L+ is the loss with the call and the answer. L− is the smaller of no call and the call with no answer. The default τf is 1.0.",
  },
  {
    q: "Why also compare against the call without its answer?",
    options: ["To save compute", "So the answer, not the question, has to carry the useful information", "Because the tools are sometimes offline", "It is only needed for translation"],
    answer: 1,
    why: "A question such as \"What other name is Pittsburgh known by?\" might itself hint at the next words. Taking the better of the two baselines means the result has to be what helps.",
  },
  {
    q: "What happens at inference when the model writes the arrow?",
    options: ["It stops and prints the answer", "Decoding pauses, the API is called, the result and the closing marker are inserted, and generation continues", "It asks a person for help", "It restarts the sentence"],
    answer: 1,
    why: "The model chooses when to call and what to ask. The tool supplies the result text, and writing continues from there. At most one call is made per input.",
  },
  {
    q: "On the math benchmarks, how did 6.7B Toolformer compare with 175B GPT-3?",
    options: ["Worse on all three", "About the same", "Better on all three: ASDiv 40.4 versus 14.0, SVAMP 29.4 versus 10.0, MAWPS 44.0 versus 19.8", "Better only on MAWPS"],
    answer: 2,
    why: "Table 4. It called the calculator on 97.9% of these problems. On open-domain question answering it still trailed GPT-3, for example WebQuestions 26.3 versus 29.0.",
  },
  {
    q: "Which limitation do the authors point out?",
    options: ["It cannot do arithmetic", "It cannot chain tools or refine a search, because each call was sampled on its own", "It forgets how to write English", "It needs a larger model than GPT-J"],
    answer: 1,
    why: "Section 7. Calls are sampled independently, so one tool's output is never another tool's input, and the model cannot browse or rewrite a query. The method is also sensitive to wording, sample-inefficient, and it ignores the cost of a call. Perplexity did not get worse (Table 8).",
  },
];

export default function ToolformerPage() {
  const [picks, setPicks] = useState<(number | null)[]>(QUIZ.map(() => null));
  return (
    <Page
      title="Toolformer: teach a model to call tools by its own loss"
      summary="Paper #19 · Schick, Dwivedi-Yu, Dessì, Raileanu, Lomeli, Zettlemoyer, Cancedda, Scialom · Meta AI · NeurIPS 2023 · arXiv 2302.04761"
      width="wide"
    >
      <Callout tone="info" lead="The big idea in one line.">
        Let the model write tool calls into its own training text, keep only the calls whose answers make the next words easier to predict, and fine-tune on that.
      </Callout>
      <Section heading="The plain-English version">
        <Text>
          ReAct (paper #16) and Reflexion (paper #18) use tools by prompting. A few examples in the prompt show the pattern, and nothing inside the model is trained to know when a tool helps. GPT-3 (paper #8) already showed that those examples can steer a frozen model. Toolformer instead changes the weights, but the supervision is the model&apos;s own next-word loss.
        </Text>
        <Steps
          steps={[
            { title: "Sample", detail: "A few handwritten examples per tool go in a prompt. Positions where the call token is likely enough, above τs, get a handful of candidate calls." },
            { title: "Execute", detail: "Every candidate is run: Atlas for questions, BM25 over Wikipedia, a four-operation calculator, a calendar that returns the date, and NLLB for translation into English." },
            { title: "Filter", detail: "Keep a call only if the call plus its answer lowers the weighted loss on the next tokens by at least τf, versus no call and versus the call with no answer." },
            { title: "Fine-tune", detail: "Merge the surviving calls into the original texts and fine-tune GPT-J (6.7B) with the ordinary next-word objective. Up to 25,000 examples per tool." },
            { title: "Use", detail: "While writing, if the model produces the arrow, decoding pauses, the tool runs, the answer is inserted, and writing continues. At most one call per input." },
          ]}
        />
      </Section>
      <Section heading="Watch: the idea, animated">
        {VIDEOS.map((video) => (
          <figure key={video.file} style={{ margin: "0 0 16px" }}>
            <figcaption style={{ fontWeight: 600, marginBottom: 6 }}>{video.title}</figcaption>
            <video src={`/videos/19-toolformer/${video.file}`} preload="none" controls muted loop playsInline style={{ width: "100%", borderRadius: 12, background: "#0b1020", display: "block" }} />
            <p style={{ fontSize: 13, opacity: 0.75, margin: "4px 0 0" }}>{video.caption}</p>
          </figure>
        ))}
      </Section>
      <StreamDemo />
      <FilterDemo />
      <InferenceDemo />
      <Section heading="What the paper actually claimed">
        <Metrics
          metrics={[
            { value: "40.4", label: "ASDiv, zero-shot", detail: "GPT-3 175B scored 14.0. GPT-J scored 7.5 (Table 4)", tone: "success" },
            { value: "53.5", label: "LAMA T-REx", detail: "GPT-3 scored 39.8. GPT-J scored 31.9 (Table 3)", tone: "success" },
            { value: "27.3", label: "DateSet", detail: "GPT-3 scored 0.8. GPT-J scored 3.9 (Table 7)", tone: "success" },
            { value: "26.3", label: "WebQuestions", detail: "Still below GPT-3's 29.0 (Table 5)", tone: "warning" },
          ]}
        />
        <svg width="100%" viewBox="0 0 760 320" role="img" aria-label="Math scores from Table 4." style={{ display: "block", background: "#0b1020", borderRadius: 12 }}>
          {MATH_BARS.map((bar, index) => {
            const y = 14 + index * 38;
            return (
              <g key={bar.label}>
                <text x={250} y={y + 16} fill="#e2e8f0" fontSize="13" textAnchor="end">
                  {bar.label}
                </text>
                <rect x={262} y={y} height={18} rx={4} fill={index === 3 || index === 5 || index === 7 ? "#4ade80" : "#94a3b8"} width={(bar.value / 50) * 400} />
                <text x={270 + (bar.value / 50) * 400} y={y + 14} fill="#ffffff" fontSize="12">
                  {bar.value.toFixed(1)}
                </text>
              </g>
            );
          })}
        </svg>
        <Table
          columns={["Finding", "What they measured"]}
          rows={[
            ["Facts, LAMA, Table 3", "SQuAD 33.8, Google-RE 11.5, T-REx 53.5, versus GPT-3 26.8 / 7.0 / 39.8. The QA tool was chosen 98.1% of the time. Wikipedia search was turned off for this test."],
            ["Math, Table 4", "More than doubles every set versus the same model with calls disabled. The calculator was used on 97.9% of examples."],
            ["Open-domain questions, Table 5", "WebQuestions 26.3, Natural Questions 17.7, TriviaQA 48.8. Best among the GPT-J runs, still below GPT-3 (29.0 / 22.6 / 65.9). One search, no query rewrite."],
            ["Several languages, Table 6", "The translator is used on 63.8% to 94.9% of examples, and only 7.3% for Hindi. It helps versus calls disabled, but not consistently versus plain GPT-J."],
            ["Dates, Table 7", "DateSet 27.3, with the calendar on 54.8% of examples. TempLAMA gains came from the other tools. The calendar was used on 0.2% of those."],
            ["Language skill, Table 8", "With calls disabled, WikiText perplexity is 10.3 and CCNet is 10.5, the same as GPT-J fine-tuned on the plain text."],
            ["Scale, Figure 4", "Tool use shows up around 775 million parameters. Smaller GPT-2 models gain little. Wikipedia search is the exception."],
            ["Training set, Table 2, τf = 1.0", "Question answering 18,526. Wikipedia 60,974. Calculator 994. Calendar 20,587. Translation 1,034."],
          ]}
        />
        <Callout tone="warning" lead="Limits the authors note.">
          There is no chaining, and no interactive search, because every training call was sampled on its own. Whether a call starts depends on the exact wording. The method is sample-inefficient: more than a million documents produced only a few thousand useful calculator calls. The filter also ignores how expensive a call is.
        </Callout>
      </Section>
      <QuizSync slug="19-toolformer" picks={picks} answers={QUIZ.map((item) => item.answer)} />
      <Section heading="Quick quiz">
        {QUIZ.map((item, index) => (
          <Section key={item.q} heading={`${index + 1}. ${item.q}`}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {item.options.map((option, optionIndex) => (
                <Button
                  key={option}
                  label={option}
                  variant={picks[index] === optionIndex ? "primary" : "quiet"}
                  onClick={() => setPicks(picks.map((pick, pickIndex) => (pickIndex === index ? optionIndex : pick)))}
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
          Explain it in your own words: how does Toolformer decide which API calls are worth keeping in its training data, and why does that let the model learn tool use without humans labeling examples?
        </Text>
      </Section>
      <Section heading="Read it yourself">
        <LinkCards
          links={[
            { title: "Toolformer: Language Models Can Teach Themselves to Use Tools (abstract)", site: "arxiv.org", date: "2023", href: "https://arxiv.org/abs/2302.04761" },
            { title: "Toolformer (PDF)", site: "arxiv.org", date: "2023", href: "https://arxiv.org/pdf/2302.04761" },
            { title: "Reflexion, tools through a prompt", site: "Papers a Day", date: "2023", href: "/papers/18-reflexion" },
            { title: "ReAct, a prompted tool-use loop", site: "Papers a Day", date: "2023", href: "/papers/16-react" },
            { title: "GPT-3, in-context examples", site: "Papers a Day", date: "2020", href: "/papers/08-gpt3" },
            { title: "GPT-2", site: "Papers a Day", date: "2019", href: "/papers/07-gpt2" },
          ]}
        />
      </Section>
    </Page>
  );
}
