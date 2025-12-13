(function () {
  "use strict";

  if (typeof Chess !== "function" || typeof Chessboard !== "function") return;

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    document.querySelectorAll("puzzle").forEach(renderPuzzle);
  }

  // ------------------------------------------------------------
  // Parsing helpers
  // ------------------------------------------------------------

  function normalizeText(el) {
    return el.textContent.replace(/\s+/g, " ").trim();
  }

  function parseMoves(str) {
    if (typeof str !== "string") return [];
    return str
      .replace(/\b\d+\.(\.\.)?/g, " ")
      .replace(/\b(1-0|0-1|1\/2-1\/2|\*)\b/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
  }

  // ------------------------------------------------------------
  // UI helpers
  // ------------------------------------------------------------

  function show(el, txt) {
    el.textContent = txt || "";
  }

  function whoseTurn(game) {
    return game.turn() === "w" ? "⚐ White to move" : "⚑ Black to move";
  }

  // ------------------------------------------------------------
  // Core renderer
  // ------------------------------------------------------------

  function renderPuzzle(node) {
    const raw = normalizeText(node);

    const fenMatch = raw.match(/FEN:\s*([^M]+?)\s+Moves:/i);
    const movesMatch = raw.match(/Moves:\s*(.+)$/i);

    if (!fenMatch || !movesMatch) {
      node.textContent = "❌ Invalid <puzzle> block.";
      return;
    }

    const fen = fenMatch[1].trim();
    const moves = parseMoves(movesMatch[1]);

    if (!fen || !moves.length) {
      node.textContent = "❌ Invalid puzzle data.";
      return;
    }

    const wrap = document.createElement("div");
    wrap.className = "jc-puzzle-wrapper";
    node.replaceWith(wrap);

    buildPuzzleUI(wrap, fen, moves);
  }

  // ------------------------------------------------------------
  // Puzzle logic
  // ------------------------------------------------------------

  function buildPuzzleUI(container, fen, moves) {
    const game = new Chess(fen);
    let index = 0;
    let solved = false;

    // --- UI ---
    const boardDiv = document.createElement("div");
    boardDiv.className = "jc-board";

    const status = document.createElement("div");
    status.className = "jc-status-row";

    const turnEl = document.createElement("span");
    turnEl.className = "jc-turn";

    const feedback = document.createElement("span");
    feedback.className = "jc-feedback";

    status.append(turnEl, feedback);
    container.append(boardDiv, status);

    // --- Board ---
    let board = null;

    requestAnimationFrame(() => {
      board = Chessboard(boardDiv, {
        position: fen,
        draggable: true,
        pieceTheme:
          "https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png",
        onDrop: onUserMove
      });
    });

    updateTurn();

    // ----------------------------------------------------------

    function updateTurn() {
      show(turnEl, solved ? "" : whoseTurn(game));
    }

    function onUserMove(src, dst) {
      if (solved) return "snapback";

      const expected = moves[index];
      const mv = game.move({ from: src, to: dst, promotion: "q" });

      if (!mv) return "snapback";

      if (mv.san.replace(/[+#?!]/g, "") !== expected.replace(/[+#?!]/g, "")) {
        game.undo();
        show(feedback, "❌ Wrong move");
        updateTurn();
        return "snapback";
      }

      index++;
      show(feedback, "✅ Correct");

      board.position(game.fen(), true);
      updateTurn();

      setTimeout(autoReply, 250);
    }

    function autoReply() {
      if (index >= moves.length) {
        solved = true;
        show(feedback, "🏆 Puzzle solved");
        updateTurn();
        return;
      }

      // opponent move only
      if (
        (game.turn() === "w" && index % 2 === 0) ||
        (game.turn() === "b" && index % 2 === 1)
      ) {
        return;
      }

      const mv = game.move(moves[index], { sloppy: true });
      if (!mv) {
        solved = true;
        show(feedback, "🏆 Puzzle solved");
        updateTurn();
        return;
      }

      index++;
      board.position(game.fen(), true);
      updateTurn();
    }
  }
})();
