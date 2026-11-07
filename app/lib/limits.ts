// 利用上限の設定。画面側(Chat.tsx)とサーバー側(route.ts)の両方で使う。
// 数字を変えたいときは、ここだけ直せばよい。

// 1回の入力の最大文字数
export const MAX_INPUT_CHARS = 2000;

// Claudeに送る会話の履歴の上限(往復の数)。1往復 = ユーザーの発言1回 + AIの返答1回
export const MAX_ROUND_TRIPS = 10;

// 1回の返答の最大トークン数
export const MAX_OUTPUT_TOKENS = 1024;
