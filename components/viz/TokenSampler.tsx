"use client";

import { useMemo, useState } from "react";
import { VizNote } from "@/components/viz/shell";

const TOY = [
  ["about", 0.24],
  ["the", 0.18],
  ["20%", 0.16],
  ["oxygen", 0.12],
  ["a", 0.1],
  ["forest", 0.08],
  ["unknown", 0.07],
  ["nothing", 0.05],
] as [string, number][];

function distribute(temperature: number, topK: number) {
  const ranked = [...TOY].sort((a, b) => b[1] - a[1]).slice(0, topK);
  const warmed = ranked.map(([token, p]) => [token, Math.pow(p, 1 / temperature)] as [string, number]);
  const sum = warmed.reduce((total, item) => total + item[1], 0);
  return warmed.map(([token, p]) => [token, p / sum] as [string, number]);
}

export function TokenSampler() {
  const [temperature, setTemperature] = useState(1);
  const [topK, setTopK] = useState(8);
  const [drawn, setDrawn] = useState<string | null>(null);
  const rows = useMemo(() => distribute(temperature, topK), [temperature, topK]);
  const draw = () => {
    let cursor = Math.random();
    for (const [token, p] of rows) {
      cursor -= p;
      if (cursor <= 0) {
        setDrawn(token);
        return;
      }
    }
    setDrawn(rows[rows.length - 1][0]);
  };
  return (
    <div>
      <VizNote>
        Toy next-token distribution, made up to show temperature and top-k. These probabilities are
        not from GPT-2.
      </VizNote>
      <div className="viz-controls">
        <label>
          Temperature {temperature.toFixed(2)}
          <input type="range" min={0.2} max={2} step={0.05} value={temperature} onChange={(event) => setTemperature(Number(event.target.value))} />
        </label>
        <label>
          Top-k {topK}
          <input type="range" min={1} max={8} step={1} value={topK} onChange={(event) => setTopK(Number(event.target.value))} />
        </label>
        <button type="button" className="k-btn primary" onClick={draw}>
          Draw one token
        </button>
      </div>
      <div className="attn-bars">
        {rows.map(([token, p]) => (
          <div key={token} className="attn-col">
            <span>{(p * 100).toFixed(0)}%</span>
            <div className="attn-fill" style={{ height: `${Math.max(6, p * 160)}px` }} />
            <span>{token}</span>
          </div>
        ))}
      </div>
      <p className="viz-note">{drawn ? `Drew “${drawn}”.` : "Low temperature concentrates the mass. Top-k drops the tail before renormalising."}</p>
    </div>
  );
}
