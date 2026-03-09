const socket = io();

let state = null;
let roomCode = null;
let me = null;

const els = {
  name: document.getElementById('name'),
  character: document.getElementById('character'),
  createBtn: document.getElementById('createBtn'),
  joinBtn: document.getElementById('joinBtn'),
  roomCodeInput: document.getElementById('roomCodeInput'),
  roomInfo: document.getElementById('roomInfo'),
  startBtn: document.getElementById('startBtn'),
  board: document.getElementById('board'),
  players: document.getElementById('players'),
  shop: document.getElementById('shop'),
  log: document.getElementById('log'),
  moveBtn: document.getElementById('moveBtn'),
  attackBtn: document.getElementById('attackBtn'),
  randomBtn: document.getElementById('randomBtn'),
};

function mePlayer() {
  return state?.players.find((p) => p.id === me);
}

function isMyTurn() {
  return state?.turnPlayerId === me;
}

function renderBoard() {
  els.board.innerHTML = '';
  state.board.forEach((tile) => {
    const div = document.createElement('div');
    div.className = 'tile';

    const players = state.players.filter((p) => p.tile === tile.id && p.alive).map((p) => p.name).join(', ');
    const monsters = state.monsters.filter((m) => m.tile === tile.id && m.hp > 0).map((m) => `${m.name} (${m.hp}hp)`).join(', ');

    div.innerHTML = `<b>${tile.id}. ${tile.name}</b><div>${tile.type}</div><div>🧍 ${players || '-'}</div><div>👾 ${monsters || '-'}</div>`;
    els.board.appendChild(div);
  });
}

function renderPlayers() {
  els.players.innerHTML = '';
  state.players.forEach((p) => {
    const li = document.createElement('li');
    li.innerHTML = `<b>${p.name}</b> (${p.character}) ${p.id === state.turnPlayerId ? '<span class="badge">Turno</span>' : ''}<br>
      Lv${p.level} HP:${p.hp}/${p.maxHp} ATK:${p.attack} DEF:${p.defense} Oro:${p.gold}<br>
      Inventario: ${p.inventory.join(', ') || 'vacío'} ${!p.alive ? '☠️' : ''}`;
    els.players.appendChild(li);
  });
}

function renderShop() {
  const meP = mePlayer();
  els.shop.innerHTML = '';
  Object.entries(state.shopItems).forEach(([key, item]) => {
    const btn = document.createElement('button');
    btn.textContent = `${item.name} - ${item.cost} oro`;
    btn.disabled = !state.started || !meP || meP.tile !== 4;
    btn.onclick = () => socket.emit('shop:buy', { roomCode, itemKey: key });
    els.shop.appendChild(btn);
  });
}

function renderLog() {
  els.log.innerHTML = '';
  state.log.forEach((line) => {
    const li = document.createElement('li');
    li.textContent = line;
    els.log.appendChild(li);
  });
}

function renderControls() {
  const meP = mePlayer();
  const canAct = state?.started && meP && meP.alive && isMyTurn();
  els.startBtn.disabled = !roomCode || state?.started || state?.players?.length < 2;
  els.moveBtn.disabled = !canAct;
  els.attackBtn.disabled = !canAct;
  els.randomBtn.disabled = !canAct;
}

function renderAll() {
  if (!state) return;
  els.roomInfo.textContent = `Sala: ${roomCode} | Jugadores: ${state.players.length} | ${state.started ? 'Partida en curso' : 'Esperando inicio'}`;
  renderBoard();
  renderPlayers();
  renderShop();
  renderLog();
  renderControls();

  if (state.winner) {
    alert(`Partida finalizada. Ganador: ${state.winner}`);
  }
}

els.createBtn.onclick = () => {
  socket.emit(
    'room:create',
    { name: els.name.value.trim(), character: els.character.value },
    (res) => {
      if (!res.ok) return alert('No se pudo crear la sala');
      roomCode = res.roomCode;
      me = res.playerId;
      els.roomCodeInput.value = roomCode;
    }
  );
};

els.joinBtn.onclick = () => {
  socket.emit(
    'room:join',
    { roomCode: els.roomCodeInput.value.trim(), name: els.name.value.trim(), character: els.character.value },
    (res) => {
      if (!res.ok) return alert(res.message);
      roomCode = res.roomCode;
      me = res.playerId;
    }
  );
};

els.startBtn.onclick = () => socket.emit('game:start', { roomCode });
els.moveBtn.onclick = () => socket.emit('turn:move', { roomCode, steps: Math.random() > 0.5 ? 1 : 2 });
els.attackBtn.onclick = () => socket.emit('turn:attack', { roomCode });
els.randomBtn.onclick = () => socket.emit('turn:random', { roomCode });

socket.on('state:update', (newState) => {
  state = newState;
  renderAll();
});
