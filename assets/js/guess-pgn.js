// ============================================================================
// guess-pgn.js — Guess-the-move training mode
// CLEAN CLONE of pgn-reader.js with gated "next()"
// ============================================================================

(function () {
  "use strict";

  if (typeof Chess !== "function") {
    console.warn("guess-pgn.js: chess.js missing");
    return;
  }
  if (typeof Chessboard !== "function") {
    console.warn("guess-pgn.js: chessboard.js missing");
    return;
  }
  if (!window.PGNCore) {
    console.error("guess-pgn.js: PGNCore missing");
    return;
  }

  const C = window.PGNCore;
  const unbreak =
    typeof C.makeCastlingUnbreakable === "function"
      ? C.makeCastlingUnbreakable
      : (x) => x;

  // ---- Chessboard 1003 fix (UNCHANGED) --------------------------------------
  function safeChessboard(targetEl, options, tries = 30, onReady) {
    const el = targetEl;
    if (!el) {
      if (tries > 0)
        requestAnimationFrame(() =>
          safeChessboard(targetEl, options, tries - 1, onReady)
        );
      return null;
    }

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
  // --------------------------------------------------------------------------

  function appendText(el, txt) {
    if (txt) el.appendChild(document.createTextNode(txt));
  }

  function normalizeSAN(s) {
    return (s || "")
      .replace(/0/g, "O")
      .replace(/[+#?!]/g, "")
      .replace(/\s+/g, "")
      .trim();
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

  // ==========================================================================

  class GuessPGNView {
    constructor(src) {
      if (src.__guessPGNRendered) return;
      src.__guessPGNRendered = true;

      this.sourceEl = src;
      this.wrapper = document.createElement("div");
      this.wrapper.className = "pgn-reader-block";

      this.finalResultPrinted = false;
      this.board = null;

      this.build();
      this.applyFigurines();
      this.initBoardAndControls();
      this.injectGuessUI();
      this.bindMoveClicks();
    }

    static isSANCore(tok) {
      return C.SAN_CORE_REGEX.test(tok);
    }

    // ------------------------------------------------------------------------
    // BUILD (IDENTICAL MARKUP)
    // ------------------------------------------------------------------------

    build() {
      let raw = (this.sourceEl.textContent || "").trim();
      raw = C.normalizeFigurines(raw);

      const { headers, moveText } = splitPGNText(raw);
      const pgn = (headers.length ? headers.join("\n") + "\n\n" : "") + moveText;

      const chess = new Chess();
      try { chess.load_pgn(pgn, { sloppy: true }); } catch {}

      let head = {};
      try { head = chess.header(); } catch {}

      const res = C.normalizeResult(head.Result || "");
      const hasResultAlready = / (1-0|0-1|1\/2-1\/2|½-½|\*)$/.test(moveText);
      const movetext = hasResultAlready ? moveText : moveText + (res ? " " + res : "");

      this.wrapper.innerHTML =
        '<div class="pgn-reader-header"></div>' +
        '<div class="pgn-reader-cols">' +
          '<div class="pgn-reader-left">' +
            '<div class="pgn-reader-board"></div>' +
            '<div class="pgn-reader-buttons">' +
              '<button class="pgn-reader-btn pgn-reader-prev" type="button">◀</button>' +
              '<button class="pgn-reader-btn pgn-reader-next" type="button">▶</button>' +
            '</div>' +
          '</div>' +
          '<div class="pgn-reader-right"></div>' +
        '</div>';

      this.sourceEl.replaceWith(this.wrapper);

      this.headerDiv = this.wrapper.querySelector(".pgn-reader-header");
      this.movesCol  = this.wrapper.querySelector(".pgn-reader-right");
      this.boardDiv  = this.wrapper.querySelector(".pgn-reader-board");

      this.headerDiv.appendChild(this.buildHeaderContent(head));
      this.parseMovetext(movetext);
    }

    buildHeaderContent(h) {
      const H = document.createElement("h3");
      appendText(
        H,
        `${C.flipName(h.White || "")} – ${C.flipName(h.Black || "")}`
      );
      return H;
    }

    // ------------------------------------------------------------------------
    // FULL ORIGINAL PARSER (UNCHANGED)
    // ------------------------------------------------------------------------

    ensure(ctx, cls) {
      if (!ctx.container) {
        const p = document.createElement("p");
        p.className = cls;
        this.movesCol.appendChild(p);
        ctx.container = p;
      }
    }

    parseComment(text, startIndex, ctx) {
      let j = startIndex;
      while (j < text.length && text[j] !== "}") j++;

      let raw = text.substring(startIndex, j).replace(/\[%.*?]/g, "").trim();
      if (text[j] === "}") j++;
      if (!raw) return j;

      const p = document.createElement("p");
      p.className = "pgn-comment";
      appendText(p, raw);
      this.movesCol.appendChild(p);

      ctx.container = null;
      ctx.lastWasInterrupt = true;
      return j;
    }

    handleSAN(tok, ctx) {
      const core = tok.replace(/[^a-hKQRBN0-9=O0-]+$/g, "").replace(/0/g, "O");
      if (!GuessPGNView.isSANCore(core)) return null;

      this.ensure(ctx, ctx.type === "main" ? "pgn-mainline" : "pgn-variation");

      const mv = ctx.chess.move(core, { sloppy: true });
      if (!mv) return null;

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
        lastWasInterrupt: false
      };

      let i = 0;
      while (i < t.length) {
        const ch = t[i];

        if (/\s/.test(ch)) { i++; continue; }

        if (ch === "(") {
          i++;
          ctx = {
            type: "variation",
            chess: new Chess(ctx.chess.fen()),
            container: null,
            parent: ctx,
            lastWasInterrupt: true
          };
          continue;
        }

        if (ch === ")") {
          i++;
          ctx = ctx.parent || ctx;
          ctx.container = null;
          continue;
        }

        if (ch === "{") {
          i = this.parseComment(t, i + 1, ctx);
          continue;
        }

        const start = i;
        while (i < t.length && !/\s|[(){}]/.test(t[i])) i++;
        const tok = t.substring(start, i);

        this.handleSAN(tok, ctx);
      }
    }

    // ------------------------------------------------------------------------

    applyFigurines() {
      const map = { K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘" };
      this.wrapper.querySelectorAll(".pgn-move").forEach((span) => {
        const m = span.textContent.match(/^([KQRBN])(.+)/);
        if (m) span.textContent = map[m[1]] + m[2];
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
      this.mainlineMoves = this.moveSpans.filter(s => s.dataset.mainline === "1");
      this.mainlineIndex = -1;

      this.wrapper.querySelector(".pgn-reader-next")
        .addEventListener("click", () => this.next());
      this.wrapper.querySelector(".pgn-reader-prev")
        .addEventListener("click", () => this.prev());
    }

    injectGuessUI() {
      const left = this.wrapper.querySelector(".pgn-reader-left");
      const box = document.createElement("div");
      box.className = "guess-pgn-box";
      box.innerHTML =
        'Your move: <input class="guess-san" type="text"> ' +
        '<button type="button" class="guess-ok">OK</button>';

      left.appendChild(box);

      this.guessInput = box.querySelector(".guess-san");
      box.querySelector(".guess-ok").onclick = () => this.next();
    }

    next() {
      if (this.mainlineIndex + 1 >= this.mainlineMoves.length) return;

      const target = this.mainlineMoves[this.mainlineIndex + 1];
      const want = normalizeSAN(target.textContent);
      const got  = normalizeSAN(this.guessInput.value);

      if (want !== got) return;

      this.guessInput.value = "";
      this.mainlineIndex++;
      this.board.position(target.dataset.fen, true);
    }

    prev() {
      if (this.mainlineIndex <= -1) return;
      this.mainlineIndex--;
      const fen =
        this.mainlineIndex < 0
          ? "start"
          : this.mainlineMoves[this.mainlineIndex].dataset.fen;
      this.board.position(fen, true);
    }

    bindMoveClicks() {
      // disabled in training mode
    }
  }

  // --------------------------------------------------------------------------

  function init() {
    document.querySelectorAll("guess-pgn").forEach(el => new GuessPGNView(el));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

})();
