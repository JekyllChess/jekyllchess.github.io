---
layout: default
title: Home
---

<puzzle>
[FEN "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 1"]
[FirstMoveAuto "false"]

1. Qxf7#
</puzzle>

<puzzle>
[FEN "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 1"]
[FirstMoveAuto "false"]

1. Qxf7#
</puzzle>

{% for post in site.posts %}
📌 [{{ post.title }}]({{ post.url }})
{% endfor %}

<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.12.0/chess.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/chessboard-js/1.0.0/chessboard-1.0.0.min.js"></script>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/chessboard-js/1.0.0/chessboard-1.0.0.min.css">
<script type="module" src="/assets/index.js"></script>
<link rel="stylesheet" href="/assets/jekyllchess.css" />

<!-- ![SatranChess](https://www.satranchess.com/images/banner.jpg) -->
