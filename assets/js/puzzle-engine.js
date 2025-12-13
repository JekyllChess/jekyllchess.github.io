// ======================================================================
// JekyllChess Puzzle Engine — patched
// - Fixes turn display on load
// - Auto-plays ONLY opponent replies
// - Animates ONLY auto-played moves
// - Hard-syncs board after animation to prevent ghost pieces/captures
// - Supports remote PGN packs with loading board shown immediately
// - Keeps status row inline (no overlap)
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
  // Chessboard error 1003 fix: init only when element has layout
  // ----------------------------------------------------------------------
  function safeChessboard(targetEl, options, tries = 60) {
    if (!targetEl) {
      if (tries > 0) requestAnimationFrame(() => safeChessboard(targetEl, options, tries - 1));
      return null;
    }

    const rect = targetEl.getBoundingClientRect();
    if ((rect.width <= 0 || rect.height <= 0) && tries > 0) {
      requestAnimationFrame(() => safeChessboard(targetEl, options, tries - 1));
      return null;
    }

    try {
      return Chessboard(targetEl, options);
    } catch (err) {
      // intermittent layout timing → retry a bit
      if (tries > 0) {
        requestAnimationFrame(() => safeChessboard(targetEl, options, tries - 1));
        return null;
      }
      console.warn("puzzle-engine.js: Chessboard init failed", err);
      return null;
    }
  }

  // ----------------------------------------------------------------------
  // Parsing helpers
  // ----------------------------------------------------------------------
  function stripFigurines(s) {
    // keep plain text; remove unicode chess pieces
    return String(s || "").replace(/[♔♕♖♗♘♙♚♛♜♝♞♟]/g, "");
  }

  function normalizeSAN(san) {
    // compare move intent, ignore punctuation
    return String(san || "").replace(/[+#?!]/g, "");
  }

  function parseMovesLine(movesText) {
    return String(movesText || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
  }

  function parsePGNMoves(pgn) {
    // tolerant: strip headers/comments/vars/move numbers/results
    return String(pgn || "")
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

  // ----------------------------------------------------------------------
  // UI helpers
  // ----------------------------------------------------------------------
  function showCorrect(el) {
    el.innerHTML = `✅ <span class="jc-icon">Correct</span>`;
  }
  function showWrong(el) {
    el.innerHTML = `❌ <span class="jc-icon">Wrong</span>`;
  }
  function showSolved(el) {
    el.innerHTML = `🏆 <span class="jc-icon">Solved</span>`;
  }

  function updateTurn(turnEl, game, solved) {
    if (solved) {
      turnEl.textContent = "";
      return;
    }
    turnEl.textContent = game.turn() === "w" ? "⚐ White to move" : "⚑ Black to move";
  }

  function styleStatusRow(row) {
    // prevent overlap regardless of theme CSS
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.flexWrap = "wrap";
    row.style.gap = "10px";
  }

  // ----------------------------------------------------------------------
  // Local puzzle: FEN + Moves
  // Behavior: user plays solver side moves; engine auto-plays opponent replies only
  // ----------------------------------------------------------------------
  function renderLocalPuzzle(container, fen, allMoves) {
    if (!fen || !Array.isArray(allMoves) || !allMoves.length) {
      container.textContent = "❌ Invalid local puzzle data.";
      return;
    }

    const game = new Chess(fen);
    const solverSide = game.turn(); // side to move at start is solver

    let moveIndex = 0;
    let solved = false;
    let awaitingUser = true; // solver turn input gate

    // --- layout
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

    // show turn immediately (even before board is ready)
    updateTurn(turnDiv, game, solved);

    // --- init board safely
    let board = null;

    board = safeChessboard(boardDiv, {
      draggable: true,
      position: fen,
      pieceTheme: PIECE_THEME,
      onDrop: (from, to) => (playUserMove(from, to) ? true : "snapback")
    });

    function hardSync() {
      if (!board || typeof board.position !== "function") return;
      board.position(game.fen(), false);
    }

    function animateAutoMove(mv) {
      // animate only auto-played moves; then hard-sync to prevent ghost captures
      if (!board) return;

      try {
        if (mv && mv.from && mv.to && typeof board.move === "function") {
          board.move(mv.from + "-" + mv.to);
        } else {
          board.position(game.fen(), true);
        }
      } catch {
        // fallback
        try { board.position(game.fen(), true); } catch {}
      }

      // hard sync after animation frame(s)
      setTimeout(hardSync, 240);
    }

    function playUserMove(from, to) {
      if (solved) return false;

      // gate: only allow input on solver turn
      if (!awaitingUser) return false;
      if (game.turn() !== solverSide) return false;

      const expected = allMoves[moveIndex];
      if (!expected) return false;

      const mv = game.move({ from, to, promotion: "q" });
      if (!mv) return false;

      // ensure board never desyncs on user move as well
      // (user move isn't animated by us; chessboard handles it, but we hard sync anyway)
      const ok = normalizeSAN(mv.san) === normalizeSAN(expected);
      if (!ok) {
        game.undo();
        hardSync();
        showWrong(feedback);
        updateTurn(turnDiv, game, solved);
        return false;
      }

      moveIndex++;
      hardSync();

      showCorrect(feedback);

      // after a correct solver move, immediately auto-play exactly one opponent reply
      awaitingUser = false;
      updateTurn(turnDiv, game, solved);
      autoPlayOpponentReply();

      return true;
    }

    function autoPlayOpponentReply() {
      if (solved) return;

      // if we are already back to solver turn, just unlock
      if (game.turn() === solverSide) {
        awaitingUser = true;
        updateTurn(turnDiv, game, solved);
        return;
      }

      // if no move left, solved
      if (moveIndex >= allMoves.length) {
        solved = true;
        showSolved(feedback);
        updateTurn(turnDiv, game, solved);
        return;
      }

      const san = allMoves[moveIndex];

      // play opponent move with chess.js
      const mv = game.move(san, { sloppy: true });

      if (!mv) {
        // if PGN line ends early, consider solved
        solved = true;
        showSolved(feedback);
        updateTurn(turnDiv, game, solved);
        return;
      }

      moveIndex++;

      // animate only this auto move, then hard sync
      animateAutoMove(mv);

      // now it should be solver turn again; unlock user
      awaitingUser = true;
      updateTurn(turnDiv, game, solved);

      // if line is finished after reply
      if (moveIndex >= allMoves.length) {
        solved = true;
        showSolved(feedback);
        updateTurn(turnDiv, game, solved);
      }
    }

    // If board init is delayed due to layout, make sure first hard sync happens when ready
    (function waitBoard() {
      if (board && typeof board.position === "function") {
        hardSync();
        updateTurn(turnDiv, game, solved);
      } else {
        requestAnimationFrame(waitBoard);
      }
    })();
  }

  // ----------------------------------------------------------------------
  // Remote PGN pack: <puzzle> PGN: https://...
  // Loads an empty board immediately while fetching
  // ----------------------------------------------------------------------
  function initRemotePGNPack(container, url) {
    // --- layout
    const boardDiv = document.createElement("div");
    boardDiv.className = "jc-board";

    const statusRow = document.createElement("div");
    statusRow.className = "jc-status-row";
    styleStatusRow(statusRow);

    const turnDiv = document.createElement("span");
    turnDiv.className = "jc-turn";

    const feedback = document.createElement("span");
    feedback.className = "jc-feedback";

    const counter = document.createElement("span");
    counter.className = "jc-counter";

    const controls = document.createElement("span");
    controls.className = "jc-controls";
    controls.style.display = "inline-flex";
    controls.style.gap = "8px";
    controls.style.alignItems = "center";

    const prev = document.createElement("button");
    prev.type = "button";
    prev.textContent = "↶";

    const next = document.createElement("button");
    next.type = "button";
    next.textContent = "↷";

    controls.append(prev, next);
    statusRow.append(turnDiv, feedback, counter, controls);
    container.append(boardDiv, statusRow);

    // show loading immediately + empty board ready
    feedback.textContent = "Loading puzzle pack…";
    counter.textContent = "";

    let board = null;
    board = safeChessboard(boardDiv, {
      draggable: true,
      position: "start",
      pieceTheme: PIECE_THEME,
      onDrop: (from, to) => (playUserMove(from, to) ? true : "snapback")
    });

    let puzzles = [];
    let puzzleIndex = 0;

    let game = null;
    let allMoves = null;
    let solverSide = null;
    let moveIndex = 0;
    let solved = false;
    let awaitingUser = true;

    function hardSync() {
      if (!board || typeof board.position !== "function" || !game) return;
      board.position(game.fen(), false);
    }

    function animateAutoMove(mv) {
      if (!board) return;
      try {
        if (mv && mv.from && mv.to && typeof board.move === "function") {
          board.move(mv.from + "-" + mv.to);
        } else {
          board.position(game.fen(), true);
        }
      } catch {
        try { board.position(game.fen(), true); } catch {}
      }
      setTimeout(hardSync, 240);
    }

    function updateUI() {
      if (!game) {
        turnDiv.textContent = "";
        return;
      }
      counter.textContent = `Puzzle ${puzzleIndex + 1} / ${puzzles.length}`;
      updateTurn(turnDiv, game, solved);
    }

    function loadPuzzle(i) {
      if (i < 0 || i >= puzzles.length) return;

      puzzleIndex = i;
      game = new Chess(puzzles[i].fen);
      allMoves = puzzles[i].moves;
      solverSide = game.turn();
      moveIndex = 0;
      solved = false;
      awaitingUser = true;

      feedback.textContent = "";
      hardSync();
      updateUI();
    }

    function playUserMove(from, to) {
      if (!game || !allMoves) return false;
      if (solved) return false;
      if (!awaitingUser) return false;
      if (game.turn() !== solverSide) return false;

      const expected = allMoves[moveIndex];
      if (!expected) return false;

      const mv = game.move({ from, to, promotion: "q" });
      if (!mv) return false;

      const ok = normalizeSAN(mv.san) === normalizeSAN(expected);
      if (!ok) {
        game.undo();
        hardSync();
        showWrong(feedback);
        updateUI();
        return false;
      }

      moveIndex++;
      hardSync();
      showCorrect(feedback);

      awaitingUser = false;
      updateUI();
      autoPlayOpponentReply();

      return true;
    }

    function autoPlayOpponentReply() {
      if (!game || solved) return;

      if (game.turn() === solverSide) {
        awaitingUser = true;
        updateUI();
        return;
      }

      if (moveIndex >= allMoves.length) {
        solved = true;
        showSolved(feedback);
        updateUI();
        return;
      }

      const san = allMoves[moveIndex];
      const mv = game.move(san, { sloppy: true });

      if (!mv) {
        solved = true;
        showSolved(feedback);
        updateUI();
        return;
      }

      moveIndex++;
      animateAutoMove(mv);

      awaitingUser = true;
      updateUI();

      if (moveIndex >= allMoves.length) {
        solved = true;
        showSolved(feedback);
        updateUI();
      }
    }

    prev.addEventListener("click", () => loadPuzzle(puzzleIndex - 1));
    next.addEventListener("click", () => loadPuzzle(puzzleIndex + 1));

    // fetch + parse
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      })
      .then((txt) => {
        // split into games; accept broad PGN formats
        const games = txt.split(/\n(?=\[Event\b)/g).filter(Boolean);

        puzzles = [];
        for (const g of games) {
          const fen = g.match(/\[FEN\s+"([^"]+)"/i)?.[1];
          if (!fen) continue;
          const moves = parsePGNMoves(g);
          if (moves.length) puzzles.push({ fen, moves });
        }

        if (!puzzles.length) {
          feedback.textContent = "❌ No puzzles found in PGN.";
          return;
        }

        // wait for board readiness before first load (prevents 1003 + ensures display)
        (function startWhenReady() {
          if (board && typeof board.position === "function") {
            loadPuzzle(0);
          } else {
            requestAnimationFrame(startWhenReady);
          }
        })();
      })
      .catch((err) => {
        console.error("Remote PGN load failed:", err);
        feedback.textContent = "❌ Failed to load PGN (" + err.message + ")";
      });
  }

  // ----------------------------------------------------------------------
  // Entry: scan <puzzle> blocks
  // ----------------------------------------------------------------------
  document.addEventListener("DOMContentLoaded", () => {
    const puzzleNodes = Array.from(document.querySelectorAll("puzzle"));
    let remoteUsed = false;

    puzzleNodes.forEach((node) => {
      const raw = stripFigurines(node.textContent || node.innerText || node.innerHTML || "").trim();

      const wrap = document.createElement("div");
      wrap.className = "jc-puzzle-wrapper";
      node.replaceWith(wrap);

      const pgnUrlMatch = raw.match(/PGN:\s*(https?:\/\/[^\s<]+)/i);
      if (pgnUrlMatch) {
        if (remoteUsed) {
          wrap.textContent = "⚠️ Only one remote PGN pack allowed per page.";
          return;
        }
        remoteUsed = true;
        initRemotePGNPack(wrap, pgnUrlMatch[1].trim());
        return;
      }

      const fenMatch = raw.match(/FEN:\s*([^\n<]+)/i);
      const movesMatch = raw.match(/Moves:\s*([^\n<]+)/i);
      const pgnInlineMatch = raw.match(/PGN:\s*(1\.[\s\S]+)/i);

      if (fenMatch && pgnInlineMatch) {
        const fen = fenMatch[1].trim();
        const allMoves = parsePGNMoves(pgnInlineMatch[1]);
        renderLocalPuzzle(wrap, fen, allMoves);
        return;
      }

      if (fenMatch && movesMatch) {
        const fen = fenMatch[1].trim();
        const allMoves = parseMovesLine(movesMatch[1]);
        renderLocalPuzzle(wrap, fen, allMoves);
        return;
      }

      wrap.textContent = "❌ Invalid <puzzle> block.";
    });

    // expose for manual reruns
    window.JekyllChessPuzzle = { run: () => {} };
  });
})();
