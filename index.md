---
layout: default
title: Home
---

<fen caption="Lucena Position — White to play and win">1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1</fen>
<fen caption="Philidor Position — Black draws">8/8/8/4k3/R7/4K3/4P3/3r4 w - - 0 1</fen>

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
