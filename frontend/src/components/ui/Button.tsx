interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "outline" | "ghost";
  size?: "sm" | "md";
  icon?: React.ReactNode;
  shape?: "square" | "circle";
  active?: boolean;
}

const BASE =
  "inline-flex items-center justify-center cursor-pointer font-[inherit] whitespace-nowrap transition duration-150 disabled:opacity-35 disabled:cursor-default";

export function Button({
  variant = "ghost",
  size = "md",
  icon,
  shape,
  active,
  className,
  children,
  ...rest
}: ButtonProps) {
  const iconOnly = !!icon && !children;

  let v: string;
  if (variant === "primary") {
    v =
      "bg-[var(--sky-500)] text-white rounded-md border-none hover:bg-[var(--sky-600)]";
  } else if (variant === "outline") {
    v = active
      ? "bg-[var(--sky-500)] text-white rounded-[var(--radius)] border border-solid border-[color:var(--sky-500)]"
      : "bg-transparent text-[var(--text)] rounded-[var(--radius)] border border-solid border-[color:var(--border)] hover:bg-[var(--bg-sidebar)]";
  } else {
    v =
      "bg-transparent text-[var(--text-light)] rounded-md border-none hover:bg-[var(--sky-50)] hover:text-[var(--text)]";
  }

  const s =
    size === "sm"
      ? iconOnly
        ? "w-7 h-7 p-0 text-[0.78rem] gap-1"
        : "px-2 min-w-7 h-7 text-[0.78rem] gap-1"
      : iconOnly
        ? "p-1.5 text-[0.85rem] gap-1.5"
        : "px-4 py-1.5 text-[0.85rem] gap-1.5";

  const shapeCls = shape === "circle" ? "rounded-full" : "";

  return (
    <button
      className={[BASE, v, s, shapeCls, className].filter(Boolean).join(" ")}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
