/* ChessPublica landing page — tab navigation + sandbox renderers. */

const $ = (id) => document.getElementById(id);

/* ── Tab switching ────────────────────────────────────────── */

window.showTab = (tabId) => {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
    const targetTab = document.getElementById(`tab-${tabId}`);
    if (targetTab) targetTab.classList.remove('hidden');

    document.querySelectorAll('.tab-trigger').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tabId);
    });
};

document.addEventListener('click', (e) => {
    const trigger = e.target.closest('.tab-trigger');
    if (trigger && trigger.dataset.tab) {
        e.preventDefault();
        window.showTab(trigger.dataset.tab);
    }
});

/* ── Sandbox renderers ────────────────────────────────────── */

const BLANK_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function renderBlankBoard(host) {
    if (!host) return;
    host.innerHTML = '';
    const el = document.createElement('fen');
    el.textContent = BLANK_FEN;
    host.appendChild(el);
    if (window.JekyllChess && typeof window.JekyllChess.initAll === 'function') {
        window.JekyllChess.initAll();
    }
}

function renderInline(host, tagName, content) {
    if (!host) return;
    const trimmed = (content || '').trim();
    if (!trimmed) {
        renderBlankBoard(host);
        return;
    }
    host.innerHTML = '';
    const el = document.createElement(tagName);
    el.textContent = trimmed;
    host.appendChild(el);
    if (window.JekyllChess && typeof window.JekyllChess.initAll === 'function') {
        window.JekyllChess.initAll();
    }
}

function renderPlayer(host, content) {
    if (!host) return;
    const trimmed = (content || '').trim();
    if (!trimmed) {
        renderBlankBoard(host);
        return;
    }
    host.innerHTML = '';
    const el = document.createElement('pgn-player');
    el.textContent = trimmed;
    host.appendChild(el);
}

function renderPuzzle(host, fen, moves) {
    const cleanFen = (fen || '').trim();
    const cleanMoves = (moves || '').trim();
    if (!cleanFen || !cleanMoves) {
        renderBlankBoard(host);
        return;
    }
    const text = `[FEN "${cleanFen}"]\n\n${cleanMoves}`;
    renderInline(host, 'puzzle', text);
}

/* ── Defaults ─────────────────────────────────────────────── */

const DEFAULT_FEN = `[FEN "rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2"]
[Orientation "Black"]
[Caption "**Sicilian Defense** — Black's most popular reply to 1.e4."]`;

const DEFAULT_PGN = `[White "Morphy, Paul"]
[Black "Duke of Brunswick"]
[Event "Paris Opera Box"]
[Date "1858"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 {A pin that proves costly.} 4. dxe5 Bxf3 5. Qxf3 dxe5
6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7
12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0`;

const DEFAULT_PLAYER = `[White "Carlsen, Magnus"]
[Black "Nepomniachtchi, Ian"]
[Event "World Championship"]
[Date "2021"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 O-O
8. h3 Na5 9. Nxe5 Nxb3 10. axb3 Bb7 11. d3 d5 12. exd5 Qxd5 13. Qf3 Bd6
14. Kf1 Rfb8 15. Qxd5 Nxd5 16. Bd2 c5 17. Nf3 Rd8 18. Nc3 Nb4 19. Rec1 Rac8
20. Ne2 Nc6 21. Be3 Ne7 22. Bf4 Bxf4 23. Nxf4 Rxd3 24. Ra3 Rxa3 25. bxa3 g5
26. Nd3 c4 27. bxc4 bxc4 28. Nfe5 Nd5 29. Ke2 Bc6 30. Rb1 f6 31. Nf3 h6
32. h4 g4 33. Nfd2 Kf7 34. h5 Ke6 35. Rb6 Rb8 36. Rxb8 Bxb8 37. f4 gxf3+
38. Nxf3 Be5 39. Kd2 Bd6 40. Nfe1 Kf5 41. Kc1 Ne3 42. Kb2 Nd1+ 43. Kc1 Ne3
44. Kb2 Nd1+ 45. Ka2 Be5 46. Nb4 Bxb4 47. axb4 Kf4 48. Nf3 Kg4 49. Nd2 Nb2
50. Nc4 Nxc4 51. Kb2 Nd6 52. Kc2 Kxh5 53. Kd3 Kg5 54. Ke3 a5 55. bxa5 Nb5
56. Kd4 h5 57. Kc5 Nxa3 58. Kxc4 h4 59. g3 hxg3 60. Kb3 Kf5 61. Kxa3 Kxe5 0-1`;

/* ── Init ─────────────────────────────────────────────────── */

function initSandbox() {
    const fenInput = $('sandbox-fen-input');
    const fenHost = $('sandbox-fen-board');
    const fenBtn = $('update-fen-btn');
    if (fenInput && fenHost && fenBtn) {
        fenInput.value = DEFAULT_FEN;
        fenBtn.addEventListener('click', () => renderInline(fenHost, 'fen', fenInput.value));
        renderBlankBoard(fenHost);
    }

    const puzzleFen = $('sandbox-puzzle-fen');
    const puzzleSolution = $('sandbox-puzzle-solution');
    const puzzleBtn = $('update-puzzle-btn');
    const puzzleHost = $('sandbox-puzzle-container');
    if (puzzleFen && puzzleSolution && puzzleBtn && puzzleHost) {
        puzzleBtn.addEventListener('click', () => renderPuzzle(puzzleHost, puzzleFen.value, puzzleSolution.value));
        renderBlankBoard(puzzleHost);
    }

    const pgnInput = $('sandbox-pgn-input');
    const pgnHost = $('sandbox-pgn-container');
    const pgnBtn = $('update-pgn-btn');
    if (pgnInput && pgnHost && pgnBtn) {
        pgnInput.value = DEFAULT_PGN;
        pgnBtn.addEventListener('click', () => renderInline(pgnHost, 'pgn', pgnInput.value));
        renderBlankBoard(pgnHost);
    }

    const playerInput = $('sandbox-player-input');
    const playerHost = $('sandbox-player-container');
    const playerBtn = $('update-player-btn');
    if (playerInput && playerHost && playerBtn) {
        playerInput.value = DEFAULT_PLAYER;
        playerBtn.addEventListener('click', () => renderPlayer(playerHost, playerInput.value));
        renderBlankBoard(playerHost);
    }
}

function init() {
    const yearEl = $('current-year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
    initSandbox();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
