import { PIECE_THEME } from "./configuration.js";

function createBoard(container, fen, state) {
  return Chessboard(container, {
    position: fen,
    pieceTheme: PIECE_THEME,
  });
}

export { createBoard };