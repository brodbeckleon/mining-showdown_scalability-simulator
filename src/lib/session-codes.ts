// Unambiguous characters — no 0/O or 1/I confusion
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateSessionCode(length = 6): string {
  return Array.from(
    { length },
    () => CHARS[Math.floor(Math.random() * CHARS.length)],
  ).join("");
}
