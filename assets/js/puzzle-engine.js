// ======================================================================
//   JekyllChess Puzzle Engine
//   - Local <puzzle> blocks (FEN + Moves / inline PGN)
//   - Remote PGN pack (lazy parsing, 20 games per batch)
//   - Drag + TAP-TO-MOVE (desktop + mobile)
//   - Minimal square highlight for tap selection
//   - Feedback: Wrong / Correct / Puzzle solved! 🏆
//   - Lichess-style "side to move" indicator under board
//   - Dragging & tapping disabled after puzzle solved
//   - Mobile scroll fix for dragging
// ======================================================================

document.addEventListener("DOMContentLoaded", () => {
  console.log("Puzzle engine loaded.");

  injectMobileCSS();
  injectTapCSS();
  injectTrophyCSS();

  const puzzleNodes = Array.from(document.querySelectorAll("puzzle"));
  if (puzzleNodes.length === 0) return;

  let remotePackInitialized = false;

  // ============================================================
  // PRIORITY 1 — REMOTE PGN PACK
  // ============================================================
  for (const node of puzzleNodes) {
    if (remotePackInitialized) break;

    const raw = stripFigurines(node.innerHTML || "");
    const pgnUrlMatch = raw.match(/PGN:\s*(https?:\/\/[^\s<]+)/i);
    const fenMatch = raw.match(/FEN:/i);

    if (pgnUrlMatch && !fenMatch) {
      const url = pgnUrlMatch[1].trim();

      const wrapper = document.createElement("div");
      wrapper.style.margin = "20px 0";
      node.replaceWith(wrapper);

      initRemotePackLazy(wrapper, url);
      remotePackInitialized = true;
    }
  }

  // ============================================================
  // PRIORITY 2 — LOCAL PUZZLES
  // ============================================================
  for (const node of puzzleNodes) {
    if (!node.isConnected) continue;

    const raw = stripFigurines(node.innerHTML || "");
    const fenMatch = raw.match(/FEN:\s*([^<\n]+)/i);
    if (!fenMatch) continue;

    const fen = fenMatch[1].trim();

    let sanMoves = null;
    const movesMatch = raw.match(/Moves:\s*([^<\n]+)/i);
    const pgnInlineMatch = raw.match(/PGN:\s*([^<\n]+)/i);

    if (movesMatch) {
      sanMoves = movesMatch[1].trim().split(/\s+/g);
    } else if (pgnInlineMatch) {
      const txt = pgnInlineMatch[1].trim();
      if (!/^https?:\/\//.test(txt)) sanMoves = pgnToSanArray(txt);
    }

    if (!sanMoves || !sanMoves.length) {
      const err = document.createElement("div");
      err.innerHTML = "<div style='color:red'>Invalid puzzle block</div>";
      node.replaceWith(err);
      continue;
    }

    const wrapper = document.createElement("div");
    wrapper.style.margin = "20px 0";
    node.replaceWith(wrapper);

    renderLocalPuzzle(wrapper, fen, sanMoves);
  }
});

// ======================================================================
// CSS INJECTION HELPERS
// ======================================================================

function injectMobileCSS() {
  if (window.__JCPuzzleMobileCSS__) return;
  window.__JCPuzzleMobileCSS__ = true;

  const style = document.createElement("style");
  style.textContent = `
    @media (max-width: 768px) {
      .chessboard-viewport-fix {
        touch-action: none !important;
      }
    }
  `;
  document.head.appendChild(style);
}

function injectTapCSS() {
  if (window.__JCPuzzleTapCSS__) return;
  window.__JCPuzzleTapCSS__ = true;

  const style = document.createElement("style");
  style.textContent = `
    .jc-selected-square {
      outline: 2px solid rgba(60, 132, 255, 0.9);
      outline-offset: -2px;
    }
  `;
  document.head.appendChild(style);
}

function injectTrophyCSS() {
  if (window.__JCPuzzleTrophyCSS__) return;
  window.__JCPuzzleTrophyCSS__ = true;

  const style = document.createElement("style");
  style.textContent = `
    @keyframes jc-trophy-pulse {
      0%   { transform: scale(1);   filter: drop-shadow(0 0 0px gold); }
      50%  { transform: scale(1.15); filter: drop-shadow(0 0 4px gold); }
      100% { transform: scale(1);   filter: drop-shadow(0 0 0px gold); }
    }
    .jc-trophy {
      display: inline-block;
      margin-left: 4px;
      animation: jc-trophy-pulse 1s ease-in-out infinite;
    }
  `;
  document.head.appendChild(style);
}

// ======================================================================
// General helpers
// ======================================================================

function stripFigurines(str) {
  return str.replace(/[♔♕♖♗♘♙]/g, "");
}

function pgnToSanArray(pgn) {
  let s = pgn;
  s = s.replace(/\{[^}]*\}/g, " ");
  s = s.replace(/\([^)]*\)/g, " ");
  s = s.replace(/\b(1-0|0-1|1\/2-1\/2|\*)\b/g, " ");
  s = s.replace(/\d+\.(\.\.)?/g, " ");
  return s.trim().split(/\s+/g).filter(Boolean);
}

function buildUCISolution(fen, sanMoves) {
  const game = new Chess(fen);
  const out = [];
  for (let san of sanMoves) {
    const clean = san.replace(/[!?]/g, "");
    const mv = game.move(clean, { sloppy: true });
    if (!mv) break;
    out.push(mv.from + mv.to + (mv.promotion || ""));
  }
  return out;
}

function setSolvedFeedback(feedbackDiv) {
  feedbackDiv.textContent = "";

  const textSpan = document.createElement("span");
  textSpan.textContent = "Puzzle solved!";

  const trophySpan = document.createElement("span");
  trophySpan.textContent = "🏆";
  trophySpan.className = "jc-trophy";

  feedbackDiv.appendChild(textSpan);
  feedbackDiv.appendChild(trophySpan);
}

// ======================================================================
// Lichess-style indicator
// ======================================================================

function createTurnIndicator() {
  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.alignItems = "center";
  row.style.gap = "6px";
  row.style.marginTop = "4px";
  row.style.fontSize = "15px";
  row.style.fontWeight = "500";
  row.style.fontFamily = "sans-serif";

  const dot = document.createElement("div");
  dot.style.width = "12px";
  dot.style.height = "12px";
  dot.style.borderRadius = "50%";
  dot.style.border = "1px solid #555";

  const label = document.createElement("div");
  label.textContent = "";

  row.append(dot, label);
  return { row, dot, label };
}

function showTurnIndicator(row) {
  row.style.display = "flex";
}

function hideTurnIndicator(row) {
  row.style.display = "none";
}

function updateTurnIndicatorOnly(game, dot, label) {
  if (!game) return;
  if (game.turn() === "w") {
    dot.style.background = "#fff";
    dot.style.border = "1px solid #aaa";
    label.textContent = "White to move";
  } else {
    dot.style.background = "#000";
    dot.style.border = "1px solid #444";
    label.textContent = "Black to move";
  }
}

// ======================================================================
// TAP-TO-MOVE (shared helper)
// ======================================================================

function attachTapToMove(boardDiv, game, handleUserMove, getPuzzleSolved) {
  let selectedSquare = null;

  function clearSelection() {
    const old = boardDiv.querySelector(".jc-selected-square");
    if (old) old.classList.remove("jc-selected-square");
    selectedSquare = null;
  }

  boardDiv.addEventListener("click", (e) => {
    if (getPuzzleSolved()) return;

    const squareEl = e.target.closest(".square-55d63, [data-square]");
    if (!squareEl) return;

    const square =
      squareEl.getAttribute("data-square") ||
      extractSquareFromClass(squareEl.className);
    if (!square) return;

    if (!selectedSquare) {
      // First tap: select source square if it has a piece of side to move
      const piece = game.get(square);
      if (!piece) return;
      if (piece.color !== game.turn()) return;

      squareEl.classList.add("jc-selected-square");
      selectedSquare = square;
      return;
    }

    if (selectedSquare === square) {
      // Tap same square: deselect
      clearSelection();
      return;
    }

    // Second tap: attempt move
    const result = handleUserMove(selectedSquare, square);
    // In both success and failure, clear visual selection and let board redraw
    clearSelection();
  });

  function extractSquareFromClass(className) {
    const m = className.match(/square-([a-h][1-8])/);
    return m ? m[1] : null;
  }

  return {
    clearSelection,
  };
}

// ======================================================================
// LOCAL PUZZLES
// ======================================================================

function renderLocalPuzzle(container, fen, sanMoves) {
  const solutionUCI = buildUCISolution(fen, sanMoves);
  const game = new Chess(fen);
  let step = 0;
  let puzzleSolved = false;

  const boardDiv = document.createElement("div");
  boardDiv.style.width = "350px";
  boardDiv.classList.add("chessboard-viewport-fix");

  const feedbackDiv = document.createElement("div");
  feedbackDiv.style.marginTop = "8px";
  feedbackDiv.style.fontSize = "16px";
  feedbackDiv.style.fontWeight = "600";

  const { row: turnDiv, dot, label } = createTurnIndicator();

  container.append(boardDiv, feedbackDiv, turnDiv);

  const board = Chessboard(boardDiv, {
    draggable: true,
    position: fen,
    pieceTheme:
      "https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png",

    onDragStart: (_, piece) => {
      if (puzzleSolved) return false;

      document.body.style.overflow = "hidden";

      if (game.turn() === "w" && piece.startsWith("b")) return false;
      if (game.turn() === "b" && piece.startsWith("w")) return false;
    },

    onDrop: (src, dst) => {
      const res = handleUserMove(src, dst);
      if (!res) return "snapback";
      return true;
    },

    onSnapEnd: () => {
      board.position(game.fen());
      document.body.style.overflow = "";
    },
  });

  function handleUserMove(src, dst) {
    if (puzzleSolved) return false;

    const mv = game.move({ from: src, to: dst, promotion: "q" });
    if (!mv) return false;

    const played = mv.from + mv.to + (mv.promotion || "");
    const expected = solutionUCI[step];

    if (played !== expected) {
      game.undo();
      feedbackDiv.textContent = "Wrong move";
      updateTurnIndicatorOnly(game, dot, label);
      board.position(game.fen());
      return false;
    }

    step++;
    feedbackDiv.textContent = "Correct move!";
    updateTurnIndicatorOnly(game, dot, label);
    board.position(game.fen());

    if (step < solutionUCI.length) {
      const replySAN = sanMoves[step];
      const reply = game.move(replySAN, { sloppy: true });
      if (reply) step++;
      setTimeout(() => {
        board.position(game.fen());
        updateTurnIndicatorOnly(game, dot, label);
      }, 150);
    }

    if (step >= solutionUCI.length) {
      puzzleSolved = true;
      setSolvedFeedback(feedbackDiv);
      hideTurnIndicator(turnDiv);
    }

    return true;
  }

  showTurnIndicator(turnDiv);
  updateTurnIndicatorOnly(game, dot, label);

  // Tap-to-move hookup
  attachTapToMove(boardDiv, game, handleUserMove, () => puzzleSolved);
}

// ======================================================================
// REMOTE PGN — LAZY LOADING (20 per batch)
// ======================================================================

function initRemotePackLazy(container, url) {
  let games = [];
  let puzzles = [];
  let currentIndex = 0;

  let game = null;
  let board = null;
  let sanMoves = [];
  let solutionUCI = [];
  let step = 0;
  let allParsed = false;
  let puzzleSolved = false;

  const BATCH = 20;

  const infoDiv = document.createElement("div");
  infoDiv.style.marginBottom = "5px";

  const boardDiv = document.createElement("div");
  boardDiv.style.width = "350px";
  boardDiv.classList.add("chessboard-viewport-fix");

  const feedbackDiv = document.createElement("div");
  feedbackDiv.style.marginTop = "8px";
  feedbackDiv.style.fontSize = "16px";
  feedbackDiv.style.fontWeight = "600";

  const { row: turnDiv, dot, label } = createTurnIndicator();

  const controls = document.createElement("div");
  controls.style.display = "flex";
  controls.style.gap = "8px";
  controls.style.marginTop = "10px";

  const prevBtn = document.createElement("button");
  prevBtn.className = "btn btn-sm btn-secondary";
  prevBtn.textContent = "Previous";

  const nextBtn = document.createElement("button");
  nextBtn.className = "btn btn-sm btn-secondary";
  nextBtn.textContent = "Next";

  controls.append(prevBtn, nextBtn);
  container.append(infoDiv, boardDiv, feedbackDiv, turnDiv, controls);

  feedbackDiv.textContent = "Loading puzzle pack…";

  fetch(url)
    .then((r) => r.text())
    .then((text) => {
      games = text.replace(/\r/g, "").split(/(?=\[Event\b)/g).filter(Boolean);
      parseBatch(0);
    })
    .catch(() => (feedbackDiv.textContent = "Failed to load PGN."));

  function parseOne(txt) {
    const fenMatch = txt.match(/\[FEN\s+"([^"]+)"\]/i);
    if (!fenMatch) return null;

    const fen = fenMatch[1].trim();
    let moves = [];

    const tag = txt.match(/\[(Moves|Solution)\s+"([^"]+)"\]/i);
    if (tag) moves = pgnToSanArray(tag[2]);
    else moves = pgnToSanArray(txt.replace(/\[[^\]]+\]/g, " "));

    if (!moves.length) return null;
    return { fen, moves };
  }

  function parseBatch(start) {
    const end = Math.min(start + BATCH, games.length);

    for (let i = start; i < end; i++) {
      const p = parseOne(games[i]);
      if (p) puzzles.push(p);
    }

    infoDiv.textContent = `Loaded ${puzzles.length} puzzle(s)…`;

    if (!board && puzzles.length) {
      initBoard();
      loadPuzzle(0);
    }

    if (end < games.length) {
      setTimeout(() => parseBatch(end), 0);
    } else {
      allParsed = true;
    }
  }

  function initBoard() {
    board = Chessboard(boardDiv, {
      draggable: true,
      pieceTheme:
        "https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png",

      onDragStart: (_, piece) => {
        if (puzzleSolved) return false;

        document.body.style.overflow = "hidden";

        if (game.turn() === "w" && piece.startsWith("b")) return false;
        if (game.turn() === "b" && piece.startsWith("w")) return false;
      },

      onDrop: (src, dst) => {
        const res = handleUserMove(src, dst);
        if (!res) return "snapback";
        return true;
      },

      onSnapEnd: () => {
        board.position(game.fen());
        document.body.style.overflow = "";
      },
    });

    prevBtn.onclick = () => {
      if (!puzzles.length) return;

      currentIndex =
        currentIndex > 0
          ? currentIndex - 1
          : allParsed
          ? puzzles.length - 1
          : 0;

      loadPuzzle(currentIndex);
    };

    nextBtn.onclick = () => {
      if (!puzzles.length) return;

      if (currentIndex + 1 < puzzles.length) {
        currentIndex++;
        loadPuzzle(currentIndex);
      } else if (!allParsed) {
        feedbackDiv.textContent = "Loading more puzzles…";
      } else {
        currentIndex = 0;
        loadPuzzle(0);
      }
    };

    // Tap-to-move hookup (remote board shares same boardDiv)
    attachTapToMove(boardDiv, game, handleUserMove, () => puzzleSolved);
  }

  function handleUserMove(src, dst) {
    if (puzzleSolved) return false;

    const mv = game.move({ from: src, to: dst, promotion: "q" });
    if (!mv) return false;

    const played = mv.from + mv.to + (mv.promotion || "");
    const expected = solutionUCI[step];

    if (played !== expected) {
      game.undo();
      feedbackDiv.textContent = "Wrong move";
      updateTurnIndicatorOnly(game, dot, label);
      board.position(game.fen());
      return false;
    }

    step++;
    feedbackDiv.textContent = "Correct move!";
    updateTurnIndicatorOnly(game, dot, label);
    board.position(game.fen());

    if (step < solutionUCI.length) {
      const replySAN = sanMoves[step];
      const rep = game.move(replySAN, { sloppy: true });
      if (rep) step++;
      setTimeout(() => {
        board.position(game.fen());
        updateTurnIndicatorOnly(game, dot, label);
      }, 150);
    }

    if (step >= solutionUCI.length) {
      puzzleSolved = true;
      setSolvedFeedback(feedbackDiv);
      hideTurnIndicator(turnDiv);
    }

    return true;
  }

  function loadPuzzle(i) {
    const p = puzzles[i];
    if (!p) return;

    game = new Chess(p.fen);
    sanMoves = p.moves;
    solutionUCI = buildUCISolution(p.fen, sanMoves);
    step = 0;
    puzzleSolved = false;

    board.position(p.fen());
    feedbackDiv.textContent = "";
    showTurnIndicator(turnDiv);
    updateTurnIndicatorOnly(game, dot, label);
  }
}
