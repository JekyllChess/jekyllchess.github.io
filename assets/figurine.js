/* Figurine: Converts SAN to figurine notation */

  const FIGURINES = {
    K: "♔",
    Q: "♕",
    R: "♖",
    B: "♗",
    N: "♘",
  };

  function toFigurine(san) {
    if (!san) return san;
    let result = san;
    const firstChar = san.charAt(0);
    if (FIGURINES[firstChar]) {
      result = FIGURINES[firstChar] + san.slice(1);
    }
    result = result.replace(/=([KQRBN])/g, function (_, piece) {
      return "=" + FIGURINES[piece];
    });
    return result;
  }
