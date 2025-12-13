// ============================================================================
// pgn-guess.js — Guess-the-move PGN viewer (STACKED + PAIRED MOVES)
// ============================================================================

(function () {
  "use strict";

  if (typeof Chess !== "function") return;
  if (typeof Chessboard !== "function") return;
  if (!window.PGNCore) return;

  const C = window.PGNCore;

  function ensureGuessStylesOnce() {
    if (document.getElementById("pgn-guess-style")) return;
    const style = document.createElement("style");
    style.id = "pgn-guess-style";
    style.textContent = `
      .pgn-move-row { font-weight: 900; margin-top: 0.5em; }
      .pgn-move-no { margin-right: 0.3em; }
      .pgn-move-white { margin-right: 0.6em; }
      .pgn-move-black { margin-left: 0.3em; }
      .pgn-guess-right .pgn-comment { font-weight: 400; margin-left: 1.2em; }
    `;
    document.head.appendChild(style);
  }

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

  function extractVariationDisplay(text) {
    return text
      .replace(/\[%.*?]/g, "")
      .replace(/\[D\]/g, "")
      .replace(/\{\s*\}/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  class ReaderPGNView {
    constructor(src) {
      if (src.__pgnReaderRendered) return;
      src.__pgnReaderRendered = true;

      ensureGuessStylesOnce();

      this.rawText = (src.textContent || "").trim();
      this.flipBoard = src.tagName.toLowerCase() === "pgn-guess-black";
      this.userIsWhite = !this.flipBoard;

      this.moves = [];
      this.index = -1;
      this.currentRow = null;

      this.build(src);
      this.parsePGN();
      this.initBoard();
    }

    build(src) {
      const wrapper = document.createElement("div");
      wrapper.className = "pgn-guess-block";

      wrapper.innerHTML = `
        <div class="pgn-guess-cols">
          <div class="pgn-guess-left">
            <div class="pgn-guess-board"></div>
            <div class="pgn-guess-buttons">
              <button class="pgn-guess-btn pgn-guess-next">▶</button>
            </div>
          </div>
          <div class="pgn-guess-right"></div>
        </div>
      `;

      src.replaceWith(wrapper);

      this.boardDiv = wrapper.querySelector(".pgn-guess-board");
      this.rightPane = wrapper.querySelector(".pgn-guess-right");
      this.nextBtn = wrapper.querySelector(".pgn-guess-next");
    }

    parsePGN() {
      let raw = C.normalizeFigurines(this.rawText);
      const chess = new Chess();

      let ply = 0, i = 0, pending = [];

      const attach = (t) => {
        const c = t.replace(/\[%.*?]/g, "").trim();
        if (!c) return;
        if (this.moves.length) this.moves[this.moves.length - 1].comments.push(c);
        else pending.push(c);
      };

      while (i < raw.length) {
        const ch = raw[i];

        if (ch === "(") {
          let depth = 1, j = i + 1;
          while (j < raw.length && depth > 0) {
            if (raw[j] === "(") depth++;
            else if (raw[j] === ")") depth--;
            j++;
          }
          const v = extractVariationDisplay(raw.slice(i + 1, j - 1));
          if (v) attach(v);
          i = j;
          continue;
        }

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

        const core = tok.replace(/[^a-hKQRBN0-9=O0-]+$/g, "").replace(/0/g, "O");
        if (!C.SAN_CORE_REGEX.test(core)) continue;

        const isWhite = ply % 2 === 0;
        const num = Math.floor(ply / 2) + 1;
        if (!chess.move(core, { sloppy: true })) continue;

        this.moves.push({
          isWhite,
          moveNo: num,
          san: tok,
          fen: chess.fen(),
          comments: pending.splice(0)
        });

        ply++;
      }
    }

    initBoard() {
      safeChessboard(
        this.boardDiv,
        {
          position: "start",
          orientation: this.flipBoard ? "black" : "white",
          draggable: false,
          pieceTheme: C.PIECE_THEME_URL,
          moveSpeed: 200
        },
        30,
        (b) => {
          this.board = b;
          if (this.flipBoard && this.moves[0]?.isWhite) {
            this.index = 0;
            this.board.position(this.moves[0].fen, true);
            this.appendMove();
          }
        }
      );

      this.nextBtn.addEventListener("click", () => this.nextUserMove());
    }

    appendMove() {
      const m = this.moves[this.index];

      if (m.isWhite) {
        const row = document.createElement("div");
        row.className = "pgn-move-row";

        const no = document.createElement("span");
        no.className = "pgn-move-no";
        no.textContent = `${m.moveNo}.`;

        const w = document.createElement("span");
        w.className = "pgn-move-white";
        w.textContent = m.san;

        row.appendChild(no);
        row.appendChild(w);

        this.rightPane.appendChild(row);
        this.currentRow = row;
      } else if (this.currentRow) {
        const b = document.createElement("span");
        b.className = "pgn-move-black";
        b.textContent = m.san;
        this.currentRow.appendChild(b);
      }

      m.comments.forEach((c) => {
        const p = document.createElement("p");
        p.className = "pgn-comment";
        p.textContent = c;
        this.rightPane.appendChild(p);
      });

      this.rightPane.scrollTop = this.rightPane.scrollHeight;
    }

    nextUserMove() {
      if (this.index + 1 >= this.moves.length) return;

      this.index++;
      this.board.position(this.moves[this.index].fen, true);
      this.appendMove();

      while (this.index + 1 < this.moves.length) {
        const next = this.moves[this.index + 1];
        if (next.isWhite === this.userIsWhite) break;

        this.index++;
        this.board.position(next.fen, true);
        this.appendMove();
      }
    }
  }

  function init() {
    document.querySelectorAll("pgn-guess, pgn-guess-black")
      .forEach((el) => new ReaderPGNView(el));
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", init, { once: true })
    : init();
})();
