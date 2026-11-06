# kfc-problem-solver

希望商品と個数から、最安値のセット・単品の組み合わせを提案する Web アプリの開発基盤です。DB・バックエンドは使わず、静的な HTML・JavaScript・WebAssembly を GitHub Pages で配信します。

現在はサンプルメニューの表示と Rust/WASM の接続確認まで実装しています。最適化アルゴリズムは未実装です。表示価格は架空の検証用データで、KFC の実際の価格ではありません。

## 構成

- React Router 8.5.1 SPA Mode / React / TypeScript / Vite
- Rust 1.90.0 → WebAssembly（現在は ABI バージョンの確認のみ）
- `app/data/catalog.ts`: 商品・販売単位・セット内訳・整数の税込価格を直接定義
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

開発サーバーのポートは 5173。Rust の変更後は `npm run wasm:build` を再実行します。メニューは `app/data/catalog.ts` を編集します。ID は価格・名称の変更時も維持し、サンプルを実データに置き換える際は対象店舗・確認日・出典を記載してください。価格変更の反映には再ビルド・再デプロイが必要です。

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

`npm test` で静的メニューの整合性、最適化仕様の12例、Rust、生成 WASM を検証します。`npm run build` は WASM と静的サイトを生成します。配信するのは **`build/client/` だけ**です。`npm start` は Vite のローカルプレビュー（既定4173）です。

リポジトリ名のサブパスでも確認してください:

```sh
BASE_PATH=/kfc-problem-solver/ npm run build
BASE_PATH=/kfc-problem-solver/ npm start
```

ブラウザで `/kfc-problem-solver/` を開き、メニューと「接続済み (ABI v1)」の表示を確認します。`BASE_PATH` は先頭・末尾に `/` を付けます。Router の basename・Vite のアセットパス・WASM の URL がこの設定を共有します。

## GitHub Pages に公開

公開リポジトリは GitHub Free で Pages を利用できます。このアプリには有料の DB・サーバーは不要です。GitHub Pages / Actions の利用上限と利用規約は適用されます。

1. リポジトリの **Settings → Pages → Build and deployment → Source** で **GitHub Actions** を選びます（管理権限が必要）。
2. この変更を `main` にマージすると `.github/workflows/pages.yml` がテスト・ビルドし、`build/client/` を Pages に配信します。Actions から手動実行も可能です。
3. 公開完了後、Actions の `github-pages` 環境に表示される URL を開きます。通常は `https://noradium.github.io/kfc-problem-solver/` です。

公開パスは `actions/configure-pages` の出力からビルド時に設定します。秘密の API キーは不要です。カタログを含むすべての配信ファイルは閲覧者に公開されます。現在はトップページだけを扱います。将来パスを追加する場合、Pages にサーバーの SPA リライトがないため、静的事前生成などの対応が必要です。

クラウド開発環境の Publish と GitHub Pages への公開は別の操作です。
