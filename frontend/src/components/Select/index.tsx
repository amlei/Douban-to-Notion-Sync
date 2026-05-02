import "./Select.css";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export function Select({ className, children, ...rest }: SelectProps) {
  return (
    <select className={`select ${className ?? ""}`} {...rest}>
      {children}
    </select>
  );
}
