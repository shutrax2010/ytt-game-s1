import { MOVES } from "./game.js";

const STYLE = {
  jab:      { background: "#4fd6ff", color: "#053040", boxShadow: "0 6px 0 #2596bd" },
  straight: { background: "#ffd23f", color: "#3a2b00", boxShadow: "0 6px 0 #c79a10" },
  upper:    { background: "#ff4d4d", color: "#fff",    boxShadow: "0 6px 0 #a81616" },
};

export default function Controls({ disabled, activeMove, onPunch }) {
  return (
    <div style={{
      position: "relative", zIndex: 5, flexShrink: 0,
      display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10,
      padding: "16px 16px calc(20px + env(safe-area-inset-bottom))",
      background: "linear-gradient(#0a1430, #060c1e)",
      opacity: disabled ? 0.32 : 1, filter: disabled ? "grayscale(.3)" : "none",
      transition: "opacity .15s",
    }}>
      {Object.keys(MOVES).map((key) => (
        <button
          key={key}
          className="tb-btn"
          disabled={disabled}
          onPointerDown={(e) => { e.preventDefault(); onPunch(key); }}
          style={{ ...STYLE[key], transform: activeMove === key ? "translateY(4px)" : undefined }}
        >
          {MOVES[key].label}
          <span className="sub">{MOVES[key].sub}</span>
        </button>
      ))}
    </div>
  );
}
