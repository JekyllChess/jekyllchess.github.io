// ============================================================================
// pgn-sticky.js — TWO-COLUMN VERSION WITH HEADER INSIDE STICKY COLUMN
// ============================================================================
// Layout:
//   ┌──────────────────────────────────────────────┐
//   │ LEFT COLUMN  (STICKY)                        │
//   │  - Header                                    │
//   │  - Board                                     │
//   │  - Buttons                                   │
//   └──────────────────────────────────────────────┘
//   ┌──────────────────────────────────────────────┐
//   │ RIGHT COLUMN (scrollable moves/comments)     │
//   └──────────────────────────────────────────────┘
//
// Identical parsing behavior to pgn.js (figurines, SAN, comments, variations).
// ============================================================================

(function () {
    "use strict";

    if (typeof Chess === "undefined") {
        console.warn("pgn-sticky.js: chess.js missing");
        return;
    }
    if (typeof Chessboard === "undefined") {
        console.warn("pgn-sticky.js: chessboard.js missing");
        return;
    }

    const PIECE_THEME_URL =
        "https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png";

    // Regex
    const SAN_CORE_REGEX =
        /^([O0]-[O0](-[O0])?[+#]?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](=[QRBN])?[+#]?|[a-h][1-8](=[QRBN])?[+#]?)$/;
    const RESULT_REGEX = /^(1-0|0-1|1\/2-1\/2|½-½|\*)$/;
    const MOVE_NUMBER_REGEX = /^(\d+)(\.+)$/;
    const NBSP = "\u00A0";

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

    const NAG_MAP = {
        1: "!",
        2: "?",
        3: "‼",
        4: "⁇",
        5: "⁉",
        6: "⁈",
        13: "→",
        14: "↑",
        15: "⇆",
        16: "⇄",
        17: "⟂",
        18: "∞",
        19: "⟳",
        20: "⟲",
        36: "⩲",
        37: "⩱",
        38: "±",
        39: "∓",
        40: "+=",
        41: "=+",
        42: "±",
        43: "∓",
        44: "⨀",
        45: "⨁"
    };

    function flipName(n) {
        if (!n) return "";
        const i = n.indexOf(",");
        return i === -1
            ? n.trim()
            : n.slice(i + 1).trim() + " " + n.slice(0, i).trim();
    }

    function extractYear(d) {
        if (!d) return "";
        const p = d.split(".");
        return /^\d{4}$/.test(p[0]) ? p[0] : "";
    }

    function appendText(el, txt) {
        if (txt) el.appendChild(document.createTextNode(txt));
    }

    function stripFigurines(s) {
        return s
            .replace(/♔/g, "K")
            .replace(/♕/g, "Q")
            .replace(/♖/g, "R")
            .replace(/♗/g, "B")
            .replace(/♘/g, "N");
    }

    function makeCastlingUnbreakable(s) {
        return s
            .replace(/0-0-0|O-O-O/g, m => m[0] + "\u2011" + m[2] + "\u2011" + m[4])
            .replace(/0-0|O-O/g, m => m[0] + "\u2011" + m[2]);
    }

    // ========================================================================
    // CLASS StickyPGNView
    // ========================================================================

    class StickyPGNView {
        constructor(src) {
            this.src = src;
            this.wrapper = document.createElement("div");
            this.wrapper.className = "pgn-sticky-block";
            this.finalResultPrinted = false;
            this.build();
            this.applyFigurines();
        }

        split(raw) {
            const lines = raw.split(/\r?\n/);
            let headers = [];
            let moves = [];
            let inH = true;

            for (const L of lines) {
                const T = L.trim();
                if (inH && T.startsWith("[") && T.endsWith("]")) {
                    headers.push(T);
                } else if (T === "") {
                    inH = false;
                } else {
                    inH = false;
                    moves.push(T);
                }
            }

            return {
                headers,
                moveText: moves.join(" ").replace(/\s+/g, " ").trim()
            };
        }

        build() {
            const raw = this.src.textContent.trim();
            const { headers, moveText } = this.split(raw);

            const pgn =
                (headers.length ? headers.join("\n") + "\n\n" : "") + moveText;

            const chess = new Chess();
            chess.load_pgn(pgn, { sloppy: true });

            const head = chess.header();
            const res = head.Result || "";
            const needs = / (1-0|0-1|1\/2-1\/2|½-½|\*)$/.test(moveText);
            const finalText = needs ? moveText : moveText + " " + res;

            // ───────────────────────────────────────────────
            // TWO COLUMN CONTAINER
            // ───────────────────────────────────────────────
            const cols = document.createElement("div");
            cols.className = "pgn-sticky-cols";
            this.wrapper.appendChild(cols);

            // LEFT COLUMN — STICKY container (header + board + buttons)
            this.leftCol = document.createElement("div");
            this.leftCol.className = "pgn-sticky-left";
            cols.appendChild(this.leftCol);

            // RIGHT COLUMN — scrollable moves
            this.rightCol = document.createElement("div");
            this.rightCol.className = "pgn-sticky-right";
            cols.appendChild(this.rightCol);

            // HEADER (inside sticky column)
            this.renderHeader(head);

            // BOARD
            this.renderBoard();

            // BUTTONS
            this.renderButtons();

            chess.reset();

            // MOVES in right column
            this.parse(finalText, chess, this.rightCol);

            this.src.replaceWith(this.wrapper);
        }

        renderHeader(h) {
            const W =
                (h.WhiteTitle ? h.WhiteTitle + " " : "") +
                flipName(h.White || "") +
                (h.WhiteElo ? " (" + h.WhiteElo + ")" : "");
            const B =
                (h.BlackTitle ? h.BlackTitle + " " : "") +
                flipName(h.Black || "") +
                (h.BlackElo ? " (" + h.BlackElo + ")" : "");
            const Y = extractYear(h.Date);

            const H = document.createElement("h4");
            H.textContent = `${W} – ${B}`;

            const sub = document.createElement("div");
            sub.className = "pgn-sticky-sub";
            sub.textContent = (h.Event || "") + (Y ? ", " + Y : "");

            const headerWrap = document.createElement("div");
            headerWrap.className = "pgn-sticky-header";
            headerWrap.appendChild(H);
            headerWrap.appendChild(sub);

            this.leftCol.appendChild(headerWrap);
        }

        renderBoard() {
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

        renderButtons() {
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

        parse(t, chess, container) {
            let i = 0;
            let ctx = {
                type: "main",
                chess,
                container: null,
                parent: null,
                lastWasInterrupt: false,
                prevFen: chess.fen(),
                prevHistoryLen: 0,
                baseHistoryLen: null
            };

            const ensure = cls => {
                if (!ctx.container) {
                    const p = document.createElement("p");
                    p.className = cls;
                    container.appendChild(p);
                    ctx.container = p;
                }
            };

            const isSANcore = core => SAN_CORE_REGEX.test(core);

            while (i < t.length) {
                let ch = t[i];

                if (/\s/.test(ch)) {
                    while (i < t.length && /\s/.test(t[i])) i++;
                    ensure("pgn-mainline");
                    appendText(ctx.container, " ");
                    continue;
                }

                if (ch === "(") {
                    i++;
                    let fen = ctx.prevFen;
                    let len = ctx.prevHistoryLen;
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
                    ensure("pgn-variation");
                    continue;
                }

                if (ch === ")") {
                    i++;
                    ctx = ctx.parent || ctx;
                    ctx.lastWasInterrupt = true;
                    ctx.container = null;
                    continue;
                }

                if (ch === "{") {
                    let j = i + 1;
                    while (j < t.length && t[j] !== "}") j++;
                    let raw = t.substring(i + 1, j).trim();
                    i = j + 1;

                    let p = document.createElement("p");
                    p.className = "pgn-comment";
                    appendText(p, raw);
                    container.appendChild(p);
                    ctx.container = null;
                    ctx.lastWasInterrupt = false;
                    continue;
                }

                if (t.substring(i, i + 3) === "[D]") {
                    i += 3;
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

                if (MOVE_NUMBER_REGEX.test(tok)) continue;

                if (RESULT_REGEX.test(tok)) {
                    ensure("pgn-mainline");
                    appendText(ctx.container, tok + " ");
                    continue;
                }

                let asciiTok = stripFigurines(tok);
                let core = asciiTok
                    .replace(/[^a-hKQRBN0-9=O0-]+$/g, "")
                    .replace(/0/g, "O");
                let isSAN = isSANcore(core);

                if (!isSAN) {
                    if (EVAL_MAP[tok]) {
                        ensure("pgn-mainline");
                        appendText(ctx.container, EVAL_MAP[tok] + " ");
                        continue;
                    }
                    if (tok[0] === "$") {
                        let code = +tok.slice(1);
                        if (NAG_MAP[code]) {
                            ensure("pgn-mainline");
                            appendText(ctx.container, NAG_MAP[code] + " ");
                        }
                        continue;
                    }
                    if (/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(tok)) {
                        let p = document.createElement("p");
                        p.className = "pgn-comment";
                        appendText(p, tok);
                        container.appendChild(p);
                        ctx.container = null;
                        continue;
                    }
                    ensure("pgn-mainline");
                    appendText(ctx.container, tok + " ");
                    continue;
                }

                ensure("pgn-mainline");

                ctx.prevFen = ctx.chess.fen();
                ctx.prevHistoryLen =
                    ctx.baseHistoryLen + ctx.chess.history().length;

                let mv = ctx.chess.move(core, { sloppy: true });
                if (!mv) {
                    appendText(ctx.container, makeCastlingUnbreakable(tok) + " ");
                    continue;
                }

                let span = document.createElement("span");
                span.className = "sticky-move";
                span.dataset.fen = ctx.chess.fen();
                span.textContent = makeCastlingUnbreakable(tok) + " ";
                ctx.container.appendChild(span);
            }
        }

        applyFigurines() {
            const map = { K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘" };
            this.wrapper.querySelectorAll(".sticky-move").forEach(span => {
                let m = span.textContent.match(/^([KQRBN])(.+?)(\s*)$/);
                if (m) {
                    span.textContent =
                        map[m[1]] +
                        m[2] +
                        (m[3] || "");
                }
            });
        }
    }

    // ========================================================================
    // StickyBoard Navigation
    // ========================================================================

    const StickyBoard = {
        board: null,
        moveSpans: [],
        currentIndex: -1,

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
            if (fen) this.board.position(fen, true);

            this.moveSpans.forEach(s =>
                s.classList.remove("sticky-move-active")
            );
            span.classList.add("sticky-move-active");

            span.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
        },

        next() {
            this.goto(this.currentIndex + 1);
        },
        prev() {
            this.goto(this.currentIndex - 1);
        },

        activate(root) {
            this.collectMoves(root);

            this.moveSpans.forEach((span, i) => {
                span.addEventListener("click", () => this.goto(i));
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

    // ========================================================================
    // CSS — Two Columns + Sticky Left
    // ========================================================================

    const css = document.createElement("style");
    css.textContent = `

/* Whole block */
.pgn-sticky-block {
    background: white;
    margin-bottom: 2rem;
    padding-top: 0.5rem;
}

/* Two columns */
.pgn-sticky-cols {
    display: grid;
    grid-template-columns: 340px 1fr;
    gap: 2rem;
}

/* LEFT COLUMN (sticky) */
.pgn-sticky-left {  
    position: sticky;
    top: 1rem;
    align-self: start;
    background: white;
}

/* Header inside sticky column */
.pgn-sticky-header {
    margin-bottom: 0.5rem;
}

.pgn-sticky-sub {
    font-size: 0.9rem;
    color: #666;
}

/* Board */
.pgn-sticky-board {
    width: 320px;
    max-width: 100%;
    margin-top: 0.5rem;
}

/* Buttons centered to board */
.pgn-sticky-buttons {
    width: 320px;
    display: flex;
    justify-content: center;
    gap: 1rem;
    margin-top: 0.3rem;
}
.pgn-sticky-btn {
    font-size: 1.2rem;
    padding: 0.2rem 0.6rem;
    background: white;
    border: 1px solid #ccc;
    border-radius: 4px;
}

/* RIGHT COLUMN (scrolls) */
.pgn-sticky-right {
    max-height: calc(100vh - 150px);
    overflow-y: auto;
    padding-right: 0.5rem;
}

/* Moves + variations */
.pgn-mainline,
.pgn-variation {
    font-size: 1rem;
    line-height: 1.7;
}
.pgn-variation {
    margin-left: 1.5rem;
    padding-left: 0.5rem;
}

/* Comments */
.pgn-comment {
    font-style: italic;
    margin: 0.3rem 0;
}

/* Active move */
.sticky-move-active {
    background: #ffe38a;
    border-radius: 4px;
    padding: 2px 4px;
}
`;
    document.head.appendChild(css);

    // ========================================================================
    // INIT
    // ========================================================================
    document.addEventListener("DOMContentLoaded", () => {
        const els = document.querySelectorAll("pgn-sticky");
        if (!els.length) return;

        els.forEach(el => new StickyPGNView(el));
        StickyBoard.activate(document);
    });
})();
