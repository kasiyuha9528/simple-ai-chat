// エラーの種類(コード)と、画面に出す日本語メッセージ。
// サーバー側(route.ts)はコードを返し、画面側(Chat.tsx)はコードをメッセージに変換する。
// 内部の詳しいエラー内容(APIキーの問題など)は、画面に出さない。

export type ErrorCode =
  // ユーザー起因
  | "input_too_long"
  | "invalid_request"
  | "network"
  // こちらの設定起因
  | "auth"
  | "billing"
  // 外部サービス起因
  | "rate_limit"
  | "overloaded"
  // 分類できないもの
  | "unknown";

const ERROR_MESSAGES: Record<ErrorCode, string> = {
  input_too_long: "入力が長すぎます。2,000文字以内に短くして、もう一度送ってください。",
  invalid_request: "送信内容に問題がありました。画面を再読み込みして、もう一度お試しください。",
  network: "通信できませんでした。ネットワークの接続を確認して、もう一度お試しください。",
  auth: "サービス側の設定に問題があり、現在ご利用いただけません。管理者にお問い合わせください。",
  billing: "サービスの利用枠の問題で、現在ご利用いただけません。管理者にお問い合わせください。",
  rate_limit: "アクセスが集中しています。しばらく待ってから、もう一度お試しください。",
  overloaded: "AIサービスが混み合っています。しばらく待ってから、もう一度お試しください。",
  unknown: "予期しないエラーが発生しました。時間をおいて、もう一度お試しください。",
};

function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && value in ERROR_MESSAGES;
}

// useChat の error を、画面に出すメッセージに変換する
export function toErrorMessage(error: Error): string {
  // 返答の途中で起きたエラー: message がエラーコードそのもの
  if (isErrorCode(error.message)) return ERROR_MESSAGES[error.message];

  // 送信前にサーバーが断ったエラー: 本文が {"error":"コード"} の形
  try {
    const body: unknown = JSON.parse(error.message);
    if (typeof body === "object" && body !== null && "error" in body) {
      const code = (body as { error: unknown }).error;
      if (isErrorCode(code)) return ERROR_MESSAGES[code];
    }
  } catch {
    // JSONではなかった場合は、次の判定へ進む
  }

  // サーバーに届かなかった通信エラー(ブラウザは TypeError で知らせる)
  if (error instanceof TypeError) return ERROR_MESSAGES.network;

  return ERROR_MESSAGES.unknown;
}
