/**
 * JekyllChess — All-in-one chess blog engine (ES6 Module Entry Point)
 * Combines: figurine, board, pgn-engine, puzzle-system, and element initializers
 *
 * Dependencies (load BEFORE this script):
 *   - chess.js (Chess class)
 *   - chessboard.js (Chessboard class + CSS)
 *   - jQuery (required by chessboard.js)
 *
 * Custom HTML elements supported:
 *   <pgn>           — Annotated game viewer (static)
 *   <pgn-reader>    — Interactive board + clickable move list
 *   <fen>           — Static board from FEN string
 *   <puzzle>        — Single interactive puzzle
 *   <puzzle-block>  — Multiple puzzles from PGN file
 *   <puzzle-rush>   — Sequential puzzle rush mode
 */

import { toFigurine, parseGame } from "./helpers.js";
import { createBoard } from "./board.js";
import { buildMoveTree, parseHeaders, renderFullPGN, renderPGNReader } from "./pgn.js";
import { renderLocalPuzzle, renderPuzzleBlock, renderPuzzleRush } from "./puzzle.js";
import { initAll } from "./init.js";

/* ================================================================
   AUTO-INIT ON DOM READY
================================================================ */

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAll, { once: true });
} else {
  initAll();
}

/* ================================================================
   PUBLIC API (optional — for programmatic use)
================================================================ */

window.JekyllChess = {
  renderFullPGN: renderFullPGN,
  renderPGNReader: renderPGNReader,
  buildMoveTree: buildMoveTree,
  parseHeaders: parseHeaders,
  createBoard: createBoard,
  toFigurine: toFigurine,
  parseGame: parseGame,
  renderLocalPuzzle: renderLocalPuzzle,
  renderPuzzleBlock: renderPuzzleBlock,
  renderPuzzleRush: renderPuzzleRush,
  initAll: initAll,
};