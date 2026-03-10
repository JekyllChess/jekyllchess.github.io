/* ================= FIGURINE CONVERSION ================= */

function toFigurine(san) {
  if (!san) return "";
  return san
    .replace(/K/g, "♔")
    .replace(/Q/g, "♕")
    .replace(/R/g, "♖")
    .replace(/B/g, "♗")
    .replace(/N/g, "♘")
    .replace(/P/g, "♙")
    .replace(/k/g, "♚")
    .replace(/q/g, "♛")
    .replace(/r/g, "♜")
    .replace(/b/g, "♝")
    .replace(/n/g, "♞")
    .replace(/p/g, "♟");
}

export { toFigurine };