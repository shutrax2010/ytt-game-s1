const mono = '"Chivo Mono", monospace';

export default function Hud({ kills, remainMs, opp }) {
  const sec = Math.max(0, Math.ceil(remainMs / 1000));
  const time = `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
  const pct = Math.round((opp.hp / opp.maxHp) * 100);

  return (
    <div style={{ position: "relative", zIndex: 5, padding: "16px 20px 12px", flexShrink: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ font: `700 10px ${mono}`, letterSpacing: 2, color: "#8b93a8" }}>撃破</span>
          <span style={{ fontFamily: mono, fontWeight: 900, fontSize: 30, color: "#ffcf33", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {kills}<span style={{ fontSize: 14, color: "#c7cddd" }}>人</span>
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <span style={{ font: `700 10px ${mono}`, letterSpacing: 2, color: "#8b93a8" }}>⏱ TIME</span>
          <span style={{ fontFamily: mono, fontWeight: 900, fontSize: 34, color: "#f4f1e8", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{time}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <span style={{ font: `700 10px ${mono}`, letterSpacing: 2, color: "#8b93a8" }}>相手</span>
          <span style={{ fontFamily: mono, fontWeight: 900, fontSize: 30, color: "#f4f1e8", lineHeight: 1 }}>#{opp.no}</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ font: "900 10px Archivo", color: "#ff8a8a", width: 34 }}>LIFE</span>
        <div style={{ flex: 1, height: 14, background: "#26304a", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg, #ff4d4d, #ff8a1e)", borderRadius: 4, transition: "width .15s" }} />
        </div>
        <span style={{ font: `900 12px ${mono}`, color: "#ff8a1e", fontVariantNumeric: "tabular-nums", width: 38, textAlign: "right" }}>{pct}%</span>
      </div>
    </div>
  );
}
