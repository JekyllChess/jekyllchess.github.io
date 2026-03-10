/* ================= TREE BUILDER ================= */

import { tokenizeMoves } from "./tokenizer.js";

/**
 * Builds a simple move tree from PGN text.
 * Each node contains SAN, move number, color, parent, next, variations.
 */
function buildMoveTree(pgnText) {
  const moves = tokenizeMoves(pgnText);

  let root = { next: null, variations: [], parent: null };
  let current = root;

  moves.forEach((san, i) => {
    const node = {
      san: san,
      moveNumber: i + 1,
      color: i % 2 === 0 ? "w" : "b",
      next: null,
      variations: [],
      parent: current,
      fen: null,
      nags: [],
    };
    current.next = node;
    current = node;
  });

  return root.next || null;
}

export { buildMoveTree };