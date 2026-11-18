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

// Demos 1–3 use toy vectors and toy probabilities. The questions, the written answers, and the hot-swap percentages are from the paper.

const VIDEOS = [
  {
    file: "RetrieveTopK.mp4",
    title: "Look it up, then write",
    caption:
      "Figure 1 on the paper's own example, \"define middle ear\": BERT encodes the question, maximum inner product search finds the closest passages, and BART writes from the question plus each passage. The final sentence is RAG-Sequence's real Table 3 answer. Point positions in the clip are illustrative.",
  },
  {
    file: "SequenceVsToken.mp4",
    title: "RAG-Sequence versus RAG-Token",
    caption:
      "RAG-Sequence lets one document write the whole answer, then averages over documents. RAG-Token remixes documents at every word. The Hemingway shape follows Figure 2. Jeopardy Q-BLEU-1 from Table 2: BART 19.7, RAG-Sequence 21.4, RAG-Token 22.2.",
  },
  {
    file: "HotSwapIndex.mp4",
    title: "Swap the index, update the knowledge",
    caption:
      "Replacing the December 2018 Wikipedia index with a December 2016 one changes which world leaders the same model names, with no retraining (Section 4.5). Then the Natural Questions scores from Table 1.",
  },
];

function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

type Vec3 = [number, number, number];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function softmax(values: number[], temperature = 1) {
  const peak = Math.max(...values);
  const exponents = values.map((value) => Math.exp((value - peak) / temperature));
  const total = exponents.reduce((sum, value) => sum + value, 0);
  return exponents.map((value) => value / total);
}

type Topic = { key: string; name: string; color: string; center: Vec3; passages: string[] };
const TOPICS: Topic[] = [
  { key: "ear", name: "ear anatomy", color: "#5aa9ff", center: [2.2, 1.4, 0.6], passages: ["The middle ear is the portion of the ear internal to the eardrum.", "The three ossicles (malleus, incus, stapes) sit in the middle ear's tympanic cavity.", "The eardrum separates the outer ear from the middle ear.", "The cochlea in the inner ear turns vibrations into nerve signals.", "Infection of the middle ear is called otitis media."] },
  { key: "scot", name: "Scotland and money", color: "#4ade80", center: [-2.0, 1.6, 1.2], passages: ["The pound sterling is the currency of the United Kingdom, including Scotland.", "Three Scottish banks issue their own sterling banknotes.", "Scotland is a country that is part of the United Kingdom.", "Edinburgh is the capital of Scotland.", "The euro is used by many EU countries, but not by the UK."] },
  { key: "wash", name: "Washington state", color: "#fb923c", center: [0.4, -1.6, 2.2], passages: ["Washington is the only U.S. state named after a U.S. president.", "Mount Rainier National Park is in Washington state.", "Olympia is the capital of Washington state.", "Seattle is the largest city in Washington state.", "Washington, D.C., the U.S. capital, is not part of any state."] },
  { key: "hem", name: "Hemingway", color: "#f472b6", center: [-1.8, -1.2, -1.6], passages: ["His debut novel, \"The Sun Also Rises\", was published in 1926.", "His wartime experiences formed the basis for \"A Farewell to Arms\" (1929).", "Hemingway won the Nobel Prize in Literature in 1954.", "\"The Old Man and the Sea\" was published in 1952.", "He was part of the 1920s \"Lost Generation\" expatriates in Paris."] },
  { key: "dante", name: "Dante", color: "#a78bfa", center: [1.6, 0.2, -2.3], passages: ["The Divine Comedy is divided into Inferno, Purgatorio and Paradiso.", "Dante Alighieri wrote the Divine Comedy in the 14th century.", "In the poem, Virgil guides Dante through Hell and Purgatory.", "Beatrice guides Dante through Paradise.", "Dante was born in Florence around 1265."] },
  { key: "misc", name: "everything else", color: "#94a3b8", center: [0, 0.6, -0.3], passages: ["The FIFA World Cup is held every four years.", "Water boils at 100 °C at sea level.", "Photosynthesis turns light into chemical energy in plants.", "Mount Everest is the highest mountain above sea level.", "The Great Wall of China is thousands of kilometres long."] },
];

type Passage = { text: string; topic: number; v: Vec3 };
const PASSAGES: Passage[] = (() => {
  const random = rng(20);
  const output: Passage[] = [];
  TOPICS.forEach((topic, topicIndex) => {
    topic.passages.forEach((text, index) => {
      const jitter = (scale: number) => (random() - 0.5) * scale;
      const spread = topicIndex === 5 ? 2.4 : 0.9;
      const pull = 1 - index * 0.06;
      output.push({
        text,
        topic: topicIndex,
        v: [topic.center[0] * pull + jitter(spread), topic.center[1] * pull + jitter(spread), topic.center[2] * pull + jitter(spread)],
      });
    });
  });
  return output;
})();

type Query = { name: string; text: string; task: string; v: Vec3; real: string; source: string; bart: string };
const QUERIES: Query[] = [
  { name: "define middle ear", text: "define middle ear", task: "MS-MARCO, abstractive QA", v: [2.4, 1.5, 0.5], real: "The middle ear includes the tympanic cavity and the three ossicles.", source: "RAG-Sequence, Table 3", bart: "The middle ear is the part of the ear between the middle ear and the nose." },
  { name: "what currency needed in scotland", text: "what currency needed in scotland", task: "MS-MARCO, abstractive QA", v: [-2.1, 1.7, 1.0], real: "The currency needed in Scotland is the pound sterling.", source: "RAG-Sequence, Table 3", bart: "The currency needed in Scotland is Pound sterling." },
  { name: "Washington (Jeopardy)", text: "Washington", task: "Jeopardy question generation", v: [0.5, -1.7, 2.3], real: "It's the only U.S. state named for a U.S. president", source: "RAG-Token, Table 3", bart: "This state has the largest number of counties in the U.S." },
  { name: "Hemingway (Jeopardy)", text: "Hemingway", task: "Jeopardy question generation", v: [-1.9, -1.3, -1.7], real: "\"The Sun Also Rises\" is a novel by this author of \"A Farewell to Arms\"", source: "RAG-Token, Figure 2", bart: "No BART-only output is given. The paper shows BART can finish a title once it is given the title's first word (Section 4.3)." },
  { name: "The Divine Comedy (Jeopardy)", text: "The Divine Comedy", task: "Jeopardy question generation", v: [1.7, 0.3, -2.4], real: "This 14th century work is divided into 3 sections: \"Inferno\", \"Purgatorio\" & \"Paradiso\"", source: "RAG-Sequence, Table 3", bart: "This epic poem by Dante is divided into 3 parts: the Inferno, the Purgatorio & the Purgatorio" },
];

function rankQuery(query: Vec3) {
  return PASSAGES.map((passage, index) => ({ index, score: dot(passage.v, query) })).sort((a, b) => b.score - a.score);
}

function ease(value: number) {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
}

function SpaceScene({ query, k, playKey }: { query: Query; k: number; playKey: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const labelsRef = useRef<HTMLDivElement | null>(null);
  const statusRef = useRef<HTMLParagraphElement | null>(null);
  const reduced = useReducedMotion();
  const live = useRef({ query, k, playKey, reduced, time: 0 });
  live.current.query = query;
  live.current.k = k;
  live.current.reduced = reduced;
  useEffect(() => {
    live.current.playKey = playKey;
    live.current.time = reduced ? 8 : 0;
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
      scene.add(new THREE.AmbientLight(0xffffff, 0.85));
      const light = new THREE.DirectionalLight(0xffffff, 0.7);
      light.position.set(4, 8, 6);
      scene.add(light);
      const geometry = new THREE.SphereGeometry(0.11, 18, 14);
      const spheres = PASSAGES.map((passage) => {
        const color = new THREE.Color(TOPICS[passage.topic].color);
        const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.12, roughness: 0.45 }));
        mesh.position.set(passage.v[0], passage.v[1], passage.v[2]);
        scene.add(mesh);
        return mesh;
      });
      const queryLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
        new THREE.LineBasicMaterial({ color: 0xfacc15 }),
      );
      const queryDot = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
      scene.add(queryLine, queryDot);
      const beams = Array.from({ length: 10 }, () => {
        const line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
          new THREE.LineBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.7 }),
        );
        line.visible = false;
        scene.add(line);
        return line;
      });
      [[3.4, 0, 0], [0, 3.4, 0], [0, 0, 3.4]].forEach((axis) => {
        scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-axis[0], -axis[1], -axis[2]), new THREE.Vector3(axis[0], axis[1], axis[2])]), new THREE.LineBasicMaterial({ color: 0x334155 })));
      });
      const html = Array.from({ length: 11 }, () => {
        const el = document.createElement("div");
        el.style.cssText = "position:absolute;transform:translate(-50%,-150%);color:#f8fafc;font:600 13px sans-serif;text-shadow:0 1px 3px #000;white-space:nowrap;";
        labelLayer.appendChild(el);
        return el;
      });
      const projector = new THREE.Vector3();
      const place = (el: HTMLDivElement, x: number, y: number, z: number, text: string, lift = 0) => {
        if (!text) {
          el.style.display = "none";
          return;
        }
        projector.set(x, y, z).project(camera);
        el.style.display = projector.z < 1 ? "block" : "none";
        el.textContent = text;
        el.style.left = `${(projector.x * 0.5 + 0.5) * canvas.clientWidth + (lift % 2 === 0 ? 18 : -18)}px`;
        el.style.top = `${(-projector.y * 0.5 + 0.5) * canvas.clientHeight - lift * 14}px`;
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
      let yaw = 0.7;
      let pitch = 0.34;
      let drag: { x: number; y: number } | null = null;
      const down = (event: PointerEvent) => {
        drag = { x: event.clientX, y: event.clientY };
        canvas.setPointerCapture(event.pointerId);
      };
      const move = (event: PointerEvent) => {
        if (!drag) return;
        yaw -= (event.clientX - drag.x) * 0.008;
        pitch = Math.max(-0.2, Math.min(1.1, pitch + (event.clientY - drag.y) * 0.005));
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
        if (current.reduced) current.time = 8;
        else current.time = Math.min(8, current.time + 1 / 60);
        const time = current.time;
        const grow = ease((time - 0.1) / 0.9);
        const reveal = ease((time - 2.4) / 1);
        const ranked = rankQuery(current.query.v);
        const top = new Map(ranked.slice(0, current.k).map((item, order) => [item.index, order]));
        spheres.forEach((mesh, index) => {
          const chosen = top.has(index);
          const material = mesh.material as import("three").MeshStandardMaterial;
          material.emissiveIntensity = chosen ? 0.2 + 0.7 * reveal : 0.08;
          material.opacity = chosen ? 1 : 0.45;
          material.transparent = true;
          mesh.scale.setScalar(chosen ? 1 + 0.7 * reveal : 1);
        });
        const tip = new THREE.Vector3(current.query.v[0] * grow, current.query.v[1] * grow, current.query.v[2] * grow);
        const positions = queryLine.geometry.attributes.position as import("three").BufferAttribute;
        positions.setXYZ(1, tip.x, tip.y, tip.z);
        positions.needsUpdate = true;
        queryDot.position.copy(tip);
        beams.forEach((beam, order) => {
          const hit = ranked[order];
          const show = reveal > 0.02 && order < current.k && hit;
          beam.visible = Boolean(show);
          if (!show || !hit) return;
          const passage = PASSAGES[hit.index].v;
          const attribute = beam.geometry.attributes.position as import("three").BufferAttribute;
          attribute.setXYZ(0, tip.x, tip.y, tip.z);
          attribute.setXYZ(1, passage[0], passage[1], passage[2]);
          attribute.needsUpdate = true;
          (beam.material as import("three").LineBasicMaterial).opacity = 0.75 * reveal * (1 - order * 0.05);
        });
        if (!drag && !current.reduced) yaw += 0.003;
        const distance = Math.max(9.5, 8.2 / Math.max(camera.aspect, 0.7));
        camera.position.set(Math.sin(yaw) * distance, 1.6 + Math.sin(pitch) * 2.2, Math.cos(yaw) * distance);
        camera.lookAt(0, 0.2, 0);
        ranked.slice(0, current.k).forEach((item, order) => {
          const passage = PASSAGES[item.index].v;
          place(html[order], passage[0], passage[1] + 0.25, passage[2], reveal > 0.45 ? `z${order + 1}` : "", order);
        });
        for (let extra = current.k; extra < 10; extra += 1) place(html[extra], 0, 0, 0, "");
        place(html[10], tip.x, tip.y + 0.28, tip.z, grow > 0.2 ? `q("${current.query.text}")` : "");
        if (statusRef.current) {
          statusRef.current.textContent = time < 1 ? "1 · The query encoder turns the question into a vector." : time < 2.4 ? "2 · Maximum inner product search scores every passage by its dot product with the query." : `3 · Keep the top ${current.k} passages and hand them to the generator.`;
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
        geometry.dispose();
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
      <canvas ref={canvasRef} aria-label="Toy embedding space. Passages are points. A query vector grows from the origin, and the closest passages light up." style={{ width: "100%", height: 500, display: "block", borderRadius: 12, cursor: "grab", touchAction: "none", background: "#060a14" }} />
      <div ref={labelsRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }} />
      <p ref={statusRef} className="viz-note">The query encoder turns the question into a vector.</p>
    </div>
  );
}

function SpaceDemo() {
  const [name, setName] = useState(QUERIES[0].name);
  const [k, setK] = useState("5");
  const [seed, setSeed] = useState(0);
  const query = QUERIES.find((item) => item.name === name) || QUERIES[0];
  const keep = Number.parseInt(k, 10);
  const ranked = rankQuery(query.v).slice(0, keep);
  const probabilities = softmax(ranked.map((item) => item.score), 1.5);
  const rows = ranked.map((item, order) => [`z${order + 1}`, PASSAGES[item.index].text, TOPICS[PASSAGES[item.index].topic].name, item.score.toFixed(2), probabilities[order].toFixed(2)]);
  return (
    <Section heading="Demo 1: find the closest passages" caption="Each passage is a point, its vector d(z). The question becomes a vector q(x). The score is the dot product, and maximum inner product search returns the K highest. The questions and the written answers are from the paper. The vectors, the 30 passages, and the scores are a toy picture of a 768-dimensional index of 21 million chunks.">
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end", marginBottom: 10 }}>
        <Select label="Question" options={QUERIES.map((item) => item.name)} value={name} onChange={(value) => { setName(value); setSeed((count) => count + 1); }} />
        <Segmented options={[{ value: "1", label: "K = 1" }, { value: "3", label: "K = 3" }, { value: "5", label: "K = 5" }, { value: "10", label: "K = 10" }]} value={k} onChange={(value) => { setK(value); setSeed((count) => count + 1); }} />
        <Button label="Replay" variant="primary" onClick={() => setSeed((count) => count + 1)} />
      </div>
      <SpaceScene query={query} k={keep} playKey={`${name}-${k}-${seed}`} />
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
        {TOPICS.map((topic) => (
          <span key={topic.key} style={{ fontSize: 13 }}>
            <span style={{ color: topic.color }}>●</span> {topic.name}
          </span>
        ))}
      </div>
      <Table columns={["", "Retrieved passage, toy", "Topic", "Score d(z)·q(x)", "p(z|x)"]} rows={rows} />
      <Callout tone="success" lead={`What RAG actually wrote (${query.source}) · ${query.task}`}>{query.real}</Callout>
      <Text>BART on its own, with no retrieval: {query.bart}</Text>
      <Text>Both encoders are BERT-base models from DPR. The passage encoder turned each of 21 million 100-word Wikipedia chunks, the December 2018 dump, into a vector once and stored them in FAISS. During fine-tuning only the query encoder and the generator learn. The passage vectors stay frozen, so the index does not have to be rebuilt.</Text>
    </Section>
  );
}

const ANSWERS = ["Canberra", "Sydney", "Melbourne"];
const DOCS = [
  { title: "z1", text: "Sydney is the largest city in Australia and home to the Opera House.", gen: [0.3, 0.62, 0.08] },
  { title: "z2", text: "Canberra is the capital city of Australia.", gen: [0.92, 0.05, 0.03] },
  { title: "z3", text: "Parliament House in Canberra opened in 1988.", gen: [0.7, 0.18, 0.12] },
];

function MarginalScene({ probabilities, mix }: { probabilities: number[]; mix: number[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduced = useReducedMotion();
  const state = useRef({ probabilities, mix, reduced });
  state.current = { probabilities, mix, reduced };
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let dead = false;
    let raf = 0;
    let frame = 0;
    const shown = { probabilities: [0, 0, 0], mix: [0, 0, 0] };
    const colors = ["#5aa9ff", "#4ade80", "#a78bfa"];
    const answerColors = ["#facc15", "#fb923c", "#f472b6"];
    const draw = () => {
      if (dead) return;
      frame += 1;
      const current = state.current;
      for (let index = 0; index < 3; index += 1) {
        const rate = current.reduced ? 1 : 0.1;
        shown.probabilities[index] += (current.probabilities[index] - shown.probabilities[index]) * rate;
        shown.mix[index] += (current.mix[index] - shown.mix[index]) * rate;
      }
      context.fillStyle = "#0b1020";
      context.fillRect(0, 0, canvas.width, canvas.height);
      const left = 150;
      const right = canvas.width - 210;
      const documentY = (index: number) => 70 + index * 100;
      const answerY = (index: number) => 70 + index * 100;
      DOCS.forEach((doc, docIndex) => {
        for (let answer = 0; answer < 3; answer += 1) {
          const weight = shown.probabilities[docIndex] * doc.gen[answer];
          context.strokeStyle = answerColors[answer];
          context.globalAlpha = 0.15 + 0.85 * Math.min(1, weight * 2.2);
          context.lineWidth = 1 + 34 * weight;
          context.beginPath();
          context.moveTo(left + 20, documentY(docIndex));
          context.bezierCurveTo((left + right) / 2, documentY(docIndex), (left + right) / 2, answerY(answer), right - 20, answerY(answer));
          context.stroke();
          if (!current.reduced) {
            const count = Math.round(weight * 8);
            for (let particle = 0; particle < count; particle += 1) {
              const u = ((frame / 140) + particle / Math.max(1, count) + docIndex * 0.13) % 1;
              const mid = (left + right) / 2;
              const x = (1 - u) ** 3 * (left + 20) + 3 * (1 - u) ** 2 * u * mid + 3 * (1 - u) * u ** 2 * mid + u ** 3 * (right - 20);
              const y = (1 - u) ** 3 * documentY(docIndex) + 3 * (1 - u) ** 2 * u * documentY(docIndex) + 3 * (1 - u) * u ** 2 * answerY(answer) + u ** 3 * answerY(answer);
              context.globalAlpha = 0.9;
              context.fillStyle = "#ffffff";
              context.beginPath();
              context.arc(x, y, 2, 0, Math.PI * 2);
              context.fill();
            }
          }
          context.globalAlpha = 1;
        }
        context.fillStyle = colors[docIndex];
        context.beginPath();
        context.arc(left, documentY(docIndex), 12 + 18 * shown.probabilities[docIndex], 0, Math.PI * 2);
        context.fill();
        context.fillStyle = "#e2e8f0";
        context.font = "bold 13px sans-serif";
        context.textAlign = "right";
        context.fillText(`${doc.title}  ${shown.probabilities[docIndex].toFixed(2)}`, left - 28, documentY(docIndex) + 4);
      });
      ANSWERS.forEach((answer, index) => {
        context.fillStyle = answerColors[index];
        context.fillRect(right, answerY(index) - 14, 150 * shown.mix[index], 28);
        context.strokeStyle = "rgba(148,163,184,0.4)";
        context.strokeRect(right, answerY(index) - 14, 150, 28);
        context.fillStyle = "#e2e8f0";
        context.font = "bold 13px sans-serif";
        context.textAlign = "left";
        context.fillText(`${answer}  ${shown.mix[index].toFixed(2)}`, right + 4, answerY(index) - 20);
      });
      context.fillStyle = "#94a3b8";
      context.font = "12px sans-serif";
      context.textAlign = "center";
      context.fillText("Line thickness is p(z|x) times p(answer | x, z). The bars are the sum over documents.", canvas.width / 2, canvas.height - 14);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      dead = true;
      cancelAnimationFrame(raf);
    };
  }, []);
  return <canvas ref={canvasRef} width={980} height={360} aria-label="Probability flowing from three retrieved documents into Canberra, Sydney, and Melbourne." style={{ width: "100%", borderRadius: 12, display: "block", background: "#0b1020" }} />;
}

function MarginalDemo() {
  const [scores, setScores] = useState([2, 1.6, 1]);
  const probabilities = softmax(scores);
  const mix = ANSWERS.map((_, answer) => DOCS.reduce((sum, doc, index) => sum + probabilities[index] * doc.gen[answer], 0));
  const topIndex = probabilities.indexOf(Math.max(...probabilities));
  const topAnswer = ANSWERS[DOCS[topIndex].gen.indexOf(Math.max(...DOCS[topIndex].gen))];
  const best = ANSWERS[mix.indexOf(Math.max(...mix))];
  return (
    <Section heading="Demo 2: one answer per document, then add them up" caption="RAG treats the retrieved document as a hidden choice. The generator scores each answer once per document. Those scores are weighted by p(z|x) and summed. Drag the retriever scores. The question, the passages, and the probabilities are a toy.">
      <Text>Toy question: &quot;What is the capital of Australia?&quot;</Text>
      <MarginalScene probabilities={probabilities} mix={mix} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, margin: "10px 0" }}>
        {DOCS.map((doc, index) => (
          <div key={doc.title} style={{ border: "1px solid #334155", borderRadius: 10, padding: 10 }}>
            <div style={{ fontWeight: 600 }}>{doc.title} · score {scores[index].toFixed(1)} → p(z|x) = {probabilities[index].toFixed(2)}</div>
            <div style={{ fontSize: 13, opacity: 0.8, margin: "4px 0" }}>{doc.text}</div>
            <input aria-label={`${doc.title} retriever score`} type="range" min={-1} max={4} step={0.1} value={scores[index]} onChange={(event) => { const value = Number.parseFloat(event.target.value); setScores(scores.map((score, scoreIndex) => (scoreIndex === index ? value : score))); }} style={{ width: "100%" }} />
            <div style={{ fontSize: 12, opacity: 0.75 }}>{ANSWERS.map((answer, answerIndex) => `${answer} ${doc.gen[answerIndex].toFixed(2)}`).join(" · ")}</div>
          </div>
        ))}
      </div>
      <Metrics metrics={[
        { value: best, label: "RAG's answer, summed over all three documents", detail: ANSWERS.map((answer, index) => `${answer} ${mix[index].toFixed(2)}`).join(" · "), tone: best === "Canberra" ? "success" : "danger" },
        { value: topAnswer, label: "If we trusted only the top document", detail: `The top document is ${DOCS[topIndex].title}`, tone: topAnswer === "Canberra" ? "success" : "warning" },
      ]} />
      <Text>At the default scores, 2.0, 1.6, and 1.0, the retriever prefers the Sydney passage, and that passage alone would answer Sydney. The two Canberra passages still pull the summed answer to Canberra. This is the RAG-Sequence formula. For a one-word answer, or a class label such as FEVER, RAG-Sequence and RAG-Token are the same thing.</Text>
      <Text>Training needs no label for which document is right. The target is the answer. Documents that help produce it get more weight, and the same gradient nudges the query encoder to score them higher next time. The passage encoder and the index stay frozen.</Text>
    </Section>
  );
}

const TOKENS = ["\"The", "Sun", "Also", "Rises\"", "is", "a", "novel", "by", "this", "author", "of", "\"A", "Farewell", "to", "Arms\""];
const TOKEN_PROBS = [
  [0.3, 0.02, 0.85, 0.9, 0.7, 0.8, 0.6, 0.7, 0.8, 0.8, 0.7, 0.25, 0.7, 0.9, 0.9],
  [0.3, 0.6, 0.9, 0.95, 0.7, 0.8, 0.6, 0.7, 0.8, 0.8, 0.7, 0.1, 0.02, 0.9, 0.9],
  [0.3, 0.03, 0.85, 0.9, 0.7, 0.8, 0.6, 0.7, 0.8, 0.8, 0.7, 0.1, 0.03, 0.9, 0.9],
];
const TOKEN_DOCS = [
  { name: "z1", color: "#4ade80", text: "His wartime experiences formed the basis for his novel \"A Farewell to Arms\" (1929)." },
  { name: "z2", color: "#a78bfa", text: "His debut novel, \"The Sun Also Rises\", was published in 1926." },
  { name: "z3", color: "#5aa9ff", text: "Hemingway won the Nobel Prize in Literature in 1954. This third passage is a toy extra." },
];

function TokenScene({ prior, playKey }: { prior: number[]; playKey: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduced = useReducedMotion();
  const state = useRef({ prior, reduced, time: 0 });
  state.current.prior = prior;
  state.current.reduced = reduced;
  useEffect(() => {
    state.current.time = reduced ? 20 : 0;
  }, [playKey, reduced]);
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
      const limit = TOKENS.length * 0.55 + 2;
      current.time = current.reduced ? limit : Math.min(limit, current.time + 1 / 60);
      context.fillStyle = "#0b1020";
      context.fillRect(0, 0, canvas.width, canvas.height);
      const shown = Math.min(TOKENS.length, Math.floor(current.time / 0.55));
      const width = (canvas.width - 40) / TOKENS.length;
      const base = canvas.height - 78;
      const maxHeight = canvas.height - 150;
      for (let index = 0; index < TOKENS.length; index += 1) {
        const x = 20 + index * width;
        const on = index < shown;
        const weights = current.prior.map((probability, doc) => probability * TOKEN_PROBS[doc][index]);
        const total = weights.reduce((sum, value) => sum + value, 0);
        let y = base;
        if (on) {
          weights.forEach((weight, doc) => {
            const height = (weight / total) * maxHeight;
            context.fillStyle = TOKEN_DOCS[doc].color;
            context.fillRect(x + 4, y - height, width - 8, height);
            y -= height;
          });
          const mixed = current.prior.reduce((sum, probability, doc) => sum + probability * TOKEN_PROBS[doc][index], 0);
          context.fillStyle = "#facc15";
          context.font = "10px sans-serif";
          context.textAlign = "center";
          context.fillText(mixed.toFixed(2), x + width / 2, base - maxHeight - 6);
        }
        context.save();
        context.translate(x + width / 2, base + 14);
        context.rotate(-0.6);
        context.fillStyle = on ? "#e2e8f0" : "rgba(148,163,184,0.4)";
        context.font = "12px sans-serif";
        context.textAlign = "right";
        context.fillText(TOKENS[index], 0, 0);
        context.restore();
      }
      context.fillStyle = "#e2e8f0";
      context.font = "14px sans-serif";
      context.textAlign = "left";
      context.fillText("RAG-Token, for the input Hemingway: which document is behind each word?", 16, 24);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      dead = true;
      cancelAnimationFrame(raf);
    };
  }, []);
  return <canvas ref={canvasRef} width={980} height={340} aria-label="Stacked bars showing which retrieved document supports each word of a Hemingway sentence." style={{ width: "100%", borderRadius: 12, display: "block", background: "#0b1020" }} />;
}

function TokenDemo() {
  const [preset, setPreset] = useState("even");
  const [seed, setSeed] = useState(0);
  const priors: Record<string, number[]> = { even: [0.4, 0.4, 0.2], farewell: [0.7, 0.2, 0.1], sun: [0.2, 0.7, 0.1] };
  const prior = priors[preset];
  const { sequence, token, perDocument } = useMemo(() => {
    const perDocument = TOKEN_PROBS.map((row) => row.reduce((product, value) => product * value, 1));
    const sequence = perDocument.reduce((sum, probability, index) => sum + prior[index] * probability, 0);
    const token = TOKENS.reduce((product, _, index) => product * prior.reduce((sum, probability, doc) => sum + probability * TOKEN_PROBS[doc][index], 0), 1);
    return { sequence, token, perDocument };
  }, [prior]);
  return (
    <Section heading="Demo 3: one document for the sentence, or a new mix at every word" caption="The sentence names two books, and each book is in a different passage. RAG-Sequence must use one passage for the whole sentence. RAG-Token can switch. The probabilities are toy. The passages and the sentence follow Figure 2.">
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end", marginBottom: 10 }}>
        <Segmented options={[{ value: "even", label: "Retriever: 0.4 · 0.4 · 0.2" }, { value: "farewell", label: "Trusts z1, 0.7" }, { value: "sun", label: "Trusts z2, 0.7" }]} value={preset} onChange={(value) => { setPreset(value); setSeed((count) => count + 1); }} />
        <Button label="Replay" variant="primary" onClick={() => setSeed((count) => count + 1)} />
      </div>
      <TokenScene prior={prior} playKey={`${preset}-${seed}`} />
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
        {TOKEN_DOCS.map((doc) => <span key={doc.name} style={{ fontSize: 13 }}><span style={{ color: doc.color }}>●</span> {doc.name}</span>)}
      </div>
      <Table columns={["Document", "Passage", "p(z|x)", "p(whole sentence | x, z)"]} rows={TOKEN_DOCS.map((doc, index) => [doc.name, doc.text, prior[index].toFixed(2), perDocument[index].toExponential(2)])} />
      <Metrics metrics={[
        { value: sequence.toExponential(2), label: "RAG-Sequence: one document, then average", detail: "Each passage alone is missing one of the two titles", tone: "warning" },
        { value: token.toExponential(2), label: "RAG-Token: remix at every word", detail: `${(token / sequence).toFixed(0)} times more likely on this toy sentence`, tone: "success" },
      ]} />
      <Text>&quot;Sun&quot; is driven by the Sun Also Rises passage, and &quot;Farewell&quot; by the other one. After the first word of each title the mix goes flat: BART's own weights can finish a title once it has started. Figure 2 shows the same pattern. On Jeopardy, where a clue often combines two facts, RAG-Token scored 22.2 Q-BLEU-1, RAG-Sequence 21.4, and BART 19.7 (Table 2). On short answers the two are close: Natural Questions 44.5 versus 44.1.</Text>
    </Section>
  );
}

const SWAP: Record<string, number> = { "2016-2016": 70, "2018-2018": 68, "2018-2016": 12, "2016-2018": 4 };

function SwapScene({ indexYear, leaders }: { indexYear: string; leaders: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduced = useReducedMotion();
  const state = useRef({ indexYear, leaders, reduced });
  state.current = { indexYear, leaders, reduced };
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let dead = false;
    let raf = 0;
    let slot = indexYear === "2016" ? 1 : 0;
    let shown = SWAP[`${indexYear}-${leaders}`];
    const order = (() => {
      const random = rng(82);
      const items = Array.from({ length: 82 }, (_, index) => index);
      for (let index = 81; index > 0; index -= 1) {
        const swap = Math.floor(random() * (index + 1));
        [items[index], items[swap]] = [items[swap], items[index]];
      }
      return items;
    })();
    const draw = () => {
      if (dead) return;
      const current = state.current;
      const target = current.indexYear === "2016" ? 1 : 0;
      const rate = current.reduced ? 1 : 0.08;
      slot += (target - slot) * rate;
      const accuracy = SWAP[`${current.indexYear}-${current.leaders}`];
      shown += (accuracy - shown) * rate;
      context.fillStyle = "#0b1020";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.strokeStyle = "#fb923c";
      context.strokeRect(36, 78, 180, 110);
      context.fillStyle = "#e2e8f0";
      context.font = "bold 14px sans-serif";
      context.textAlign = "center";
      context.fillText("RAG, NQ model", 126, 118);
      context.font = "12px sans-serif";
      context.fillStyle = "#cbd5e1";
      context.fillText("weights unchanged", 126, 142);
      const dock = 340;
      const park = 500;
      context.strokeStyle = "rgba(148,163,184,0.4)";
      context.setLineDash([5, 5]);
      context.strokeRect(dock - 60, 70, 120, 140);
      context.setLineDash([]);
      context.fillStyle = "#94a3b8";
      context.font = "11px sans-serif";
      context.fillText("plugged-in index", dock, 58);
      context.strokeStyle = "rgba(250,204,21,0.7)";
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(216, 130);
      context.lineTo(dock - 60, 130);
      context.stroke();
      context.lineWidth = 1;
      const x2018 = dock + (park - dock) * slot;
      const x2016 = park + (dock - park) * slot;
      const cylinder = (x: number, label: string, color: string) => {
        context.strokeStyle = color;
        context.strokeRect(x - 42, 90, 84, 100);
        context.fillStyle = "#e2e8f0";
        context.font = "bold 12px sans-serif";
        context.fillText(label, x, 210);
      };
      cylinder(x2018, "Dec 2018", "#4ade80");
      cylinder(x2016, "Dec 2016", "#f472b6");
      const green = Math.round((shown / 100) * 82);
      context.textAlign = "left";
      context.fillStyle = "#e2e8f0";
      context.font = "12px sans-serif";
      context.fillText(`Who is {position}? · 82 leaders · ${current.leaders} office-holders`, 620, 48);
      for (let index = 0; index < 82; index += 1) {
        const ok = order[index] < green;
        context.fillStyle = ok ? "#4ade80" : "#f87171";
        context.globalAlpha = ok ? 1 : 0.45;
        context.beginPath();
        context.arc(640 + (index % 10) * 28, 78 + Math.floor(index / 10) * 24, 8, 0, Math.PI * 2);
        context.fill();
        context.globalAlpha = 1;
      }
      context.fillStyle = accuracy > 50 ? "#4ade80" : "#f87171";
      context.font = "bold 28px sans-serif";
      context.textAlign = "center";
      context.fillText(`${Math.round(shown)}% correct`, 360, canvas.height - 28);
      context.fillStyle = "#94a3b8";
      context.font = "12px sans-serif";
      context.textAlign = "left";
      context.fillText("The percentage is the paper's. Which dots are green is illustrative.", 620, canvas.height - 18);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      dead = true;
      cancelAnimationFrame(raf);
    };
  }, [indexYear, leaders]);
  return <canvas ref={canvasRef} width={980} height={340} aria-label="Swapping a 2016 or 2018 Wikipedia index into the same RAG model, with 82 world-leader questions." style={{ width: "100%", borderRadius: 12, display: "block", background: "#0b1020" }} />;
}

function SwapDemo() {
  const [indexYear, setIndexYear] = useState("2018");
  const [leaders, setLeaders] = useState("2018");
  const accuracy = SWAP[`${indexYear}-${leaders}`];
  return (
    <Section heading="Demo 4: hot-swap the index" caption={'The authors built a second index from a December 2016 Wikipedia dump and asked the same Natural Questions model about 82 world leaders who changed between 2016 and 2018, for example "Who is the President of Peru?" Nothing was retrained.'}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end", marginBottom: 10 }}>
        <Segmented options={[{ value: "2018", label: "Index: Dec 2018" }, { value: "2016", label: "Index: Dec 2016" }]} value={indexYear} onChange={setIndexYear} />
        <Segmented options={[{ value: "2018", label: "Ask about 2018 leaders" }, { value: "2016", label: "Ask about 2016 leaders" }]} value={leaders} onChange={setLeaders} />
      </div>
      <SwapScene indexYear={indexYear} leaders={leaders} />
      <Table columns={["Index and who is asked about", "2016 leaders", "2018 leaders"]} rows={[
        ["December 2016 index", { text: "70%", tone: "success" }, { text: "4%", tone: "danger" }],
        ["December 2018 index", { text: "12%", tone: "danger" }, { text: "68%", tone: "success" }],
      ]} />
      <Callout tone={accuracy > 50 ? "success" : "warning"} lead={accuracy > 50 ? "The index matches the year of the question." : "The index is from the other year."}>
        {accuracy > 50 ? `${accuracy}% correct. The answer follows whatever the plugged-in documents say.` : `Only ${accuracy}% correct. The model reports what those documents say, even when they name the leader from the other year.`} A model that stores the fact only in its weights would need more training to learn a new office-holder.
      </Callout>
    </Section>
  );
}

const NQ_BARS = [
  { label: "T5-11B, closed book", value: 34.5 },
  { label: "T5-11B + salient span masking", value: 36.6 },
  { label: "REALM", value: 40.4 },
  { label: "DPR", value: 41.5 },
  { label: "RAG-Token", value: 44.1 },
  { label: "RAG-Sequence", value: 44.5 },
];

type QuizItem = { q: string; options: string[]; answer: number; why: string };
const QUIZ: QuizItem[] = [
  { q: "What are RAG's two memories?", options: ["Two copies of one language model", "Parametric memory is BART's weights. Non-parametric memory is a dense index of Wikipedia passages.", "A short chat history and a long one", "A cache of earlier answers and a list of rules"], answer: 1, why: "Knowledge in BART's weights is parametric. The 21 million Wikipedia passage vectors are non-parametric memory, read through the DPR retriever." },
  { q: "How does the retriever pick passages?", options: ["It matches keywords in the title", "It encodes the question with BERT and returns the K passages whose vectors have the largest dot product with it", "A person picks them", "BART reads all 21 million passages"], answer: 1, why: "The probability of a passage is proportional to the exponential of the dot product d(z) · q(x). Finding the top inner products is maximum inner product search, done with FAISS." },
  { q: "Which parts are trained during fine-tuning?", options: ["Everything, including a rebuild of the index at every step", "Only BART", "The query encoder and BART. The passage encoder and the index stay frozen.", "Nothing. RAG is used with no training."], answer: 2, why: "Updating the document encoder would mean re-encoding all 21 million passages. The authors left that index fixed and still got strong results." },
  { q: "How do RAG-Sequence and RAG-Token differ?", options: ["RAG-Token uses more GPUs", "RAG-Sequence uses one retrieved document for the whole output. RAG-Token can use a different mix of documents at each token.", "RAG-Sequence does not retrieve", "They differ only for one-word answers"], answer: 1, why: "RAG-Token did best on Jeopardy generation, Q-BLEU-1 22.2 versus 21.4, where a clue often combines two facts. For a single token the two formulas are the same." },
  { q: "On Natural Questions, how did RAG compare?", options: ["Below closed-book T5-11B", "RAG-Sequence 44.5, versus DPR 41.5, REALM 40.4, and closed-book T5-11B 34.5", "Exactly the same as DPR", "It was not tested on question answering"], answer: 1, why: "Table 1. RAG was best on Natural Questions, WebQuestions (45.5), and CuratedTrec (52.2), with 626 million trainable parameters rather than T5's 11 billion." },
  { q: "What did swapping the December 2018 index for a December 2016 one show?", options: ["Nothing changed", "Answers about world leaders followed the index: 70% and 68% when the year matched, 12% and 4% when it did not, with no retraining", "The model had to be retrained", "Accuracy fell to zero in every cell"], answer: 1, why: "Section 4.5. Knowledge can be updated by replacing the non-parametric memory. The same weights then report whatever the new documents say." },
];

export default function RagPage() {
  const [picks, setPicks] = useState<(number | null)[]>(QUIZ.map(() => null));
  return (
    <Page title="RAG: look it up, then write" summary="Paper #20 · Lewis, Perez, Piktus, Petroni, Karpukhin, Goyal, Küttler, Lewis, Yih, Rocktäschel, Riedel, Kiela · Facebook AI Research, UCL, and NYU · NeurIPS 2020 · arXiv 2005.11401" width="wide">
      <Callout tone="info" lead="The big idea in one line.">Give a generator an open book. A retriever fetches the closest Wikipedia passages, BART writes from each of them, and the two are trained together, so knowledge lives in a swappable index as well as in the weights.</Callout>
      <Section heading="The plain-English version">
        <Text>GPT-3 (paper #8) can answer trivia from its weights alone. That memory is hard to check, hard to update, and when it runs out the model often invents a fact. ReAct (paper #16) and Toolformer (paper #19) look facts up through tools. RAG, which came first, builds the lookup into the model. The retriever is two BERT encoders (paper #6). The generator is BART, a sequence-to-sequence Transformer (papers #3 and #5).</Text>
        <Steps steps={[
          { title: "Encode the question", detail: "The query encoder, BERT, turns the input into a vector." },
          { title: "Retrieve", detail: "Maximum inner product search over a FAISS index of 21 million 100-word Wikipedia chunks returns the top passages. The score is the dot product of the passage vector and the query vector." },
          { title: "Generate", detail: "BART-large reads the input joined with each passage and scores the output." },
          { title: "Marginalize", detail: "Add up over the top passages, weighted by how much the retriever trusts each one. RAG-Sequence does this once for the whole answer. RAG-Token does it at every token." },
          { title: "Train end to end", detail: "Minimise the negative log probability of the answer. Nobody labels which passage was correct. The query encoder and BART learn. The passage index stays fixed." },
        ]} />
      </Section>
      <Section heading="Watch: the idea, animated">
        {VIDEOS.map((video) => (
          <figure key={video.file} style={{ margin: "0 0 16px" }}>
            <figcaption style={{ fontWeight: 600, marginBottom: 6 }}>{video.title}</figcaption>
            <video src={`/videos/20-rag/${video.file}`} preload="none" controls muted loop playsInline style={{ width: "100%", borderRadius: 12, background: "#0b1020", display: "block" }} />
            <p style={{ fontSize: 13, opacity: 0.75, margin: "4px 0 0" }}>{video.caption}</p>
          </figure>
        ))}
      </Section>
      <SpaceDemo />
      <MarginalDemo />
      <TokenDemo />
      <SwapDemo />
      <Section heading="What the paper actually claimed">
        <Metrics metrics={[
          { value: "44.5", label: "Natural Questions exact match", detail: "RAG-Sequence. DPR 41.5, REALM 40.4, closed-book T5-11B 34.5 (Table 1)", tone: "success" },
          { value: "42.7% vs 7.1%", label: "Jeopardy factuality", detail: "Raters preferred RAG 42.7% of the time and BART 7.1% (Table 4)", tone: "success" },
          { value: "72.5", label: "FEVER 3-way label accuracy", detail: "Within 4.3 of 76.8 for systems given gold evidence (Table 2)", tone: "warning" },
          { value: "70% vs 4%", label: "Index hot-swap", detail: "Matching year versus the 2016 index asked about 2018 leaders (Section 4.5)", tone: "success" },
        ]} />
        <svg width="100%" viewBox="0 0 760 250" role="img" aria-label="Natural Questions exact match from Table 1." style={{ display: "block", background: "#0b1020", borderRadius: 12 }}>
          {NQ_BARS.map((bar, index) => {
            const y = 16 + index * 38;
            return (
              <g key={bar.label}>
                <text x={280} y={y + 16} fill="#e2e8f0" fontSize="13" textAnchor="end">{bar.label}</text>
                <rect x={292} y={y} height={18} rx={4} fill={index === 5 ? "#4ade80" : "#94a3b8"} width={(bar.value / 50) * 380} />
                <text x={300 + (bar.value / 50) * 380} y={y + 14} fill="#ffffff" fontSize="12">{bar.value.toFixed(1)}</text>
              </g>
            );
          })}
        </svg>
        <Table columns={["Model, Table 1, exact match", "NQ", "TriviaQA, open / Wiki", "WebQuestions", "CuratedTrec"]} rows={[
          ["T5-11B, closed book", "34.5", "– / 50.1", "37.4", "–"],
          ["T5-11B + salient span masking", "36.6", "– / 60.5", "44.7", "–"],
          ["REALM", "40.4", "– / –", "40.7", "46.8"],
          ["DPR", "41.5", "57.9 / –", "41.1", "50.6"],
          ["RAG-Token", "44.1", "55.2 / 66.1", "45.5", "50.0"],
          ["RAG-Sequence", { text: "44.5", tone: "success" }, "56.8 / 68.0", "45.2", { text: "52.2", tone: "success" }],
        ]} />
        <Table columns={["Finding", "What they measured"]} rows={[
          ["Open-domain QA, Table 1", "Best on Natural Questions, WebQuestions, and CuratedTrec, and on the TriviaQA split that is comparable to T5. No re-ranker, no extractive reader, and no salient-span pre-training."],
          ["Answer missing from every passage", "On Natural Questions, RAG was still right 11.8% of the time when no retrieved document contained the answer. An extractive reader scores 0 there."],
          ["Generation, Table 2", "MS-MARCO, no gold passages: RAG-Sequence BLEU-1 44.2 and ROUGE-L 40.8, versus BART 41.6 and 38.2. Jeopardy Q-BLEU-1: RAG-Token 22.2, RAG-Sequence 21.4, BART 19.7."],
          ["Human ratings, Table 4", "On Jeopardy, raters found RAG more factual 42.7% of the time and BART more factual 7.1% of the time."],
          ["Diversity, Table 5", "Distinct tri-grams on Jeopardy: RAG-Sequence 53.8%, RAG-Token 46.8%, BART 32.4%. Gold references are 90.0%."],
          ["Fact checking, Table 2", "FEVER 3-way 72.5 and 2-way 89.5, versus 76.8 and 92.2 for systems trained with gold evidence. A gold article was the top hit 71% of the time, and in the top 10 for 90%."],
          ["Learned retrieval, Table 6", "Freezing the retriever or swapping in BM25 hurts every task except FEVER, where BM25 was best, 75.1 versus 74.5. On Natural Questions, RAG-Sequence was 44.0, frozen 41.2, BM25 31.8."],
          ["More documents, Figure 3", "Training with 5 or 10 documents made little difference. At test time, more documents keep helping RAG-Sequence on Natural Questions. RAG-Token peaks around 10."],
          ["Size, Appendix G", "626 million trainable parameters, against T5-11B. T5-large, 770 million parameters, scores 28.9 on Natural Questions."],
        ]} />
        <Callout tone="warning" lead="Limits the authors note.">The retriever starts from DPR, which was trained with retrieval labels on Natural Questions and TriviaQA. The passage encoder is never updated. On story generation, retrieval sometimes collapsed to the same documents for every input, and RAG then behaved like plain BART. The model repeats whatever its documents say, including a leader from the wrong year, and a knowledge source is never fully neutral.</Callout>
      </Section>
      <QuizSync slug="20-rag" picks={picks} answers={QUIZ.map((item) => item.answer)} />
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
        <Text>Explain it in your own words: how does RAG combine a retriever with a generator, and why does keeping knowledge in a swappable document index, instead of only in the model&apos;s weights, help?</Text>
      </Section>
      <Section heading="Read it yourself">
        <LinkCards links={[
          { title: "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks (abstract)", site: "arxiv.org", date: "2020", href: "https://arxiv.org/abs/2005.11401" },
          { title: "RAG (PDF)", site: "arxiv.org", date: "2020", href: "https://arxiv.org/pdf/2005.11401" },
          { title: "RAG in Hugging Face Transformers", site: "huggingface.co", date: "2020", href: "https://huggingface.co/docs/transformers/model_doc/rag" },
          { title: "RAG training scripts", site: "github.com", date: "2020", href: "https://github.com/huggingface/transformers-research-projects/tree/main/rag" },
          { title: "Dense Passage Retrieval", site: "github.com", date: "2020", href: "https://github.com/facebookresearch/DPR" },
          { title: "Toolformer, a later tool-use method", site: "Papers a Day", date: "2023", href: "/papers/19-toolformer" },
          { title: "BERT, the encoder inside the retriever", site: "Papers a Day", date: "2018", href: "/papers/06-bert" },
          { title: "GPT-3, closed-book knowledge in the weights", site: "Papers a Day", date: "2020", href: "/papers/08-gpt3" },
        ]} />
      </Section>
    </Page>
  );
}
