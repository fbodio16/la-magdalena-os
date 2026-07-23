#!/bin/bash
set -e
cd "$(dirname "$0")/apps/web"
open "http://localhost:8080"
python3 -m http.server 8080
