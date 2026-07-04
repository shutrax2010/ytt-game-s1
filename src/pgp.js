// pgp postMessage SDK（docs/3rd-game-dev-guide.md 準拠）
// 親（プラットフォーム）とのみ通信し、channel:"pgp" が付かない受信は無視する。
const handlers = {};

window.addEventListener("message", (e) => {
  const m = e.data;
  if (m && m.channel === "pgp") handlers[m.type]?.(m);
});

const send = (m) => window.parent.postMessage({ channel: "pgp", ...m }, "*");

let gameoverSent = false;

export const PGP = {
  onInit: (cb) => (handlers.init = cb),   // { seed, durationSec, gameType, player }
  onStart: (cb) => (handlers.start = cb),
  onStop: (cb) => (handlers.stop = cb),   // 時間切れ / GM 終了 → 集計して gameover
  ready: () => send({ type: "ready" }),   // 握手の起点
  score: (v) => {
    if (Number.isFinite(v) && v >= 0) send({ type: "score", value: v });
  },
  gameover: (r) => {
    if (gameoverSent) return;             // どの終了経路でも 1 回だけ送る
    gameoverSent = true;
    send({ type: "gameover", ...r });
  },
};
