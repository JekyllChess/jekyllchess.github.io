// ======================================================================
// JekyllChess Puzzle Engine — FINAL PATCHED
// - correct turn logic
// - opponent auto-moves only
// - animation ONLY for auto moves
// ======================================================================

(function () {
  "use strict";

  if (typeof Chess !== "function" || typeof Chessboard !== "function") return;

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    document.querySelectorAll("puzzle").forEach(renderPuzzle);
  }

  // ------------------------------------------------------------------
  // Utilities
  // ------------------------------------------------------------------

  function stripFigurines(s) {
    return s.replace(/[♔♕♖♗♘♙]/g, "");
  }

  function normalizeSAN(s) {
    return (s || "").replace(/[+#?!]/g, "");
  }

  function parseMoves(str) {
    return str.trim().split(/\s+/).filter(Boolean);
  }

  // ------------------------------------------------------------------
  // Main renderer
  // ------------------------------------------------------------------

  function renderPuzzle(node) {
    const raw = stripFigurines(node.textContent || "").trim();
    const wrap = document.createElement("div");
    wrap.className = "jc-puzzle-wrapper";
    node.replaceWith(wrap);

    const fenMatch = raw.match(/FEN:\s*([^\n]+)/i);
    const movesMatch = raw.match(/Moves:\s*([\s\S]+)/i);

    if (!fenMatch || !movesMatch) {
      wrap.textContent = "❌ Invalid <puzzle> block.";
      return;
    }

    const fen = fenMatch[1].trim();
    const allMoves = parseMoves(movesMatch[1]);

    renderLocalPuzzle(wrap, fen, allMoves);
  }

  // ------------------------------------------------------------------
  // Local puzzle engine
  // ------------------------------------------------------------------

  function renderLocalPuzzle(container, fen, allMoves) {
    const game = new Chess(fen);
    let moveIndex = 0;
    let solved = false;

    // --- UI ----------------------------------------------------------

    const boardDiv = document.createElement("div");
    boardDiv.className = "jc-board";

    const statusRow = document.createElement("div");
    statusRow.className = "jc-status-row";

    const turnDiv = document.createElement("span");
    turnDiv.className = "jc-turn";

    const feedback = document.createElement("span");
    feedback.className = "jc-feedback";

    statusRow.append(turnDiv, feedback);
    container.append(boardDiv, statusRow);

    let board = null;

    // Safe chessboard init (prevents error 1003)
    requestAnimationFrame(() => {
      board = Chessboard(boardDiv, {
        position: fen,
        draggable: true,
        pieceTheme:
          "https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png",
        onDrop: onUserMove
      });
      updateTurn();
    });

    // --- Logic -------------------------------------------------------

    function onUserMove(src, dst) {
      if (solved) return false;

      const expected = normalizeSAN(allMoves[moveIndex]);
      const mv = game.move({
        from: src,
        to: dst,
        promotion: "q"
      });

      if (!mv) return false;

      if (normalizeSAN(mv.san) !== expected) {
        game.undo();
        feedback.textContent = "❌ Wrong move";
        updateTurn();
        return "snapback";
      }

      // Correct user move
      feedback.textContent = "✅ Correct";
      moveIndex++;
      board.position(game.fen(), false); // NO animation for user move
      updateTurn();

      // Auto-play opponent if exists
      setTimeout(playOpponentMove, 300);
      return true;
    }

    function playOpponentMove() {
      if (moveIndex >= allMoves.length) {
        solved = true;
        feedback.textContent = "🏆 Puzzle solved";
        updateTurn();
        return;
      }

      // Only auto-play if it's opponent's turn
      const san = allMoves[moveIndex];
      const mv = game.move(san, { sloppy: true });

      if (!mv) {
        solved = true;
        feedback.textContent = "🏆 Puzzle solved";
        updateTurn();
        return;
      }

      moveIndex++;

      // ✅ ANIMATION ONLY HERE
      board.position(game.fen(), true);

      updateTurn();
    }

    function updateTurn() {
      if (solved) {
        turnDiv.textContent = "";
        return;
      }
      turnDiv.textContent =
        game.turn() === "w" ? "⚐ White to move" : "⚑ Black to move";
    }
  }
})();
