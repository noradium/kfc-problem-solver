# kfc-problem-solver

希望商品と個数から、最安値のセット・単品の組み合わせを提案する Web アプリの開発基盤です。DB・バックエンドは使わず、静的な HTML・JavaScript・WebAssembly を GitHub Pages で配信します。

KFC公式メニューから取得した66商品の名称・税込価格・カテゴリを表示します。単品30商品の希望個数を入力すると、Rust/WASM がブラウザ内で購入プランを計算します。セット・パック36商品は一覧表示のみで、計算には含めません。

## 構成

- React Router 8.5.1 SPA Mode / React / TypeScript / Vite
- Rust 1.90.0 → WebAssembly（整数被覆問題に特化した枝刈り付き探索、JSON ABI v2）
- `app/data/kfc-menu.json`: 公式一覧の取得済みスナップショットと取得元・日時・元HTMLのSHA-256
- `app/data/catalog.ts`: 公式商品IDを使い、単品だけを計算用カタログに変換
- `app/domain/optimization.ts`: 最適化の入力・出力型
- [docs/optimization.md](docs/optimization.md): 数理モデルと受け入れ仕様

ブラウザから DB や API への接続は不要です。Node.js と Rust は開発・ビルド時だけ必要で、配信時は不要です。

## 開発

Node.js 24 と公式 rustup をインストールします。Rust の固定バージョンと WASM ターゲットは `rust-toolchain.toml` に定義しています。

```sh
npm ci --include=dev
rustup show
npm run wasm:build
npm run dev
```

開発サーバーのポートは 5173。Rust の変更後は `npm run wasm:build` を再実行します。メニューの更新方法と価格の条件は下記を参照してください。価格変更の反映には再ビルド・再デプロイが必要です。

## 公式メニューデータ

[KFC公式メニュー](https://www.kfc.co.jp/menu) を2026年11月8日17:24:45 UTC（日本時間11月9日）に取得しました。店舗・受取方法を選択していない一覧の表示価格です。画面にも取得元・日本時間の取得日・税込価格であること・計算対象の制限を表示します。販売状況や価格は店舗・期間・選択内容によって変わる場合があります。

複数カテゴリにある商品は公式商品IDでまとめ、全66商品と元のカテゴリを保持しています。最適化用の商品・販売単位IDには公式商品IDの数字部分を利用し、名称・価格の変更時も維持します。ナゲット5ピースは「5個入り1商品」、ドリンクは「記載サイズ1杯」で数え、フレーバーは区別しません。

セット・パックは、現行の固定内訳モデルへ推測で変換しません。選択肢や追加料金があるため、全36商品を表示専用としています。条件の確認例：[トクトクパック4ピース](https://www.kfc.co.jp/menu/chicken/I-000032863-007-prod)、[オリジナルチキンバーガーセット](https://www.kfc.co.jp/menu/set/I-000032613-007-prod)、[キッズオリジナルチキンセット](https://www.kfc.co.jp/menu/kids/I-000032923-007-prod)。計算結果は取り込んだ単品内での最安値であり、セット・クーポン・店舗独自商品まで含めた最安値ではありません。

自動取得・自動更新は行いません。更新時は公式一覧を再取得し、`app/data/kfc-menu.json` の取得情報・商品名・価格・カテゴリを更新して、`single` / `bundle` の分類を確認してください。`npm run catalog:test` でデータの整合性とセット除外を確認し、再ビルド・再デプロイします。実行時のDBや外部APIへのアクセスは不要です。

クラウド環境に既にある Rust を使用する場合:

```sh
export CARGO_HOME=/workspace/.kfc-tools/cargo
export RUSTUP_HOME=/workspace/.kfc-tools/rustup
export PATH="$CARGO_HOME/bin:$PATH"
cd /workspace/kfc-problem-solver
```

## 検証・静的ビルド

```sh
npm run typecheck
npm test
npm run build
npm start
```

`npm test` で静的メニューの整合性、最適化仕様の12例、Rust、生成 WASM を検証します。WASM の計算結果は小さな問題80件の独立した全探索とも比較し、不正入力・探索上限・32 bit を超える金額を検証します。`npm run build` は WASM と静的サイトを生成します。配信するのは **`build/client/` だけ**です。`npm start` は Vite のローカルプレビュー（既定4173）です。

リポジトリ名のサブパスでも確認してください:

```sh
BASE_PATH=/kfc-problem-solver/ npm run build
BASE_PATH=/kfc-problem-solver/ npm start
```

ブラウザで `/kfc-problem-solver/` を開き、希望数を入力し、購入プランが表示されることを確認します。オリジナルチキン１ピース3個・ポテトS1個なら、取得済み単品価格で合計1,280円です。`BASE_PATH` は先頭・末尾に `/` を付けます。Router の basename・Vite のアセットパス・WASM の URL がこの設定を共有します。

## GitHub Pages に公開

公開リポジトリは GitHub Free で Pages を利用できます。このアプリには有料の DB・サーバーは不要です。GitHub Pages / Actions の利用上限と利用規約は適用されます。

1. リポジトリの **Settings → Pages → Build and deployment → Source** で **GitHub Actions** を選びます（管理権限が必要）。
2. この変更を `main` にマージすると `.github/workflows/pages.yml` がテスト・ビルドし、`build/client/` を Pages に配信します。Actions から手動実行も可能です。
3. 公開完了後、Actions の `github-pages` 環境に表示される URL を開きます。通常は `https://noradium.github.io/kfc-problem-solver/` です。

公開パスは `actions/configure-pages` の出力からビルド時に設定します。秘密の API キーは不要です。カタログを含むすべての配信ファイルは閲覧者に公開されます。現在はトップページだけを扱います。将来パスを追加する場合、Pages にサーバーの SPA リライトがないため、静的事前生成などの対応が必要です。

クラウド開発環境の Publish と GitHub Pages への公開は別の操作です。

## 計算と制限

希望個数以上の購入を許容し、金額 → 余り → 販売単位数の順で最小化します。各商品の入力は0〜100個。空の入力は購入不要（0円）です。整数演算で枝刈り付き探索を行い、探索を完了した場合だけ最適解として表示します。汎用の外部ILPライブラリは使用していません。

計算は専用 Web Worker 内で行います。入力変更・キャンセル時は Worker を終了し、古い結果を破棄します。Rust の探索上限は200,000ノード、起動・WASM取得を含む Worker の制限時間は5秒です。上限に達した場合は最安値未確定とし、Rust が見つけた実行可能な暫定解があれば併記します。Worker の制限時間で打ち切る場合、暫定解は返しません。大きいカタログでは時間内に解けない可能性があります。

## ブラウザテスト

```sh
npx playwright install chromium
BASE_PATH=/kfc-problem-solver/ npm run build
npm run test:e2e
```

モバイル幅での入力・購入内訳・余り、入力検証、再計算、WASM取得失敗、キャンセル、時間切れを確認します。CIでも実行します。環境にインストール済みのChromiumを使う場合は `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium` を指定できます。
