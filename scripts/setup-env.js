// Creates .env from .env.example if missing (cross-platform).
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const target = path.join(root, '.env');
if (fs.existsSync(target)) console.log('.env already exists - left untouched.');
else { fs.copyFileSync(path.join(root, '.env.example'), target); console.log('Created .env from .env.example'); }
