import { readFileSync } from 'node:fs';
const version='18.0.0';
const index=readFileSync('apps/web/index.html','utf8');
const app=readFileSync('apps/web/js/app.js','utf8');
const required=[
  [index.includes(`v=${version}`),'index.html no usa la versión de caché actual'],
  [app.includes(`APP_VERSION='${version}'`),'app.js no muestra la versión actual'],
  [index.includes('boot-guard.js'),'falta el protector de arranque']
];
const failed=required.filter(([ok])=>!ok);
if(failed.length){for(const [,message] of failed)console.error(`ERROR: ${message}`);process.exit(1)}
console.log('OK: identidad de versión y protector de arranque verificados.');
