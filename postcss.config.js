const path = require('path')
const jiti = require('jiti')(path.resolve('dummy.ts'))
const tailwindConfig = jiti(path.resolve(__dirname, 'frontend/tailwind.config.ts'))

// Override content paths with absolute paths so Tailwind can find source files
// regardless of where postcss.config.js is loaded from
tailwindConfig.content = [
  path.resolve(__dirname, 'frontend/index.html'),
  path.resolve(__dirname, 'frontend/src/**/*.{js,ts,jsx,tsx}'),
]

module.exports = {
  plugins: {
    tailwindcss: { config: tailwindConfig },
    autoprefixer: {},
  },
}
