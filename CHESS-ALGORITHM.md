# Chess search

The move generator and game rules come from chess.js 1.4.0, vendored with its BSD-2-Clause licence. The search is a project-specific ant-inspired heuristic.

An ant explores a legal root move and a short sequence of legal replies. Candidate paths are chosen using pheromone weights and capture/check/promotion preferences. Evaluated paths deposit more pheromone for promising outcomes. At opponent turns, rewards are inverted when depositing traces. Root candidates receive an initial round-robin sample before pheromone-guided selection. Every 12 attempts trails evaporate by 10%.

Evaluation uses material, a small pawn-advance/development bonus, exact checkmate and draw detection. A separate immediate tactical guard recognises mate in one and root moves that allow an immediate opposing mate. That guard is not evidence that the stochastic colony independently learned tactics.

The default search is 192 attempts, six plies, and an explicit random seed. It runs in a module worker so the board remains responsive. Stop terminates the worker and plays no move. Search exports contain the starting FEN, seed, limits, candidate visit counts, heuristic scores and sampled move lines. A FEN does not contain earlier repetition history, so searches cannot reconstruct threefold repetition before the root position; the playable UI maintains the actual game history.

This is not Stockfish, a trained neural network or a solution to chess. Short rollouts can miss tactics, optimistic samples can favour bad moves, and terminal checks do not guarantee good play. Candidate bars are relative heuristic estimates, not calibrated win probabilities.

Run `node tests/chess-checks.mjs` for deterministic output, legal saved paths, immediate mate, terminal and cancellation checks. Browser checks must separately cover clicking moves, black replies, stopping, undo and the puzzle.

Source documentation: https://github.com/jhlywa/chess.js and https://jhlywa.github.io/chess.js/ .
