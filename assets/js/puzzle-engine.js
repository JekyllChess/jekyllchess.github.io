// ======================================================================
//   SIMPLE SINGLE-PUZZLE ENGINE — FIGURINE-SAFE VERSION
// ======================================================================

document.addEventListener("DOMContentLoaded", () => {
  console.log("Puzzle engine loaded.");

  const node = document.querySelector("puzzle");
  if (!node) {
    console.log("No <puzzle> found.");
    return;
  }

  // Always get innerHTML because Jekyll injects <p> etc.
  let html = node.innerHTML;
  console.log("Raw puzzle innerHTML:", html);

  // ------------------------------------------------------------
  // Strip all unicode figurines (♔♕♖♗♘♙) BEFORE parsing
  // This protects against figurine.js and theme CSS
  // ------------------------------------------------------------
  html = html.replace(/[♔♕♖♗♘♙]/g, "");

  // Extract FEN:
  const fenMatch = html.match(/FEN:\s*([^<\n\r]+)/i);
  // Extract Moves:
  const movesMatch = html.match(/Moves:\s*([^<\n\r]+)/i);

  if (!fenMatch || !movesMatch) {
    console.log("Failed to extract FEN or Moves.");
    const wrapper = document.createElement("div");
    wrapper.style.margin = "20px 0";
    wrapper.innerHTML = "<div style='color:red'>Puzzle block invalid</div>";
    node.replaceWith(wrapper);
    return;
  }

  const fen = fenMatch[1].trim();
  const movesLine = movesMatch[1].trim().replace(/\s+/g, " ");
  const sanMoves = movesLine.split(" ");

  console.log("Extracted FEN:", fen);
  console.log("Extracted SAN moves:", sanMoves);

  // Replace with container
  const wrapper = document.createElement("div");
  wrapper.style.margin = "20px 0";
  node.replaceWith(wrapper);

  renderPuzzle(wrapper, fen, sanMoves);
});

// ======================================================================
//   RENDER ONE PUZZLE
// ======================================================================

function renderPuzzle(container, fen, sanMoves) {
  console.log("Rendering puzzle with FEN:", fen);

  const gameForConversion = new Chess(fen);
  const solution = [];

  // ------------------------------------------------------------
  // Convert SAN to UCI (true parsing, no figurines)
  // ------------------------------------------------------------
  for (let san of sanMoves) {
    const cleaned = san.replace(/[!?]/g, "").trim();

    console.log("Parsing SAN:", san, "→ cleaned:", cleaned);

    const moveObj = gameForConversion.move(cleaned, { sloppy: true });
    if (!moveObj) {
      console.error("Cannot parse SAN move:", san);
      continue;
    }

    const uci = moveObj.from + moveObj.to + (moveObj.promotion || "");
    solution.push(uci);
    gameForConversion.undo();
  }

  console.log("UCI solution:", solution);

  const game = new Chess(fen);

  // ------------------------------------------------------------
  // Build UI
  // ------------------------------------------------------------
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
    pieceTheme:
      "https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png",

    onDragStart: (_, piece) => {
      console.log("DragStart fired");
      if (game.turn() === "w" && piece.startsWith("b")) return false;
      if (game.turn() === "b" && piece.startsWith("w")) return false;
    },

    onDrop: (source, target) => {
      console.log("onDrop:", source, "→", target);

      const move = game.move({ from: source, to: target, promotion: "q" });
      if (!move) {
        console.log("Illegal move attempt.");
        return "snapback";
      }

      const played = move.from + move.to + (move.promotion || "");
      const expected = solution[step];

      console.log("Played UCI:", played, "Expected:", expected);

      if (played !== expected) {
        statusDiv.textContent = "❌ Wrong move";
        game.undo();
        return "snapback";
      }

      statusDiv.textContent = "✅ Correct";
      step++;

      // Opponent reply
      if (step < solution.length) {
        const replySan = sanMoves[step];
        console.log("Reply SAN:", replySan);
        game.move(replySan, { sloppy: true });
        step++;
        setTimeout(() => board.position(game.fen()), 150);
      }

      if (step >= solution.length) {
        statusDiv.textContent = "🎉 Puzzle solved!";
      }

      return true;
    },

    onSnapEnd: () => board.position(game.fen())
  });

  statusDiv.textContent = "Your move...";
}
