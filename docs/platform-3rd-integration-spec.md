# 3rd 連携：管理画面（プラットフォーム）側 実装仕様

3rd パーティ製ゲームを iframe + postMessage 方式で組み込むために、**プラットフォーム側**が実装すべき機能と処理の一覧、および実装例。プロトコルは `3rd-game-spec.md`、ゲーム側は `3rd-game-dev-guide.md` を参照。

## 概要

3rd ゲームは各プレイヤーのスマホで別 URL の web アプリとして動く。これをプレイヤー画面（P3）の `<iframe>` に埋め込み、`postMessage`（`channel:"pgp"`）で双方向通信する。プラットフォーム側はこのブリッジを**既存の `GameModule` 契約を満たすアダプタ（`ThirdPartyGameModule`）**として実装するため、スコア集約・順位計算・結果/BEST3 は内蔵ゲームと同じパイプラインをそのまま使う。

---

## 必要な機能・処理の一覧

### カタログ管理（サーバー）

| 機能 | 処理内容 |
| --- | --- |
| カタログ取得 | 3rd ゲームは **NeonDB** に保存し、`GameRegistry` 経由で取得（登録・削除・DB スキーマは `3rd-game-registry-spec.md`）。`3rd-games/` フォルダは使わない |
| ID 解決 | `registry.get(gameId)` で 3rd ゲーム定義（`url`/`type`/`embed`）を引く（キャッシュ済み） |
| カタログ API | `GET /api/games` で内蔵ゲーム＋`enabled` の 3rd ゲーム一覧を返す |

### 管理画面 UI（A1 ゲーム選択）

| 機能 | 処理内容 |
| --- | --- |
| 3RD エリア表示 | `GET /api/games` の `thirdParty` を選択画面下部に別セクションで描画（タイトル・サムネイル・種別） |
| 選択反映 | 3rd ゲーム選択時、`gameId = その id` としてルーム作成・`host:select_game` を実行（以降は内蔵と同一フロー） |

### ラウンド開始（サーバー）

| 機能 | 処理内容 |
| --- | --- |
| seed 生成 | ラウンド開始時に乱数 seed を生成し全プレイヤーへ同報 |
| `round:start` 拡張 | 3rd ゲームなら `thirdParty { url, type, embed }` をペイロードに付与。内蔵ゲームでは付けない |

### プレイヤークライアント（GamePlayerClient）

| 機能 | 処理内容 |
| --- | --- |
| ゲーム種別判定 | `round:start` に `thirdParty` があれば `ThirdPartyGameModule`、無ければ内蔵 `GameModule` を生成 |
| マウント | P3 プレイエリアに iframe を挿入（`embed:"window"` 時は別ウィンドウ） |
| イベント中継 | `GameModule` の `score`/`progress`/`gameover` を **1回/秒スロットル**で `player:score`/`player:progress`/`player:gameover` に中継（既存処理を流用） |
| 制限時間 | `durationSec` のカウントダウンを持ち、0 で `forceEnd()` を呼ぶ |
| 強制終了 | `round:end`（GM 終了）受信でも `forceEnd()` |
| 後始末 | `gameover` 送信後に `destroy()`（iframe 除去・listener 解除） |

### postMessage ブリッジ（ThirdPartyGameModule 内）

| 機能 | 処理内容 |
| --- | --- |
| 握手 | ゲームからの `pgp:ready` 受信で `pgp:init`（seed/durationSec/gameType/player）→ `pgp:start` を送信 |
| 途中受信 | `pgp:score` → `score` イベント発火（直近値を保持）／`pgp:progress` → `progress` 発火 |
| 終了受信 | `pgp:gameover` → 種別で正規化して `GameResult` を `gameover` 発火 |
| 強制終了送出 | `forceEnd()` で `pgp:stop` を送り、ゲームからの `gameover` を待つ |
| 二重終了防止 | `gameover` は 1 回だけ処理（早期終了後に stop が来ても無視） |

### 堅牢化（サーバー）

| 機能 | 処理内容 |
| --- | --- |
| セーフティタイマー | `durationSec + 猶予`で `player:gameover` 未達のプレイヤーを直近値（score 制は最後の score／time 制は未クリア）で `finished` 確定 |

---

## 実装例

### 1. サーバー：カタログ読み込み ＋ API

```ts
// packages/server/games.ts
import { registry } from "./registry";     // NeonGameRegistry（3rd-game-registry-spec.md）

export type GameType = "score" | "time";

const BUILTIN = [
  { id: "tetris",    title: "テトリス",         type: "score" as GameType },
  { id: "shooter",   title: "2Dシューティング", type: "score" as GameType },
  { id: "action",    title: "2Dアクション",     type: "time"  as GameType },
  { id: "solitaire", title: "ソリティア",       type: "time"  as GameType },
];

// 3rd ゲームは NeonDB から取得（enabled のみ）
export const catalog = async () => ({
  builtin: BUILTIN,
  thirdParty: await registry.list(),
});
export const getThirdGame = (id: string) => registry.get(id);   // キャッシュ済み・Promise
```

```ts
// packages/server/index.ts（抜粋）
import { catalog } from "./games";

app.get("/api/games", async (_req, res) => res.json(await catalog()));
```

### 2. サーバー：`round:start` の拡張

```ts
import { getThirdGame } from "./games";

socket.on("host:start_round", async () => {
  const room = getRoomByHost(socket.id);
  room.seed  = (Math.random() * 2 ** 31) | 0;
  room.state = "in_round";

  const tp = await getThirdGame(room.gameId);    // 3rd ゲームなら定義が返る（キャッシュ済み）
  io.to(room.code).emit("round:start", {
    gameId: room.gameId,
    durationSec: room.durationSec,
    seed: room.seed,
    ...(tp ? { thirdParty: { url: tp.url, type: tp.type, embed: tp.embed } } : {}),
  });
});
```

### 3. 管理画面：3RD エリア（React）

```jsx
function GameSelect({ selected, onSelect }) {
  const [cat, setCat] = useState({ builtin: [], thirdParty: [] });
  useEffect(() => { fetch("/api/games").then(r => r.json()).then(setCat); }, []);

  return (
    <div>
      <h2>ゲームを選択</h2>
      <div className="game-grid">
        {cat.builtin.map(g => (
          <GameCard key={g.id} title={g.title} type={g.type}
                    active={selected === g.id} onClick={() => onSelect(g.id)} />
        ))}
      </div>

      {cat.thirdParty.length > 0 && (
        <section className="third-area">
          <h3>3RD</h3>
          <div className="game-grid">
            {cat.thirdParty.map(g => (
              <GameCard key={g.id} title={g.title} type={g.type} thumbnail={g.thumbnail}
                        active={selected === g.id} onClick={() => onSelect(g.id)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
```

### 4. プレイヤー：`round:start` ハンドラ拡張

```ts
socket.on("round:start", async ({ gameId, durationSec, seed, thirdParty }) => {
  const game = thirdParty
    ? createThirdPartyGame({ url: thirdParty.url, type: thirdParty.type, embed: thirdParty.embed })
    : await loadBuiltinGame(gameId);            // 内蔵 GameModule の動的 import

  game.mount(containerEl, { seed, durationSec, player: myPlayer });
  game.on("score",    throttle1s(v => socket.emit("player:score",    { value: v })));
  game.on("progress", throttle1s(v => socket.emit("player:progress", { value: v })));

  let done = false;
  game.on("gameover", (r) => {
    if (done) return; done = true;
    socket.emit("player:gameover", r);
    game.destroy();
  });

  const timer = startCountdown(durationSec, () => game.forceEnd());
  socket.once("round:end", () => game.forceEnd());
  game.start();
});
```

### 5. プレイヤー：`ThirdPartyGameModule` アダプタ（ブリッジ本体）

```ts
import type { GameModule, GameResult } from "@shared/protocol";

export function createThirdPartyGame(opts: {
  url: string; type: "score" | "time"; embed: "iframe" | "window";
}): GameModule {
  let frame: HTMLIFrameElement | null = null;
  let win: Window | null = null;
  let lastScore = 0;
  const listeners: Record<string, Function[]> = { score: [], progress: [], gameover: [] };
  const emit = (ev: string, v: unknown) => listeners[ev].forEach(cb => cb(v));

  let ctx = { seed: 0, durationSec: 180, player: { id: "", nickname: "" } };
  const target = () => (opts.embed === "window" ? win : frame?.contentWindow);
  const post = (m: object) => target()?.postMessage({ channel: "pgp", ...m }, "*");

  function onMessage(e: MessageEvent) {
    const m = e.data;
    if (!m || m.channel !== "pgp") return;      // デモは origin 緩め
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
    id: "thirdparty",
    title: "",
    scoring: opts.type === "score" ? "higher_is_better" : "lower_is_better",
    unit:    opts.type === "score" ? "points" : "ms",
    mount(container, o: any) {
      ctx = { seed: o.seed, durationSec: o.durationSec, player: o.player };
      window.addEventListener("message", onMessage);
      if (opts.embed === "iframe") {
        frame = document.createElement("iframe");
        frame.src = opts.url;
        frame.allow = "autoplay; fullscreen";
        frame.style.cssText = "width:100%;height:100%;border:0;display:block";
        container.appendChild(frame);
      } else {
        win = window.open(opts.url, "pgp_game");
      }
    },
    start() { /* 実開始は ready 握手で start を送るため空でよい */ },
    forceEnd() { post({ type: "stop" }); },      // 集計は gameover の到着を待つ
    destroy() {
      window.removeEventListener("message", onMessage);
      frame?.remove(); win?.close(); frame = null; win = null;
    },
    on(ev, cb) { (listeners[ev] ??= []).push(cb); },
  };
}

function normalize(type: "score" | "time", m: any, lastScore: number): GameResult {
  if (type === "score")
    return { cleared: true, finalScore: m.finalScore ?? lastScore, clearTimeMs: null };
  return { cleared: !!m.cleared, finalScore: 0,
           clearTimeMs: m.cleared ? (m.clearTimeMs ?? null) : null };
}
```

---

## 動作確認の観点

- `GET /api/games` に 3rd ゲームが出るか、A1 の 3RD エリアに描画されるか。
- 3rd ゲーム選択 → 参加 → 開始で iframe がロードされ、`pgp:ready` → `init/start` の握手が成立するか。
- 途中スコア（`pgp:score`）が A3 進行画面にライブ反映されるか。
- 早期終了・時間切れ・GM 終了の 3 経路すべてで `player:gameover` が届き、結果/BEST3 に反映されるか。
- `ready`/`gameover` を送らないゲームでもセーフティタイマーで確定するか。
