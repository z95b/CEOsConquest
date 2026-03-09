# CEOsConquest (Web Multiplayer)

CEO's Conquest ahora tiene una versión web multijugador en tiempo real para jugar con amigos online.

## Qué incluye esta versión

- Salas online (crear/unirse con código).
- 2 a 4 jugadores simultáneos por partida.
- Tablero 2D de departamentos (Lobby → Final).
- Turnos por jugador con acciones:
  - Mover
  - Atacar enemigos en la casilla
  - Botón aleatorio (eventos inesperados)
- Monstruos corporativos móviles y jefe final **Mr. Vathrax**.
- Tienda funcional en la casilla `Shop`.
- Inventario, oro, nivel y estadísticas por jugador.
- Log de eventos en vivo para toda la sala.

## Requisitos

- Node.js 18+

## Ejecutar localmente

```bash
npm install
npm start
```

Luego abre `http://localhost:3000` en tu navegador.

Para jugar con amigos, comparte la URL pública de tu servidor + el código de sala.

## Mecánica rápida

1. Crea una sala y comparte el código.
2. Cuando haya al menos 2 jugadores, inicia partida.
3. En tu turno elige una acción.
4. Los monstruos se mueven y atacan al final de cada turno.
5. Derrota al jefe final en la casilla **Final** para ganar.

