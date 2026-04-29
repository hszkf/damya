import { contextBridge, ipcRenderer } from 'electron'

const api = {
  getBackendStatus: () => ipcRenderer.invoke('backend:status'),
  restartBackend: () => ipcRenderer.invoke('backend:restart'),
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  quit: () => ipcRenderer.invoke('app:quit'),
}

contextBridge.exposeInMainWorld('electronAPI', api)
