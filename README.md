# kfc-problem-solver

KFC の希望商品と個数から、最安値のセット・単品の組み合わせを提案する Web アプリの開発基盤です。購入プランの最適化処理と実際の商品データは未実装です。

## 構成

- React Router 8.5.1 Framework Mode / React / TypeScript / Vite。Node.js 24 で SSR を実行します。
- Rust 1.90.0 → `wasm32-unknown-unknown`。ブラウザから WASM を読み込みます。現在の公開関数は ABI バージョン確認のみで、整数線形計画ソルバーは今後実装します。
- SQLite (`node:sqlite`)。DB 接続は `*.server.ts` に閉じ込め、loader が商品を取得します。DB ファイルをブラウザへ配信しません。
- 商品 `products`、販売単位 `offers`、内訳 `offer_items` を定義。単品も内訳が1商品の販売単位として表現し、価格は整数の円で保存します。店舗・期間・選択式セットの制約は今後拡張します。

## 初回セットアップ

Node.js 24 と公式 rustup をインストールしてください。Rust のバージョンと WASM ターゲットは `rust-toolchain.toml` で指定しています。

```sh
npm ci --include=dev
rustup show
npm run db:migrate
npm run wasm:build
npm run dev
```

開発サーバーのポートは 5173。Rust を変更した後は `npm run wasm:build` を再実行してください。SQLite の既定パスは作業ディレクトリからの `data/kfc.sqlite`。変更する場合は `DATABASE_PATH` をプロセスの環境変数で設定します（`.env` の自動読込には依存しません）。マイグレーションとサーバーに同じパスを指定してください。

クラウドの既存ツールを使う場合は、先に次を実行します。

```sh
export CARGO_HOME=/workspace/.kfc-tools/cargo
export RUSTUP_HOME=/workspace/.kfc-tools/rustup
export PATH="$CARGO_HOME/bin:$PATH"
cd /workspace/kfc-problem-solver
```

## 検証と本番起動

```sh
npm run typecheck
npm test
npm run build
npm start
```

`npm test` は SQLite のマイグレーション再実行・制約、Rust、生成済み WASM の実行を検証します。本番サーバーの既定ポートは 3000。`npm run build` で WASM も生成します。ホーム画面で「接続済み (ABI v1)」と表示されればブラウザ上の WASM 接続を確認できます。

商品データは初期状態では空です。公式価格を検証せずに仮の価格を登録しません。SQLite ファイルは Git 管理外のため、運用時には永続ボリュームとバックアップが必要です。

今後は入力・出力の型と「必要個数以上を許容するか」などの制約を定義し、WASM に整数最適化処理を追加します。現在は最安値を計算しません。
