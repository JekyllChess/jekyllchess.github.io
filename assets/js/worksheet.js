/* ============================= */
/* GLOBAL REPORT CARD STATS      */
/* ============================= */

const REPORT = {
  attempted: 0,
  correct: 0,
  wrong: 0,
  currentStreak: 0,
  bestStreak: 0,
  pagesCompleted: 0
};


/* ============================= */
/* DOM READY                     */
/* ============================= */

document.addEventListener("DOMContentLoaded", () => {

  const worksheets = document.querySelectorAll("worksheet");

  worksheets.forEach(ws => {

    const pgnLine = ws.innerText
      .split("\n")
      .find(l => l.trim().startsWith("PGN:"));

    if (!pgnLine) return;

    const url = pgnLine.replace("PGN:", "").trim();

    fetch(url)
      .then(r => r.text())
      .then(pgnText => {

        const puzzles = splitPGN(pgnText);

        ws._puzzles = puzzles;
        ws._page = 0;

        renderPage(ws);

      })
      .catch(err => {
        ws.innerHTML = "Failed to load PGN.";
        console.error(err);
      });

  });

});


/* ============================= */
/* SPLIT PGN                     */
/* ============================= */

function splitPGN(text) {

  const games = text
    .replace(/\r/g, "")
    .split(/\n\s*\n(?=\[)/g)
    .map(g => g.trim())
    .filter(Boolean);

  return games.map(extractPuzzle);

}


/* ============================= */
/* EXTRACT PUZZLE                */
/* ============================= */

function extractPuzzle(pgn) {

  const fenMatch = pgn.match(/\[FEN\s+"([^"]+)"\]/);
  const startFEN = fenMatch ? fenMatch[1] : "start";

  const moveLine = pgn
    .split("\n")
    .find(l => /^[0-9]/.test(l));

  let solver = "white";
  let solutionMoves = [];

  if (moveLine) {

    if (/^[0-9]+\.\.\./.test(moveLine)) solver = "white";
    else if (/^[0-9]+\.\s/.test(moveLine)) solver = "black";

    const cleaned = moveLine
      .replace(/[0-9]+\.(\.\.)?/g, "")
      .replace(/\*/g, "")
      .trim();

    solutionMoves = cleaned.split(/\s+/);
  }

  const game = new Chess(startFEN === "start" ? undefined : startFEN);

  if (solutionMoves.length) {
    game.move(solutionMoves[0], { sloppy: true });
    solutionMoves.shift();
  }

  return {
    fen: game.fen(),
    orientation: solver === "black" ? "black" : "white",
    solution: solutionMoves,
    attempted: false
  };

}


/* ============================= */
/* RENDER PAGE                   */
/* ============================= */

function renderPage(ws) {

  const start = ws._page * 10;
  const end = start + 10;
  const slice = ws._puzzles.slice(start, end);

  slice.forEach(p => p.attempted = false);

  ws.innerHTML = "";

  const grid = document.createElement("div");
  grid.className = "worksheet-grid";
  ws.appendChild(grid);

  slice.forEach(puzzle => {

    const cell = document.createElement("div");
    cell.className = "worksheet-item";

    const boardDiv = document.createElement("div");
    boardDiv.className = "worksheet-board";

    const feedback = document.createElement("div");
    feedback.className = "move-feedback";

    cell.appendChild(boardDiv);
    cell.appendChild(feedback);
    grid.appendChild(cell);

    requestAnimationFrame(() => {

      const game = new Chess(puzzle.fen);

      const board = Chessboard(boardDiv, {
        position: puzzle.fen,
        orientation: puzzle.orientation,
        draggable: true,
        moveSpeed: 0,
        snapSpeed: 0,
        pieceTheme: "https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png",

        onDrop: (source, target) => {

          const move = game.move({
            from: source,
            to: target,
            promotion: "q"
          });

          if (!move) return "snapback";

          puzzle.attempted = true;
          updateNextButtonState(ws);

          const expected = puzzle.solution[0];

          /* WRONG */
          if (!expected || move.san !== expected) {
            game.undo();
            feedback.textContent = move.san + " ❌";
            applyFigurine(feedback);

            REPORT.attempted++;
            REPORT.wrong++;
            REPORT.currentStreak = 0;

            cell.classList.add("disabled");
            board.draggable = false;
            return "snapback";
          }

          /* CORRECT */
          puzzle.solution.shift();
          feedback.textContent = move.san + " ✅";
          applyFigurine(feedback);
          board.position(game.fen(), false);

          REPORT.attempted++;
          REPORT.correct++;
          REPORT.currentStreak++;
          if (REPORT.currentStreak > REPORT.bestStreak)
            REPORT.bestStreak = REPORT.currentStreak;

          if (puzzle.solution.length === 0) {
            cell.classList.add("disabled");
            board.draggable = false;
          }

        }
      });

    });

  });

  /* TOOLBAR */

  if (end < ws._puzzles.length) {

    const toolbar = document.createElement("div");
    toolbar.className = "worksheet-toolbar";

    const reportBtn = document.createElement("button");
    reportBtn.className = "report-btn";
    reportBtn.textContent = "Report Card";
    reportBtn.onclick = openReportCard;

    const nextBtn = document.createElement("button");
    nextBtn.className = "worksheet-next";
    nextBtn.textContent = "Next";
    nextBtn.disabled = true;

    nextBtn.onclick = () => {
      ws._page++;
      renderPage(ws);
    };

    ws._nextButton = nextBtn;

    toolbar.appendChild(reportBtn);
    toolbar.appendChild(nextBtn);
    ws.appendChild(toolbar);

  }

}


/* ============================= */
/* NEXT BUTTON STATE             */
/* ============================= */

function updateNextButtonState(ws) {

  if (!ws._nextButton) return;

  const start = ws._page * 10;
  const end = start + 10;
  const slice = ws._puzzles.slice(start, end);

  const allAttempted = slice.every(p => p.attempted);

  if (allAttempted) {
    ws._nextButton.disabled = false;
    REPORT.pagesCompleted++;
  }

}


/* ============================= */
/* REPORT CARD                   */
/* ============================= */

function openReportCard() {

  const accuracy = REPORT.attempted
    ? Math.round((REPORT.correct / REPORT.attempted) * 100)
    : 0;

  const overlay = document.createElement("div");
  overlay.className = "report-overlay";

  overlay.innerHTML = `
    <div class="report-card">
      <div class="report-close">✖</div>

      <div class="report-title">♟ Training Report Card</div>

      <div class="report-grid">

        <div class="report-box">
          <span>${REPORT.attempted}</span>
          Puzzles Attempted
        </div>

        <div class="report-box">
          <span>${REPORT.correct}</span>
          Correct
        </div>

        <div class="report-box">
          <span>${REPORT.wrong}</span>
          Wrong
        </div>

        <div class="report-box">
          <span>${accuracy}%</span>
          Accuracy
        </div>

        <div class="report-box">
          <span>${REPORT.currentStreak}</span>
          Current Streak
        </div>

        <div class="report-box">
          <span>${REPORT.bestStreak}</span>
          Best Streak
        </div>

      </div>

      <div class="report-box" style="margin-top:14px">
        <span>${REPORT.pagesCompleted}</span>
        Pages Completed
      </div>

      <div class="progress-bar">
        <div class="progress-fill" style="width:${accuracy}%"></div>
      </div>

    </div>
  `;

  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";

  overlay.querySelector(".report-close").onclick = close;
  overlay.onclick = e => { if (e.target === overlay) close(); };
  document.addEventListener("keydown", esc);

  function close() {
    overlay.remove();
    document.body.style.overflow = "";
    document.removeEventListener("keydown", esc);
  }

  function esc(e) {
    if (e.key === "Escape") close();
  }

}


/* ============================= */
/* FIGURINE APPLY                */
/* ============================= */

function applyFigurine(el) {
  if (window.ChessFigurine && typeof window.ChessFigurine.run === "function") {
    window.ChessFigurine.run(el);
  }
}