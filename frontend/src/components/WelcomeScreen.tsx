import { useState } from "react";
import "./WelcomeScreen.css";
import { Send } from "lucide-react";

interface WelcomeScreenProps {
  onSend: (text: string) => void;
}

export function WelcomeScreen({ onSend }: WelcomeScreenProps) {
  const [input, setInput] = useState("");

  const handleSubmit = () => {
    if (!input.trim()) return;
    onSend(input);
    setInput("");
  };

  return (
    <div className="welcome fade-in">
      <div className="brand">LifeInk AI</div>
      <div className="input-box">
        <textarea
          rows={4}
          placeholder="询问你的阅读、观影、日记..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
        <button className="send-btn" onClick={handleSubmit}>
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
