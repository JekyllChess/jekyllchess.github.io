// ======================================================
// pgn-sticky.js
// Renders <pgn-sticky> elements AND activates StickyBoard
// Only runs if <pgn-sticky> exists on the page
// ======================================================

(function(){
"use strict";

// ------------------------------------------------------
// Exit early if there is no <pgn-sticky> on the page
// ------------------------------------------------------
if (!document.querySelector("pgn-sticky")) return;

// ------------------------------------------------------
// Dependency check
// ------------------------------------------------------
if (typeof Chess === "undefined") {
    console.warn("pgn-sticky.js: chess.js missing");
    return;
}

const PIECE_THEME_URL =
    "https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png";


// ============================================================================
//                           Sticky PGN Renderer
// ============================================================================

class StickyPGNView {
    constructor(src) {
        this.src = src;
        this.wrapper = document.createElement("div");
        this.wrapper.className = "pgn-sticky-block";
        this.build();
    }

    build() {
        const raw = this.src.textContent.trim();
        const { headers, movetext } = this.splitPGN(raw);

        const chess = new Chess();
        chess.loadPgn(raw, { sloppy: true });

        const headerObj = chess.header();

        // 1. Heading
        this.buildHeader(headerObj);

        // 2. Sticky Diagram (only once)
        this.buildStickyDiagram(chess.fen());

        // Reset for full re-parse
        chess.reset();

        // 3. Moves (with variations + comments)
        const movesArea = document.createElement("div");
        movesArea.className = "pgn-sticky-moves";
        this.wrapper.appendChild(movesArea);

        this.parseMovetext(movetext, chess, movesArea);

        // Replace original <pgn-sticky> element
        this.src.replaceWith(this.wrapper);
    }

    splitPGN(raw) {
        const lines = raw.split(/\r?\n/);
        let headers = [];
        let moves = [];
        let inHeader = true;

        for (const L of lines) {
            const T = L.trim();
            if (inHeader && T.startsWith("[") && T.endsWith("]")) {
                headers.push(T);
            } else if (T === "") {
                inHeader = false;
            } else {
                inHeader = false;
                moves.push(T);
            }
        }

        return {
            headers,
            movetext: moves.join(" ")
        };
    }

    buildHeader(h) {
        const title = document.createElement("h4");
        const W = (h.WhiteTitle ? h.WhiteTitle + " " : "") + (h.White || "");
        const B = (h.BlackTitle ? h.BlackTitle + " " : "") + (h.Black || "");
        const Y = (h.Date || "").split(".")[0];

        title.textContent = `${W} – ${B}`;

        const sub = document.createElement("div");
        sub.className = "pgn-sticky-sub";
        sub.textContent =
            `${h.Event || ""}${Y ? ", " + Y : ""}`;

        this.wrapper.appendChild(title);
        this.wrapper.appendChild(sub);
    }

    buildStickyDiagram(fen) {
        const d = document.createElement("div");
        d.className = "pgn-sticky-diagram";
        this.wrapper.appendChild(d);

        setTimeout(() => {
            Chessboard(d, {
                position: fen,
                draggable: false,
                pieceTheme: PIECE_THEME_URL
            });
        }, 0);
    }

    // ------------------------------------------------------
    // PARSE MOVETEXT (keeps comments & variations)
    // ------------------------------------------------------
    parseMovetext(text, chess, container) {
        let i = 0;
        let moveNumber = 1;
        let variationStack = [];

        const newLine = () => {
            const p = document.createElement("p");
            container.appendChild(p);
            return p;
        };

        let line = newLine();

        while (i < text.length) {

            const ch = text[i];

            // Skip whitespace
            if (/\s/.test(ch)) {
                i++;
                continue;
            }

            // ==========================================
            // Comments { ... }
            // ==========================================
            if (ch === "{") {
                let j = i + 1;
                while (j < text.length && text[j] !== "}") j++;
                const comment = text.substring(i + 1, j).trim();

                const p = document.createElement("p");
                p.className = "pgn-comment";
                p.textContent = comment;
                container.appendChild(p);

                i = j + 1;
                continue;
            }

            // ==========================================
            // Variations ( ... )
            // ==========================================
            if (ch === "(") {
                // Start new variation block
                const varBlock = document.createElement("div");
                varBlock.className = "pgn-variation";
                container.appendChild(varBlock);

                variationStack.push({ container, line });

                container = varBlock;
                line = newLine();

                i++;
                continue;
            }

            // Close variation
            if (ch === ")") {
                let st = variationStack.pop();
                container = st.container;
                line = newLine();

                i++;
                continue;
            }

            // ==========================================
            // REMOVE [D] diagrams completely
            // ==========================================
            if (text.substring(i, i + 3) === "[D]") {
                i += 3;
                continue;
            }

            // ==========================================
            // Parse token (move, number, result...)
            // ==========================================
            let s = i;
            while (i < text.length &&
                   !/\s/.test(text[i]) &&
                   !"(){}".includes(text[i])) {
                i++;
            }
            const tok = text.substring(s, i);

            // Skip move numbers (e.g. 1. or 1... )
            if (/^\d+\.{1,3}$/.test(tok)) continue;

            // Game result
            if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(tok)) {
                line.appendChild(document.createTextNode(" " + tok + " "));
                continue;
            }

            // Attempt SAN move
            const mv = chess.move(tok, { sloppy: true });
            if (!mv) {
                line.appendChild(document.createTextNode(tok + " "));
                continue;
            }

            // White move number
            if (mv.color === "w") {
                line.appendChild(document.createTextNode(moveNumber + ". "));
            }

            const span = document.createElement("span");
            span.className = "sticky-move";
            span.dataset.fen = chess.fen();
            span.textContent = mv.san + " ";
            line.appendChild(span);

            if (mv.color === "b") moveNumber++;
        }
    }
}


// ------------------------------------------------------
// Render ALL <pgn-sticky> on DOMContentLoaded
// ------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
    document
        .querySelectorAll("pgn-sticky")
        .forEach(el => new StickyPGNView(el));

    StickyBoard.activate(document);
});


// ============================================================================
//                           StickyBoard Engine
// ============================================================================

const StickyBoard = {
    board: null,
    moveSpans: [],
    currentIndex: -1,

    initBoard() {
        if (document.getElementById("sticky-chessboard")) return;

        const div = document.createElement("div");
        div.id = "sticky-chessboard";
        div.className = "sticky-chessboard";
        document.body.appendChild(div);

        this.board = Chessboard("sticky-chessboard", {
            position: "start",
            draggable: false,
            pieceTheme: PIECE_THEME_URL,
            moveSpeed: 200,
            snapSpeed: 20,
            snapbackSpeed: 20,
            appearSpeed: 150
        });
    },

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
        if (!fen) return;

        this.board.position(fen, true);

        this.moveSpans.forEach(s =>
            s.classList.remove("sticky-move-active")
        );
        span.classList.add("sticky-move-active");

        span.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "nearest"
        });
    },

    next() {
        this.goto(this.currentIndex + 1);
    },

    prev() {
        this.goto(this.currentIndex - 1);
    },

    activate(root) {
        this.initBoard();
        this.collectMoves(root);

        this.moveSpans.forEach((span, idx) => {
            span.style.cursor = "pointer";
            span.addEventListener("click", () => {
                this.goto(idx);
            });
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


// ============================================================================
// StickyBoard CSS
// ============================================================================
const style = document.createElement("style");
style.textContent = `
#sticky-chessboard {
    position: fixed;
    bottom: 1.2rem;
    right: 1.2rem;
    width: 300px !important;
    height: 300px !important;
    z-index: 9999;
    border: 2px solid #444;
    background: #fff;
    box-shadow: 0 4px 16px rgba(0,0,0,0.3);
    border-radius: 4px;
}

.pgn-sticky-diagram {
    position: sticky;
    top: 1rem;
    width: 320px;
    max-width: 100%;
    margin: 1rem 0;
    z-index: 40;
}

.pgn-sticky-moves {
    margin-top: 1rem;
    line-height: 1.7;
    font-size: 1rem;
}

.pgn-variation {
    margin-left: 1.5rem;
    padding-left: .5rem;
    border-left: 2px solid #ddd;
    margin-top: .5rem;
}

.pgn-comment {
    font-style: italic;
    margin: .3rem 0;
}

.sticky-move {
    cursor: pointer;
}

.sticky-move-active {
    background: #ffe38a;
    border-radius: 4px;
    padding: 2px 4px;
}
`;
document.head.appendChild(style);

})();
