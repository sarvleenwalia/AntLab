# Pilot experiment protocol

Record this plan before looking at results. Do not change it simply because the result is disappointing.

- Use 12×12 and 20×20 grids, 10 initial maze layouts per size, and 10 generations per experiment. Save each initial maze before running.
- Predeclare experiment seeds 1000–1009 for each grid size. The experiment seed fixes solver and mutation randomness, but **does not generate the initial maze**; save its JSON for full reproducibility.
- Keep the fixed ACO budget at 12 rounds × 24 ants. Standard workspace ACO has a different budget and must not be used as the main comparison.
- Each search gets 30 candidate evaluations plus its common original baseline. Both searches use identical selection seeds. Evaluate original, evolved and random-search winner on the five separate evaluation seeds embedded in the export.
- Primary measure: paired evolved-minus-random difference in evaluation failure rate **across initial layouts**. Also report original failure rate, coverage, shortest moves, successful route ratio and all-failure/all-success counts.
- Retain every run. Label cancelled runs incomplete and exclude them from the main fixed-budget analysis while keeping their raw evidence.
- Plot each layout's paired difference, not only a pooled number. Report uncertainty across layouts; five seeds on one maze do not establish generalisation.
- If most original mazes already produce 5/5 failures, record the saturation. A separate, explicitly versioned follow-up can increase solver budget or use smaller grids; do not silently merge those results with this protocol.

## Result template

Hypothesis:

Source revision:

Runs planned / completed / interrupted:

Paired results and uncertainty:

Examples that support the hypothesis:

Counterexamples, ties and failures:

What this result establishes:

What it does not establish:

Next experiment:
