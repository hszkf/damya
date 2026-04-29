import { BrowserWindow, shell, nativeImage } from 'electron'
import { join, resolve } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { app } from 'electron'

interface WindowState {
  width: number
  height: number
  x?: number
  y?: number
  isMaximized: boolean
}

function getStatePath(): string {
  return join(app.getPath('userData'), 'window-state.json')
}

function loadWindowState(): WindowState {
  const defaults: WindowState = { width: 1400, height: 900, isMaximized: false }
  try {
    if (existsSync(getStatePath())) {
      return { ...defaults, ...JSON.parse(readFileSync(getStatePath(), 'utf-8')) }
    }
  } catch {
    // Use defaults
  }
  return defaults
}

function saveWindowState(window: BrowserWindow): void {
  const bounds = window.getBounds()
  const state: WindowState = {
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    isMaximized: window.isMaximized(),
  }
  writeFileSync(getStatePath(), JSON.stringify(state))
}

export function createMainWindow(): BrowserWindow {
  const savedState = loadWindowState()

  const mainWindow = new BrowserWindow({
    width: savedState.width,
    height: savedState.height,
    x: savedState.x,
    y: savedState.y,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    icon: nativeImage.createFromPath(resolve(__dirname, '../../resources/icon.icns')),
    title: 'Damya Data Analytics',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 18 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (savedState.isMaximized) {
    mainWindow.maximize()
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('close', () => {
    saveWindowState(mainWindow)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  return mainWindow
}
