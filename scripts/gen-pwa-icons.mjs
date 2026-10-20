import sharp from 'sharp'
import fs from 'fs'

fs.mkdirSync('public/icons', { recursive: true })

await Promise.all([
  sharp('app/icon.png').resize(192, 192).png().toFile('public/icons/icon-192.png'),
  sharp('app/icon.png').resize(512, 512).png().toFile('public/icons/icon-512.png'),
  sharp('app/icon.png').resize(180, 180).png().toFile('public/icons/apple-touch-icon.png'),
])

console.log('PWA icons generated')
