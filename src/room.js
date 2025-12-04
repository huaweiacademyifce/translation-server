// src/rooms.js
export function getClientsInRoom(clients, roomId) {
  const normalizedRoom = String(roomId);
  const result = [];

  for (const [ws, meta] of clients.entries()) {
    if (String(meta.roomId) === normalizedRoom) {
      result.push({ ws, meta });
    }
  }

  return result;
}
