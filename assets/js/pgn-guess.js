// ============================================================================
// pgn-guess.js — Guess-the-move PGN viewer (single-move display)
// Behavior:
//   - Right pane starts empty
//   - Each ▶ shows ONLY the last move (+ its comments)
//   - Previous moves disappear
// ============================================================================

(function () {
  "use strict";

  if (typeof Chess !== "function") return;
  if (typeof Chessboard !== "function") return;
  if (!window.PGNCore) return;

  const C = window.PGNCore;

  // --------------------------------------------------------------------------
  function safeChessboard(targetEl, options, tries = 30, onReady) {
    if (!targetEl) return null;

    const r = targetEl.getBoundingClientRect();
    if ((r.width <= 0 || r.height <= 0) && tries > 0) {
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
  class ReaderPGNView {
    constructor(src) {
      if (src.__pgnReaderRendered) return;
      src.__pgnReaderRendered = true;

      this.sourceEl = src;
      this.wrapper = document.createElement("div");
      this.wrapper.className = "pgn-guess-block";

      this.moves = []; // { label, san, fen, comments[] }
      this.index = -1;

      this.build();
      this.parsePGN();
      this.initBoardAndControls();
      this.renderRightPane();
    }

    build() {
      this.wrapper.innerHTML =
        '<div class="pgn-guess-cols">' +
          '<div class="pgn-guess-left">' +
            '<div class="pgn-guess-board"></div>' +
            '<div class="pgn-guess-buttons">' +
              '<button class="pgn-guess-btn pgn-guess-prev">◀</button>' +
              '<button class="pgn-guess-btn pgn-guess-next">▶</button>' +
            '</div>' +
          '</div>' +
          '<div class="pgn-guess-right"></div>' +
        '</div>';

      this.sourceEl.replaceWith(this.wrapper);

      this.boardDiv = this.wrapper.querySelector(".pgn-guess-board");
      this.rightPane = this.wrapper.querySelector(".pgn-guess-right");
    }

    parsePGN() {
      let raw = (this.sourceEl.textContent || "").trim();
      raw = C.normalizeFigurines(raw);

      const chess = new Chess();

      let ply = 0;
      let i = 0;
      let inVariation = 0;
      let pendingComments = [];

      while (i < raw.length) {
        const ch = raw[i];

        // Skip variations completely
        if (ch === "(") { inVariation++; i++; continue; }
        if (ch === ")" && inVariation) { inVariation--; i++; continue; }
        if (inVariation) { i++; continue; }

        // Comments
        if (ch === "{") {
          let j = i + 1;
          while (j < raw.length && raw[j] !== "}") j++;
          const txt = raw.slice(i + 1, j).replace(/\[%.*?]/g, "").trim();
          if (txt) pendingComments.push(txt);
          i = j + 1;
          continue;
        }

        if (/\s/.test(ch)) { i++; continue; }

        const start = i;
        while (i < raw.length && !/\s/.test(raw[i]) && !"(){}".includes(raw[i])) i++;
        const tok = raw.slice(start, i);

        if (/^\d+\.{1,3}$/.test(tok)) continue;
        if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(tok)) continue;

        const core = tok.replace(/[^a-hKQRBN0-9=O0-]+$/g, "").replace(/0/g, "O");
        if (!C.SAN_CORE_REGEX.test(core)) continue;

        const isWhite = ply % 2 === 0;
        const moveNum = Math.floor(ply / 2) + 1;

        const mv = chess.move(core, { sloppy: true });
        if (!mv) continue;

        const label = isWhite
          ? `${moveNum}. ${tok}`
          : `${moveNum}... ${tok}`;

        this.moves.push({
          label,
          fen: chess.fen(),
          comments: pendingComments.slice()
        });

        pendingComments = [];
        ply++;
      }
    }

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
        (b) => (this.board = b)
      );

      this.wrapper.querySelector(".pgn-guess-next")
        .addEventListener("click", () => this.next());
      this.wrapper.querySelector(".pgn-guess-prev")
        .addEventListener("click", () => this.prev());
    }

    renderRightPane() {
      this.rightPane.innerHTML = "";

      if (this.index < 0 || this.index >= this.moves.length) return;

      const m = this.moves[this.index];

      const moveLine = document.createElement("div");
      moveLine.className = "pgn-guess-current-move";
      moveLine.textContent = m.label;
      this.rightPane.appendChild(moveLine);

      m.comments.forEach((c) => {
        const p = document.createElement("p");
        p.className = "pgn-comment";
        p.textContent = c;
        this.rightPane.appendChild(p);
      });
    }

    next() {
      if (this.index + 1 >= this.moves.length) return;
      this.index++;
      this.board.position(this.moves[this.index].fen, true);
      this.renderRightPane();
    }

    prev() {
      if (this.index < 0) return;
      this.index--;
      if (this.index < 0) {
        this.board.position("start", true);
      } else {
        this.board.position(this.moves[this.index].fen, true);
      }
      this.renderRightPane();
    }
  }

  function init() {
    document.querySelectorAll("pgn-guess")
      .forEach((el) => new ReaderPGNView(el));
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", init, { once: true })
    : init();
})();
