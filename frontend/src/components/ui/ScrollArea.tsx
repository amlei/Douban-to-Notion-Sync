import "./ScrollArea.css";

interface ScrollAreaProps {
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export function ScrollArea({ className, style, children }: ScrollAreaProps) {
  return (
    <div
      className={`overflow-y-auto scrollbar-thin ${className ?? ""}`}
      style={style}
    >
      {children}
    </div>
  );
}
