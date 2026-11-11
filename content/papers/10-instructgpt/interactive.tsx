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
  useState,
  useEffect,
  useRef,
} from "grok/canvas";
import type { BufferAttribute } from "three";

// All landscape numbers, answers, and reward scores below are toy values made up to show the mechanism.

const VIDEOS = [
  {
    file: "RLHFPipeline.mp4",
    title: "The three steps",
    caption: "GPT-3 is fine-tuned on human demos (SFT), a reward model learns from human rankings, then PPO pushes the model toward higher reward.",
  },
  {
    file: "RewardModelRanking.mp4",
    title: "One ranking, six lessons",
    caption: "A labeler ranks 4 answers; that gives 4 choose 2 = 6 pairwise comparisons for the reward model.",
  },
  {
    file: "KLLeash.mp4",
    title: "Reward on a KL leash",
    caption: "PPO chases reward but is penalized for drifting too far from the SFT model, which stops it gaming the reward model.",
  },
];

const HILL = { x: 0.6, z: 0.2 };
const SFT = { x: -1.6, z: -0.4 };
const trueQ = (x: number, z: number) => Math.exp(-((x - HILL.x) ** 2 + (z - HILL.z) ** 2) / 2);
// The reward model matches true quality near the data, but wrongly keeps rising toward +x (toy flaw).
const rmScore = (x: number, z: number) => trueQ(x, z) + 0.7 * Math.max(0, x - 0.3);
const BETAS = [
  { value: "0", label: "No leash (β = 0)", beta: 0 },
  { value: "1", label: "Balanced (β = 0.1)", beta: 0.1 },
  { value: "2", label: "Too tight (β = 0.5)", beta: 0.5 },
];

type P = { x: number; z: number };
type Stats = { rm: number; q: number; drift: number };

const gauss = () => {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
const freshParticles = (): P[] =>
  Array.from({ length: 180 }, () => ({ x: SFT.x + gauss() * 0.35, z: SFT.z + gauss() * 0.35 }));
const stepParticles = (ps: P[], beta: number) => {
  const e = 1e-3;
  const lr = 0.05;
  for (const p of ps) {
    let gx = (rmScore(p.x + e, p.z) - rmScore(p.x - e, p.z)) / (2 * e);
    let gz = (rmScore(p.x, p.z + e) - rmScore(p.x, p.z - e)) / (2 * e);
    gx -= 2 * beta * (p.x - SFT.x);
    gz -= 2 * beta * (p.z - SFT.z);
    p.x = Math.max(-4.4, Math.min(4.4, p.x + lr * gx + gauss() * 0.012));
    p.z = Math.max(-4.4, Math.min(4.4, p.z + lr * gz + gauss() * 0.012));
  }
};
const statsOf = (ps: P[]): Stats => {
  let r = 0;
  let q = 0;
  let d = 0;
  for (const p of ps) {
    r += rmScore(p.x, p.z);
    q += trueQ(p.x, p.z);
    d += (p.x - SFT.x) ** 2 + (p.z - SFT.z) ** 2;
  }
  const n = ps.length;
  return { rm: r / n, q: q / n, drift: d / n };
};
const H_SCALE = 0.9;
const qColor = (q: number) => {
  const a = [0.55, 0.12, 0.18];
  const b = [0.98, 0.6, 0.2];
  const c = [0.29, 0.87, 0.5];
  const mix = (u: number[], v: number[], t: number) => u.map((k, i) => k + (v[i] - k) * t);
  return q < 0.5 ? mix(a, b, q / 0.5) : mix(b, c, (q - 0.5) / 0.5);
};

function RewardLandscape({
  beta,
  playing,
  resetKey,
  onStats,
}: {
  beta: number;
  playing: boolean;
  resetKey: number;
  onStats: (s: Stats) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const ps = useRef<P[]>(freshParticles());
  const live = useRef({ beta, playing });
  const onStatsRef = useRef(onStats);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  live.current = { beta, playing };
  onStatsRef.current = onStats;

  useEffect(() => {
    ps.current = freshParticles();
  }, [resetKey]);

  useEffect(() => {
    let disposed = false;
    let raf = 0;
    let cleanup = () => {};
    let frame = 0;

    const tick = () => {
      if (live.current.playing) stepParticles(ps.current, live.current.beta);
      frame += 1;
      if (frame % 8 === 0) onStatsRef.current(statsOf(ps.current));
    };

    import("three")
      .then((THREE) => {
        const host = hostRef.current;
        if (!host || disposed) return;
        const width = host.clientWidth || 700;
        const height = 380;
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
        renderer.setSize(width, height);
        host.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0b1020);
        scene.fog = new THREE.Fog(0x0b1020, 14, 26);
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
        scene.add(new THREE.AmbientLight(0xffffff, 0.55));
        const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
        keyLight.position.set(4, 8, 3);
        scene.add(keyLight);

        const geo = new THREE.PlaneGeometry(9, 9, 90, 90);
        geo.rotateX(-Math.PI / 2);
        const pos = geo.attributes.position as BufferAttribute;
        const cols: number[] = [];
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i);
          const z = pos.getZ(i);
          pos.setY(i, rmScore(x, z) * H_SCALE);
          const c = qColor(trueQ(x, z));
          cols.push(c[0], c[1], c[2]);
        }
        geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
        geo.computeVertexNormals();
        const surf = new THREE.Mesh(
          geo,
          new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.6,
            metalness: 0.1,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.92,
          }),
        );
        scene.add(surf);
        const wire = new THREE.Mesh(
          geo,
          new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.06 }),
        );
        scene.add(wire);

        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.42, 0.04, 12, 48),
          new THREE.MeshBasicMaterial({ color: 0x5aa9ff }),
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.set(SFT.x, rmScore(SFT.x, SFT.z) * H_SCALE + 0.05, SFT.z);
        scene.add(ring);

        const count = ps.current.length;
        const pointGeo = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        pointGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        const dots = new THREE.Points(
          pointGeo,
          new THREE.PointsMaterial({ color: 0xffffff, size: 0.13, transparent: true, opacity: 0.95, depthWrite: false }),
        );
        scene.add(dots);
        const glow = new THREE.Points(
          pointGeo,
          new THREE.PointsMaterial({
            color: 0x9ad1ff,
            size: 0.36,
            transparent: true,
            opacity: 0.18,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
        );
        scene.add(glow);

        let ang = 0.9;
        let elev = 0.62;
        let drag: { x: number; y: number } | null = null;
        const canvas = renderer.domElement;
        canvas.style.cursor = "grab";
        canvas.style.touchAction = "none";
        const down = (event: PointerEvent) => {
          drag = { x: event.clientX, y: event.clientY };
          canvas.setPointerCapture(event.pointerId);
        };
        const move = (event: PointerEvent) => {
          if (!drag) return;
          ang -= (event.clientX - drag.x) * 0.008;
          elev = Math.max(0.15, Math.min(1.3, elev + (event.clientY - drag.y) * 0.005));
          drag = { x: event.clientX, y: event.clientY };
        };
        const up = () => {
          drag = null;
        };
        canvas.addEventListener("pointerdown", down);
        canvas.addEventListener("pointermove", move);
        canvas.addEventListener("pointerup", up);
        canvas.addEventListener("pointercancel", up);

        let last = performance.now();
        const loop = () => {
          if (disposed) return;
          tick();
          const now = performance.now();
          const dt = (now - last) / 1000;
          last = now;
          if (!drag) ang += dt * 0.12;
          const radius = 11.5;
          camera.position.set(
            Math.cos(ang) * radius * Math.cos(elev),
            radius * Math.sin(elev) + 1,
            Math.sin(ang) * radius * Math.cos(elev),
          );
          camera.lookAt(0, 0.8, 0);
          for (let i = 0; i < count; i++) {
            const p = ps.current[i];
            positions[i * 3] = p.x;
            positions[i * 3 + 1] = rmScore(p.x, p.z) * H_SCALE + 0.1;
            positions[i * 3 + 2] = p.z;
          }
          (pointGeo.attributes.position as BufferAttribute).needsUpdate = true;
          ring.scale.setScalar(1 + 0.08 * Math.sin(now / 300));
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
          geo.dispose();
          pointGeo.dispose();
          surf.material.dispose();
          wire.material.dispose();
          ring.geometry.dispose();
          (ring.material as { dispose: () => void }).dispose();
          dots.material.dispose();
          glow.material.dispose();
          if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
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
    <div className="igpt-stage" ref={hostRef}>
      {status === "loading" ? (
        <div style={{ position: "absolute", top: 16, left: 16, color: "#94a3b8", fontSize: 13 }}>Loading the 3D scene…</div>
      ) : null}
      {status === "error" ? (
        <div style={{ position: "absolute", top: 16, left: 16, color: "#fca5a5", fontSize: 13 }}>
          This browser could not start the WebGL scene.
        </div>
      ) : null}
      <div className="igpt-legend">
        <div>height = reward model score</div>
        <div>
          <span style={{ color: "#4ade80" }}>green</span> = truly good, <span style={{ color: "#e05a5a" }}>red</span> = truly bad
        </div>
        <div>
          <span style={{ color: "#5aa9ff" }}>blue ring</span> = SFT model · dots = policy samples
        </div>
        <div>drag to orbit</div>
      </div>
    </div>
  );
}

function PipelineAnim() {
  const boxes = [
    { x: 10, label: "GPT-3", sub: "next-word predictor", c: "#94a3b8" },
    { x: 190, label: "1. SFT", sub: "13k human demos", c: "#5aa9ff" },
    { x: 370, label: "2. Reward model", sub: "33k prompts ranked", c: "#fb923c" },
    { x: 550, label: "3. PPO", sub: "31k prompts, RM as judge", c: "#4ade80" },
  ];
  return (
    <svg width="100%" viewBox="0 0 720 150" style={{ display: "block", background: "#0b1020", borderRadius: 12 }}>
      <path id="igpt-flow" d="M 150 60 L 550 60" stroke="#334155" strokeWidth="2" fill="none" />
      <path id="igpt-loop" d="M 620 95 C 620 140, 440 140, 440 95" stroke="#334155" strokeWidth="2" fill="none" strokeDasharray="4 4" />
      {boxes.map((box, i) => (
        <g key={box.label}>
          <rect x={box.x} y={25} width={160} height={70} rx={12} fill={box.c} fillOpacity={0.12} stroke={box.c} strokeWidth={2}>
            <animate attributeName="fill-opacity" values="0.08;0.32;0.08" dur="4s" begin={`${i}s`} repeatCount="indefinite" />
          </rect>
          <text x={box.x + 80} y={55} textAnchor="middle" fill="#fff" fontSize="15" fontWeight="600">
            {box.label}
          </text>
          <text x={box.x + 80} y={76} textAnchor="middle" fill="#94a3b8" fontSize="11">
            {box.sub}
          </text>
        </g>
      ))}
      {[0, 1.3, 2.6].map((delay) => (
        <circle key={delay} r={5} fill="#fff">
          <animateMotion dur="4s" begin={`${delay}s`} repeatCount="indefinite">
            <mpath href="#igpt-flow" />
          </animateMotion>
        </circle>
      ))}
      <circle r={5} fill="#fb923c">
        <animateMotion dur="2.5s" repeatCount="indefinite">
          <mpath href="#igpt-loop" />
        </animateMotion>
      </circle>
      <text x={530} y={146} textAnchor="middle" fill="#64748b" fontSize="11">
        steps 2 and 3 can repeat with fresh comparisons
      </text>
    </svg>
  );
}

const ANSWERS = [
  { id: "A", text: "Sunlight has all the colours mixed. Air bounces blue light around the most, so blue reaches your eyes from every part of the sky." },
  { id: "B", text: "Rayleigh scattering by N2 and O2 scales as 1/λ^4, so shorter wavelengths dominate the diffuse skylight." },
  { id: "C", text: "The sky is blue because it reflects the ocean." },
  { id: "D", text: "Blue light bounces around in the air like a pinball, much more than red, so the whole sky glows blue!" },
];
const sigmoid = (v: number) => 1 / (1 + Math.exp(-v));

function RankTrainer() {
  const [order, setOrder] = useState<number[]>([]);
  const [scores, setScores] = useState<number[]>([0, 0, 0, 0]);
  const [loss, setLoss] = useState<number | null>(null);
  const [step, setStep] = useState<number>(0);
  const [running, setRunning] = useState<boolean>(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const pairs = () => {
    const out: [number, number][] = [];
    for (let i = 0; i < order.length; i++) {
      for (let j = i + 1; j < order.length; j++) out.push([order[i], order[j]]);
    }
    return out;
  };
  const pick = (i: number) => {
    if (running || order.includes(i)) return;
    setOrder([...order, i]);
  };
  const reset = () => {
    if (timer.current) clearInterval(timer.current);
    setRunning(false);
    setOrder([]);
    setScores([0, 0, 0, 0]);
    setLoss(null);
    setStep(0);
  };
  const train = () => {
    if (order.length < 4 || running) return;
    const comparisons = pairs();
    let reward = [0, 0, 0, 0];
    let k = 0;
    setRunning(true);
    timer.current = setInterval(() => {
      const grad = [0, 0, 0, 0];
      let total = 0;
      for (const [winner, loser] of comparisons) {
        const p = sigmoid(reward[winner] - reward[loser]);
        total += -Math.log(p);
        grad[winner] += -(1 - p);
        grad[loser] += 1 - p;
      }
      total /= comparisons.length;
      reward = reward.map((value, i) => value - 0.35 * (grad[i] / comparisons.length + 0.04 * value));
      k += 1;
      setScores([...reward]);
      setLoss(total);
      setStep(k);
      if (k >= 80 && timer.current) {
        clearInterval(timer.current);
        setRunning(false);
      }
    }, 45);
  };
  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );

  const maxAbs = Math.max(1, ...scores.map((score) => Math.abs(score)));
  return (
    <div>
      <Text>Toy prompt: &quot;Explain why the sky is blue to a 6-year-old.&quot; You are the labeler. Click the four answers from best to worst.</Text>
      <div className="igpt-rank">
        {ANSWERS.map((answer, i) => {
          const rank = order.indexOf(i);
          return (
            <div
              key={answer.id}
              onClick={() => pick(i)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  pick(i);
                }
              }}
              role="button"
              tabIndex={0}
              style={{
                cursor: rank >= 0 ? "default" : "pointer",
                border: `2px solid ${rank >= 0 ? "#fb923c" : "#33415566"}`,
                borderRadius: 12,
                padding: 10,
                background: rank >= 0 ? "#fb923c18" : "transparent",
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                {answer.id}
                {rank >= 0 ? `  ·  ranked #${rank + 1}` : ""}
              </div>
              <div style={{ fontSize: 13, opacity: 0.85 }}>{answer.text}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <Button label={running ? "Training…" : "Train the reward model"} variant="primary" onClick={train} disabled={order.length < 4 || running} />
        <Button label="Reset" onClick={reset} />
        <span style={{ fontSize: 13, opacity: 0.75 }}>
          {order.length < 4
            ? `${order.length}/4 ranked`
            : `Your ranking gives ${pairs().length} comparisons: ${pairs().map(([winner, loser]) => `${ANSWERS[winner].id}>${ANSWERS[loser].id}`).join(", ")}`}
        </span>
      </div>
      <svg width="100%" viewBox="0 0 720 200" style={{ display: "block", marginTop: 12, background: "#0b1020", borderRadius: 12 }}>
        <line x1={40} y1={100} x2={700} y2={100} stroke="#334155" />
        {ANSWERS.map((answer, i) => {
          const h = (scores[i] / maxAbs) * 80;
          const x = 90 + i * 160;
          const rank = order.indexOf(i);
          const col = rank === 0 ? "#4ade80" : rank === 3 ? "#e05a5a" : "#5aa9ff";
          return (
            <g key={answer.id}>
              <rect x={x} y={h >= 0 ? 100 - h : 100} width={70} height={Math.max(1, Math.abs(h))} rx={6} fill={col} opacity={0.85} />
              <text x={x + 35} y={h >= 0 ? 92 - h : 116 - h} textAnchor="middle" fill="#fff" fontSize="13">
                {scores[i].toFixed(2)}
              </text>
              <text x={x + 35} y={195} textAnchor="middle" fill="#94a3b8" fontSize="13">
                answer {answer.id}
              </text>
            </g>
          );
        })}
        <text x={46} y={20} fill="#94a3b8" fontSize="12">
          reward score r(prompt, answer)
        </text>
        <text x={700} y={20} textAnchor="end" fill="#fb923c" fontSize="12">
          {loss === null ? "" : `step ${step} · loss ${loss.toFixed(3)}`}
        </text>
      </svg>
      {step >= 80 && order.length === 4 ? (
        <Callout tone="success" lead="Trained.">
          The reward model now scores your favourite highest. For example it says {ANSWERS[order[0]].id} beats {ANSWERS[order[3]].id} with probability{" "}
          {(sigmoid(scores[order[0]] - scores[order[3]]) * 100).toFixed(0)}%, because σ(r_winner − r_loser) is the model&apos;s guess that a human prefers the winner. Nobody had to write down a correct score; the ranking alone was enough.
        </Callout>
      ) : null}
    </div>
  );
}

function VideoCard({ file, title, caption }: { file: string; title: string; caption: string }) {
  return (
    <figure style={{ margin: "0 0 16px" }}>
      <figcaption style={{ fontWeight: 600, marginBottom: 6 }}>{title}</figcaption>
      <video
        src={`/videos/10-instructgpt/${file}`}
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
    q: "Why doesn't a bigger GPT-3 automatically follow instructions well?",
    options: [
      "It was trained to predict the next word on web text, not to help the user",
      "It has too few parameters",
      "It never saw any questions during training",
    ],
    answer: 0,
    why: "The paper calls the language-modeling objective misaligned: predicting the next token on internet pages is a different goal from following the user's instructions helpfully and safely. Scale alone doesn't fix that.",
  },
  {
    q: "What does the reward model learn from?",
    options: [
      "Humans typing a score from 1 to 10 for each answer",
      "Humans ranking several answers to the same prompt, turned into pairwise comparisons",
      "Automatic benchmark accuracy",
    ],
    answer: 1,
    why: "Labelers rank K = 4 to 9 answers. Each ranking gives K choose 2 pairs, and the loss −log σ(r_winner − r_loser) pushes the preferred answer's score above the other one's.",
  },
  {
    q: "What is the KL penalty in the PPO step for?",
    options: [
      "Making training faster",
      "Keeping the policy close to the SFT model so it doesn't over-optimize and game the reward model",
      "Making the model's answers shorter",
    ],
    answer: 1,
    why: "The reward model is only an imperfect stand-in for human judgment. The per-token KL penalty from the SFT model (the β term) stops the policy drifting into weird outputs the RM happens to overrate.",
  },
  {
    q: "Which result is from the paper?",
    options: [
      "InstructGPT 1.3B was preferred over 175B GPT-3 by labelers",
      "InstructGPT was much less biased on Winogender and CrowS-Pairs",
      "RLHF cost more compute than pretraining GPT-3",
    ],
    answer: 0,
    why: "Labelers preferred the 1.3B InstructGPT over the 175B GPT-3 despite 100x fewer parameters. Bias did not improve significantly, and RLHF took about 60 petaflop/s-days versus 3,640 for GPT-3.",
  },
  {
    q: "What is the PPO-ptx trick?",
    options: [
      "Training a bigger reward model",
      "Mixing pretraining-data updates into PPO to cut the 'alignment tax' on public NLP benchmarks",
      "Asking labelers to write longer demos",
    ],
    answer: 1,
    why: "Plain PPO lost some performance on SQuAD, DROP, HellaSwag and translation. Adding a γ-weighted pretraining log-likelihood term mostly recovered it without hurting labeler preference.",
  },
];

export default function App() {
  const [betaIdx, setBetaIdx] = useState<string>("1");
  const [playing, setPlaying] = useState<boolean>(false);
  const [resetKey, setResetKey] = useState<number>(0);
  const [st, setSt] = useState<Stats>({ rm: 0, q: 0, drift: 0 });
  const [picks, setPicks] = useState<(number | null)[]>(QUIZ.map(() => null));
  const beta = BETAS[Number(betaIdx)].beta;

  const verdict =
    !playing && st.drift < 0.3
      ? "Press Play to start PPO."
      : st.q < 0.3 && st.rm > 1.2
        ? "Reward hacking: the reward model's score keeps climbing while true quality collapses."
        : st.q > 0.8
          ? "Sweet spot: the policy found the genuinely good region without running off."
          : st.drift < 0.6
            ? "Leash too tight: the policy barely moves away from the SFT model."
            : "Still moving…";

  return (
    <Page
      title="InstructGPT: teaching GPT-3 to follow instructions with human feedback"
      summary="Paper #10 · Ouyang et al., OpenAI, 2022 · arXiv 2203.02155"
      width="wide"
    >
      <Callout tone="info" lead="The big idea in one line.">
        Ask people which answers they like, train a model to predict their taste, then use that model as a coach to fine-tune GPT-3, and a small model beats a 100x bigger one.
      </Callout>

      <Section heading="The plain-English version">
        <Text>
          GPT-3 learned to continue internet text. Ask it &quot;Explain the moon landing to a 6 year old&quot; and it may write more questions like yours instead of answering, or make something up. Being good at predicting the next word is not the same as being helpful. The paper calls this a misaligned objective.
        </Text>
        <Text>
          The fix has three steps. First, about 40 hired labelers wrote good answers to real prompts, and GPT-3 was fine-tuned to copy them (supervised fine-tuning, SFT). Second, the model wrote several answers per prompt, labelers ranked them, and a separate reward model learned to give a score that matches those rankings. Third, the model was trained with reinforcement learning (the PPO algorithm) to write answers the reward model scores highly, with a penalty for drifting too far from the SFT model. That whole recipe is RLHF, reinforcement learning from human feedback, and it is the recipe ChatGPT was built on.
        </Text>
        <PipelineAnim />
      </Section>

      <Section heading="Watch: the recipe, animated" caption="Rendered with Manim Community Edition. Toy motion, real recipe.">
        {VIDEOS.map((video) => (
          <VideoCard key={video.file} file={video.file} title={video.title} caption={video.caption} />
        ))}
      </Section>

      <Section heading="Demo 1: PPO on a reward landscape (3D)" caption="Toy landscape, made up to show the mechanism. Height is the reward-model score; colour is true quality.">
        <Text>
          Each white dot is an answer the policy might write. Height is the reward model&apos;s score. Colour is how good the answer truly is. This toy reward model has a flaw: far to one side it keeps rising even where answers are truly bad, which is the kind of mistake real reward models make outside the data they were trained on. Pick a KL strength and press Play.
        </Text>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", margin: "8px 0" }}>
          <Segmented options={BETAS.map((item) => ({ value: item.value, label: item.label }))} value={betaIdx} onChange={(value: string) => setBetaIdx(value)} />
          <Button label={playing ? "Pause" : "Play PPO"} variant="primary" onClick={() => setPlaying(!playing)} />
          <Button
            label="Restart from SFT"
            onClick={() => {
              setResetKey(resetKey + 1);
              setPlaying(false);
            }}
          />
        </div>
        <RewardLandscape beta={beta} playing={playing} resetKey={resetKey} onStats={setSt} />
        <Metrics
          metrics={[
            { value: st.rm.toFixed(2), label: "Reward model score (toy)" },
            { value: st.q.toFixed(2), label: "True quality (toy)", tone: st.q > 0.8 ? "success" : st.q < 0.3 ? "danger" : undefined },
            { value: st.drift.toFixed(2), label: "Drift from SFT (KL stand-in)" },
          ]}
        />
        <Callout tone={st.q < 0.3 && st.rm > 1.2 ? "danger" : st.q > 0.8 ? "success" : "info"}>{verdict}</Callout>
        <Text>
          Try all three. With no leash the dots race up the fake slope: reward up, quality down. Too tight and they never leave the blue ring. In the paper this leash is the per-token KL penalty, β · log(π_RL / π_SFT), added to the PPO objective.
        </Text>
      </Section>

      <Section heading="Demo 2: be the labeler, train the reward model" caption="Toy answers and scores. Rankings, not written scores, are the training signal.">
        <RankTrainer />
      </Section>

      <Section heading="How it's trained, step by step">
        <Steps
          steps={[
            { title: "Collect prompts", detail: "Prompts sent to early models in the OpenAI API Playground plus labeler-written ones. Split by user so test users never appear in training; PII filtered." },
            { title: "Step 1, SFT", detail: "About 13k prompts with labeler-written answers. GPT-3 fine-tuned for 16 epochs." },
            { title: "Step 2, reward model", detail: "About 33k prompts. Labelers rank 4 to 9 outputs. A 6B model outputs one score; loss is −log σ(r(x, y_w) − r(x, y_l)), averaged over all K choose 2 pairs from one prompt in a single batch." },
            { title: "Step 3, PPO", detail: "About 31k API prompts with no labels. Objective: reward − β · KL from SFT, plus γ · pretraining log-likelihood for the PPO-ptx version that the paper calls InstructGPT." },
          ]}
        />
      </Section>

      <Section heading="What the paper actually claimed">
        <Metrics
          metrics={[
            { value: "1.3B > 175B", label: "InstructGPT 1.3B preferred over GPT-3 175B", tone: "success" },
            { value: "85 ± 3%", label: "175B InstructGPT preferred over 175B GPT-3" },
            { value: "21% vs 41%", label: "Made-up info on closed-domain tasks", tone: "success" },
            { value: "60 vs 3,640", label: "PF/s-days: PPO-ptx 175B vs GPT-3 pretraining" },
          ]}
        />
        <Table
          columns={["Finding", "What they measured"]}
          rows={[
            ["Labelers prefer InstructGPT", "Preferred 71 ± 4% of the time even over few-shot-prompted 175B GPT-3"],
            ["More truthful", "About twice as often truthful and informative on TruthfulQA"],
            ["Slightly less toxic", "About 25% fewer toxic outputs than GPT-3 when asked to be respectful; no gain without that instruction"],
            [{ text: "Not less biased", tone: "warning" }, "No significant improvement on Winogender or CrowS-Pairs"],
            ["Alignment tax, mostly fixed", "Plain PPO dropped on SQuAD, DROP, HellaSwag, WMT French-English; PPO-ptx recovered most of it"],
            ["Generalizes to new labelers", "Held-out labelers preferred it at about the same rate; labeler agreement was about 73%"],
            ["Beats public instruction datasets", "Preferred over GPT-3 fine-tuned on FLAN (78 ± 4%) and T0 (79 ± 4%)"],
          ]}
        />
        <Callout tone="warning" lead="Limits the authors name.">
          It still makes simple mistakes: accepting false premises, hedging too much, missing multiple constraints. And it is aligned to a specific group (about 40 contractors, the researchers, and API customers), not to &quot;human values&quot; in general.
        </Callout>
      </Section>

      <Section heading="Quick quiz">
        {QUIZ.map((item, k) => (
          <Section key={item.q} heading={`${k + 1}. ${item.q}`}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {item.options.map((option, oi) => (
                <Button
                  key={option}
                  label={option}
                  variant={picks[k] === oi ? "primary" : "quiet"}
                  onClick={() => setPicks(picks.map((pick, z) => (z === k ? oi : pick)))}
                />
              ))}
            </div>
            {picks[k] === null ? null : picks[k] === item.answer ? (
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
          In your own words: why does InstructGPT need a separate reward model instead of just asking humans to score every answer during training, and what would go wrong if the PPO step had no KL penalty?
        </Text>
      </Section>

      <Section heading="Read it yourself">
        <LinkCards
          links={[
            {
              title: "Training language models to follow instructions with human feedback (arXiv abs)",
              site: "arxiv.org",
              date: "2022",
              href: "https://arxiv.org/abs/2203.02155",
            },
            {
              title: "Training language models to follow instructions with human feedback (PDF)",
              site: "arxiv.org",
              date: "2022",
              href: "https://arxiv.org/pdf/2203.02155",
            },
          ]}
        />
      </Section>
    </Page>
  );
}
