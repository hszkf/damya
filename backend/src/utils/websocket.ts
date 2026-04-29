// WebSocket manager for real-time updates
// Uses Bun's native WebSocket support

interface WebSocketClient {
  socket: WebSocket;
  jobId: string;
}

class WebSocketManager {
  private clients: Map<string, WebSocketClient> = new Map();

  addClient(clientId: string, socket: WebSocket, jobId: string): void {
    this.clients.set(clientId, { socket, jobId });
    console.log(`WebSocket client connected: ${clientId} for job ${jobId}`);
  }

  removeClient(clientId: string): void {
    this.clients.delete(clientId);
    console.log(`WebSocket client disconnected: ${clientId}`);
  }

  broadcast(jobId: string, message: any): void {
    const data = JSON.stringify(message);

    for (const [clientId, client] of this.clients.entries()) {
      if (client.jobId === jobId) {
        try {
          if (client.socket.readyState === WebSocket.OPEN) {
            client.socket.send(data);
          }
        } catch (error) {
          console.error(`Error sending to client ${clientId}:`, error);
          this.removeClient(clientId);
        }
      }
    }
  }

  broadcastAll(message: any): void {
    const data = JSON.stringify(message);

    for (const [clientId, client] of this.clients.entries()) {
      try {
        if (client.socket.readyState === WebSocket.OPEN) {
          client.socket.send(data);
        }
      } catch (error) {
        console.error(`Error sending to client ${clientId}:`, error);
        this.removeClient(clientId);
      }
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }

  getClientsForJob(jobId: string): number {
    let count = 0;
    for (const client of this.clients.values()) {
      if (client.jobId === jobId) {
        count++;
      }
    }
    return count;
  }
}

export const websocketManager = new WebSocketManager();

// WebSocket upgrade result type
export type WebSocketUpgradeResult = 
  | { handled: false }  // Not a WebSocket request, let Hono handle it
  | { handled: true };  // WebSocket upgrade was handled (success or error response sent)

// WebSocket upgrade handler for Bun
export function handleWebSocketUpgrade(req: Request, server: any): WebSocketUpgradeResult {
  const url = new URL(req.url);
  
  // Only handle /ws/* paths with WebSocket upgrade header
  if (!url.pathname.startsWith('/ws/') || req.headers.get('upgrade') !== 'websocket') {
    return { handled: false }; // Let Hono handle non-WebSocket routes
  }

  // Match UUID pattern without dashes: /ws/{uuid} (32 hex chars, lowercase)
  const pathMatch = url.pathname.match(/^\/ws\/([a-f0-9]{32})$/);

  if (pathMatch) {
    const jobId = pathMatch[1];

    const upgraded = server.upgrade(req, {
      data: {
        jobId,
        clientId: crypto.randomUUID(),
      },
    });

    if (upgraded) {
      return { handled: true }; // Bun handles the WebSocket connection
    }
  }

  // WebSocket path but upgrade failed - still mark as handled
  // Bun will send an error response
  return { handled: true };
}

// WebSocket handlers for Bun
export const websocketHandlers = {
  open(ws: any) {
    const { clientId, jobId } = ws.data;
    websocketManager.addClient(clientId, ws, jobId);

    ws.send(JSON.stringify({
      type: 'connected',
      message: `Connected to job ${jobId} updates`,
    }));
  },

  message(ws: any, message: string) {
    // Handle incoming messages if needed
    try {
      const data = JSON.parse(message);
      console.log('Received WebSocket message:', data);
    } catch {
      // Ignore invalid JSON
    }
  },

  close(ws: any) {
    const { clientId } = ws.data;
    websocketManager.removeClient(clientId);
  },
};
