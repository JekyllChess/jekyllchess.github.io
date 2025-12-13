// ============================================================================
// guess-pgn.js — Guess-the-move mode built ON TOP OF pgn-reader.js
// REQUIREMENT: pgn-reader.js must be loaded BEFORE this file
//
// Strategy:
//   • Instantiate ReaderPGNView normally
//   • Intercept .next() to require correct SAN guess
//   • Zero DOM / layout changes
// ============================================================================

(function () {
  "use strict";

  if (!window.ReaderPGNView) {
    console.error("guess-pgn.js: ReaderPGNView not found. Load pgn-reader.js first.");
    return;
  }

  function normalizeSAN(s) {
    return (s || "")
      .replace(/0/g, "O")
      .replace(/[+#?!]/g, "")
      .replace(/\s+/g, "")
      .trim();
  }

  // --------------------------------------------------------------------------

  class GuessPGNTrainer {
    constructor(el) {
      this.el = el;

      // Create a NORMAL reader
      this.reader = new ReaderPGNView(el);

      // Inject UI
      this.injectGuessUI();

      // Patch navigation
      this.patchNext();

      // Start at beginning
      this.reader.mainlineIndex = -1;
    }

    injectGuessUI() {
      const leftCol = this.reader.wrapper.querySelector(".pgn-reader-left");
      if (!leftCol) return;

      const box = document.createElement("div");
      box.className = "guess-pgn-input";
      box.innerHTML =
        'Your move: ' +
        '<input type="text" class="guess-san" autocomplete="off" /> ' +
        '<button type="button" class="guess-ok">OK</button>';

      leftCol.appendChild(box);

      this.input = box.querySelector(".guess-san");
      this.button = box.querySelector(".guess-ok");

      const submit = () => this.tryGuess();

      this.button.addEventListener("click", submit);
      this.input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") submit();
      });
    }

    patchNext() {
      const originalNext = this.reader.next.bind(this.reader);

      this.reader.next = () => {
        // If already at end, allow
        if (this.reader.mainlineIndex + 1 >= this.reader.mainlineMoves.length) {
          originalNext();
          return;
        }

        const targetSpan =
          this.reader.mainlineMoves[this.reader.mainlineIndex + 1];

        const targetSAN = normalizeSAN(targetSpan.textContent);
        const guessSAN = normalizeSAN(this.input.value);

        if (!guessSAN) {
          this.flash(false);
          return;
        }

        if (guessSAN === targetSAN) {
          this.input.value = "";
          this.flash(true);
          originalNext();
        } else {
          this.flash(false);
        }
      };
    }

    tryGuess() {
      this.reader.next();
    }

    flash(ok) {
      if (!this.input) return;
      this.input.classList.remove("guess-ok-flash", "guess-wrong-flash");
      void this.input.offsetWidth; // reflow
      this.input.classList.add(ok ? "guess-ok-flash" : "guess-wrong-flash");
    }
  }

  // --------------------------------------------------------------------------

  function init() {
    document.querySelectorAll("guess-pgn").forEach((el) => {
      new GuessPGNTrainer(el);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
