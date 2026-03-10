function tokenizeMoves(text) {
  let s = String(text || "");
  s = s.replace(/\{[\s\S]*?\}/g, " ");
  s = s.replace(/;[^\n]*/g, " ");
  while (/\([^()]*\)/.test(s)) {
    s = s.replace(/\([^()]*\)/g, " ");
  }
  s = s.replace(/\$\d+/g, " ");
  s = s.replace(/\d+\.(\.\.)?/g, " ");
  s = s.replace(/\s+/g, " ").trim();

  return s
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t));
}

function splitIntoPgnGames(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .trim()
    .split(/\n\s*\n(?=\s*\[)/)
    .filter(Boolean);
}

export { tokenizeMoves, splitIntoPgnGames };