/* ================= SMART BRANCH LOGIC ================= */

  function determineBranchFen(variationTokens, current, parentNode) {
    if (!current) return parentNode.fen;

    var firstMoveNumberToken = null;
    for (var k = 0; k < variationTokens.length; k++) {
      if (variationTokens[k].type === "moveNumber") {
        firstMoveNumberToken = variationTokens[k];
        break;
      }
    }

    var variationColor;
    if (firstMoveNumberToken && firstMoveNumberToken.value.includes("...")) {
      variationColor = "b";
    } else if (firstMoveNumberToken) {
      variationColor = "w";
    } else {
      variationColor = current.color === "w" ? "b" : "w";
    }

    var nextToMove = current.color === "w" ? "b" : "w";

    if (variationColor === nextToMove) {
      return current.fen;
    } else {
      return current.parent && current.parent.fen
        ? current.parent.fen
        : parentNode.fen;
    }
  }

  /* ================= HELPERS ================= */

  function parseCSL(data) {
    return data.split(",").map(function (entry) {
      return { color: entry[0], square: entry.slice(1) };
    });
  }

  function parseCAL(data) {
    return data.split(",").map(function (entry) {
      return {
        color: entry[0],
        from: entry.slice(1, 3),
        to: entry.slice(3, 5),
      };
    });
  }

  function findTokenIndex(pgnText, token) {
    return pgnText.indexOf(token);
  }
