## Git / Commit ルール

**明示的に指示があるまでコミットしない。**

- ユーザーから「コミットして」「pushして」などの明示的な指示があった場合のみ `git commit` / `git push` を実行する。
- コード変更・ファイル生成後に自動でコミットしない。
- `git add` のみ行う場合も事前に確認する。

## 編集対象ファイル
- .env などの環境変数定義ファイルは更新しない。ユーザーから「.envを更新して」「環境変数を追加して」などの明示的な指示があった場合のみ更新する。
- 環境変数の更新が必要な場合は、ユーザーに説明して提案する。ファイルは更新しない。

## 詳細ドキュメント（docs/）

| ファイル | 内容 |
|---------|------|
| `spec.md` | 仕様書 |

## ドキュメント方針

設計書（`docs/`）には**実装済みのソースコードを書かない**。

- ソースコードはすでにリポジトリにある。設計書にコピーしても二重管理になるだけで、実装と乖離したときに嘘の情報になる。
- 代わりに書くもの：処理の概要・設計の意図・重要なアルゴリズムの断片・APIの仕様・テーブル・フロー図。
- コード断片を書く場合は、**なぜそう設計したか**が伝わる最小限に絞る（数行〜10行程度）。

**具体的な判断基準**:

| 書く | 書かない |
|------|---------|
| `getAmountOut = (amountIn × reserveOut) / (reserveIn + amountIn)` のような核心式 | クラスやファイル全体の実装 |
| API のリクエスト/レスポンス仕様 | 実装済みのルートハンドラー全体 |
| 設計上の分岐（ダミー vs 本番の判定条件） | `if/else` を含む関数の全コード |
| 型定義のテーブル（フィールド名・型・説明） | `interface` や `type` の完全な定義 |
| デプロイ手順のステップ（番号付き箇条書き） | デプロイスクリプト全体 |

## Workflow
- 非自明タスクは Plan → Execute → Verify → Report の順で進行
- 途中で前提崩れが起きたら停止して再計画
- 完了報告前に必ず検証結果を提示

## Task Management
- 計画は docs/work/todos.md にチェックリスト化
- 進捗と検証ログを同ファイルに追記
- ユーザー修正が入ったら docs/work/lessons.md に再発防止策を追記

# Thinking

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. 一括・スクリプト処理は必ず1ファイルで検証してから展開

**Verify on one small file before rolling out. Never apply a bulk transform blind.**

sed / 正規表現置換 / codemod / スクリプトで複数ファイルを一括変更するときは、いきなり全体に
適用しない。順序を守る：

1. **まず1ファイルだけに適用**し、差分（`git diff`）を目視で確認する。
2. **想定どおりか検証**（型チェック・ビルド・該当箇所の前後が壊れていないか）。
3. 問題なければ残りへ展開し、**最後に全体ビルド/型チェックで再検証**する。

特に正規表現は **過剰マッチ（貪欲/非貪欲の取り違え、要素境界を跨ぐ `[\s\S]*?`）** で
無関係なコードを巻き込み破壊しやすい。`[^<>{}]*` のように境界文字を除外して範囲を限定する。

> 背景: ローディング表示の一括置換で `<div style={{…}}>…</div>` の正規表現が要素境界を跨いで
> 過剰マッチし、20ファイルの周辺JSXを削除してビルドを壊した。1ファイル検証を省いたことが原因。

---
