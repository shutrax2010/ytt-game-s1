# 3rd 連携：ゲーム開発者向け 実装ガイド

パーティゲームプラットフォームに iframe + postMessage 方式で組み込む **3rd パーティ製ゲーム側**が実装すべき機能・処理の一覧と実装例。プロトコルは `3rd-game-spec.md`、プラットフォーム側は `platform-3rd-integration-spec.md` を参照。

## 概要

ゲームはプラットフォームのプレイヤー画面内の `<iframe>` にロードされ、親ウィンドウ（プラットフォーム）と `window.postMessage` でやり取りする。Socket.IO は不要。すべてのメッセージに `channel: "pgp"` を付ける。ゲームは URL 単体で完結し、毎ラウンド新規ロードされる前提で作る。

---

## クイックスタート（5 ステップ）

最短の流れ。詳細は後続の各章を参照。

1. **スマホのゲームアプリを作る（iframe 前提）**: HTML か React で、スマホ縦・タッチ操作の 2〜3 分ゲームを作る。iframe に 100% 追従し、スクロール/ズームは抑止する。スコア制かタイム制のどちらかを決める。
2. **pgp postMessage を組み込む**: 親と postMessage でやり取りする処理を入れる。ロード完了で `ready` を送り、`init`（seed・制限時間）を受けて `start` で開始、`stop`（時間切れ・GM 終了）で終了。プレイ中は任意でスコア/進捗を送り、終了時に `gameover` を必ず 1 回送る（→ §「実装例 1・2」）。
3. **ゲームアプリを公開する（Vercel、iframe 許可）**: Vercel などに HTTPS でデプロイする。iframe 埋め込みをブロックしないよう `X-Frame-Options` を付けない（または CSP `frame-ancestors` にプラットフォームのドメインを許可）。Vercel は既定で `X-Frame-Options` を付けないためそのまま埋め込めることが多い。付与/CSP 設定している場合は `vercel.json` の `headers` で調整する。
4. **登録 JSON を作る**: `id` / `title` / `url`（公開した URL）/ `type`（`score` か `time`）などを書く（→ §「実装例 4」）。
5. **プラットフォームに JSON をアップロードする**: 管理画面の「3rd ゲーム管理」からアップロードして登録する。以降はゲーム選択画面の 3RD エリアに出て、内蔵ゲームと同じように大会で使える。

最小の JSON 例:

```json
{
  "id": "tap-master",
  "title": "Tap Master",
  "url": "https://tap-master.vercel.app/",
  "type": "score"
}
```

---

## 必要な機能・処理の一覧

### 起動（開始処理）

| 項目 | 必須 | 処理内容 |
| --- | --- | --- |
| `pgp:ready` 送信 | 必須 | ロード完了時に親へ送る。**これが握手の起点**。送るまで開始されない |
| `pgp:start` 待ち | 必須 | 受信するまでゲームを始めない。それまでは「準備中」表示で待機 |
| `pgp:init` 反映 | 必須 | `seed`（乱数固定・公平性）、`durationSec`（残り時間表示に利用可）、`gameType`、`player` を受け取り利用 |

### 終了処理

| 項目 | 必須 | 処理内容 |
| --- | --- | --- |
| `pgp:stop` に即応 | 必須 | 時間切れ／GM 終了で届く。入力を止め集計し、**1 秒以内に** `pgp:gameover` を返す |
| 早期終了の自発報告 | 必須 | クリア・ゲームオーバー等で終わったら自分から `pgp:gameover` を送り、入力を止める |
| `pgp:gameover` 一意送信 | 必須 | どんな終わり方でも**必ず 1 回だけ**送る（送信済みフラグで二重送信防止） |
| 集計不能時 | 必須 | 例外時でも最小結果（score 0 / cleared false）を送り、待機画面で固まらせない |

### スコア・進捗送信

| 項目 | 必須 | 処理内容 |
| --- | --- | --- |
| `pgp:score` | 任意 | score 制の途中スコア。value は**現在の合計スコア**（差分でない有限数値） |
| `pgp:progress` | 任意 | time 制の進捗。value は **0〜1** |
| 送信頻度 | — | 意味ある変化時 or 1 秒に 1 回程度で十分（親が 1回/秒にスロットル。毎フレーム送信は避ける） |
| 最終値 | 必須 | サーバーは `gameover` を正とする。最終値は必ず `pgp:gameover` に入れる |
| 数値の健全性 | 必須 | NaN/Infinity/負値を送らない。整数・ミリ秒などフォーマットを守る |

### 画面サイズ・操作

| 項目 | 必須 | 処理内容 |
| --- | --- | --- |
| iframe に追従 | 必須 | 固定サイズ前提にせず `width/height:100%`（`100dvh` 相当）で親に追従 |
| スクロール抑止 | 必須 | `overflow:hidden` ＋ `overscroll-behavior:contain` ＋ `touch-action:none` で単一ビューに収める |
| タッチ操作 | 必須 | pointer/touch で実装。タップ対象 44px 以上、操作 UI は下寄り。マウス/キー代替は任意 |
| 音の解禁 | 必須 | iOS 制限のため自動再生しない。初回タッチで解禁。無音でも遊べる |
| リサイズ追従 | 推奨 | 親のサイズ変化・回転に追従。基本は縦向き想定 |

### コーディング・ホスティング制約

| 項目 | 必須 | 処理内容 |
| --- | --- | --- |
| `channel:"pgp"` 厳守 | 必須 | 送受信すべてに付与。付いていない受信は無視 |
| 通信は親のみ | 必須 | `parent.postMessage` で送信、`message` イベントで受信。親 DOM への直接アクセス不可 |
| トップ遷移禁止 | 必須 | `window.top` 書き換え・全ページ遷移・`target="_top"`・ポップアップ・`alert/confirm` を使わない |
| iframe 埋め込み許可 | 必須 | 配信サーバーが `X-Frame-Options`／CSP `frame-ancestors` で埋め込みをブロックしない |
| HTTPS 配信 | 必須 | 親が https のため https 必須。アセットも全て https（mixed-content 回避） |
| URL 単体で完結 | 必須 | 登録 URL を開けばゲーム一式がロードされる。base path を配信 URL に合わせる |
| storage 非依存 | 必須 | iframe 内 Cookie/localStorage はブロックされ得る。状態はメモリに持ち、毎ラウンド初期化 |
| 軽量・高速 | 推奨 | ラウンド開始時にロードされる。バンドルを小さく、外部 CDN のブロッキング依存を避ける |

---

## 実装例

### 1. PGP SDK（共通・数行）

```js
const PGP = (() => {
  const h = {};
  addEventListener("message", (e) => {
    const m = e.data;
    if (m && m.channel === "pgp") h[m.type]?.(m);
  });
  const send = (m) => parent.postMessage({ channel: "pgp", ...m }, "*");
  return {
    onInit:  (cb) => (h.init  = cb),   // { seed, durationSec, gameType, player }
    onStart: (cb) => (h.start = cb),
    onStop:  (cb) => (h.stop  = cb),   // 強制終了 → 集計して gameover を送る
    ready:    ()  => send({ type: "ready" }),
    score:    (v) => send({ type: "score", value: v }),
    progress: (v) => send({ type: "progress", value: v }),
    gameover: (r) => send({ type: "gameover", ...r }),
  };
})();
```

### 2. standalone HTML 最小サンプル（score 制・タップで加点）

そのまま https で配信すれば動く完全なサンプル。プロトコルの必須項目をすべて満たしている。

```html
<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>
  html, body { margin: 0; height: 100dvh; overflow: hidden;
    touch-action: none; overscroll-behavior: contain; user-select: none;
    font-family: system-ui, sans-serif; background: #0f1b2d; color: #fff; }
  #app  { display: flex; flex-direction: column; height: 100dvh; }
  #hud  { padding: 12px 16px; display: flex; justify-content: space-between;
    font-variant-numeric: tabular-nums; font-weight: 700; }
  #zone { flex: 1; display: grid; place-items: center; font-size: 28px; }
  #zone.waiting { opacity: .5; }
</style>
</head>
<body>
<div id="app">
  <div id="hud"><span>スコア <span id="score">0</span></span><span>残り <span id="time">--</span>s</span></div>
  <div id="zone" class="waiting">準備中…</div>
</div>
<script>
// --- PGP SDK ---
const PGP = (() => {
  const h = {};
  addEventListener("message", (e) => { const m = e.data; if (m && m.channel === "pgp") h[m.type]?.(m); });
  const send = (m) => parent.postMessage({ channel: "pgp", ...m }, "*");
  return { onInit:c=>h.init=c, onStart:c=>h.start=c, onStop:c=>h.stop=c,
    ready:()=>send({type:"ready"}), score:v=>send({type:"score",value:v}), gameover:r=>send({type:"gameover",...r}) };
})();

// --- ゲーム状態 ---
let running = false, score = 0, remain = 0, timer = null, sent = false;
const $score = document.getElementById("score");
const $time  = document.getElementById("time");
const $zone  = document.getElementById("zone");

PGP.onInit((m) => { remain = m.durationSec; $time.textContent = remain; /* m.seed で盤面固定など */ });

PGP.onStart(() => {
  running = true; $zone.textContent = "タップ！"; $zone.classList.remove("waiting");
  timer = setInterval(() => {
    if (--remain <= 0) { clearInterval(timer); finish(); }
    $time.textContent = Math.max(remain, 0);
  }, 1000);
});

PGP.onStop(() => finish());   // 時間切れ / GM 終了

$zone.addEventListener("pointerdown", () => {
  if (!running) return;
  score++; $score.textContent = score;
  PGP.score(score);           // 現在の合計スコアを送信（任意）
});

function finish() {
  if (sent) return;           // 二重送信防止
  sent = true; running = false; clearInterval(timer);
  $zone.textContent = "終了！ " + score + " 点";
  PGP.gameover({ finalScore: score });   // score 制の結果
}

PGP.ready();   // ← ロード完了。握手の起点
</script>
</body>
</html>
```

> **time 制にする場合**: `finish()` でクリア時は `PGP.gameover({ cleared: true, clearTimeMs: 経過ms })`、時間切れ（未クリア）は `PGP.gameover({ cleared: false })` を送る。途中は `PGP.progress(0..1)` を送る。

### 3. React での組み込み

```jsx
import { useEffect, useRef, useState } from "react";

const send = (m) => parent.postMessage({ channel: "pgp", ...m }, "*");

export default function Game() {
  const [running, setRunning] = useState(false);
  const seed = useRef(0);
  const scoreRef = useRef(0);
  const sent = useRef(false);

  useEffect(() => {
    const onMsg = (e) => {
      const m = e.data; if (!m || m.channel !== "pgp") return;
      if (m.type === "init")  seed.current = m.seed;      // 盤面固定に利用
      if (m.type === "start") setRunning(true);
      if (m.type === "stop")  finish();                    // 集計 → gameover
    };
    window.addEventListener("message", onMsg);
    send({ type: "ready" });                               // 握手の起点
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const finish = () => {
    if (sent.current) return; sent.current = true; setRunning(false);
    send({ type: "gameover", finalScore: scoreRef.current });
  };

  const tap = () => {
    if (!running) return;
    scoreRef.current += 1;
    send({ type: "score", value: scoreRef.current });
  };

  return <div onPointerDown={tap} style={{ height: "100dvh", touchAction: "none" }}>…</div>;
}
```

### 4. 登録 JSON（プラットフォームに登録する内容）

プラットフォーム運用者に渡し、運用者が**管理画面からアップロード**して登録する（サーバーが NeonDB に保存。ファイル配置は不要）。

```json
{
  "id": "tap-master",
  "title": "Tap Master",
  "description": "制限時間内にタップ数を競う",
  "url": "https://games.example.com/tap-master/",
  "type": "score",
  "embed": "iframe",
  "thumbnail": "/thumbs/tap-master.png",
  "reportsProgress": false
}
```

---

## 提出前チェックリスト

- [ ] ロード完了で `pgp:ready` を送る（握手の起点）
- [ ] `pgp:start` を受けるまで開始しない
- [ ] `pgp:stop` に 1 秒以内に `pgp:gameover` で応答する
- [ ] `pgp:gameover` は必ず 1 回だけ・確定値入りで送る（早期終了・時間切れ・GM 終了の全経路）
- [ ] 送受信すべてに `channel: "pgp"` を付ける／付いていない受信は無視
- [ ] score は現在の合計値、progress は 0〜1、NaN/負値を送らない
- [ ] iframe に 100% 追従・スクロール/ズーム抑止・タッチ操作
- [ ] 音は初回タッチで解禁（自動再生しない）
- [ ] `window.top` 書き換え・全ページ遷移・ポップアップ・`alert/confirm` を使わない
- [ ] HTTPS 配信・iframe 埋め込みを許可（`X-Frame-Options`/CSP をブロックしない）
- [ ] Cookie/localStorage に依存せず、毎ラウンド新規ロードで正しく初期化される
