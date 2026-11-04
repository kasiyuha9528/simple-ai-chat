"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";

export default function Chat() {
  const { messages, sendMessage, status, stop } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const isBusy = status === "submitted" || status === "streaming";

  // メッセージが増える・文字が追加されるたびに、一番下までスクロールする
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages]);

  // 送信の処理(ボタンとEnterキーの両方から使う)
  function submit() {
    const text = input.trim();
    if (!text || isBusy) return;
    sendMessage({ text });
    setInput("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submit();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter以外、またはShift+Enter(改行)のときは、何もしない
    if (e.key !== "Enter" || e.shiftKey) return;
    // 日本語の変換中・変換確定のEnterでは送信しない
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    e.preventDefault();
    submit();
  }

  return (
    <div className="bg-white text-gray-900">
      <div className="mx-auto flex h-dvh max-w-2xl flex-col">
        <header className="border-b border-gray-200 px-4 py-3 text-lg font-semibold">
          AIチャット
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={
                message.role === "user" ? "flex justify-end" : "flex justify-start"
              }
            >
              <div
                className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 ${
                  message.role === "user"
                    ? "bg-gray-800 text-white"
                    : "bg-gray-100 text-gray-900"
                }`}
              >
                {message.parts.map((part, index) =>
                  part.type === "text" ? (
                    <span key={index}>{part.text}</span>
                  ) : null,
                )}
              </div>
            </div>
          ))}

          {status === "submitted" && (
            <p className="text-sm text-gray-500">考え中…</p>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex gap-2 border-t border-gray-200 p-4"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder="メッセージを入力"
            className="flex-1 resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
          />
          {isBusy ? (
            <button
              type="button"
              onClick={() => stop()}
              className="rounded-lg border border-gray-800 px-4 py-2 text-gray-800"
            >
              停止
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="rounded-lg bg-gray-800 px-4 py-2 text-white disabled:opacity-40"
            >
              送信
            </button>
          )}
        </form>
        <p className="px-4 pb-3 text-xs text-gray-500">
          Enterで送信 / Shift+Enterで改行
        </p>
      </div>
    </div>
  );
}