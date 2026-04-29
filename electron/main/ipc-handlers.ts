import { ipcMain, app } from 'electron'
import { BackendProcess } from './backend-process'

export function registerIpcHandlers(backend: BackendProcess): void {
  ipcMain.handle('backend:status', async () => {
    try {
      const response = await fetch('http://localhost:8080/health')
      return await response.json()
    } catch {
      return { status: 'offline' }
    }
  })

  ipcMain.handle('backend:restart', async () => {
    await backend.restart()
    return { status: 'restarted' }
  })

  ipcMain.handle('app:version', () => {
    return app.getVersion()
  })

  ipcMain.handle('app:quit', () => {
    app.quit()
  })
}
