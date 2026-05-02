import { useTheme, type Theme } from "../../../../contexts/ThemeContext";

const themeOptions: { value: Theme; label: string }[] = [
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
  { value: "system", label: "跟随系统" },
];

export function GeneralSettings() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="panel-modal-page">
      <p style={{ fontSize: "0.95rem", color: "var(--text)", margin: 0, fontWeight: 500 }}>主题</p>
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        {themeOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setTheme(opt.value)}
            style={{
              flex: 1,
              padding: "10px 0",
              borderRadius: "var(--radius)",
              border: "1.5px solid",
              borderColor: theme === opt.value ? "var(--sky-500)" : "var(--border)",
              background: theme === opt.value ? "var(--sky-50)" : "transparent",
              color: theme === opt.value ? "var(--sky-600)" : "var(--text-light)",
              fontSize: "0.95rem",
              fontWeight: theme === opt.value ? 500 : 400,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
