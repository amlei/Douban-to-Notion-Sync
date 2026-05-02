import "./Input.css";

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  icon?: React.ReactNode;
}

export function Input({ icon, className, ...rest }: InputProps) {
  return (
    <div className={`input-wrap ${className ?? ""}`}>
      {icon && <span className="input-icon">{icon}</span>}
      <input className="input-field" {...rest} />
    </div>
  );
}
