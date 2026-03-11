/* ================= PGN READER ================= */

import { NBSP, PIECE_THEME } from "./configuration.js";

import {
  buildMoveTree,
  createBoard,
  toFigurine,
  parseHeaders,
  renderHeaders,
  renderNAG
} from "./pgn-renderer.js";

/**
 * Renders a PGN reader in the given container.
 * Shows interactive board, clickable moves, and comments.
 */
function renderPGNReader(pgnText, container) {
  const headers = parseHeaders(pgnText);
  renderHeaders(headers, container);

  const moves = buildMoveTree(pgnText);

  if (!moves) {
    container.textContent = "No moves found in PGN.";
    return;
  }

  const boardDiv = document.createElement("div");
  boardDiv.className = "jc-board";
  container.appendChild(boardDiv);

  const board = createBoard(boardDiv, headers.FEN || "start");

  const movesDiv = document.createElement("div");
  movesDiv.className = "pgn-moves";
  container.appendChild(movesDiv);

  const commentDiv = document.createElement("div");
  commentDiv.className = "pgn-comment-box";
  container.appendChild(commentDiv);

  /* Build clickable move list */

  let cur = moves;

  while (cur) {
    const moveBtn = document.createElement("button");
    moveBtn.className = "pgn-move-btn";

    moveBtn.textContent = toFigurine(cur.san) + renderNAG(cur.nags);

    moveBtn.addEventListener("click", () => {
      let temp = cur.parent;
      const stack = [];

      while (temp && temp.san) {
        stack.unshift(temp.san);
        temp = temp.parent;
      }

      board.position(headers.FEN || "start", false);

      stack.forEach((m) => board.move(m, { sloppy: true }));

      commentDiv.textContent = cur.comment || "";
    });

    movesDiv.appendChild(moveBtn);

    cur = cur.next;
  }
}

/* ================= EXPORTS ================= */

export { renderPGNReader, parseHeaders };