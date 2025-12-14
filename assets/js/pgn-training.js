// ============================================================================
// pgn-training.js — Guess-the-move PGN trainer (white-screen safe)
// ============================================================================

(function () {
  "use strict";

  try {
    if (typeof Chess !== "function") return;
    if (typeof Chessboard !== "function") return;
    if (!window.PGNCore) return;

    const C = window.PGNCore;
    const AUTOPLAY_DELAY = 700;
    const FEEDBACK_DELAY = 600;

    // ------------------------------------------------------------------------
    // Styles
    // ------------------------------------------------------------------------

    function ensureGuessStylesOnce() {
      if (document.getElementById("pgn-training-style")) return;

      const style = document.createElement("style");
      style.id = "pgn-training-style";
      style.textContent = `
        .pgn-training-wrapper { margin-bottom: 1rem; }
        .pgn-training-header { margin:0 0 .6rem 0; font-weight:600; }
        .pgn-training-cols { display:flex; gap:1rem; align-items:flex-start; }
        .pgn-training-board { width:360px; max-width:100%; touch-action:manipulation; }
        .pgn-training-status { margin-top:.4em; font-size:.95em; white-space:nowrap; }
        .pgn-training-status button { margin-left:.3em; font-size:1em; padding:0 .4em; }
        .pgn-training-right { flex:1; max-height:420px; overflow-y:auto; }
        .pgn-move-row { font-weight:900; margin-top:.5em; }
        .pgn-move-no { margin-right:.3em; }
        .pgn-move-white { margin-right:.6em; }
        .pgn-move-black { margin-left:.3em; }
        .pgn-comment { font-weight:400; }
      `;
      document.head.appendChild(style);
    }

    // ------------------------------------------------------------------------
    // Safe board init
    // ------------------------------------------------------------------------

    function safeChessboard(el, opts, tries = 30, cb) {
      if (!el) return;
      const r = el.getBoundingClientRect();
      if ((r.width <= 0 || r.height <= 0) && tries > 0) {
        requestAnimationFrame(() => safeChessboard(el, opts, tries - 1, cb));
        return;
      }
      const b = Chessboard(el, opts);
      cb && cb(b);
    }

    // ------------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------------

    function normalizeSAN(tok) {
      return String(tok || "")
        .replace(/\[%.*?]/g, "")
        .replace(/\[D\]/g, "")
        .replace(/[{}]/g, "")
        .replace(/[!?]+/g, "")
        .replace(/[+#]$/, "")
        .replace(/0/g, "O")
        .trim();
    }

    function sanitizeComment(text) {
      const c = String(text || "")
        .replace(/\[%.*?]/g, "")
        .replace(/\[D\]/g, "")
        .replace(/[{}]/g, "")
        .replace(/\s+/g, " ")
        .trim();
      return c || null;
    }

    // ------------------------------------------------------------------------
    // Main class
    // ------------------------------------------------------------------------

    class ReaderPGNView {
      constructor(src) {
        ensureGuessStylesOnce();

        this.rawText = (src.textContent || "").trim();
        this.flipBoard = src.tagName.toLowerCase() === "pgn-training-black";
        this.userIsWhite = !this.flipBoard;

        this.moves = [];
        this.index = -1;
        this.currentRow = null;

        this.game = new Chess();
        this.currentFen = "start";
        this.rowHasInterveningComment = false;

        this.build(src);
        this.parsePGN();
        this.initBoard();
      }

      build(src) {
        const wrap = document.createElement("div");
        wrap.className = "pgn-training-wrapper";

        const cols = document.createElement("div");
        cols.className = "pgn-training-cols";
        cols.innerHTML = `
          <div>
            <div class="pgn-training-board"></div>
            <div class="pgn-training-status"></div>
          </div>
          <div class="pgn-training-right"></div>
        `;

        wrap.appendChild(cols);
        src.replaceWith(wrap);

        this.boardDiv = cols.querySelector(".pgn-training-board");
        this.statusEl = cols.querySelector(".pgn-training-status");
        this.rightPane = cols.querySelector(".pgn-training-right");
      }

      parsePGN() {
        const raw = C.normalizeFigurines(this.rawText);
        const chess = new Chess();
        let i = 0, ply = 0, pending = [];

        const attach = (t) => {
          const c = sanitizeComment(t);
          if (!c) { pending.length = 0; return; }
          if (this.moves.length) this.moves[this.moves.length - 1].comments.push(c);
          else pending.push(c);
        };

        while (i < raw.length) {
          const ch = raw[i];

          if (ch === "{") {
            let j = i + 1;
            while (j < raw.length && raw[j] !== "}") j++;
            attach(raw.slice(i + 1, j));
            i = j + 1;
            continue;
          }

          if (/\s/.test(ch)) { i++; continue; }

          const s = i;
          while (i < raw.length && !/\s/.test(raw[i]) && !"(){}".includes(raw[i])) i++;
          const tok = raw.slice(s, i);

          if (/^\d+\.{1,3}$/.test(tok)) continue;

          const san = normalizeSAN(tok);
          if (!san) continue;
          if (!chess.move(san, { sloppy: true })) continue;

          this.moves.push({
            isWhite: ply % 2 === 0,
            moveNo: Math.floor(ply / 2) + 1,
            san: tok,
            fen: chess.fen(),
            comments: pending.splice(0)
          });

          ply++;
        }
      }

      initBoard() {
        safeChessboard(this.boardDiv, {
          position: "start",
          orientation: this.flipBoard ? "black" : "white",
          draggable: true,
          pieceTheme: C.PIECE_THEME_URL,
          onDragStart: () => this.isGuessTurn(),
          onDrop: (s, t) => this.onUserDrop(s, t),
          onSnapEnd: () => this.board.position(this.currentFen, false)
        }, 30, (b) => {
          this.board = b;
          setTimeout(() => this.autoplayOpponentMoves(), AUTOPLAY_DELAY);
        });
      }

      isGuessTurn() {
        const n = this.moves[this.index + 1];
        return n && n.isWhite === this.userIsWhite;
      }

      autoplayOpponentMoves() {
        while (this.index + 1 < this.moves.length) {
          const n = this.moves[this.index + 1];
          if (n.isWhite === this.userIsWhite) break;
          this.index++;
          this.game.move(normalizeSAN(n.san), { sloppy: true });
          this.currentFen = n.fen;
          this.board.position(n.fen, true);
          this.appendMove();
        }
      }

      onUserDrop(source, target) {
        if (source === target) return "snapback";
        if (!this.isGuessTurn()) return "snapback";

        const expected = this.moves[this.index + 1];
        const legal = this.game.moves({ verbose: true });

        const ok = legal.some(m => {
          if (m.from !== source || m.to !== target) return false;
          const g = new Chess(this.game.fen());
          g.move(m);
          return g.fen() === expected.fen;
        });

        if (!ok) return "snapback";

        this.index++;
        this.game.load(expected.fen);
        this.currentFen = expected.fen;
        this.board.position(expected.fen, false);
        this.appendMove();

        setTimeout(() => this.autoplayOpponentMoves(), FEEDBACK_DELAY);
      }

      appendMove() {
        const m = this.moves[this.index];
        if (!m) return;

        if (m.isWhite) {
          const row = document.createElement("div");
          row.className = "pgn-move-row";
          row.innerHTML =
            `<span class="pgn-move-no">${m.moveNo}.</span>` +
            `<span class="pgn-move-white">${m.san}</span>`;

          this.rightPane.appendChild(row);
          this.currentRow = row;
          this.rowHasInterveningComment = false;

          m.comments.forEach(c => {
            this.rowHasInterveningComment = true;
            const span = document.createElement("span");
            span.className = "pgn-comment";
            span.textContent = " " + c;
            row.appendChild(span);
          });

        } else if (this.currentRow) {
          const b = document.createElement("span");
          b.className = "pgn-move-black";
          b.textContent = this.rowHasInterveningComment
            ? ` ${m.moveNo}... ${m.san}`
            : ` ${m.san}`;
          this.rowHasInterveningComment = false;
          this.currentRow.appendChild(b);
        }

        this.rightPane.scrollTop = this.rightPane.scrollHeight;
      }
    }

    function init() {
      document
        .querySelectorAll("pgn-training, pgn-training-black")
        .forEach(el => new ReaderPGNView(el));
    }

    document.readyState === "loading"
      ? document.addEventListener("DOMContentLoaded", init, { once: true })
      : init();

  } catch (e) {
    console.error("pgn-training.js fatal error:", e);
  }
})();
