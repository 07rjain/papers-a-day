import type { ThemeKind } from "@/components/theme-mode";

export type GrokTextStyle = {
  fontSize: string;
  lineHeight: string;
  letterSpacing: string;
  fontVariationSettings?: string;
};

export type GrokDataViz = {
  categorical: string[];
  other: string;
  negative: string;
  singleSeriesRest: string;
  areaAlpha: string;
  bandAlpha: string;
  blueTint: string;
  blue5: string;
  sequential: string[];
  diverging: string[];
};

export type GrokPalette = {
  bg: { base: string; subtle: string; elevated: string };
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    onColor: string;
    onPrimary: string;
    accent: string;
    success: string;
    warning: string;
    danger: string;
    accentDeep: string;
    successDeep: string;
    warningDeep: string;
    dangerDeep: string;
  };
  fill: {
    primary: string;
    primaryHover: string;
    secondary: string;
    secondaryHover: string;
    hover: string;
    pressed: string;
    accent: string;
    controlChecked: string;
    accentSubtle: string;
    successSubtle: string;
    warningSubtle: string;
    dangerSubtle: string;
  };
  border: { subtle: string; weak: string; default: string; strong: string; focus: string };
};

export type GrokTheme = GrokPalette & {
  kind: ThemeKind;
  font: {
    family: string;
    mono: string;
    heading1: GrokTextStyle;
    heading2: GrokTextStyle;
    heading3: GrokTextStyle;
    body1: GrokTextStyle;
    subtext: GrokTextStyle;
    table: GrokTextStyle;
    metric: GrokTextStyle;
    body2: GrokTextStyle;
    label: GrokTextStyle;
    caption: GrokTextStyle;
    code: GrokTextStyle;
  };
  weight: { regular: 400 | 425; medium: 500; semibold: 600 };
  radius: { sm: 4; md: 8; lg: 12; xl: 16; full: 9999 };
  motion: { hover: string; easing: string };
  dataviz: GrokDataViz;
  chart: [string, string, string, string];
};

const style = (
  fontSize: string,
  lineHeight: string,
  letterSpacing = "0",
): GrokTextStyle => ({ fontSize, lineHeight, letterSpacing });

const palette: GrokPalette = {
  bg: {
    base: "var(--bg-base)",
    subtle: "var(--bg-subtle)",
    elevated: "var(--bg-elevated)",
  },
  text: {
    primary: "var(--text-primary)",
    secondary: "var(--text-secondary)",
    tertiary: "var(--text-tertiary)",
    onColor: "var(--text-on-color)",
    onPrimary: "var(--text-on-primary)",
    accent: "var(--text-accent)",
    success: "var(--text-success)",
    warning: "var(--text-warning)",
    danger: "var(--text-danger)",
    accentDeep: "var(--text-accent-deep)",
    successDeep: "var(--text-success-deep)",
    warningDeep: "var(--text-warning-deep)",
    dangerDeep: "var(--text-danger-deep)",
  },
  fill: {
    primary: "var(--fill-primary)",
    primaryHover: "var(--fill-primary-hover)",
    secondary: "var(--fill-secondary)",
    secondaryHover: "var(--fill-secondary-hover)",
    hover: "var(--fill-hover)",
    pressed: "var(--fill-pressed)",
    accent: "var(--fill-accent)",
    controlChecked: "var(--fill-control-checked)",
    accentSubtle: "var(--fill-accent-subtle)",
    successSubtle: "var(--fill-success-subtle)",
    warningSubtle: "var(--fill-warning-subtle)",
    dangerSubtle: "var(--fill-danger-subtle)",
  },
  border: {
    subtle: "var(--border-subtle)",
    weak: "var(--border-weak)",
    default: "var(--border-default)",
    strong: "var(--border-strong)",
    focus: "var(--border-focus)",
  },
};

const dataviz: GrokDataViz = {
  categorical: [
    "var(--dv-0)",
    "var(--dv-1)",
    "var(--dv-2)",
    "var(--dv-3)",
    "var(--dv-4)",
    "var(--dv-5)",
  ],
  other: "var(--dv-other)",
  negative: "var(--dv-negative)",
  singleSeriesRest: "var(--dv-rest)",
  areaAlpha: "0.16",
  bandAlpha: "0.12",
  blueTint: "var(--dv-blue-tint)",
  blue5: "var(--dv-blue-5)",
  sequential: [
    "var(--dv-seq-0)",
    "var(--dv-seq-1)",
    "var(--dv-seq-2)",
    "var(--dv-seq-3)",
    "var(--dv-seq-4)",
  ],
  diverging: [
    "var(--dv-div-0)",
    "var(--dv-div-1)",
    "var(--dv-div-2)",
    "var(--dv-div-3)",
    "var(--dv-div-4)",
  ],
};

export function themeFor(kind: ThemeKind): GrokTheme {
  return {
    kind,
    ...palette,
    font: {
      family: "var(--font-sans), sans-serif",
      mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      heading1: style("2rem", "1.15", "-0.02em"),
      heading2: style("1.5rem", "1.25", "-0.015em"),
      heading3: style("1.25rem", "1.3", "-0.01em"),
      body1: style("1.05rem", "1.65"),
      body2: style("0.95rem", "1.55"),
      subtext: style("0.95rem", "1.5"),
      table: style("0.92rem", "1.45"),
      metric: style("1.75rem", "1.1", "-0.02em"),
      label: style("0.82rem", "1.3", "0.01em"),
      caption: style("0.8rem", "1.45"),
      code: style("0.9rem", "1.5"),
    },
    weight: { regular: 400, medium: 500, semibold: 600 },
    radius: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
    motion: { hover: "150ms", easing: "cubic-bezier(0.2, 0, 0, 1)" },
    dataviz,
    chart: [dataviz.categorical[0], dataviz.categorical[1], dataviz.categorical[2], dataviz.categorical[3]],
  };
}
