import { anthropic } from "@ai-sdk/anthropic";
import {
  APICallError,
  LoadAPIKeyError,
  RetryError,
  convertToModelMessages,
  createUIMessageStreamResponse,
  smoothStream,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import {
  MAX_INPUT_CHARS,
  MAX_OUTPUT_TOKENS,
  MAX_ROUND_TRIPS,
} from "../../lib/limits";
import type { ErrorCode } from "../../lib/errors";

export const maxDuration = 30;

// AIの役割と、答え方のルール(システムプロンプト)
const SYSTEM_PROMPT = `あなたは、親切で正確な日本語のアシスタントです。

# 答え方のルール
- 質問には、結論を先に、簡潔に答えてください。
- 分からないことや、確信が持てないことは、推測で断定せず「分からない」「確実ではない」と伝えてください。
- 長い返答は、見出しや箇条書きを使って読みやすく整理してください。
- 相手が別の言語で話しかけたときは、その言語で答えてください。
- 違法な行為や、他人を傷つける行為の手伝いはできません。その場合は、理由を短く伝えて断ってください。`;

// メッセージの文章部分だけを取り出す
function getText(message: UIMessage): string {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("");
}

// 直近の MAX_ROUND_TRIPS 往復だけを残す
function takeRecentRoundTrips(messages: UIMessage[]): UIMessage[] {
  const userIndexes = messages
    .map((m, i) => (m.role === "user" ? i : -1))
    .filter((i) => i !== -1);
  if (userIndexes.length <= MAX_ROUND_TRIPS) return messages;
  // 後ろから数えて MAX_ROUND_TRIPS 番目のユーザー発言から先を残す
  const start = userIndexes[userIndexes.length - MAX_ROUND_TRIPS];
  return messages.slice(start);
}

// 返答の途中で起きたエラーを、種類(コード)に分類する。
// 詳しい内容はサーバーのログにだけ残し、画面にはコードだけを返す。
function classifyError(error: unknown): ErrorCode {
  console.error("[api/chat] error:", error);

  // 自動の再試行を使い切ったときは、最後のエラーを調べる
  const e = RetryError.isInstance(error) ? error.lastError : error;

  // APIキーが設定されていない
  if (LoadAPIKeyError.isInstance(e)) return "auth";

  if (APICallError.isInstance(e)) {
    const status = e.statusCode;
    // APIキーが無効、または権限がない
    if (status === 401 || status === 403) return "auth";
    // 利用枠(クレジット)の残りがない
    if (status === 400 && /credit balance/i.test(e.message)) return "billing";
    // 短時間にリクエストが多すぎる
    if (status === 429) return "rate_limit";
    // Anthropic側が混み合っている(529)、または障害(5xx)
    if (status !== undefined && (status === 529 || status >= 500)) {
      return "overloaded";
    }
  }
  return "unknown";
}

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  // サーバー側でも入力を確認する(画面側の制限は、直接APIを呼ばれると無意味なため)
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user") {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  if (getText(last).length > MAX_INPUT_CHARS) {
    return Response.json({ error: "input_too_long" }, { status: 400 });
  }

  const result = streamText({
    model: anthropic("claude-haiku-5-5"),
    instructions: SYSTEM_PROMPT,
    messages: await convertToModelMessages(takeRecentRoundTrips(messages)),
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    experimental_transform: smoothStream({
      delayInMs: 10,
      chunking: /[\s\S]/u,
    }),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      onError: classifyError,
    }),
  });
}
