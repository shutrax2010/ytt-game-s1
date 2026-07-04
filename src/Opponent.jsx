import { themeOf } from "./game.js";

// Claude Design「2 — 相手の状態バリエーション」「5 — カラーバリエーション」の div アートを React 化
const gloveStyle = (t, size) => ({
  position: "absolute",
  width: size,
  height: size,
  background: `radial-gradient(circle at 35% 30%, ${t.gloveHi}, ${t.glove})`,
  borderRadius: "50% 50% 46% 46%",
  boxShadow: "inset -6px -6px 0 rgba(0,0,0,.18)",
  transition: "top .06s, left .06s, right .06s, transform .06s",
});

const eyeStyle = (side) => ({
  position: "absolute", top: 44, [side]: 24, width: 24, height: 24,
  background: "#fff", borderRadius: "50%",
});
const pupilStyle = { position: "absolute", top: 6, left: 8, width: 9, height: 9, background: "#0c1220", borderRadius: "50%" };
const browStyle = (side) => ({
  position: "absolute", top: 34, [side]: 20, width: 30, height: 8,
  background: "#0c1220", borderRadius: 4,
  transform: `rotate(${side === "left" ? 12 : -12}deg)`,
});
const xEyeStyle = (side) => ({
  position: "absolute", top: 40, [side]: 26,
  font: "900 22px Archivo", color: "#0c1220",
});

const starburst = (
  <div style={{
    position: "absolute", top: 20, left: "56%", width: 120, height: 120, pointerEvents: "none",
    background: "radial-gradient(circle, #fff 0%, #ffcf33 35%, transparent 65%)",
    clipPath: "polygon(50% 0,61% 35%,100% 20%,72% 50%,100% 80%,61% 66%,50% 100%,39% 66%,0 80%,28% 50%,0 20%,39% 35%)",
  }} />
);

function KoArt({ t }) {
  return (
    <div style={{ position: "relative", width: 200, height: 250 }}>
      <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 20, color: "#ffcf33", display: "inline-block", animation: "tb-spin 3s linear infinite" }}>★</span>
        <span style={{ fontSize: 28, color: "#ff8a1e", display: "inline-block", animation: "tb-spin 2.2s linear infinite" }}>★</span>
        <span style={{ fontSize: 18, color: "#4fd6ff", display: "inline-block", animation: "tb-spin 3.4s linear infinite" }}>★</span>
      </div>
      <div style={{ position: "absolute", top: 40, left: "50%", transform: "translateX(-50%)", width: 200, height: 180 }}>
        <div style={{ position: "absolute", top: 70, left: "50%", transform: "translateX(-50%)", width: 150, height: 70, background: `linear-gradient(${t.torso1}, ${t.torso2})`, borderRadius: 26 }} />
        <div style={{ position: "absolute", top: 80, left: "50%", transform: "translateX(-50%)", width: 96, height: 40, background: t.trunk, borderRadius: 8 }} />
        <div style={{ position: "absolute", top: 64, left: -6, width: 92, height: 92, background: t.skin, borderRadius: "50%", boxShadow: "inset -8px -6px 0 rgba(0,0,0,.12)" }}>
          <div style={{ position: "absolute", top: -6, right: -4, left: 24, height: 38, background: t.head, borderRadius: "40px 60px 20px 40px" }} />
          <div style={{ position: "absolute", top: 40, left: 26, font: "900 20px Archivo", color: "#0c1220" }}>×</div>
          <div style={{ position: "absolute", top: 40, left: 48, font: "900 20px Archivo", color: "#0c1220" }}>×</div>
        </div>
        <div style={{ ...gloveStyle(t, 54), top: 96, right: -4 }} />
        <div style={{ ...gloveStyle(t, 52), top: 40, right: 12 }} />
      </div>
    </div>
  );
}

export default function Opponent({ no, state }) {
  const t = themeOf(no);

  // 状態ごとの全身の傾き（回避=ウィービング / 被弾=のけぞり / よろけ）
  const tilt =
    state === "dodge"   ? "rotate(-16deg) translateX(-14px)" :
    state === "hit"     ? "rotate(8deg) translateY(-6px)" :
    state === "stagger" ? "rotate(-10deg) translateY(2px)" :
    "none";

  const guard = state === "guard";
  const telegraph = state === "telegraph";
  const attack = state === "attack";
  const showFace = !guard;

  return (
    <div style={{
      position: "absolute", top: "46%", left: "50%", width: 200, height: 280,
      transform: "translate(-50%, -50%)",
      animation: state === "ko" ? "none" : "tb-bob 1.6s ease-in-out infinite",
    }}>
      {state === "ko" ? <KoArt t={t} /> : (
        <>
          {telegraph && (
            <>
              <div style={{
                position: "absolute", top: 20, left: "50%", marginLeft: -80, width: 160, height: 160, borderRadius: "50%",
                background: "radial-gradient(circle, transparent 55%, rgba(255,59,59,.55) 56%, transparent 70%)",
                animation: "tb-warn .45s ease-in-out infinite",
              }} />
              <div style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", fontFamily: "Bungee, sans-serif", fontSize: 30, color: "#ff3b3b", textShadow: "2px 2px 0 #4a0000" }}>!</div>
            </>
          )}

          <div style={{ position: "relative", width: 200, height: 280, transform: tilt, transition: "transform .06s ease-out" }}>
            {/* 胴体・トランクス */}
            <div style={{ position: "absolute", top: 120, left: "50%", transform: "translateX(-50%)", width: 150, height: 150, background: `linear-gradient(${t.torso1}, ${t.torso2})`, borderRadius: "40px 40px 24px 24px" }} />
            <div style={{ position: "absolute", top: 130, left: "50%", transform: "translateX(-50%)", width: 52, height: 120, background: t.trunk, borderRadius: 12 }} />

            {/* 頭・ヘッドギア・顔 */}
            <div style={{ position: "absolute", top: 36, left: "50%", transform: "translateX(-50%)", width: 112, height: 112, background: t.skin, borderRadius: "50%", boxShadow: "inset -10px -8px 0 rgba(0,0,0,.12)" }}>
              <div style={{ position: "absolute", top: -8, left: -6, right: -6, height: 46, background: t.head, borderRadius: "60px 60px 40px 40px / 60px 60px 20px 20px" }} />
              {showFace && (state === "hit" || state === "stagger" ? (
                <>
                  <div style={xEyeStyle("left")}>×</div>
                  <div style={xEyeStyle("right")}>×</div>
                </>
              ) : (
                <>
                  <div style={eyeStyle("left")}><div style={pupilStyle} /></div>
                  <div style={eyeStyle("right")}><div style={pupilStyle} /></div>
                  <div style={browStyle("left")} />
                  <div style={browStyle("right")} />
                </>
              ))}
              {showFace && (telegraph
                ? <div style={{ position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)", width: 24, height: 18, background: "#5a1a1a", borderRadius: "50%" }} />
                : <div style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", width: 34, height: 12, background: "#7a2b2b", borderRadius: "0 0 16px 16px" }} />)}
            </div>

            {/* グローブ：ガード=顔前 / 予兆=引き絞り / 攻撃=突き出し / 通常=構え */}
            {guard ? (
              <>
                <div style={{ ...gloveStyle(t, 64), top: 78, left: 14 }} />
                <div style={{ ...gloveStyle(t, 64), top: 78, right: 14 }} />
              </>
            ) : telegraph ? (
              <>
                <div style={{ ...gloveStyle(t, 58), top: 158, left: -2 }} />
                <div style={{ ...gloveStyle(t, 72), top: 96, right: -20, transform: "scale(1.08)" }} />
              </>
            ) : attack ? (
              <>
                <div style={{ ...gloveStyle(t, 58), top: 158, left: -2 }} />
                <div style={{ ...gloveStyle(t, 96), top: 120, right: 40, transform: "scale(1.35)", zIndex: 3 }} />
              </>
            ) : (
              <>
                <div style={{ ...gloveStyle(t, 66), top: 150, left: -6 }} />
                <div style={{ ...gloveStyle(t, 66), top: 150, right: -6 }} />
              </>
            )}
          </div>

          {state === "hit" && starburst}
          {state === "dodge" && (
            <div style={{ position: "absolute", bottom: 70, right: -4, fontFamily: "Bungee, sans-serif", fontSize: 18, color: "#6be675", textShadow: "2px 2px 0 #04361d" }}>〜〜</div>
          )}
          {state === "stagger" && (
            <div style={{ position: "absolute", top: -4, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 6 }}>
              <span style={{ fontSize: 16, color: "#ffcf33", display: "inline-block", animation: "tb-spin 2.4s linear infinite" }}>★</span>
              <span style={{ fontSize: 20, color: "#ff8a1e", display: "inline-block", animation: "tb-spin 1.8s linear infinite" }}>★</span>
              <span style={{ fontSize: 14, color: "#4fd6ff", display: "inline-block", animation: "tb-spin 2.8s linear infinite" }}>★</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
