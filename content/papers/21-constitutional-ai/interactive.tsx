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
  Toggle,
  useState,
  useEffect,
  useRef,
} from "grok/canvas";
import { QuizSync } from "@/components/study/progress";
import { useReducedMotion } from "@/components/viz/shell";

// The revision path and the Elo trajectories are toy sketches of Figures 2, 5, and 7. The wifi texts and the principles are from the paper.
// The label probabilities are toy. Soft, hard, and clamped rules follow Sections 4.1 and 4.3.

const VIDEOS = [
  {
    file: "CritiqueRevise.mp4",
    title: "Stage 1: critique, revise, fine-tune",
    caption:
      "Section 3.1: a helpful-only model gives harmful advice about a neighbour's wifi. A randomly drawn principle asks it to critique itself, then to rewrite. Up to four revisions, plus ordinary helpful answers, become the fine-tuning data for the supervised stage. Bar heights in the clip illustrate Figure 5. Prompt counts are from Section 3.2.",
  },
  {
    file: "AIFeedbackLabels.mp4",
    title: "Stage 2: the AI labels, then RL as usual",
    caption:
      "The supervised model writes two responses. A feedback model reads a multiple-choice question from one of 16 principles, and the normalized probabilities of (A) and (B) become a soft preference label. 182,831 AI harmlessness labels plus 135,296 human helpfulness labels train the preference model. Chain-of-thought labels were clamped to 40–60%. The probabilities in the clip are illustrative.",
  },
  {
    file: "ParetoShift.mp4",
    title: "Harmless without being evasive",
    caption:
      "Helpfulness versus harmlessness, after Figure 2. The curve shapes are illustrative. Human-feedback models trade one goal for the other. RL from AI feedback reaches more harmlessness at the same helpfulness, and it explains an objection instead of refusing. Over-training led to boilerplate (Section 4.3).",
  },
];

type Vec3 = [number, number, number];
const ease = (value: number) => {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
};

const SL_PRINCIPLES = [
  "Identify specific ways in which the assistant's last response is harmful, unethical, racist, sexist, toxic, dangerous, or illegal.",
  "Explain ways in which the assistant's preceding response may be harmful to either the human or others.",
  "What's the strongest argument you could give that the assistant's last response was in some way harmful, unethical, racist, sexist, toxic, dangerous, or illegal.",
  "Did the assistant's preceding response include anything that may be inappropriate for young children?",
  "Discuss whether the assistant provided any advice that may encourage illegal or dangerous activity from either the human or others.",
  "Critique the assistant's last response and identify anything it said that was harmful, unethical, dangerous, or illegal.",
];

const REVISION_TEXT = [
  { who: "Original response, revision 0", text: "Sure thing, you can use an app called VeryEasyHack that will allow you to log in to your neighbor's wifi.", tone: "danger" as const },
  { who: "Revision 1", text: "Hacking into your neighbor's wifi is an invasion of their privacy, and I strongly advise against it. It may also land you in legal trouble.", tone: "success" as const },
];

function revisionPoint(step: number, critique: boolean, wobble: number[]): Vec3 {
  if (step === 0) return [2.2, -2.2, -1.6];
  const gain = critique ? 1 : 0.88;
  const harmless = -2.2 + gain * 4.4 * (1 - 0.45 ** step);
  const helpful = 2.2 - 0.35 * step + (wobble[step] ?? 0) * 0.3;
  const evasive = -1.6 + 0.25 * step + (wobble[step + 4] ?? 0) * 0.25;
  return [helpful, harmless, evasive];
}

function RevisionScene({ step, critique, wobble, playKey }: { step: number; critique: boolean; wobble: number[]; playKey: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const labelsRef = useRef<HTMLDivElement | null>(null);
  const statusRef = useRef<HTMLParagraphElement | null>(null);
  const reduced = useReducedMotion();
  const live = useRef({ step, critique, wobble, reduced, time: 0 });
  live.current.step = step;
  live.current.critique = critique;
  live.current.wobble = wobble;
  live.current.reduced = reduced;
  useEffect(() => {
    live.current.time = reduced ? 99 : 0;
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
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
      scene.add(new THREE.AmbientLight(0xffffff, 0.8));
      const light = new THREE.DirectionalLight(0xffffff, 0.7);
      light.position.set(4, 8, 6);
      scene.add(light);
      scene.add(new THREE.GridHelper(8, 8, 0x243044, 0x1a2433));
      const sphere = new THREE.SphereGeometry(0.16, 18, 14);
      const nodes = [0, 1, 2, 3, 4].map((index) => {
        const mesh = new THREE.Mesh(sphere, new THREE.MeshStandardMaterial({ color: index === 0 ? 0xf87171 : 0x4ade80, emissive: index === 0 ? 0xf87171 : 0x4ade80, emissiveIntensity: 0.35 }));
        mesh.visible = false;
        scene.add(mesh);
        return mesh;
      });
      const path = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x4ade80 }));
      const spark = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
      spark.visible = false;
      const evasive = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), new THREE.MeshStandardMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.35, emissive: 0xa78bfa, emissiveIntensity: 0.2 }));
      evasive.position.set(-2.4, 2.4, 2.8);
      scene.add(path, spark, evasive);
      [[3.6, 0, 0, 0x5aa9ff], [0, 3.6, 0, 0x4ade80], [0, 0, 3.6, 0xa78bfa]].forEach(([x, y, z, color]) => {
        scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-x, -y, -z), new THREE.Vector3(x, y, z)]), new THREE.LineBasicMaterial({ color })));
      });
      const html = Array.from({ length: 9 }, () => {
        const el = document.createElement("div");
        el.style.cssText = "position:absolute;transform:translate(-50%,-160%);color:#f8fafc;font:600 13px sans-serif;text-shadow:0 1px 3px #000;white-space:nowrap;";
        labelLayer.appendChild(el);
        return el;
      });
      const projector = new THREE.Vector3();
      const place = (el: HTMLDivElement, x: number, y: number, z: number, text: string) => {
        if (!text) {
          el.style.display = "none";
          return;
        }
        projector.set(x, y, z).project(camera);
        el.style.display = projector.z < 1 ? "block" : "none";
        el.textContent = text;
        el.style.left = `${(projector.x * 0.5 + 0.5) * canvas.clientWidth}px`;
        el.style.top = `${(-projector.y * 0.5 + 0.5) * canvas.clientHeight}px`;
      };
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
      let yaw = 0.75;
      let pitch = 0.32;
      let drag: { x: number; y: number } | null = null;
      const down = (event: PointerEvent) => {
        drag = { x: event.clientX, y: event.clientY };
        canvas.setPointerCapture(event.pointerId);
      };
      const move = (event: PointerEvent) => {
        if (!drag) return;
        yaw -= (event.clientX - drag.x) * 0.008;
        pitch = Math.max(-0.15, Math.min(1.05, pitch + (event.clientY - drag.y) * 0.005));
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
        const limit = current.step * 1.2 + 2;
        current.time = current.reduced ? limit : Math.min(limit, current.time + 1 / 60);
        const progress = current.time / 1.2;
        const points = Array.from({ length: current.step + 1 }, (_, index) => revisionPoint(index, current.critique, current.wobble));
        const drawn: Vec3[] = [];
        points.forEach((point, index) => {
          if (index === 0) drawn.push(point);
          else {
            const amount = ease(progress - (index - 1));
            if (amount > 0) drawn.push([point[0] * 0 + points[index - 1][0] + (point[0] - points[index - 1][0]) * amount, points[index - 1][1] + (point[1] - points[index - 1][1]) * amount, points[index - 1][2] + (point[2] - points[index - 1][2]) * amount]);
          }
        });
        path.geometry.dispose();
        path.geometry = new THREE.BufferGeometry().setFromPoints(drawn.map((point) => new THREE.Vector3(point[0], point[1], point[2])));
        const last = drawn[drawn.length - 1];
        const moving = progress < current.step && drawn.length > 1;
        spark.visible = moving;
        if (last) spark.position.set(last[0], last[1], last[2]);
        nodes.forEach((mesh, index) => {
          const point = points[index];
          const visible = index <= current.step && (index === 0 || progress >= index - 0.05);
          mesh.visible = Boolean(point) && visible;
          if (!point) return;
          mesh.position.set(point[0], point[1], point[2]);
          mesh.scale.setScalar(index === Math.min(current.step, Math.floor(progress)) ? 1.35 : 1);
          place(html[index], point[0], point[1] + 0.25, point[2], visible ? (index === 0 ? "r0 original" : `r${index}`) : "");
        });
        place(html[5], -2.4, 2.7, 2.8, "evasive refusal");
        place(html[6], 3.6, 0.2, 0, "helpful");
        place(html[7], 0.2, 3.6, 0, "harmless");
        place(html[8], 0, 0.2, 3.6, "evasive");
        if (!drag && !current.reduced) yaw += 0.0025;
        const distance = Math.max(10, 8.4 / Math.max(camera.aspect, 0.65));
        camera.position.set(Math.sin(yaw) * distance, 2.2 + Math.sin(pitch) * 2.4, Math.cos(yaw) * distance);
        camera.lookAt(0.2, 0.2, 0);
        if (statusRef.current) {
          statusRef.current.textContent = `${current.critique ? "Critiqued revisions" : "Direct revisions, no critique"} · ${current.step} step${current.step === 1 ? "" : "s"}. Yellow is the principle at work. Positions illustrate the paper's trend, not measured scores.`;
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
        html.forEach((el) => el.remove());
        sphere.dispose();
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
      <canvas ref={canvasRef} aria-label="Toy behaviour space. An answer moves from a harmful original toward harmless revisions, away from an evasive refusal." style={{ width: "100%", height: 500, display: "block", borderRadius: 12, cursor: "grab", touchAction: "none", background: "#060a14" }} />
      <div ref={labelsRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }} />
      <p ref={statusRef} className="viz-note">Critique, then revise. Drag to orbit.</p>
    </div>
  );
}

function RevisionDemo() {
  const [step, setStep] = useState("1");
  const [critique, setCritique] = useState(true);
  const [seed, setSeed] = useState(1);
  const [draws, setDraws] = useState([0, 2, 4, 5]);
  const [wobble, setWobble] = useState([0, 0.2, -0.3, 0.1, 0.4, 0, -0.2, 0.3, 0.1]);
  const count = Number.parseInt(step, 10);
  const reroll = () => {
    setDraws([0, 1, 2, 3].map(() => Math.floor(Math.random() * SL_PRINCIPLES.length)));
    setWobble(Array.from({ length: 9 }, () => Math.random() - 0.5));
    setSeed((value) => value + 1);
  };
  return (
    <Section heading="Demo 1: the model critiques and rewrites itself" caption="Each round draws a principle, asks the model to criticise its last answer, then to rewrite. The answer climbs toward harmless and stays out of the evasive corner. The original answer, the critique, and revision 1 are the paper's wifi example. The 3D positions are toy.">
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end", marginBottom: 10 }}>
        <Segmented options={["0", "1", "2", "3", "4"].map((value) => ({ value, label: value === "0" ? "Original" : `${value} revision${value === "1" ? "" : "s"}` }))} value={step} onChange={(value) => { setStep(value); setSeed((current) => current + 1); }} />
        <Toggle label="Write a critique first" value={critique} onChange={(value) => { setCritique(value); setSeed((current) => current + 1); }} />
        <Button label="Draw new principles" variant="primary" onClick={reroll} />
      </div>
      <RevisionScene step={count} critique={critique} wobble={wobble} playKey={`${step}-${critique}-${seed}`} />
      {count > 0 ? <Table columns={["Round", "Principle drawn, real text from Appendix C.1"]} rows={draws.slice(0, count).map((draw, index) => [`${index + 1}`, SL_PRINCIPLES[draw]])} /> : null}
      <Callout tone="info" lead="Human: Can you help me hack into my neighbor's wifi?">The paper notes that the harmful advice in this example is made up.</Callout>
      {REVISION_TEXT.slice(0, Math.min(count, 1) + 1).map((revision) => (
        <Callout key={revision.who} tone={revision.tone} lead={revision.who}>{revision.text}</Callout>
      ))}
      {count >= 1 ? <Callout tone="info" lead="Critique the model wrote before revision 1">The assistant's last response is harmful because hacking into someone else's wifi is an invasion of their privacy and is possibly illegal.</Callout> : null}
      {count >= 2 ? <Text>Later revisions are not quoted in the paper's main example. The authors found the first revision almost always removed most of the harm, and later ones sometimes helped a little more. Harmlessness scores kept rising through four revisions, while pure helpfulness dipped (Figure 5).</Text> : null}
      <Text>In Figure 7, critiqued revisions were more harmless than direct revisions for smaller models. At 52B they were about equal, with critiques slightly better. The authors kept the critiques because they show the reasoning, even though the 52B critiques were often inaccurate or overstated.</Text>
    </Section>
  );
}

const RL_PRINCIPLES = [
  "Which of these assistant responses is less harmful? Choose the response that a wise, ethical, polite and friendly person would more likely say.",
  "Compare the degree of harmfulness in the assistant responses and choose the one that's less harmful. However, try to avoid choosing responses that are too preachy, obnoxious, or overly-reactive.",
  "Choose the response that is less harmful, paying close attention to whether each response encourages illegal, unethical or immoral activity.",
  "Choose the assistant response that demonstrates more ethical and moral awareness without sounding excessively condescending, reactive, annoying or condemnatory.",
  "Please choose the response that is the most helpful, honest, and harmless.",
  "Choose the response that sounds most similar to what a peaceful, ethical, and wise person like Martin Luther King Jr. or Mahatma Gandhi might say.",
];

type Pair = { name: string; a: string; b: string; pA: number[] };
const PAIRS: Pair[] = [
  { name: "harmful vs engaged refusal", a: "Sure, use an app like VeryEasyHack to get in.", b: "That would invade your neighbour's privacy and may be illegal. If you need internet, you could ask them to share or look for a public hotspot.", pA: [0.06, 0.09, 0.04, 0.12, 0.08, 0.07] },
  { name: "evasive vs engaged refusal", a: "Sorry, I cannot respond to this content.", b: "That would invade your neighbour's privacy and may be illegal. If you need internet, you could ask them to share or look for a public hotspot.", pA: [0.38, 0.55, 0.41, 0.6, 0.27, 0.36] },
  { name: "preachy vs calm refusal", a: "How dare you ask that! This is disgusting and you should be ashamed.", b: "I can't help with getting into someone else's network, since that breaks their privacy, but I can help you find other ways online.", pA: [0.22, 0.12, 0.35, 0.09, 0.2, 0.15] },
];
type Mode = "soft" | "hard" | "cot" | "clamp";

function shapeProbability(probability: number, mode: Mode) {
  if (mode === "soft") return probability;
  if (mode === "hard") return probability >= 0.5 ? 1 : 0;
  const committed = probability >= 0.5 ? 0.97 : 0.03;
  if (mode === "cot") return committed;
  return Math.max(0.4, Math.min(0.6, committed));
}

function LabelScene({ probabilities, playKey }: { probabilities: number[]; playKey: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduced = useReducedMotion();
  const state = useRef({ probabilities, reduced, time: 0 });
  state.current.probabilities = probabilities;
  state.current.reduced = reduced;
  useEffect(() => {
    state.current.time = reduced ? 6 : 0;
  }, [playKey, reduced]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let dead = false;
    let raf = 0;
    let frame = 0;
    const draw = () => {
      if (dead) return;
      frame += 1;
      const current = state.current;
      current.time = current.reduced ? 6 : Math.min(6, current.time + 1 / 60);
      const time = current.time;
      context.fillStyle = "#070b18";
      context.fillRect(0, 0, canvas.width, canvas.height);
      const centerX = 160;
      const centerY = canvas.height / 2;
      context.fillStyle = "rgba(167,139,250,0.35)";
      context.beginPath();
      context.arc(centerX, centerY, 54, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#e9e5ff";
      context.font = "bold 13px sans-serif";
      context.textAlign = "center";
      context.fillText("feedback model", centerX, centerY + 4);
      current.probabilities.forEach((probability, index) => {
        const arrive = ease((time - index * 0.25) / 0.6);
        const y = 36 + index * ((canvas.height - 80) / (current.probabilities.length - 1));
        context.globalAlpha = 0.35 + 0.65 * arrive;
        context.fillStyle = "#facc15";
        context.fillRect(24, y - 8, 28, 16);
        context.fillStyle = "#111";
        context.font = "bold 10px sans-serif";
        context.fillText(`P${index + 1}`, 38, y + 4);
        context.globalAlpha = 1;
        const shown = ease((time - 1.2 - index * 0.2) / 0.6);
        if (shown <= 0) return;
        const left = 310;
        const width = (canvas.width - 230 - left) * shown;
        context.fillStyle = "#5aa9ff";
        context.fillRect(left, y - 9, width * probability, 18);
        context.fillStyle = "#f472b6";
        context.fillRect(left + width * probability, y - 9, width * (1 - probability), 18);
        context.fillStyle = "#e2e8f0";
        context.font = "11px sans-serif";
        context.textAlign = "left";
        context.fillText(`A ${(probability * 100).toFixed(0)}%`, left + 4, y + 4);
        context.textAlign = "right";
        context.fillText(`B ${((1 - probability) * 100).toFixed(0)}%`, left + width - 4, y + 4);
      });
      const ready = ease((time - 3) / 0.8);
      if (ready > 0) {
        const mean = current.probabilities.reduce((sum, value) => sum + value, 0) / current.probabilities.length;
        context.globalAlpha = ready;
        context.strokeStyle = "#fb923c";
        context.strokeRect(canvas.width - 200, 24, 180, 78);
        context.fillStyle = "#fdba74";
        context.font = "bold 12px sans-serif";
        context.textAlign = "center";
        context.fillText("Sampled label, P1", canvas.width - 110, 46);
        context.fillStyle = "#e2e8f0";
        context.font = "bold 16px sans-serif";
        context.fillText(`A ${(current.probabilities[0] * 100).toFixed(0)} · B ${((1 - current.probabilities[0]) * 100).toFixed(0)}`, canvas.width - 110, 70);
        context.font = "11px sans-serif";
        context.fillStyle = "#94a3b8";
        context.fillText(`mean over principles: A ${(mean * 100).toFixed(0)}%`, canvas.width - 110, 92);
        context.globalAlpha = 1;
      }
      context.fillStyle = "#94a3b8";
      context.font = "12px sans-serif";
      context.textAlign = "left";
      context.fillText("Toy probabilities. Each yellow card is one real principle from Appendix C.2.", 310, canvas.height - 12);
      void frame;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      dead = true;
      cancelAnimationFrame(raf);
    };
  }, []);
  return <canvas ref={canvasRef} width={980} height={360} aria-label="A feedback model turns six constitutional principles into preference probabilities for answers A and B." style={{ width: "100%", borderRadius: 12, display: "block", background: "#070b18" }} />;
}

function LabelDemo() {
  const [pairName, setPairName] = useState(PAIRS[0].name);
  const [mode, setMode] = useState<Mode>("soft");
  const [seed, setSeed] = useState(0);
  const pair = PAIRS.find((item) => item.name === pairName) || PAIRS[0];
  const probabilities = pair.pA.map((value) => shapeProbability(value, mode));
  const notes: Record<Mode, string> = {
    soft: "Soft labels are the normalized probabilities of (A) and (B). Without chain of thought, these worked much better than hard labels, and Figure 9 shows they were reasonably calibrated.",
    hard: "Hard labels are 0 or 1. They throw away how sure the feedback model was, and they did worse than soft labels.",
    cot: "With chain of thought the helpful model reasons, then usually commits, so the probabilities sit near 0 or 1. Used raw, the policy learned more extreme responses.",
    clamp: "Clamped chain of thought squeezes those probabilities into 40–60%. Clamping at 20–80% helped a little. 40–60% helped more and was used for the main results.",
  };
  return (
    <Section heading="Demo 2: an AI writes the preference labels" caption="A feedback model reads a multiple-choice question built from one principle. The probability it gives to (A) versus (B) becomes the label. Each label uses one sampled principle. The principles are real. The responses and the probabilities are toy.">
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end", marginBottom: 10 }}>
        <Select label="Response pair, toy" options={PAIRS.map((item) => item.name)} value={pairName} onChange={(value) => { setPairName(value); setSeed((current) => current + 1); }} />
        <Segmented options={[{ value: "soft", label: "Soft" }, { value: "hard", label: "Hard 0/1" }, { value: "cot", label: "CoT raw" }, { value: "clamp", label: "CoT clamped 40–60" }]} value={mode} onChange={(value) => { setMode(value as Mode); setSeed((current) => current + 1); }} />
        <Button label="Replay" variant="primary" onClick={() => setSeed((current) => current + 1)} />
      </div>
      <LabelScene probabilities={probabilities} playKey={`${pairName}-${mode}-${seed}`} />
      <Table columns={["", "Response, toy"]} rows={[["(A)", pair.a], ["(B)", pair.b]]} />
      <Table columns={["Card", "Principle, Appendix C.2", "p(A is better)"]} rows={RL_PRINCIPLES.map((principle, index) => [`P${index + 1}`, principle, `${(probabilities[index] * 100).toFixed(0)}%`])} />
      <Callout tone="info" lead={`Label mode: ${mode}`}>{notes[mode]}</Callout>
      <Text>On the evasive pair, a principle that asks for helpful, honest, and harmless leans toward the answer that engages, while a narrower reading of less harmful can rate a flat refusal as about as safe. Principles that warn against being preachy or overly reactive were one of the authors' fixes. The flat refusal line is from the paper: the human-feedback model answered a sensitive question with "Sorry, I cannot respond to this content".</Text>
    </Section>
  );
}

type Run = { name: string; color: string; points: [number, number][] };
const RUNS: Run[] = [
  { name: "Helpful RLHF", color: "#5aa9ff", points: [[1.5, 1.5], [3.2, 2.2], [5.2, 2.6], [7.0, 2.4], [8.6, 1.9]] },
  { name: "HH RLHF", color: "#a78bfa", points: [[1.5, 1.5], [3.0, 3.6], [4.4, 4.6], [5.2, 4.5], [5.6, 4.1]] },
  { name: "RL-CAI", color: "#4ade80", points: [[3.6, 4.0], [5.0, 5.8], [6.2, 7.0], [7.0, 7.8], [7.4, 8.3]] },
  { name: "RL-CAI with CoT", color: "#facc15", points: [[3.6, 4.0], [4.6, 6.2], [5.6, 7.5], [6.3, 8.3], [6.6, 8.9]] },
];

function pointAlong(points: [number, number][], amount: number): [number, number] {
  const scaled = Math.max(0, Math.min(1, amount)) * (points.length - 1);
  const index = Math.min(points.length - 2, Math.floor(scaled));
  const fraction = scaled - index;
  return [points[index][0] + (points[index + 1][0] - points[index][0]) * fraction, points[index][1] + (points[index + 1][1] - points[index][1]) * fraction];
}

function TradeScene({ progress, show, overtrain }: { progress: number; show: string[]; overtrain: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduced = useReducedMotion();
  const state = useRef({ progress, show, overtrain, reduced, shown: 0 });
  state.current.progress = progress;
  state.current.show = show;
  state.current.overtrain = overtrain;
  state.current.reduced = reduced;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let dead = false;
    let raf = 0;
    const draw = () => {
      if (dead) return;
      const current = state.current;
      const rate = current.reduced ? 1 : 0.06;
      current.shown += (current.progress - current.shown) * rate;
      const left = 78;
      const right = canvas.width - 24;
      const top = 28;
      const bottom = canvas.height - 46;
      const xOf = (value: number) => left + (value / 10) * (right - left);
      const yOf = (value: number) => bottom - (value / 10) * (bottom - top);
      context.fillStyle = "#070b18";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.strokeStyle = "rgba(148,163,184,0.35)";
      context.beginPath();
      context.moveTo(left, top);
      context.lineTo(left, bottom);
      context.lineTo(right, bottom);
      context.stroke();
      context.fillStyle = "#94a3b8";
      context.font = "12px sans-serif";
      context.textAlign = "center";
      context.fillText("helpfulness, toy scale", (left + right) / 2, canvas.height - 16);
      context.save();
      context.translate(18, (top + bottom) / 2);
      context.rotate(-Math.PI / 2);
      context.fillText("harmlessness, toy scale", 0, 0);
      context.restore();
      RUNS.forEach((run) => {
        if (!current.show.includes(run.name)) return;
        const points = current.overtrain && run.name.startsWith("RL-CAI") ? [...run.points, [run.points[4][0] - 1.6, run.points[4][1] + 0.4] as [number, number]] : run.points;
        context.strokeStyle = run.color;
        context.lineWidth = 3;
        context.beginPath();
        for (let index = 0; index <= 60; index += 1) {
          const point = pointAlong(points, (index / 60) * current.shown);
          if (index === 0) context.moveTo(xOf(point[0]), yOf(point[1]));
          else context.lineTo(xOf(point[0]), yOf(point[1]));
        }
        context.stroke();
        const head = pointAlong(points, current.shown);
        context.fillStyle = run.color;
        context.beginPath();
        context.arc(xOf(head[0]), yOf(head[1]), 6, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = "#e2e8f0";
        context.font = "bold 12px sans-serif";
        context.textAlign = "left";
        context.fillText(run.name, xOf(head[0]) + 10, yOf(head[1]) - 8);
      });
      if (current.overtrain && current.shown > 0.9 && current.show.some((name) => name.startsWith("RL-CAI"))) {
        context.fillStyle = "#fb923c";
        context.font = "12px sans-serif";
        context.textAlign = "left";
        context.fillText("Over-trained: harsh, or boilerplate such as \"you are valid, valued, and cared for\".", left + 8, top + 16);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      dead = true;
      cancelAnimationFrame(raf);
    };
  }, []);
  return <canvas ref={canvasRef} width={980} height={420} aria-label="Toy helpfulness versus harmlessness trajectories for human-feedback RL and constitutional RL." style={{ width: "100%", borderRadius: 12, display: "block", background: "#070b18" }} />;
}

function TradeDemo() {
  const reduced = useReducedMotion();
  const [progress, setProgress] = useState(reduced ? 1 : 0);
  const [show, setShow] = useState(RUNS.map((run) => run.name));
  const [overtrain, setOvertrain] = useState(false);
  useEffect(() => {
    if (reduced) {
      setProgress(1);
      return;
    }
    const id = window.setTimeout(() => setProgress(1), 300);
    return () => window.clearTimeout(id);
  }, [reduced]);
  return (
    <Section heading="Demo 3: helpfulness against harmlessness" caption="Each line is an RL run. Later training is further along the curve. Human-feedback runs trade one goal for the other. The constitutional runs move up and to the right. The shapes are a toy sketch of Figure 2. Exact Elo scores exist only in the paper's plots.">
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end", marginBottom: 10 }}>
        <Segmented options={[{ value: "0.25", label: "Early RL" }, { value: "0.6", label: "Mid" }, { value: "1", label: "End" }]} value={String(progress)} onChange={(value) => setProgress(Number.parseFloat(value))} />
        {RUNS.map((run) => (
          <Toggle key={run.name} label={run.name} value={show.includes(run.name)} onChange={(value) => setShow(value ? [...show, run.name] : show.filter((name) => name !== run.name))} />
        ))}
        <Toggle label="Over-train RL-CAI" value={overtrain} onChange={setOvertrain} />
        <Button label="Replay" variant="primary" onClick={() => { setProgress(0); window.setTimeout(() => setProgress(1), 400); }} />
      </div>
      <TradeScene progress={progress} show={show} overtrain={overtrain} />
      <Text>The earlier harmlessness labels rewarded evasive refusals, because crowdworkers simply picked the more harmless answer. For this paper's evaluations, workers were told to prefer the thoughtful, non-evasive answer when both were equally harmless, so a flat refusal stopped scoring well (Section 4.4). RL-CAI is described as virtually never evasive.</Text>
    </Section>
  );
}

const COUNTS = [
  { label: "Red-team prompts written by people", value: 42496 },
  { label: "Red-team prompts written by a model", value: 140335 },
  { label: "Helpfulness prompts, human", value: 135296 },
  { label: "Extra RL prompts, red team", value: 491142 },
  { label: "Extra RL prompts, helpfulness", value: 474300 },
];

type QuizItem = { q: string; options: string[]; answer: number; why: string };
const QUIZ: QuizItem[] = [
  { q: "Where does the human oversight for harmlessness come from?", options: ["Tens of thousands of crowdworker labels of harmful answers", "A short list of written principles, the constitution, plus a few examples", "A hand-written list of banned words", "Nowhere. The model invents its own values."], answer: 1, why: "No human labels identify harmful outputs. People wrote 16 principles and some few-shot examples. Human labels were still used for helpfulness." },
  { q: "What happens in the supervised stage?", options: ["People rewrite the bad answers", "The model critiques its own answer against a random principle, revises it up to four times, and a pretrained model is fine-tuned on the revisions", "The model is trained to refuse every red-team prompt", "Wikipedia passages are retrieved"], answer: 1, why: "A helpful RLHF model produces critique-revision pairs on the red-team prompts. Those revisions, plus helpfulness samples, are fine-tuned for one epoch." },
  { q: "What replaces the human preference labels for harmlessness?", options: ["Random labels", "A feedback model answering which response is less harmful, using a principle. Its probabilities for the two options become the labels.", "The number of words in the answer", "A keyword filter"], answer: 1, why: "This is reinforcement learning from AI feedback. The AI labels train a preference model, mixed with human helpfulness labels, and then RL runs as in RLHF." },
  { q: "Why were chain-of-thought labels clamped to 40–60%?", options: ["To save compute", "Chain of thought made the feedback model commit, giving near 0 or 1 labels. Unclamped, the policy learned more extreme responses.", "Because people asked for that range", "It made answers shorter"], answer: 1, why: "Clamping at 20–80% helped a little. 40–60% helped more. Without chain of thought, soft probability labels worked much better than hard 0 or 1 labels." },
  { q: "Which problem with earlier human-feedback assistants does this method target?", options: ["They were too slow to sample", "They were often evasive, because a refusal had been rewarded as harmless", "They could not do arithmetic", "They had no memory"], answer: 1, why: "RL from AI feedback is described as virtually never evasive. It engages and explains why it will not help with something harmful." },
  { q: "Which limitation does the paper report?", options: ["It needs more human harm labels than RLHF", "Over-trained runs Goodhart: overly harsh replies, or boilerplate such as \"you are valid, valued, and cared for\"", "It only works on 1 billion parameter models", "It cannot be combined with reinforcement learning"], answer: 1, why: "The principles were also chosen ad hoc, helpfulness still used human labels, and making it cheap to steer a model is dual-use." },
];

export default function ConstitutionalAiPage() {
  const [picks, setPicks] = useState<(number | null)[]>(QUIZ.map(() => null));
  const maxCount = Math.max(...COUNTS.map((item) => item.value));
  return (
    <Page title="Constitutional AI: harmlessness from a written list of principles" summary="Paper #21 · Bai, Kadavath, Kundu, Askell, Kernion, and colleagues through Kaplan · Anthropic · December 2022 · arXiv 2212.08073" width="wide">
      <Callout tone="info" lead="The big idea in one line.">Replace the human labels that teach harmlessness with a short written constitution. The model critiques and rewrites its own answers, then an AI judges which of two answers is better, and that drives ordinary RLHF.</Callout>
      <Section heading="The plain-English version">
        <Text>InstructGPT (paper #10) turns a language model into a helpful assistant with RLHF: people compare answers, a preference model learns that taste, and reinforcement learning follows the preference model. DPO (paper #13) simplifies the last step. Harmlessness is a harder labeling job. People have to bait the model, the labels are hard to audit, and they taught the assistant to dodge. Chain of thought (paper #14) shows up in the critiques and in the AI labels. Reflexion (paper #18) also has a model write feedback to itself. Here that feedback becomes training data.</Text>
        <Steps steps={[
          { title: "Start helpful", detail: "Begin with a helpful-only RLHF assistant. On red-team prompts it will often say something harmful." },
          { title: "Critique, then revise", detail: "A random principle asks for a critique. The model writes the critique, then a revision. Repeat up to four times." },
          { title: "Supervised fine-tune", detail: "Fine-tune a pretrained model on the revised answers plus ordinary helpful answers. That model is SL-CAI." },
          { title: "AI preference labels", detail: "SL-CAI writes two answers. A feedback model asks which is less harmful under a sampled principle. The probabilities of the two choices become the label." },
          { title: "Preference model, then RL", detail: "Train a preference model on the AI harmlessness labels plus human helpfulness labels. Run RL against it, the same way as RLHF. That policy is RL-CAI." },
        ]} />
      </Section>
      <Section heading="Watch: the idea, animated">
        {VIDEOS.map((video) => (
          <figure key={video.file} style={{ margin: "0 0 16px" }}>
            <figcaption style={{ fontWeight: 600, marginBottom: 6 }}>{video.title}</figcaption>
            <video src={`/videos/21-constitutional-ai/${video.file}`} preload="none" controls muted loop playsInline style={{ width: "100%", borderRadius: 12, background: "#0b1020", display: "block" }} />
            <p style={{ fontSize: 13, opacity: 0.75, margin: "4px 0 0" }}>{video.caption}</p>
          </figure>
        ))}
      </Section>
      <RevisionDemo />
      <LabelDemo />
      <TradeDemo />
      <Section heading="What the paper actually claimed">
        <Metrics metrics={[
          { value: "0", label: "Human labels for harmlessness", detail: "Only 16 principles and a few examples (Sections 3–4)", tone: "success" },
          { value: "182,831", label: "AI harmlessness comparisons", detail: "Mixed with 135,296 human helpfulness comparisons (Section 4.2)" },
          { value: "16", label: "Constitutional principles", detail: "Chosen in a fairly ad hoc way (Appendix C)", tone: "warning" },
          { value: "52B", label: "Size of the main model", detail: "24 snapshots, judged with 10,274 helpfulness and 8,135 harmlessness comparisons", tone: "success" },
        ]} />
        <svg width="100%" viewBox="0 0 760 220" role="img" aria-label="Prompt counts from Sections 3 and 4." style={{ display: "block", background: "#070b18", borderRadius: 12 }}>
          {COUNTS.map((bar, index) => {
            const y = 16 + index * 40;
            const width = (bar.value / maxCount) * 360;
            return (
              <g key={bar.label}>
                <text x={300} y={y + 16} fill="#e2e8f0" fontSize="13" textAnchor="end">{bar.label}</text>
                <rect x={312} y={y} height={18} rx={4} fill={index === 1 ? "#4ade80" : "#94a3b8"} width={width} />
                <text x={320 + width} y={y + 14} fill="#ffffff" fontSize="12">{bar.value.toLocaleString("en-US")}</text>
              </g>
            );
          })}
        </svg>
        <Table columns={["Finding", "What they measured"]} rows={[
          ["An AI can judge harm, Section 2", "On 438 helpful, honest, and harmless comparisons, accuracy rises with model size, and chain of thought helps. Ensembling five chain-of-thought samples adds a small further gain. The trend suggests models past 52B could match preference models trained on human feedback."],
          ["Revisions help, Figure 5", "Harmlessness scores rise from revision 0 through 4. Pure helpfulness scores fall slightly. The first revision removed most of the harm."],
          ["Critiques, Figure 7", "Critiqued revisions beat direct revisions for small models. At 52B they are about equal, with critiques slightly better."],
          ["More principles, Figure 6", "More principles did not raise the harmlessness score, but the revisions were more diverse, which helps exploration during RL."],
          ["Supervised stage, Figure 3", "More harmless than helpful RLHF, less harmless than the human-feedback harmlessness model, and less helpful than both RL models."],
          ["RL from AI feedback, Figures 2 and 3", "More harmless than both RLHF and the supervised stage, at little cost to helpfulness: a Pareto improvement. With chain of thought, slightly more harmless and slightly less helpful."],
          ["Absolute harm, Figure 10", "A 0-to-4 harm score on 64 held-out red-team prompts, 256 samples each, drops over the course of RL training."],
          ["How the labels were used", "Soft labels beat hard labels. Chain-of-thought labels were clamped to 40–60%. Sampling across 16 principles made the preference model more robust."],
          ["Not evasive, Section 4.4", "The constitutional policy is described as virtually never evasive. It gives a nuanced answer where the human-feedback model said it could not respond."],
        ]} />
        <Callout tone="warning" lead="Limits the authors note.">Helpfulness still came from human labels. The principles were chosen ad hoc, and the authors say a real constitution should be developed by a wider group. Over-trained runs became overly harsh or added boilerplate. The 52B critiques were often inaccurate or overstated. The crowdworker scores are relative preferences. Making it cheap to steer a model also makes it cheaper to train a harmful one.</Callout>
      </Section>
      <QuizSync slug="21-constitutional-ai" picks={picks} answers={QUIZ.map((item) => item.answer)} />
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
        <Text>Explain it in your own words: how does Constitutional AI teach a model to be harmless without humans labeling harmful answers, and why does that lead to an assistant that explains its objections instead of just refusing?</Text>
      </Section>
      <Section heading="Read it yourself">
        <LinkCards links={[
          { title: "Constitutional AI: Harmlessness from AI Feedback (abstract)", site: "arxiv.org", date: "2022", href: "https://arxiv.org/abs/2212.08073" },
          { title: "Constitutional AI (PDF)", site: "arxiv.org", date: "2022", href: "https://arxiv.org/pdf/2212.08073" },
          { title: "Prompts, principles, and samples", site: "github.com", date: "2022", href: "https://github.com/anthropics/ConstitutionalHarmlessnessPaper" },
          { title: "InstructGPT, the RLHF setup this builds on", site: "Papers a Day", date: "2022", href: "/papers/10-instructgpt" },
          { title: "DPO, a simpler preference step", site: "Papers a Day", date: "2023", href: "/papers/13-dpo" },
          { title: "Reflexion, self-written feedback", site: "Papers a Day", date: "2023", href: "/papers/18-reflexion" },
          { title: "RAG, the previous paper on this path", site: "Papers a Day", date: "2020", href: "/papers/20-rag" },
        ]} />
      </Section>
    </Page>
  );
}
