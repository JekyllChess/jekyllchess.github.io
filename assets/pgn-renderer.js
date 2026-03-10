import { NBSP } from "./configuration.js";
import { toFigurine } from "./figurine.js";
import { buildMoveTree } from "./tree-builder.js";
import { createBoard } from "./board.js";

function renderNAG(nags) {
  if (!nags || nags.length === 0) return "";
  const map = {
    $1: "!",
    $2: "?",
    $3: "!!",
    $4: "??",
    $5: "!?",
    $6: "?!",
  };
  return nags.map((n) => map[n] || "").join("");
}

function flushBuffer(parent, text, isVariation) {
  if (!text.trim()) return;
  const p = document.createElement("p");
  p.className = isVariation ? "pgn-variation-line" : "pgn-mainline";
  p.textContent = text.trim();
  parent.appendChild(p);
}

function renderCommentBlock(parent, text) {
  const p = document.createElement("p");
  p.className = "pgn-comment";
  p.textContent = text;
  parent.appendChild(p);
}

function parseHeaders(pgnText) {
  const headers = {};
  const regex = /\[(\w+)\s+"([^"]*)"\]/g;
  let match;
  while ((match = regex.exec(pgnText))) {
    headers[match[1]] = match[2];
  }
  return headers;
}

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
    meta.textContent = site && date ? site + ", " + date : site || date;
    div.appendChild(meta);
  }

  container.appendChild(div);
}

export { renderNAG, flushBuffer, renderCommentBlock, parseHeaders, renderHeaders, buildMoveTree, createBoard, toFigurine };