// ============================================================================
// pgn-guess.js — Interactive PGN viewer (uses PGNCore)
// CHANGE IMPLEMENTED:
//   - Start with empty move list
//   - Reveal moves progressively as ▶ is clicked
// Everything else unchanged
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

  function safeChessboard(targetEl, options, tries = 30, onReady) {
    const el = targetEl;
    if (!el) return null;

    const rect = el.getBoundingClientRect();
    if ((rect.width <= 0 || rect.height <= 0) && tries > 0) {
      requestAnimationFrame(() =>
        safeChessboard(targetEl, options, tries - 1, onReady)
      );
      return null;
    }

    try {
      const board = Chessboard(el, options);
      if (typeof onReady === "function") onReady(board);
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

  function appendText(el, txt) {
    if (txt) el.appendChild(document.createTextNode(txt));
  }

  function splitPGNText(text) {
    const lines = text.split(/\r?\n/);
    const headers = [];
    const moves = [];
    let inHeaders = true;

    for (const line of lines) {
      const t = line.trim();
      if (inHeaders && t.startsWith("[") && t.endsWith("]")) headers.push(line);
      else if (inHeaders && t === "") inHeaders = false;
      else {
        inHeaders = false;
        moves.push(line);
      }
    }

    return { headers, moveText: moves.join(" ").replace(/\s+/g, " ").trim() };
  }

  class ReaderPGNView {
    constructor(src) {
      if (src.__pgnReaderRendered) return;
      src.__pgnReaderRendered = true;

      this.sourceEl = src;
      this.wrapper = document.createElement("div");
      this.wrapper.className = "pgn-guess-block";

      this.board = null;
      this.build();
      this.applyFigurines();
      this.initBoardAndControls();
      this.bindMoveClicks();

      // 🔒 hide all moves initially
      this.moveSpans.forEach((s) => (s.style.display = "none"));
    }

    static isSANCore(tok) {
      return C.SAN_CORE_REGEX.test(tok);
    }

    build() {
      let raw = (this.sourceEl.textContent || "").trim();
      raw = C.normalizeFigurines(raw);

      const { headers, moveText } = splitPGNText(raw);
      const pgn = (headers.length ? headers.join("\n") + "\n\n" : "") + moveText;

      const chess = new Chess();
      try { chess.load_pgn(pgn, { sloppy: true }); } catch {}

      let head = {};
      try { head = chess.header(); } catch {}

      this.wrapper.innerHTML =
        '<div class="pgn-guess-header"></div>' +
        '<div class="pgn-guess-cols">' +
          '<div class="pgn-guess-left">' +
            '<div class="pgn-guess-board"></div>' +
            '<div class="pgn-guess-buttons">' +
              '<button class="pgn-guess-btn pgn-guess-prev">◀</button>' +
              '<button class="pgn-guess-btn pgn-guess-next">▶</button>' +
            "</div>" +
          "</div>" +
          '<div class="pgn-guess-right"></div>' +
        "</div>";

      this.sourceEl.replaceWith(this.wrapper);
      this.movesCol = this.wrapper.querySelector(".pgn-guess-right");
      this.boardDiv = this.wrapper.querySelector(".pgn-guess-board");

      this.parseMovetext(moveText);
    }

    parseMovetext(t) {
      const chess = new Chess();
      let ctx = {
        type: "main",
        chess,
        container: null,
        prevFen: chess.fen(),
        prevHistoryLen: 0
      };

      let i = 0;
      while (i < t.length) {
        if (/\s/.test(t[i])) { i++; continue; }

        const start = i;
        while (i < t.length && !/\s/.test(t[i])) i++;
        const tok = t.slice(start, i);

        const core = tok.replace(/[^a-hKQRBN0-9=O0-]+$/g, "").replace(/0/g, "O");
        if (!ReaderPGNView.isSANCore(core)) continue;

        const span = document.createElement("span");
        span.className = "pgn-move guess-move";
        span.textContent = tok + " ";
        span.dataset.fen = (() => {
          chess.move(core, { sloppy: true });
          return chess.fen();
        })();

        this.movesCol.appendChild(span);
      }
    }

    applyFigurines() {}

    initBoardAndControls() {
      safeChessboard(
        this.boardDiv,
        {
          position: "start",
          draggable: false,
          pieceTheme: C.PIECE_THEME_URL,
          moveSpeed: 200
        },
        30,
        (board) => (this.board = board)
      );

      this.moveSpans = Array.from(this.wrapper.querySelectorAll(".guess-move"));
      this.mainlineMoves = this.moveSpans;
      this.mainlineIndex = -1;

      this.wrapper.querySelector(".pgn-guess-next")
        .addEventListener("click", () => this.next());
      this.wrapper.querySelector(".pgn-guess-prev")
        .addEventListener("click", () => this.prev());
    }

    gotoSpan(span) {
      if (!this.board) return;
      this.board.position(span.dataset.fen, true);
      span.style.display = "";
    }

    next() {
      if (this.mainlineIndex + 1 >= this.mainlineMoves.length) return;
      this.mainlineIndex++;
      const span = this.mainlineMoves[this.mainlineIndex];
      this.gotoSpan(span);
    }

    prev() {
      if (this.mainlineIndex < 0) return;

      this.mainlineMoves[this.mainlineIndex].style.display = "none";
      this.mainlineIndex--;

      if (this.mainlineIndex < 0) {
        this.board.position("start", true);
      } else {
        this.board.position(
          this.mainlineMoves[this.mainlineIndex].dataset.fen,
          true
        );
      }
    }

    bindMoveClicks() {}
  }

  function init() {
    document.querySelectorAll("pgn-guess")
      .forEach((el) => new ReaderPGNView(el));
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", init, { once: true })
    : init();

})();
