# Tap Boxing 実装 TODO

## 計画（2026-07-04）

仕様: `docs/boxing-game-spec.md` / 連携: `docs/3rd-game-dev-guide.md`（pgp postMessage）
デザイン: Claude Design プロジェクト `58b2d6ed-9bcb-4fa9-ae09-6febbf3bb47c` の `Tap Boxing.dc.html`

- [x] 1. Vite + React プロジェクトを scaffold（package.json / vite.config.js / index.html / src/） → verify: `npm run build` が通る
- [x] 2. pgp 連携フック（ready/init/start/stop/score/gameover、二重送信防止、例外時の最小結果送信） → verify: E2E で全経路確認
- [x] 3. ゲームロジック（useReducer + tick、mulberry32(seed)、技×相手状態ダメージ表、スタン、難易度スケール） → verify: node で reducer テスト
- [x] 4. 画面実装（READY / プレイ / TIME UP、HUD、リング、チビボクサー状態・カラーバリエーション、3ボタン） → verify: スクリーンショットでデザイン照合
- [x] 5. 検証: 親ハーネスで init→start→score→stop→gameover の握手を確認
- [x] 6. 提出前チェックリスト（3rd-game-dev-guide.md 末尾）を全項目確認

## 進捗ログ

### 2026-07-04 実装完了・検証結果

**構成**: Vite + React。`src/game.js`（純粋 reducer・mulberry32 を純粋関数化して state に乱数状態を保持）、
`src/pgp.js`（pgp SDK・gameover 二重送信防止）、`src/Game.jsx`（統括・rAF tick・pgp 配線）、
`src/Hud.jsx` / `src/Ring.jsx` / `src/Opponent.jsx` / `src/Controls.jsx`。

**検証 1 — reducer 単体テスト（node、25 件パス）**:
- 同一 seed → 相手挙動列が完全一致（公平性）、異 seed → 異なる
- ダメージ表: ガード×ジャブ=無効 / ガード×ストレート=半減5 / ガード×アッパー=ブレイク+6 /
  予兆×ジャブ=カウンター+6 / 予兆×アッパー=当たるがキャンセルなし / 回避=空振り / 通常=素通し
- 硬直中の入力無視・硬直明けは入力可 / KO→撃破+1→次の相手 HP+10 /
  攻撃発生時に手を出していたらスタン・出していなければ無傷 / 時間切れ・stop で ended
- 3 分間フルシミュレーション: NaN・負値なし、HP 非負

**検証 2 — E2E（headless Edge + 親ハーネス、14 件パス）**:
- ロードで `pgp:ready` → 親が init/start → HUD 表示でプレイ開始
- KO ごとに `pgp:score`（1,2,3,4 と累計値で送信）
- `pgp:stop` → 1 秒以内に `pgp:gameover`、finalScore = 最終スコア、stop 再送でも gameover は 1 回のみ
- READY 待機画面 / プレイ画面 / TIME UP 結果画面のスクリーンショットがデザインと一致

**提出前チェックリスト**: 全項目確認済み。音は未使用（無音でも遊べる）、storage 不使用、
`100dvh` + `touch-action:none` + `overscroll-behavior:contain`、`channel:"pgp"` 厳守。

**残タスク（ユーザー判断）**: Vercel 等へのデプロイと `game-settings.json` の `url` 差し替え → 管理画面から登録。
数値バランス（技ダメージ・難易度カーブ）は spec §12 のとおり要プレイ調整。

### 2026-07-04 相手の動き改善（ユーザー指示）

- 敵ライフ 2 倍以上: `30+10n (cap150)` → `60+20n (cap300)`
- 難易度カーブ強化: 攻撃/ガード/回避の頻度上昇を急に（合計 ≤1 を維持）、予兆短縮を 55→80ms/段階、
  待機時間短縮を強化、`speed` 係数（段階ごとに最大 45% 短縮）でガード/回避の持続を短縮しテンポアップ
- 被弾演出: スタン 0.5→1 秒、赤フラッシュを強く 1 秒フェードに、シェイク振幅 2 倍・0.55 秒に
- 検証: reducer テスト 28 件パス（重み合計 ≤1・スケール方向のテスト追加）、ビルド成功、E2E 14 件パス（KO ペースは 4→3 人に低下＝ライフ増の効果を確認）

### 2026-07-04 相手の行動速度アップ（ユーザー指示）

- 行動の基礎時間を短縮: 予兆 900→650ms 基準（最短 350ms）、ガード持続 800–1500→500–950ms、
  回避持続 600–950→400–650ms、攻撃モーション 280→200ms、待機間隔 700–1200→450–850ms 基準
- アニメーション高速化: 構え切替のトランジション 0.12→0.06 秒、体の揺れ（bob）2.4→1.6 秒、
  予兆の警告点滅 0.7→0.45 秒
- 検証: reducer テスト 28 件パス、ビルド成功、E2E 14 件パス（同一ボット操作で KO 3→2 人＝テンポ上昇で難化を確認）
