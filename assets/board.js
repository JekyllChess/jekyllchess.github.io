/* board.js */

/* JekyllChess — Board Renderer */

import { PIECE_THEME } from "./helpers.js";

/**
 * createBoard — statik veya interaktif satranç tahtası render eder
 *
 * @param {HTMLElement} container — Tahtanın ekleneceği DOM öğesi
 * @param {string} fen — FEN dizgesi
 * @param {object} [nodeData] — Opsiyonel: move yorumları, oklar, işaretler
 */
export function createBoard(container, fen, nodeData) {
  container.innerHTML = "";

  var boardDiv = document.createElement("div");
  boardDiv.className = "jc-board";
  container.appendChild(boardDiv);

  var board = Chessboard(boardDiv, {
    position: fen,
    pieceTheme: PIECE_THEME,
    draggable: false,
  });

  boardDiv.__board = board;

  /* Oklar ve kare işaretleri varsa ekle */
  if (nodeData) {
    if (nodeData.arrows && nodeData.arrows.length) {
      renderArrows(board, nodeData.arrows);
    }
    if (nodeData.squareMarks && nodeData.squareMarks.length) {
      renderSquareMarks(board, nodeData.squareMarks);
    }
  }
}

/**
 * renderArrows — Chessboard üzerine okları çizer
 * @param {object} board — Chessboard objesi
 * @param {Array} arrows — [{ color: "r", from: "e2", to: "e4" }]
 */
function renderArrows(board, arrows) {
  arrows.forEach(function (arrow) {
    var fromEl = boardElForSquare(board, arrow.from);
    var toEl = boardElForSquare(board, arrow.to);
    if (!fromEl || !toEl) return;

    var line = document.createElement("div");
    line.className = "jc-arrow jc-arrow-" + arrow.color;
    var rectFrom = fromEl.getBoundingClientRect();
    var rectTo = toEl.getBoundingClientRect();
    var containerRect = board._container.getBoundingClientRect();

    line.style.left = rectFrom.left - containerRect.left + rectFrom.width / 2 + "px";
    line.style.top = rectFrom.top - containerRect.top + rectFrom.height / 2 + "px";

    var dx = rectTo.left - rectFrom.left;
    var dy = rectTo.top - rectFrom.top;
    var length = Math.sqrt(dx * dx + dy * dy);
    var angle = Math.atan2(dy, dx) * (180 / Math.PI);

    line.style.width = length + "px";
    line.style.transform = "rotate(" + angle + "deg)";
    board._container.appendChild(line);
  });
}

/**
 * renderSquareMarks — kareleri işaretler
 * @param {object} board — Chessboard objesi
 * @param {Array} squares — [{ color: "y", square: "e4" }]
 */
function renderSquareMarks(board, squares) {
  squares.forEach(function (sq) {
    var el = boardElForSquare(board, sq.square);
    if (!el) return;
    var mark = document.createElement("div");
    mark.className = "jc-square-mark jc-square-mark-" + sq.color;
    el.appendChild(mark);
  });
}

/**
 * boardElForSquare — chessboard DOM elemanını kareye göre bulur
 * @param {object} board — Chessboard objesi
 * @param {string} square — "e4" gibi
 * @returns {HTMLElement|null}
 */
function boardElForSquare(board, square) {
  if (!board || !board._container) return null;
  return board._container.querySelector(".square-" + square);
}