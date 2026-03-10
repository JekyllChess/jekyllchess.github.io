function determineBranchFen(variationTokens, current, parentNode) {
  if (!current) return parentNode.fen;

  let firstMoveNumberToken = null;
  for (let k = 0; k < variationTokens.length; k++) {
    if (variationTokens[k].type === "moveNumber") {
      firstMoveNumberToken = variationTokens[k];
      break;
    }
  }

  let variationColor;
  if (firstMoveNumberToken && firstMoveNumberToken.value.includes("...")) {
    variationColor = "b";
  } else if (firstMoveNumberToken) {
    variationColor = "w";
  } else {
    variationColor = current.color === "w" ? "b" : "w";
  }

  let nextToMove = current.color === "w" ? "b" : "w";

  if (variationColor === nextToMove) {
    return current.fen;
  } else {
    return current.parent && current.parent.fen
      ? current.parent.fen
      : parentNode.fen;
  }
}

export { determineBranchFen };