// ============================================================================
// guess-pgn.js — Guess-the-move training mode
// Layout and styling identical to pgn-reader.js
// ============================================================================

(function () {
  "use strict";

  if (typeof Chess !== "function") return;
  if (typeof Chessboard !== "function") return;
  if (!window.PGNCore) return;

  const C = window.PGNCore;
  const unbreak =
    typeof C.makeCastlingUnbreakable === "function"
      ? C.makeCastlingUnbreakable
      : (x) => x;

  // ---- Chessboard 1003 fix (UNCHANGED) --------------------------------------
  function safeChessboard(targetEl, options, tries = 30, onReady) {
    if (!targetEl) return null;

    const rect = targetEl.getBoundingClientRect();
    if ((rect.width <= 0 || rect.height <= 0) && tries > 0) {
      requestAnimationFrame(() =>
        safeChessboard(targetEl, options, tries - 1, onReady)
      );
      return null;
    }

    try {
      const board = Chessboard(targetEl, options);
      onReady && onReady(board);
      return board;
    } catch {
      if (tries > 0) {
        requestAnimationFrame(() =>
          safeChessboard(targetEl, options, tries - 1, onReady)
        );
      }
      return null;
    }
  }
  // --------------------------------------------------------------------------

  function normalizeSAN(s) {
    return s
      .replace(/0/g, "O")
      .replace(/[+#?!]/g, "")
      .trim();
  }

  // ==========================================================================

  class GuessPGNView {
    constructor(src) {
      if (src.__guessPGNRendered) return;
      src.__guessPGNRendered = true;

      this.sourceEl = src;
      this.wrapper = document.createElement("div");
      this.wrapper.className = "pgn-reader-block";

      this.board = null;
      this.mainlineIndex = -1;

      this.build();
      this.applyFigurines();
      this.initBoardAndControls();
      this.bindGuessUI();
      this.updateVisibility();
    }

    // ------------------------------------------------------------------------

    build() {
      let raw = (this.sourceEl.textContent || "").trim();
      raw = C.normalizeFigurines(raw);

      const chess = new Chess();
      try { chess.load_pgn(raw, { sloppy: true }); } catch {}

      this.wrapper.innerHTML =
        '<div class="pgn-reader-header"></div>' +
        '<div class="pgn-reader-cols">' +
          '<div class="pgn-reader-left">' +
            '<div class="pgn-reader-board"></div>' +
            '<div class="pgn-reader-buttons">' +
              '<button class="pgn-reader-btn pgn-reader-prev">◀</button>' +
              '<button class="pgn-reader-btn pgn-reader-next">▶</button>' +
            '</div>' +
            '<div class="guess-input">' +
              'Your move: <input type="text" class="guess-san" autocomplete="off">' +
              '<button class="guess-ok">OK</button>' +
            '</div>' +
          '</div>' +
          '<div class="pgn-reader-right"></div>' +
        '</div>';

      this.sourceEl.replaceWith(this.wrapper);

      this.boardDiv = this.wrapper.querySelector(".pgn-reader-board");
      this.movesCol = this.wrapper.querySelector(".pgn-reader-right");

      // reuse original reader to parse moves
      new window.ReaderPGNView(this.wrapper);
    }

    // ------------------------------------------------------------------------

    applyFigurines() {
      const map = { K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘" };
      this.wrapper.querySelectorAll(".pgn-move").forEach((s) => {
        const m = s.textContent.match(/^([KQRBN])(.+)/);
        if (m) s.textContent = map[m[1]] + m[2];
      });
    }

    initBoardAndControls() {
      safeChessboard(
        this.boardDiv,
        {
          position: "start",
          draggable: false,
          pieceTheme: C.PIECE_THEME_URL,
          appearSpeed: 200,
          moveSpeed: 200
        },
        30,
        (b) => (this.board = b)
      );

      this.moveSpans = Array.from(this.wrapper.querySelectorAll(".reader-move"));
      this.mainlineMoves = this.moveSpans.filter(m => m.dataset.mainline === "1");
    }

    // ------------------------------------------------------------------------
    // GUESS LOGIC
    // ------------------------------------------------------------------------

    bindGuessUI() {
      const input = this.wrapper.querySelector(".guess-san");
      const btn = this.wrapper.querySelector(".guess-ok");

      const submit = () => {
        if (this.mainlineIndex + 1 >= this.mainlineMoves.length) return;

        const guess = normalizeSAN(input.value);
        const target = normalizeSAN(
          this.mainlineMoves[this.mainlineIndex + 1].textContent
        );

        if (guess === target) {
          this.mainlineIndex++;
          this.gotoSpan(this.mainlineMoves[this.mainlineIndex]);
          input.value = "";
          input.classList.remove("guess-wrong");
        } else {
          input.classList.add("guess-wrong");
          setTimeout(() => input.classList.remove("guess-wrong"), 300);
        }
      };

      btn.addEventListener("click", submit);
      input.addEventListener("keydown", e => {
        if (e.key === "Enter") submit();
      });
    }

    gotoSpan(span) {
      if (!span || !this.board) return;
      this.board.position(span.dataset.fen, true);
      this.updateVisibility();
    }

    updateVisibility() {
      const maxIndex = this.mainlineIndex;

      this.moveSpans.forEach((s, i) => {
        s.style.display = i <= maxIndex ? "" : "none";
      });

      this.movesCol.querySelectorAll("p").forEach(p => {
        p.style.display =
          p.querySelector(".reader-move") ? "" :
          "none";
      });
    }
  }

  // --------------------------------------------------------------------------

  function init() {
    document.querySelectorAll("guess-pgn").forEach(el => new GuessPGNView(el));
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();

})();
