"use client";

import { useState } from "react";
import { VizNote } from "@/components/viz/shell";

const D = 12288;

export function RankCurve() {
  const [rank, setRank] = useState(4);
  const params = 2 * D * rank;
  const toyQuality = 1 - Math.exp(-rank / 3);
  return (
    <div>
      <VizNote>
        Toy quality curve, not a measurement from the paper. It only illustrates the idea that a
        small rank can capture most of a simple update. The parameter count is real arithmetic:
        2 × 12,288 × r for one matrix.
      </VizNote>
      <div className="viz-controls">
        <label>
          Rank r = {rank}
          <input type="range" min={1} max={64} value={rank} onChange={(event) => setRank(Number(event.target.value))} />
        </label>
      </div>
      <div className="attn-bars" aria-hidden="true">
        <div className="attn-col">
          <span>{params.toLocaleString("en-US")}</span>
          <div className="attn-fill" style={{ height: `${Math.max(8, Math.min(160, (params / (2 * D * 64)) * 160))}px` }} />
          <span>parameters</span>
        </div>
        <div className="attn-col">
          <span>{(toyQuality * 100).toFixed(0)}%</span>
          <div className="attn-fill" style={{ height: `${Math.max(8, toyQuality * 160)}px`, background: "var(--dv-1)" }} />
          <span>toy quality</span>
        </div>
      </div>
      <p className="viz-note">
        At r = {rank} this one matrix trains {params.toLocaleString("en-US")} numbers. The paper found that r = 1 or 2 already worked well for Wq and Wv on GPT-3; that result is in Table 6, not in this toy curve.
      </p>
    </div>
  );
}
