/**
 * JekyllChess — All-in-one chess blog engine
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

// -------------------------
// Import all modular JS files
// -------------------------

import { initAll } from "./master-init.js";
import { renderFullPGN } from "./pgn-renderer.js";
import { renderPGNReader } from "./pgn-reader.js";
import { buildMoveTree } from "./tree-builder.js";
import { createBoard } from "./board.js";
import { toFigurine } from "./figurine.js";
import { parseGame, renderLocalPuzzle } from "./puzzle.js";
import { renderPuzzleRush } from "./puzzle-rush.js";
import { renderPuzzleBlock } from "./element-init.js";
import { parseHeaders } from "./pgn-reader.js"; // helpers for headers
import "./configuration.js"; // constants like PIECE_THEME, NBSP

// -------------------------
// Auto-init function
// -------------------------
function autoInit() {
  // Initialize all elements automatically
  initAll();

  // Optional: expose modules for programmatic use
  window.JekyllChessModules = {
    renderFullPGN,
    renderPGNReader,
    buildMoveTree,
    createBoard,
    toFigurine,
    parseGame,
    renderLocalPuzzle,
    renderPuzzleRush,
    renderPuzzleBlock,
    parseHeaders,
  };
}

// -------------------------
// Run on DOMContentLoaded
// -------------------------
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", autoInit, { once: true });
} else {
  autoInit();
}