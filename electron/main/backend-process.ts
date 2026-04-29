import { ChildProcess, spawn } from 'child_process'
import { join } from 'path'
import { existsSync, readFileSync } from 'fs'
import { app } from 'electron'

export class BackendProcess {
  private process: ChildProcess | null = null
  private port: number = 8080

  async start(): Promise<void> {
    const resourcesPath = this.getResourcesPath()
    const bunBinary = join(resourcesPath, 'bun-darwin-aarch64')
    const backendDir = app.isPackaged
      ? join(process.resourcesPath, 'backend')
      : join(app.getAppPath(), 'backend')

    if (!existsSync(bunBinary)) {
      throw new Error(`Bun binary not found at ${bunBinary}. Run scripts/copy-bun.sh first.`)
    }

    const env = { ...process.env }

    // Load .env from user data directory (~/Library/Application Support/Damya)
    const userEnvFile = join(app.getPath('userData'), '.env')
    // Fall back to backend directory .env in dev
    const devEnvFile = join(backendDir, '.env')
    const envFile = existsSync(userEnvFile) ? userEnvFile : devEnvFile

    if (existsSync(envFile)) {
      const envContent = readFileSync(envFile, 'utf-8')
      for (const line of envContent.split('\n')) {
        const trimmed = line.trim()
        if (trimmed && !trimmed.startsWith('#')) {
          const eqIndex = trimmed.indexOf('=')
          if (eqIndex > 0) {
            const key = trimmed.slice(0, eqIndex).trim()
            const value = trimmed.slice(eqIndex + 1).trim()
            env[key] = value
          }
        }
      }
    }

    env['PORT'] = String(this.port)

    this.process = spawn(bunBinary, ['run', 'src/index.ts'], {
      cwd: backendDir,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    this.process.stdout?.on('data', (data: Buffer) => {
      console.log(`[Backend] ${data.toString().trim()}`)
    })

    this.process.stderr?.on('data', (data: Buffer) => {
      console.error(`[Backend] ${data.toString().trim()}`)
    })

    this.process.on('exit', (code) => {
      console.log(`[Backend] Process exited with code ${code}`)
    })
  }

  async waitForHealthy(timeoutMs: number = 30000): Promise<void> {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      try {
        const response = await fetch(`http://localhost:${this.port}/health`)
        if (response.ok) return
      } catch {
        // Backend not ready yet
      }
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    throw new Error('Backend failed to start within timeout')
  }

  stop(): void {
    if (this.process) {
      this.process.kill('SIGTERM')
      setTimeout(() => {
        this.process?.kill('SIGKILL')
      }, 5000)
      this.process = null
    }
  }

  async restart(): Promise<void> {
    this.stop()
    await new Promise((resolve) => setTimeout(resolve, 1000))
    await this.start()
    await this.waitForHealthy(30000)
  }

  private getResourcesPath(): string {
    if (app.isPackaged) {
      return join(process.resourcesPath, 'resources')
    }
    return join(app.getAppPath(), 'resources')
  }
}
