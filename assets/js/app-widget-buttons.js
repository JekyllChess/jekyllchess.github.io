document.addEventListener("DOMContentLoaded", () => {

  /* ======================================================
   * DOM
   * ====================================================== */

  const container = document.querySelector(".placeholder-controls");
  if (!container || !window.JC) return;

  container.innerHTML = "";

  function btn(icon, title) {
    const b = document.createElement("button");
    b.textContent = icon;
    b.title = title;
    return b;
  }

  const btnFen     = btn("📋", "Copy FEN");
  const btnPgn     = btn("📄", "Copy PGN");
  const btnComment = btn("➕", "Add comment");
  const btnPromote = btn("⬆️", "Promote variation");
  const btnDelete  = btn("🗑️", "Delete variation");

  container.append(btnFen, btnPgn, btnComment, btnPromote, btnDelete);


  /* ======================================================
   * HELPERS
   * ====================================================== */

  function getCursor() {
    return window.JC.getCursor();
  }

  function isVariation(node) {
    return node && node.parent && node.parent.next !== node;
  }

  function copy(text) {
    navigator.clipboard.writeText(text);
  }

  function serializePGN() {
    return document.getElementById("moves").innerText.trim();
  }

  function updateButtonStates() {
    const n = getCursor();
    const isVar = isVariation(n);

    btnPromote.disabled = !isVar;
    btnDelete.disabled  = !isVar;
    btnComment.disabled = !n || n === window.JC.getRoot();
  }


  /* ======================================================
   * BUTTON ACTIONS
   * ====================================================== */

  // 1️⃣ COPY FEN — FIXED
  btnFen.onclick = () => {
    const n = getCursor();
    if (!n || !n.fen) return;
    copy(n.fen);
  };

  // 2️⃣ COPY PGN (visual PGN)
  btnPgn.onclick = () => {
    copy(serializePGN());
  };

  // 3️⃣ ADD COMMENT (stored on node)
  btnComment.onclick = () => {
    const n = getCursor();
    if (!n || n === window.JC.getRoot()) return;

    const text = prompt("Comment for this move:");
    if (!text) return;

    n.comment = `{ ${text} }`;
    window.JC.render();
  };

  // 4️⃣ PROMOTE VARIATION → MAINLINE
  btnPromote.onclick = () => {
    const n = getCursor();
    if (!isVariation(n)) return;

    const p = n.parent;

    // remove from variations
    p.vars = p.vars.filter(v => v !== n);

    // demote current mainline
    if (p.next) p.vars.unshift(p.next);

    // promote selected variation
    p.next = n;

    window.JC.setCursor(n);
    window.JC.rebuildTo(n, true);
    window.JC.render();
  };

  // 5️⃣ DELETE VARIATION SUBTREE
  btnDelete.onclick = () => {
    const n = getCursor();
    if (!isVariation(n)) return;

    const p = n.parent;
    p.vars = p.vars.filter(v => v !== n);

    window.JC.setCursor(p);
    window.JC.rebuildTo(p, true);
    window.JC.render();
  };


  /* ======================================================
   * SELECTION TRACKING
   * ====================================================== */

  document.addEventListener("click", e => {
    if (e.target.classList.contains("move")) {
      setTimeout(updateButtonStates, 0);
    }
  });

  updateButtonStates();

});
