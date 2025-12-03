// assets/js/chess/fen.js
(function () {
  "use strict";

  const PIECE_THEME_URL =
    "https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png";

  function renderFENElement(el, index) {
    const fen = el.textContent.trim();
    if (!fen) return;

    const id = "fen-board-" + index;
    const div = document.createElement("div");
    div.className = "fen-board";
    div.id = id;

    el.replaceWith(div);

    Chessboard(id, {
      position: fen,
      draggable: false,
      pieceTheme: PIECE_THEME_URL
    });
  }

  function renderAll(root = document) {
    root.querySelectorAll("fen").forEach((el, i) => renderFENElement(el, i));
  }

  function init() {
    renderAll();

    const observer = new MutationObserver(muts => {
      muts.forEach(m => {
        m.addedNodes?.forEach(n => {
          if (n.nodeType === 1) renderAll(n);
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
    window.FENRenderer = { run: (r) => renderAll(r || document.body) };
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", init)
    : init();
})();
