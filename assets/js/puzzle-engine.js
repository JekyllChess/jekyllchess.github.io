// ======================================================================
// JekyllChess Puzzle Engine — local puzzles stable, remote URL placeholder
// - Local: FEN + Moves works reliably
// - Turn display appears together with board (no early text)
// - Auto-plays EXACTLY one opponent reply after each correct user move
// - Animates ONLY auto reply, then hard-syncs to prevent ghost pieces
// - Remote PGN URL: placeholder UI (disabled) so nothing breaks
// ======================================================================

(function () {
  "use strict";

  if (typeof Chess !== "function") {
    console.warn("puzzle-engine.js: chess.js missing");
    return;
  }
  if (typeof Chessboard !== "function") {
    console.warn("puzzle-engine.js: chessboard.js missing");
    return;
  }

  const PIECE_THEME = "https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png";

  // ----------------------------------------------------------------------
  // Chessboard 1003 fix: init only when element has layout (and return board)
  // ----------------------------------------------------------------------
  function safeChessboard(targetEl, options, onReady, tries = 90) {
    if (!targetEl) return;

    const rect = targetEl.getBoundingClientRect();
    if ((rect.width <= 0 || rect.height <= 0) && tries > 0) {
      requestAnimationFrame(() => safeChessboard(targetEl, options, onReady, tries - 1));
      return;
    }

    let board = null;
    try {
      board = Chessboard(targetEl, options);
    } catch (err) {
      if (tries > 0) {
        requestAnimationFrame(() => safeChessboard(targetEl, options, onReady, tries - 1));
        return;
      }
      console.warn("puzzle-engine.js: Chessboard init failed", err);
      return;
    }

    if (typeof onReady === "function") onReady(board);
  }

  // ----------------------------------------------------------------------
  // Parsing helpers
  // ----------------------------------------------------------------------
  function stripFigurines(s) {
    return String(s || "").replace(/[♔♕♖♗♘♙♚♛♜♝♞♟]/g, "");
  }

  function parseMovesLine(movesText) {
    return String(movesText || "").trim().split(/\s+/).filter(Boolean);
  }

  function normalizeSAN(san) {
    return String(san || "").replace(/[+#?!]/g, "");
  }

  // ----------------------------------------------------------------------
  // UI helpers
  // ----------------------------------------------------------------------
  function styleStatusRow(row) {
    // hard guarantee: inline, no overlap
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.flexWrap = "wrap";
    row.style.gap = "10px";
  }

  function updateTurn(turnEl, game, solved) {
    if (solved) {
      turnEl.textContent = "";
      return;
    }
    turnEl.textContent = game.turn() === "w" ? "⚐ White to move" : "⚑ Black to move";
  }

  function showCorrect(el) {
    el.textContent = "✅ Correct";
  }
  function showWrong(el) {
    el.textContent = "❌ Wrong";
  }
  function showSolved(el) {
    el.textContent = "🏆 Solved";
  }

  // ----------------------------------------------------------------------
  // Board sync + animation helpers (anti-ghost)
  // ----------------------------------------------------------------------
  function hardSync(board, game) {
    if (!board || !game || typeof board.position !== "function") return;
    board.position(game.fen(), false);
  }

  function isSpecialMove(mv) {
    // chess.js flags: k/q castling, e en passant, p promotion
    const f = String(mv && mv.flags ? mv.flags : "");
    return f.indexOf("k") !== -1 || f.indexOf("q") !== -1 || f.indexOf("e") !== -1 || f.indexOf("p") !== -1;
  }

  function animateAutoMove(board, game, mv) {
    if (!board || !game) return;

    try {
      if (!mv || isSpecialMove(mv) || typeof board.move !== "function") {
        // safest for castle/promo/ep
        board.position(game.fen(), true);
      } else {
        board.move(mv.from + "-" + mv.to);
      }
    } catch {
      try { board.position(game.fen(), true); } catch {}
    }

    // hard-sync after animation window to kill ghosts
    setTimeout(() => hardSync(board, game), 260);
  }

  // ----------------------------------------------------------------------
  // Local puzzle: FEN + Moves
  // Solver is side to move at start.
  // Flow: user plays 1 correct move -> engine plays exactly 1 opponent reply -> user again
  // ----------------------------------------------------------------------
  function renderLocalPuzzle(container, fen, moves) {
    if (!fen || !Array.isArray(moves) || !moves.length) {
      container.textContent = "❌ Invalid local puzzle data.";
      return;
    }

    const game = new Chess(fen);
    const solverSide = game.turn();

    let board = null;
    let moveIndex = 0;
    let solved = false;

    // lock input while opponent reply is being applied
    let locked = false;

    // Layout
    const boardDiv = document.createElement("div");
    boardDiv.className = "jc-board";

    const statusRow = document.createElement("div");
    statusRow.className = "jc-status-row";
    styleStatusRow(statusRow);

    const turnDiv = document.createElement("span");
    turnDiv.className = "jc-turn";

    const feedback = document.createElement("span");
    feedback.className = "jc-feedback";

    statusRow.append(turnDiv, feedback);
    container.append(boardDiv, statusRow);

    function finishSolvedIfDone() {
      if (moveIndex >= moves.length) {
        solved = true;
        showSolved(feedback);
        updateTurn(turnDiv, game, solved);
      }
    }

    function autoReplyOnce() {
      if (solved) return;

      // If already solver turn, unlock
      if (game.turn() === solverSide) {
        locked = false;
        updateTurn(turnDiv, game, solved);
        return;
      }

      // no move left => solved
      if (moveIndex >= moves.length) {
        locked = false;
        finishSolvedIfDone();
        return;
      }

      const san = moves[moveIndex];
      const mv = game.move(san, { sloppy: true });

      if (!mv) {
        // If PGN line ends unexpectedly, treat as solved
        locked = false;
        solved = true;
        showSolved(feedback);
        updateTurn(turnDiv, game, solved);
        return;
      }

      moveIndex++;

      // animate only auto move
      animateAutoMove(board, game, mv);

      // after the animation window, unlock + ensure sync
      setTimeout(() => {
        hardSync(board, game);
        locked = false;
        updateTurn(turnDiv, game, solved);
        finishSolvedIfDone();
      }, 280);
    }

    function onDrop(from, to) {
      if (!board || solved) return "snapback";
      if (locked) return "snapback";
      if (game.turn() !== solverSide) return "snapback"; // user only on solver side

      const expected = moves[moveIndex];
      if (!expected) return "snapback";

      const mv = game.move({ from, to, promotion: "q" });
      if (!mv) return "snapback";

      const ok = normalizeSAN(mv.san) === normalizeSAN(expected);
      if (!ok) {
        game.undo();
        hardSync(board, game);
        showWrong(feedback);
        updateTurn(turnDiv, game, solved);
        return "snapback";
      }

      // correct move
      moveIndex++;
      hardSync(board, game); // kill any desync from drag/drop edge cases
      showCorrect(feedback);

      // lock and reply once
      locked = true;
      updateTurn(turnDiv, game, solved);

      // let chessboard finish rendering the user drop before we reply
      setTimeout(autoReplyOnce, 60);

      return true;
    }

    // init board safely; show turn only when board is ready (together)
    safeChessboard(
      boardDiv,
      {
        draggable: true,
        position: fen,
        pieceTheme: PIECE_THEME,
        onDrop
      },
      (b) => {
        board = b;
        hardSync(board, game);
        updateTurn(turnDiv, game, solved);
      }
    );
  }

  // ----------------------------------------------------------------------
  // Remote PGN URL placeholder (disabled by request)
  // ----------------------------------------------------------------------
  function renderRemotePlaceholder(container, url) {
    const boardDiv = document.createElement("div");
    boardDiv.className = "jc-board";

    const statusRow = document.createElement("div");
    statusRow.className = "jc-status-row";
    styleStatusRow(statusRow);

    const turnDiv = document.createElement("span");
    turnDiv.className = "jc-turn";
    turnDiv.textContent = "";

    const feedback = document.createElement("span");
    feedback.className = "jc-feedback";
    feedback.textContent = "Remote PGN packs are disabled (placeholder).";

    const counter = document.createElement("span");
    counter.className = "jc-counter";
    counter.textContent = "";

    const controls = document.createElement("span");
    controls.className = "jc-controls";
    controls.style.display = "inline-flex";
    controls.style.gap = "8px";
    controls.style.alignItems = "center";

    const prev = document.createElement("button");
    prev.type = "button";
    prev.textContent = "↶";
    prev.disabled = true;

    const next = document.createElement("button");
    next.type = "button";
    next.textContent = "↷";
    next.disabled = true;

    controls.append(prev, next);
    statusRow.append(turnDiv, feedback, counter, controls);
    container.append(boardDiv, statusRow);

    // Show an empty board immediately (so layout is consistent)
    safeChessboard(
      boardDiv,
      {
        draggable: false,
        position: "start",
        pieceTheme: PIECE_THEME
      },
      () => {}
    );

    // Show the URL in a safe way (optional)
    const small = document.createElement("div");
    small.style.fontSize = "0.9em";
    small.style.opacity = "0.8";
    small.textContent = "PGN URL: " + String(url || "");
    container.appendChild(small);
  }

  // ----------------------------------------------------------------------
  // Entry: scan <puzzle> blocks
  // ----------------------------------------------------------------------
  document.addEventListener("DOMContentLoaded", () => {
    const puzzleNodes = Array.from(document.querySelectorAll("puzzle"));

    puzzleNodes.forEach((node) => {
      // IMPORTANT: use textContent; your markdown collapses lines into one line in HTML
      const raw = stripFigurines(node.textContent || "").trim();

      const wrap = document.createElement("div");
      wrap.className = "jc-puzzle-wrapper";
      node.replaceWith(wrap);

      // Remote URL PGN => placeholder
      const pgnUrlMatch = raw.match(/PGN:\s*(https?:\/\/[^\s<]+)/i);
      if (pgnUrlMatch) {
        renderRemotePlaceholder(wrap, pgnUrlMatch[1].trim());
        return;
      }

      // Local FEN + Moves
      const fenMatch = raw.match(/FEN:\s*([^\n<]+?)(?:\s+Moves:|$)/i);
      const movesMatch = raw.match(/Moves:\s*([\s\S]+)$/i);

      if (fenMatch && movesMatch) {
        const fen = fenMatch[1].trim();
        const moves = parseMovesLine(movesMatch[1]);
        renderLocalPuzzle(wrap, fen, moves);
        return;
      }

      wrap.textContent = "❌ Invalid <puzzle> block.";
    });
  });
})();
