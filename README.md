# car-cost-model

ノア Welcab の買い替え判断を、商談前後にブラウザだけで素早く比較するための静的Webアプリです。

## 使い方

1. `docs/index.html` をブラウザで直接開く。
2. 入力欄の査定額、ローン条件、維持費、修理期待値などを変更する。
3. Dashboard とシナリオ比較表が即時に再計算される。
4. 条件を持ち帰る場合は `JSONコピー` または `JSON保存` を使う。
5. 比較結果を表計算ソフトで見る場合は `CSV保存` を使う。

ローカルで直接開いた場合、ブラウザの制約で `docs/assumptions.json` を読み込めないことがあります。その場合も `docs/app.js` 内の同じ初期値で動作します。GitHub Pages では `docs/assumptions.json` を読み込みます。

## GitHub Pages 設定

GitHub のリポジトリ設定で Pages の公開元を次のように設定します。

- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/docs`

公開後は `https://abehiroshi.github.io/car-cost-model/` で開けます。

## 構成

```text
docs/
  index.html
  app.js
  style.css
  assumptions.json
inputs/
  assumptions.json
knowledge/
  README.md
  maintenance.md
  welcab.md
  depreciation.md
  loan.md
outputs/
  .gitkeep
README.md
AGENTS.md
```

## v1 の考え方

v1 は厳密なローン償却表ではなく、一次判断用の簡易モデルです。買替タイミングごとに年次キャッシュフローを作り、7年平均月額、20年平均月額、20年NPV、20年支出合計、20年末車両価値、1km単価、2032年純資産を比較します。

年合計にはローン、維持費、修理期待値、車検だけを含めます。下取り額や最終車両価値は支出から控除せず、車両価値と純資産として別に表示します。

主な前提値は `docs/assumptions.json` と `inputs/assumptions.json` に集約しています。両ファイルは同じ内容です。残価・価値低下の係数も `depreciation` としてJSONに置いています。

## 根拠メモ

`knowledge/` は、ChatGPTに「Web検索せず、リポジトリ内の根拠だけで説明して」と依頼するための根拠メモです。最新Web情報ではなく、このモデル内で採用している前提、仮置き、未確認事項を説明するために使います。

数値を変える場合は `inputs/assumptions.json` と `docs/assumptions.json` を更新し、根拠を `knowledge/` に追記します。

## 今後の拡張候補

- 残価設定ローンの正確な償却表
- ディーラー提示の査定、下取り、保証条件の反映
- 修理損益分岐点
- NPV と純資産の前提調整
- 中古車相場の手入力または取得
- 年次キャッシュフローのグラフ化
- 複数車種、住宅ローン、保険、リフォームなどへの横展開
