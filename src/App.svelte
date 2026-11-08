<script>
  import { onMount } from 'svelte'
  import * as db from './lib/db.js'
  import {
    estimateVDOT, pacesFromVDOT, levelFromVDOT, formatTime, formatPace,
    parseTime, trailAdjustedPace, trailPaceRanges
  } from './lib/vdot.js'

  let tab = $state(localStorage.getItem('lastTab') || 'level')
  const tabs = [
    { id: 'level', label: 'Niveau' },
    { id: 'workouts', label: 'Séances' },
    { id: 'plans', label: 'Plans' },
    { id: 'timer', label: 'Minuteur' },
    { id: 'progress', label: 'Progrès' }
  ]

  function setTab(id) {
    tab = id
    localStorage.setItem('lastTab', id)
  }

  let evaluations = $state([])
  let workouts = $state([])
  let completed = $state([])

  let distKm = $state(10)
  let timeStr = $state('45:00')
  let result = $state(null)

  let trailDist = $state(20)
  let trailDplus = $state(800)
  let trailTime = $state('2:30:00')
  let trailCoeff = $state(1.0)
  let trailResult = $state(null)

  let timerRunning = $state(false)
  let timerPhase = $state('ready')
  let timerDisplay = $state('00:00')
  let timerRep = $state(0)
  let timerTotalReps = $state(8)
  let timerWork = $state(120)
  let timerRest = $state(60)
  let timerInterval = null
  let remaining = $state(0)

  onMount(async () => {
    evaluations = await db.getAll('evaluations')
    workouts = await db.getAll('workouts')
    completed = await db.getAll('completedSessions')
  })

  function calcRoute() {
    const distM = distKm * 1000
    const secs = parseTime(timeStr)
    if (!secs) return
    const vdot = estimateVDOT(distM, secs)
    const paces = pacesFromVDOT(vdot)
    const level = levelFromVDOT(vdot)
    result = { vdot, paces, level, distKm, timeStr }
  }

  async function saveEval() {
    if (!result) return
    const item = {
      id: db.uid(),
      type: 'route',
      vdot: result.vdot,
      level: result.level,
      distKm: result.distKm,
      timeStr: result.timeStr,
      createdAt: new Date().toISOString()
    }
    await db.put('evaluations', item)
    evaluations = await db.getAll('evaluations')
  }

  function calcTrail() {
    const secs = parseTime(trailTime)
    const adj = trailAdjustedPace(trailDist, trailDplus, secs, trailCoeff)
    const ranges = trailPaceRanges(adj.flatEquivPace)
    trailResult = { ...adj, ranges, dist: trailDist, dplus: trailDplus }
  }

  function startTimer() {
    if (timerRunning) return
    timerRunning = true
    timerRep = 1
    remaining = timerWork
    timerPhase = 'work'
    tick()
    timerInterval = setInterval(tick, 1000)
  }

  function tick() {
    remaining--
    const m = Math.floor(remaining / 60)
    const s = remaining % 60
    timerDisplay = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    if (remaining <= 0) {
      if (timerPhase === 'work') {
        if (timerRep >= timerTotalReps) {
          stopTimer()
          timerPhase = 'done'
          beep()
          return
        }
        timerPhase = 'rest'
        remaining = timerRest
        beep()
      } else {
        timerRep++
        timerPhase = 'work'
        remaining = timerWork
        beep()
      }
    }
  }

  function stopTimer() {
    timerRunning = false
    if (timerInterval) clearInterval(timerInterval)
    timerInterval = null
  }

  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.frequency.value = 880
      g.gain.value = 0.3
      o.start()
      setTimeout(() => { o.stop(); ctx.close() }, 150)
      if (navigator.vibrate) navigator.vibrate(100)
    } catch (e) {}
  }

  let wName = $state('')
  let wType = $state('fractionne')
  async function addWorkout() {
    if (!wName) return
    const item = {
      id: db.uid(),
      name: wName,
      type: wType,
      blocks: [
        { type: 'warmup', duration: 10 },
        { type: 'work', repetitions: 8, duration: 2 },
        { type: 'recovery', duration: 1 },
        { type: 'cooldown', duration: 10 }
      ],
      createdAt: new Date().toISOString()
    }
    await db.put('workouts', item)
    workouts = await db.getAll('workouts')
    wName = ''
  }

  async function exportData() {
    const data = await db.exportAll()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `runlab-export-${new Date().toISOString().slice(0,10)}.json`
    a.click()
  }

  const recentEvals = $derived(evaluations.filter(e => e.type === 'route').sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10))
  const totalKm = $derived(completed.reduce((s, c) => s + (c.distance || 0), 0))
</script>

<header class="header">
  <h1 class="display">RunLab</h1>
  <p class="tagline">Entraînement • Local-first</p>
</header>

<main>
  {#if tab === 'level'}
    <div class="page">
      <h2>Niveau Route</h2>
      <div class="card">
        <div class="card-title">Performance récente</div>
        <div class="row">
          <label>Distance (km)
            <input type="number" step="0.1" bind:value={distKm} />
          </label>
          <label>Temps (mm:ss ou h:mm:ss)
            <input type="text" bind:value={timeStr} placeholder="45:00" />
          </label>
        </div>
        <button class="btn btn-accent" onclick={calcRoute}>Calculer VDOT</button>
        {#if result}
          <div class="result">
            <div class="num text-accent" style="font-size:2.5rem">{result.vdot}</div>
            <div class="text-muted">{result.level?.label || ''}</div>
            {#if result.paces}
              <div class="paces">
                <div><span class="text-muted">E</span> {formatPace(result.paces.E)}</div>
                <div><span class="text-muted">M</span> {formatPace(result.paces.M)}</div>
                <div><span class="text-muted">T</span> {formatPace(result.paces.T)}</div>
                <div><span class="text-muted">I</span> {formatPace(result.paces.I)}</div>
                <div><span class="text-muted">R</span> {formatPace(result.paces.R)}</div>
              </div>
            {/if}
            <button class="btn" onclick={saveEval}>Sauvegarder</button>
          </div>
        {/if}
      </div>

      <h2 style="margin-top:1.5rem">Niveau Trail</h2>
      <div class="card">
        <div class="card-title">Performance trail</div>
        <div class="row">
          <label>Distance (km)<input type="number" bind:value={trailDist} /></label>
          <label>D+ (m)<input type="number" bind:value={trailDplus} /></label>
        </div>
        <div class="row">
          <label>Temps<input type="text" bind:value={trailTime} /></label>
          <label>Coeff (min/100m D+)<input type="number" step="0.1" bind:value={trailCoeff} /></label>
        </div>
        <button class="btn btn-accent" onclick={calcTrail}>Calculer</button>
        {#if trailResult}
          <div class="result">
            <div>Allure brute : <span class="num">{formatPace(trailResult.rawPace)}</span></div>
            <div>Équiv. plat : <span class="num text-accent">{formatPace(trailResult.flatEquivPace)}</span></div>
            <div class="text-muted" style="font-size:0.85rem">Montée ~{formatPace(trailResult.ranges.climb)} • Plat ~{formatPace(trailResult.ranges.flat)} • Descente ~{formatPace(trailResult.ranges.descent)}</div>
          </div>
        {/if}
      </div>
    </div>

  {:else if tab === 'workouts'}
    <div class="page">
      <h2>Séances</h2>
      <div class="card">
        <div class="card-title">Nouvelle séance</div>
        <input type="text" bind:value={wName} placeholder="Nom (ex. 8x400)" />
        <select bind:value={wType}>
          <option value="fractionne">Fractionné</option>
          <option value="endurance">Endurance</option>
          <option value="seuil">Seuil</option>
          <option value="recuperation">Récupération</option>
          <option value="trail">Trail</option>
        </select>
        <button class="btn btn-accent" onclick={addWorkout}>Créer</button>
      </div>
      {#each workouts as w}
        <div class="card list-item">
          <div>
            <strong>{w.name}</strong>
            <span class="text-muted" style="font-size:0.8rem;margin-left:0.5rem">{w.type}</span>
          </div>
        </div>
      {/each}
      {#if workouts.length === 0}
        <p class="text-muted">Aucune séance. Crée-en une.</p>
      {/if}
    </div>

  {:else if tab === 'plans'}
    <div class="page">
      <h2>Plans</h2>
      <div class="card">
        <p class="text-muted">Vue calendrier et glisser-déposer : structure prête (IndexedDB plans). Extension possible.</p>
        <p style="margin-top:0.5rem">Crée des séances puis assigne-les manuellement pour l’instant.</p>
      </div>
    </div>

  {:else if tab === 'timer'}
    <div class="page timer-page">
      <h2>Minuteur fractionné</h2>
      <div class="card">
        <div class="row">
          <label>Répétitions <input type="number" bind:value={timerTotalReps} min="1" /></label>
          <label>Effort (s) <input type="number" bind:value={timerWork} /></label>
          <label>Repos (s) <input type="number" bind:value={timerRest} /></label>
        </div>
        <div class="timer-display num text-accent">{timerDisplay}</div>
        <div class="text-muted">{timerPhase} {#if timerRunning}• {timerRep}/{timerTotalReps}{/if}</div>
        <div class="row" style="margin-top:1rem">
          {#if !timerRunning}
            <button class="btn btn-accent" onclick={startTimer}>Démarrer</button>
          {:else}
            <button class="btn" onclick={stopTimer}>Stop</button>
          {/if}
        </div>
      </div>
    </div>

  {:else if tab === 'progress'}
    <div class="page">
      <h2>Progrès</h2>
      <div class="card">
        <div class="card-title">Évaluations récentes</div>
        {#if recentEvals.length === 0}
          <p class="text-muted">Aucune évaluation.</p>
        {:else}
          {#each recentEvals as e}
            <div class="list-item">
              <span class="num text-accent">{e.vdot}</span>
              <span class="text-muted" style="font-size:0.8rem">{e.level?.label} • {new Date(e.createdAt).toLocaleDateString('fr')}</span>
            </div>
          {/each}
        {/if}
      </div>
      <div class="card">
        <div class="card-title">Volume (séances marquées)</div>
        <div class="num" style="font-size:1.8rem">{totalKm.toFixed(1)} <span style="font-size:0.9rem;color:var(--text-muted)">km</span></div>
      </div>
      <div class="card">
        <button class="btn" onclick={exportData}>Export JSON</button>
      </div>
    </div>
  {/if}
</main>

<nav class="bottom-nav" aria-label="Navigation principale">
  {#each tabs as t}
    <button class:active={tab === t.id} onclick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
      {t.label}
    </button>
  {/each}
</nav>
