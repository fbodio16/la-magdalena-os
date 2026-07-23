#!/bin/bash
set -e
cd "$(dirname "$0")/apps/web"
if ! command -v npx >/dev/null 2>&1; then
  echo "Falta Node.js/npm/npx."
  read -n 1 -s -r -p "Presioná una tecla para cerrar..."
  exit 1
fi
npx vercel --prod
