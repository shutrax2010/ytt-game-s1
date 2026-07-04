// ゲームロジック（純粋 reducer）。時刻は action で渡し、乱数状態も state に持つため決定的。

// --- 技の特性（docs/boxing-game-spec.md §3 初期値） ---
export const MOVES = {
  jab:      { label: "ジャブ",    sub: "軽·速", dmg: 4,  recoveryMs: 200 },
  straight: { label: "ストレート", sub: "中",    dmg: 9,  recoveryMs: 600 },
  upper:    { label: "アッパー",   sub: "重·強", dmg: 18, recoveryMs: 900 },
};

export const STUN_MS = 1000;       // 被弾スタン（行動不能 1 秒）
const STAGGER_MS = 1100;           // ガードブレイクのよろけ
const KO_MS = 900;                 // KO 演出 → 次の相手
const ATTACK_MS = 200;             // 相手の攻撃モーション

// 対戦相手カラーバリエーション（Claude Design「5 — 対戦相手カラーバリエーション」）
export const THEMES = [
  { name: "レッド",   tag: "#ff4d4d", head: "#e23b3b", glove: "#c81f1f", gloveHi: "#ff6b6b", torso1: "#3a4a68", torso2: "#26324c", trunk: "#ffcf33", skin: "#e0a074" },
  { name: "ブルー",   tag: "#4fd6ff", head: "#2b7fd4", glove: "#1c5fb0", gloveHi: "#6fb8ff", torso1: "#12325e", torso2: "#0c2247", trunk: "#4fd6ff", skin: "#c98d63" },
  { name: "イエロー", tag: "#ffd23f", head: "#ffbf1f", glove: "#e08a00", gloveHi: "#ffd870", torso1: "#3a3520", torso2: "#282413", trunk: "#ffd23f", skin: "#8a5a3c" },
  { name: "グリーン", tag: "#3ddc84", head: "#1f9d5c", glove: "#137a44", gloveHi: "#5fe6a0", torso1: "#123a2c", torso2: "#0c281e", trunk: "#3ddc84", skin: "#e6b98c" },
  { name: "パープル", tag: "#b478ff", head: "#8a4fd4", glove: "#6a2fb0", gloveHi: "#c79bff", torso1: "#2a1f4a", torso2: "#1c1435", trunk: "#b478ff", skin: "#7a4f38" },
  { name: "ピンク",   tag: "#ff6fb5", head: "#e0479a", glove: "#c41f78", gloveHi: "#ff9bd0", torso1: "#4a1f3a", torso2: "#351428", trunk: "#ff6fb5", skin: "#d99e78" },
];

export const themeOf = (no) => THEMES[(no - 1) % THEMES.length];

// --- 難易度スケール（§6：倒すごとにライフ増・予兆短縮・ガード/回避/攻撃頻度アップ） ---
export function oppSpec(no) {
  const n = no - 1;
  return {
    hp: Math.min(60 + n * 20, 300),
    telegraphMs: Math.max(350, 650 - n * 55),
    attackW: Math.min(0.46, 0.20 + n * 0.045),
    guardW:  Math.min(0.30, 0.16 + n * 0.035),
    dodgeW:  Math.min(0.22, 0.08 + n * 0.03),
    idleMin: Math.max(180, 450 - n * 40),
    idleMax: Math.max(360, 850 - n * 70),
    speed:   Math.max(0.55, 1 - n * 0.05),   // ガード/回避の持続を短縮＝行動のテンポを上げる
  };
}

// mulberry32 の 1 ステップ（純粋版）：seed 固定で相手の挙動が全プレイヤー同一になる（§8）
function rngNext(s) {
  s = (s + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return { v: ((t ^ (t >>> 14)) >>> 0) / 4294967296, s };
}

export const initialState = {
  phase: "waiting",                // waiting → playing → ended
  durationSec: 180,
  remainMs: 180 * 1000,
  rng: 1,
  kills: 0,
  fx: [],                          // { id, kind:"dmg"|"pill"|"shout", text, color, until }
  fxId: 1,
  punchSeq: 0,                     // グローブアニメ再生用
  stunSeq: 0,                      // 被弾フラッシュ/シェイク再生用
  opp: { no: 1, hp: 30, maxHp: 30, state: "idle", until: 0 },
  player: { state: "ready", until: 0, move: null },
};

const newOpponent = (no, now) => ({
  no,
  hp: oppSpec(no).hp,
  maxHp: oppSpec(no).hp,
  state: "idle",
  until: now + 700,
});

function addFx(st, kind, text, color, now, ttl) {
  return {
    fx: [...st.fx, { id: st.fxId, kind, text, color, until: now + ttl }],
    fxId: st.fxId + 1,
  };
}

export function reducer(state, action) {
  switch (action.type) {
    case "init":
      return {
        ...state,
        rng: action.seed | 0,
        durationSec: action.durationSec,
        remainMs: action.durationSec * 1000,
      };

    case "start":
      if (state.phase !== "waiting") return state;
      return {
        ...state,
        phase: "playing",
        opp: newOpponent(1, action.now),
      };

    case "stop":
      if (state.phase === "ended") return state;
      return { ...state, phase: "ended", fx: [] };

    case "punch":
      return punch(state, action.move, action.now);

    case "tick":
      return tick(state, action.now, action.dt);

    default:
      return state;
  }
}

// --- タップ攻撃：技 × 相手状態 ダメージ表（§4）を解決する ---
function punch(state, move, now) {
  if (state.phase !== "playing") return state;
  if (state.player.state !== "ready") return state;   // 硬直/スタン中は入力無視

  const m = MOVES[move];
  let st = {
    ...state,
    punchSeq: state.punchSeq + 1,
    player: { state: "attacking", until: now + m.recoveryMs, move },
  };
  let opp = { ...st.opp };
  let dmg = 0;

  switch (opp.state) {
    case "ko":
      return { ...st, opp };
    case "dodge":                                     // 回避中は空振り
      return { ...st, opp, ...addFx(st, "pill", "回避!", "#6be675", now, 700) };
    case "guard":
      if (move === "jab") {                           // ジャブはほぼ無効
        return { ...st, opp, ...addFx(st, "pill", "ガード!", "#9aa7bd", now, 700) };
      }
      if (move === "straight") {                      // ストレートは半減
        dmg = Math.ceil(m.dmg / 2);
      } else {                                        // アッパーでガードブレイク
        dmg = 6;
        opp.state = "stagger";
        opp.until = now + STAGGER_MS;
        st = { ...st, ...addFx(st, "shout", "ガードブレイク!", "#ff8a1e", now, 800) };
      }
      break;
    case "telegraph":
      if (move === "jab") {                           // 割り込み成功＝カウンター
        dmg = 6;
        opp.state = "hit";
        opp.until = now + 300;
        st = { ...st, ...addFx(st, "shout", "カウンター!", "#ffcf33", now, 800) };
      } else {
        dmg = m.dmg;                                  // 当たるが予兆はキャンセルできない
      }
      break;
    default:                                          // idle / attack / hit / stagger
      dmg = m.dmg;
      if (opp.state === "idle" || opp.state === "attack") {
        opp.state = "hit";
        opp.until = now + 260;
      } else if (opp.state === "hit") {
        opp.until = now + 260;                        // 連打でのけぞり延長
      }
      break;
  }

  opp.hp = Math.max(0, opp.hp - dmg);
  if (dmg > 0) st = { ...st, ...addFx(st, "dmg", String(dmg), "#e23b3b", now, 600) };

  if (opp.hp === 0) {                                 // 撃破 → KO 演出 → 次の相手
    opp.state = "ko";
    opp.until = now + KO_MS;
    st = { ...st, kills: st.kills + 1, ...addFx(st, "shout", "KO!", "#ffcf33", now, 900) };
  }
  return { ...st, opp };
}

// --- 時間経過：タイマー・硬直/スタン解除・相手 AI の状態遷移 ---
function tick(state, now, dt) {
  if (state.phase !== "playing") return state;

  const remainMs = state.remainMs - dt;
  if (remainMs <= 0) return { ...state, remainMs: 0, phase: "ended", fx: [] };

  let st = { ...state, remainMs };

  if (st.player.state !== "ready" && now >= st.player.until) {
    st.player = { state: "ready", until: 0, move: null };
  }

  st.fx = st.fx.filter((f) => f.until > now);

  const opp = st.opp;
  if (now >= opp.until) {
    const spec = oppSpec(opp.no);
    let rs = st.rng;
    const roll = () => { const o = rngNext(rs); rs = o.s; return o.v; };
    const idleFor = () => spec.idleMin + roll() * (spec.idleMax - spec.idleMin);

    switch (opp.state) {
      case "idle": {                                  // 次の行動を seed 乱数で決定
        const v = roll();
        if (v < spec.attackW) {
          st.opp = { ...opp, state: "telegraph", until: now + spec.telegraphMs };
        } else if (v < spec.attackW + spec.guardW) {
          st.opp = { ...opp, state: "guard", until: now + (500 + roll() * 450) * spec.speed };
        } else if (v < spec.attackW + spec.guardW + spec.dodgeW) {
          st.opp = { ...opp, state: "dodge", until: now + (400 + roll() * 250) * spec.speed };
        } else {
          st.opp = { ...opp, state: "idle", until: now + idleFor() };
        }
        break;
      }
      case "telegraph": {                             // 攻撃発生：手を出していたら被弾（§5）
        if (st.player.state === "attacking") {
          st.player = { state: "stunned", until: now + STUN_MS, move: null };
          st.stunSeq = st.stunSeq + 1;
        }
        st.opp = { ...opp, state: "attack", until: now + ATTACK_MS };
        break;
      }
      case "ko":
        st.opp = newOpponent(opp.no + 1, now);
        break;
      default:                                        // guard / dodge / attack / hit / stagger → idle
        st.opp = { ...opp, state: "idle", until: now + idleFor() };
        break;
    }
    st.rng = rs;
  }

  return st;
}
