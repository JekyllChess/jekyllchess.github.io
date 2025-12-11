document.addEventListener("DOMContentLoaded", () => {
  const puzzles = document.querySelectorAll("puzzle");
  puzzles.forEach(async (node, index) => {
    const text = node.textContent.trim();
    const lines = text.split("\n").map(s => s.trim());

    let fen = null;
    let moves = null;
    let pgnUrl = null;

    for (let line of lines) {
      if (line.startsWith("FEN:")) fen = line.replace("FEN:", "").trim();
      if (line.startsWith("Moves:")) moves = line.replace("Moves:", "").trim().split(/\s+/);
      if (line.startsWith("PGN:")) pgnUrl = line.replace("PGN:", "").trim();
    }

    // Create container BEFORE replacing
    const wrapper = document.createElement("div");
    wrapper.className = "puzzle-container";
    wrapper.style.margin = "25px 0";

    // Replace only once — no recursion
    node.replaceWith(wrapper);

    // Case A: Direct FEN puzzle
    if (fen && moves) {
      renderSinglePuzzle(wrapper, fen, moves);
      return;
    }

    // Case B: Remote PGN
    if (pgnUrl) {
      try {
        const pgnText = await fetch(pgnUrl).then(r => r.text());
        const puzzles = parsePGN(pgnText);

        puzzles.forEach(p =>
          renderSinglePuzzle(wrapper, p.fen, p.moves)
        );
      } catch (err) {
        wrapper.innerHTML = `<div style="color:red">Failed to load PGN.</div>`;
      }
      return;
    }

    wrapper.innerHTML = `<div style="color:red">Invalid puzzle block.</div>`;
  });
});

function parsePGN(text) {
  const out = [];
  const blocks = text.split(/\n\n(?=\[FEN)/g);

  for (let b of blocks) {
    const fen = (b.match(/\[FEN "([^"]+)"\]/) || [])[1];
    if (!fen) continue;

    const movesRaw =
      (b.match(/\[(Moves|Solution) "([^"]+)"\]/) || [])[2] ||
      b.replace(/\[[^\]]+\]/g, "")
        .replace(/\d+\./g, " ")
        .replace(/[?!]+/g, "")
        .trim();

    const moves = movesRaw.split(/\s+/);
    out.push({ fen, moves });
  }
  return out;
}

function renderSinglePuzzle(container, fen, moves) {
  const game = new Chess(fen);
  const solution = [];

  // Convert SAN → UCI
  for (let san of moves) {
    const clean = san.replace(/[?!]/g, "");
    const temp = game.move(clean, { sloppy: true });
    if (!temp) continue;
    solution.push(temp.from + temp.to + (temp.promotion || ""));
    game.undo();
  }

  // Build DOM
  const boardDiv = document.createElement("div");
  boardDiv.style.width = "350px";
  const statusDiv = document.createElement("div");
  statusDiv.style.marginTop = "8px";
  statusDiv.style.fontSize = "16px";
  container.append(boardDiv, statusDiv);

  let step = 0;

  const board = Chessboard(boardDiv, {
    draggable: true,
    position: fen,
    pieceTheme: "https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png",

    onDragStart: (_, piece) => {
      if (game.game_over()) return false;
      if (game.turn() === "w" && piece.startsWith("b")) return false;
      if (game.turn() === "b" && piece.startsWith("w")) return false;
    },

    onDrop: (source, target) => {
      const move = game.move({ from: source, to: target, promotion: "q" });
      if (!move) return "snapback";

      const uci = move.from + move.to + (move.promotion || "");
      const expected = solution[step];

      if (uci !== expected) {
        statusDiv.innerText = "❌ Wrong move";
        game.undo();
        return "snapback";
      }

      statusDiv.innerText = "✅ Correct";
      step++;

      if (step < solution.length) {
        const reply = moves[step];
        game.move(reply, { sloppy: true });
        step++;
        setTimeout(() => board.position(game.fen()), 150);
      }

      if (step >= solution.length)
        statusDiv.innerText = "🎉 Puzzle solved!";

      return true;
    },

    onSnapEnd: () => board.position(game.fen())
  });

  statusDiv.innerText = "Your move...";
}
