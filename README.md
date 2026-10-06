# AntLab

Two browser experiments with virtual ants: **changing mazes** and **chess move search**.

- [Live maze experiment](https://sarvleenwalia.github.io/AntLab/)
- [Chess](https://sarvleenwalia.github.io/AntLab/chess.html)
- [What to document](DOCUMENTATION.md)
- [Experiment protocol](EXPERIMENT-PROTOCOL.md)
- [Maze architecture](ARCHITECTURE.md)
- [Chess search algorithm and limits](CHESS-ALGORITHM.md)
- [Build log](BUILD-LOG.md)

## Run locally

Serve this folder using `python -m http.server 8772`, then open http://localhost:8772. A server is required for chess module workers. There is no backend, API key or paid service.

## Maze experiment

Changes preserve connectivity and passage count. Fitness-guided search is compared with an equal-proposal unselected mutation walk. Separate ant runs evaluate the winners. Saved runs replay their exact maze, solver code and budget. A stopped/failed attempt is labeled clearly. Download results to keep both mazes, paths, coverage, settings and selection history.

## Chess experiment

Play white against the ants, ask them to suggest a move, or try the checkmate puzzle. The algorithm samples short legal move sequences using pheromone-guided choices, evaporation, evaluation and a separate immediate-mate guard. The rules come from chess.js 1.4.0; its BSD-2-Clause licence is in CHESS-LICENSE.txt. Search runs in a worker and can be stopped without playing a move.

## Tests

With Node.js 20+ installed:

```
node maze-checks.cjs
node chess-checks.mjs
```

Maze tests exercise connectivity, passage count, deterministic evaluation, matched candidate budgets and saved-seed replay. Chess tests check deterministic output, legal root moves and all saved rollouts, checkmate in one, terminal states and cancellation. Browser interactions were checked separately. Reports are included; automated-pilot.json is an actual algorithm run using a minimal DOM harness, not a real-ant trial.

## Honest scope

The maze solver stays fixed; no co-evolution or learned controller is claimed. Five ant runs on one maze are a pilot, not a generalisation study. The chess player is experimental and can lose. FEN-based search does not reconstruct pre-position repetition history. Ants are simulated; video labeling is manual. Implementation is AI-assisted. Keep original results, failed experiments and personal design decisions alongside this source.

GitHub Pages serves the repository root. No private account data or API keys are required.
