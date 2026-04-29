import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { createMainWindow } from './window-manager'
import { BackendProcess } from './backend-process'
import { setupMenu } from './menu'
import { registerIpcHandlers } from './ipc-handlers'

let mainWindow: BrowserWindow | null = null
let backend: BackendProcess | null = null

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.damya.data-analytics')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow()
      loadFrontend(mainWindow)
    }
  })

  setupMenu()

  backend = new BackendProcess()
  registerIpcHandlers(backend)

  try {
    await backend.start()
    await backend.waitForHealthy(30000)
  } catch (err) {
    console.error('Failed to start backend:', err)
  }

  mainWindow = createMainWindow()
  loadFrontend(mainWindow)
})

function loadFrontend(window: BrowserWindow): void {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    window.loadFile(join(process.resourcesPath, 'resources', 'renderer', 'index.html'))
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  if (backend) {
    backend.stop()
  }
})
