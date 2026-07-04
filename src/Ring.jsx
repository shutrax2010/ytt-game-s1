import Opponent from "./Opponent.jsx";

const bungee = "Bungee, sans-serif";

// 一撃ごとのエフェクト（ダメージ数字 / 状態ピル / 叫びテキスト）
function Fx({ f }) {
  if (f.kind === "dmg") {
    const dx = ((f.id % 5) - 2) * 16;
    return (
      <div style={{
        position: "absolute", top: "36%", left: `calc(56% + ${dx}px)`, zIndex: 6, pointerEvents: "none",
        fontFamily: bungee, fontSize: 50, color: f.color, WebkitTextStroke: "3px #fff",
        textShadow: "3px 4px 0 rgba(0,0,0,.25)", animation: "tb-dmg .6s ease-out forwards",
      }}>{f.text}</div>
    );
  }
  if (f.kind === "pill") {
    return (
      <div style={{
        position: "absolute", top: "28%", left: "50%", transform: "translateX(-50%)", zIndex: 6, pointerEvents: "none",
        background: f.color, color: "#1a2233", font: "900 15px Archivo", padding: "6px 16px",
        borderRadius: 20, boxShadow: "0 4px 0 rgba(0,0,0,.3)", animation: "tb-pop .4s ease-out",
      }}>{f.text}</div>
    );
  }
  return (
    <div style={{
      position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)", zIndex: 6, pointerEvents: "none",
      fontFamily: bungee, fontSize: f.text === "KO!" ? 44 : 24, color: f.color, whiteSpace: "nowrap",
      WebkitTextStroke: "2px #7a3c00", textShadow: "3px 3px 0 #c81f1f", animation: "tb-pop .5s ease-out",
    }}>{f.text}</div>
  );
}

export default function Ring({ opp, fx, player, punchSeq, stunSeq, children }) {
  // パンチアニメ：ジャブ=左グローブ、ストレート/アッパー=右グローブ
  const leftAnim = player.state === "attacking" && player.move === "jab"
    ? "tb-punch-l .22s ease-out" : "none";
  const rightAnim = player.state === "attacking" && player.move === "straight"
    ? "tb-punch-r .32s ease-out"
    : player.state === "attacking" && player.move === "upper"
      ? "tb-punch-up .5s ease-out" : "none";

  return (
    <div key={stunSeq} style={{ position: "relative", flex: 1, overflow: "hidden", animation: stunSeq > 0 ? "tb-shake .55s" : "none" }}>
      {/* 観客席（ドットパターン）とスポットライト */}
      <div style={{ position: "absolute", inset: "0 0 auto 0", height: 120, background: "#0a1428", backgroundImage: "radial-gradient(circle, #1d2e55 1px, transparent 1px)", backgroundSize: "14px 14px" }} />
      <div style={{ position: "absolute", inset: "0 0 auto 0", height: 120, background: "radial-gradient(circle at 50% 120%, rgba(60,80,150,.4), transparent 60%)" }} />
      {/* ロープ */}
      <div style={{ position: "absolute", top: 118, left: 0, right: 0, height: 6, background: "#e23b3b", boxShadow: "0 14px 0 #f4f1e8, 0 28px 0 #e23b3b" }} />
      {/* マット */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, top: 170, background: "radial-gradient(ellipse at 50% 40%, #2f5cc9 0%, #16357f 55%, #0c2258 100%)" }} />
      <div style={{ position: "absolute", left: "50%", bottom: 0, transform: "translateX(-50%)", width: "120%", height: "60%", background: "radial-gradient(ellipse at 50% 100%, rgba(255,255,255,.14), transparent 70%)" }} />

      <Opponent no={opp.no} state={opp.state} />

      {fx.map((f) => <Fx key={f.id} f={f} />)}

      {/* プレイヤーグローブ（一人称） */}
      <div key={`l${punchSeq}`} style={{
        position: "absolute", bottom: -30, left: "2%", width: 150, height: 150, zIndex: 5,
        background: "radial-gradient(circle at 40% 30%, #ff6b6b, #b81a1a)", borderRadius: "50%",
        boxShadow: "inset -12px -12px 0 rgba(0,0,0,.2)", transform: "rotate(-16deg)", animation: leftAnim,
      }} />
      <div key={`r${punchSeq}`} style={{
        position: "absolute", bottom: -40, right: 0, width: 170, height: 170, zIndex: 5,
        background: "radial-gradient(circle at 40% 30%, #ff6b6b, #b81a1a)", borderRadius: "50%",
        boxShadow: "inset -12px -14px 0 rgba(0,0,0,.22)", transform: "rotate(14deg)", animation: rightAnim,
      }} />

      {/* 被弾スタンの赤フラッシュ（スタン 1 秒に合わせてフェードアウト） */}
      {player.state === "stunned" && (
        <div style={{ position: "absolute", inset: 0, zIndex: 7, pointerEvents: "none", background: "radial-gradient(circle, rgba(226,59,59,.35) 30%, rgba(226,59,59,.85))", animation: "tb-flash 1s ease-out forwards" }} />
      )}

      {children}
    </div>
  );
}
