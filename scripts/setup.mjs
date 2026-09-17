import { copyFile,access } from 'node:fs/promises';
try{await access('.env.local');console.log('Configuration already exists: .env.local')}catch{await copyFile('.env.example','.env.local');console.log('Created .env.local — change APP_PASSWORD and SESSION_SECRET before using the server.')}
