export const AUTH_COOKIE = "tm_auth";

/**
 * 合言葉から決め打ちのトークンを作る。Cookie には合言葉そのものを入れない。
 * Web Crypto を使うので Node ランタイムでも middleware(Edge) でも同じ値になる。
 */
export function authToken(password: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  const salt = "ikebeji-board";
  const input = `${salt}:${password}`;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + c, 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(36)}${h2.toString(36)}`;
}
