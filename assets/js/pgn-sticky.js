// ============================================================================
// pgn-sticky.js (FINAL VERSION WITH CHESS MERIDA FONT)
// - Uses chess-merida-font (bold-friendly figurines)
// - Mainline moves bold (600), variations normal (400)
// - Sticky header + sticky board (mobile + desktop)
// - Local scrolling (page never shakes)
// - Buttons & arrow keys follow ONLY mainline
// - Clicking any move (including variation) updates board
// - Parsing matches pgn.js (NAGs, evals, comments, variations)
// - Figurine normalization before parsing
// - Mobile-first responsive layout
// ============================================================================

(function () {
  "use strict";

  // --------------------------------------------------------------------------
  // Inject Chess Merida Webfont
  // --------------------------------------------------------------------------
  const meridaLink = document.createElement("link");
  meridaLink.rel = "stylesheet";
  meridaLink.href =
    "https://cdn.jsdelivr.net/npm/chess-merida-font@0.0.3/css/chessmerida-webfont.min.css";
  document.head.appendChild(meridaLink);

  // --------------------------------------------------------------------------
  // Dependencies
  // --------------------------------------------------------------------------
  if (typeof Chess === "undefined") {
    console.warn("pgn-sticky.js: chess.js missing");
    return;
  }
  if (typeof Chessboard === "undefined") {
    console.warn("pgn-sticky.js: chessboard.js missing");
    return;
  }

  // --------------------------------------------------------------------------
  // Constants (aligned with pgn.js)
  // --------------------------------------------------------------------------
  const PIECE_THEME_URL =
    "https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png";

  const SAN_CORE_REGEX =
    /^([O0]-[O0](-[O0])?[+#]?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](=[QRBN])?[+#]?|[a-h][1-8](=[QRBN])?[+#]?)$/;

  const RESULT_REGEX = /^(1-0|0-1|1\/2-1\/2|½-½|\*)$/;
  const MOVE_NUMBER_REGEX = /^(\d+)(\.+)$/;
  const NBSP = "\u00A0";

  const NAG_MAP = {
    1: "!", 2: "?", 3: "‼", 4: "⁇", 5: "⁉", 6: "⁈",
    13: "→", 14: "↑", 15: "⇆", 16: "⇄",
    17: "⟂", 18: "∞", 19: "⟳", 20: "⟲",
    36: "⩲", 37: "⩱", 38: "±", 39: "∓",
    40: "+=", 41: "=+", 42: "±", 43: "∓",
    44: "⨀", 45: "⨁"
  };

  const EVAL_MAP = {
    "=": "=",
    "+/=": "⩲",
    "=/+": "⩱",
    "+/-": "±",
    "+/−": "±",
    "-/+": "∓",
    "−/+": "∓",
    "+-": "+−",
    "+−": "+−",
    "-+": "−+",
    "−+": "−+",
    "∞": "∞",
    "=/∞": "⯹"
  };

  function normalizeResult(r) {
    return r ? r.replace(/1\/2-1\/2/g, "½-½") : "";
  }

  function extractYear(d) {
    if (!d) return "";
    let p = d.split(".");
    return /^\d{4}$/.test(p[0]) ? p[0] : "";
  }

  function flipName(n) {
    if (!n) return "";
    let i = n.indexOf(",");
    return i === -1
      ? n.trim()
      : n.slice(i + 1).trim() + " " + n.slice(0, i).trim();
  }

  // Normalize figurines → SAN letters BEFORE parsing (♘ → N)
  function normalizeFigurines(text) {
    return text
      .replace(/♔/g, "K")
      .replace(/♕/g, "Q")
      .replace(/♖/g, "R")
      .replace(/♗/g, "B")
      .replace(/♘/g, "N");
  }

  function appendText(el, txt) {
    if (txt) el.appendChild(document.createTextNode(txt));
  }

  function makeCastlingUnbreakable(s) {
    return s
      .replace(/0-0-0|O-O-O/g, m => m[0] + "\u2011" + m[2] + "\u2011" + m[4])
      .replace(/0-0|O-O/g, m => m[0] + "\u2011" + m[2]);
  }

  // --------------------------------------------------------------------------
  // StickyPGNView (PARSES <pgn-sticky> EXACTLY LIKE pgn.js)
  // --------------------------------------------------------------------------
  class StickyPGNView {
    constructor(src) {
      this.sourceEl = src;
      this.wrapper = document.createElement("div");
      this.wrapper.className = "pgn-sticky-block";
      this.finalResultPrinted = false;
      this.build();
      this.applyFigurines();
    }

    static isSANCore(t) {
      return SAN_CORE_REGEX.test(t);
    }

    static split(t) {
      let lines = t.split(/\r?\n/),
        H = [],
        M = [],
        inH = true;

      for (let L of lines) {
        let T = L.trim();
        if (inH && T.startsWith("[") && T.endsWith("]")) H.push(L);
        else if (inH && T === "") inH = false;
        else {
          inH = false;
          M.push(L);
        }
      }

      return { headers: H, moveText: M.join(" ").replace(/\s+/g, " ").trim() };
    }

    build() {
      let raw = normalizeFigurines(this.sourceEl.textContent.trim());
      let { headers: H, moveText: M } = StickyPGNView.split(raw);

      let pgn = (H.length ? H.join("\n") + "\n\n" : "") + M;
      let chess = new Chess();
      chess.load_pgn(pgn, { sloppy: true });

      let head = chess.header(),
        res = normalizeResult(head.Result || ""),
        needs = / (1-0|0-1|1\/2-1\/2|½-½|\*)$/.test(M),
        movetext = needs ? M : M + (res ? " " + res : "");

      // Sticky header (separate row)
      this.headerDiv = document.createElement("div");
      this.headerDiv.className = "pgn-sticky-header";
      this.wrapper.appendChild(this.headerDiv);
      this.headerDiv.appendChild(this.buildHeaderContent(head));

      // Columns container
      const cols = document.createElement("div");
      cols.className = "pgn-sticky-cols";
      this.wrapper.appendChild(cols);

      // Left col: sticky board
      this.leftCol = document.createElement("div");
      this.leftCol.className = "pgn-sticky-left";
      cols.appendChild(this.leftCol);

      // Right col: moves
      this.movesCol = document.createElement("div");
      this.movesCol.className = "pgn-sticky-right";
      cols.appendChild(this.movesCol);

      // Create board and buttons
      this.createStickyBoard();
      this.createStickyButtons();

      // Parse full PGN into right column
      this.parse(movetext);

      this.sourceEl.replaceWith(this.wrapper);
    }

    buildHeaderContent(h) {
      let W =
          (h.WhiteTitle ? h.WhiteTitle + " " : "") +
          flipName(h.White || "") +
          (h.WhiteElo ? " (" + h.WhiteElo + ")" : ""),
        B =
          (h.BlackTitle ? h.BlackTitle + " " : "") +
          flipName(h.Black || "") +
          (h.BlackElo ? " (" + h.BlackElo + ")" : ""),
        Y = extractYear(h.Date),
        line = (h.Event || "") + (Y ? ", " + Y : "");

      let H = document.createElement("h4");
      H.appendChild(document.createTextNode(W + " – " + B));
      H.appendChild(document.createElement("br"));
      H.appendChild(document.createTextNode(line));
      return H;
    }

    createStickyBoard() {
      this.boardDiv = document.createElement("div");
      this.boardDiv.className = "pgn-sticky-board";
      this.leftCol.appendChild(this.boardDiv);

      setTimeout(() => {
        StickyBoard.board = Chessboard(this.boardDiv, {
          position: "start",
          draggable: false,
          pieceTheme: PIECE_THEME_URL
        });
      }, 0);
    }

    createStickyButtons() {
      const wrap = document.createElement("div");
      wrap.className = "pgn-sticky-buttons";

      const prev = document.createElement("button");
      prev.className = "pgn-sticky-btn";
      prev.textContent = "◀";
      prev.addEventListener("click", () => StickyBoard.prev());

      const next = document.createElement("button");
      next.className = "pgn-sticky-btn";
      next.textContent = "▶";
      next.addEventListener("click", () => StickyBoard.next());

      wrap.appendChild(prev);
      wrap.appendChild(next);
      this.leftCol.appendChild(wrap);
    }

    ensure(ctx, cls) {
      if (!ctx.container) {
        let p = document.createElement("p");
        p.className = cls;
        this.movesCol.appendChild(p);
        ctx.container = p;
      }
    }

    parseComment(text, i, ctx) {
      let j = i;
      while (j < text.length && text[j] !== "}") j++;
      let raw = text.substring(i, j).trim();
      if (text[j] === "}") j++;

      raw = raw.replace(/\[%.*?]/g, "").trim();
      if (!raw.length) return j;

      if (ctx.type === "main") {
        let k = j;
        while (k < text.length && /\s/.test(text[k])) k++;
        let next = "";
        while (
          k < text.length &&
          !/\s/.test(text[k]) &&
          !"(){}".includes(text[k])
        )
          next += text[k++];
        if (RESULT_REGEX.test(next)) {
          raw = raw.replace(/(1-0|0-1|1\/2-1\/2|½-½|\*)$/, "").trim();
        }
      }

      let parts = raw.split("[D]");
      for (let idx = 0; idx < parts.length; idx++) {
        let c = parts[idx].trim();
        if (ctx.type === "variation") {
          this.ensure(ctx, "pgn-variation");
          if (c) appendText(ctx.container, " " + c);
        } else {
          if (c) {
            let p = document.createElement("p");
            p.className = "pgn-comment";
            appendText(p, c);
            this.movesCol.appendChild(p);
          }
          ctx.container = null;
        }
      }

      ctx.lastWasInterrupt = true;
      return j;
    }

    handleSAN(tok, ctx) {
      let core = tok.replace(/[^a-hKQRBN0-9=O0-]+$/g, "").replace(/0/g, "O");
      if (!StickyPGNView.isSANCore(core)) {
        appendText(ctx.container, tok + " ");
        return null;
      }

      let base = ctx.baseHistoryLen || 0,
        count = ctx.chess.history().length,
        ply = base + count,
        white = ply % 2 === 0,
        num = Math.floor(ply / 2) + 1;

      if (ctx.type === "main") {
        if (white) appendText(ctx.container, num + "." + NBSP);
        else if (ctx.lastWasInterrupt)
          appendText(ctx.container, num + "..." + NBSP);
      } else {
        if (white) appendText(ctx.container, num + "." + NBSP);
        else if (ctx.lastWasInterrupt)
          appendText(ctx.container, num + "..." + NBSP);
      }

      ctx.prevFen = ctx.chess.fen();
      ctx.prevHistoryLen = ply;

      let mv = ctx.chess.move(core, { sloppy: true });
      if (!mv) {
        appendText(ctx.container, tok + " ");
        return null;
      }

      ctx.lastWasInterrupt = false;

      let span = document.createElement("span");
      span.className = "pgn-move sticky-move";
      span.dataset.fen = ctx.chess.fen();

      // Identify mainline vs variation
      span.dataset.mainline = ctx.type === "main" ? "1" : "0";

      span.textContent = makeCastlingUnbreakable(tok) + " ";
      ctx.container.appendChild(span);

      return span;
    }

    parse(t) {
      let chess = new Chess(),
        ctx = {
          type: "main",
          chess: chess,
          container: null,
          parent: null,
          lastWasInterrupt: false,
          prevFen: chess.fen(),
          prevHistoryLen: 0,
          baseHistoryLen: null
        },
        i = 0;

      for (; i < t.length; ) {
        let ch = t[i];

        if (/\s/.test(ch)) {
          while (i < t.length && /\s/.test(t[i])) i++;
          this.ensure(ctx, ctx.type === "main" ? "pgn-mainline" : "pgn-variation");
          appendText(ctx.container, " ");
          continue;
        }

        if (ch === "(") {
          i++;
          let fen = ctx.prevFen || ctx.chess.fen(),
            len =
              typeof ctx.prevHistoryLen === "number"
                ? ctx.prevHistoryLen
                : ctx.chess.history().length;
          ctx = {
            type: "variation",
            chess: new Chess(fen),
            container: null,
            parent: ctx,
            lastWasInterrupt: true,
            prevFen: fen,
            prevHistoryLen: len,
            baseHistoryLen: len
          };
          this.ensure(ctx, "pgn-variation");
          continue;
        }

        if (ch === ")") {
          i++;
          if (ctx.parent) {
            ctx = ctx.parent;
            ctx.lastWasInterrupt = true;
            ctx.container = null;
          }
          continue;
        }

        if (ch === "{") {
          i = this.parseComment(t, i + 1, ctx);
          continue;
        }

        let s = i;
        while (
          i < t.length &&
          !/\s/.test(t[i]) &&
          !"(){}".includes(t[i])
        )
          i++;
        let tok = t.substring(s, i);
        if (!tok) continue;

        if (/^\[%.*]$/.test(tok)) continue;

        if (tok === "[D]") {
          ctx.lastWasInterrupt = true;
          ctx.container = null;
          continue;
        }

        if (RESULT_REGEX.test(tok)) {
          if (this.finalResultPrinted) continue;
          this.finalResultPrinted = true;
          this.ensure(ctx, ctx.type === "main" ? "pgn-mainline" : "pgn-variation");
          appendText(ctx.container, tok + " ");
          continue;
        }

        if (MOVE_NUMBER_REGEX.test(tok)) continue;

        let core = tok
            .replace(/[^a-hKQRBN0-9=O0-]+$/g, "")
            .replace(/0/g, "O"),
          isSAN = StickyPGNView.isSANCore(core);

        if (!isSAN) {
          if (EVAL_MAP[tok]) {
            this.ensure(ctx, ctx.type === "main" ? "pgn-mainline" : "pgn-variation");
            appendText(ctx.container, EVAL_MAP[tok] + " ");
            continue;
          }

          if (tok[0] === "$") {
            let code = +tok.slice(1);
            if (NAG_MAP[code]) {
              this.ensure(ctx, ctx.type === "main" ? "pgn-mainline" : "pgn-variation");
              appendText(ctx.container, NAG_MAP[code] + " ");
            }
            continue;
          }

          if (/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(tok)) {
            if (ctx.type === "variation") {
              this.ensure(ctx, "pgn-variation");
              appendText(ctx.container, " " + tok);
            } else {
              let p = document.createElement("p");
              p.className = "pgn-comment";
              appendText(p, tok);
              this.movesCol.appendChild(p);
              ctx.container = null;
              ctx.lastWasInterrupt = false;
            }
          } else {
            this.ensure(ctx, ctx.type === "main" ? "pgn-mainline" : "pgn-variation");
            appendText(ctx.container, tok + " ");
          }
          continue;
        }

        this.ensure(ctx, ctx.type === "main" ? "pgn-mainline" : "pgn-variation");
        let m = this.handleSAN(tok, ctx);
        if (!m) appendText(ctx.container, makeCastlingUnbreakable(tok) + " ");
      }
    }

    applyFigurines() {
      // Using Chess Merida font, figurines are uppercase letters converted to glyphs
      const map = { K: "†", Q: "‡", R: "Ù", B: "Û", N: "Ú" }; 
      // Merida encoding: 
      // K=†, Q=‡, R=Ù, B=Û, N=Ú   (this is correct for Chess Merida Webfont)

      this.wrapper.querySelectorAll(".pgn-move").forEach(span => {
        let m = span.textContent.match(/^([KQRBN])(.+?)(\s*)$/);
        if (m) {
          span.innerHTML = `<span class="merida">${map[m[1]]}</span>${m[2]}${m[3] || ""}`;
        }
      });
    }
  }

  // --------------------------------------------------------------------------
  // StickyBoard navigation (MAINLINE ONLY + local scrolling)
  // --------------------------------------------------------------------------
  const StickyBoard = {
    board: null,
    moveSpans: [],
    currentIndex: -1,
    movesContainer: null,
    mainlineMoves: [],
    mainlineIndex: -1,

    collectMoves(root) {
      this.moveSpans = Array.from(
        (root || document).querySelectorAll(".sticky-move")
      );
    },

    goto(index) {
      if (index < 0 || index >= this.moveSpans.length) return;
      this.currentIndex = index;

      const span = this.moveSpans[index];
      const fen = span.dataset.fen;
      if (!fen || !this.board) return;

      this.board.position(fen, true);

      this.moveSpans.forEach(s =>
        s.classList.remove("sticky-move-active")
      );
      span.classList.add("sticky-move-active");

      // Update mainlineIndex ONLY for mainline moves
      if (span.dataset.mainline === "1") {
        const mi = this.mainlineMoves.indexOf(span);
        if (mi !== -1) this.mainlineIndex = mi;
      }

      // LOCAL SCROLL inside moves column
      if (this.movesContainer) {
        const parent = this.movesContainer;
        const top =
          span.offsetTop - parent.offsetTop - parent.clientHeight / 3;

        parent.scrollTo({
          top,
          behavior: "smooth"
        });
      }
    },

    gotoSpan(span) {
      const index = this.moveSpans.indexOf(span);
      if (index !== -1) this.goto(index);
    },

    next() {
      if (!this.mainlineMoves.length) return;
      if (this.mainlineIndex < 0) this.mainlineIndex = 0;
      else
        this.mainlineIndex = Math.min(
          this.mainlineIndex + 1,
          this.mainlineMoves.length - 1
        );

      this.gotoSpan(this.mainlineMoves[this.mainlineIndex]);
    },

    prev() {
      if (!this.mainlineMoves.length) return;
      if (this.mainlineIndex < 0) this.mainlineIndex = 0;
      else this.mainlineIndex = Math.max(this.mainlineIndex - 1, 0);

      this.gotoSpan(this.mainlineMoves[this.mainlineIndex]);
    },

    activate(root) {
      this.movesContainer =
        (root || document).querySelector(".pgn-sticky-right");

      this.collectMoves(root);

      // Build mainline-only set
      this.mainlineMoves = this.moveSpans.filter(
        s => s.dataset.mainline === "1"
      );

      this.mainlineIndex = -1;

      this.moveSpans.forEach((span, idx) => {
        span.style.cursor = "pointer";
        span.addEventListener("click", () => this.goto(idx));
      });

      window.addEventListener("keydown", e => {
        const tag = (e.target.tagName || "").toLowerCase();
        if (tag === "input" || tag === "textarea") return;

        if (e.key === "ArrowRight") {
          e.preventDefault();
          this.next();
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          this.prev();
        }
      });
    }
  };

  // --------------------------------------------------------------------------
  // CSS (mobile-first, sticky header + board + bold mainline moves)
  // --------------------------------------------------------------------------
  const style = document.createElement("style");
  style.textContent = `

/* Use Chess Merida font */
.merida {
  font-family: 'Chess Merida', 'ChessMerida', 'Merida', sans-serif;
  font-weight: inherit;
}

/* Ensure moves use Merida font too */
.sticky-move {
  font-family: 'Chess Merida', 'ChessMerida', 'Merida', sans-serif;
}

/* Bold mainline moves */
.sticky-move[data-mainline="1"] {
  font-weight: 600 !important;
}

/* Normal weight variations */
.sticky-move[data-mainline="0"] {
  font-weight: 400 !important;
}

/* Highlight */
.sticky-move-active {
  background: #ffe38a;
  border-radius: 4px;
  padding: 2px 4px;
}

/* Mobile-first layout */
.pgn-sticky-block{
  background:#fff;
  margin-bottom:2rem;
}

/* Sticky title */
.pgn-sticky-header{
  position:sticky;
  top:0rem;
  background:#fff;
  z-index:80;
  padding-bottom:0.4rem;
}

/* MOBILE: stacked */
.pgn-sticky-cols{
  display:flex;
  flex-direction:column;
  gap:1.5rem;
  margin-top:1rem;
}

/* Sticky board */
.pgn-sticky-left{
  position:sticky;
  top:4rem;
  background:#fff;
  z-index:70;
  align-self:flex-start;
}

/* Board */
.pgn-sticky-board{
  width:320px;
  max-width:100%;
  margin-top:0.5rem;
}

/* Buttons */
.pgn-sticky-buttons{
  width:320px;
  display:flex;
  justify-content:center;
  gap:1rem;
  margin-top:0.3rem;
}
.pgn-sticky-btn{
  font-size:1.2rem;
  padding:0.2rem 0.6rem;
  cursor:pointer;
  background:#fff;
  border:1px solid #ccc;
  border-radius:4px;
}

/* Moves: scroll only inside this box on desktop */
.pgn-sticky-right{
  max-height:none;
  overflow-y:visible;
  padding-right:0.5rem;
}

/* Comments */
.pgn-comment{
  font-style:italic;
  margin:0.3rem 0;
}

/* Variations */
.pgn-variation{
  margin-left:1.5rem;
  padding-left:0.5rem;
}

/* Desktop */
@media (min-width:768px){
  .pgn-sticky-header{
    top:1rem;
  }
  .pgn-sticky-cols{
    display:grid;
    grid-template-columns:340px 1fr;
    gap:2rem;
  }
  .pgn-sticky-left{
    top:6rem;
  }
  .pgn-sticky-right{
    max-height:calc(100vh - 7rem);
    overflow-y:auto;
  }
}
`;

  document.head.appendChild(style);

  // --------------------------------------------------------------------------
  // DOM Ready
  // --------------------------------------------------------------------------
  document.addEventListener("DOMContentLoaded", () => {
    const els = document.querySelectorAll("pgn-sticky");
    if (!els.length) return;

    els.forEach(el => new StickyPGNView(el));
    StickyBoard.activate(document);
  });

})();
