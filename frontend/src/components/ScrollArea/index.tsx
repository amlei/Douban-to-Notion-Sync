import "./ScrollArea.css";

interface ScrollAreaProps {
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export function ScrollArea({ className, style, children }: ScrollAreaProps) {
  return (
    <div className={`scroll-area ${className ?? ""}`} style={style}>
      {children}
    </div>
  );
}
