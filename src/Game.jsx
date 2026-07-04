import { useEffect, useReducer, useRef } from "react";
import { reducer, initialState } from "./game.js";
import { PGP } from "./pgp.js";
import Hud from "./Hud.jsx";
import Ring from "./Ring.jsx";
import Controls from "./Controls.jsx";

const bungee = "Bungee, sans-serif";
const mono = '"Chivo Mono", monospace';

// 待機画面の READY? バナー（HUD の代わりに表示）
function ReadyBanner({ oppNo }) {
  return (
    <div style={{ position: "relative", zIndex: 5, textAlign: "center", padding: "48px 16px 8px", flexShrink: 0 }}>
      <div style={{ fontFamily: bungee, fontSize: 64, color: "#ffcf33", lineHeight: 0.9, textShadow: "6px 6px 0 #ff4d4d, 0 0 30px rgba(255,207,51,.4)" }}>
        READY<span style={{ color: "#ff4d4d" }}>?</span>
      </div>
      <div style={{ font: "900 15px Archivo", color: "#c7cddd", marginTop: 8, letterSpacing: 1 }}>
        FIGHT #{oppNo} — 開始を待っています
      </div>
    </div>
  );
}

function ReadyHint() {
  return (
    <div style={{ position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)", textAlign: "center", zIndex: 6, width: "90%" }}>
      <div style={{ display: "inline-block", background: "rgba(6,12,30,.7)", border: "1px solid #2a3a66", borderRadius: 16, padding: "12px 18px" }}>
        <div style={{ font: "900 17px Archivo", color: "#ffcf33", marginBottom: 2 }}>タップで殴れ！</div>
        <div style={{ font: "700 12px Archivo", color: "#c7cddd" }}>ジャブ・ストレート・アッパーを使い分けよう</div>
      </div>
    </div>
  );
}

// 結果画面（TIME UP + 撃破数）
function Result({ kills }) {
  const chips = Math.min(kills, 12);
  return (
    <div style={{
      position: "relative", height: "100%", overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center",
      background: "radial-gradient(ellipse at 50% 30%, #1f3f96 0%, #0a1430 70%)",
    }}>
      <div style={{
        position: "absolute", inset: 0, opacity: 0.35,
        backgroundImage: "radial-gradient(circle, #ffcf33 2px, transparent 2px), radial-gradient(circle, #4fd6ff 2px, transparent 2px), radial-gradient(circle, #ff4d4d 2px, transparent 2px)",
        backgroundSize: "70px 90px, 110px 120px, 90px 70px",
        backgroundPosition: "0 0, 30px 40px, 60px 10px",
      }} />
      <div style={{ position: "relative", zIndex: 5, textAlign: "center", paddingTop: 90 }}>
        <div style={{ fontFamily: bungee, fontSize: 70, color: "#ffcf33", lineHeight: 0.9, textShadow: "6px 6px 0 #ff4d4d" }}>TIME<br />UP</div>
      </div>
      <div style={{ position: "relative", zIndex: 5, marginTop: 48, textAlign: "center" }}>
        <div style={{ font: `900 13px ${mono}`, letterSpacing: 4, color: "#9fb0d6" }}>撃破数</div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 6, marginTop: -6 }}>
          <span style={{ fontFamily: mono, fontWeight: 900, fontSize: 140, color: "#fff", lineHeight: 1, textShadow: "0 0 40px rgba(255,207,51,.6)", fontVariantNumeric: "tabular-nums" }}>{kills}</span>
          <span style={{ fontFamily: bungee, fontSize: 34, color: "#ffcf33" }}>人</span>
        </div>
      </div>
      <div style={{ position: "relative", zIndex: 5, font: "900 20px Archivo", color: "#ffcf33", marginTop: 14 }}>おつかれさま！</div>
      <div style={{ position: "relative", zIndex: 5, marginTop: 36, display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", width: 280 }}>
        {Array.from({ length: chips }, (_, i) => (
          <div key={i} style={{ width: 56, height: 56, borderRadius: 14, background: "#111a36", border: "1.5px solid #2a3a66", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: mono, fontWeight: 900, fontSize: 15, color: "#c7cddd" }}>#{i + 1}</span>
            <span style={{ fontSize: 14, color: "#3ddc84" }}>✔</span>
          </div>
        ))}
        {kills > chips && (
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "#111a36", border: "1.5px solid #2a3a66", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: mono, fontWeight: 900, fontSize: 15, color: "#ffcf33" }}>
            +{kills - chips}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Game() {
  const [st, dispatch] = useReducer(reducer, initialState);
  const killsRef = useRef(0);
  killsRef.current = st.kills;

  // pgp 握手：ready 送信 → init/start/stop を受ける
  useEffect(() => {
    PGP.onInit((m) => dispatch({ type: "init", seed: m.seed | 0, durationSec: m.durationSec > 0 ? m.durationSec : 180 }));
    PGP.onStart(() => dispatch({ type: "start", now: performance.now() }));
    PGP.onStop(() => dispatch({ type: "stop" }));

    // 例外時でも最小結果を送り、待機画面で固まらせない
    const onError = () => PGP.gameover({ finalScore: killsRef.current });
    window.addEventListener("error", onError);

    PGP.ready();

    // 単体起動（iframe 外・開発用）のみ自動スタート。プラットフォーム上では親の start を待つ
    let devTimer = null;
    if (window.self === window.top) {
      devTimer = setTimeout(() => {
        dispatch({ type: "init", seed: (Math.random() * 2 ** 31) | 0, durationSec: 180 });
        dispatch({ type: "start", now: performance.now() });
      }, 700);
    }
    return () => { window.removeEventListener("error", onError); if (devTimer) clearTimeout(devTimer); };
  }, []);

  // ゲームループ
  useEffect(() => {
    if (st.phase !== "playing") return;
    let raf;
    let last = performance.now();
    const loop = (now) => {
      dispatch({ type: "tick", now, dt: now - last });
      last = now;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [st.phase]);

  // 撃破のたびに現在の撃破数を送信（任意・A3 進行画面にライブ反映）
  const sentKills = useRef(0);
  useEffect(() => {
    if (st.kills !== sentKills.current) {
      sentKills.current = st.kills;
      PGP.score(st.kills);
    }
  }, [st.kills]);

  // 終了（時間切れ / stop）→ gameover を 1 回だけ送る（pgp.js 側で二重送信防止）
  useEffect(() => {
    if (st.phase === "ended") PGP.gameover({ finalScore: st.kills });
  }, [st.phase, st.kills]);

  if (st.phase === "ended") {
    return <div style={{ height: "100dvh" }}><Result kills={st.kills} /></div>;
  }

  const waiting = st.phase === "waiting";
  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "#0a1430" }}>
      {waiting ? <ReadyBanner oppNo={st.opp.no} /> : <Hud kills={st.kills} remainMs={st.remainMs} opp={st.opp} />}
      <Ring opp={st.opp} fx={st.fx} player={st.player} punchSeq={st.punchSeq} stunSeq={st.stunSeq}>
        {waiting && <ReadyHint />}
      </Ring>
      <Controls
        disabled={waiting || st.player.state === "stunned"}
        activeMove={st.player.state === "attacking" ? st.player.move : null}
        onPunch={(move) => dispatch({ type: "punch", move, now: performance.now() })}
      />
    </div>
  );
}
