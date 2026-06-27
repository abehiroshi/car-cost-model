# car-cost-model

ノア Welcab の買い替え判断を、商談前後にブラウザだけで素早く比較するための静的Webアプリです。v1.1では、現在47歳から約20〜25年の車利用期間全体を見て、買替サイクルごとの総支出を比較します。

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

v1.1 は厳密なローン償却表ではなく、一次判断用の簡易モデルです。最初の買替時期だけでなく、残り利用期間全体の買替サイクルを比較します。25年支出合計、25年平均月額、買替回数、車検回数、最終売却額、売却後実質コスト、売却後平均月額、25年末純資産を見ます。

年合計にはローン、維持費、修理期待値、車検だけを含めます。下取り額や最終車両価値は支出から控除せず、車両価値と純資産として別に表示します。

利用期間の最終年には、その時点の車両価値を最終売却額として別指標にします。今日の意思決定では、短期月額だけでなく25年支出合計と売却後実質コストを重視します。

5年サイクルは車検・修理は少ない一方で、買替回数とローン期間が多くなります。10〜15年サイクルは車検・修理は増えますが、買替回数が少なくなります。

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
