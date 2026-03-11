/* ================================================================
   FIGURINE CONVERSION
================================================================ */

function toFigurine(san) {

  if (!san) return san;

  const map = {
    K: "♔",
    Q: "♕",
    R: "♖",
    B: "♗",
    N: "♘"
  };

  const first = san[0];

  if (map[first]) {
    return map[first] + san.slice(1);
  }

  return san;
}

export { toFigurine };