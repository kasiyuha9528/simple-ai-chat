import { anthropic } from "@ai-sdk/anthropic";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  smoothStream,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: anthropic("claude-haiku-5-5"),
    instructions: "あなたは親切な日本語のアシスタントです。",
    messages: await convertToModelMessages(messages),
    experimental_transform: smoothStream({
      delayInMs: 10,
      chunking: /[\s\S]/u,
    }),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}