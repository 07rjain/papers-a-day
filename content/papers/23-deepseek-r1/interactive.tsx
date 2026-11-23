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
  Toggle,
  Equation,
  Frac,
  useState,
  useEffect,
  useRef,
} from "grok/canvas";
import { QuizSync } from "@/components/study/progress";
import { useReducedMotion } from "@/components/viz/shell";

// Group rewards, the policy update, the curve shapes, and the sample transcripts are toy.
// The aha sentence is quoted from Table 3. Endpoints 15.6 and 71.0, and the GRPO formula, are from the paper.

const VIDEOS = [
  {
    file: "GRPOGroupAdvantage.mp4",
    title: "GRPO: grade each answer against its own group",
    caption:
      "For one question the model samples a group of answers. A rule checks each final answer. Each advantage is (reward − group mean) / group standard deviation, so above-average answers become more likely. No separate critic is trained. The eight rewards in the clip are a toy example. Version 2 of the paper uses 16 samples per question.",
  },
  {
    file: "AhaMoment.mp4",
    title: "R1-Zero learns to think longer",
    caption:
      "With no supervised examples, R1-Zero's AIME 2024 pass@1 climbs from 15.6% to 71.0%, and to 86.7% with majority voting. Answers grow from hundreds to thousands of tokens. An intermediate checkpoint writes \"Wait, wait. Wait. That's an aha moment I can flag here.\" (Table 3). The curve shape is illustrative. The endpoints are the paper's.",
  },
  {
    file: "R1Pipeline.mp4",
    title: "From R1-Zero to R1, then distillation",
    caption:
      "R1 adds a cold start of a few thousand readable examples, then reasoning RL, then rejection-sampling fine-tuning on about 800,000 samples, then a final RL stage. Those same samples fine-tune small Qwen and Llama models, with no extra RL. The numbers are from Tables 4 and 5.",
  },
];

const GREEN = "#4ade80";
const RED = "#f87171";
const BLUE = "#5aa9ff";

function groupStats(rewards: number[]) {
  const count = rewards.length;
  const mean = rewards.reduce((sum, value) => sum + value, 0) / count;
  const variance = rewards.reduce((sum, value) => sum + (value - mean) ** 2, 0) / count;
  const std = Math.sqrt(variance);
  const advantage = rewards.map((value) => (std > 1e-9 ? (value - mean) / std : 0));
  return { mean, std, advantage };
}

function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function ease(value: number) {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
}

type Path = { points: [number, number, number][]; ok: boolean; advantage: number };

function GroupScene({ groupSize, startRate, speed, paused, resetKey }: { groupSize: number; startRate: number; speed: number; paused: boolean; resetKey: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sparkRef = useRef<HTMLCanvasElement | null>(null);
  const statusRef = useRef<HTMLParagraphElement | null>(null);
  const reduced = useReducedMotion();
  const live = useRef({ groupSize, speed, paused, reduced });
  live.current = { groupSize, speed, paused, reduced };
  useEffect(() => {
    const canvas = canvasRef.current;
    const spark = sparkRef.current;
    if (!canvas || !spark) return;
    let dead = false;
    let raf = 0;
    let cleanup = () => {};
    import("three").then((THREE) => {
      if (dead) return;
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x05080f);
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
      scene.add(new THREE.AmbientLight(0xffffff, 0.8));
      const light = new THREE.DirectionalLight(0xffffff, 0.6);
      light.position.set(4, 8, 6);
      scene.add(light);
      scene.add(new THREE.GridHelper(14, 14, 0x243044, 0x1a2433));
      const question = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 14), new THREE.MeshStandardMaterial({ color: 0xa78bfa, emissive: 0xa78bfa, emissiveIntensity: 0.6 }));
      question.position.set(0, 2.7, 0);
      scene.add(question);
      const lines: import("three").Line[] = [];
      const dots: import("three").Mesh[] = [];
      const labels: HTMLDivElement[] = [];
      const labelLayer = document.createElement("div");
      labelLayer.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:hidden";
      canvas.parentElement?.appendChild(labelLayer);
      const random = rng(7 + resetKey);
      let success = startRate;
      let round = 0;
      let lengthScale = 0.35;
      const history = [startRate];
      let paths: Path[] = [];
      let clock = live.current.reduced ? 4.6 : 0;
      const makeGroup = () => {
        lines.forEach((line) => {
          scene.remove(line);
          line.geometry.dispose();
        });
        dots.forEach((dot) => scene.remove(dot));
        labels.forEach((el) => el.remove());
        lines.length = 0;
        dots.length = 0;
        labels.length = 0;
        const size = live.current.groupSize;
        const next: Path[] = [];
        for (let index = 0; index < size; index += 1) {
          const angle = (index / size) * Math.PI * 2 + 0.2;
          const ok = random() < success;
          const length = 3.2 * (0.6 + lengthScale * (0.6 + random() * 0.8));
          const wobble = random() * 6;
          const points: [number, number, number][] = [];
          for (let step = 0; step <= 40; step += 1) {
            const t = step / 40;
            const radius = 0.4 + t * length;
            const twist = 0.35 * Math.sin(t * 9 + wobble) * t;
            points.push([Math.cos(angle + twist) * radius, 2.6 - t * 2.2 + 0.25 * Math.sin(t * 7 + wobble), Math.sin(angle + twist) * radius]);
          }
          next.push({ points, ok, advantage: 0 });
          const geometry = new THREE.BufferGeometry();
          const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0x5aa9ff }));
          const dot = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), new THREE.MeshBasicMaterial({ color: 0x5aa9ff }));
          scene.add(line, dot);
          lines.push(line);
          dots.push(dot);
          const el = document.createElement("div");
          el.style.cssText = "position:absolute;transform:translate(-50%,-140%);color:#f8fafc;font:700 12px sans-serif;text-shadow:0 1px 3px #000;white-space:nowrap";
          labelLayer.appendChild(el);
          labels.push(el);
        }
        const graded = groupStats(next.map((path) => (path.ok ? 1 : 0)));
        next.forEach((path, index) => {
          path.advantage = graded.advantage[index];
        });
        paths = next;
      };
      makeGroup();
      const projector = new THREE.Vector3();
      const resize = () => {
        const width = canvas.clientWidth || 760;
        const height = canvas.clientHeight || 520;
        renderer.setSize(width, height, false);
        camera.aspect = width / Math.max(1, height);
        camera.updateProjectionMatrix();
      };
      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(canvas);
      let yaw = 0.4;
      let pitch = 0.45;
      let drag: { x: number; y: number } | null = null;
      const down = (event: PointerEvent) => {
        drag = { x: event.clientX, y: event.clientY };
        canvas.setPointerCapture(event.pointerId);
      };
      const move = (event: PointerEvent) => {
        if (!drag) return;
        yaw -= (event.clientX - drag.x) * 0.008;
        pitch = Math.max(0.1, Math.min(1.15, pitch + (event.clientY - drag.y) * 0.005));
        drag = { x: event.clientX, y: event.clientY };
      };
      const up = () => {
        drag = null;
      };
      canvas.addEventListener("pointerdown", down);
      canvas.addEventListener("pointermove", move);
      canvas.addEventListener("pointerup", up);
      const roundSeconds = 6;
      let lastRound = 0;
      const loop = () => {
        raf = requestAnimationFrame(loop);
        if (dead) return;
        const current = live.current;
        if (current.reduced) clock = 4.6;
        else if (!current.paused) clock += current.speed / 60;
        const roundIndex = Math.floor(clock / roundSeconds);
        const phase = (clock / roundSeconds) % 1;
        if (!current.reduced && roundIndex !== lastRound) {
          if (paths.length) {
            const graded = groupStats(paths.map((path) => (path.ok ? 1 : 0)));
            if (graded.std > 0) {
              success += 0.07 * (1 - success) * Math.min(1, graded.std * 2);
              lengthScale = Math.min(1.6, lengthScale + 0.06);
            }
            round += 1;
            history.push(success);
            if (history.length > 40) history.shift();
          }
          lastRound = roundIndex;
          makeGroup();
        }
        const written = ease(phase / 0.4);
        const gradedAmount = ease((phase - 0.4) / 0.15);
        const lifted = ease((phase - 0.6) / 0.25);
        paths.forEach((path, index) => {
          const count = Math.max(1, Math.floor(written * 40));
          const positions: number[] = [];
          for (let step = 0; step <= count; step += 1) {
            const point = path.points[step];
            positions.push(point[0], point[1] + lifted * path.advantage * 0.55 * (step / 40), point[2]);
          }
          const line = lines[index];
          line.geometry.dispose();
          line.geometry = new THREE.BufferGeometry().setFromPoints(
            Array.from({ length: count + 1 }, (_, step) => new THREE.Vector3(positions[step * 3], positions[step * 3 + 1], positions[step * 3 + 2])),
          );
          const color = gradedAmount > 0.02 ? (path.ok ? 0x4ade80 : 0xf87171) : 0x5aa9ff;
          (line.material as import("three").LineBasicMaterial).color.setHex(color);
          const end = positions.slice(-3);
          dots[index].position.set(end[0], end[1], end[2]);
          (dots[index].material as import("three").MeshBasicMaterial).color.setHex(color);
          projector.copy(dots[index].position).project(camera);
          const label = labels[index];
          const show = gradedAmount > 0.5 && projector.z < 1;
          label.style.display = show ? "block" : "none";
          label.style.left = `${(projector.x * 0.5 + 0.5) * canvas.clientWidth}px`;
          label.style.top = `${(-projector.y * 0.5 + 0.5) * canvas.clientHeight}px`;
          label.style.color = path.advantage > 0 ? GREEN : path.advantage < 0 ? RED : "#94a3b8";
          label.textContent = lifted > 0.3 ? `A ${path.advantage >= 0 ? "+" : ""}${path.advantage.toFixed(2)}` : path.ok ? "r = 1" : "r = 0";
        });
        if (!drag && !current.reduced && !current.paused) yaw = 0.4 + Math.sin(clock * 0.25) * 0.45;
        const distance = Math.max(11, 9.2 / Math.max(camera.aspect, 0.65));
        camera.position.set(Math.sin(yaw) * distance, 3.6 + Math.sin(pitch) * 1.8, Math.cos(yaw) * distance);
        camera.lookAt(0, 1.2, 0);
        const graded = groupStats(paths.map((path) => (path.ok ? 1 : 0)));
        if (statusRef.current) {
          const phaseName = phase < 0.4 ? "Sampling a group of reasoning paths." : phase < 0.6 ? "A rule checks the final answer." : phase < 0.9 ? "Advantage is (reward − mean) / standard deviation." : "The policy updates, then the next question.";
          const signal = graded.std > 0 ? `Group mean ${graded.mean.toFixed(2)}, standard deviation ${graded.std.toFixed(2)}.` : `All ${graded.mean > 0.5 ? "right" : "wrong"}: every advantage is 0, so this group teaches nothing.`;
          statusRef.current.textContent = `Round ${round + 1} · G = ${paths.length} · ${phaseName} ${signal} Toy simulation.`;
        }
        const context = spark.getContext("2d");
        if (context) {
          context.clearRect(0, 0, spark.width, spark.height);
          context.strokeStyle = GREEN;
          context.lineWidth = 2;
          context.beginPath();
          history.forEach((value, index) => {
            const x = 8 + (index / 39) * (spark.width - 16);
            const y = 8 + (1 - value) * (spark.height - 16);
            if (index === 0) context.moveTo(x, y);
            else context.lineTo(x, y);
          });
          context.stroke();
        }
        renderer.render(scene, camera);
      };
      loop();
      cleanup = () => {
        cancelAnimationFrame(raf);
        observer.disconnect();
        canvas.removeEventListener("pointerdown", down);
        canvas.removeEventListener("pointermove", move);
        canvas.removeEventListener("pointerup", up);
        labels.forEach((el) => el.remove());
        labelLayer.remove();
        renderer.dispose();
      };
    });
    return () => {
      dead = true;
      cleanup();
    };
  }, [resetKey, startRate]);
  return (
    <div>
      <div style={{ position: "relative" }}>
        <canvas ref={canvasRef} aria-label="A question with several reasoning paths. Correct paths turn green and rise. Incorrect paths turn red and sink." style={{ width: "100%", height: 520, display: "block", borderRadius: 12, cursor: "grab", touchAction: "none", background: "#05080f" }} />
      </div>
      <p ref={statusRef} className="viz-note">Sampling a group. Drag to orbit. This run is a toy.</p>
      <canvas ref={sparkRef} width={240} height={70} aria-label="Toy chance that a sampled answer is right, across rounds." style={{ width: 240, height: 70, display: "block", marginTop: 8, background: "#0b1020", borderRadius: 8 }} />
    </div>
  );
}

function GroupDemo() {
  const [group, setGroup] = useState("8");
  const [difficulty, setDifficulty] = useState("0.3");
  const [speed, setSpeed] = useState("1");
  const [paused, setPaused] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  return (
    <Section heading="Demo 1: a group of reasoning paths, graded against each other" caption="The model writes several answers to one question. A rule checks each final answer. GRPO compares every answer with the group's average. Right answers in a mostly wrong group get a large push up. Over many questions the paths get longer. This is a toy simulation of the mechanism, not model output.">
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end", marginBottom: 10 }}>
        <Segmented options={[{ value: "4", label: "G = 4" }, { value: "8", label: "G = 8" }, { value: "16", label: "G = 16" }]} value={group} onChange={setGroup} />
        <Segmented options={[{ value: "0.6", label: "Easy" }, { value: "0.3", label: "Medium" }, { value: "0.08", label: "Very hard" }]} value={difficulty} onChange={(value) => { setDifficulty(value); setResetKey((key) => key + 1); }} />
        <Segmented options={[{ value: "0.5", label: "Slow" }, { value: "1", label: "Normal" }, { value: "2.5", label: "Fast" }]} value={speed} onChange={setSpeed} />
        <Button label={paused ? "Play" : "Pause"} variant="primary" onClick={() => setPaused((value) => !value)} />
        <Button label="Restart" onClick={() => setResetKey((key) => key + 1)} />
      </div>
      <GroupScene groupSize={Number.parseInt(group, 10)} startRate={Number.parseFloat(difficulty)} speed={Number.parseFloat(speed)} paused={paused} resetKey={resetKey} />
      <Text>On a very hard question most groups come back all wrong, every advantage is zero, and nothing is learned until a lucky right answer appears. That is why the starting model has to already solve some hard questions. DeepSeek-V3-Base started at 15.6% on AIME. Version 2 of the paper samples 16 answers per question.</Text>
    </Section>
  );
}

const PRESETS: Record<string, number[]> = {
  one: [1, 0, 0, 0, 0, 0, 0, 0],
  half: [1, 0, 1, 0, 1, 0, 1, 0],
  most: [1, 1, 1, 0, 1, 1, 1, 1],
  none: [0, 0, 0, 0, 0, 0, 0, 0],
  all: [1, 1, 1, 1, 1, 1, 1, 1],
};

function AdvantageScene({ rewards }: { rewards: number[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduced = useReducedMotion();
  const state = useRef({ rewards, reduced });
  state.current = { rewards, reduced };
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let dead = false;
    let raf = 0;
    const shownReward = new Array(8).fill(0);
    const shownAdvantage = new Array(8).fill(0);
    const draw = () => {
      if (dead) return;
      const rewardsNow = state.current.rewards;
      const { mean, std, advantage } = groupStats(rewardsNow);
      const rate = state.current.reduced ? 1 : 0.14;
      context.fillStyle = "#070b16";
      context.fillRect(0, 0, canvas.width, canvas.height);
      const column = (canvas.width - 80) / rewardsNow.length;
      const rewardTop = 36;
      const rewardHeight = 110;
      const mid = canvas.height * 0.7;
      context.fillStyle = "#94a3b8";
      context.font = "12px sans-serif";
      context.textAlign = "left";
      context.fillText("Reward", 12, rewardTop + 8);
      context.fillText("Advantage", 12, mid - 78);
      for (let index = 0; index < rewardsNow.length; index += 1) {
        shownReward[index] += (rewardsNow[index] - shownReward[index]) * rate;
        shownAdvantage[index] += (advantage[index] - shownAdvantage[index]) * rate;
        const x = 70 + index * column;
        const width = column * 0.55;
        const color = rewardsNow[index] >= 1 ? GREEN : rewardsNow[index] > 0 ? "#facc15" : RED;
        context.fillStyle = "rgba(148,163,184,0.12)";
        context.fillRect(x, rewardTop, width, rewardHeight);
        context.fillStyle = color;
        context.fillRect(x, rewardTop + rewardHeight - shownReward[index] * rewardHeight, width, shownReward[index] * rewardHeight);
        context.fillStyle = "#e2e8f0";
        context.textAlign = "center";
        context.font = "bold 12px sans-serif";
        context.fillText(`${rewardsNow[index]}`, x + width / 2, rewardTop + rewardHeight + 16);
        const bar = shownAdvantage[index] * 42;
        context.fillStyle = advantage[index] > 0.01 ? GREEN : advantage[index] < -0.01 ? RED : "#94a3b8";
        if (bar >= 0) context.fillRect(x, mid - bar, width, Math.max(2, bar));
        else context.fillRect(x, mid, width, -bar);
        context.fillText(`${advantage[index] >= 0 ? "+" : ""}${advantage[index].toFixed(2)}`, x + width / 2, bar >= 0 ? mid - bar - 8 : mid - bar + 16);
      }
      const meanY = rewardTop + rewardHeight - mean * rewardHeight;
      context.strokeStyle = "#facc15";
      context.setLineDash([5, 4]);
      context.beginPath();
      context.moveTo(60, meanY);
      context.lineTo(canvas.width - 16, meanY);
      context.stroke();
      context.setLineDash([]);
      context.fillStyle = "#facc15";
      context.textAlign = "right";
      context.font = "12px sans-serif";
      context.fillText(`mean ${mean.toFixed(3)}`, canvas.width - 16, meanY - 6);
      context.fillStyle = "#e2e8f0";
      context.textAlign = "left";
      context.fillText(std > 1e-9 ? `std ${std.toFixed(3)}` : "std = 0: every advantage is 0, so this group teaches nothing", 12, canvas.height - 14);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      dead = true;
      cancelAnimationFrame(raf);
    };
  }, []);
  return <canvas ref={canvasRef} width={980} height={420} aria-label="Reward bars and GRPO advantage bars for a group of answers." style={{ width: "100%", borderRadius: 12, display: "block", background: "#070b16" }} />;
}

function AdvantageDemo() {
  const [rewards, setRewards] = useState<number[]>([1, 0, 1, 0, 0, 1, 0, 0]);
  const { mean, std, advantage } = groupStats(rewards);
  const cycle = (index: number) => setRewards(rewards.map((value, rewardIndex) => (rewardIndex === index ? (value === 0 ? 1 : value === 1 ? 0.5 : 0) : value)));
  const setSize = (count: number) => {
    const next = rewards.slice(0, count);
    while (next.length < count) next.push(0);
    setRewards(next);
  };
  return (
    <Section heading="Demo 2: the GRPO advantage, live" caption="Click an answer to cycle its reward: 0, then 1, then 0.5, then 0. The 0.5 is toy partial credit, for a right answer that missed the think tags. The same reward of 1 is a large advantage when it is rare and a small one when everyone is right. This is equation 3, computed here.">
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end", marginBottom: 10 }}>
        <Segmented options={["4", "5", "6", "7", "8"].map((value) => ({ value, label: `G = ${value}` }))} value={String(rewards.length)} onChange={(value) => setSize(Number.parseInt(value, 10))} />
        <Button label="1 right" onClick={() => setRewards(PRESETS.one.slice(0, rewards.length))} />
        <Button label="Half right" onClick={() => setRewards(PRESETS.half.slice(0, rewards.length))} />
        <Button label="1 wrong" onClick={() => setRewards(PRESETS.most.slice(0, rewards.length))} />
        <Button label="All wrong" onClick={() => setRewards(PRESETS.none.slice(0, rewards.length))} />
        <Button label="All right" onClick={() => setRewards(PRESETS.all.slice(0, rewards.length))} />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        {rewards.map((value, index) => (
          <Button key={`${index}-${value}`} label={`o${index + 1}: ${value === 1 ? "right" : value === 0 ? "wrong" : "partial"}`} variant={value === 1 ? "primary" : "quiet"} onClick={() => cycle(index)} />
        ))}
      </div>
      <AdvantageScene rewards={rewards} />
      <Metrics metrics={[
        { value: mean.toFixed(3), label: "Group mean, the baseline" },
        { value: std.toFixed(3), label: "Group standard deviation" },
        { value: String(advantage.filter((value) => value > 1e-9).length), label: "Answers pushed up", tone: "success" },
        { value: String(advantage.filter((value) => value < -1e-9).length), label: "Answers pushed down", tone: "danger" },
      ]} />
      <Equation>
        A<sub>i</sub> = <Frac num={<span>r<sub>i</sub> − mean(r)</span>} den={<span>std(r)</span>} />
      </Equation>
      <Text>With one right answer in a group of eight, that answer's advantage is about +2.65 and each wrong answer is about −0.38. With one wrong answer, the signs flip. Dividing by the standard deviation keeps the update a similar size on easy and hard questions. The standard deviation here divides by the group size. A real implementation also adds a tiny number so it never divides by zero.</Text>
    </Section>
  );
}

const STEPS = 40;
const accuracyAt = (step: number) => 15.6 + (71.0 - 15.6) * (1 - Math.exp(-step / 13)) / (1 - Math.exp(-STEPS / 13));
const lengthAt = (step: number) => Math.round(600 + 11000 * (step / STEPS) ** 1.35 + 300 * Math.sin(step * 0.9));
const languageAt = (step: number, consistent: boolean) => (consistent ? 97 - 1.5 * Math.sin(step) : Math.max(62, 97 - step * 0.85 + 2 * Math.sin(step)));
const TRANSCRIPTS = [
  { at: 0, text: "<think> 3 apples + 4 apples = 7. </think> <answer> 7 </answer>" },
  { at: 10, text: "<think> First find the total cost: 3 × 4 = 12. Then subtract from 20: 20 − 12 = 8. Check: 12 + 8 = 20. </think> <answer> 8 </answer>" },
  { at: 22, text: "<think> Let me try substitution. That is getting messy. Maybe there is another approach. Let me go back and check the first step. </think>" },
  { at: 30, text: "<think> Wait, wait. Wait. That's an aha moment I can flag here. Let's reevaluate this step-by-step. </think>  — quoted from Table 3" },
];

function Curve({ values, floor, ceiling, color, label }: { values: number[]; floor: number; ceiling: number; color: string; label: string }) {
  const width = 720;
  const height = 150;
  const points = values
    .map((value, index) => {
      const x = 36 + (index / Math.max(1, STEPS)) * (width - 48);
      const y = 16 + (1 - (value - floor) / (ceiling - floor)) * (height - 36);
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} style={{ display: "block", background: "#070b16", borderRadius: 12, marginTop: 8 }}>
      <text x={12} y={18} fill="#94a3b8" fontSize="12">{label}</text>
      <polyline fill="none" stroke={color} strokeWidth="2.5" points={points} />
      <text x={width - 8} y={height - 8} fill="#e2e8f0" fontSize="12" textAnchor="end">{values[values.length - 1]?.toLocaleString()}</text>
    </svg>
  );
}

function TrainingDemo() {
  const reduced = useReducedMotion();
  const [step, setStep] = useState(reduced ? STEPS : 0);
  const [playing, setPlaying] = useState(false);
  const [languageReward, setLanguageReward] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setStep((value) => {
        if (value >= STEPS) {
          setPlaying(false);
          return STEPS;
        }
        return value + 1;
      });
    }, 160);
    return () => window.clearInterval(id);
  }, [playing]);
  const accuracy = Array.from({ length: step + 1 }, (_, index) => Math.round(accuracyAt(index) * 10) / 10);
  const lengths = Array.from({ length: step + 1 }, (_, index) => lengthAt(index));
  const languages = Array.from({ length: step + 1 }, (_, index) => Math.round(languageAt(index, languageReward)));
  const shown = TRANSCRIPTS.filter((item) => item.at <= step);
  const mixed = !languageReward && step >= 26;
  return (
    <Section heading="Demo 3: a toy training run, with the paper's start and end" caption="Accuracy starts at the paper's 15.6% and ends at its 71.0%. The shape between them, the lengths, and the sample answers are toy, except the aha sentence, which is quoted from Table 3. The language-consistency reward is the one DeepSeek-R1 added.">
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end", marginBottom: 10 }}>
        <Button label={playing ? "Pause" : step >= STEPS ? "Replay" : "Play"} variant="primary" onClick={() => { if (step >= STEPS) setStep(0); setPlaying((value) => !value); }} />
        <Button label="Step" onClick={() => setStep(Math.min(STEPS, step + 1))} />
        <Button label="Reset" onClick={() => { setStep(0); setPlaying(false); }} />
        <Toggle label="Language-consistency reward" value={languageReward} onChange={setLanguageReward} />
      </div>
      <Metrics metrics={[
        { value: `${accuracyAt(step).toFixed(1)}%`, label: "AIME 2024 pass@1, toy curve", detail: step >= STEPS ? "Paper: 71.0%, and 86.7% with majority vote" : "Paper: starts at 15.6%" },
        { value: lengthAt(step).toLocaleString(), label: "Average response tokens, toy", detail: "The paper: from hundreds to thousands" },
        { value: `${Math.round(languageAt(step, languageReward))}%`, label: "Chain-of-thought words in the question's language, toy", tone: mixed ? "warning" : undefined },
      ]} />
      <Curve values={accuracy} floor={0} ceiling={100} color={GREEN} label="Toy AIME accuracy during RL" />
      <Curve values={lengths} floor={0} ceiling={13000} color={BLUE} label="Toy average response length, tokens" />
      <Curve values={languages} floor={50} ceiling={100} color={languageReward ? GREEN : "#facc15"} label={languageReward ? "Toy language consistency, with the reward" : "Toy language consistency, without the reward"} />
      <Text>What a model might write at this point. These lines are illustrative, except the aha sentence.</Text>
      {shown.map((item) => <Text key={item.at}><code>{item.text}</code></Text>)}
      {mixed ? <Callout tone="warning" lead="Language mixing.">R1-Zero's thinking was often hard to read and mixed languages. R1 adds a reward equal to the share of target-language words in the chain of thought. The paper says this costs a little accuracy and reads better.</Callout> : null}
    </Section>
  );
}

const DISTILL = [
  { label: "Qwen 1.5B", value: 28.9 },
  { label: "Qwen 7B", value: 55.5 },
  { label: "Llama 8B", value: 50.4 },
  { label: "Qwen 14B", value: 69.7 },
  { label: "Qwen 32B", value: 72.6 },
  { label: "Llama 70B", value: 70.0 },
];

type QuizItem = { q: string; options: string[]; answer: number; why: string };
const QUIZ: QuizItem[] = [
  { q: "What did DeepSeek-R1-Zero start from, and what was missing?", options: ["A chat model fine-tuned on human reasoning examples", "DeepSeek-V3-Base, trained with reinforcement learning only: no supervised fine-tuning and no human-written reasoning", "A small model distilled from OpenAI o1", "A model trained only with a process reward model"], answer: 1, why: "Reinforcement learning is applied directly to DeepSeek-V3-Base, with no supervised data. The template only asks for a think block and then an answer." },
  { q: "What does GRPO compare each answer against?", options: ["A separate critic network's prediction", "The average reward of the other answers sampled for the same question: (reward − group mean) / group standard deviation", "A person's rating", "Only the previous model's answer"], answer: 1, why: "Equation 3. GRPO estimates the baseline from the group's scores instead of training a critic as large as the policy." },
  { q: "Where did R1-Zero's reward come from?", options: ["A neural reward model trained on human preferences", "Rules: a correct final answer, plus a format check for the think and answer tags", "People grading each step", "Majority voting"], answer: 1, why: "They avoided a neural reward model because it can be gamed at this scale and needs extra training." },
  { q: "If all eight sampled answers are wrong, what does the group teach?", options: ["It pushes all eight down", "Nothing. Every reward equals the mean, so every advantage is 0", "It copies the least wrong answer", "It asks a person"], answer: 1, why: "This follows from equation 3. Learning needs some answers above the group average and some below it, which is why the base model must already solve some hard questions." },
  { q: "Why add a cold start before the reinforcement learning in R1?", options: ["R1-Zero could not reason", "R1-Zero's reasoning was hard to read and mixed languages. A few thousand readable examples fixed the format and improved results.", "To avoid using GPUs", "To remove the reward"], answer: 1, why: "Poor readability and language mixing. The cold-start examples use a readable reasoning block plus a summary, and the authors report better results than R1-Zero." },
  { q: "What did distillation show?", options: ["Small models cannot learn to reason", "Fine-tuning a small model on R1's outputs beat running the large-scale RL on that small model: Qwen-32B, 72.6% versus 47.0% on AIME", "Reinforcement learning always beats distillation", "Distilled models need RL first"], answer: 1, why: "Table 6. Even the 1.5B distilled model scored 28.9% on AIME, above GPT-4o's 9.3% in Table 5." },
];

export default function DeepSeekR1Page() {
  const [picks, setPicks] = useState<(number | null)[]>(QUIZ.map(() => null));
  return (
    <Page title="DeepSeek-R1: reward the answer, and the reasoning shows up" summary="Paper #23 · DeepSeek-AI · January 2025 · arXiv 2501.12948" width="wide">
      <Callout tone="info" lead="The big idea in one line.">Give a strong base model problems with checkable answers, reward only the final answer, and let reinforcement learning do the rest. Longer thinking, including self-checks, shows up without human-written reasoning.</Callout>
      <Section heading="The plain-English version">
        <Text>Chain-of-thought (paper #14) showed that writing the steps helps. Teaching those steps usually meant human examples, then human feedback, as in InstructGPT (paper #10). OpenAI's o1 showed that thinking longer helps on maths and code, without saying how the thinking was trained. Self-consistency (paper #15) is the majority vote this paper later reports as cons@64.</Text>
        <Text>DeepSeek-R1-Zero skips the worked examples. The base model is DeepSeek-V3-Base, a 671 billion parameter mixture of experts, like Mixtral (paper #22), with 37 billion parameters active. For each problem it writes several attempts. A program checks the final answer. GRPO compares each attempt with the average of that group.</Text>
        <Steps steps={[
          { title: "Ask", detail: "Give a problem with a checkable answer: a boxed maths result, or code with tests. The template only requires a think block and then an answer." },
          { title: "Sample a group", detail: "Draw several answers from the current model. Version 2 of the paper uses 16 per question." },
          { title: "Grade by rule", detail: "Accuracy if the answer is right, plus a format reward for the tags. No neural reward model and no human grader." },
          { title: "Compare inside the group", detail: "Advantage is (reward − group mean) / group standard deviation. Above average is pushed up. Below average is pushed down." },
          { title: "Nudge the policy", detail: "Raise the probability of positive-advantage answers, with a clipped step and a small KL penalty so the model does not jump. Repeat for thousands of steps." },
        ]} />
      </Section>
      <Section heading="Watch: the idea, animated">
        {VIDEOS.map((video) => (
          <figure key={video.file} style={{ margin: "0 0 16px" }}>
            <figcaption style={{ fontWeight: 600, marginBottom: 6 }}>{video.title}</figcaption>
            <video src={`/videos/23-deepseek-r1/${video.file}`} preload="none" controls muted loop playsInline style={{ width: "100%", borderRadius: 12, background: "#05080f", display: "block" }} />
            <p style={{ fontSize: 13, opacity: 0.75, margin: "4px 0 0" }}>{video.caption}</p>
          </figure>
        ))}
      </Section>
      <GroupDemo />
      <AdvantageDemo />
      <TrainingDemo />
      <Section heading="What the paper actually claimed">
        <Metrics metrics={[
          { value: "15.6% → 71.0%", label: "R1-Zero, AIME 2024 pass@1", detail: "86.7% with majority voting, cons@64 (Table 2)", tone: "success" },
          { value: "79.8%", label: "DeepSeek-R1, AIME 2024", detail: "OpenAI-o1-1217: 79.2% (Table 4)" },
          { value: "97.3%", label: "DeepSeek-R1, MATH-500", detail: "o1-1217: 96.4%" },
          { value: "800k", label: "Supervised samples", detail: "About 600k reasoning plus about 200k other, then reused to distil six small models" },
        ]} />
        <Table columns={["R1-Zero versus o1, Table 2", "AIME pass@1", "AIME cons@64", "MATH-500", "GPQA Diamond", "LiveCodeBench", "Codeforces rating"]} rows={[
          ["OpenAI-o1-mini", "63.6", "80.0", "90.0", "60.0", "53.8", "1820"],
          ["OpenAI-o1-0912", { text: "74.4", tone: "success" }, "83.3", "94.8", { text: "77.3", tone: "success" }, { text: "63.4", tone: "success" }, { text: "1843", tone: "success" }],
          ["DeepSeek-R1-Zero", "71.0", { text: "86.7", tone: "success" }, { text: "95.9", tone: "success" }, "73.3", "50.0", "1444"],
        ]} />
        <Table columns={["Table 4", "GPT-4o", "DeepSeek-V3", "o1-mini", "o1-1217", "DeepSeek-R1"]} rows={[
          ["AIME 2024", "9.3", "39.2", "63.6", "79.2", { text: "79.8", tone: "success" }],
          ["MATH-500", "74.6", "90.2", "90.0", "96.4", { text: "97.3", tone: "success" }],
          ["Codeforces percentile", "23.6", "58.7", "93.4", { text: "96.6", tone: "success" }, "96.3"],
          ["GPQA Diamond", "49.9", "59.1", "60.0", { text: "75.7", tone: "success" }, "71.5"],
          ["MMLU", "87.2", "88.5", "85.2", { text: "91.8", tone: "success" }, "90.8"],
          ["SWE-bench Verified", "38.8", "42.0", "41.6", "48.9", { text: "49.2", tone: "success" }],
          ["AlpacaEval 2.0", "51.1", "70.0", "57.8", "–", { text: "87.6", tone: "success" }],
        ]} />
        <Text>The o1-1217 numbers are from OpenAI's reports. DeepSeek-R1 has 671 billion parameters in total and 37 billion active per token.</Text>
        <svg width="100%" viewBox="0 0 760 250" role="img" aria-label="Distilled models, AIME 2024 pass@1, Table 5. The dashed line is o1-mini at 63.6%." style={{ display: "block", background: "#070b16", borderRadius: 12 }}>
          <line x1={160 + (63.6 / 100) * 520} y1={12} x2={160 + (63.6 / 100) * 520} y2={230} stroke="#facc15" strokeDasharray="4 4" />
          <text x={168 + (63.6 / 100) * 520} y={22} fill="#facc15" fontSize="12">o1-mini 63.6%</text>
          {DISTILL.map((row, index) => {
            const y = 36 + index * 34;
            return (
              <g key={row.label}>
                <text x={148} y={y + 14} fill="#e2e8f0" fontSize="13" textAnchor="end">{row.label}</text>
                <rect x={160} y={y} height={16} rx={3} fill={row.value >= 63.6 ? GREEN : "#94a3b8"} width={(row.value / 100) * 520} />
                <text x={168 + (row.value / 100) * 520} y={y + 13} fill="#ffffff" fontSize="12">{row.value.toFixed(1)}%</text>
              </g>
            );
          })}
        </svg>
        <Text>Table 6, AIME 2024 pass@1, same 32 billion parameter family: distilling R1's outputs scores 72.6. A preview model, QwQ, scores 50.0. Running more than 10,000 RL steps on Qwen-32B itself scores 47.0. Copying a strong reasoner's traces beat doing the large RL on the small model.</Text>
        <Table columns={["Finding", "What they measured"]} rows={[
          ["Pure RL, section 2.2", "Reasoning can be trained with RL and no supervised reasoning traces. Self-checks and long chains of thought show up on their own."],
          ["Length, Figure 3", "R1-Zero's average response grows through training, from hundreds of tokens to thousands, without a length reward."],
          ["Aha moment, Table 3", "An intermediate checkpoint stops, writes \"Wait, wait. Wait. That's an aha moment I can flag here.\", and rechecks the step."],
          ["Why R1 is not just R1-Zero", "R1-Zero was hard to read and mixed languages. R1 adds a cold start, a language-consistency reward, rejection sampling, and a last RL stage that also uses reward models for helpfulness and harmlessness."],
          ["What they dropped, section 4.2", "A process reward model was hard to define and easy to game. Monte Carlo tree search got stuck: token sequences are a much larger search space than chess."],
          ["Version 2, January 2026", "Adds training settings: 16 samples per question and 10,400 steps for R1-Zero, which then reaches 77.9% AIME pass@1. The reported training cost is about $294,000 at $2 per H800 GPU hour."],
        ]} />
        <Callout tone="warning" lead="Limits the authors list.">R1 is weaker than DeepSeek-V3 at function calling, multi-turn chat, role-play, and JSON. It is tuned for Chinese and English, so other languages can mix. Few-shot prompts make it worse; the authors say to use zero-shot. Reinforcement learning barely touched software engineering. Rule rewards only work where a program can check the answer. The aha line is one chosen example. The o1 scores were not re-run.</Callout>
      </Section>
      <QuizSync slug="23-deepseek-r1" picks={picks} answers={QUIZ.map((item) => item.answer)} />
      <Section heading="Quick quiz">
        {QUIZ.map((item, index) => (
          <Section key={item.q} heading={`${index + 1}. ${item.q}`}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {item.options.map((option, optionIndex) => (
                <Button key={option} label={option} variant={picks[index] === optionIndex ? "primary" : "quiet"} onClick={() => setPicks(picks.map((pick, pickIndex) => (pickIndex === index ? optionIndex : pick)))} />
              ))}
            </div>
            {picks[index] === null ? null : picks[index] === item.answer ? <Callout tone="success" lead="Right.">{item.why}</Callout> : <Callout tone="warning" lead="Not quite.">{item.why}</Callout>}
          </Section>
        ))}
        <Text>Explain it in your own words: how does DeepSeek-R1-Zero learn to reason with reinforcement learning without any human-written reasoning examples, and what does GRPO compare each answer against?</Text>
      </Section>
      <Section heading="Read it yourself">
        <LinkCards links={[
          { title: "DeepSeek-R1 (abstract)", site: "arxiv.org", date: "2025", href: "https://arxiv.org/abs/2501.12948" },
          { title: "DeepSeek-R1 (PDF)", site: "arxiv.org", date: "2025", href: "https://arxiv.org/pdf/2501.12948" },
          { title: "Official code and weights", site: "github.com", date: "2025", href: "https://github.com/deepseek-ai/DeepSeek-R1" },
          { title: "Weights on Hugging Face", site: "huggingface.co", date: "2025", href: "https://huggingface.co/deepseek-ai/DeepSeek-R1" },
          { title: "Chain-of-thought", site: "Papers a Day", date: "2022", href: "/papers/14-chain-of-thought" },
          { title: "InstructGPT, the earlier RLHF pipeline", site: "Papers a Day", date: "2022", href: "/papers/10-instructgpt" },
          { title: "Mixtral, a mixture of experts", site: "Papers a Day", date: "2024", href: "/papers/22-mixtral" },
        ]} />
      </Section>
    </Page>
  );
}
