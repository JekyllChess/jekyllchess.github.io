import { renderFullPGN } from "./pgn-renderer.js";
import { renderPGNReader } from "./pgn-reader.js";
import { jcPuzzleCreate } from "./puzzle.js";
import { renderPuzzleBlock } from "./puzzle-block.js";
import { renderPuzzleRush } from "./puzzle-rush.js";

function initAll() {
  initPgnElements();
  initPgnReaderElements();
  initFenElements();
  initPuzzleRushElements();
  initPuzzleBlockElements();
  initPuzzleElements();
}

// [Define initPgnElements, initPgnReaderElements, initFenElements, initPuzzleElements, initPuzzleBlockElements, initPuzzleRushElements]
// Use your exact implementations

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAll, { once: true });
} else {
  initAll();
}

export { initAll };