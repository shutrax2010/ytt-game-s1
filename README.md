# ytt-game-s1 — Tap Boxing

パーティゲームプラットフォーム連携（pgp postMessage）のサンプルゲーム。
ジャブ・ストレート・アッパーをタップして、制限時間内に何人倒せるかを競うスコア制ボクシングゲーム。

- 仕様: `docs/boxing-game-spec.md`
- 連携プロトコル: `docs/3rd-game-dev-guide.md` / `docs/3rd-game-spec.md`
- デザイン: Claude Design「Tap Boxing.dc.html」

## 開発

```sh
npm install
npm run dev      # 開発サーバー（単体起動時は 0.7 秒後に自動スタート）
npm run build    # dist/ にビルド
npm run preview  # ビルド結果の確認
```

## プラットフォーム登録

`dist/` を HTTPS でデプロイ（Vercel 等、iframe 埋め込み許可）し、`game-settings.json` の `url` を公開 URL に書き換えて管理画面からアップロードする。
