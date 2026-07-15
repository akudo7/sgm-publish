# プロジェクト仕様

## 概要

NestJS 製の TODO アプリケーション。REST API を提供し、TODO タスクの登録・一覧・更新・削除（CRUD）を可能にする。

## 技術スタック

- **ランタイム**: Node.js 20+
- **パッケージマネージャ**: npm
- **フレームワーク**: NestJS
- **テストフレームワーク**: Jest（ユニットテスト）、supertest（e2e テスト）
- **ビルドツール**: Nest CLI（`nest build`）

## 機能要件

### TODO API

- `POST /todos` — 新規 TODO 登録
  - リクエストボディ: `{ "title": string }`（title は必須・空文字不可）
  - レスポンス: `{ "id": number, "title": string, "done": boolean }`
- `GET /todos` — TODO 一覧取得
  - レスポンス: `{ "id": number, "title": string, "done": boolean }[]`
- `PATCH /todos/:id` — TODO 更新（done の切り替え等）
  - リクエストボディ: `{ "done": boolean }`
  - レスポンス: 更新された TODO オブジェクト
- `DELETE /todos/:id` — TODO 削除
  - レスポンス: `{ "deleted": true }`

### テスト

- **ユニットテスト** (`src/todos/todo.service.spec.ts`): `TodoService` の create / findAll / update / remove ロジックを Jest でテスト
- **e2e テスト** (`test/todos.e2e-spec.ts`): NestJS TestingModule + supertest で全エンドポイントをテスト
- 全テストがパスすること

## 制約条件

- `node_modules/` ディレクトリ内のファイルを検索対象・編集対象から除外する
- 外部データベースは使用せず、メモリ上の配列で状態を管理
- NestJS の公式ジェネレーター（`nest g`）は使用せず、手動でファイルを作成する

---

## 完成の定義

以下が**全て**満たされた状態を「完成」とする。

### 必須ファイル（全て `write_file` で作成すること）

| ファイル | 内容 |
|---------|------|
| `src/main.ts` | NestJS アプリ起動エントリポイント |
| `src/app.module.ts` | AppModule（TodosModule を import） |
| `src/todos/todo.controller.ts` | REST コントローラー |
| `src/todos/todo.service.ts` | ビジネスロジック（メモリ配列管理） |
| `src/todos/todo.dto.ts` | CreateTodoDto / UpdateTodoDto |
| `src/todos/todo.service.spec.ts` | TodoService ユニットテスト（Jest） |
| `test/todos.e2e-spec.ts` | TODO API e2e テスト（supertest） |
| `test/app.e2e-spec.ts` | アプリ起動確認 e2e テスト |
| `package.json` | NestJS 依存関係・`test` / `test:e2e` スクリプト定義 |
| `tsconfig.json` | TypeScript 設定 |
| `README.md` | 概要・インストール・起動・テスト手順 |

### 必須コマンド（全て成功すること）

```bash
npm install
npm test -- --coverage   # ユニットテストが全て PASS かつカバレッジ 100%
npm run test:e2e          # e2e テストが全て PASS
```

### カバレッジ要件

`npm test -- --coverage` の出力で `TodoService` のカバレッジが全項目 **100%** であること。

```
File                  | Stmts | Branch | Funcs | Lines
----------------------|-------|--------|-------|------
todo.service.ts       |   100 |    100 |   100 |   100
```

`package.json` の Jest 設定に以下を追加すること（`TodoService` ファイル限定）:

```json
"jest": {
  "coverageThreshold": {
    "./src/todos/todo.service.ts": {
      "statements": 100,
      "branches": 100,
      "functions": 100,
      "lines": 100
    }
  }
}
```
