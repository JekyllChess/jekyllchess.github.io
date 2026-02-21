document.addEventListener("DOMContentLoaded", function () {

  // Find all worksheet blocks
  const worksheets = document.querySelectorAll("worksheet");

  worksheets.forEach((worksheet, worksheetIndex) => {

    const content = worksheet.textContent.trim();
    const match = content.match(/PGN:\s*(.*)/i);

    if (!match) return;

    const pgnUrl = match[1].trim();

    // Clear original content
    worksheet.innerHTML = "<p>Loading puzzles...</p>";

    fetch(pgnUrl)
      .then(response => response.text())
      .then(pgnText => {

        const games = splitPGNGames(pgnText);

        worksheet.innerHTML = ""; // Clear loading text

        games.forEach((gameText, index) => {

          const chess = new Chess();
          chess.load_pgn(gameText);

          const fen = chess.fen();

          const puzzleContainer = document.createElement("div");
          puzzleContainer.className = "worksheet-puzzle";

          const boardDiv = document.createElement("div");
          boardDiv.id = `worksheet-board-${worksheetIndex}-${index}`;
          boardDiv.className = "worksheet-board";

          puzzleContainer.appendChild(boardDiv);
          worksheet.appendChild(puzzleContainer);

          Chessboard(boardDiv.id, {
            position: fen,
            draggable: false,
            pieceTheme: "https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png"
          });

        });

      })
      .catch(error => {
        worksheet.innerHTML = "<p>Error loading PGN.</p>";
        console.error("Worksheet PGN load error:", error);
      });

  });

});


// ----------------------------
// Helper: Split multiple PGNs
// ----------------------------
function splitPGNGames(pgnText) {

  // Split on new headers
  const rawGames = pgnText.split(/\n(?=\[Event)/g);

  return rawGames
    .map(g => g.trim())
    .filter(g => g.length > 0);
}