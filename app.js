/* Golf Scorer — modern UI with realtime rooms, progress panel, and rules modal */
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

// Views
const connectView = $("#connectView");
const gameSelectView = $("#gameSelectView");
const setupView = $("#setupView");
const scoringView = $("#scoringView");

// Connect elements
const firebaseJsonEl = $("#firebaseJson");
const saveConfigBtn = $("#saveConfig");
const clearConfigBtn = $("#clearConfig");
const roomCodeEl = $("#roomCode");
const roomPinEl = $("#roomPin");
const createRoomBtn = $("#createRoom");
const joinRoomBtn = $("#joinRoom");
const leaveRoomBtn = $("#leaveRoom");
const roomLabel = $("#roomLabel");

// Game select
const gameCards = $$(".game-card");
const continueSetupBtn = $("#continueSetup");
const btnRules = $("#btnRules");

// Setup inputs
const eventNameEl = $("#eventName");
const courseNameEl = $("#courseName");
const numHolesEl = $("#numHoles");
const gameTypeDisplay = $("#gameTypeDisplay");
const parInputs = $("#parInputs");
const playersWrap = $("#players");
const playerNameEl = $("#playerName");
const addPlayerBtn = $("#addPlayer");
const startRoundBtn = $("#startRound");
const btnBackGame = $("#btnBackGame");

// Scoring
const roundTitle = $("#roundTitle");
const roundMeta = $("#roundMeta");
const navHoles = $("#navHoles");
const scoreTableWrap = $("#scoreTableWrap");
const leaderboardEl = $("#leaderboard");
const btnLeaderboard = $("#btnLeaderboard");
const btnScorecard = $("#btnScorecard");
const prevHoleBtn = $("#prevHole");
const nextHoleBtn = $("#nextHole");
const finishRoundBtn = $("#finishRound");
const exportCSVBtn = $("#exportCSV");
const resetScoresBtn = $("#resetScores");

// Progress Panel
const progressPanel = $("#progressPanel");
const progressTitle = $("#progressTitle");
const progressSub = $("#progressSub");
const progressBody = $("#progressBody");

// Rules modal
const rulesModal = $("#rulesModal");
const closeRulesBtn = $("#closeRules");

// Theme
const btnDark = $("#btnDark");
function applyTheme() {
  const dark = localStorage.getItem("golf_dark") !== "0";
  document.documentElement.style.setProperty("--bg", dark ? "#0f172a" : "#f5f7fb");
  document.documentElement.style.setProperty("--fg", dark ? "#e5e7eb" : "#0b1220");
  document.documentElement.style.setProperty("--panel", dark ? "#111827" : "#ffffff");
  document.documentElement.style.setProperty("--card", dark ? "#0b1220" : "#ffffff");
  document.documentElement.style.setProperty("--border", dark ? "#213045" : "#d7dce6");
  document.documentElement.style.setProperty("--muted", dark ? "#9aa3b8" : "#4b5563");
}
btnDark.addEventListener("click", () => {
  const m = localStorage.getItem("golf_dark") === "1";
  localStorage.setItem("golf_dark", m ? "0" : "1");
  applyTheme();
});
applyTheme();

// Firebase
let fb = { app: null, db: null, roomRef: null, unsub: null };
const STORAGE_KEY_CFG = "golf_online_cfg_v2";
const STORAGE_KEY_ROOM = "golf_online_room_v2";

let state = {
  eventName: "", courseName: "", holes: 18, par: [],
  gameType: "stroke", players: [], startedAt: null, currentHole: 1,
  scores: {}, points: {}, pin: "",
  wolf: { order: [], index: 0, lone: false, base: 1 },
  skinsCarry: 0 // number of skins carried to current hole
};

// Utils
function defaultPar(n){ const nine=[4,4,3,5,4,3,4,5,4]; return n===9?nine.slice():nine.concat(nine); }
function ensureStruct(){ state.players.forEach(p=>{ state.scores[p]=state.scores[p]||{}; state.points[p]=state.points[p]||0; }); }
function setGameType(gt){ state.gameType = gt; gameTypeDisplay.value = gt.charAt(0).toUpperCase()+gt.slice(1); }
function writeState(){ if(!fb.roomRef) return; clearTimeout(writeState._t); writeState._t=setTimeout(()=>fb.roomRef.set(state),110); }
function haveConfig(){ try{ return JSON.parse(localStorage.getItem(STORAGE_KEY_CFG)||"{}"); }catch{ return null; } }
function initFirebase(){ const cfg=haveConfig(); if(!cfg) return; if(!fb.app){ fb.app=firebase.initializeApp(cfg); fb.db=firebase.database(); } }

// Connect screen actions
saveConfigBtn.addEventListener("click", ()=>{
  let cfg={}; try{ cfg=JSON.parse(firebaseJsonEl.value||"{}"); }catch(e){ alert("Invalid JSON."); return; }
  if(!cfg.apiKey || !cfg.databaseURL){ alert("Missing apiKey or databaseURL."); return; }
  localStorage.setItem(STORAGE_KEY_CFG, JSON.stringify(cfg));
  alert("Config saved."); initFirebase(); connectView.classList.add("hidden"); gameSelectView.classList.remove("hidden");
});
clearConfigBtn.addEventListener("click", ()=>{ localStorage.removeItem(STORAGE_KEY_CFG); alert("Config cleared."); location.reload(); });

createRoomBtn.addEventListener("click", async()=>{
  if(!fb.db){ alert("Save Firebase config first."); return; }
  const code = roomCodeEl.value.trim(); const pin = roomPinEl.value.trim();
  if(!code){ alert("Enter a room code."); return; }
  state = { eventName:"", courseName:"", holes:18, par:defaultPar(18), gameType: "stroke", players:[], startedAt:null, currentHole:1, scores:{}, points:{}, pin, wolf:{order:[], index:0, lone:false, base:1}, skinsCarry:0 };
  await fb.db.ref(roomPath(code)).set(state);
  localStorage.setItem(STORAGE_KEY_ROOM, code);
  joinRoom(code);
});
joinRoomBtn.addEventListener("click", ()=> joinRoom());
function roomPath(code){ return `rooms/${encodeURIComponent(code)}`; }
function joinRoom(code0){
  if(!fb.db){ alert("Save Firebase config first."); return; }
  const code = code0 || roomCodeEl.value.trim(); const pin = roomPinEl.value.trim();
  if(!code){ alert("Enter a room code."); return; }
  if (fb.unsub) fb.unsub();
  fb.roomRef = fb.db.ref(roomPath(code));
  fb.roomRef.on("value", snap=>{
    const data = snap.val(); if(!data) return;
    if (data.pin && pin !== data.pin) { alert("Wrong PIN for this room."); return; }
    state = data; onStateUpdate();
  });
  fb.unsub = () => fb.roomRef.off();
  localStorage.setItem(STORAGE_KEY_ROOM, code);
  connectView.classList.add("hidden");
  gameSelectView.classList.remove("hidden");
}

// Game selection
let selectedGame = null;
gameCards.forEach(card=>{
  card.addEventListener("click", ()=>{
    gameCards.forEach(c=>c.classList.remove("active"));
    card.classList.add("active");
    selectedGame = card.dataset.game;
    continueSetupBtn.disabled = false;
  });
});
continueSetupBtn.addEventListener("click", ()=>{
  if(!selectedGame) return;
  setGameType(selectedGame);
  gameSelectView.classList.add("hidden");
  setupView.classList.remove("hidden");
});
btnBackGame.addEventListener("click", ()=>{
  setupView.classList.add("hidden");
  gameSelectView.classList.remove("hidden");
});

// Rules modal
btnRules.addEventListener("click", ()=> rulesModal.showModal());
closeRulesBtn.addEventListener("click", ()=> rulesModal.close());

// Setup view interactions
numHolesEl.addEventListener("change", ()=>{
  state.holes = parseInt(numHolesEl.value,10);
  if(state.par.length !== state.holes) state.par = defaultPar(state.holes);
  renderParInputs(); writeState();
});
addPlayerBtn.addEventListener("click", ()=>{
  const name = playerNameEl.value.trim(); if(!name) return;
  if(!state.players.includes(name)) state.players.push(name);
  playerNameEl.value = ""; renderPlayers(); writeState();
});
playerNameEl.addEventListener("keydown", (e)=>{ if(e.key==="Enter") addPlayerBtn.click(); });

startRoundBtn.addEventListener("click", ()=>{
  state.eventName = eventNameEl.value.trim() || "Weekend Round";
  state.courseName = courseNameEl.value.trim() || "Home Course";
  if(state.par.length !== state.holes) state.par = defaultPar(state.holes);
  ensureStruct();
  // init wolf order if wolf
  if(state.gameType==="wolf" && (!state.wolf || !state.wolf.order?.length)){
    state.wolf = { order: state.players.slice(), index: 0, lone: false, base: 1 };
  }
  state.startedAt = Date.now(); state.currentHole = 1;
  writeState(); showScoring();
});
leaveRoomBtn.addEventListener("click", ()=>{ if(fb.unsub) fb.unsub(); localStorage.removeItem(STORAGE_KEY_ROOM); location.reload(); });

function renderParInputs(){
  parInputs.innerHTML = "";
  for(let i=1;i<=state.holes;i++){
    const inp = document.createElement("input");
    inp.type="number"; inp.min="3"; inp.max="6"; inp.step="1";
    inp.placeholder = `Par ${i}`;
    inp.value = state.par[i-1] ?? "";
    inp.addEventListener("change", ()=>{ state.par[i-1]=parseInt(inp.value||"0",10); writeState(); updateProgressPanel(); });
    parInputs.appendChild(inp);
  }
}
function renderPlayers(){
  playersWrap.innerHTML = "";
  state.players.forEach(name=>{
    const chip = document.createElement("span");
    chip.className="player-chip";
    chip.innerHTML = `<span>${name}</span> <button title="Remove">✕</button>`;
    chip.querySelector("button").addEventListener("click", ()=>{
      state.players = state.players.filter(p=>p!==name);
      delete state.scores[name]; delete state.points[name];
      writeState(); renderPlayers();
    });
    playersWrap.appendChild(chip);
  });
  startRoundBtn.disabled = state.players.length===0;
}

// Scoring view
function showScoring(){
  setupView.classList.add("hidden");
  scoringView.classList.remove("hidden");
  buildHoleNav(); buildScoreTable(); updateLeaderboard(); updateProgressPanel();
}
function buildHoleNav(){
  navHoles.innerHTML = "";
  for(let i=1;i<=state.holes;i++){
    const btn = document.createElement("button");
    btn.className = "hole-btn" + (i===state.currentHole?" active":"");
    btn.textContent = i;
    btn.addEventListener("click", ()=>{
      state.currentHole = i; writeState(); buildScoreTable(); setActiveHoleBtn(); updateProgressPanel();
    });
    navHoles.appendChild(btn);
  }
}
function setActiveHoleBtn(){ $$(".hole-btn").forEach((b,idx)=> b.classList.toggle("active", idx+1===state.currentHole)); }

function buildScoreTable(){
  ensureStruct();
  const hole = state.currentHole;
  let html = `<table><thead><tr><th class="sticky">Player</th>`;
  for(let i=1;i<=state.holes;i++){
    const cls = (i===hole) ? ' style="background:#1f2937;border-color:#3b82f6"' : "";
    html += `<th${cls}>${i}<div class="par-col">Par ${state.par[i-1]||"-"}</div></th>`;
  }
  html += `<th>Total</th>${state.gameType!=="stroke"?"<th>Points</th>":""}</tr></thead><tbody>`;
  for(const p of state.players){
    let total=0;
    html += `<tr><td class="sticky">${p}</td>`;
    for(let i=1;i<=state.holes;i++){
      const val = state.scores[p]?.[i] ?? "";
      const par = state.par[i-1] || 4;
      const rel = (val!=="") ? (val - par) : "";
      const relStr = (val!=="") ? (rel>0?`(+${rel})`:(rel<0?`(${rel})`:"(E)")) : "";
      html += `<td>
        <input class="score-inp" data-player="${p}" data-hole="${i}" inputmode="numeric" pattern="[0-9]*" value="${val === "" ? "" : val}"/>
        <div class="muted small">${relStr}</div>
      </td>`;
      total += (val===""?0:parseInt(val,10));
    }
    html += `<td class="total-col">${total||""}</td>`;
    if(state.gameType!=="stroke") html += `<td class="total-col">${state.points[p]||0}</td>`;
    html += `</tr>`;
  }
  html += `</tbody></table>`;
  scoreTableWrap.innerHTML = html;

  $$(".score-inp").forEach(inp=>{
    inp.addEventListener("change", e=>{
      const p = inp.dataset.player;
      const h = parseInt(inp.dataset.hole,10);
      let v = parseInt(inp.value||""); if(isNaN(v)||v<=0){ inp.value=""; v=""; }
      state.scores[p][h] = v;
      recomputePoints();
      writeState();
      buildScoreTable();
      updateLeaderboard();
      updateProgressPanel();
    });
  });
}

prevHoleBtn.addEventListener("click", ()=>{ state.currentHole=Math.max(1,state.currentHole-1); writeState(); buildScoreTable(); setActiveHoleBtn(); updateProgressPanel(); });
nextHoleBtn.addEventListener("click", ()=>{ state.currentHole=Math.min(state.holes,state.currentHole+1); writeState(); buildScoreTable(); setActiveHoleBtn(); updateProgressPanel(); });
finishRoundBtn.addEventListener("click", ()=>{ if(!confirm("Finish round? Data stays in room until overwritten.")) return; alert("Round finished! Start a new code for the next game."); });
exportCSVBtn.addEventListener("click", ()=>{ const csv=toCSV(); downloadText(csv,`golf_round_${Date.now()}.csv`,"text/csv"); });
resetScoresBtn.addEventListener("click", ()=>{ if(!confirm("Clear all scores? Mulligans not included.")) return; for(const p of state.players){ state.scores[p]={}; state.points[p]=0; } state.skinsCarry=0; writeState(); buildScoreTable(); updateLeaderboard(); updateProgressPanel(); });

btnLeaderboard.addEventListener("click", ()=>{ leaderboardEl.classList.remove("hidden"); scoreTableWrap.classList.add("hidden"); btnLeaderboard.classList.add("primary"); btnScorecard.classList.remove("primary"); });
btnScorecard.addEventListener("click", ()=>{ leaderboardEl.classList.add("hidden"); scoreTableWrap.classList.remove("hidden"); btnScorecard.classList.add("primary"); btnLeaderboard.classList.remove("primary"); });

// Scoring logic
function stablefordPoints(score, par){
  const d=score-par;
  if(d<=-3) return 5; if(d===-2) return 4; if(d===-1) return 3; if(d===0) return 2; if(d===1) return 1; return 0;
}
function computeSkinsForHole(h){
  let low=Infinity, winners=[];
  for(const p of state.players){
    const s = state.scores[p]?.[h];
    if(s==null || s==="") return {winner:null,carry:false}; // incomplete
    if(s<low){ low=s; winners=[p]; } else if(s===low){ winners.push(p); }
  }
  if(winners.length===1){ return {winner:winners[0], carry:false}; }
  return {winner:null, carry:true};
}
function recomputePoints(){
  for(const p of state.players) state.points[p]=0;
  if(state.gameType==="stableford"){
    for(let h=1; h<=state.holes; h++){
      for(const p of state.players){
        const s = state.scores[p]?.[h]; if(s==null||s==="") continue;
        state.points[p] += stablefordPoints(s, state.par[h-1]||4);
      }
    }
  } else if(state.gameType==="skins"){
    let carry=0;
    for(let h=1; h<=state.holes; h++){
      const res = computeSkinsForHole(h);
      if(res==null) continue;
      if(res.carry){ carry += 1; }
      else if(res.winner){
        state.points[res.winner] = (state.points[res.winner]||0) + 1 + carry;
        carry = 0;
      }
      if(h===state.currentHole) state.skinsCarry = carry;
    }
  } else if(state.gameType==="wolf"){
    // Simplified Wolf: wolf rotates; lone wolf gives 2× base if wolf wins solo; otherwise wolf + best partner get base
    for(let h=1; h<=state.holes; h++){
      // need complete scores on the hole to award
      const scores = state.players.map(p=>({p, s: state.scores[p]?.[h]}));
      if(scores.some(x=>x.s==null || x.s==="")) continue;
      const base = state.wolf?.base ?? 1;
      const lone = state.wolf?.lone ?? false;
      const wolfName = (state.wolf?.order?.length) ? state.wolf.order[(state.wolf.index + (h-1)) % state.wolf.order.length] : state.players[0];
      scores.sort((a,b)=>a.s-b.s);
      if(lone){
        const wolfScore = scores.find(x=>x.p===wolfName).s;
        if(wolfScore < scores[1].s){
          state.points[wolfName] = (state.points[wolfName]||0) + base*2;
        }
      }else{
        const wolfScore = scores.find(x=>x.p===wolfName).s;
        const partner = scores.find(x=>x.p!==wolfName);
        const teamScore = wolfScore + partner.s;
        const others = scores.filter(x=>x.p!==wolfName && x.p!==partner.p).map(x=>x.s);
        let bestOtherTeam = Infinity;
        for(let i=0;i<others.length;i+=2){
          const a=others[i], b=others[i+1] ?? 100;
          bestOtherTeam = Math.min(bestOtherTeam, a+b);
        }
        if(teamScore < bestOtherTeam){
          state.points[wolfName]=(state.points[wolfName]||0)+base;
          state.points[partner.p]=(state.points[partner.p]||0)+base;
        }
      }
    }
  }
  updateLeaderboard();
}

// Leaderboard
function updateLeaderboard(){
  const rows = state.players.map(p=>{
    let strokes=0; for(let i=1;i<=state.holes;i++){ const v=state.scores[p]?.[i]; if(v) strokes+=v; }
    return { player:p, strokes, pts: state.points[p]||0 };
  });
  if(state.gameType==="stroke"){ rows.sort((a,b)=> (a.strokes||Infinity)-(b.strokes||Infinity)); }
  else { rows.sort((a,b)=> b.pts-a.pts); }

  let html = `<div class="card thin"><h3>🏆 Leaderboard — ${state.gameType.toUpperCase()}</h3><ol>`;
  rows.forEach((r,idx)=>{
    const stat = (state.gameType==="stroke") ? (r.strokes||"—") : `${r.pts} pts`;
    const flair = idx===0 ? " — Champion of the fairways 🥇" : "";
    html += `<li><strong>${r.player}</strong> — ${stat}${flair}</li>`;
  });
  html += `</ol></div>`;
  leaderboardEl.innerHTML = html;
}

// Progress Panel (current hole only)
function updateProgressPanel(){
  const h = state.currentHole;
  progressTitle.textContent = `Hole ${h}`;
  progressSub.textContent = (state.gameType==="stroke") ? "Strokes vs Par" :
                            (state.gameType==="stableford") ? "Hole points" :
                            (state.gameType==="skins") ? (state.skinsCarry>0 ? `Carry active: +${state.skinsCarry} skin(s)` : "Skin at stake") :
                            (state.gameType==="wolf") ? "Wolf status & points" : "";

  const par = state.par[h-1] || 4;
  progressBody.innerHTML = "";

  if(state.gameType==="stroke"){
    // show per-player relative score on current hole
    const items = state.players.map(p=>{
      const s = state.scores[p]?.[h]; if(!s && s!==0) return {p, txt:"—"};
      const d = s - par;
      const rel = d>0?`+${d}`:(d<0?`${d}`:"E");
      return {p, txt: `${s} (${rel})`, d};
    });
    const best = Math.min(...items.filter(x=>Number.isFinite(x.d)).map(x=>x.d));
    for(const it of items){
      const badge = document.createElement("span");
      badge.className = "badge " + (it.d===best?"green": (it.d>0?"red":""));
      badge.textContent = `${it.p}: ${it.txt}`;
      progressBody.appendChild(badge);
    }
  } else if(state.gameType==="stableford"){
    // show hole points per player
    const items = state.players.map(p=>{
      const s = state.scores[p]?.[h]; if(!s && s!==0) return {p, pts:null, label:"—"};
      const pts = stablefordPoints(s, par);
      const desc = (s-par<=-3)?"Albatross":(s-par===-2)?"Eagle":(s-par===-1)?"Birdie":(s-par===0)?"Par":(s-par===1)?"Bogey":"—";
      return {p, pts, label: `${pts} pt${pts===1?"":"s"} — ${desc}`};
    });
    const top = Math.max(...items.filter(x=>x.pts!=null).map(x=>x.pts));
    for(const it of items){
      const badge = document.createElement("span");
      badge.className = "badge " + (it.pts===top?"gold":"");
      badge.textContent = `${it.p}: ${it.label}`;
      progressBody.appendChild(badge);
    }
  } else if(state.gameType==="skins"){
    // show current hole skin status
    const res = computeSkinsForHole(h);
    if(res && res.winner){
      const badge = document.createElement("span");
      badge.className = "badge gold";
      const bonus = state.skinsCarry>0 ? ` (+${state.skinsCarry} carry)` : "";
      badge.textContent = `Winner: ${res.winner} earns 1 skin${bonus}`;
      progressBody.appendChild(badge);
    } else if(res && res.carry){
      const badge = document.createElement("span");
      badge.className = "badge red";
      badge.textContent = `Carry to next hole — no unique low score`;
      progressBody.appendChild(badge);
    } else {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = `Skin at stake — lowest unique score wins`;
      progressBody.appendChild(badge);
    }
  } else if(state.gameType==="wolf"){
    // wolf status: who is wolf on this hole, lone or not
    const order = state.wolf?.order?.length ? state.wolf.order : state.players.slice();
    const wolfName = order[(state.wolf?.index || 0 + (h-1)) % order.length];
    const lone = state.wolf?.lone ? " (Lone Wolf)" : "";
    const base = state.wolf?.base ?? 1;
    const b1 = document.createElement("span");
    b1.className = "badge";
    b1.textContent = `Wolf: ${wolfName}${lone} • Base: ${base}`;
    progressBody.appendChild(b1);

    // if scores exist, hint winner
    const scores = state.players.map(p=>({p, s: state.scores[p]?.[h]}));
    if(!scores.some(x=>x.s==null || x.s==="")){
      scores.sort((a,b)=>a.s-b.s);
      if(state.wolf?.lone){
        const wolfScore = scores.find(x=>x.p===wolfName).s;
        const hint = document.createElement("span");
        hint.className = "badge " + (wolfScore < scores[1].s ? "gold":"red");
        hint.textContent = (wolfScore < scores[1].s) ? `Wolf wins this hole (+${base*2})` : `Wolf loses this hole`;
        progressBody.appendChild(hint);
      }else{
        const wolfScore = scores.find(x=>x.p===wolfName).s;
        const partner = scores.find(x=>x.p!==wolfName);
        const teamScore = wolfScore + partner.s;
        const others = scores.filter(x=>x.p!==wolfName && x.p!==partner.p).map(x=>x.s);
        let bestOtherTeam = Infinity;
        for(let i=0;i<others.length;i+=2){ const a=others[i], b=others[i+1] ?? 100; bestOtherTeam = Math.min(bestOtherTeam, a+b); }
        const hint = document.createElement("span");
        hint.className = "badge " + (teamScore < bestOtherTeam ? "gold":"red");
        hint.textContent = (teamScore < bestOtherTeam) ? `Wolf + partner win this hole (+${base})` : `Other team leads`;
        progressBody.appendChild(hint);
      }
    }
  }
}

// CSV Download
function toCSV(){
  const headers=["Player"].concat(Array.from({length:state.holes},(_,i)=>`H${i+1}`)).concat(["Total","Points"]);
  const lines=[headers.join(",")];
  for(const p of state.players){
    let total=0; const row=[p];
    for(let i=1;i<=state.holes;i++){ const v=state.scores[p]?.[i] ?? ""; row.push(v); total += (v===""?0:parseInt(v,10)); }
    row.push(total||""); row.push(state.points[p]||0); lines.push(row.join(","));
  }
  return lines.join("\n");
}
function downloadText(text, filename, mime="text/plain"){
  const blob = new Blob([text], {type:mime});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

// On state update from Firebase
function onStateUpdate(){
  // if room loaded, go to game select
  gameSelectView.classList.remove("hidden");
  // reflect state
  if(!state.par || state.par.length===0) state.par = defaultPar(state.holes);
  eventNameEl.value = state.eventName || "";
  courseNameEl.value = state.courseName || "";
  numHolesEl.value = String(state.holes || 18);
  setGameType(state.gameType || "stroke");
  renderParInputs(); renderPlayers();

  roundTitle.textContent = state.eventName || "Round";
  roundMeta.textContent = `${state.courseName || "Course"} • ${state.holes} holes • ${state.gameType.toUpperCase()}${state.startedAt?` • Started ${new Date(state.startedAt).toLocaleString()}`:""}`;

  if(state.startedAt){
    gameSelectView.classList.add("hidden");
    setupView.classList.add("hidden");
    scoringView.classList.remove("hidden");
    buildHoleNav(); buildScoreTable(); updateLeaderboard(); updateProgressPanel();
  }
}

// Init
function init(){
  const cfg = haveConfig(); if(cfg) firebaseJsonEl.value = JSON.stringify(cfg);
  initFirebase();
  const storedRoom = localStorage.getItem(STORAGE_KEY_ROOM); if(storedRoom) roomCodeEl.value = storedRoom;
}
init();
