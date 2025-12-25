document.addEventListener("DOMContentLoaded", () => {

  /* ======================================================
   * DOM REFERENCES
   * ====================================================== */

  const movesDiv = document.getElementById("moves");
  const promo = document.getElementById("promo");

  const btnStart = document.getElementById("btnStart");
  const btnEnd   = document.getElementById("btnEnd");
  const btnPrev  = document.getElementById("btnPrev");
  const btnNext  = document.getElementById("btnNext");
  const btnFlip  = document.getElementById("btnFlip");

  const boardEl  = document.getElementById("board");
  const card     = movesDiv.closest(".card");
  const cardHead = card.querySelector(".cardHead");
  const cardBody = card.querySelector(".cardBody");


  /* ======================================================
   * SAN / FIGURINES
   * ====================================================== */

  const FIG = { K:"♔", Q:"♕", R:"♖", B:"♗", N:"♘" };
  const figSAN = s =>
    s.replace(/^[KQRBN]/, p => FIG[p] || p)
     .replace(/=([QRBN])/, (_, p) => "=" + FIG[p]);


  /* ======================================================
   * TREE MODEL
   * ====================================================== */

  let ID = 1;

  class Node {
    constructor(san, parent, fen) {
      this.id = "n" + ID++;
      this.san = san;
      this.parent = parent;
      this.fen = fen;
      this.next = null;   // mainline
      this.vars = [];     // variations branching at this node
    }
  }


  /* ======================================================
   * CHESS STATE
   * ====================================================== */

  const chess = new Chess();
  const START_FEN = chess.fen();

  const root = new Node(null, null, START_FEN);
  let cursor = root;

  let pendingPromotion = null;

  let boardOrientation =
    localStorage.getItem("boardOrientation") || "white";


  /* ======================================================
   * BOARD
   * ====================================================== */

  const board = Chessboard("board", {
    position: "start",
    draggable: true,
    pieceTheme:
      "https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png",
    onDrop
  });

  board.orientation(boardOrientation);

  function rebuildTo(node, animate) {
    chess.load(node?.fen || START_FEN);
    board.position(chess.fen(), !!animate);
  }


  /* ======================================================
   * HEIGHT SYNC
   * ====================================================== */

  function syncMovesPaneHeight() {
    const boardH = boardEl.getBoundingClientRect().height;
    const headH  = cardHead.getBoundingClientRect().height;
    const bodyH  = boardH - headH;

    if (bodyH > 0) {
      cardBody.style.height = bodyH + "px";
      movesDiv.style.overflowY = "auto";
    }
  }

  const ro = new ResizeObserver(() => {
    board.resize();
    syncMovesPaneHeight();
  });

  ro.observe(boardEl);


  /* ======================================================
   * MOVE INPUT
   * ====================================================== */

  function onDrop(from, to) {
    const t = new Chess(chess.fen());
    const p = t.get(from);

    if (p?.type === "p" && (to[1] === "8" || to[1] === "1")) {
      pendingPromotion = { from, to };
      promo.style.display = "flex";
      return;
    }

    const m = t.move({ from, to, promotion: "q" });
    if (!m) return "snapback";

    applyMove(m.san, t.fen());
  }

  promo.onclick = e => {
    if (!e.target.dataset.p) return;
    promo.style.display = "none";

    const t = new Chess(chess.fen());
    const m = t.move({ ...pendingPromotion, promotion: e.target.dataset.p });
    pendingPromotion = null;

    if (m) applyMove(m.san, t.fen());
  };


  /* ======================================================
   * INSERTION (MAINLINE + VARIATIONS)
   * ====================================================== */

  function applyMove(san, fen) {
    // Follow existing mainline move if identical
    if (cursor.next && cursor.next.san === san) {
      cursor = cursor.next;
      rebuildTo(cursor, false);
      render();
      return;
    }

    const n = new Node(san, cursor, fen);

    if (!cursor.next) {
      // Extend mainline if we're at the tip
      cursor.next = n;
    } else {
      // Otherwise, this is a true variation at this position
      cursor.vars.push(n);
    }

    cursor = n;
    rebuildTo(n, false);
    render();
  }


  /* ======================================================
   * RENDERING (MAINLINE + WHITE & BLACK VARIATIONS)
   * ====================================================== */

  function render() {
    movesDiv.innerHTML = "";
    renderMainline(root.next, movesDiv, 1);
  }

  // Mainline is assumed to start with White at moveNo
  function renderMainline(whiteNode, container, moveNo) {
    let w = whiteNode;
    let m = moveNo;

    while (w) {
      // ---- White mainline move ----
      container.appendChild(text(m + ".\u00A0"));
      appendMove(container, w);
      container.appendChild(text(" "));

      // ✅ WHITE variations live on the parent black node
      // Example: 1... e5, then (2. Qh5) is stored in that black node's vars.
      const parentBlack = w.parent; // may be null for the very first white move
      if (parentBlack && parentBlack.vars && parentBlack.vars.length) {
        for (const v of parentBlack.vars) {
          const span = document.createElement("span");
          span.className = "variation";
          span.appendChild(text("(" + m + ".\u00A0"));
          renderVariation(v, span, m, "w"); // variation starts with White here
          trim(span);
          span.appendChild(text(") "));
          container.appendChild(span);
        }
      }

      // ---- Black mainline move ----
      const b = w.next;
      if (!b) return;

      appendMove(container, b);
      container.appendChild(text(" "));

      // ✅ BLACK variations live on the white node
      if (w.vars && w.vars.length) {
        for (const v of w.vars) {
          const span = document.createElement("span");
          span.className = "variation";
          span.appendChild(text("(" + m + "...\u00A0"));
          renderVariation(v, span, m, "b"); // variation starts with Black here
          trim(span);
          span.appendChild(text(") "));
          container.appendChild(span);
        }
      }

      // advance to next white move
      w = b.next;
      m++;
    }
  }

  // Renders a side line starting at `node` with known starting side.
  function renderVariation(node, container, moveNo, sideStart) {
    let cur = node;
    let m = moveNo;
    let side = sideStart;

    while (cur) {
      if (side === "w") {
        container.appendChild(text(m + ".\u00A0"));
      }

      appendMove(container, cur);
      container.appendChild(text(" "));

      // If we just printed black, next is new move number
      if (side === "b") m++;
      side = side === "w" ? "b" : "w";

      cur = cur.next;
    }
  }

  function appendMove(container, node) {
    const span = document.createElement("span");
    span.className = "move" + (node === cursor ? " active" : "");
    span.textContent = figSAN(node.san);

    span.onclick = () => {
      cursor = node;
      rebuildTo(node, true);
      render();
    };

    container.appendChild(span);
  }

  function trim(el) {
    const t = el.lastChild;
    if (t?.nodeType === 3) {
      t.nodeValue = t.nodeValue.replace(/\s+$/, "");
      if (!t.nodeValue) el.removeChild(t);
    }
  }

  function text(t) {
    return document.createTextNode(t);
  }


  /* ======================================================
   * NAVIGATION
   * ====================================================== */

  function goStart() {
    cursor = root;
    rebuildTo(root, true);
    render();
  }

  function goEnd() {
    let n = root;
    while (n.next) n = n.next;
    cursor = n;
    rebuildTo(n, true);
    render();
  }

  function goPrev() {
    if (!cursor.parent) return;
    cursor = cursor.parent;
    rebuildTo(cursor, true);
    render();
  }

  function goNext() {
    if (!cursor.next) return;
    cursor = cursor.next;
    rebuildTo(cursor, true);
    render();
  }

  btnStart.onclick = goStart;
  btnEnd.onclick   = goEnd;
  btnPrev.onclick  = goPrev;
  btnNext.onclick  = goNext;

  document.addEventListener("keydown", e => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

    switch (e.key) {
      case "ArrowLeft":  e.preventDefault(); goPrev();  break;
      case "ArrowRight": e.preventDefault(); goNext();  break;
      case "ArrowUp":    e.preventDefault(); goStart(); break;
      case "ArrowDown":  e.preventDefault(); goEnd();   break;
    }
  });


  /* ======================================================
   * ORIENTATION
   * ====================================================== */

  btnFlip.onclick = () => {
    boardOrientation = boardOrientation === "white" ? "black" : "white";
    board.orientation(boardOrientation);
    localStorage.setItem("boardOrientation", boardOrientation);
  };


  /* ======================================================
   * INIT
   * ====================================================== */

  render();
  rebuildTo(root, false);

  setTimeout(() => {
    board.resize();
    syncMovesPaneHeight();
  }, 0);

});
