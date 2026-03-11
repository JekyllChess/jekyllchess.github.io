/* ================================================================
   PGN RENDERER
   Static renderer for <pgn> blocks
================================================================ */

import { NBSP } from "./configuration.js";
import { toFigurine } from "./figurine.js";
import { buildMoveTree } from "./tree-builder.js";
import { createBoard } from "./board.js";

/* ================================================================
   NAG RENDERING
================================================================ */

function renderNAG(nags) {

  if (!nags || !nags.length) return "";

  const map = {
    $1: "!",
    $2: "?",
    $3: "!!",
    $4: "??",
    $5: "!?",
    $6: "?!"
  };

  return nags.map(n => map[n] || "").join("");
}

/* ================================================================
   HEADER PARSER
================================================================ */

function parseHeaders(pgnText) {

  const headers = {};
  const regex = /\[(\w+)\s+"([^"]*)"\]/g;

  let match;

  while ((match = regex.exec(pgnText))) {
    headers[match[1]] = match[2];
  }

  return headers;
}

/* ================================================================
   HEADER RENDER
================================================================ */

function renderHeaders(headers, container) {

  const div = document.createElement("div");
  div.className = "pgn-headers";

  if (headers.White && headers.Black) {

    const players = document.createElement("div");
    players.className = "pgn-players";
    players.textContent = headers.White + " – " + headers.Black;

    div.appendChild(players);
  }

  if (headers.Site || headers.Date) {

    const meta = document.createElement("div");
    meta.className = "pgn-meta";

    const site = headers.Site || "";
    const date = headers.Date || "";

    meta.textContent =
      site && date ? site + ", " + date : site || date;

    div.appendChild(meta);
  }

  container.appendChild(div);
}

/* ================================================================
   PGN SPLITTING
   (critical stability improvement)
================================================================ */

function splitPGN(pgnText) {

  const headers = parseHeaders(pgnText);

  const movetext = pgnText
    .replace(/(?:\[[^\]]+\]\s*)+/g, "")
    .trim();

  return { headers, movetext };
}

/* ================================================================
   COMMENT CLEANING
================================================================ */

function cleanComment(comment) {

  if (!comment) return "";

  return comment
    .replace(/\[%cal [^\]]+\]/g, "")
    .replace(/\[%csl [^\]]+\]/g, "")
    .trim();
}

/* ================================================================
   ARROW + SQUARE PARSER
================================================================ */

function parseAnnotations(comment, board) {

  if (!comment || !board) return;

  const cal = comment.match(/\[%cal ([^\]]+)\]/);
  const csl = comment.match(/\[%csl ([^\]]+)\]/);

  if (cal && board.drawArrow) {

    cal[1].split(",").forEach(a => {

      const color = a[0];
      const from = a.slice(1,3);
      const to = a.slice(3,5);

      board.drawArrow(from, to, color);

    });

  }

  if (csl && board.highlightSquare) {

    csl[1].split(",").forEach(s => {

      const color = s[0];
      const sq = s.slice(1);

      board.highlightSquare(sq, color);

    });

  }
}

/* ================================================================
   COMMENT RENDER
================================================================ */

function renderCommentBlock(parent, text) {

  const clean = cleanComment(text);

  if (!clean) return;

  const div = document.createElement("div");
  div.className = "pgn-comment";
  div.textContent = clean;

  parent.appendChild(div);
}

/* ================================================================
   FAST LINE RENDERER (DocumentFragment optimization)
================================================================ */

function renderLine(node, container, board) {

  const fragment = document.createDocumentFragment();

  let cur = node;

  while (cur) {

    const span = document.createElement("span");
    span.className = "pgn-move";

    let label = "";

    if (cur.color === "w") {
      label += cur.moveNumber + "." + NBSP;
    }

    label += toFigurine(cur.san) + renderNAG(cur.nags);

    span.textContent = label + NBSP;

    span.addEventListener("click", () => {

      board.reset();

      const stack = [];
      let temp = cur;

      while (temp && temp.san) {
        stack.unshift(temp.san);
        temp = temp.parent;
      }

      stack.forEach(m => board.move(m));

      parseAnnotations(cur.comment, board);

    });

    fragment.appendChild(span);

    if (cur.comment) {

      const clean = cleanComment(cur.comment);

      if (clean) {

        const commentDiv = document.createElement("div");
        commentDiv.className = "pgn-comment";
        commentDiv.textContent = clean;

        fragment.appendChild(commentDiv);

      }

    }

    /* variations */

    if (cur.variations && cur.variations.length) {

      cur.variations.forEach(v => {

        const varDiv = document.createElement("div");
        varDiv.className = "pgn-variation";

        renderLine(v, varDiv, board);

        fragment.appendChild(varDiv);

      });

    }

    cur = cur.next;

  }

  container.appendChild(fragment);

}

/* ================================================================
   MAIN PGN RENDERER
================================================================ */

function renderFullPGN(pgnText, container) {

  container.innerHTML = "";

  if (!pgnText) {
    container.textContent = "Empty PGN.";
    return;
  }

  /* split headers and movetext */

  const { headers, movetext } = splitPGN(pgnText);

  renderHeaders(headers, container);

  const boardDiv = document.createElement("div");
  boardDiv.className = "jc-board";

  container.appendChild(boardDiv);

  const board = createBoard(boardDiv, headers.FEN || "start");

  const movesDiv = document.createElement("div");
  movesDiv.className = "pgn-moves";

  container.appendChild(movesDiv);

  const root = buildMoveTree(movetext);

  if (!root) return;

  renderLine(root, movesDiv, board);
}

/* ================================================================
   EXPORTS
================================================================ */

export {
  renderFullPGN,
  renderNAG,
  parseHeaders,
  renderHeaders,
  renderCommentBlock,
  buildMoveTree,
  createBoard,
  toFigurine
};