interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  icon?: React.ReactNode;
}

export function Input({ icon, className, ...rest }: InputProps) {
  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1.5 border border-solid border-[color:var(--border)] rounded-[var(--radius)] bg-[var(--bg-sidebar)] transition-[border-color] duration-150 focus-within:border-[color:var(--sky-400)] ${className ?? ""}`}
    >
      {icon && (
        <span className="flex shrink-0 text-[var(--text-light)]">{icon}</span>
      )}
      <input
        className="border-none outline-none bg-transparent text-[0.82rem] text-[var(--text)] w-full font-[inherit] placeholder:text-[var(--text-light)] placeholder:opacity-60"
        {...rest}
      />
    </div>
  );
}
