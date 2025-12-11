// ======================================================================
//   JekyllChess Puzzle Engine (FULL FILE, LAZY REMOTE PARSING)
//   - Multiple <puzzle> blocks → one board each
//   - ONE remote PGN pack per page → single-board trainer
//   - Supports:
//       FEN + Moves
//       FEN + inline PGN
//       Remote PGN (multi-game)
//   - Lazy background parsing (20 puzzles per batch)
//   - Lichess-style turn indicator ● (NOW BELOW THE BOARD)
//   - “Your move…” removed completely
// ======================================================================

document.addEventListener("DOMContentLoaded", () => {
  console.log("Puzzle engine loaded.");

  const puzzleNodes = Array.from(document.querySelectorAll("puzzle"));
  if (puzzleNodes.length === 0) return;

  let remotePackInitialized = false;

  // ============================================================
  // PRIORITY 1: REMOTE PGN PACK
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
  // PRIORITY 2: LOCAL PUZZLES
  // ============================================================
  for (const node of puzzleNodes) {
    if (!node.isConnected) continue;

    const raw = stripFigurines(node.innerHTML || "");
    const fenMatch = raw.match(/FEN:\s*([^<\n\r]+)/i);
    if (!fenMatch) continue;

    const fen = fenMatch[1].trim();
    let sanMoves = null;

    const movesMatch = raw.match(/Moves:\s*([^<\n\r]+)/i);
    const pgnInlineMatch = raw.match(/PGN:\s*([^<\n\r]+)/i);

    if (movesMatch) {
      sanMoves = movesMatch[1].trim().split(/\s+/g);
    } else if (pgnInlineMatch) {
      const txt = pgnInlineMatch[1].trim();
      if (!/^https?:\/\//i.test(txt)) sanMoves = pgnToSanArray(txt);
    }

    if (!sanMoves || sanMoves.length === 0) {
      const w = document.createElement("div");
      w.style.margin = "20px 0";
      w.innerHTML = "<div style='color:red'>Invalid puzzle block.</div>";
      node.replaceWith(w);
      continue;
    }

    const wrapper = document.createElement("div");
    wrapper.style.margin = "20px 0";
    node.replaceWith(wrapper);

    renderLocalPuzzle(wrapper, fen, sanMoves);
  }
});

// ======================================================================
// Utility helpers
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
    const clean = san.replace(/[!?]/g, "").trim();
    const mv = game.move(clean, { sloppy: true });
    if (!mv) break;
    out.push(mv.from + mv.to + (mv.promotion || ""));
  }
  return out;
}

// ======================================================================
// Lichess-style turn indicator (NOW BELOW BOARD)
// ======================================================================
function createTurnIndicator() {
  const wrap = document.createElement("div");
  wrap.style.display = "flex";
  wrap.style.alignItems = "center";
  wrap.style.gap = "6px";
  wrap.style.marginTop = "8px";
  wrap.style.fontSize = "15px";
  wrap.style.fontWeight = "500";
  wrap.style.fontFamily = "sans-serif";

  const dot = document.createElement("div");
  dot.style.width = "12px";
  dot.style.height = "12px";
  dot.style.borderRadius = "50%";
  dot.style.border = "1px solid #555";
  dot.style.transition = "all 0.15s ease";

  const label = document.createElement("div");
  label.textContent = "Loading…";

  wrap.append(dot, label);

  return { wrap, dot, label };
}

function updateTurnIndicator(game, dot, label) {
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
// LOCAL PUZZLES
// ======================================================================
function renderLocalPuzzle(container, fen, sanMoves) {
  const solutionUCI = buildUCISolution(fen, sanMoves);
  const game = new Chess(fen);
  let step = 0;

  const boardDiv = document.createElement("div");
  boardDiv.style.width = "350px";

  const { wrap: turnDiv, dot, label } = createTurnIndicator();

  container.append(boardDiv, turnDiv);

  const board = Chessboard(boardDiv, {
    draggable: true,
    position: fen,
    pieceTheme: "https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png",

    onDragStart: (_, piece) => {
      if (game.turn() === "w" && piece.startsWith("b")) return false;
      if (game.turn() === "b" && piece.startsWith("w")) return false;
    },

    onDrop: (src, dst) => {
      const mv = game.move({ from: src, to: dst, promotion: "q" });
      if (!mv) return "snapback";

      const played = mv.from + mv.to + (mv.promotion || "");
      const expected = solutionUCI[step];

      if (played !== expected) {
        // no "Your move" text anymore
        game.undo();
        return "snapback";
      }

      step++;
      updateTurnIndicator(game, dot, label);

      if (step < solutionUCI.length) {
        const replySAN = sanMoves[step];
        const reply = game.move(replySAN, { sloppy: true });
        if (reply) {
          step++;
          setTimeout(() => {
            board.position(game.fen());
            updateTurnIndicator(game, dot, label);
          }, 150);
        }
      }

      return true;
    },

    onSnapEnd: () => board.position(game.fen())
  });

  updateTurnIndicator(game, dot, label);
}

// ======================================================================
// REMOTE PGN PACK — Lazy loading (20 per batch)
// ======================================================================
function initRemotePackLazy(container, url) {
  let puzzles = [];
  let games = [];
  let currentIndex = 0;
  let game = null;
  let board = null;
  let sanMoves = [];
  let solutionUCI = [];
  let step = 0;
  let allParsed = false;

  const BATCH = 20;

  // UI
  const infoDiv = document.createElement("div");
  infoDiv.style.marginBottom = "5px";

  const boardDiv = document.createElement("div");
  boardDiv.style.width = "350px";

  const { wrap: turnDiv, dot, label } = createTurnIndicator();

  const statusDiv = document.createElement("div");
  statusDiv.style.marginTop = "8px";

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
  container.append(infoDiv, boardDiv, turnDiv, statusDiv, controls);

  statusDiv.textContent = "[Loading puzzle pack…]";

  // Fetch PGN
  fetch(url)
    .then(r => r.text())
    .then(text => {
      games = splitPGNGames(text);
      parseBatch(0);
    })
    .catch(() => (statusDiv.textContent = "Failed to load PGN."));

  function splitPGNGames(text) {
    return text
      .replace(/\r/g, "")
      .split(/(?=\[Event\b)/g)
      .map(g => g.trim())
      .filter(Boolean);
  }

  function parseOne(gameText) {
    const fenMatch = gameText.match(/\[FEN\s+"([^"]+)"\]/i);
    if (!fenMatch) return null;

    const fen = fenMatch[1].trim();
    let moves = [];

    const tag = gameText.match(/\[(Moves|Solution)\s+"([^"]+)"\]/i);
    if (tag) moves = pgnToSanArray(tag[2]);
    else moves = pgnToSanArray(gameText.replace(/\[[^\]]+\]/g, " "));

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
      statusDiv.textContent = "";
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
      pieceTheme: "https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png",

      onDragStart: (_, piece) => {
        if (game.turn() === "w" && piece.startsWith("b")) return false;
        if (game.turn() === "b" && piece.startsWith("w")) return false;
      },

      onDrop: (src, dst) => {
        const mv = game.move({ from: src, to: dst, promotion: "q" });
        if (!mv) return "snapback";

        const played = mv.from + mv.to + (mv.promotion || "");
        const expected = solutionUCI[step];

        if (played !== expected) {
          game.undo();
          return "snapback";
        }

        step++;
        updateTurnIndicator(game, dot, label);

        if (step < solutionUCI.length) {
          const replySAN = sanMoves[step];
          const r = game.move(replySAN, { sloppy: true });
          if (r) step++;
          setTimeout(() => {
            board.position(game.fen());
            updateTurnIndicator(game, dot, label);
          }, 150);
        }

        return true;
      },

      onSnapEnd: () => board.position(game.fen())
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
        loadPuzzle(++currentIndex);
      } else if (!allParsed) {
        statusDiv.textContent = "Loading more puzzles…";
      } else {
        currentIndex = 0;
        loadPuzzle(0);
      }
    };
  }

  function loadPuzzle(i) {
    const p = puzzles[i];
    if (!p) return;

    game = new Chess(p.fen);
    sanMoves = p.moves;
    solutionUCI = buildUCISolution(p.fen, sanMoves);
    step = 0;

    board.position(p.fen);
    updateTurnIndicator(game, dot, label);
    statusDiv.textContent = "";
  }
}
