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

import { initAll } from "./master-init.js";
import { renderPGNReader } from "./pgn-reader.js";
import { renderPuzzleRush } from "./puzzle-rush.js";
import { buildMoveTree } from "./tree-builder.js";

// You can call your functions programmatically:
window.addEventListener("DOMContentLoaded", () => {
  // Auto-initialize all PGN / puzzle elements
  initAll();

  // Example: programmatically render a PGN reader
  // const container = document.getElementById("my-pgn-reader");
  // renderPGNReader(pgnTextString, container);

  // Example: render puzzle rush
  // const puzzleContainer = document.getElementById("my-puzzle-rush");
  // renderPuzzleRush(puzzleContainer, "/pgn/puzzles.pgn");
});