# 3rd パーティ製ゲーム連携 仕様

外部の web ゲーム（React アプリ / standalone HTML など）をパーティゲームプラットフォームに組み込むための連携仕様。プラットフォーム本体は `party-game-platform-spec.md`、既存ゲームのモジュール契約は §5、通信プロトコルは §6 を参照。

> **デモ前提**: セキュリティ対策は最小限とする（origin チェックは緩め、認証なし）。本番化する場合の勘所は末尾に注記。

---

## 1. 設計方針

- 3rd ゲームは各プレイヤーのスマホで**別 URL の web アプリ**として動く。これをプラットフォームのプレイヤー画面（P3）の中に **`<iframe>` で埋め込み**、親（プラットフォーム）と子（ゲーム）を **`window.postMessage`** で双方向通信させる。
- 3rd ゲーム側は Socket.IO を知らなくてよい。**postMessage だけ**実装すれば、React でも standalone HTML でも動く。
- プラットフォーム側では、この iframe + postMessage ブリッジを**既存の `GameModule` 契約を満たすアダプタ（`ThirdPartyGameModule`）**として実装する。これにより、スコア集約（`room:score_tick`）・順位計算・結果/BEST3 表示は**内蔵ゲームと同じパイプラインをそのまま流用**でき、プラットフォーム本体の改修は最小限で済む。

### アーキテクチャ

```
[管理画面 PC] ── GET /api/games（NeonDB のカタログ）── 3RDエリアで選択
       │ host:select_game(gameId = 3rd の id)
       ▼
   [Server] ──round:start { gameId, thirdParty:{url,type}, seed, durationSec }──▶ [Player: GamePlayerClient]
       ▲                                                                                │ mount ThirdPartyGameModule
       │ player:score / player:progress / player:gameover                              │ （= iframe + postMessage ブリッジ）
       └────────────────────────────────────────────────────────────────────           ▼
                                                                          [iframe: 3rd パーティゲーム (React / HTML)]
                                                                                  postMessage（pgp:* メッセージ）
```

---

## 2. ゲームの登録（管理画面側）

### 2-1. ゲーム定義（`game名.json`）

3rd ゲームは **NeonDB に保存**する。定義（下記 JSON）は**管理画面からアップロードして登録**し、一覧の削除ボタンで DB から削除する（`3rd-games/` フォルダへのファイル配置は行わない）。登録・管理・DB スキーマの詳細は `3rd-game-registry-spec.md` を参照。以下は 1 件分の定義スキーマ。

```json
{
  "id": "space-blaster",
  "title": "Space Blaster",
  "description": "レトロ風の縦シューティング",
  "url": "https://games.example.com/space-blaster/",
  "type": "score",
  "embed": "iframe",
  "thumbnail": "/thumbs/space-blaster.png",
  "reportsProgress": false
}
```

| フィールド | 型 | 説明 |
| --- | --- | --- |
| `id` | string | ゲーム識別子（`gameId` として使う。内蔵ゲームと衝突しない値） |
| `title` | string | 表示名 |
| `description` | string | 説明（任意） |
| `url` | string | ゲームの URL（iframe の src / window で開く先） |
| `type` | `"score"` \| `"time"` | スコア制 / タイム制 |
| `embed` | `"iframe"` \| `"window"` | 開き方。既定は `iframe`（後述のフォールバック用に `window` も可） |
| `thumbnail` | string | サムネイル画像パス（任意） |
| `reportsProgress` | boolean | 途中経過を送るゲームか（任意・表示ヒント） |

### 2-2. カタログ API

サーバーが内蔵ゲームと 3rd ゲームをまとめて返す。管理画面のゲーム選択画面（A1）はこれを取得して描画する。

```
GET /api/games
→ {
  "builtin":    [{ "id": "tetris", "title": "テトリス", "type": "score" }, ...],
  "thirdParty": [{ "id": "space-blaster", "title": "Space Blaster", "description": "...",
                   "url": "...", "type": "score", "embed": "iframe", "thumbnail": "..." }, ...]
}
```

### 2-3. 管理画面「3RD エリア」

ゲーム選択画面（A1）の**下部に 3RD エリア**を追加し、`thirdParty` のカードを並べる（タイトル・サムネイル・スコア/タイム種別）。選択すると `gameId = 3rd の id` としてルーム作成・`host:select_game` が走る。以降のルーム作成・待機ロビー・名前入力・開始/終了操作は**内蔵ゲームと完全に同じ**（既存の仕組みを流用）。

---

## 3. 起動と画面連携

- **待機ロビー・名前入力（P1/P2）は現在の仕組みをそのまま流用**。3rd ゲーム固有の処理は入らない。
- GM が「ゲーム開始」→ サーバーが `round:start` を配信。3rd ゲームの場合、ペイロードに `thirdParty { url, type, embed }` を含める。
- プレイヤーの `GamePlayerClient` は `gameId` がカタログの 3rd ゲームだと判定したら、内蔵の `GameModule` ではなく **`ThirdPartyGameModule`** を生成する。これが P3 のプレイエリアに `<iframe src=url>` を挿入し、postMessage ブリッジを開始する。
- **制限時間はプラットフォームが管理**（§5 と同じ）。`durationSec` のカウントダウンが 0 で `forceEnd()` → ゲームへ `stop` を送る。GM の強制終了（`round:end`）も同様。

---

## 4. 通信プロトコル（postMessage `pgp`）

親（プラットフォーム）と子（3rd ゲーム）でやり取りするメッセージ。すべて `channel: "pgp"` を付けて他メッセージと区別する。

### 親（プラットフォーム）→ ゲーム

```ts
type ToGameMessage =
  | { channel: "pgp"; type: "init"; seed: number; durationSec: number;
      gameType: "score" | "time"; player: { id: string; nickname: string } }
  | { channel: "pgp"; type: "start" }
  | { channel: "pgp"; type: "stop" };   // 制限時間到達 or GM 終了 → 集計して gameover を返すこと
```

### ゲーム → 親（プラットフォーム）

```ts
type FromGameMessage =
  | { channel: "pgp"; type: "ready" }                                   // ロード完了・init 受信可
  | { channel: "pgp"; type: "score"; value: number }                    // 任意（score 制の途中スコア）
  | { channel: "pgp"; type: "progress"; value: number }                 // 任意（time 制の進捗 0..1）
  | { channel: "pgp"; type: "gameover";                                 // 終了報告（必須）
      finalScore?: number; cleared?: boolean; clearTimeMs?: number };
```

- **score 制の gameover**: `{ type: "gameover", finalScore: 3400 }` を送る。
- **time 制の gameover（クリア）**: `{ type: "gameover", cleared: true, clearTimeMs: 84200 }`。
- **time 制の gameover（未クリア）**: `{ type: "gameover", cleared: false }`（時間切れなど）。
- 途中経過（`score` / `progress`）の送信は**任意**。送れば管理画面の進行画面（A3）にライブ反映される。送らなければ状態は「プレイ中／終了」のみになる。

### ハンドシェイク

`ready` を起点にした握手で、iframe のロード完了を待ってから開始する。

```
1. 親: iframe を生成（src = ゲーム URL）
2. ゲーム: ロード完了 → 親へ  { type: "ready" }
3. 親: ゲームへ  { type: "init", seed, durationSec, gameType, player }
4. 親: ゲームへ  { type: "start" } ＋ ローカル制限時間カウントダウン開始
5. ゲーム: 途中で（任意）{ type: "score" } / { type: "progress" }
6a. 早期終了: ゲーム → 親  { type: "gameover", ... }
6b. 時間切れ/GM終了: 親 → ゲーム  { type: "stop" } → ゲーム → 親  { type: "gameover", ... }
```

---

## 5. 既存プロトコルとの対応

### 5-1. `round:start` の拡張

既存の `round:start`（§6）に 3rd ゲーム用のフィールドを追加する。内蔵ゲームでは `thirdParty` は付かない。

```ts
"round:start": (p: {
  gameId: string;
  durationSec: number;
  seed: number;
  thirdParty?: { url: string; type: "score" | "time"; embed: "iframe" | "window" };
}) => void;
```

### 5-2. `ThirdPartyGameModule`（アダプタ）

`GameModule` 契約を実装し、内部で iframe と postMessage を仲介する。`score` / `progress` / `gameover` イベントを既存どおり発火するので、`GamePlayerClient` から先（`player:score` / `player:progress` / `player:gameover` への中継）は**変更不要**。

```ts
function createThirdPartyGame(opts: {
  url: string; type: "score" | "time"; embed: "iframe" | "window";
}): GameModule {
  let frame: HTMLIFrameElement;
  let win: Window | null = null;         // embed === "window" のとき
  let lastScore = 0;
  const listeners = { score: [], progress: [], gameover: [] } as Record<string, Function[]>;
  const emit = (ev: string, v: any) => listeners[ev].forEach(cb => cb(v));
  const scoring = opts.type === "score" ? "higher_is_better" : "lower_is_better";
  const unit    = opts.type === "score" ? "points" : "ms";

  let ctx = { seed: 0, durationSec: 180, player: { id: "", nickname: "" } };
  const target = () => (opts.embed === "window" ? win : frame.contentWindow);
  const post = (m: object) => target()?.postMessage({ channel: "pgp", ...m }, "*");

  function onMessage(e: MessageEvent) {
    const m = e.data; if (!m || m.channel !== "pgp") return;   // デモは origin 緩め
    switch (m.type) {
      case "ready":
        post({ type: "init", seed: ctx.seed, durationSec: ctx.durationSec,
               gameType: opts.type, player: ctx.player });
        post({ type: "start" });
        break;
      case "score":    lastScore = m.value; emit("score", m.value); break;
      case "progress": emit("progress", m.value); break;
      case "gameover": emit("gameover", normalize(opts.type, m, lastScore)); break;
    }
  }

  return {
    id: "thirdparty", title: "", scoring, unit,
    mount(container, o) {
      ctx = { seed: o.seed, durationSec: o.durationSec, player: o.player };  // player は client から渡す
      window.addEventListener("message", onMessage);
      if (opts.embed === "iframe") {
        frame = document.createElement("iframe");
        frame.src = opts.url; frame.allow = "autoplay; fullscreen";
        frame.style.cssText = "width:100%;height:100%;border:0";
        container.appendChild(frame);
      } else {
        win = window.open(opts.url, "pgp_game");   // フォールバック
      }
    },
    start() { /* 実開始は ready ハンドシェイクで start を送るため空でよい */ },
    forceEnd() { post({ type: "stop" }); },        // 集計は gameover の到着を待つ
    destroy() { window.removeEventListener("message", onMessage); frame?.remove(); win?.close(); },
    on(ev, cb) { listeners[ev].push(cb); },
  };
}

// 種別ごとに GameResult へ正規化
function normalize(type: "score" | "time", m: any, lastScore: number) {
  if (type === "score")
    return { cleared: true, finalScore: m.finalScore ?? lastScore, clearTimeMs: null };
  return { cleared: !!m.cleared, finalScore: 0,
           clearTimeMs: m.cleared ? (m.clearTimeMs ?? null) : null };
}
```

> `GamePlayerClient`（§6）の `round:start` ハンドラを拡張し、`thirdParty` があれば `createThirdPartyGame(...)` を、無ければ従来どおり内蔵 `GameModule` を `mount` する。それ以外の中継・タイマー・スロットル処理は共通のまま。

### 5-3. スコア・順位への反映

`type: "score"` → `scoring: "higher_is_better"` / `unit: "points"`、`type: "time"` → `scoring: "lower_is_better"` / `unit: "ms"` にマッピングされる。以降の結果一覧・BEST3・「未クリア＝順位なし」ルール（§8）は内蔵ゲームと同一に適用される。

---

## 6. 通信シーケンス（全体）

```
GM: A1 の 3RD エリアで選択 → host:create_room / host:select_game(gameId=3rd)
（待機ロビー・名前入力は既存フロー）
GM: host:start_round
  └─ Server: seed 生成
       └─ Server → 全Player: round:start { gameId, thirdParty:{url,type,embed}, seed, durationSec }
            └─ GamePlayerClient: ThirdPartyGameModule.mount() → iframe(src=url) 挿入
                 └─ Game(iframe) → Parent: pgp:ready
                      └─ Parent → Game: pgp:init {seed,durationSec,gameType,player} → pgp:start
                           ├─ Game → Parent: pgp:score / pgp:progress（任意）
                           │    └─ Parent → Server: player:score / player:progress
                           │         └─ Server → Host(A3): room:score_tick
                           └─ 終了:
                                ├─ 早期: Game → Parent: pgp:gameover
                                └─ 時間切れ/GM終了: Parent → Game: pgp:stop → Game → Parent: pgp:gameover
                                     └─ Parent → Server: player:gameover → Server → Host: room:player_finished
（以降 host:end_round → results → host:show_ranking → BEST3 は既存フロー）
```

---

## 7. ゲーム側の実装

3rd ゲームは以下の最小コードで連携できる。フレームワーク非依存（React の `useEffect` 内でも同じ）。

### 7-1. 最小 SDK（vanilla JS / standalone HTML）

```html
<script>
const PGP = (() => {
  const handlers = {};
  window.addEventListener("message", (e) => {
    const m = e.data;
    if (!m || m.channel !== "pgp") return;
    handlers[m.type]?.(m);
  });
  const send = (msg) => parent.postMessage({ channel: "pgp", ...msg }, "*");
  return {
    onInit:  (cb) => (handlers.init  = cb),   // { seed, durationSec, gameType, player }
    onStart: (cb) => (handlers.start = cb),
    onStop:  (cb) => (handlers.stop  = cb),    // 強制終了 → 集計して gameover を送る
    ready:    ()  => send({ type: "ready" }),
    score:    (v) => send({ type: "score", value: v }),
    progress: (v) => send({ type: "progress", value: v }),
    gameover: (r) => send({ type: "gameover", ...r }),
  };
})();

// --- 使い方 ---
let seed = 0, limit = 180;
PGP.onInit((m) => { seed = m.seed; limit = m.durationSec; /* seed で盤面を固定 */ });
PGP.onStart(() => startGame());
PGP.onStop(()  => endGame());               // 時間切れ等 → 集計 → PGP.gameover(...)
PGP.ready();                                // ロード完了を通知（これが握手の起点）

// ゲーム中（任意）: PGP.score(1200);   /   PGP.progress(0.4);
// 終了（score制）:   PGP.gameover({ finalScore: 3400 });
// 終了（time制クリア）: PGP.gameover({ cleared: true, clearTimeMs: 84200 });
// 終了（time制 未クリア）: PGP.gameover({ cleared: false });
</script>
```

### 7-2. React アプリの場合

```jsx
useEffect(() => {
  const onMsg = (e) => {
    const m = e.data; if (!m || m.channel !== "pgp") return;
    if (m.type === "init")  setSeed(m.seed);
    if (m.type === "start") setRunning(true);
    if (m.type === "stop")  finishAndReport();   // 集計 → gameover 送信
  };
  window.addEventListener("message", onMsg);
  parent.postMessage({ channel: "pgp", type: "ready" }, "*");
  return () => window.removeEventListener("message", onMsg);
}, []);

const report = (r) => parent.postMessage({ channel: "pgp", type: "gameover", ...r }, "*");
```

---

## 8. デモ向けの割り切りと注意

- **セキュリティ**: origin は検証せず（`postMessage` の targetOrigin は `"*"`、受信側も `channel` のみで判定）。本番化する際は、カタログの `url` から算出した origin で `postMessage` 送信先を固定し、受信も `e.origin` で照合する。
- **iframe 埋め込み不可のケース**: 外部サイトは `X-Frame-Options` / CSP `frame-ancestors` で iframe をブロックすることがある。その場合は `embed: "window"` にして別ウィンドウで開く（postMessage は `window.opener` 経由）。デモでは自前ホストの埋め込み可能なゲームを登録するのが確実。
- **`ready` / `gameover` が来ない**: サーバー側の `durationSec + 猶予` セーフティタイマー（§6）で、`player:gameover` 未達のプレイヤーは直近値（score 制は最後の `score`、無ければ 0／time 制は未クリア）で `finished` 確定させる。
- **seed の利用は任意**: 公平性のため `seed` を渡すが、3rd ゲーム側が使うかは任意。使えば全員同条件になる。
- **モバイル表示**: iframe は P3 のプレイエリアに 100% サイズで嵌める。ゲーム側でスマホ縦のタッチ操作・`100dvh` 対応を行う前提。

---

## 9. 未確定事項（要検討）

- 3rd ゲームカタログを管理画面から動的に追加・編集する UI を用意するか（デモは JSON 直置きで十分）。
- `player`（id / nickname）を 3rd ゲームに渡すか（表示に使いたい場合のみ。不要なら省略可）。
- 途中経過（`score` / `progress`）の送信頻度の推奨値（親側で 1 回/秒にスロットルするため、ゲーム側は送りすぎても実害はない）。
- `window` フォールバック時のプレイヤー画面（P3）の見せ方（別ウィンドウ中は「別画面でプレイ中」表示にするなど）。
