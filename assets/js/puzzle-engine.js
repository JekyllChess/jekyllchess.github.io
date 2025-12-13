(function () {
  "use strict";

  if (typeof Chess !== "function" || typeof Chessboard !== "function") return;

  const PIECE_THEME =
    "https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png";

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("puzzle").forEach(initPuzzle);
  });

  /* -------------------------------------------------- */
  /* Helpers                                            */
  /* -------------------------------------------------- */

  function stripFigurines(s) {
    return (s || "").replace(/[♔♕♖♗♘♙]/g, "");
  }

  function parsePGNMoves(pgn) {
    return pgn
      .replace(/\[[^\]]*]/g, " ")
      .replace(/\{[^}]*}/g, " ")
      .replace(/\([^)]*\)/g, " ")
      .replace(/\b\d+\.(\.\.)?/g, " ")
      .replace(/\b(1-0|0-1|1\/2-1\/2|\*)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean);
  }

  function normalizeSAN(s) {
    return s.replace(/[+#?!]/g, "");
  }

  /* -------------------------------------------------- */
  /* UI helpers                                         */
  /* -------------------------------------------------- */

  function show(el, txt) {
    el.textContent = txt;
  }

  function updateTurn(el, game, solved) {
    if (solved) el.textContent = "";
    else el.textContent = game.turn() === "w" ? "⚐ White to move" : "⚑ Black to move";
  }

  /* -------------------------------------------------- */
  /* PUZZLE DISPATCH                                    */
  /* -------------------------------------------------- */

  function initPuzzle(node) {
    const raw = stripFigurines(node.textContent || "");
    const wrap = document.createElement("div");
    wrap.className = "jc-puzzle-wrapper";
    node.replaceWith(wrap);

    const pgnUrl = raw.match(/PGN:\s*(https?:\/\/\S+)/i);
    if (pgnUrl) {
      initRemotePuzzle(wrap, pgnUrl[1]);
      return;
    }

    const fen = raw.match(/FEN:\s*([^\n]+)/i);
    const moves = raw.match(/Moves:\s*([^\n]+)/i);

    if (!fen || !moves) {
      wrap.textContent = "❌ Invalid <puzzle> block.";
      return;
    }

    initLocalPuzzle(wrap, fen[1].trim(), moves[1].trim().split(/\s+/));
  }

  /* -------------------------------------------------- */
  /* LOCAL PUZZLE                                       */
  /* -------------------------------------------------- */

  function initLocalPuzzle(container, fen, moves) {
    runPuzzle(container, [{ fen, moves }], 0);
  }

  /* -------------------------------------------------- */
  /* REMOTE PUZZLE                                      */
  /* -------------------------------------------------- */

  function initRemotePuzzle(container, url) {
    show(container, "Loading puzzle pack…");

    fetch(url)
      .then(r => r.text())
      .then(txt => {
        const games = txt
          .split(/\[Event\b/)
          .slice(1)
          .map(g => "[Event" + g);

        const puzzles = games
          .map(g => {
            const fen = g.match(/\[FEN\s+"([^"]+)"/)?.[1];
            if (!fen) return null;
            return { fen, moves: parsePGNMoves(g) };
          })
          .filter(Boolean);

        if (!puzzles.length) {
          container.textContent = "❌ No puzzles found.";
          return;
        }

        runPuzzle(container, puzzles, 0);
      })
      .catch(() => {
        container.textContent = "❌ Failed to load PGN.";
      });
  }

  /* -------------------------------------------------- */
  /* CORE PUZZLE ENGINE                                 */
  /* -------------------------------------------------- */

  function runPuzzle(container, puzzles, index) {
    container.innerHTML = "";

    const puzzle = puzzles[index];
    const game = new Chess(puzzle.fen);

    let step = 0;
    let solved = false;

    const boardDiv = document.createElement("div");
    boardDiv.className = "jc-board";

    const status = document.createElement("div");
    status.className = "jc-status-row";

    const turn = document.createElement("span");
    const feedback = document.createElement("span");
    const counter = document.createElement("span");

    counter.textContent = `Puzzle ${index + 1} / ${puzzles.length}`;

    status.append(turn, feedback, counter);
    container.append(boardDiv, status);

    let board;
    requestAnimationFrame(() => {
      board = Chessboard(boardDiv, {
        position: game.fen(),
        draggable: true,
        pieceTheme: PIECE_THEME,
        onDrop: onDrop
      });
    });

    function onDrop(from, to) {
      if (solved) return "snapback";

      const mv = game.move({ from, to, promotion: "q" });
      if (!mv) return "snapback";

      if (normalizeSAN(mv.san) !== normalizeSAN(puzzle.moves[step])) {
        game.undo();
        show(feedback, "❌ Wrong move");
        updateTurn(turn, game, solved);
        return "snapback";
      }

      show(feedback, "✅ Correct");
      step++;
      updateTurn(turn, game, solved);

      autoplayOpponent();
    }

    function autoplayOpponent() {
      if (step >= puzzle.moves.length) {
        solved = true;
        show(feedback, "🏆 Puzzle solved");
        updateTurn(turn, game, solved);
        return;
      }

      const san = puzzle.moves[step];
      const mv = game.move(san, { sloppy: true });
      if (!mv) return;

      step++;

      // 🔥 animate ONLY opponent move
      board.move(mv.from + "-" + mv.to);
      updateTurn(turn, game, solved);
    }

    updateTurn(turn, game, solved);
  }

})();
