# AntLab Arena: evidence folder

Build a portfolio around a question: **Does fitness-guided maze mutation discover navigation failures more reliably than an equal-budget unselected mutation walk?**

This build evolves mazes against a fixed ant-colony solver. It does not train a neural network, co-evolve the solver, establish a new research field, or prove improved generalisation. A reviewer should be able to replay your result, inspect the baseline and understand your contribution.

## Put these in your project folder

| Folder/file | What to add |
|---|---|
| `01-problem.md` | Who needs stronger navigation tests; one concrete use case; the hypothesis; what the prototype can actually establish. |
| `02-architecture.md` | Data flow, maze encoding, mutation, validity checks, fixed solver, fitness, selection/evaluation separation, persistence. |
| `03-protocol.md` | Pre-declared seeds, grid sizes, generations, budgets, baseline, metrics and stopping rule. Use the accompanying protocol. |
| `evidence/raw/` | Unedited JSON from **Export experiment** for every run, including ties, failures and interrupted runs. |
| `evidence/summary.csv` | One row per experiment, with original/evolved/random-search failure counts, coverage, path ratios and candidate counts. Link each row to its raw JSON. |
| `evidence/replays/` | Short recordings of exact saved-seed failures and successes. Show start, goal, seed and budget. Do not label a partial attempt a solved route. |
| `tests/` | Executable connectivity, passage-count, reproducibility, complete-flow and replay checks; saved output and browser screenshots. |
| `build-log.md` | Dated decisions, bugs, changed hypotheses, screenshots and explanations. Include the fitness plateau and why coverage was added. |
| `limitations.md` | Fixed solver, small evaluation sample, variable shortest path, no physical-ant validation, synchronous browser work, storage limits. |
| `demo/` | A 45–60 second demo and a three-minute walkthrough. Keep an uncut run alongside the edited clip. |
| `contributions.md` | What you designed, what AI helped implement, what you tested yourself and which dependencies you used. |

Keep originals and run IDs. Commit source alongside evidence so results can be associated with a specific implementation. Five solver seeds on one selected maze are not five independent environments.

## Demo sequence

1. Show the problem: ordinary testing misses some navigation failures.
2. Set a maze, experiment seed and generation count; start evolution.
3. Point to the live champion and the green/amber selection curves.
4. Show held-out-seed results. Explain a tie or loss as honestly as a win.
5. Replay a saved failure; contrast it with the shortest-path reference.
6. Export the raw experiment. Finish with the specific experiment you will run next.

Do not stage an improvement and present it as typical. A compelling negative result is better evidence than an unsupported claim.
