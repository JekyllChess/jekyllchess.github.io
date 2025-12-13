// ======================================================================
// JekyllChess Puzzle Engine — patched + stable
// - User plays solver side only (side-to-move in FEN)
// - After correct user move, engine auto-plays ONLY opponent move
// - Auto moves animate ONLY (user moves do not animate)
// - Fixes ghost pieces by using board.move(from-to) + hard-sync board.position(fen,false)
// - safeChessboard() prevents Chessboard error 1003
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

  const PIECE_THEME =
    "https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png";

  // ----------------------------------------------------------------------
  // Chessboard 1003 prevention: init only when element is laid out
  // ----------------------------------------------------------------------
  function safeChessboard(targetEl, options, tries = 40) {
    const el = targetEl;
    if (!el) {
      if (tries > 0) requestAnimationFrame(() => safeChessboard(targetEl, options, tries - 1));
      return null;
    }

    const rect = el.getBoundingClientRect();
    if ((rect.width <= 0 || rect.height <= 0) && tries > 0) {
      requestAnimationFrame(() => safeChessboard(targetEl, options, tries - 1));
      return null;
    }

    try {
      return Chessboard(el, options);
    } catch (err) {
      if (tries > 0) {
        requestAnimationFrame(() => safeChessboard(targetEl, options, tries - 1));
        return null;
      }
      console.warn("puzzle-engine.js: Chessboard init failed", err);
      return null;
    }
  }

  // ----------------------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------------------
  function stripFigurines(s) {
    return (s || "").replace(/[♔♕♖♗♘♙♚♛♜♝♞♟]/g, "");
  }

  function parsePGNMoves(pgn) {
    return (pgn || "")
      .replace(/\[[^\]]*\]/g, " ")
      .replace(/\{[^}]*\}/g, " ")
      .replace(/\([^)]*\)/g, " ")
      .replace(/\b\d+\.\.\./g, " ")
      .replace(/\b\d+\.(?:\.\.)?/g, " ")
      .replace(/\b(1-0|0-1|1\/2-1\/2|½-½|\*)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean);
  }

  function normalizeSAN(san) {
    return (san || "").replace(/[+#?!]/g, "");
  }

  // ----------------------------------------------------------------------
  // UI helpers
  // ----------------------------------------------------------------------
  function showCorrect(el) {
    el.innerHTML = `✅ Correct`;
  }
  function showWrong(el) {
    el.innerHTML = `❌ Wrong`;
  }
  function showSolved(el) {
    el.innerHTML = `🏆 Solved`;
  }

  function updateTurn(el, game, solved) {
    if (solved) {
      el.textContent = "";
      return;
    }
    el.textContent = game.turn() === "w" ? "⚐ White to move" : "⚑ Black to move";
  }

  function setStatusRowLayout(row) {
    // prevents overlap even if CSS is missing
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.gap = "10px";
    row.style.flexWrap = "wrap";
  }

  // ----------------------------------------------------------------------
  // Local puzzle: FEN + Moves (or inline PGN moves)
  // ----------------------------------------------------------------------
  function renderLocalPuzzle(container, fen, allMoves) {
    const game = new Chess(fen);

    // side-to-move in FEN is the "solver side" (the user)
    const solverSide = game.turn();

    let moveIndex = 0; // index into allMoves[]
    let solved = false;
    let lock = false; // prevents double move during async auto reply

    // --- UI
    const boardDiv = document.createElement("div");
    boardDiv.className = "jc-board";

    const statusRow = document.createElement("div");
    statusRow.className = "jc-status-row";
    setStatusRowLayout(statusRow);

    const turnDiv = document.createElement("span");
    turnDiv.className = "jc-turn";

    const feedback = document.createElement("span");
    feedback.className = "jc-feedback";

    statusRow.append(turnDiv, feedback);
    container.append(boardDiv, statusRow);

    // --- Board
    let board = null;

    function hardSync() {
      if (!board || typeof board.position !== "function") return;
      // Hard sync prevents ghost pieces after any animation/capture edge cases
      board.position(game.fen(), false);
    }

    function animateMoveFromChessMove(mv) {
      if (!board || typeof board.move !== "function") return;

      // Animate using from-to (handles captures reliably in chessboard.js)
      const uci = mv.from + "-" + mv.to;
      try {
        board.move(uci);
      } catch {
        // fallback if move() fails for any reason
        board.position(game.fen(), true);
      }

      // Immediately hard-sync after animation tick to ensure perfect board state
      requestAnimationFrame(hardSync);
    }

    function autoOpponentReplyIfNeeded() {
      if (solved) return;
      if (moveIndex >= allMoves.length) {
        solved = true;
        showSolved(feedback);
        updateTurn(turnDiv, game, solved);
        return;
      }

      // If it's solver's turn again, wait for user
      if (game.turn() === solverSide) {
        updateTurn(turnDiv, game, solved);
        return;
      }

      // It's opponent's turn: auto-play exactly ONE move
      const san = allMoves[moveIndex];
      lock = true;

      setTimeout(() => {
        let mv = null;
        try {
          mv = game.move(san, { sloppy: true });
        } catch {
          mv = null;
        }

        if (!mv) {
          // If PGN pack is inconsistent, end safely
          solved = true;
          showSolved(feedback);
          updateTurn(turnDiv, game, solved);
          lock = false;
          return;
        }

        moveIndex++;

        // ✅ Animate ONLY auto move
        animateMoveFromChessMove(mv);

        updateTurn(turnDiv, game, solved);
        lock = false;

        // Now it should be solver's turn again (most tactics alternate)
      }, 150);
    }

    function playUserMove(src, dst) {
      if (solved || lock) return false;

      // User is only allowed to move solver side
      if (game.turn() !== solverSide) return false;

      const expected = allMoves[moveIndex];
      if (!expected) return false;

      let mv = null;
      try {
        mv = game.move({ from: src, to: dst, promotion: "q" });
      } catch {
        mv = null;
      }
      if (!mv) return false;

      // Validate against expected SAN
      if (normalizeSAN(mv.san) !== normalizeSAN(expected)) {
        game.undo();
        hardSync(); // ensure drag-drop visual matches real state
        showWrong(feedback);
        updateTurn(turnDiv, game, solved);
        return false;
      }

      // Correct move
      moveIndex++;
      hardSync(); // ensure capture visuals are exact (no animation for user moves)
      showCorrect(feedback);
      updateTurn(turnDiv, game, solved);

      // Auto-play ONE opponent reply
      autoOpponentReplyIfNeeded();
      return true;
    }

    board = safeChessboard(boardDiv, {
      draggable: true,
      position: fen,
      pieceTheme: PIECE_THEME,
      onDrop: (s, t) => (playUserMove(s, t) ? true : "snapback")
    });

    // Wait until board exists, then sync once
    const boot = () => {
      if (board && typeof board.position === "function") {
        hardSync();
        showCorrect(feedback); // optional: start neutral; you can set to "" if you prefer
        feedback.textContent = "";
        updateTurn(turnDiv, game, solved);
      } else {
        requestAnimationFrame(boot);
      }
    };
    boot();
  }

  // ----------------------------------------------------------------------
  // Remote PGN pack loader (optional)
  // NOTE: your current report is that remote was failing; we'll keep it robust.
  // ----------------------------------------------------------------------
  function initRemotePGNPackLazy(container, url) {
    // UI
    const boardDiv = document.createElement("div");
    boardDiv.className = "jc-board";

    const statusRow = document.createElement("div");
    statusRow.className = "jc-status-row";
    setStatusRowLayout(statusRow);

    const turnDiv = document.createElement("span");
    turnDiv.className = "jc-turn";

    const feedback = document.createElement("span");
    feedback.className = "jc-feedback";

    const counter = document.createElement("span");
    counter.className = "jc-counter";

    const controls = document.createElement("span");
    controls.className = "jc-controls";

    const prev = document.createElement("button");
    prev.type = "button";
    prev.textContent = "↶";

    const next = document.createElement("button");
    next.type = "button";
    next.textContent = "↷";

    controls.append(prev, next);
    statusRow.append(turnDiv, feedback, counter, controls);
    container.append(boardDiv, statusRow);

    // While loading pack, show an empty board immediately
    let board = safeChessboard(boardDiv, {
      draggable: true,
      position: "start",
      pieceTheme: PIECE_THEME
    });

    feedback.textContent = "Loading puzzle pack…";
    counter.textContent = "";

    let puzzles = [];
    let puzzleIndex = 0;

    // per-puzzle state
    let game = null;
    let allMoves = null;
    let solverSide = null;
    let moveIndex = 0;
    let solved = false;
    let lock = false;

    function hardSync() {
      if (!board || typeof board.position !== "function" || !game) return;
      board.position(game.fen(), false);
    }

    function animateMoveFromChessMove(mv) {
      if (!board || typeof board.move !== "function") return;
      const uci = mv.from + "-" + mv.to;
      try {
        board.move(uci);
      } catch {
        board.position(game.fen(), true);
      }
      requestAnimationFrame(hardSync);
    }

    function updateUI() {
      if (puzzles.length) counter.textContent = `Puzzle ${puzzleIndex + 1} / ${puzzles.length}`;
      else counter.textContent = "";
      updateTurn(turnDiv, game || { turn: () => "w" }, solved);
    }

    function loadPuzzle(i) {
      if (i < 0 || i >= puzzles.length) return;

      puzzleIndex = i;
      game = new Chess(puzzles[i].fen);
      allMoves = puzzles[i].all;
      solverSide = game.turn();
      moveIndex = 0;
      solved = false;
      lock = false;

      feedback.textContent = "";
      hardSync();
      updateUI();
    }

    function autoOpponentReplyIfNeeded() {
      if (solved || lock) return;
      if (!game || !allMoves) return;

      if (moveIndex >= allMoves.length) {
        solved = true;
        showSolved(feedback);
        updateUI();
        return;
      }

      if (game.turn() === solverSide) {
        updateUI();
        return;
      }

      const san = allMoves[moveIndex];
      lock = true;

      setTimeout(() => {
        let mv = null;
        try {
          mv = game.move(san, { sloppy: true });
        } catch {
          mv = null;
        }

        if (!mv) {
          solved = true;
          showSolved(feedback);
          updateUI();
          lock = false;
          return;
        }

        moveIndex++;
        animateMoveFromChessMove(mv);
        updateUI();
        lock = false;
      }, 150);
    }

    function playUserMove(src, dst) {
      if (solved || lock) return false;
      if (!game || !allMoves) return false;

      if (game.turn() !== solverSide) return false;

      const expected = allMoves[moveIndex];
      if (!expected) return false;

      let mv = null;
      try {
        mv = game.move({ from: src, to: dst, promotion: "q" });
      } catch {
        mv = null;
      }
      if (!mv) return false;

      if (normalizeSAN(mv.san) !== normalizeSAN(expected)) {
        game.undo();
        hardSync();
        showWrong(feedback);
        updateUI();
        return false;
      }

      moveIndex++;
      hardSync();
      showCorrect(feedback);
      updateUI();

      autoOpponentReplyIfNeeded();
      return true;
    }

    // attach drop only after puzzles loaded (but board already exists)
    function attachDropHandler() {
      if (!board) return;
      try {
        // Rebuild board with onDrop (chessboard.js doesn't let you set onDrop after init reliably)
        board = safeChessboard(boardDiv, {
          draggable: true,
          position: game ? game.fen() : "start",
          pieceTheme: PIECE_THEME,
          onDrop: (s, t) => (playUserMove(s, t) ? true : "snapback")
        });
      } catch {}
    }

    prev.onclick = () => loadPuzzle(puzzleIndex - 1);
    next.onclick = () => loadPuzzle(puzzleIndex + 1);

    fetch(url)
      .then(r => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      })
      .then(txt => {
        // Robust PGN splitting: games start at [Event ...]
        const games = txt.split(/\[Event\b/).slice(1).map(g => "[Event" + g);

        puzzles = [];
        for (const g of games) {
          const fen = g.match(/\[FEN\s+"([^"]+)"/i)?.[1];
          if (!fen) continue;
          const all = parsePGNMoves(g);
          if (all.length) puzzles.push({ fen, all });
        }

        if (!puzzles.length) {
          feedback.textContent = "❌ No puzzles found in PGN.";
          return;
        }

        // init first puzzle
        loadPuzzle(0);
        attachDropHandler();
        updateUI();
      })
      .catch(err => {
        console.error("Remote PGN load failed:", err);
        feedback.textContent = "❌ Failed to load PGN (" + err.message + ")";
      });
  }

  // ----------------------------------------------------------------------
  // Init: parse <puzzle> blocks
  // ----------------------------------------------------------------------
  document.addEventListener("DOMContentLoaded", () => {
    const puzzleNodes = Array.from(document.querySelectorAll("puzzle"));
    let remoteUsed = false;

    puzzleNodes.forEach(node => {
      // Use textContent so markdown/HTML collapses still parse correctly
      const raw = stripFigurines(node.textContent || "").trim();

      const wrap = document.createElement("div");
      wrap.className = "jc-puzzle-wrapper";
      node.replaceWith(wrap);

      // Accept both newline and single-line formatting
      const fenMatch = raw.match(/FEN:\s*([^\n]+)(?:\n|$)/i);
      const movesMatch = raw.match(/Moves:\s*([^\n]+)(?:\n|$)/i);
      const pgnUrlMatch = raw.match(/PGN:\s*(https?:\/\/\S+)/i);
      const pgnInlineMatch = raw.match(/PGN:\s*(1\.[\s\S]+)/i);

      // Remote pack: PGN: https://...
      if (pgnUrlMatch && !fenMatch) {
        if (remoteUsed) {
          wrap.textContent = "⚠️ Only one remote PGN pack allowed per page.";
          return;
        }
        remoteUsed = true;
        initRemotePGNPackLazy(wrap, pgnUrlMatch[1].trim());
        return;
      }

      // Local from inline PGN
      if (fenMatch && pgnInlineMatch) {
        const allMoves = parsePGNMoves(pgnInlineMatch[1]);
        if (!allMoves.length) {
          wrap.textContent = "❌ Invalid <puzzle> block (no moves).";
          return;
        }
        renderLocalPuzzle(wrap, fenMatch[1].trim(), allMoves);
        return;
      }

      // Local from Moves:
      if (fenMatch && movesMatch) {
        const moves = movesMatch[1].trim().split(/\s+/).filter(Boolean);
        if (!moves.length) {
          wrap.textContent = "❌ Invalid <puzzle> block (no moves).";
          return;
        }
        renderLocalPuzzle(wrap, fenMatch[1].trim(), moves);
        return;
      }

      wrap.textContent = "❌ Invalid <puzzle> block.";
    });
  });
})();
