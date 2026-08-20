const clients = new Set();

export const EventBroadcaster = {
  addClient(res) {
    clients.add(res);
  },

  removeClient(res) {
    clients.delete(res);
  },

  broadcast(eventType, payload) {
    const message = `event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const client of clients) {
      try {
        client.write(message);
      } catch (e) {
        clients.delete(client);
      }
    }
  }
};
