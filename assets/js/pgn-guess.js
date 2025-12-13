// ============================================================================
// pgn-guess.js — Interactive PGN viewer (uses PGNCore)
// Progressive reveal, mainline-only, safe comments
// ============================================================================

(function () {
  "use strict";

  if (typeof Chess !== "function") return;
  if (typeof Chessboard !== "function") return;
  if (!window.PGNCore) return;

  const C = window.PGNCore;

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

  function stripVariations(text) {
    let out = "";
    let depth = 0;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === "(") { depth++; continue; }
      if (text[i] === ")") { depth--; continue; }
      if (depth === 0) out += text[i];
    }
    return out;
  }

  function extractComments(text) {
    const comments = [];
    let clean = "";
    let i = 0;

    while (i < text.length) {
      if (text[i] === "{") {
        let j = i + 1;
        while (j < text.length && text[j] !== "}") j++;
        const raw = text.slice(i + 1, j).replace(/\[%.*?]/g, "").trim();
        if (raw) comments.push(raw);
        i = j + 1;
      } else {
        clean += text[i++];
      }
    }

    return { clean, comments };
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
      this.initBoardAndControls();

      this._hideAll();
    }

    build() {
      let raw = (this.sourceEl.textContent || "").trim();
      raw = C.normalizeFigurines(raw);

      raw = stripVariations(raw);
      const { clean, comments } = extractComments(raw);

      this.comments = comments;

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

      this.movesCol = this.wrapper.querySelector(".pgn-guess-right");
      this.boardDiv = this.wrapper.querySelector(".pgn-guess-board");

      this.stream = document.createElement("div");
      this.movesCol.appendChild(this.stream);

      this.parseMainline(clean);
    }

    parseMainline(text) {
      const chess = new Chess();
      this.moveSpans = [];
      this.numSpans = [];

      let ply = 0;
      const tokens = text.split(/\s+/);

      for (const tok of tokens) {
        if (!tok) continue;
        if (/^\d+\.*$/.test(tok)) continue;
        if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(tok)) continue;

        const core = tok.replace(/[^a-hKQRBN0-9=O0-]+$/g, "").replace(/0/g, "O");
        if (!C.SAN_CORE_REGEX.test(core)) continue;

        const isWhite = ply % 2 === 0;
        const moveNum = Math.floor(ply / 2) + 1;

        if (isWhite) {
          const n = document.createElement("span");
          n.textContent = moveNum + ". ";
          n.style.display = "none";
          this.stream.appendChild(n);
          this.numSpans.push(n);
        } else {
          this.numSpans.push(null);
        }

        const mv = chess.move(core, { sloppy: true });
        if (!mv) continue;

        const s = document.createElement("span");
        s.className = "pgn-move guess-move";
        s.textContent = tok + " ";
        s.dataset.fen = chess.fen();
        s.style.display = "none";

        this.stream.appendChild(s);
        this.moveSpans.push(s);
        ply++;
      }

      this.mainlineIndex = -1;
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

    _hideAll() {
      this.numSpans.forEach((n) => n && (n.style.display = "none"));
      this.moveSpans.forEach((m) => m && (m.style.display = "none"));
    }

    next() {
      if (this.mainlineIndex + 1 >= this.moveSpans.length) return;
      this.mainlineIndex++;

      const span = this.moveSpans[this.mainlineIndex];
      const num = this.numSpans[this.mainlineIndex];

      if (num) num.style.display = "";
      span.style.display = "";

      this.board.position(span.dataset.fen, true);

      if (
        this.comments.length &&
        this.mainlineIndex === this.moveSpans.length - 1
      ) {
        const p = document.createElement("p");
        p.className = "pgn-comment";
        p.textContent = this.comments.join(" ");
        this.stream.appendChild(p);
      }
    }

    prev() {
      if (this.mainlineIndex < 0) return;

      const span = this.moveSpans[this.mainlineIndex];
      const num = this.numSpans[this.mainlineIndex];

      span.style.display = "none";
      if (num) num.style.display = "none";

      this.mainlineIndex--;

      if (this.mainlineIndex < 0) {
        this.board.position("start", true);
      } else {
        this.board.position(
          this.moveSpans[this.mainlineIndex].dataset.fen,
          true
        );
      }
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
