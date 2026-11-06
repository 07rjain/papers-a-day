"use client";

import {
  createContext,
  useContext,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useThemeKind } from "@/components/theme-mode";
import { themeFor, type GrokTheme } from "@/components/kit/theme";

export {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

export type {
  ChangeEvent,
  CSSProperties,
  FocusEvent,
  FormEvent,
  KeyboardEvent,
  MouseEvent,
  PointerEvent,
  ReactNode,
  RefObject,
  SyntheticEvent,
} from "react";

export function useGrokTheme(): GrokTheme {
  const kind = useThemeKind();
  return useMemo(() => themeFor(kind), [kind]);
}

type Tone = "success" | "warning" | "danger";
type CalloutTone = "info" | Tone;

const SectionDepth = createContext(0);

export function Page({
  title,
  summary,
  sources,
  width = "column",
  children,
}: {
  title: string;
  summary?: string;
  sources?: string[];
  width?: "column" | "wide" | "full";
  children?: ReactNode;
}) {
  return (
    <div className={`k-page width-${width}`}>
      <header className="k-page-head">
        <h2>{title}</h2>
        {summary ? <p className="k-summary">{summary}</p> : null}
      </header>
      {children}
      {sources && sources.length > 0 ? <p className="k-sources">{sources.join(" · ")}</p> : null}
    </div>
  );
}

export function Section({
  heading,
  id,
  caption,
  actions,
  collapsible = false,
  defaultOpen = false,
  children,
}: {
  heading?: string;
  id?: string;
  caption?: string;
  actions?: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  children?: ReactNode;
}) {
  const depth = useContext(SectionDepth);
  const HeadingTag = depth === 0 ? "h3" : "h4";
  const [open, setOpen] = useState(defaultOpen);
  const inner = (
    <SectionDepth.Provider value={depth + 1}>
      {caption ? <p className="k-caption">{caption}</p> : null}
      {children}
    </SectionDepth.Provider>
  );

  if (collapsible) {
    return (
      <section id={id} className={`k-section depth-${Math.min(depth, 3)}`}>
        <details
          className="k-details"
          open={open}
          onToggle={(event) => setOpen(event.currentTarget.open)}
        >
          <summary>
            <HeadingTag className="k-section-title">{heading}</HeadingTag>
          </summary>
          {inner}
        </details>
      </section>
    );
  }

  return (
    <section id={id} className={`k-section depth-${Math.min(depth, 3)}`}>
      {heading ? (
        <div className="k-section-head">
          <HeadingTag className="k-section-title">{heading}</HeadingTag>
          {actions}
        </div>
      ) : null}
      {inner}
    </section>
  );
}

export function Text({ children }: { children?: ReactNode }) {
  return <p className="k-text">{children}</p>;
}

export function Callout({
  lead,
  tone = "info",
  children,
}: {
  lead?: string;
  tone?: CalloutTone;
  children?: ReactNode;
}) {
  return (
    <div className={`k-callout tone-${tone}`}>
      {lead ? <strong className="k-lead">{lead} </strong> : null}
      {children}
    </div>
  );
}

type TableCell = string | { text: string; tone?: Tone } | ReactNode;

function isTonedCell(cell: TableCell): cell is { text: string; tone?: Tone } {
  return (
    typeof cell === "object" &&
    cell !== null &&
    "text" in cell &&
    !("$$typeof" in cell)
  );
}

export function Table({
  columns,
  rows,
  emphasis,
  align,
}: {
  columns: string[];
  rows: TableCell[][];
  emphasis?: number;
  align?: ("auto" | "start" | "end")[];
}) {
  return (
    <div className="k-table-wrap">
      <table className="k-table">
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th key={`${column}-${index}`} style={{ textAlign: alignToCss(align?.[index]) }}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className={emphasis === rowIndex ? "is-emphasis" : undefined}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} style={{ textAlign: alignToCss(align?.[cellIndex]) }}>
                  {isTonedCell(cell) ? (
                    <span className={cell.tone ? `tone-${cell.tone}` : undefined}>{cell.text}</span>
                  ) : (
                    cell
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function alignToCss(align: "auto" | "start" | "end" | undefined): "left" | "right" | undefined {
  if (align === "end") return "right";
  if (align === "start") return "left";
  return undefined;
}

export function Steps({
  steps,
}: {
  steps: { title: ReactNode; detail?: ReactNode }[];
}) {
  return (
    <ol className="k-steps">
      {steps.map((step, index) => (
        <li key={index}>
          <span className="k-step-num" aria-hidden="true">
            {index + 1}
          </span>
          <div>
            <div className="k-step-title">{step.title}</div>
            {step.detail ? <div className="k-step-detail">{step.detail}</div> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function LinkCards({
  links,
  numbered = false,
}: {
  links: { title: string; site?: string; date?: string; href: string }[];
  numbered?: boolean;
}) {
  return (
    <ul className={`k-links${numbered ? " numbered" : ""}`}>
      {links.map((link, index) => (
        <li key={`${link.href}-${index}`}>
          <a href={link.href} target="_blank" rel="noreferrer">
            {numbered ? <span className="k-link-num">{index + 1}</span> : null}
            <span className="k-link-title">{link.title}</span>
            {link.site || link.date ? (
              <span className="k-link-meta">{[link.site, link.date].filter(Boolean).join(" · ")}</span>
            ) : null}
          </a>
        </li>
      ))}
    </ul>
  );
}

type GridColumns = 2 | 3 | 4 | 5 | 6 | 7;

export function Grid({
  columns = 2,
  joined = false,
  plain = false,
  children,
}: {
  columns?: GridColumns;
  joined?: boolean;
  plain?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={`k-grid cols-${columns}${joined ? " joined" : ""}${plain ? " plain" : ""}`}>
      {children}
    </div>
  );
}

type SegmentedOption<T extends string = string> = { value: T; label: string; count?: number };

export function Segmented<T extends string = string>({
  options,
  value,
  onChange,
}: {
  options: (T | SegmentedOption<T>)[];
  value: T;
  onChange: (value: T) => void;
}) {
  const normalized = options.map((option) =>
    typeof option === "string" ? { value: option as T, label: option } : option,
  );
  return (
    <div className="k-seg" role="group">
      {normalized.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {option.count != null ? <span className="k-count"> {option.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

type SelectOption<T extends string = string> = { value: T; label: string };

export function Select<T extends string = string>({
  label,
  options,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  label?: string;
  options: (T | SelectOption<T>)[];
  value: T;
  onChange: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const normalized = options.map((option) =>
    typeof option === "string" ? { value: option as T, label: option } : option,
  );
  return (
    <div className="k-field">
      {label ? <label htmlFor={id}>{label}</label> : null}
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {normalized.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Button({
  label,
  onClick,
  variant = "quiet",
  disabled,
}: {
  label: string;
  onClick: () => void;
  variant?: "primary" | "quiet";
  disabled?: boolean;
}) {
  return (
    <button type="button" className={`k-btn ${variant}`} onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}

export function Metrics({
  metrics,
}: {
  metrics: { value: string; label: string; detail?: string; tone?: Tone }[];
}) {
  return (
    <div className="k-metrics">
      {metrics.map((metric) => (
        <div key={metric.label} className="k-metric">
          <div className={`k-metric-value${metric.tone ? ` tone-${metric.tone}` : ""}`}>{metric.value}</div>
          <div className="k-metric-label">{metric.label}</div>
          {metric.detail ? <div className="k-metric-detail">{metric.detail}</div> : null}
        </div>
      ))}
    </div>
  );
}
