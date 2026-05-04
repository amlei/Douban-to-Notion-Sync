interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export function Select({ className, children, ...rest }: SelectProps) {
  return (
    <select
      className={`px-2 py-1.5 border border-solid border-[color:var(--border)] rounded-[var(--radius)] bg-[var(--bg-sidebar)] text-[var(--text)] text-[0.82rem] font-[inherit] cursor-pointer outline-none transition-[border-color] duration-150 focus:border-[color:var(--sky-400)] ${className ?? ""}`}
      {...rest}
    >
      {children}
    </select>
  );
}
