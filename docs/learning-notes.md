# 学習ノート:シンプルAIチャットUI(案件No.07)

案件の進行に合わせて、ステップごとに追記していきます。

## Step 1 雛形作成、README・学習ノート、環境変数の準備

### やったこと

- `create-next-app` でNext.jsのプロジェクトを作成した(TypeScript、ESLint、Tailwind CSS、App Router、`src/` なし)
- AI SDKのパッケージ3つ(`ai`、`@ai-sdk/react`、`@ai-sdk/anthropic`)をインストールした
- `.env.local`(実際の値を入れる)と `.env.example`(項目名だけの見本)を作成した
- `.gitignore` に `!.env.example` を追記した
- README.md と学習ノートの骨組みを作成した

### 学んだこと

- インストールされたバージョンは、Next.js 16.4.3、`ai` 7.0.154、`@ai-sdk/react` 4.0.158、`@ai-sdk/anthropic` 4.0.89だった。AI SDKの書き方はバージョンで変わるため、実装前に確認が必要
- Next.js 16では、全リクエストの前処理を行うファイルの名前が `proxy.ts` になる(15以前は `middleware.ts`)。Step6のBasic認証で使う
- APIキーは `.env.local` に置き、`NEXT_PUBLIC_` を付けない。付けるとブラウザに露出する
- `.env.local` はGitに上げず、`.env.example` に項目名だけを書いて共有する
- `.gitignore` の `.env*` は `.env.example` まで除外する。`!.env.example` を足すと例外にできる
- `git status` に `.env.local` が出てこないことで、Git管理から外れていることを確認できる

### つまずいた点と解決方法

**1. `.env.local` と `.env.example` が作成されなかった**

- 症状:作成したつもりだったが、フォルダにファイルがなかった
- 原因:作成の操作が反映されていなかった。`.txt` が付いた別名のファイルもなく、ファイル自体が存在しなかった
- 解決:PowerShellのコマンドで作成し、`dir -Force .env*` で存在を確認した。先頭の `.` で始まるファイルは、作成後に必ず存在を確認する

**2. portfolio-template を `git clone` できなかった**

- 症状:`Repository not found` と表示され、READMEと学習ノートの雛形を取得できなかった
- 原因:指定したURLのリポジトリがGitHub上で見つからなかった。ユーザー名は以前の案件のURLで確認済みだったため、リポジトリ名または公開設定が一致していなかったと考えられる
- 解決:以前の案件のファイルを流用し、中身を今回の案件用に書き換えた。コピーしただけでは前の案件の内容が残るため、`git status` と見出しの確認が必要

## Step 2 API Route作成、疎通確認

### やったこと

- `app/api/chat/route.ts` を作成し、ブラウザから届いた会話の履歴をClaude(`claude-haiku-5-5`)に送り、返答をストリーミングで返すようにした
- `npx tsc --noEmit` で、AI SDK v7の型とコードが合っていることを確認した
- `curl.exe` でテスト用のJSONを送り、返答が少しずつ届くことを確認した

### 学んだこと

- `app/api/chat/route.ts` というファイルの場所が、そのまま `/api/chat` というURLになる。ファイル内の `POST` という名前の関数が、POST通信を受け取る
- AI SDK v7では、古い書き方から次の点が変わっていた
  - `system` は `instructions` に変わった
  - `result.toUIMessageStreamResponse()` は非推奨で、`createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream }) })` を使う
  - `convertToModelMessages` は `await` を付けて呼ぶ
- v7はNode.js 22以上が必要。手元のNode.jsはv24で問題なかった
- ストリーミングの出力は、`start` → `text-delta`(返答のかけら)が複数 → `text-end` → `finish` → `[DONE]` の順に届く
- `text-delta` は2〜6文字のかたまりで届き、1文字ずつではない。「1文字単位の更新」を見せるには、画面側で文字単位に分割する処理が必要になる
- `streamText` の戻り値は、返答の完成を待たずに、できた部分から順に取り出せる。これが画面での逐次表示の土台になる
- 1回のやりとりで使われたトークン数は、返答の先頭の情報(`input_tokens` など)で確認できる

### つまずいた点と解決方法

**1. コードをターミナルに貼り付けてしまった**

- 症状:`import` や `export` が「コマンドレットとして認識されません」というエラーになった
- 原因:`route.ts` のコードを、ファイルではなくターミナル(PowerShell)に貼り付けた。PowerShellはTypeScriptを実行できない
- 解決:`New-Item` でファイルを作り、VSCodeのエディタに貼り付けて保存した。ターミナルにはコマンドだけを入力する

**2. テスト用のJSONも同じくターミナルに貼り付けてしまった**

- 症状:`式またはステートメントのトークンを使用できません` というエラーになった
- 原因:`test.json` の中身をターミナルに貼り付けた(1と同じ原因)
- 解決:`New-Item test.json` で空のファイルを作り、エディタに貼り付けて保存した

**3. `curl.exe` で `Failed to open` と表示された**

- 症状:`C:\Users\User\test.json` を開けないというエラーになった
- 原因:`test.json` を `C:\Users\User` ではなく `C:\Users\User\test` フォルダの中に作っていた
- 解決:`dir` でファイルの場所を確認し、今いるフォルダのファイルを指す `@test.json` で実行した

## Step 3 チャットUI、ストリーミング表示

### やったこと

- `app/components/Chat.tsx` を作成し、`useChat` で会話の履歴を管理して、吹き出しで表示するようにした
- `app/page.tsx` から `Chat` を表示するようにした
- `route.ts` に `smoothStream` を追加し、返答を1文字ずつ流れるように表示した
- 次の4点を確認し、すべて問題なかった
  - 返答が1文字ずつ流れる
  - 前の発言を踏まえて答える(会話履歴の保持)
  - 返答が長くなっても、画面が一番下に追従する
  - 返答中は送信ボタンが押せない

### 学んだこと

- 入力欄の中身は `useChat` ではなく、自分で `useState` に持つ(v5以降の書き方)。送信は `sendMessage({ text })` で行う
- `useChat` の `status` は `submitted`(返答待ち)→ `streaming`(返答が届いている)→ `ready`(完了)と変わる。送信ボタンの無効化や「考え中…」の表示に使える
- メッセージの文章は `message.parts` の中の、`type === "text"` の部品の `text` に入っている
- ブラウザ側で動くファイルには、先頭に `"use client"` が必要。入力欄の状態やスクロールなど、画面の動きを扱うため
- 一覧の各要素には、区別するための `key` を付ける。ここでは `message.id` を使った
- `useRef` で画面上の1か所(一番下の目印)を指し、`useEffect` で `messages` が変わるたびにそこまでスクロールする
- フォームの送信では、`e.preventDefault()` でページの再読み込みを止める
- `smoothStream` は、届いた返答のかけらを決まった間隔で細かく分けて流し直す。`chunking` に正規表現 `/[\s\S]/u` を指定すると、1文字ずつになる。日本語は、初期設定の単語単位ではうまく分けられない
- `delayInMs` を大きくするほどゆっくり流れるが、長い返答の表示が遅れる
- OSがダークモードでも読みにくくならないよう、画面全体に `bg-white text-gray-900` を付けて配色を固定した

### つまずいた点と解決方法

特になし。

## 振り返り

(最後のステップで記入します)

## 用語集

### コード

| コード | 意味 |
| --- | --- |
| `.env.local` | 環境変数(APIキーなど)を書くファイル。Gitには上げない |
| `.env.example` | 必要な環境変数の項目名だけを書いた見本。Gitに上げる |
| `NEXT_PUBLIC_` | この接頭辞を付けた環境変数はブラウザに公開される |
| `!.env.example`(`.gitignore`) | 先頭の `!` は「この指定は除外しない」という例外の指定 |
| `git -C <フォルダ>` | 指定したフォルダの中でGitコマンドを実行する |
| `dir -Force` | 隠しファイルも含めてファイルを一覧表示する(PowerShell) |
| `proxy.ts` | Next.js 16で、全リクエストの前処理を書くファイル(15以前は `middleware.ts`) |
| `app/api/chat/route.ts` | このファイルの場所が `/api/chat` というURLになる。`POST` 関数がPOST通信を受け取る |
| `streamText` | Claudeに問い合わせ、返答をできた部分から順に受け取る(AI SDK) |
| `instructions` | AIの役割や口調を決める指示(システムプロンプト)。v6までの `system` に当たる |
| `convertToModelMessages` | 画面用のメッセージ形式を、Claudeに送る形式に変換する。v7では `await` を付ける |
| `createUIMessageStreamResponse` / `toUIMessageStream` | 返答を、画面側の `useChat` が読めるストリームにして返す |
| `"use client"` | このファイルはブラウザ側で動くと宣言する。画面の動き(状態やスクロール)を扱うファイルに必要 |
| `useChat` | 会話の履歴(`messages`)、送信(`sendMessage`)、状態(`status`)を管理する(`@ai-sdk/react`) |
| `status` | `submitted` → `streaming` → `ready` と変わる、通信の状態 |
| `message.parts` | 1つのメッセージを部品の配列で持つ。文章は `type === "text"` の部品に入っている |
| `useState` | 画面の状態(入力欄の中身など)を持つ。値が変わると画面が更新される |
| `useRef` | 画面上の要素を指し示す。ここでは「一番下の目印」に使った |
| `useEffect` | 指定した値が変わったときに、決まった処理を実行する。ここでは自動スクロールに使った |
| `e.preventDefault()` | ブラウザ標準の動き(フォーム送信での再読み込みなど)を止める |
| `smoothStream` | 返答のかけらを細かく分けて、決まった間隔で流し直す(`ai`) |
| `npx tsc --noEmit` | ファイルを出力せず、TypeScriptの型だけを検査する |
| `curl.exe -N` | 本物のcurlを使い、`-N` で届いた順に出力する(PowerShellの `curl` は別機能のため `.exe` を付ける) |

### 用語

| 用語 | 意味 |
| --- | --- |
| 環境変数 | プログラムの外に置く設定値。コードに直接書かず、秘密情報を守るために使う |
| MVP | 最小限の機能だけで動く最初の製品 |
| ストリーミング | 返答の完成を待たず、できた部分から順に表示する方式 |
| AI SDK | AIモデルを呼び出すためのVercel製のライブラリ。提供元ごとの違いを吸収する |
| API Route | Next.jsで、画面を持たず通信だけを受け付けるサーバー側の処理 |
| トークン | AIが文章を処理する単位。日本語では数文字が1トークンになる。費用や上限はトークン数で決まる |
| SSE(Server-Sent Events) | サーバーからブラウザへ、データを少しずつ送り続ける通信方式。`data:` で始まる行が流れる |
| `text-delta` | ストリーミングで届く、返答のかけら1つ分 |
