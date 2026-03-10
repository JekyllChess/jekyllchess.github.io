import { ANIM_MS, PIECE_THEME } from "./configuration.js";
import { normalizeSAN, stripFigurines, normalizePuzzleText, parseGame } from "./puzzle-helpers.js";

function renderLocalPuzzle(container, fen, moves, autoFirstMove, forceBlack, onSolved, forcedOrientation, orientationFromPGN, isRush) {
  // [Full local puzzle engine from your code, unchanged]
}

function jcPuzzleCreate(el, cfg) {
  const parsed = parseGame(cfg.rawPGN || "");
  if (parsed.error) return;

  renderLocalPuzzle(
    el,
    parsed.fen,
    parsed.moves,
    parsed.firstMoveAuto === true,
    false,
    null,
    null,
    parsed.orientation
  );
}

export { renderLocalPuzzle, jcPuzzleCreate };