/* ================= PUZZLE RUSH ================= */

import { splitIntoPgnGames } from "./tokenizer.js";
import { parseGame } from "./puzzle-helpers.js";
import { renderLocalPuzzle } from "./puzzle.js";

const RUSH_KEY = "jekyllchess_puzzle_rush_index";

/**
 * Loads a PGN file from URL and runs Puzzle Rush.
 */
function renderPuzzleRush(container, url) {
  container.textContent = "Loading...";

  fetch(url, { cache: "no-store" })
    .then((res) => {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.text();
    })
    .then((text) => {
      const puzzles = splitIntoPgnGames(text)
        .map(parseGame)
        .filter((p) => !p.error);

      let idx = parseInt(localStorage.getItem(RUSH_KEY), 10) || 0;

      container.innerHTML = "";
      const holder = document.createElement("div");
      holder.className = "puzzle-rush-wrap";
      container.appendChild(holder);

      const counterDiv = document.createElement("div");
      counterDiv.className = "puzzle-rush-counter";
      holder.appendChild(counterDiv);

      function updateCounter() {
        counterDiv.textContent =
          "Puzzle " + Math.min(idx + 1, puzzles.length) + " / " + puzzles.length;
      }

      function loadNext() {
        if (!puzzles[idx]) {
          localStorage.removeItem(RUSH_KEY);
          holder.innerHTML = "<div class='jc-finished'>All puzzles completed ✔</div>";
          return;
        }

        updateCounter();

        const fenParts = puzzles[idx].fen.split(" ");
        const solverSide = fenParts[1] === "w" ? "b" : "w";
        const orientation = solverSide === "w" ? "white" : "black";

        renderLocalPuzzle(
          holder,
          puzzles[idx].fen,
          puzzles[idx].moves,
          true,
          false,
          () => {
            idx++;
            localStorage.setItem(RUSH_KEY, idx);
            holder.innerHTML = "";
            const newCounter = document.createElement("div");
            newCounter.className = "puzzle-rush-counter";
            holder.appendChild(newCounter);
            counterDiv.remove();
            requestAnimationFrame(loadNext);
          },
          orientation,
          null,
          true
        );
      }

      loadNext();
    })
    .catch(() => {
      container.textContent = "Failed to load PGN.";
    });
}

export { renderPuzzleRush };