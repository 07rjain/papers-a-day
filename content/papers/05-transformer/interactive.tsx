"use client";

import { Page, Section, Text, Callout, Segmented, Button, Table, Steps, LinkCards, useState, useGrokTheme } from "grok/canvas";
import { TypedAttention } from "@/components/viz/TypedAttention";

const WORDS: string[] = ["the", "cat", "sat", "because", "it", "was", "tired"];
const N = WORDS.length;

// Toy attention scores, hand-made (not from a trained model). Rows = the word asking (query), columns = words being looked at (keys).
function buildHead(kind: string): number[][] {
  const m: number[][] = [];
  for (let i = 0; i < N; i++) {
    const r: number[] = [];
    for (let j = 0; j < N; j++) r.push(i === j ? 1 : 0);
    m.push(r);
  }
  if (kind === "meaning") {
    m[0][1] = 2.5; m[1][2] = 1.8; m[2][1] = 2.6; m[3][2] = 2.0; m[3][6] = 1.5;
    m[4][1] = 3.6; m[5][4] = 2.2; m[5][6] = 1.6; m[6][1] = 2.6; m[6][4] = 2.2;
  } else {
    m[0][0] = 3;
    for (let i = 1; i < N; i++) { m[i][i - 1] = 3; m[i][i] = 1.2; }
  }
  return m;
}
const HEADS: Record<string, number[][]> = { meaning: buildHead("meaning"), neighbor: buildHead("neighbor") };

function softmax(xs: number[]): number[] {
  const finite = xs.filter((x: number) => x > -1e8);
  const m = Math.max(...finite);
  const ex = xs.map((x: number) => (x > -1e8 ? Math.exp(x - m) : 0));
  const s = ex.reduce((a: number, b: number) => a + b, 0);
  return ex.map((e: number) => e / s);
}

// Toy raw match pattern for the scaling demo (5 keys).
const PATTERN: number[] = [1.0, 0.6, 0.2, -0.3, -0.8];
const KEYS: string[] = ["key A", "key B", "key C", "key D", "key E"];

type Q = { q: string; options: string[]; answer: number; why: string };
const QUIZ: Q[] = [
  {
    q: "What did the Transformer remove compared with Bahdanau's model?",
    options: ["Attention", "The recurrent network (RNN) that reads words one at a time", "The decoder"],
    answer: 1,
    why: "Bahdanau added attention on top of an RNN. The Transformer keeps attention and throws away recurrence (and convolutions) entirely, so it's built only from attention plus small feed-forward layers.",
  },
  {
    q: "In self-attention, where do the queries, keys and values come from?",
    options: ["All from the same sentence (the previous layer's word vectors)", "Queries from French, keys from English", "From a fixed dictionary"],
    answer: 0,
    why: "Self means every word attends to the other words of its own sentence. Each word's vector is projected into a query (what am I looking for), a key (what do I offer) and a value (what I pass along).",
  },
  {
    q: "Why divide the dot products by the square root of d_k?",
    options: ["To save memory", "Big dot products push softmax to near one-hot, where gradients get tiny, so scaling keeps it trainable", "To make the output positive"],
    answer: 1,
    why: "With d_k numbers in each vector, dot products grow roughly like the square root of d_k. Dividing by that keeps scores in a healthy range so softmax stays soft and learning works.",
  },
  {
    q: "Since there's no RNN, how does the model know word order?",
    options: ["It doesn't need to", "Positional encodings (sine and cosine waves) are added to each word's embedding", "Words are sorted alphabetically"],
    answer: 1,
    why: "Attention by itself treats the sentence like a bag of words. Adding a position signal to each word's vector lets the model tell 'dog bites man' from 'man bites dog'.",
  },
  {
    q: "What's the main speed advantage over RNNs?",
    options: ["Fewer parameters", "All positions are processed in parallel instead of one step after another", "It skips training"],
    answer: 1,
    why: "An RNN needs n sequential steps for n words. A self-attention layer connects every pair of words in one step, so GPUs can do it all at once. The big model trained in 3.5 days on 8 GPUs.",
  },
];

export default function App() {
  const t = useGrokTheme();
  const blue = t.dataviz.categorical[0];
  const yellow = t.dataviz.categorical[1];
  const purple = t.dataviz.categorical[2] || blue;

  // Demo 1
  const [qw, setQw] = useState<string>("4");
  const [head, setHead] = useState<string>("meaning");
  const [mask, setMask] = useState<string>("off");
  const qi = Number(qw);
  const rawRow = HEADS[head][qi].map((s: number, j: number) => (mask === "on" && j > qi ? -1e9 : s));
  const w = softmax(rawRow);
  const top = w.indexOf(Math.max(...w));

  // Demo 2
  const [dk, setDk] = useState<number>(64);
  const unscaled = softmax(PATTERN.map((p: number) => p * Math.sqrt(dk)));
  const scaled = softmax(PATTERN);

  // Demo 3
  const [n, setN] = useState<number>(20);

  const [picks, setPicks] = useState<(number | null)[]>(QUIZ.map(() => null));

  const bars = (vals: number[], labels: string[], hi: number, h: number) => (
    <svg width="100%" viewBox={`0 0 700 ${h}`} style={{ display: "block" }}>
      <rect x={0} y={0} width={700} height={h} fill={t.bg.base} />
      {vals.map((v: number, j: number) => {
        const bw = 700 / vals.length;
        const bh = v * (h - 60);
        const barH = Math.round(Math.max(2, bh) * 100) / 100;
        const barY = Math.round((h - 30 - bh) * 100) / 100;
        const labelY = Math.round((h - 36 - bh) * 100) / 100;
        return (
          <g key={j}>
            <rect x={j * bw + 8} y={barY} width={bw - 16} height={barH} rx={4} fill={j === hi ? yellow : blue} />
            <text x={j * bw + bw / 2} y={labelY} textAnchor="middle" fill={t.text.primary} fontSize={12} fontFamily={t.font.family}>{(v * 100).toFixed(0) + "%"}</text>
            <text x={j * bw + bw / 2} y={h - 10} textAnchor="middle" fill={t.text.secondary} fontSize={13} fontFamily={t.font.family}>{labels[j]}</text>
          </g>
        );
      })}
    </svg>
  );

  return (
    <Page title="The Transformer, explained by playing with it" summary="Daily paper #5: Vaswani et al. (2017), 'Attention Is All You Need'. Yesterday, attention helped an RNN look back at the input. This paper asks: what if attention is the whole model? The answer became the architecture behind BERT, GPT and nearly every modern language model.">
      <Section heading="The big idea in one line">
        <Callout>Drop the word-by-word RNN completely and let every word look at every other word at the same time.</Callout>
        <Text>In Bahdanau's model, an RNN still read the sentence one word after another, and attention was an add-on that let the decoder glance back. Reading one word at a time is slow, because step 10 can't start until step 9 is done, and information from far-away words has to survive a long chain of steps.</Text>
        <Text>The Transformer keeps only the attention part. Every word turns its vector into three smaller vectors: a query (what am I looking for?), a key (what do I contain?) and a value (what will I hand over?). Each word compares its query with every word's key, softmax turns those match scores into weights, and the word's new vector is the weighted mix of everyone's values. That's self-attention, and the whole sentence does it in one parallel step.</Text>
        <Text>Three extra ingredients make it work: several attention heads running side by side so each can track a different kind of relationship (multi-head attention), a position signal added to each word since attention alone has no sense of order (positional encoding), and a small feed-forward network after each attention layer. Stack six of these layers for the encoder and six for the decoder.</Text>
      </Section>

      <Section heading="Demo 1: self-attention, one word at a time" caption="Toy example. The attention scores are hand-made to illustrate the idea; they are not from a trained model.">
        <Text>Pick the word that's asking (the query) and see how much it attends to each word in the same sentence. Then switch heads: different heads learn different jobs.</Text>
        <Segmented options={WORDS.map((x: string, i: number) => ({ value: String(i), label: x }))} value={qw} onChange={(v: string) => setQw(v)} />
        <Segmented options={[{ value: "meaning", label: "Head 1: who is this about?" }, { value: "neighbor", label: "Head 2: previous word" }]} value={head} onChange={(v: string) => setHead(v)} />
        <Segmented options={[{ value: "off", label: "Encoder (sees whole sentence)" }, { value: "on", label: "Decoder (mask: no peeking ahead)" }]} value={mask} onChange={(v: string) => setMask(v)} />
        {bars(w, WORDS, top, 200)}
        <Callout>{`"${WORDS[qi]}" puts ${(w[top] * 100).toFixed(0)}% of its attention on "${WORDS[top]}". Its new vector is mostly built from that word's value.`}</Callout>
        <Text>Try "it" with Head 1: it locks onto "cat", which is how the model can figure out what a pronoun refers to. The paper's Figure 4 shows real heads doing this kind of pronoun resolution. Head 2 just looks one word back, a simple grammar-ish pattern. Combining heads gives each word several views at once.</Text>
        <Text>Now flip on the decoder mask and pick "the" or "cat". Words to the right get exactly 0%, because when generating text the model must not see words it hasn't written yet. The paper does this by setting those scores to minus infinity before softmax.</Text>
      </Section>

      <Section heading="Demo 2: why the square root of d_k?" caption="Toy example. The same 5 raw match scores, shown with and without the paper's scaling.">
        <Text>The real formula is Attention(Q, K, V) = softmax(QKᵀ / √d_k) V. The d_k is how many numbers each query and key has. More numbers means bigger dot products, roughly growing like √d_k. Slide d_k up and compare.</Text>
        <Text>{`d_k = ${dk}   (the paper uses 64 per head)`}</Text>
        <input type="range" min={1} max={512} value={dk} onChange={(e: any) => setDk(Number(e.target.value))} style={{ width: "100%" }} />
        <Text>Without scaling:</Text>
        {bars(unscaled, KEYS, 0, 160)}
        <Text>With scaling (divide by √d_k):</Text>
        {bars(scaled, KEYS, 0, 160)}
        <Callout tone="info">{`Unscaled, key A grabs ${(unscaled[0] * 100).toFixed(0)}% and the rest are crushed. When softmax is that extreme, its gradients are almost zero and learning stalls. Scaled, the split stays sensible (${(scaled[0] * 100).toFixed(0)}% on key A) no matter how big d_k is.`}</Callout>
      </Section>

      <Section heading="Demo 3: RNN vs Transformer, steps needed" caption="Counts follow the paper's Table 1 (big-O, so these are rough shapes, not exact timings).">
        <Text>{`Sentence length: ${n} words`}</Text>
        <input type="range" min={2} max={100} value={n} onChange={(e: any) => setN(Number(e.target.value))} style={{ width: "100%" }} />
        <Table columns={["", "RNN layer", "Self-attention layer"]} rows={[
          ["Steps that must happen one after another", String(n), "1"],
          ["Hops for word 1 to influence the last word", String(n - 1), "1"],
          ["Word-pair comparisons", "none (just passes a memory along)", String(n * n)],
        ]} />
        <Text>That's the trade-off. Self-attention compares every pair, which grows like n squared, but it all happens at once and any two words are only one hop apart. For typical sentence lengths, that's both faster on GPUs and better at long-range connections.</Text>
        <svg width="100%" viewBox="0 0 700 90" style={{ display: "block" }}>
          <rect x={0} y={0} width={700} height={90} fill={t.bg.base} />
          <text x={10} y={28} fill={t.text.secondary} fontSize={13} fontFamily={t.font.family}>RNN</text>
          <rect x={110} y={14} width={Math.max(4, (n / 100) * 570)} height={20} rx={4} fill={purple} />
          <text x={10} y={68} fill={t.text.secondary} fontSize={13} fontFamily={t.font.family}>Transformer</text>
          <rect x={110} y={54} width={6} height={20} rx={3} fill={yellow} />
        </svg>
      </Section>

      <Section heading="What the paper actually claimed">
        <Table columns={["Model (WMT 2014 translation)", "English to German BLEU", "English to French BLEU"]} rows={[
          ["GNMT + RL (Google's RNN system)", "24.6", "39.92"],
          ["ConvS2S (convolutional)", "25.16", "40.46"],
          ["ConvS2S ensemble", "26.36", "41.29"],
          ["Transformer (base)", "27.3", "38.1"],
          ["Transformer (big)", "28.4", "41.8"],
        ]} />
        <Steps steps={[
          { title: "New state of the art in translation", detail: "The big Transformer beat every earlier English-German result, ensembles included, by more than 2 BLEU." },
          { title: "Much cheaper to train", detail: "The base model trained in about 12 hours and the big one in 3.5 days, both on one machine with 8 P100 GPUs, a fraction of rivals' training compute." },
          { title: "Heads matter, but not too many", detail: "Using a single head was 0.9 BLEU worse than the best setting, and quality also dropped with too many heads." },
          { title: "Position signal choice barely mattered", detail: "Learned position embeddings gave nearly identical results to the sine and cosine version; they kept sines hoping it works on longer sentences." },
          { title: "Works beyond translation", detail: "With little tuning, it did well on English constituency parsing (finding the grammar tree of a sentence)." },
        ]} />
        <Callout tone="info" lead="Where this leads.">BERT keeps just the encoder half; GPT keeps just the decoder half with the mask. Both come next on this reading path.</Callout>
      </Section>

      <Section heading="Play: type a sentence" caption="Toy letter-based scores. Not a trained model.">
        <TypedAttention />
      </Section>

      <Section heading="Check your understanding">
        {QUIZ.map((item: Q, k: number) => (
          <Section key={k} heading={`${k + 1}. ${item.q}`}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {item.options.map((o: string, oi: number) => (
                <Button key={oi} label={o} variant={picks[k] === oi ? "primary" : "quiet"} onClick={() => setPicks(picks.map((x: number | null, z: number) => (z === k ? oi : x)))} />
              ))}
            </div>
            {picks[k] === null ? null : picks[k] === item.answer ? (
              <Callout tone="success" lead="Right.">{item.why}</Callout>
            ) : (
              <Callout tone="warning" lead="Not quite.">{item.why}</Callout>
            )}
          </Section>
        ))}
        <Text>In your own words, what a query, a key and a value each do in self-attention.</Text>
      </Section>

      <Section heading="Read it yourself">
        <LinkCards links={[
          { title: "Attention Is All You Need", site: "arxiv.org", date: "2017", href: "https://arxiv.org/abs/1706.03762" },
          { title: "Paper PDF", site: "arxiv.org", date: "2017", href: "https://arxiv.org/pdf/1706.03762" },
        ]} />
      </Section>
    </Page>
  );
}
