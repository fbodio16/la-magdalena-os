#!/bin/bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
WEB="$ROOT/apps/web"

clear
echo "============================================================"
echo " LA MAGDALENA OS 3.0.1 · PUBLICACIÓN EN INTERNET"
echo "============================================================"
echo

if ! command -v node >/dev/null 2>&1 || ! command -v npx >/dev/null 2>&1; then
  echo "No encuentro Node.js/npm en esta Mac."
  echo "Instalalo desde https://nodejs.org y volvé a ejecutar este archivo."
  read -r -p "Presioná Enter para cerrar..."
  exit 1
fi

echo "1/3 Validando el código..."
cd "$ROOT"
npm run check:web

echo
echo "2/3 Iniciando publicación en Vercel..."
echo "La primera vez, Vercel abrirá el navegador para que autorices tu cuenta."
echo
cd "$WEB"
TMP_URL="$(mktemp)"
# tee permite ver el proceso; la última URL https se guarda para abrirla.
npx --yes vercel@latest --prod 2>&1 | tee "$TMP_URL"
URL="$(grep -Eo 'https://[^[:space:]]+\.vercel\.app' "$TMP_URL" | tail -1 || true)"
rm -f "$TMP_URL"

if [ -n "$URL" ]; then
  printf '%s\n' "$URL" > "$ROOT/URL_PUBLICA.txt"
  echo
echo "3/3 PUBLICACIÓN COMPLETADA"
  echo "$URL"
  echo
  open "$URL"
  open "https://supabase.com/dashboard/project/grlifamrkdoffglvrttu/auth/url-configuration"
  echo "Se abrió también Supabase. Allí configurá:"
  echo "  Site URL: $URL"
  echo "  Redirect URL: $URL/**"
else
  echo
  echo "Vercel terminó, pero no pude detectar automáticamente la URL."
  echo "Buscá en la salida anterior la dirección terminada en .vercel.app"
fi

echo
read -r -p "Presioná Enter para cerrar..."
