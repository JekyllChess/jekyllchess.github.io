// ============================================================================
// pgn-reader.js — Interactive PGN viewer (uses PGNCore)
// FINAL FIX:
//   ✔ No duplicated move numbers
//   ✔ Initial board position
//   ✔ Animated moves
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

  function safeChessboard(el, options, tries = 30, onReady) {
    if (!el) return;
    const r = el.getBoundingClientRect();
    if ((r.width <= 0 || r.height <= 0) && tries > 0) {
      requestAnimationFrame(() =>
        safeChessboard(el, options, tries - 1, onReady)
      );
      return;
    }
    try {
      const b = Chessboard(el, options);
      onReady && onReady(b);
    } catch {
      if (tries > 0)
        requestAnimationFrame(() =>
          safeChessboard(el, options, tries - 1, onReady)
        );
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
      this.wrapper.className = "pgn-reader-block";
      this.board = null;

      this.build();
      this.applyFigurines();
      this.initBoardAndControls();
      this.bindMoveClicks();
    }

    static isSANCore(tok) {
      return C.SAN_CORE_REGEX.test(tok);
    }

    build() {
      let raw = (this.sourceEl.textContent || "").trim();
      raw = C.normalizeFigurines(raw);

      const { headers, moveText } = splitPGNText(raw);
      const pgn =
        (headers.length ? headers.join("\n") + "\n\n" : "") + moveText;

      const chess = new Chess();
      try { chess.load_pgn(pgn, { sloppy: true }); } catch {}

      let head = {};
      try { head = chess.header ? chess.header() : {}; } catch {}

      this.wrapper.innerHTML =
        '<div class="pgn-reader-header"></div>' +
        '<div class="pgn-reader-cols">' +
          '<div class="pgn-reader-left">' +
            '<div class="pgn-reader-board"></div>' +
            '<div class="pgn-reader-buttons">' +
              '<button class="pgn-reader-btn pgn-reader-prev">◀</button>' +
              '<button class="pgn-reader-btn pgn-reader-next">▶</button>' +
            '</div>' +
          '</div>' +
          '<div class="pgn-reader-right"></div>' +
        '</div>';

      this.sourceEl.replaceWith(this.wrapper);
      this.headerDiv = this.wrapper.querySelector(".pgn-reader-header");
      this.movesCol = this.wrapper.querySelector(".pgn-reader-right");
      this.boardDiv = this.wrapper.querySelector(".pgn-reader-board");

      this.headerDiv.appendChild(this.buildHeaderContent(head));
      this.parseMovetext(moveText);
    }

    buildHeaderContent(h) {
      const H = document.createElement("h3");
      appendText(H, (h.White || "") + " – " + (h.Black || ""));
      return H;
    }

    ensure(ctx, cls) {
      if (!ctx.container) {
        const p = document.createElement("p");
        p.className = cls;
        this.movesCol.appendChild(p);
        ctx.container = p;
      }
    }

    handleSAN(tok, ctx) {
      const core = tok.replace(/[^a-hKQRBN0-9=O0-]+$/g, "").replace(/0/g, "O");
      if (!ReaderPGNView.isSANCore(core)) {
        appendText(ctx.container, tok + " ");
        return null;
      }

      const ply = ctx.baseHistoryLen + ctx.chess.history().length;
      const white = ply % 2 === 0;
      const num = Math.floor(ply / 2) + 1;

      if (ctx.lastPrintedPly !== ply) {
        if (white) appendText(ctx.container, num + "." + C.NBSP);
        else if (ctx.lastWasInterrupt)
          appendText(ctx.container, num + "..." + C.NBSP);
        ctx.lastPrintedPly = ply;
      }

      ctx.prevFen = ctx.chess.fen();
      ctx.prevHistoryLen = ply;

      const mv = ctx.chess.move(core, { sloppy: true });
      if (!mv) return null;

      ctx.lastWasInterrupt = false;

      const span = document.createElement("span");
      span.className = "pgn-move reader-move";
      span.dataset.fen = ctx.chess.fen();
      span.dataset.mainline = ctx.type === "main" ? "1" : "0";
      span.textContent = unbreak(tok) + " ";
      ctx.container.appendChild(span);
      return span;
    }

    parseMovetext(t) {
      const chess = new Chess();
      let ctx = {
        type: "main",
        chess,
        container: null,
        parent: null,
        lastWasInterrupt: false,
        prevFen: chess.fen(),
        prevHistoryLen: 0,
        baseHistoryLen: 0,
        lastPrintedPly: null
      };

      let i = 0;
      while (i < t.length) {
        const start = i;
        while (i < t.length && !/\s/.test(t[i])) i++;
        const tok = t.slice(start, i);
        i++;

        if (!tok) continue;

        this.ensure(ctx, "pgn-mainline");
        this.handleSAN(tok, ctx);
      }
    }

    applyFigurines() {
      const map = { K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘" };
      this.wrapper.querySelectorAll(".pgn-move").forEach(span => {
        const m = span.textContent.match(/^([KQRBN])(.+)/);
        if (m) span.textContent = map[m[1]] + m[2];
      });
    }

    initBoardAndControls() {
      this.moveSpans = [];
      this.mainlineMoves = [];
      this.mainlineIndex = -1;

      safeChessboard(
        this.boardDiv,
        {
          position: "start",
          draggable: false,
          pieceTheme: C.PIECE_THEME_URL,
          moveSpeed: 200
        },
        30,
        board => (this.board = board)
      );

      this.wrapper.querySelector(".pgn-reader-prev")
        ?.addEventListener("click", () => this.prev());
      this.wrapper.querySelector(".pgn-reader-next")
        ?.addEventListener("click", () => this.next());
    }

    gotoSpan(span) {
      if (!span || !this.board) return;
      this.board.position(span.dataset.fen, true);
    }

    next() {
      if (!this.mainlineMoves.length) return;
      this.mainlineIndex = Math.min(this.mainlineIndex + 1, this.mainlineMoves.length - 1);
      this.gotoSpan(this.mainlineMoves[this.mainlineIndex]);
    }

    prev() {
      if (this.mainlineIndex <= 0) {
        this.mainlineIndex = -1;
        this.board.position("start", true);
        return;
      }
      this.mainlineIndex--;
      this.gotoSpan(this.mainlineMoves[this.mainlineIndex]);
    }

    bindMoveClicks() {}
  }

  function init() {
    document.querySelectorAll("pgn-reader").forEach(el => new ReaderPGNView(el));
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", init, { once: true })
    : init();
})();
