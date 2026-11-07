import { anthropic } from "@ai-sdk/anthropic";
import {
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
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
