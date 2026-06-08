#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 20

cd /usr/src/blocleopards

echo "==> Removing corrupted lucide-react..."
rm -rf node_modules/lucide-react

echo "==> Reinstalling lucide-react@1.17.0 with legacy-peer-deps..."
npm install lucide-react@1.17.0 --legacy-peer-deps 2>&1

echo "==> Checking if sliders-vertical.mjs exists now..."
ls node_modules/lucide-react/dist/esm/icons/ | grep sliders
echo "==> Done."
