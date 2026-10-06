(() => {
  "use strict";

  const canvas = document.getElementById("mazeCanvas");
  const ctx = canvas.getContext("2d");
  const sizeSelect = document.getElementById("mazeSize");
  const statusText = document.getElementById("statusText");
  const routeLength = document.getElementById("routeLength");
  const searchWork = document.getElementById("searchWork");
  const resultNote = document.getElementById("resultNote");
  const exportButton = document.getElementById("exportButton");
  const directions = [
    { dx: 0, dy: -1, wall: "N", opposite: "S" },
    { dx: 1, dy: 0, wall: "E", opposite: "W" },
    { dx: 0, dy: 1, wall: "S", opposite: "N" },
    { dx: -1, dy: 0, wall: "W", opposite: "E" },
  ];

  let cells = [];
  let mazeSize = Number(sizeSelect.value);
  let currentResult = null;
  let recordedTrack = null;
  let animationId = 0;
  let recordingArmed = false;
  let videoObjectUrl = null;
  let random = Math.random;
  let benchmarkRecords = [];

  const indexOf = (x, y) => y * mazeSize + x;
  const coordsOf = (index) => ({ x: index % mazeSize, y: Math.floor(index / mazeSize) });
  const valid = (x, y) => x >= 0 && y >= 0 && x < mazeSize && y < mazeSize;
  const randomChoice = (items) => items[Math.floor(random() * items.length)];

  function seededRandom(seed) {
    let state = seed >>> 0;
    return () => {
      state += 0x6D2B79F5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function createMaze() {
    mazeSize = Number(sizeSelect.value);
    generateMazeCells();

    currentResult = null;
    recordedTrack = null;
    animationId++;
    updateSummary(null);
    updateTrackControls();
    document.getElementById("gridLabel").textContent = `${mazeSize} × ${mazeSize} cells`;
    statusText.textContent = "New maze ready";
    drawMaze();
    document.getElementById("arenaMaze")?.getContext("2d").drawImage(canvas,0,0);
  }

  function generateMazeCells() {
    cells = Array.from({ length: mazeSize * mazeSize }, () => ({ N: true, E: true, S: true, W: true }));
    const visited = new Uint8Array(cells.length);
    const stack = [0];
    visited[0] = 1;

    while (stack.length) {
      const current = stack[stack.length - 1];
      const { x, y } = coordsOf(current);
      const choices = directions
        .map((dir) => ({ dir, x: x + dir.dx, y: y + dir.dy }))
        .filter((n) => valid(n.x, n.y) && !visited[indexOf(n.x, n.y)]);
      if (!choices.length) {
        stack.pop();
        continue;
      }
      const next = randomChoice(choices);
      const nextIndex = indexOf(next.x, next.y);
      cells[current][next.dir.wall] = false;
      cells[nextIndex][next.dir.opposite] = false;
      visited[nextIndex] = 1;
      stack.push(nextIndex);
    }

    // Add a few extra openings so more than one route can exist.
    const extraOpenings = Math.floor(cells.length * 0.055);
    for (let i = 0; i < extraOpenings; i++) {
      const x = Math.floor(random() * mazeSize);
      const y = Math.floor(random() * mazeSize);
      const options = directions.filter((d) => valid(x + d.dx, y + d.dy) && cells[indexOf(x, y)][d.wall]);
      if (!options.length) continue;
      const d = randomChoice(options);
      const here = indexOf(x, y);
      const there = indexOf(x + d.dx, y + d.dy);
      cells[here][d.wall] = false;
      cells[there][d.opposite] = false;
    }

  }

  function neighbors(index) {
    const { x, y } = coordsOf(index);
    return directions
      .filter((d) => !cells[index][d.wall] && valid(x + d.dx, y + d.dy))
      .map((d) => indexOf(x + d.dx, y + d.dy));
  }

  function solveAStar() {
    const started = performance.now();
    const start = 0;
    const goal = cells.length - 1;
    const gScore = new Float64Array(cells.length).fill(Infinity);
    const previous = new Int32Array(cells.length).fill(-1);
    const closed = new Uint8Array(cells.length);
    const open = [start];
    let expanded = 0;
    gScore[start] = 0;

    const heuristic = (index) => {
      const a = coordsOf(index);
      const b = coordsOf(goal);
      return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    };

    while (open.length) {
      let bestAt = 0;
      for (let i = 1; i < open.length; i++) {
        const currentBest = open[bestAt];
        const candidate = open[i];
        if (gScore[candidate] + heuristic(candidate) < gScore[currentBest] + heuristic(currentBest)) bestAt = i;
      }
      const current = open.splice(bestAt, 1)[0];
      if (closed[current]) continue;
      closed[current] = 1;
      expanded++;
      if (current === goal) {
        const path = reconstruct(previous, goal);
        return { path, expanded, elapsed: performance.now() - started, method: "A*", note: "Shortest route found through the maze." };
      }
      for (const next of neighbors(current)) {
        if (closed[next]) continue;
        const possible = gScore[current] + 1;
        if (possible < gScore[next]) {
          gScore[next] = possible;
          previous[next] = current;
          open.push(next);
        }
      }
    }
    return { path: [], expanded, elapsed: performance.now() - started, method: "A*", note: "No route found." };
  }

  function reconstruct(previous, goal) {
    const path = [];
    let cursor = goal;
    while (cursor !== -1) {
      path.push(cursor);
      cursor = previous[cursor];
    }
    return path.reverse();
  }

  function solveAntColony(settings = {}) {
    const started = performance.now();
    const start = 0;
    const goal = cells.length - 1;
    const rounds = settings.rounds ?? 42;
    const antsPerRound = settings.antsPerRound ?? Math.max(24, Math.min(72, Math.round(mazeSize * 1.7)));
    const pheromone = new Map();
    let bestPath = [];
    let longestAttempt = [];
    const exploredCells = new Set([start]);
    let bestLength = Infinity;
    let completedAnts = 0;

    const edgeKey = (a, b) => a < b ? `${a}:${b}` : `${b}:${a}`;
    const trail = (a, b) => pheromone.get(edgeKey(a, b)) ?? 1;
    const chooseNext = (options, current) => {
      const weighted = options.map((next) => {
        const p = Math.pow(trail(current, next), 1.15);
        const distance = heuristicDistance(next, goal);
        const h = Math.pow(1 / (distance + 1), 2.25);
        return { next, weight: p * h };
      });
      let total = weighted.reduce((sum, item) => sum + item.weight, 0);
      let pick = random() * total;
      for (const item of weighted) {
        pick -= item.weight;
        if (pick <= 0) return item.next;
      }
      return weighted[weighted.length - 1].next;
    };

    for (let round = 0; round < rounds; round++) {
      const foundThisRound = [];
      for (let ant = 0; ant < antsPerRound; ant++) {
        const path = [start];
        const seen = new Uint8Array(cells.length);
        seen[start] = 1;
        let current = start;
        for (let step = 0; step < cells.length && current !== goal; step++) {
          const options = neighbors(current).filter((next) => !seen[next]);
          if (!options.length) break;
          current = chooseNext(options, current);
          path.push(current);
          exploredCells.add(current);
          seen[current] = 1;
        }
        if (current !== goal && path.length > longestAttempt.length) longestAttempt = path.slice();
        if (current === goal) {
          completedAnts++;
          foundThisRound.push(path);
          if (path.length < bestLength) {
            bestLength = path.length;
            bestPath = path;
          }
        }
      }

      for (const [key, value] of pheromone.entries()) pheromone.set(key, Math.max(0.15, value * 0.72));
      for (const path of foundThisRound) {
        const reward = 2.0 / (path.length - 1);
        for (let i = 1; i < path.length; i++) {
          const key = edgeKey(path[i - 1], path[i]);
          pheromone.set(key, (pheromone.get(key) ?? 1) + reward);
        }
      }
    }

    return {
      path: bestPath,
      longestAttempt,
      coverage: exploredCells.size / cells.length,
      pheromone,
      completedAnts,
      antsPerRound,
      rounds,
      elapsed: performance.now() - started,
      method: "Virtual ants",
      note: bestPath.length ? `Best route found by ${completedAnts} successful virtual ants.` : "No virtual ant reached the goal; try another maze or run again.",
    };
  }

  async function runBenchmark() {
    const count = Number(document.getElementById("benchmarkCount").value);
    const testSize = Number(sizeSelect.value);
    const button = document.getElementById("benchmarkButton");
    const status = document.getElementById("benchmarkStatus");
    const resultsPanel = document.getElementById("benchmarkResults");
    const saved = { cells, mazeSize, random, currentResult, recordedTrack };
    const controls = ["mazeSize", "newMazeButton", "astarButton", "antsButton", "saveMazeButton", "loadMazeButton", "benchmarkCount"]
      .map((id) => document.getElementById(id));
    controls.forEach((control) => { control.disabled = true; });
    button.disabled = true;
    canvas.style.pointerEvents = "none";
    benchmarkRecords = [];
    resultsPanel.hidden = true;
    status.textContent = `Comparing both methods on ${count} repeatable ${testSize} × ${testSize} mazes…`;
    await new Promise((resolve) => window.setTimeout(resolve, 40));

    try {
      mazeSize = testSize;
      for (let i = 0; i < count; i++) {
        const seed = 481516 + testSize * 1009 + i * 7919;
        random = seededRandom(seed);
        generateMazeCells();
        const aStar = solveAStar();
        const ants = solveAntColony();
        const aStarSteps = aStar.path.length ? aStar.path.length - 1 : null;
        const antSteps = ants.path.length ? ants.path.length - 1 : null;
        benchmarkRecords.push({ seed, size: testSize, aStarSteps, antSteps });
        status.textContent = `Finished maze ${i + 1} of ${count}…`;
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      }
      renderBenchmarkResults();
      resultsPanel.hidden = false;
      status.textContent = `Finished: ${count} mazes, same layouts and settings each time.`;
    } catch (error) {
      status.textContent = `Comparison stopped: ${error.message || "unexpected error"}`;
    } finally {
      cells = saved.cells;
      mazeSize = saved.mazeSize;
      random = saved.random;
      currentResult = saved.currentResult;
      recordedTrack = saved.recordedTrack;
      controls.forEach((control) => { control.disabled = false; });
      button.disabled = false;
      canvas.style.pointerEvents = "";
      drawMaze();
    }
  }

  function renderBenchmarkResults() {
    const aStarRows = benchmarkRecords.filter((row) => row.aStarSteps !== null);
    const antRows = benchmarkRecords.filter((row) => row.antSteps !== null);
    const avg = (rows, key) => rows.length ? rows.reduce((sum, row) => sum + row[key], 0) / rows.length : null;
    const aStarAverage = avg(aStarRows, "aStarSteps");
    const antAverage = avg(antRows, "antSteps");
    document.getElementById("benchmarkAstarAverage").textContent = aStarAverage === null ? "—" : `${aStarAverage.toFixed(1)} steps`;
    document.getElementById("benchmarkAntAverage").textContent = antAverage === null ? "No routes" : `${antAverage.toFixed(1)} steps`;
    document.getElementById("benchmarkSuccess").textContent = `${antRows.length} / ${benchmarkRecords.length}`;

    const rows = document.getElementById("benchmarkRows");
    rows.replaceChildren();
    for (const record of benchmarkRecords) {
      const tr = document.createElement("tr");
      const extra = record.antSteps === null ? "—" : `+${record.antSteps - record.aStarSteps}`;
      for (const value of [record.seed, record.aStarSteps ?? "—", record.antSteps ?? "No route", extra]) {
        const td = document.createElement("td");
        td.textContent = String(value);
        tr.appendChild(td);
      }
      rows.appendChild(tr);
    }
  }

  function exportBenchmark() {
    if (!benchmarkRecords.length) return;
    const lines = ["maze_seed,maze_size,astar_steps,virtual_ant_steps"];
    benchmarkRecords.forEach((row) => lines.push(`${row.seed},${row.size},${row.aStarSteps ?? ""},${row.antSteps ?? ""}`));
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "antlab-benchmark-results.csv";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  function heuristicDistance(a, b) {
    const p = coordsOf(a);
    const q = coordsOf(b);
    return Math.abs(p.x - q.x) + Math.abs(p.y - q.y);
  }

  function updateSummary(result) {
    currentResult = result;
    exportButton.disabled = !result || !result.path.length;
    if (!result) {
      routeLength.textContent = "—";
      searchWork.textContent = "—";
      resultNote.textContent = "Run a search to see how it did.";
      return;
    }
    routeLength.textContent = result.path.length ? `${result.path.length - 1} steps` : "No route";
    searchWork.textContent = result.method === "A*" ? `${result.expanded} cells` : `${result.rounds} rounds`;
    resultNote.textContent = `${result.note} ${result.elapsed.toFixed(1)} ms on this computer.`;
  }

  function drawMaze(progress = 1) {
    const width = canvas.width;
    const height = canvas.height;
    const cellW = width / mazeSize;
    const cellH = height / mazeSize;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#fbfcfa";
    ctx.fillRect(0, 0, width, height);

    if (currentResult?.pheromone) drawPheromone(currentResult.pheromone, cellW, cellH);

    if (currentResult?.path?.length) {
      const count = Math.max(1, Math.ceil(currentResult.path.length * progress));
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        const p = centerOf(currentResult.path[i], cellW, cellH);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle = currentResult.method === "Virtual ants" ? "#e49a38" : "#2783dc";
      ctx.lineWidth = Math.max(2.4, cellW * 0.14);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke();
    }

    if (recordedTrack?.length) drawRecordedTrack(recordedTrack, cellW, cellH);

    ctx.strokeStyle = "#243832";
    ctx.lineWidth = Math.max(1.4, cellW * 0.075);
    ctx.lineCap = "square";
    ctx.beginPath();
    for (let y = 0; y < mazeSize; y++) {
      for (let x = 0; x < mazeSize; x++) {
        const c = cells[indexOf(x, y)];
        const left = x * cellW;
        const top = y * cellH;
        if (c.N) { ctx.moveTo(left, top); ctx.lineTo(left + cellW, top); }
        if (c.W) { ctx.moveTo(left, top); ctx.lineTo(left, top + cellH); }
        if (x === mazeSize - 1 && c.E) { ctx.moveTo(left + cellW, top); ctx.lineTo(left + cellW, top + cellH); }
        if (y === mazeSize - 1 && c.S) { ctx.moveTo(left, top + cellH); ctx.lineTo(left + cellW, top + cellH); }
      }
    }
    ctx.stroke();

    drawMarker(0, cellW, cellH, "#ed5148");
    drawMarker(cells.length - 1, cellW, cellH, "#315ce4");
  }

  function centerOf(index, cellW, cellH) {
    const p = coordsOf(index);
    return { x: (p.x + 0.5) * cellW, y: (p.y + 0.5) * cellH };
  }

  function drawMarker(index, cellW, cellH, color) {
    const p = centerOf(index, cellW, cellH);
    ctx.beginPath();
    ctx.arc(p.x, p.y, cellW * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = Math.max(2, cellW * 0.1);
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
  }

  function drawRecordedTrack(track, cellW, cellH) {
    ctx.beginPath();
    track.forEach((point, i) => {
      const p = centerOf(point.index, cellW, cellH);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.strokeStyle = "#9b58b5";
    ctx.lineWidth = Math.max(2.5, cellW * 0.12);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.setLineDash([Math.max(4, cellW * 0.28), Math.max(3, cellW * 0.16)]);
    ctx.stroke();
    ctx.setLineDash([]);
    for (const point of [track[0], track[track.length - 1]]) {
      const p = centerOf(point.index, cellW, cellH);
      ctx.beginPath();
      ctx.arc(p.x, p.y, cellW * 0.21, 0, Math.PI * 2);
      ctx.fillStyle = "#9b58b5";
      ctx.fill();
    }
  }

  function drawPheromone(field, cellW, cellH) {
    let max = 1;
    for (const v of field.values()) max = Math.max(max, v);
    for (const [key, value] of field.entries()) {
      if (value < 1.3) continue;
      const [a, b] = key.split(":").map(Number);
      const p = centerOf(a, cellW, cellH);
      const q = centerOf(b, cellW, cellH);
      const strength = Math.min(0.52, (value - 1) / max);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
      ctx.strokeStyle = `rgba(228, 154, 56, ${strength})`;
      ctx.lineWidth = Math.max(1.5, cellW * 0.18 * strength);
      ctx.lineCap = "round";
      ctx.stroke();
    }
  }

  function animateResult(result) {
    animationId++;
    const thisAnimation = animationId;
    const start = performance.now();
    const duration = Math.min(2200, Math.max(450, result.path.length * 10));
    const tick = (now) => {
      if (thisAnimation !== animationId) return;
      const progress = Math.min(1, (now - start) / duration);
      drawMaze(progress);
      document.getElementById("arenaMaze")?.getContext("2d").drawImage(canvas,0,0);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function exportRoute() {
    if (!currentResult?.path?.length) return;
    const lines = ["step,cell_x,cell_y,method"];
    currentResult.path.forEach((index, step) => {
      const p = coordsOf(index);
      lines.push(`${step},${p.x},${p.y},${currentResult.method}`);
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `antlab-${currentResult.method.toLowerCase().replaceAll(" ", "-")}-route.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function saveMaze() {
    const data = { format: "antlab-maze", version: 1, size: mazeSize, start: 0, goal: cells.length - 1, cells };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `antlab-maze-${mazeSize}x${mazeSize}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    statusText.textContent = "Maze file saved";
  }

  function saveExperimentRecord() {
    const track = (recordedTrack ?? []).map((point) => {
      const { x, y } = coordsOf(point.index);
      return { step: point.step, time_s: point.time, cell_x: x, cell_y: y };
    });
    const data = {
      format: "antlab-experiment",
      version: 1,
      savedAt: new Date().toISOString(),
      trial: {
        name: document.getElementById("trialName").value.trim(),
        notes: document.getElementById("trialNotes").value.trim(),
      },
      maze: { format: "antlab-maze", version: 1, size: mazeSize, start: 0, goal: cells.length - 1, cells },
      recordedTrack: track,
      benchmark: benchmarkRecords.map((row) => ({ ...row })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `antlab-experiment-${mazeSize}x${mazeSize}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    statusText.textContent = "Experiment record saved";
  }

  function loadExperimentFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (data.format !== "antlab-experiment" || data.version !== 1) throw new Error("This is not a supported AntLab experiment file.");
        const maze = data.maze;
        if (!maze || maze.format !== "antlab-maze" || maze.version !== 1 || !Number.isInteger(maze.size) || maze.size < 2 || maze.size > 60) throw new Error("The experiment file has invalid maze details.");
        if (!Array.isArray(maze.cells) || maze.cells.length !== maze.size * maze.size) throw new Error("The experiment maze has the wrong number of cells.");
        const parsed = maze.cells.map((cell) => {
          if (!cell || ["N", "E", "S", "W"].some((wall) => typeof cell[wall] !== "boolean")) throw new Error("Some maze cells are missing wall information.");
          return { N: cell.N, E: cell.E, S: cell.S, W: cell.W };
        });
        for (let y = 0; y < maze.size; y++) {
          for (let x = 0; x < maze.size; x++) {
            const i = y * maze.size + x;
            if (x < maze.size - 1 && parsed[i].E !== parsed[i + 1].W) throw new Error("The experiment maze has mismatched walls.");
            if (y < maze.size - 1 && parsed[i].S !== parsed[i + maze.size].N) throw new Error("The experiment maze has mismatched walls.");
          }
        }
        const trackData = data.recordedTrack ?? [];
        if (!Array.isArray(trackData)) throw new Error("The recorded path data is invalid.");
        const parsedTrack = trackData.map((point, row) => {
          if (!point || !Number.isInteger(point.cell_x) || !Number.isInteger(point.cell_y) || point.cell_x < 0 || point.cell_y < 0 || point.cell_x >= maze.size || point.cell_y >= maze.size || !Number.isFinite(point.step) || !Number.isFinite(point.time_s)) throw new Error(`Recorded position ${row + 1} is invalid.`);
          return { index: point.cell_y * maze.size + point.cell_x, step: point.step, time: point.time_s };
        }).sort((a, b) => a.step - b.step);
        const benchmarks = data.benchmark ?? [];
        if (!Array.isArray(benchmarks) || benchmarks.some((row) => !row || !Number.isInteger(row.seed) || !Number.isInteger(row.size) || !(row.aStarSteps === null || Number.isFinite(row.aStarSteps)) || !(row.antSteps === null || Number.isFinite(row.antSteps)))) throw new Error("The comparison results are invalid.");

        mazeSize = maze.size;
        cells = parsed;
        recordedTrack = parsedTrack.length ? parsedTrack : null;
        benchmarkRecords = benchmarks.map((row) => ({ ...row }));
        if (![...sizeSelect.options].some((option) => Number(option.value) === mazeSize)) sizeSelect.add(new Option(`${mazeSize} × ${mazeSize} · loaded`, String(mazeSize)));
        sizeSelect.value = String(mazeSize);
        currentResult = null;
        animationId++;
        updateSummary(null);
        updateTrackControls();
        document.getElementById("gridLabel").textContent = `${mazeSize} × ${mazeSize} cells`;
        document.getElementById("trialName").value = String(data.trial?.name ?? "").slice(0, 80);
        document.getElementById("trialNotes").value = String(data.trial?.notes ?? "").slice(0, 500);
        const resultsPanel = document.getElementById("benchmarkResults");
        resultsPanel.hidden = benchmarkRecords.length === 0;
        if (benchmarkRecords.length) {
          renderBenchmarkResults();
          document.getElementById("benchmarkStatus").textContent = `Loaded ${benchmarkRecords.length} saved comparison results.`;
        } else {
          document.getElementById("benchmarkStatus").textContent = "This record has no comparison results.";
        }
        statusText.textContent = "Experiment record opened";
        document.getElementById("cameraStatus").textContent = recordedTrack?.length ? `Loaded ${recordedTrack.length} labeled positions from the experiment file.` : "No labeled video positions in this experiment record.";
        drawMaze();
      } catch (error) {
        window.alert(error.message || "Could not open this experiment file.");
      }
    };
    reader.onerror = () => window.alert("Could not read that experiment file.");
    reader.readAsText(file);
  }

  function loadMazeFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (data.format !== "antlab-maze" || data.version !== 1) throw new Error("This is not an AntLab maze file.");
        if (!Number.isInteger(data.size) || data.size < 2 || data.size > 60) throw new Error("The maze size must be between 2 and 60 cells.");
        if (!Array.isArray(data.cells) || data.cells.length !== data.size * data.size) throw new Error("The maze file has the wrong number of cells.");
        const parsed = data.cells.map((cell) => {
          if (!cell || ["N", "E", "S", "W"].some((wall) => typeof cell[wall] !== "boolean")) throw new Error("Some maze cells are missing wall information.");
          return { N: cell.N, E: cell.E, S: cell.S, W: cell.W };
        });
        for (let y = 0; y < data.size; y++) {
          for (let x = 0; x < data.size; x++) {
            const i = y * data.size + x;
            if (x < data.size - 1 && parsed[i].E !== parsed[i + 1].W) throw new Error("The maze has mismatched walls. Save it again from AntLab.");
            if (y < data.size - 1 && parsed[i].S !== parsed[i + data.size].N) throw new Error("The maze has mismatched walls. Save it again from AntLab.");
          }
        }
        mazeSize = data.size;
        cells = parsed;
        recordedTrack = null;
        if (![...sizeSelect.options].some((option) => Number(option.value) === mazeSize)) {
          sizeSelect.add(new Option(`${mazeSize} × ${mazeSize} · loaded`, String(mazeSize)));
        }
        sizeSelect.value = String(mazeSize);
        currentResult = null;
        animationId++;
        updateSummary(null);
        updateTrackControls();
        document.getElementById("gridLabel").textContent = `${mazeSize} × ${mazeSize} cells`;
        statusText.textContent = "Saved maze opened";
        drawMaze();
      } catch (error) {
        statusText.textContent = "Could not open maze file";
        window.alert(error.message || "Could not read this file.");
      }
    };
    reader.onerror = () => window.alert("Could not read that file.");
    reader.readAsText(file);
  }

  function loadTrackFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const lines = String(reader.result).trim().split(/\r?\n/).filter(Boolean);
        if (lines.length < 2) throw new Error("The CSV needs a header and at least one position row.");
        const headers = lines[0].split(",").map((header) => header.trim().toLowerCase());
        const xColumn = headers.indexOf("cell_x");
        const yColumn = headers.indexOf("cell_y");
        if (xColumn < 0 || yColumn < 0) throw new Error("Add column headers named cell_x and cell_y to the CSV.");
        const stepColumn = headers.indexOf("step");
        const timeColumn = headers.indexOf("time_s");
        const points = lines.slice(1).map((line, row) => {
          const values = line.split(",").map((value) => value.trim());
          const x = Number(values[xColumn]);
          const y = Number(values[yColumn]);
          const step = stepColumn >= 0 ? Number(values[stepColumn]) : row;
          const time = timeColumn >= 0 ? Number(values[timeColumn]) : row;
          if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isFinite(step) || !Number.isFinite(time)) throw new Error(`Check the position on CSV row ${row + 2}.`);
          if (!valid(x, y)) throw new Error(`Position on CSV row ${row + 2} is outside this maze.`);
          return { index: indexOf(x, y), step, time };
        }).sort((a, b) => a.step - b.step);
        recordedTrack = points.map((point) => ({ index: point.index, time: point.time ?? 0, step: point.step }));
        updateTrackControls();
        drawMaze();
        statusText.textContent = `Recorded path opened · ${points.length} points`;
      } catch (error) {
        statusText.textContent = "Could not open recorded path";
        window.alert(error.message || "Could not read that CSV file.");
      }
    };
    reader.onerror = () => window.alert("Could not read that CSV file.");
    reader.readAsText(file);
  }

  function updateTrackControls() {
    const count = recordedTrack?.length ?? 0;
    document.getElementById("trackCount").textContent = `${count} position${count === 1 ? "" : "s"} recorded`;
    document.getElementById("downloadTrackButton").disabled = count === 0;
    document.getElementById("clearTrackButton").disabled = count === 0;
  }

  function armPositionMark() {
    const video = document.getElementById("cameraVideo");
    const cameraStatus = document.getElementById("cameraStatus");
    if (!video.src) return;
    if (!video.paused) {
      cameraStatus.textContent = "Pause the video at the moment you want to record.";
      return;
    }
    recordingArmed = true;
    canvas.classList.add("recording-cell");
    document.getElementById("markPositionButton").textContent = "Now click the matching maze cell";
    cameraStatus.textContent = "Click the ant’s cell in the maze above. The video timestamp will be saved.";
  }

  function recordCellFromClick(event) {
    if (!recordingArmed) return;
    const bounds = canvas.getBoundingClientRect();
    const x = Math.floor(((event.clientX - bounds.left) / bounds.width) * mazeSize);
    const y = Math.floor(((event.clientY - bounds.top) / bounds.height) * mazeSize);
    if (!valid(x, y)) return;
    const video = document.getElementById("cameraVideo");
    if (!recordedTrack) recordedTrack = [];
    recordedTrack.push({ index: indexOf(x, y), time: video.currentTime, step: recordedTrack.length });
    recordedTrack.sort((a, b) => a.time - b.time || a.step - b.step);
    recordingArmed = false;
    canvas.classList.remove("recording-cell");
    document.getElementById("markPositionButton").textContent = "Mark position at this time";
    cameraStatus.textContent = `Saved position ${recordedTrack.length} at ${video.currentTime.toFixed(2)} seconds. Pause and mark the next one.`;
    updateTrackControls();
    drawMaze();
  }

  function saveVideoTrack() {
    if (!recordedTrack?.length) return;
    const lines = ["step,time_s,cell_x,cell_y"];
    recordedTrack.forEach((point, step) => {
      const { x, y } = coordsOf(point.index);
      lines.push(`${step},${point.time.toFixed(3)},${x},${y}`);
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "antlab-recorded-track.csv";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    document.getElementById("cameraStatus").textContent = "Video labels saved as a CSV file.";
  }

  function clearRecordedTrack() {
    recordedTrack = null;
    recordingArmed = false;
    canvas.classList.remove("recording-cell");
    document.getElementById("markPositionButton").textContent = "Mark position at this time";
    document.getElementById("cameraStatus").textContent = "Recorded positions cleared.";
    updateTrackControls();
    drawMaze();
  }

  function loadVideo(file) {
    const video = document.getElementById("cameraVideo");
    if (videoObjectUrl) URL.revokeObjectURL(videoObjectUrl);
    videoObjectUrl = URL.createObjectURL(file);
    video.src = videoObjectUrl;
    video.hidden = false;
    video.load();
    document.getElementById("videoPlaceholder").hidden = true;
    recordedTrack = null;
    updateTrackControls();
    document.getElementById("cameraStatus").textContent = "Video loaded. Pause it at an ant’s position, then click Mark position.";
    document.getElementById("markPositionButton").disabled = false;
  }

  canvas.addEventListener("click", recordCellFromClick);
  document.getElementById("chooseVideoButton").addEventListener("click", () => document.getElementById("videoInput").click());
  document.getElementById("videoInput").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) loadVideo(file);
    event.target.value = "";
  });
  document.getElementById("markPositionButton").addEventListener("click", armPositionMark);
  document.getElementById("downloadTrackButton").addEventListener("click", saveVideoTrack);
  document.getElementById("clearTrackButton").addEventListener("click", clearRecordedTrack);

  document.getElementById("newMazeButton").addEventListener("click", createMaze);
  document.getElementById("saveMazeButton").addEventListener("click", saveMaze);
  document.getElementById("loadMazeButton").addEventListener("click", () => document.getElementById("mazeFileInput").click());
  document.getElementById("mazeFileInput").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) loadMazeFile(file);
    event.target.value = "";
  });
  document.getElementById("importTrackButton").addEventListener("click", () => document.getElementById("trackFileInput").click());
  document.getElementById("trackFileInput").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) loadTrackFile(file);
    event.target.value = "";
  });
  sizeSelect.addEventListener("change", createMaze);
  document.getElementById("astarButton").addEventListener("click", () => {
    const result = solveAStar();
    updateSummary(result);
    statusText.textContent = result.path.length ? "Shortest route found" : "No route found";
    animateResult(result);
  });
  document.getElementById("antsButton").addEventListener("click", () => {
    statusText.textContent = "Virtual ants exploring…";
    window.setTimeout(() => {
      const result = solveAntColony();
      updateSummary(result);
      statusText.textContent = result.path.length ? "Virtual ants found a route" : "Try the ants again";
      drawMaze();
      if (result.path.length) animateResult(result);
    }, 20);
  });
  exportButton.addEventListener("click", exportRoute);
  document.getElementById("benchmarkButton").addEventListener("click", runBenchmark);
  document.getElementById("benchmarkExportButton").addEventListener("click", exportBenchmark);
  document.getElementById("saveExperimentButton").addEventListener("click", saveExperimentRecord);
  document.getElementById("openExperimentButton").addEventListener("click", () => document.getElementById("experimentFileInput").click());
  document.getElementById("experimentFileInput").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) loadExperimentFile(file);
    event.target.value = "";
  });

  // Adversarial search uses the existing ACO, with an explicit fixed budget.
  const evolutionPanel = document.createElement("section");
  evolutionPanel.className = "control-card";
  evolutionPanel.style.margin = "24px 0";
  evolutionPanel.innerHTML = `<p class="eyebrow">CHANGE THE MAZE</p><h2>Can we make the maze harder for the ants?</h2>
    <p>We change the maze a little, let the ants try it, and keep changes that make it harder. Every part of the maze stays reachable.</p>
    <label for="evolutionSeed">Repeat code <input id="evolutionSeed" type="number" min="0" max="4294967295" value="20261006"></label>
    <label for="evolutionGenerations">Rounds of changes <select id="evolutionGenerations"><option>5</option><option selected>10</option><option>20</option></select></label>
    <button class="button button-dark" id="evolutionStart">Make this maze harder</button>
    <button class="button button-outline" id="evolutionStop" disabled>Stop</button>
    <button class="button button-outline" id="evolutionExport" disabled>Download results</button>
    <p id="evolutionStatus" aria-live="polite">Two ways to change the maze get the same number of tries. At the end, new ant runs test both winners.</p>
    <div class="arena-metrics"><div><span>ANTS STUMPED · CHOSEN CHANGES</span><strong id="arenaEvolved">—</strong></div><div><span>ANTS STUMPED · RANDOM CHANGES</span><strong id="arenaRandom">—</strong></div><div><span>MAZES TRIED BY EACH METHOD</span><strong id="arenaBudget">—</strong></div></div>
    <div class="arena-live"><div><span class="arena-caption">HARDEST MAZE SO FAR · RED START → BLUE GOAL</span><canvas id="arenaMaze" width="900" height="900" aria-label="Hardest maze so far"></canvas></div><div><h3>Keep the changes that trip up the ants.</h3><p>One method keeps changes that make the maze harder. The other tries random changes. Both get the same number of tries. The ants’ rules stay the same.</p><p class="arena-caption">The numbers above come from five new ant runs. One experiment is a clue, not proof.</p></div></div>
    <div class="progress-card"><div class="progress-heading"><div><h3>Is the maze getting harder?</h3><p>Follow the hardest maze found after each round.</p></div><div class="progress-key"><span class="chosen-key">Chosen changes</span><span class="random-key">Random changes</span></div></div><canvas id="evolutionChart" width="1000" height="260" aria-label="Maze difficulty over rounds: chosen changes versus random changes"></canvas><p class="arena-caption">Higher means harder for these ants during the search.</p></div>
    <div style="overflow:auto"><table style="width:100%;text-align:left"><thead><tr><th>Round</th><th>Shortest route</th><th>Ants stumped</th><th>Extra distance*</th><th>Difficulty</th></tr></thead><tbody id="evolutionHistory"></tbody></table></div>
    <p>*Compared with the shortest route, for ants that reached the goal. Difficulty also considers failed runs and how much of the maze the ants explored.</p>
    <div class="hall-heading"><h3>Saved runs</h3><span>Saved on this device · latest 8 experiments</span></div>
    <p class="arena-caption">Watch the same ant run again. If the ants got stuck, we show their longest attempt and where it ended.</p><div id="failureHall"></div>`;
  evolutionPanel.classList.add("arena-panel");
  document.querySelector(".workspace")?.before(evolutionPanel);
  if (!evolutionPanel.isConnected) document.querySelector("footer").before(evolutionPanel);
  let evolutionCancelled = false;
  let evolutionRecord = null;
  let failureHall = [];
  try { failureHall = JSON.parse(localStorage.getItem("antlab-failures-v2") || "[]").filter(r => r.format === "antlab-adversarial-experiment" && r.version === 2).slice(0, 8); } catch (_) {}
  function renderHall() {
    const hall = document.getElementById("failureHall"); hall.replaceChildren();
    if (!failureHall.length) { hall.textContent = "Your first experiment will appear here. No preloaded results."; return; }
    failureHall.forEach((record, i) => {
      const row = document.createElement("div"); row.className = "failure-row";
      const label = document.createElement("span"); label.textContent = `#${failureHall.length-i} · ${record.size}×${record.size} maze · code ${record.seed} · ants stuck ${record.finalTest.failures}/5`;
      const button = document.createElement("button"); button.className = "button button-outline"; button.textContent = "Watch again";
      button.onclick = () => {
        mazeSize = record.size; sizeSelect.value = String(mazeSize); cells = copyCells(record.champion);
        recordedTrack = null; animationId++; updateTrackControls();
        document.getElementById("gridLabel").textContent = `${mazeSize} × ${mazeSize} cells`;
        const run = record.finalTest.runs.find(r => !r.success) || record.finalTest.runs[0];
        const old = random; let result;
        try { random = seededRandom(run.seed); result = solveAntColony(record.budget); } finally { random = old; }
        const reachedGoal = result.path.length > 0;
        if (!reachedGoal) result.path = result.longestAttempt;
        result.method = "Saved ant run"; result.note = `Run code ${run.seed}. ${reachedGoal ? "The ants reached the goal." : "The ants got stuck. Showing their longest attempt."}`;
        updateSummary(result); exportButton.disabled = !reachedGoal; animateResult(result);
        statusText.textContent = result.note;
        evolutionRecord = record; document.getElementById("evolutionExport").disabled = false;
        drawEvolutionChart(record.history);
        document.getElementById("arenaEvolved").textContent = `${record.finalTest.failures}/5`;
        document.getElementById("arenaRandom").textContent = `${record.randomSearch.freshSeedTest.failures}/5`;
        document.getElementById("arenaBudget").textContent = record.randomSearch.candidatesEvaluated;
        document.getElementById("evolutionHistory").replaceChildren();
        record.history.forEach(row=>{const tr=document.createElement("tr");[row.generation,`${row.shortest} steps`,`${row.failures}/3`,row.meanRatio===null?"—":`+${Math.round((row.meanRatio-1)*100)}%`,row.fitness.toFixed(3)].forEach(value=>{const td=document.createElement("td");td.textContent=value;tr.append(td)});document.getElementById("evolutionHistory").append(tr)});
        evolutionStatus.textContent = `Watching saved run ${run.seed}. ${reachedGoal ? "The ants reached the goal." : "The ants got stuck; this shows their longest attempt."}`;
        evolutionPanel.scrollIntoView({ behavior: "smooth", block: "start" });
      };
      row.append(label, button); hall.append(row);
    });
  }
  renderHall();
  function drawEvolutionChart(history) {
    const chart = document.getElementById("evolutionChart"), c = chart.getContext("2d");
    c.clearRect(0,0,chart.width,chart.height); c.fillStyle = "#6b7c70"; c.font = "26px monospace";
    c.fillText("Harder ↑",65,30);
    c.strokeStyle = "#dce6d8";
    for(const y of [55,100,145,190]){c.beginPath();c.moveTo(65,y);c.lineTo(965,y);c.stroke();}
    for (const [key,color] of [["fitness","#2e8056"],["randomFitness","#b47d22"]]) {
      c.strokeStyle=color; c.lineWidth=5; c.beginPath();
      history.forEach((r,i) => { const x=65+i*900/Math.max(1,history.length-1),y=190-r[key]/1.2*135; i?c.lineTo(x,y):c.moveTo(x,y); }); c.stroke();
    }
    c.fillStyle="#6b7c70"; c.fillText("Start",65,238); c.fillText(`Round ${history.at(-1)?.generation || 0}`,825,238);
  }
  const copyCells = value => value.map(c => ({ ...c }));
  function inspectGraph(value) {
    const distance = new Int32Array(value.length).fill(-1);
    const queue = [0]; distance[0] = 0;
    for (let head = 0; head < queue.length; head++) {
      const at = queue[head], x = at % mazeSize, y = Math.floor(at / mazeSize);
      for (const d of directions) {
        const nx = x + d.dx, ny = y + d.dy;
        if (valid(nx, ny) && !value[at][d.wall]) {
          const next = indexOf(nx, ny);
          if (value[next][d.opposite]) throw new Error("Asymmetric maze wall");
          if (distance[next] < 0) { distance[next] = distance[at] + 1; queue.push(next); }
        }
      }
    }
    return { reachable: queue.length, shortest: distance[value.length - 1] };
  }
  function mutateMaze(parent, rng) {
    for (let attempt = 0; attempt < 40; attempt++) {
      const child = copyCells(parent), opened = [], closed = [];
      for (let at = 0; at < child.length; at++) {
        const x = at % mazeSize, y = Math.floor(at / mazeSize);
        for (const d of directions.filter(d => d.wall === "E" || d.wall === "S")) {
          if (valid(x + d.dx, y + d.dy)) (child[at][d.wall] ? closed : opened).push({ at, next: indexOf(x + d.dx, y + d.dy), d });
        }
      }
      if (!opened.length || !closed.length) return copyCells(parent);
      const add = closed[Math.floor(rng() * closed.length)], remove = opened[Math.floor(rng() * opened.length)];
      child[add.at][add.d.wall] = child[add.next][add.d.opposite] = false;
      child[remove.at][remove.d.wall] = child[remove.next][remove.d.opposite] = true;
      if (inspectGraph(child).reachable === child.length) return child;
    }
    return copyCells(parent);
  }
  function evaluateMaze(value, seeds) {
    cells = copyCells(value);
    const graph = inspectGraph(cells);
    if (graph.reachable !== cells.length || graph.shortest < 1) throw new Error("Candidate is disconnected");
    const runs = seeds.map(seed => {
      random = seededRandom(seed);
      const result = solveAntColony({ rounds: 12, antsPerRound: 24 });
      for (let i = 1; i < result.path.length; i++) if (!neighbors(result.path[i - 1]).includes(result.path[i])) throw new Error("Solver returned an invalid route");
      return { seed, success: result.path.length > 0, moves: result.path.length ? result.path.length - 1 : null, path: result.path, coverage: result.coverage, longestAttempt: result.longestAttempt };
    });
    const successful = runs.filter(r => r.success);
    const failures = runs.length - successful.length;
    const meanRatio = successful.length ? successful.reduce((sum, r) => sum + r.moves / graph.shortest, 0) / successful.length : null;
    const excess = successful.length ? successful.reduce((sum, r) => sum + Math.min(2, r.moves / graph.shortest - 1), 0) / successful.length : 0;
    const failedRuns = runs.filter(r => !r.success);
    const unexplored = failedRuns.length ? failedRuns.reduce((sum,r)=>sum + 1-r.coverage,0)/failedRuns.length : 0;
    return { shortest: graph.shortest, failures, meanRatio, meanCoverage: runs.reduce((sum,r)=>sum+r.coverage,0)/runs.length, fitness: failures / runs.length + 0.1 * excess + 0.05 * unexplored, runs };
  }
  const evolutionStatus = document.getElementById("evolutionStatus");
  document.getElementById("evolutionStop").onclick = () => { evolutionCancelled = true; };
  document.getElementById("evolutionStart").onclick = async () => {
    const seedInput = Number(document.getElementById("evolutionSeed").value);
    if (!Number.isInteger(seedInput) || seedInput < 0 || seedInput > 4294967295) { evolutionStatus.textContent = "Use a whole-number repeat code between 0 and 4294967295."; return; }
    const original = copyCells(cells), oldRandom = random, seed = seedInput >>> 0;
    const generations = Number(document.getElementById("evolutionGenerations").value), rng = seededRandom(seed);
    const trainSeeds = [101, 202, 303].map(offset => (seed + offset) >>> 0);
    const testSeeds = [1001, 2002, 3003, 4004, 5005].map(offset => (seed + offset) >>> 0);
    const controls = Array.from(document.querySelectorAll("button,input,select")).map(element => ({ element, disabled: element.disabled }));
    controls.forEach(({ element }) => { element.disabled = true; });
    document.getElementById("evolutionStop").disabled = false;
    evolutionCancelled = false; animationId++; currentResult = null; recordedTrack = null; updateSummary(null); updateTrackControls();
    document.getElementById("arenaEvolved").textContent = "…";
    document.getElementById("arenaRandom").textContent = "…";
    const history = []; let champion = original;
    document.getElementById("evolutionHistory").innerHTML = "";
    try {
      let best = evaluateMaze(champion, trainSeeds);
      let randomChampion = copyCells(original), randomWinner = copyCells(original), randomBest = best, candidatesEvaluated = 0;
      const randomRng = seededRandom((seed ^ 0x9e3779b9) >>> 0);
      const baselineTest = evaluateMaze(original, testSeeds);
      for (let generation = 0; generation <= generations; generation++) {
        if (generation > 0) {
          for (let candidate = 0; candidate < 3; candidate++) {
            if (evolutionCancelled) break;
            const child = mutateMaze(champion, rng), score = evaluateMaze(child, trainSeeds);
            if (score.fitness > best.fitness) { champion = child; best = score; }
            // Unselected mutation walk: same number of proposals, without fitness-guided parents.
            randomChampion = mutateMaze(randomChampion, randomRng);
            const randomScore = evaluateMaze(randomChampion, trainSeeds);
            if (randomScore.fitness > randomBest.fitness) { randomBest = randomScore; randomWinner = copyCells(randomChampion); }
            candidatesEvaluated++;
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        }
        const row = { generation, shortest: best.shortest, failures: best.failures, meanRatio: best.meanRatio, fitness: best.fitness, randomFitness: randomBest.fitness };
        history.push(row);
        drawEvolutionChart(history);
        document.getElementById("arenaBudget").textContent = candidatesEvaluated;
        const tr = document.createElement("tr");
        [generation, `${best.shortest} steps`, `${best.failures}/3`, best.meanRatio === null ? "—" : `+${Math.round((best.meanRatio-1)*100)}%`, best.fitness.toFixed(3)].forEach(value => { const td = document.createElement("td"); td.textContent = value; tr.append(td); });
        document.getElementById("evolutionHistory").append(tr);
        cells = copyCells(champion); drawMaze();
        document.getElementById("arenaMaze").getContext("2d").drawImage(canvas,0,0);
        evolutionStatus.textContent = `Round ${generation} of ${generations}: the maze stumped the ants in ${best.failures} of 3 tries. Every cell is still reachable.`;
        await new Promise(resolve => setTimeout(resolve, 0));
        if (evolutionCancelled) break;
      }
      const finalTest = evaluateMaze(champion, testSeeds);
      const randomTest = evaluateMaze(randomWinner, testSeeds);
      evolutionRecord = { format: "antlab-adversarial-experiment", version: 2, seed, size: mazeSize, budget: { rounds: 12, antsPerRound: 24 }, trainSeeds, testSeeds, stopped: evolutionCancelled, original, champion: copyCells(champion), history, selection: best, baselineTest, finalTest, randomSearch: { method: "unselected mutation walk, best retained", candidatesEvaluated, champion: copyCells(randomWinner), selection: randomBest, freshSeedTest: randomTest }, solver: { name: "ACO", pheromoneExponent: 1.15, heuristicExponent: 2.25, evaporationRetention: 0.72 }, createdAt: new Date().toISOString() };
      document.getElementById("arenaEvolved").textContent = `${finalTest.failures}/5`;
      document.getElementById("arenaRandom").textContent = `${randomTest.failures}/5`;
      failureHall.unshift(evolutionRecord); failureHall = failureHall.slice(0,8);
      try { localStorage.setItem("antlab-failures-v2", JSON.stringify(failureHall)); } catch (_) { evolutionStatus.textContent = "Device storage full; export to keep your evidence."; }
      renderHall();
      cells = copyCells(champion); drawMaze();
      document.getElementById("arenaMaze").getContext("2d").drawImage(canvas,0,0);
      evolutionStatus.textContent = `${evolutionCancelled ? "Stopped" : "Finished"}. New ant runs got stuck: starting maze ${baselineTest.failures}/5, chosen changes ${finalTest.failures}/5, random changes ${randomTest.failures}/5. Each method tried ${candidatesEvaluated} mazes. Try more starting mazes before drawing a conclusion.`;
    } catch (error) { cells = original; drawMaze(); evolutionRecord = null; evolutionStatus.textContent = `Experiment failed: ${error.message}`; }
    finally {
      random = oldRandom;
      controls.forEach(({ element, disabled }) => { element.disabled = disabled; });
      document.getElementById("evolutionStop").disabled = true;
      document.getElementById("evolutionExport").disabled = !evolutionRecord;
      updateTrackControls();
    }
  };
  document.getElementById("evolutionExport").onclick = () => {
    if (!evolutionRecord) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(evolutionRecord, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `antlab-evolution-${evolutionRecord.seed}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  createMaze();
})();
