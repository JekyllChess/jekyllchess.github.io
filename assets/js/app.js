document.addEventListener("DOMContentLoaded", () => {

  /* ======================================================
   *  DOM REFERENCES
   * ====================================================== */

  const movesDiv = document.getElementById("moves");
  const promo = document.getElementById("promo");

  const btnStart = document.getElementById("btnStart");
  const btnEnd   = document.getElementById("btnEnd");
  const btnPrev  = document.getElementById("btnPrev");
  const btnNext  = document.getElementById("btnNext");


  /* ======================================================
   *  SAN / FIGURINE HELPERS
   * ====================================================== */

  const FIG = { K:"♔", Q:"♕", R:"♖", B:"♗", N:"♘" };
  const figSAN = s =>
    s.replace(/^[KQRBN]/, p => FIG[p] || p)
     .replace(/=([QRBN])/, (_, p) => "=" + FIG[p]);


  /* ======================================================
   *  TREE DATA MODEL
   * ====================================================== */

  let ID = 1;

  class Node {
    constructor(san, parent, fen) {
      this.id = "n" + ID++;
      this.san = san;
      this.parent = parent;
      this.fen = fen;
      this.next = null;
      this.vars = [];
    }
  }


  /* ======================================================
   *  CHESS STATE
   * ====================================================== */

  const chess = new Chess();
  const START_FEN = chess.fen();

  const root = new Node(null, null, START_FEN);
  let cursor = root;

  let pendingPromotion = null;


  /* ======================================================
   *  BOARD SETUP
   * ====================================================== */

  const board = Chessboard("board", {
    position: "start",
    draggable: true,
    pieceTheme: "https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png",
    onDrop
  });

  function rebuildTo(node, animate) {
    chess.load(node?.fen || START_FEN);
    board.position(chess.fen(), !!animate);
  }


  /* ======================================================
   *  MOVE INPUT & PROMOTION
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

    applyMove(m.san, t.fen(), t.turn());
  }

  promo.onclick = e => {
    if (!e.target.dataset.p) return;
    promo.style.display = "none";

    const t = new Chess(chess.fen());
    const m = t.move({ ...pendingPromotion, promotion: e.target.dataset.p });
    pendingPromotion = null;

    if (m) applyMove(m.san, t.fen(), t.turn());
  };


  /* ======================================================
   *  TREE INSERTION LOGIC
   * ====================================================== */

  function applyMove(san, fen, turnAfterMove) {
    let n;

    if (cursor.next && cursor.next.san === san) {
      n = cursor.next;
    } else {
      n = new Node(san, cursor, fen);

      if (cursor.next) {
        // mainline already exists
        if (turnAfterMove === "w") {
          // black just moved → promote to mainline
          cursor.vars.push(cursor.next);
          cursor.next = n;
        } else {
          cursor.vars.push(n);
        }
      } else {
        cursor.next = n;
      }
    }

    n.fen = fen;
    cursor = n;
    rebuildTo(n, false);
    render();
  }


  /* ======================================================
   *  MOVE LIST RENDERING
   * ====================================================== */

  function render() {
    movesDiv.innerHTML = "";
    const main = document.createElement("div");
    main.className = "mainline";
    renderSeq(root.next, main, 1, "w");
    movesDiv.appendChild(main);
  }

  function renderSeq(n, container, moveNo, side) {
    let cur = n, m = moveNo, s = side;

    while (cur) {
      if (s === "w") container.appendChild(text(m + ". "));
      appendMove(container, cur);
      container.appendChild(text(" "));

      if (s === "w") {
        if (cur.next) {
          cur = cur.next;
          s = "b";
          continue;
        }
        renderVars(container, cur, m, "b");
        break;
      } else {
        renderVars(container, cur, m + 1, "w");
        cur = cur.next;
        m++;
        s = "w";
      }
    }
  }

  function renderVars(container, parent, moveNo, side) {
    if (!parent || !parent.vars.length) return;

    for (const v of parent.vars) {
      const span = document.createElement("span");
      span.className = "variation";
      const prefix = (side === "b") ? moveNo + "... " : moveNo + ". ";

      span.appendChild(text("(" + prefix));
      renderSeq(v, span, moveNo, side);
      trim(span);
      span.appendChild(text(")"));
      container.appendChild(span);
      container.appendChild(text(" "));
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
   *  NAVIGATION CONTROLS
   * ====================================================== */

  btnStart && (btnStart.onclick = () => {
    cursor = root;
    rebuildTo(root, true);
    render();
  });

  btnEnd && (btnEnd.onclick = () => {
    let n = root;
    while (n.next) n = n.next;
    cursor = n;
    rebuildTo(n, true);
    render();
  });

  btnPrev && (btnPrev.onclick = () => {
    if (cursor.parent) {
      cursor = cursor.parent;
      rebuildTo(cursor, true);
      render();
    }
  });

  btnNext && (btnNext.onclick = () => {
    if (cursor.next) {
      cursor = cursor.next;
      rebuildTo(cursor, true);
      render();
    }
  });


  /* ======================================================
   *  RESPONSIVE FIX
   * ====================================================== */

  window.addEventListener("resize", () => {
    board.resize();
  });


  /* ======================================================
   *  INITIALIZATION
   * ====================================================== */

  render();
  rebuildTo(root, false);

});
