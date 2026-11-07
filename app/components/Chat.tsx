"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import { toErrorMessage } from "../lib/errors";
import { MAX_INPUT_CHARS, MAX_ROUND_TRIPS } from "../lib/limits";

// 入力欄の高さの下限・上限(px)。60pxは約2行分、300pxは約12行分
const MIN_INPUT_HEIGHT = 60;
const MAX_INPUT_HEIGHT = 300;

function AiAvatar() {
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700"
      aria-hidden="true"
    >
      AI
    </div>
  );
}

function UserAvatar() {
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-700 text-white"
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6v1H4z" />
      </svg>
    </div>
  );
}

export default function Chat() {
  const { messages, setMessages, sendMessage, status, stop, error, clearError } =
    useChat({
      transport: new DefaultChatTransport({ api: "/api/chat" }),
    });
  const [input, setInput] = useState("");
  // 停止ボタンで止めた返答のid(「（停止しました）」を表示するために覚えておく)
  const [stoppedIds, setStoppedIds] = useState<string[]>([]);
  // 返答が始まる前に止めた場合は、返答のメッセージがまだないため、別に覚えておく
  const [stoppedBeforeReply, setStoppedBeforeReply] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [inputHeight, setInputHeight] = useState(MIN_INPUT_HEIGHT);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  const isBusy = status === "submitted" || status === "streaming";
  const isOverLimit = input.length > MAX_INPUT_CHARS;
  const canSend = input.trim().length > 0 && !isOverLimit;
  // ユーザーの発言の数 = 往復の数。上限を超えると、古い会話はClaudeに送られない
  const roundTrips = messages.filter((m) => m.role === "user").length;
  const isHistoryTrimmed = roundTrips > MAX_ROUND_TRIPS;

  // メッセージが増える・文字が追加されるたびに、一番下までスクロールする
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages, status]);

  // 送信の処理(ボタンとEnterキーの両方から使う)
  function submit() {
    const text = input.trim();
    if (!text || isBusy || input.length > MAX_INPUT_CHARS) return;
    clearError();
    setStoppedBeforeReply(false);
    sendMessage({ text });
    setInput("");
  }

  // 停止ボタン: 返答を止めて、どこで止めたかを覚える
  function handleStop() {
    const last = messages[messages.length - 1];
    if (status === "streaming" && last?.role === "assistant") {
      setStoppedIds((ids) => [...ids, last.id]);
    } else {
      setStoppedBeforeReply(true);
    }
    stop();
  }

  // 新しい会話: 画面の履歴とエラー、停止の記録をすべて消す
  function handleNewChat() {
    setMessages([]);
    setStoppedIds([]);
    setStoppedBeforeReply(false);
    clearError();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submit();
  }

  // 入力欄の上のつまみをドラッグして、高さを変える
  function handleResizeStart(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startY: e.clientY, startHeight: inputHeight };
  }

  function handleResizeMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    // 上にドラッグするほど(clientYが小さくなるほど)、高くなる
    const next = drag.startHeight + (drag.startY - e.clientY);
    setInputHeight(Math.min(MAX_INPUT_HEIGHT, Math.max(MIN_INPUT_HEIGHT, next)));
  }

  function handleResizeEnd() {
    dragRef.current = null;
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
    <div className="h-dvh bg-blue-100 p-3 text-gray-900 sm:p-6">
      <div className="mx-auto flex h-full max-w-[800px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
        <header className="px-4 pb-2 pt-4 text-base font-semibold sm:px-6">
          AIチャット
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-6">
          {messages.map((message) => {
            const isUser = message.role === "user";
            return (
              <div
                key={message.id}
                className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`}
              >
                {isUser ? <UserAvatar /> : <AiAvatar />}
                <div
                  className={`max-w-[75%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 leading-relaxed ${
                    isUser ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-900"
                  }`}
                >
                  {message.parts.map((part, index) =>
                    part.type === "text" ? (
                      <span key={index}>{part.text}</span>
                    ) : null,
                  )}
                  {stoppedIds.includes(message.id) && (
                    <span className="mt-1 block text-xs text-gray-500">
                      （停止しました）
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {status === "submitted" && (
            <div className="flex items-start gap-3">
              <AiAvatar />
              <div className="rounded-2xl bg-gray-100 px-4 py-2.5 text-sm text-gray-500">
                考え中…
              </div>
            </div>
          )}
          {stoppedBeforeReply && (
            <p className="text-center text-xs text-gray-500">（停止しました）</p>
          )}
          <div ref={bottomRef} />
        </div>

        {error && (
          <div
            role="alert"
            className="mx-4 mb-1 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700 sm:mx-6"
          >
            {toErrorMessage(error)}
          </div>
        )}

        {isHistoryTrimmed && (
          <div className="mx-4 mb-1 flex items-center justify-between gap-3 rounded-xl bg-amber-50 px-4 py-2 text-xs text-amber-800 sm:mx-6">
            <span>
              会話が長くなったため、古いやりとりは参照されません(直近{MAX_ROUND_TRIPS}往復のみ)。
            </span>
            <button
              type="button"
              onClick={handleNewChat}
              disabled={isBusy}
              className="shrink-0 rounded-lg bg-amber-100 px-3 py-1 font-medium transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              新しい会話
            </button>
          </div>
        )}

        <div className="px-4 pb-4 sm:px-6">
          <div
            onPointerDown={handleResizeStart}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
            onPointerCancel={handleResizeEnd}
            role="separator"
            aria-orientation="horizontal"
            aria-label="入力欄の高さを変更"
            className="group flex h-4 cursor-row-resize touch-none select-none items-center justify-center"
          >
            <div className="h-1 w-10 rounded-full bg-gray-300 transition group-hover:bg-gray-400" />
          </div>
          <form
            onSubmit={handleSubmit}
            className="flex items-end gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2 shadow-sm transition focus-within:border-blue-300 focus-within:ring-4 focus-within:ring-blue-100"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{ height: inputHeight }}
              placeholder="メッセージを入力(最大2,000文字)"
              className="max-h-[50dvh] flex-1 resize-none overflow-y-auto bg-transparent py-1.5 text-base leading-6 text-gray-900 outline-none placeholder:text-gray-400"
            />
            {isBusy ? (
              <button
                type="button"
                onClick={handleStop}
                aria-label="停止"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-800 text-white transition hover:bg-gray-700"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </button>
            ) : (
              <button
                type="submit"
                disabled={!canSend}
                aria-label="送信"
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition ${
                  canSend
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "cursor-not-allowed bg-gray-200 text-gray-400"
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <path d="M12 19V5" />
                  <path d="M5 12l7-7 7 7" />
                </svg>
              </button>
            )}
          </form>
          <div className="mt-2 flex items-center justify-between px-1 text-xs text-gray-500">
            <span>Enterで送信 / Shift+Enterで改行</span>
            <span className={isOverLimit ? "font-medium text-red-600" : ""}>
              {input.length.toLocaleString()} / {MAX_INPUT_CHARS.toLocaleString()}
              {isOverLimit && "(文字数が多すぎます)"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
