import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 全ページ・全APIの前に実行され、Basic認証(ID・パスワード)を確認する。
// 知らない人に使われて、APIの利用料金が増えるのを防ぐための関数。

// 文字列を、長さに関わらず同じ時間で比べる(処理時間から推測されるのを防ぐ)
function safeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const x = encoder.encode(a);
  const y = encoder.encode(b);
  let diff = x.length ^ y.length;
  const length = Math.max(x.length, y.length);
  for (let i = 0; i < length; i++) {
    diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  }
  return diff === 0;
}

// "Authorization: Basic xxxx" から、IDとパスワードを取り出す
function parseBasicAuth(header: string | null) {
  if (!header?.startsWith("Basic ")) return null;
  try {
    // base64を、日本語も扱えるように UTF-8 として読み直す
    const binary = atob(header.slice("Basic ".length));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const decoded = new TextDecoder().decode(bytes);
    // 「ID:パスワード」の最初の : で分ける(パスワードに : があってもよい)
    const index = decoded.indexOf(":");
    if (index === -1) return null;
    return { user: decoded.slice(0, index), password: decoded.slice(index + 1) };
  } catch {
    return null;
  }
}

function unauthorized() {
  return new NextResponse("認証が必要です", {
    status: 401,
    headers: {
      // これを返すと、ブラウザがID・パスワードの入力画面を出す
      "WWW-Authenticate": 'Basic realm="Simple AI Chat", charset="UTF-8"',
    },
  });
}

export function proxy(request: NextRequest) {
  const expectedUser = process.env.BASIC_AUTH_USER;
  const expectedPassword = process.env.BASIC_AUTH_PASSWORD;

  // 環境変数が未設定のとき
  if (!expectedUser || !expectedPassword) {
    // 開発中は、認証なしで通す(設定を忘れても開発が止まらないように)
    if (process.env.NODE_ENV !== "production") return NextResponse.next();
    // 本番では、設定漏れのまま公開されないよう、すべて断る
    return new NextResponse("サーバーの設定が完了していません", { status: 503 });
  }

  const credentials = parseBasicAuth(request.headers.get("authorization"));
  if (
    !credentials ||
    !safeEqual(credentials.user, expectedUser) ||
    !safeEqual(credentials.password, expectedPassword)
  ) {
    return unauthorized();
  }

  return NextResponse.next();
}

export const config = {
  // 画面とAPIのすべてが対象。ビルド済みの静的ファイルとアイコンだけは除く
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
