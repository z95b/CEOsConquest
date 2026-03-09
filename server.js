const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

const BOARD = [
  { id: 0, name: 'Lobby', type: 'start' },
  { id: 1, name: 'RRHH', type: 'event' },
  { id: 2, name: 'Casino', type: 'casino' },
  { id: 3, name: 'IT Helado', type: 'monster' },
  { id: 4, name: 'Shop', type: 'shop' },
  { id: 5, name: 'Sala de Reunión', type: 'event' },
  { id: 6, name: 'Dead End', type: 'danger' },
  { id: 7, name: 'Cocina Tóxica', type: 'monster' },
  { id: 8, name: 'Marketing', type: 'event' },
  { id: 9, name: 'Final', type: 'boss' },
];

const STARTING_MONSTERS = [
  { id: 'm1', name: 'Gerente Zombie', hp: 30, power: 6, tile: 3 },
  { id: 'm2', name: 'Auditor Espectral', hp: 26, power: 7, tile: 7 },
  { id: 'boss', name: 'CEO Mr. Vathrax', hp: 80, power: 12, tile: 9, boss: true },
];

const SHOP_ITEMS = {
  potion: { name: 'Poción de café', cost: 25, effect: 'heal', amount: 18 },
  blade: { name: 'Espada de Excel', cost: 40, effect: 'attack', amount: 3 },
  shield: { name: 'Corbata blindada', cost: 35, effect: 'defense', amount: 2 },
};

const ROOMS = new Map();

function id() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function createPlayer({ socketId, name, character }) {
  return {
    socketId,
    id: id(),
    name: name || 'Aventurero',
    character: character || 'Analista Arcano',
    level: 3,
    hp: 65,
    maxHp: 65,
    attack: 10,
    defense: 4,
    gold: 40,
    tile: 0,
    alive: true,
    inventory: [],
  };
}

function createRoom(roomCode, hostPlayer) {
  return {
    code: roomCode,
    started: false,
    players: [hostPlayer],
    turnOrder: [hostPlayer.id],
    currentTurn: 0,
    monsters: structuredClone(STARTING_MONSTERS),
    log: [`${hostPlayer.name} creó la sala ${roomCode}.`],
    winner: null,
  };
}

function findPlayer(room, socketId) {
  return room.players.find((p) => p.socketId === socketId);
}

function getCurrentPlayer(room) {
  const turnId = room.turnOrder[room.currentTurn];
  return room.players.find((p) => p.id === turnId);
}

function alivePlayers(room) {
  return room.players.filter((p) => p.alive);
}

function appendLog(room, text) {
  room.log.unshift(`${new Date().toLocaleTimeString('es-ES')}: ${text}`);
  room.log = room.log.slice(0, 40);
}

function eventForTile(room, player) {
  const tile = BOARD[player.tile];
  if (!tile) return;

  switch (tile.type) {
    case 'event': {
      const roll = Math.random();
      if (roll < 0.4) {
        player.gold += 12;
        appendLog(room, `${player.name} cerró una venta y ganó 12 oro.`);
      } else if (roll < 0.8) {
        player.hp = Math.min(player.maxHp, player.hp + 8);
        appendLog(room, `${player.name} encontró snacks y recuperó 8 HP.`);
      } else {
        player.attack += 1;
        appendLog(room, `${player.name} recibió feedback útil: +1 ataque.`);
      }
      break;
    }
    case 'casino': {
      const gain = Math.random() > 0.5;
      if (gain) {
        player.gold += 18;
        appendLog(room, `${player.name} ganó en el Casino y obtuvo 18 oro.`);
      } else {
        player.gold = Math.max(0, player.gold - 12);
        appendLog(room, `${player.name} perdió en el Casino y dejó 12 oro.`);
      }
      break;
    }
    case 'danger': {
      const damage = 6 + Math.floor(Math.random() * 8);
      player.hp -= damage;
      appendLog(room, `${player.name} cayó en Dead End y recibió ${damage} daño.`);
      if (player.hp <= 0) {
        player.alive = false;
        player.hp = 0;
        appendLog(room, `${player.name} fue eliminado en un pasillo sin salida.`);
      }
      break;
    }
    case 'monster':
    case 'boss':
      appendLog(room, `${player.name} entró a ${tile.name}. Puede atacar.`);
      break;
    case 'shop':
      appendLog(room, `${player.name} está en Shop y puede comprar objetos.`);
      break;
    default:
      break;
  }
}

function moveMonsters(room) {
  room.monsters.forEach((monster) => {
    if (monster.hp <= 0) return;
    if (monster.boss) return;
    const direction = Math.random() > 0.5 ? 1 : -1;
    const nextTile = Math.min(8, Math.max(1, monster.tile + direction));
    monster.tile = nextTile;
  });
}

function monstersAttackPlayers(room) {
  for (const monster of room.monsters) {
    if (monster.hp <= 0) continue;
    const targets = room.players.filter((p) => p.alive && p.tile === monster.tile);
    targets.forEach((target) => {
      const dmg = Math.max(1, monster.power - target.defense + Math.floor(Math.random() * 4));
      target.hp -= dmg;
      appendLog(room, `${monster.name} atacó a ${target.name} por ${dmg} daño.`);
      if (target.hp <= 0) {
        target.hp = 0;
        target.alive = false;
        appendLog(room, `${target.name} fue derrotado por ${monster.name}.`);
      }
    });
  }
}

function checkWinner(room) {
  const boss = room.monsters.find((m) => m.id === 'boss');
  if (boss && boss.hp <= 0) {
    const survivors = alivePlayers(room);
    room.winner = survivors.length ? survivors[0].name : 'Sin supervivientes';
    room.started = false;
    appendLog(room, `¡La partida terminó! Ganador: ${room.winner}.`);
    return true;
  }
  if (alivePlayers(room).length === 0) {
    room.started = false;
    room.winner = 'Mr. Vathrax';
    appendLog(room, 'Todos cayeron. Mr. Vathrax dominó la empresa.');
    return true;
  }
  return false;
}

function advanceTurn(room) {
  if (!room.started) return;
  moveMonsters(room);
  monstersAttackPlayers(room);
  if (checkWinner(room)) return;

  const aliveIds = alivePlayers(room).map((p) => p.id);
  room.turnOrder = room.turnOrder.filter((idValue) => aliveIds.includes(idValue));
  if (!room.turnOrder.length) {
    checkWinner(room);
    return;
  }
  room.currentTurn = (room.currentTurn + 1) % room.turnOrder.length;
  const current = getCurrentPlayer(room);
  appendLog(room, `Turno de ${current.name}.`);
}

function serializeRoom(room) {
  return {
    code: room.code,
    started: room.started,
    board: BOARD,
    players: room.players,
    monsters: room.monsters,
    turnPlayerId: room.started && room.turnOrder.length ? room.turnOrder[room.currentTurn] : null,
    log: room.log,
    shopItems: SHOP_ITEMS,
    winner: room.winner,
  };
}

function broadcastRoom(room) {
  io.to(room.code).emit('state:update', serializeRoom(room));
}

io.on('connection', (socket) => {
  socket.on('room:create', ({ name, character }, callback) => {
    const roomCode = id();
    const player = createPlayer({ socketId: socket.id, name, character });
    const room = createRoom(roomCode, player);
    ROOMS.set(roomCode, room);
    socket.join(roomCode);
    callback({ ok: true, roomCode, playerId: player.id });
    broadcastRoom(room);
  });

  socket.on('room:join', ({ roomCode, name, character }, callback) => {
    const room = ROOMS.get((roomCode || '').toUpperCase());
    if (!room) return callback({ ok: false, message: 'Sala no encontrada.' });
    if (room.started) return callback({ ok: false, message: 'La partida ya comenzó.' });
    if (room.players.length >= 4) return callback({ ok: false, message: 'La sala está llena.' });

    const player = createPlayer({ socketId: socket.id, name, character });
    room.players.push(player);
    room.turnOrder.push(player.id);
    appendLog(room, `${player.name} se unió a la sala.`);
    socket.join(room.code);
    callback({ ok: true, roomCode: room.code, playerId: player.id });
    broadcastRoom(room);
  });

  socket.on('game:start', ({ roomCode }) => {
    const room = ROOMS.get(roomCode);
    if (!room || room.started) return;
    if (room.players.length < 2) return;
    room.started = true;
    room.currentTurn = 0;
    appendLog(room, 'La partida comenzó.');
    appendLog(room, `Turno de ${getCurrentPlayer(room).name}.`);
    broadcastRoom(room);
  });

  socket.on('turn:move', ({ roomCode, steps = 1 }) => {
    const room = ROOMS.get(roomCode);
    if (!room || !room.started) return;

    const player = findPlayer(room, socket.id);
    if (!player || !player.alive) return;
    if (getCurrentPlayer(room)?.id !== player.id) return;

    player.tile = Math.min(9, player.tile + Math.max(1, Math.min(2, steps)));
    appendLog(room, `${player.name} avanzó a ${BOARD[player.tile].name}.`);
    eventForTile(room, player);
    if (checkWinner(room)) {
      broadcastRoom(room);
      return;
    }
    advanceTurn(room);
    broadcastRoom(room);
  });

  socket.on('turn:attack', ({ roomCode }) => {
    const room = ROOMS.get(roomCode);
    if (!room || !room.started) return;

    const player = findPlayer(room, socket.id);
    if (!player || !player.alive) return;
    if (getCurrentPlayer(room)?.id !== player.id) return;

    const target = room.monsters.find((m) => m.hp > 0 && m.tile === player.tile);
    if (!target) return;

    const bonus = player.inventory.includes('blade') ? 2 : 0;
    const dmg = Math.max(2, player.attack + bonus + Math.floor(Math.random() * 6));
    target.hp -= dmg;
    appendLog(room, `${player.name} golpeó a ${target.name} por ${dmg} daño.`);

    if (target.hp <= 0) {
      target.hp = 0;
      player.gold += target.boss ? 120 : 24;
      player.level += target.boss ? 2 : 1;
      appendLog(room, `${player.name} derrotó a ${target.name}.`);
    }

    if (checkWinner(room)) {
      broadcastRoom(room);
      return;
    }

    advanceTurn(room);
    broadcastRoom(room);
  });

  socket.on('turn:random', ({ roomCode }) => {
    const room = ROOMS.get(roomCode);
    if (!room || !room.started) return;
    const player = findPlayer(room, socket.id);
    if (!player || !player.alive) return;
    if (getCurrentPlayer(room)?.id !== player.id) return;

    const roll = Math.floor(Math.random() * 5);
    if (roll === 0) {
      player.gold += 20;
      appendLog(room, `${player.name} encontró un maletín con 20 oro.`);
    } else if (roll === 1) {
      const dmg = 10;
      player.hp = Math.max(0, player.hp - dmg);
      if (player.hp === 0) player.alive = false;
      appendLog(room, `${player.name} recibió una lluvia de KPIs y perdió ${dmg} HP.`);
    } else if (roll === 2) {
      player.attack += 2;
      appendLog(room, `${player.name} se motivó con un TED Talk: +2 ataque.`);
    } else if (roll === 3) {
      player.tile = Math.max(0, player.tile - 2);
      appendLog(room, `${player.name} fue enviado a una reunión eterna y retrocedió 2 casillas.`);
    } else {
      player.inventory.push('potion');
      appendLog(room, `${player.name} recibió una poción gratis.`);
    }

    if (checkWinner(room)) {
      broadcastRoom(room);
      return;
    }
    advanceTurn(room);
    broadcastRoom(room);
  });

  socket.on('shop:buy', ({ roomCode, itemKey }) => {
    const room = ROOMS.get(roomCode);
    if (!room || !room.started) return;

    const player = findPlayer(room, socket.id);
    const item = SHOP_ITEMS[itemKey];
    if (!player || !item) return;
    if (player.tile !== 4) return;
    if (player.gold < item.cost) return;

    player.gold -= item.cost;
    player.inventory.push(itemKey);
    if (item.effect === 'attack') player.attack += item.amount;
    if (item.effect === 'defense') player.defense += item.amount;
    if (item.effect === 'heal') player.hp = Math.min(player.maxHp, player.hp + item.amount);

    appendLog(room, `${player.name} compró ${item.name}.`);
    broadcastRoom(room);
  });

  socket.on('disconnect', () => {
    ROOMS.forEach((room, code) => {
      const player = findPlayer(room, socket.id);
      if (!player) return;

      room.players = room.players.filter((p) => p.socketId !== socket.id);
      room.turnOrder = room.turnOrder.filter((pid) => pid !== player.id);
      appendLog(room, `${player.name} se desconectó.`);

      if (!room.players.length) {
        ROOMS.delete(code);
      } else {
        if (room.currentTurn >= room.turnOrder.length) room.currentTurn = 0;
        broadcastRoom(room);
      }
    });
  });
});

app.use(express.static(path.join(__dirname, 'public')));

server.listen(PORT, () => {
  console.log(`CEO's Conquest webapp listening on http://localhost:${PORT}`);
});
