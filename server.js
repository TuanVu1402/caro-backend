const WebSocket = require('ws');

const port = process.env.PORT || 8080; // Sử dụng biến môi trường PORT
const wss = new WebSocket.Server({ port });

const rooms = new Map();

wss.on('connection', ws => {
  console.log('New client connected');

  ws.on('message', message => {
    try {
      const data = JSON.parse(message);
      let targetRoom = null;

      switch (data.type) {
        case 'create_room':
          const newRoom = {
            roomId: data.roomId,
            players: [{ id: data.playerId, symbol: 'X', ws }],
            board: Array(15).fill().map(() => Array(15).fill(null)),
            currentPlayer: 'X',
            winner: null,
            isGameActive: false,
          };
          rooms.set(data.roomId, newRoom);
          ws.send(JSON.stringify({ type: 'room_created', roomId: data.roomId }));
          break;

        case 'join_room':
          targetRoom = rooms.get(data.roomId);
          if (!targetRoom) {
            ws.send(JSON.stringify({ type: 'error', message: 'Phòng không tồn tại!' }));
            return;
          }
          if (targetRoom.players.length >= 2) {
            ws.send(JSON.stringify({ type: 'error', message: 'Phòng đã đầy!' }));
            return;
          }
          targetRoom.players.push({ id: data.playerId, symbol: 'O', ws });
          targetRoom.isGameActive = true;
          broadcastToRoom(data.roomId, { type: 'player_joined', room: targetRoom });
          break;

        case 'move_made':
          targetRoom = rooms.get(data.roomId);
          if (targetRoom && targetRoom.isGameActive && !targetRoom.board[data.row][data.col]) {
            const player = targetRoom.players.find(p => p.id === data.playerId);
            if (player && player.symbol === targetRoom.currentPlayer) {
              targetRoom.board[data.row][data.col] = player.symbol;
              if (checkWinner(targetRoom.board, data.row, data.col)) {
                targetRoom.winner = player.symbol;
                targetRoom.isGameActive = false;
              } else if (isBoardFull(targetRoom.board)) {
                targetRoom.winner = 'draw';
                targetRoom.isGameActive = false;
              } else {
                targetRoom.currentPlayer = targetRoom.currentPlayer === 'X' ? 'O' : 'X';
              }
              broadcastToRoom(data.roomId, {
                type: 'move_made',
                room: targetRoom,
                lastMove: [data.row, data.col],
              });
            }
          }
          break;

        case 'reset_game':
          targetRoom = rooms.get(data.roomId);
          if (targetRoom) {
            targetRoom.board = Array(15).fill().map(() => Array(15).fill(null));
            targetRoom.currentPlayer = 'X';
            targetRoom.winner = null;
            targetRoom.isGameActive = targetRoom.players.length === 2;
            broadcastToRoom(data.roomId, { type: 'game_reset', room: targetRoom });
          }
          break;

        case 'leave_room':
          targetRoom = rooms.get(data.roomId);
          if (targetRoom) {
            targetRoom.players = targetRoom.players.filter(p => p.id !== data.playerId);
            if (targetRoom.players.length === 0) {
              rooms.delete(data.roomId);
            } else {
              targetRoom.isGameActive = false;
              broadcastToRoom(data.roomId, { type: 'player_left', room: targetRoom });
            }
          }
          break;
      }
    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Lỗi xử lý dữ liệu!' }));
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    rooms.forEach((room, roomId) => {
      const leavingPlayer = room.players.find(p => p.ws === ws);
      if (leavingPlayer) {
        room.players = room.players.filter(p => p.ws !== ws);
        if (room.players.length === 0) {
          rooms.delete(roomId);
        } else {
          room.isGameActive = false;
          broadcastToRoom(roomId, { type: 'player_left', room });
        }
      }
    });
  });

  ws.on('error', (error) => {
    console.error('WebSocket client error:', error);
  });
});

function broadcastToRoom(roomId, message) {
  const room = rooms.get(roomId);
  if (!room) return;
  room.players.forEach(player => {
    if (player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(JSON.stringify(message));
    }
  });
}

function checkWinner(board, row, col) {
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
  const player = board[row][col];

  for (const [dr, dc] of directions) {
    let count = 1;
    for (let i = 1; i <= 4; i++) {
      const newRow = row + dr * i;
      const newCol = col + dc * i;
      if (newRow < 0 || newRow >= 15 || newCol < 0 || newCol >= 15 || board[newRow][newCol] !== player) break;
      count++;
    }
    for (let i = 1; i <= 4; i++) {
      const newRow = row - dr * i;
      const newCol = col - dc * i;
      if (newRow < 0 || newRow >= 15 || newCol < 0 || newCol >= 15 || board[newRow][newCol] !== player) break;
      count++;
    }
    if (count >= 5) return true;
  }
  return false;
}

function isBoardFull(board) {
  return board.every(row => row.every(cell => cell !== null));
}

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`WebSocket server running on ws://0.0.0.0:${PORT}`);
});
