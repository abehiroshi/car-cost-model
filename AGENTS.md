# AGENTS.md

## Project Instructions

- 今日から明日のディーラー商談で一次判断できることを最優先する。
- 過剰設計しない。v1は厳密なローン償却表ではなく、意思決定用の簡易モデルとして扱う。
- 数値前提はJSONに集約する。正式な初期値は `docs/assumptions.json` と `inputs/assumptions.json` に置く。
- GitHub Pages の公開元は `docs/` を想定する。
- ローカルで `docs/index.html` を直接開いて動くことを維持する。
- サーバーやビルド工程を前提にしない。静的HTML/CSS/JavaScriptのみで完結させる。
- 入力変更、再計算、JSON/CSV持ち帰りの操作性を優先する。
- 数値前提を変更した場合は、対応する `knowledge/*.md` に根拠または未確認事項を必ず追記する。
- 数値前提を変更した場合は、画面の「前提・単価・計算ルール」にも反映されることを確認する。
- 今日の一次判断を優先し、`knowledge/` は詳細調査ではなくモデル内前提の説明可能性を担保する範囲に留める。

## Notes

- `docs/app.js` に計算ロジックをまとめる。
- `docs/assumptions.json` と `inputs/assumptions.json` は同じ内容に保つ。
- `knowledge/` はWeb検索なしで数値前提を説明するための初期メモとして扱う。
- 将来の精緻化候補はREADMEに整理し、v1の実装へ混ぜ込みすぎない。
