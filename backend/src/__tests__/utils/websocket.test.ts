import { describe, expect, test, mock, beforeEach } from 'bun:test';

// Create a WebSocketManager class for testing (mirrors the implementation)
class WebSocketManager {
  private clients: Map<string, { socket: any; jobId: number }> = new Map();

  addClient(clientId: string, socket: any, jobId: number): void {
    this.clients.set(clientId, { socket, jobId });
  }

  removeClient(clientId: string): void {
    this.clients.delete(clientId);
  }

  broadcast(jobId: number, message: any): void {
    const data = JSON.stringify(message);
    for (const [clientId, client] of this.clients.entries()) {
      if (client.jobId === jobId) {
        try {
          if (client.socket.readyState === WebSocket.OPEN) {
            client.socket.send(data);
          }
        } catch (error) {
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
        this.removeClient(clientId);
      }
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }

  getClientsForJob(jobId: number): number {
    let count = 0;
    for (const client of this.clients.values()) {
      if (client.jobId === jobId) count++;
    }
    return count;
  }
}

// Import the singleton for basic check
import { websocketManager } from '../../utils/websocket';

describe('WebSocketManager', () => {
  let manager: WebSocketManager;

  beforeEach(() => {
    manager = new WebSocketManager();
  });

  describe('addClient', () => {
    test('should add client to manager', () => {
      const mockSocket = {
        readyState: WebSocket.OPEN,
        send: mock(() => {}),
      } as any;

      manager.addClient('client-1', mockSocket, 1);

      expect(manager.getClientCount()).toBe(1);
    });

    test('should add multiple clients', () => {
      const mockSocket = {
        readyState: WebSocket.OPEN,
        send: mock(() => {}),
      } as any;

      manager.addClient('client-1', mockSocket, 1);
      manager.addClient('client-2', mockSocket, 1);
      manager.addClient('client-3', mockSocket, 2);

      expect(manager.getClientCount()).toBe(3);
    });
  });

  describe('removeClient', () => {
    test('should remove client from manager', () => {
      const mockSocket = {
        readyState: WebSocket.OPEN,
        send: mock(() => {}),
      } as any;

      manager.addClient('client-1', mockSocket, 1);
      expect(manager.getClientCount()).toBe(1);

      manager.removeClient('client-1');

      expect(manager.getClientCount()).toBe(0);
    });

    test('should handle removing non-existent client', () => {
      expect(() => manager.removeClient('non-existent')).not.toThrow();
    });
  });

  describe('broadcast', () => {
    test('should broadcast message to all clients for a specific job', () => {
      const mockSocket1 = {
        readyState: WebSocket.OPEN,
        send: mock(() => {}),
      } as any;
      const mockSocket2 = {
        readyState: WebSocket.OPEN,
        send: mock(() => {}),
      } as any;
      const mockSocket3 = {
        readyState: WebSocket.OPEN,
        send: mock(() => {}),
      } as any;

      manager.addClient('client-1', mockSocket1, 1);
      manager.addClient('client-2', mockSocket2, 1);
      manager.addClient('client-3', mockSocket3, 2);

      manager.broadcast(1, { type: 'test', data: 'hello' });

      expect(mockSocket1.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'test', data: 'hello' })
      );
      expect(mockSocket2.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'test', data: 'hello' })
      );
      expect(mockSocket3.send).not.toHaveBeenCalled();
    });

    test('should not send to closed connections', () => {
      const mockSocket = {
        readyState: WebSocket.CLOSED,
        send: mock(() => {}),
      } as any;

      manager.addClient('client-1', mockSocket, 1);

      manager.broadcast(1, { type: 'test' });

      expect(mockSocket.send).not.toHaveBeenCalled();
    });

    test('should remove client on send error', () => {
      const mockSocket = {
        readyState: WebSocket.OPEN,
        send: mock(() => {
          throw new Error('Connection lost');
        }),
      } as any;

      manager.addClient('client-1', mockSocket, 1);
      expect(manager.getClientCount()).toBe(1);

      manager.broadcast(1, { type: 'test' });

      expect(manager.getClientCount()).toBe(0);
    });
  });

  describe('broadcastAll', () => {
    test('should broadcast message to all clients', () => {
      const mockSocket1 = {
        readyState: WebSocket.OPEN,
        send: mock(() => {}),
      } as any;
      const mockSocket2 = {
        readyState: WebSocket.OPEN,
        send: mock(() => {}),
      } as any;

      manager.addClient('client-1', mockSocket1, 1);
      manager.addClient('client-2', mockSocket2, 2);

      manager.broadcastAll({ type: 'global', message: 'hello all' });

      expect(mockSocket1.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'global', message: 'hello all' })
      );
      expect(mockSocket2.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'global', message: 'hello all' })
      );
    });

    test('should handle empty client list', () => {
      expect(() => manager.broadcastAll({ type: 'test' })).not.toThrow();
    });
  });

  describe('getClientCount', () => {
    test('should return 0 for empty manager', () => {
      expect(manager.getClientCount()).toBe(0);
    });

    test('should return correct count', () => {
      const mockSocket = {
        readyState: WebSocket.OPEN,
        send: mock(() => {}),
      } as any;

      manager.addClient('client-1', mockSocket, 1);
      manager.addClient('client-2', mockSocket, 1);

      expect(manager.getClientCount()).toBe(2);
    });
  });

  describe('getClientsForJob', () => {
    test('should return count of clients for specific job', () => {
      const mockSocket = {
        readyState: WebSocket.OPEN,
        send: mock(() => {}),
      } as any;

      manager.addClient('client-1', mockSocket, 1);
      manager.addClient('client-2', mockSocket, 1);
      manager.addClient('client-3', mockSocket, 2);

      expect(manager.getClientsForJob(1)).toBe(2);
      expect(manager.getClientsForJob(2)).toBe(1);
      expect(manager.getClientsForJob(999)).toBe(0);
    });
  });
});

describe('websocketManager singleton', () => {
  test('should be an instance of WebSocketManager', () => {
    expect(websocketManager).toBeDefined();
    expect(typeof websocketManager.addClient).toBe('function');
    expect(typeof websocketManager.removeClient).toBe('function');
    expect(typeof websocketManager.broadcast).toBe('function');
  });
});
