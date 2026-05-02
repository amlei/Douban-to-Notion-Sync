import "./Button.css";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "outline" | "ghost";
  size?: "sm" | "md";
  icon?: React.ReactNode;
  shape?: "square" | "circle";
  active?: boolean;
}

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
  const cls = [
    "btn",
    `btn--${variant}`,
    `btn--${size}`,
    iconOnly && "btn--icon-only",
    shape === "circle" && "btn--circle",
    active && "btn--active",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={cls} {...rest}>
      {icon}
      {children}
    </button>
  );
}
