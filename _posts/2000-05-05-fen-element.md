---
layout: post
title: Static diagrams
---

Static chess diagrams are handled by the `<fen>` element.

## Single board diagram

```html
<fen>rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1</fen>
```

<fen>rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1</fen>

## Diagram with caption

```html
<fen>
[FEN "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"]
[Caption "Starting position"]
</fen>
```

<fen>
[FEN "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"]
[Caption "Starting position"]
</fen>

## Board orientation

```html
<fen>
[FEN "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"]
[Orientation "Black"]
</fen>
```

<fen>
[FEN "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"]
[Orientation "Black"]
</fen>

<div class="post-nav">
  <div>
    {% if page.previous.url %}
    <a href="{{page.previous.url}}">&laquo;&nbsp;{{page.previous.title}}</a>
    {% endif %}
  </div>
  <div class="post-nav-next">
    {% if page.next.url %}
    <a href="{{page.next.url}}">{{page.next.title}}&nbsp;&raquo;</a>
    {% endif %}
  </div>
</div>

<style>
h1 a {color:black;text-decoration:none;}
h1 a:active {color:black;text-decoration:none;cursor:pointer;}
h1 a:hover {color:black;text-decoration:none;cursor:pointer;}
</style>

<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.12.0/chess.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/chessboard-js/1.0.0/chessboard-1.0.0.min.js"></script>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/chessboard-js/1.0.0/chessboard-1.0.0.min.css">
<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">

<script type="module" src="/assets/ChessPublica.js"></script>
<link rel="stylesheet" href="/assets/ChessPublica.css" />