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
  const btnFlip  = document.getElementById("btnFlip");

  const btnCommentAdd  = document.getElementById("btnCommentAdd");
  const btnCommentSave = document.getElementById("btnCommentSave");
  const commentEditor  = document.getElementById("commentEditor");


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
      this.comment = "";
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

  let boardOrientation =
    localStorage.getItem("boardOrientation") || "white";


  /* ======================================================
   *  BOARD SETUP
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
   *  RESIZE OBSERVER (RESPONSIVE BOARD)
   * ====================================================== */

  const boardEl = document.getElementById("board");

  const boardResizeObserver = new ResizeObserver(() => {
    board.resize();
  });

  boardResizeObserver.observe(boardEl);


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
    const m = t.move({
      ...pendingPromotion,
      promotion: e.target.dataset.p
    });

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
    syncCommentEditor();
  }


  /* ======================================================
   *  MOVE LIST RENDERING (FIXED VARIATIONS)
   * ====================================================== */

  function render() {
    movesDiv.innerHTML = "";

    const main = document.createElement("div");
    main.className = "mainline";

    renderSeq(root.next, main, 1, "w", false);
    movesDiv.appendChild(main);
  }

  /**
   * renderSeq renders a single mainline starting at node n.
   *
   * moveNo = current full-move number (1,2,3...)
   * side   = "w" or "b" (whose move is represented by n)
   * suppressFirstMoveNumber:
   *    - used by variations to avoid "2. 2." duplication
   */
  function renderSeq(n, container, moveNo, side, suppressFirstMoveNumber) {
    let cur = n;
    let m = moveNo;
    let s = side;
    let suppress = !!suppressFirstMoveNumber;

    while (cur) {

      // Print move number only for White moves, unless suppressed for first ply
      if (s === "w") {
        if (!suppress) container.appendChild(text(m + ". "));
        suppress = false;
      }

      appendMove(container, cur);
      container.appendChild(text(" "));

      // Inline comment
      if (cur.comment) {
        const c = document.createElement("span");
        c.className = "comment";
        c.textContent = "{" + cur.comment + "} ";
        container.appendChild(c);
      }

      if (s === "w") {
        // After printing the mainline White move, show White alternatives
        // from the position BEFORE this move (i.e., parent node vars).
        renderVars(container, cur.parent, m, "w");

        // Continue to Black reply
        cur = cur.next;
        s = "b";
        continue;
      }

      // s === "b"
      // After printing mainline Black move, show Black alternatives
      // from the position BEFORE this move (i.e., parent node vars).
      renderVars(container, cur.parent, m, "b");

      // Next full move
      cur = cur.next;
      m++;
      s = "w";
    }
  }

  /**
   * Renders variations stored in parent.vars, starting at moveNo/side.
   * parent.vars are alternatives from the position represented by parent.
   *
   * side:
   *  - "w": variations start with a White move -> print "(2." then the move
   *  - "b": variations start with a Black move -> print "(2... " then the move
   */
  function renderVars(container, parent, moveNo, side) {
    if (!parent || !parent.vars || parent.vars.length === 0) return;

    for (const v of parent.vars) {
      const span = document.createElement("span");
      span.className = "variation";

      if (side === "w") {
        // Desired style: (2.♘c3 ♘f6)
        span.appendChild(text("(" + moveNo + "."));
        renderSeq(v, span, moveNo, "w", true); // suppress first "2. "
        trim(span);
        span.appendChild(text(") "));
      } else {
        // Desired style: (2... ♘c6 ...)
        span.appendChild(text("(" + moveNo + "... "));
        renderSeq(v, span, moveNo, "b", false);
        trim(span);
        span.appendChild(text(") "));
      }

      container.appendChild(span);
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
      syncCommentEditor();
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
   *  COMMENT UI LOGIC
   * ====================================================== */

  function syncCommentEditor() {
    if (cursor === root) {
      commentEditor.style.display = "none";
      return;
    }
    commentEditor.value = cursor.comment || "";
  }

  btnCommentAdd.onclick = () => {
    if (cursor === root) return;
    commentEditor.style.display = "block";
    commentEditor.focus();
  };

  btnCommentSave.onclick = () => {
    if (cursor === root) return;
    cursor.comment = commentEditor.value.trim();
    commentEditor.style.display = "none";
    render();
  };


  /* ======================================================
   *  NAVIGATION CONTROLS
   * ====================================================== */

  btnStart.onclick = () => {
    cursor = root;
    rebuildTo(root, true);
    render();
    syncCommentEditor();
  };

  btnEnd.onclick = () => {
    let n = root;
    while (n.next) n = n.next;
    cursor = n;
    rebuildTo(n, true);
    render();
    syncCommentEditor();
  };

  btnPrev.onclick = () => {
    if (!cursor.parent) return;
    cursor = cursor.parent;
    rebuildTo(cursor, true);
    render();
    syncCommentEditor();
  };

  btnNext.onclick = () => {
    if (!cursor.next) return;
    cursor = cursor.next;
    rebuildTo(cursor, true);
    render();
    syncCommentEditor();
  };


  /* ======================================================
   *  BOARD ORIENTATION TOGGLE (PERSISTED)
   * ====================================================== */

  btnFlip.onclick = () => {
    boardOrientation = boardOrientation === "white" ? "black" : "white";
    board.orientation(boardOrientation);
    localStorage.setItem("boardOrientation", boardOrientation);
  };


  /* ======================================================
   *  INIT
   * ====================================================== */

  render();
  rebuildTo(root, false);

  // allow layout to settle before first resize
  setTimeout(() => board.resize(), 0);

});
