---
layout: home
---

figurine.js replaces piece letters in chess notation (like K, Q, R, B, N) with their figurine Unicode symbols (♔♕♖♗♘) in all visible text on the page. It scans all text nodes in the document for Standard Algebraic Notation (SAN) patterns. 

fen.js converts custom <fen> HTML tags into visual chess diagrams. Detects <fen> tags and turns them into boards rendered with the chessboard.js library. You can type [D] in PGN comments to insert diagrams, and use the frontmatter FEN: to use a diagram as post image on the homepage.

pgn.js is a PGN → HTML renderer. It turns a <pgn> element containing raw PGN text into a formatted chess game layout, using chess.js to parse the PGN data. Formats the header visually, Fully parses movetext including move numbers, variations, and comments. Translates Numeric Annotation Glyphs to unicode like ⩲ or ⇆. "+/=" converts to ⩲, and "=/∞" renders as ⯹.