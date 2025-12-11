// ======================================================================
// JekyllChess Puzzle Engine
// - Multiple <puzzle> blocks per page
// - Local puzzles → one board per <puzzle>
// - Remote PGN pack → single-board trainer (first PGN URL only)
// - Supports:
//      FEN: ... + Moves: SAN1 SAN2 ...
//      FEN: ... + PGN: 1. SAN1 SAN1... 2. ...
//      PGN: https://... (remote pack)
// - Figurine-safe & Jekyll-safe
// ======================================================================

document.addEventListener("DOMContentLoaded", () => {
  console.log("Puzzle engine loaded.");

  const puzzleNodes = Array.from(document.querySelectorAll("puzzle"));
  if (puzzleNodes.length === 0) {
    console.log("No <puzzle> blocks found.");
    return;
  }

  // ------------------------------------------------------------
  // First: handle ONE remote PGN pack (Option R2)
  // ------------------------------------------------------------
  let remotePackInitialized = false;

  for (const node of puzzleNodes) {
    if (remotePackInitialized) break;

    const htmlRaw = node.innerHTML || "";
    const html = stripFigurines(htmlRaw);

    const pgnUrlMatch = html.match(/PGN:\s*(https?:\/\/[^\s<]+)/i);
    const fenMatch    = html.match(/FEN:\s*([^<\n\r]+)/i);

    // Remote pack: PGN URL and NO FEN in this block
    if (pgnUrlMatch && !fenMatch) {
      const url = pgnUrlMatch[1].trim();
      console.log("Remote PGN pack detected:", url);

      const wrapper = document.createElement("div");
      wrapper.style.margin = "20px 0";
      node.replaceWith(wrapper);

      initRemotePack(wrapper, url);
      remotePackInitialized = true;
    }
  }

  // ------------------------------------------------------------
  // Then: handle local puzzles (one board per <puzzle>)
  // ------------------------------------------------------------
  for (const node of puzzleNodes) {
    // Node may have been removed if it was the remote pack block
    if (!node.isConnected) continue;

    const htmlRaw = node.innerHTML || "";
    const html = stripFigurines(htmlRaw);

    const fenMatch = html.match(/FEN:\s*([^<\n\r]+)/i);
    if (!fenMatch) continue; // not a local FEN puzzle

    const fen = fenMatch[1].trim();

    // Prefer Moves: first
    const movesMatch = html.match(/Moves:\s*([^<\n\r]+)/i);
    const pgnInlineMatch = html.match(/PGN:\s*([^<\n\r]+)/i);

    let sanMoves = null;

    if (movesMatch) {
      const movesLine = movesMatch[1].trim().replace(/\s+/g, " ");
      sanMoves = movesLine.split(" ");
    } else if (pgnInlineMatch) {
      const pgnLine = pgnInlineMatch[1].trim();
      // If it looks like a URL, we already used it above (or skipped if second URL)
      if (!/^https?:\/\//i.test(pgnLine)) {
        sanMoves = pgnToSanArray(pgnLine);
      }
    }

    if (!sanMoves || sanMoves.length === 0) {
      const wrapper = document.createElement("div");
      wrapper.style.margin = "20px 0";
      wrapper.innerHTML = "<div style='color:red'>Invalid puzzle block.</div>";
      node.replaceWith(wrapper);
      continue;
    }

    console.log("Local puzzle:", { fen, sanMoves });

    const wrapper = document.createElement("div");
    wrapper.style.margin = "20px 0";
    node.replaceWith(wrapper);

    renderSinglePuzzle(wrapper, fen, sanMoves);
  }
});

// ======================================================================
// Helper: strip figurine characters (for safety)
// ======================================================================
function stripFigurines(str) {
  return str.replace(/[♔♕♖♗♘♙]/g, "");
}

// ======================================================================
// Helper: convert an inline PGN string to SAN array
//  e.g. "1. Nxe5 Nxe5 2. Bxf7+ Ke7" → ["Nxe5","Nxe5","Bxf7+","Ke7"]
// ======================================================================
function pgnToSanArray(pgnText) {
  let s = pgnText;

  // Remove comments {...} and variations (...)
  s = s.replace(/\{[^}]*\}/g, " ");
  s = s.replace(/\([^)]*\)/g, " ");

  // Remove game result markers
  s = s.replace(/\b(1-0|0-1|1\/2-1\/2|\*)\b/g, " ");

  // Remove move numbers like "1.", "1..." etc.
  s = s.replace(/\d+\.(\.\.)?/g, " ");

  // Collapse whitespace and split
  s = s.replace(/\s+/g, " ").trim();
  if (!s) return [];
  return s.split(" ");
}

// ======================================================================
// LOCAL PUZZLE: One board per <puzzle>, given FEN + SAN move list
// ======================================================================
function renderSinglePuzzle(container, fen, sanMoves) {
  console.log("Rendering local puzzle with FEN:", fen);

  const solutionUCI = buildUCISolution(fen, sanMoves);
  console.log("Local puzzle UCI solution:", solutionUCI);

  const game = new Chess(fen);

  const boardDiv = document.createElement("div");
  boardDiv.style.width = "350px";

  const statusDiv = document.createElement("div");
  statusDiv.style.marginTop = "10px";
  statusDiv.style.fontSize = "16px";

  container.append(boardDiv, statusDiv);

  let step = 0;

  const board = Chessboard(boardDiv, {
    draggable: true,
    position: fen,
    pieceTheme: "https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png",

    onDragStart: (_, piece) => {
      if (game.turn() === "w" && piece.startsWith("b")) return false;
      if (game.turn() === "b" && piece.startsWith("w")) return false;
    },

    onDrop: (source, target) => {
      const move = game.move({ from: source, to: target, promotion: "q" });
      if (!move) return "snapback";

      const playedUCI = move.from + move.to + (move.promotion || "");
      const expectedUCI = solutionUCI[step];

      if (playedUCI !== expectedUCI) {
        statusDiv.textContent = "❌ Wrong move";
        game.undo();
        return "snapback";
      }

      statusDiv.textContent = "✅ Correct";
      step++;

      // Opponent reply if exists
      if (step < solutionUCI.length) {
        const replySAN = sanMoves[step];
        const reply = game.move(replySAN, { sloppy: true });
        if (reply) {
          step++;
          setTimeout(() => board.position(game.fen()), 150);
        }
      }

      if (step >= solutionUCI.length) {
        statusDiv.textContent = "🎉 Puzzle solved!";
      }

      return true;
    },

    onSnapEnd: () => board.position(game.fen())
  });

  statusDiv.textContent = "Your move...";
}

// ======================================================================
// Build UCI solution from FEN + SAN array, progressing forward (no undo)
// ======================================================================
function buildUCISolution(fen, sanMoves) {
  const game = new Chess(fen);
  const solution = [];

  for (let san of sanMoves) {
    const cleaned = san.replace(/[!?]/g, "").trim();
    if (!cleaned) continue;

    const moveObj = game.move(cleaned, { sloppy: true });
    if (!moveObj) {
      console.error("Cannot parse SAN move in solution:", san);
      break;
    }

    const uci = moveObj.from + moveObj.to + (moveObj.promotion || "");
    solution.push(uci);
  }

  return solution;
}

// ======================================================================
// REMOTE PACK: Single-board trainer for first PGN URL on page
// ======================================================================
function initRemotePack(container, url) {
  console.log("Initializing remote PGN pack from:", url);

  const title = document.createElement("div");
  title.textContent = "Puzzle Pack";
  title.style.fontWeight = "bold";
  title.style.marginBottom = "5px";

  const infoDiv = document.createElement("div");
  infoDiv.style.marginBottom = "5px";

  const boardDiv = document.createElement("div");
  boardDiv.style.width = "350px";
  boardDiv.style.marginBottom = "10px";

  const statusDiv = document.createElement("div");
  statusDiv.style.marginBottom = "10px";

  const controlsDiv = document.createElement("div");
  controlsDiv.style.display = "flex";
  controlsDiv.style.gap = "8px";
  controlsDiv.style.marginBottom = "10px";

  const prevBtn = document.createElement("button");
  prevBtn.textContent = "Previous";
  prevBtn.className = "btn btn-sm btn-secondary";

  const nextBtn = document.createElement("button");
  nextBtn.textContent = "Next";
  nextBtn.className = "btn btn-sm btn-secondary";

  const restartBtn = document.createElement("button");
  restartBtn.textContent = "Restart Puzzle";
  restartBtn.className = "btn btn-sm btn-outline-secondary";

  controlsDiv.append(prevBtn, nextBtn, restartBtn);

  container.append(title, infoDiv, boardDiv, statusDiv, controlsDiv);

  // State
  let puzzles = [];
  let currentIndex = 0;
  let game = null;
  let board = null;
  let sanMoves = [];
  let solutionUCI = [];
  let step = 0;

  // Fetch PGN
  fetch(url)
    .then(r => r.text())
    .then(text => {
      puzzles = parsePGNPack(text);
      if (!puzzles.length) {
        statusDiv.textContent = "No puzzles found in PGN.";
        return;
      }

      console.log("Remote PGN puzzles parsed:", puzzles.length);
      initBoard();
      loadPuzzle(0);
    })
    .catch(err => {
      console.error(err);
      statusDiv.textContent = "Failed to load PGN.";
    });

  function initBoard() {
    board = Chessboard(boardDiv, {
      draggable: true,
      position: "start",
      pieceTheme: "https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png",

      onDragStart: (_, piece) => {
        if (!game) return false;
        if (game.turn() === "w" && piece.startsWith("b")) return false;
        if (game.turn() === "b" && piece.startsWith("w")) return false;
      },

      onDrop: (source, target) => {
        if (!game) return "snapback";

        const move = game.move({ from: source, to: target, promotion: "q" });
        if (!move) return "snapback";

        const playedUCI = move.from + move.to + (move.promotion || "");
        const expectedUCI = solutionUCI[step];

        if (playedUCI !== expectedUCI) {
          statusDiv.textContent = "❌ Wrong move";
          game.undo();
          return "snapback";
        }

        statusDiv.textContent = "✅ Correct";
        step++;

        // Opponent reply
        if (step < solutionUCI.length) {
          const replySAN = sanMoves[step];
          const reply = game.move(replySAN, { sloppy: true });
          if (reply) {
            step++;
            setTimeout(() => board.position(game.fen()), 150);
          }
        }

        if (step >= solutionUCI.length) {
          statusDiv.textContent = "🎉 Puzzle solved!";
        }

        return true;
      },

      onSnapEnd: () => {
        if (game) board.position(game.fen());
      }
    });

    prevBtn.onclick = () => {
      if (!puzzles.length) return;
      currentIndex = (currentIndex - 1 + puzzles.length) % puzzles.length;
      loadPuzzle(currentIndex);
    };

    nextBtn.onclick = () => {
      if (!puzzles.length) return;
      currentIndex = (currentIndex + 1) % puzzles.length;
      loadPuzzle(currentIndex);
    };

    restartBtn.onclick = () => {
      if (!puzzles.length) return;
      loadPuzzle(currentIndex);
    };
  }

  function loadPuzzle(index) {
    const p = puzzles[index];
    if (!p) return;

    infoDiv.textContent = `Puzzle ${index + 1} / ${puzzles.length}`;
    statusDiv.textContent = "Your move...";

    game = new Chess(p.fen);
    sanMoves = p.moves.slice();
    solutionUCI = buildUCISolution(p.fen, sanMoves);
    step = 0;

    board.position(p.fen);
  }
}

// ======================================================================
// Parse PGN text into array of puzzles: [{ fen, moves: [SAN...] }, ...]
// Expected format: multiple games with [FEN "..."] tags, moves in body
// or in [Moves "..."]/ [Solution "..."] tags
// ======================================================================
function parsePGNPack(text) {
  const puzzles = [];
  const cleanedText = text.replace(/\r/g, "");
  const blocks = cleanedText.split(/\n\n(?=\[FEN)/g);

  for (const blockRaw of blocks) {
    const block = blockRaw.trim();
    if (!block) continue;

    const fenMatch = block.match(/\[FEN\s+"([^"]+)"\]/i);
    if (!fenMatch) continue;

    const fen = fenMatch[1].trim();

    let moves = [];

    const tagMatch = block.match(/\[(Moves|Solution)\s+"([^"]+)"\]/i);
    if (tagMatch) {
      moves = pgnToSanArray(tagMatch[2]);
    } else {
      // Extract from body
      const body = block.replace(/\[[^\]]+\]/g, " ");
      moves = pgnToSanArray(body);
    }

    if (moves.length === 0) continue;

    puzzles.push({ fen, moves });
  }

  return puzzles;
}
