"use client";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/* ---------------- Botões ---------------- */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "bare";
  size?: "sm" | "md";
};

export function Button({ variant = "ghost", size = "md", className, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-[30px] px-2.5 text-[12.5px]" : "h-9 px-3.5 text-[13px]",
        variant === "primary" &&
          "border-line-strong bg-accent font-semibold text-ink hover:border-ink-faint hover:bg-accent-hover",
        variant === "ghost" &&
          "border-line bg-surface text-ink hover:border-line-strong hover:bg-surface-2",
        variant === "danger" && "border-transparent bg-transparent text-danger hover:bg-[#2a1a18]",
        variant === "bare" &&
          "border-transparent bg-transparent text-ink-dim hover:bg-[#2b2b2b] hover:text-ink",
        className,
      )}
    />
  );
}

/** Botão quadrado da barra flutuante (só ícone). */
export function IconButton({
  label,
  active,
  danger,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      {...props}
      className={cx(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-transparent transition",
        danger
          ? "text-ink-dim hover:bg-[#2a1a18] hover:text-danger"
          : active
            ? "bg-[#2b2b2b] text-ink"
            : "text-ink-dim hover:bg-[#2b2b2b] hover:text-ink",
        className,
      )}
    />
  );
}

/* ---------------- Controles compactos ---------------- */

export function MiniSelect({
  options,
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  options: { value: string | number; label: string; style?: React.CSSProperties }[];
}) {
  return (
    <select
      {...props}
      className={cx(
        "h-8 cursor-pointer rounded-lg border border-line bg-surface pl-2.5 pr-7 text-[12.5px] text-ink outline-none transition hover:border-line-strong focus:border-line-strong",
        className,
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} style={o.style}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Amostra de cor: clicar abre o seletor nativo do sistema. */
export function Swatch({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <label
      title={label}
      className="relative inline-flex size-8 cursor-pointer items-center justify-center rounded-lg transition hover:bg-[#2b2b2b]"
    >
      <span
        className="size-[18px] rounded-[5px] border border-line-strong"
        style={{ background: value }}
      />
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label={label}
      />
    </label>
  );
}

export function MiniSlider({
  label,
  value,
  onChange,
  min,
  max,
  suffix = "",
  width = 92,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  suffix?: string;
  width?: number;
}) {
  return (
    <div className="flex items-center gap-2 px-1">
      <span className="text-[11.5px] text-ink-faint">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width }}
      />
      <span className="w-9 shrink-0 text-right text-[11.5px] tabular-nums text-ink-faint">
        {value}
        {suffix}
      </span>
    </div>
  );
}

/** Pílula da barra "adicionar", abaixo do banner. */
export function Chip({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        "inline-flex h-7 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[12px] text-ink-dim transition hover:border-line-strong hover:bg-surface-2 hover:text-ink",
        className,
      )}
    />
  );
}

export function Divider() {
  return <span className="mx-0.5 h-5 w-px shrink-0 bg-line" />;
}

/* ---------------- Ícones ---------------- */

const iconProps = {
  width: 15,
  height: 15,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const Icon = {
  Trash: () => (
    <svg {...iconProps}>
      <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.5 8h6l.5-8" />
    </svg>
  ),
  Upload: () => (
    <svg {...iconProps}>
      <path d="M8 10.5V3M5 6l3-3 3 3M3 11v2h10v-2" />
    </svg>
  ),
  Link: () => (
    <svg {...iconProps}>
      <path d="M6.5 9.5 9.5 6.5M7 4.5 8.5 3a2.5 2.5 0 0 1 3.5 3.5L10.5 8M5.5 8 4 9.5A2.5 2.5 0 0 0 7.5 13L9 11.5" />
    </svg>
  ),
  Front: () => (
    <svg {...iconProps}>
      <rect x="2.5" y="2.5" width="7" height="7" rx="1.5" />
      <path d="M6.5 12.5h6a1 1 0 0 0 1-1v-6" />
    </svg>
  ),
  Back: () => (
    <svg {...iconProps}>
      <rect x="6.5" y="6.5" width="7" height="7" rx="1.5" />
      <path d="M9.5 3.5h-6a1 1 0 0 0-1 1v6" />
    </svg>
  ),
  Layers: () => (
    <svg {...iconProps}>
      <path d="M8 2.5 14 6l-6 3.5L2 6l6-3.5ZM2.5 9.5 8 12.7l5.5-3.2" />
    </svg>
  ),
  Plus: () => (
    <svg {...iconProps} width={13} height={13}>
      <path d="M8 3.5v9M3.5 8h9" />
    </svg>
  ),
};
