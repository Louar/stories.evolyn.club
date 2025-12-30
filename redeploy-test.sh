#!/bin/bash

set -e # Exit immediately if any command fails

abort() {
  printf "\n#########################\n"
  printf "${RED}Error! FAILED TO COMPLETE${NORMAL}\n"
  exit 1
}

# Create build
npm run build || abort

LOCATION="/var/apps/evolyn.club/stories"

# Backup
ssh ams-kowedes-com cp -r -- $LOCATION/_LATEST/build $LOCATION/_BU/build || abort

# Copy new files
scp -r ./build ams-kowedes-com:$LOCATION/_LATEST || abort
scp package-lock.json ams-kowedes-com:$LOCATION/_LATEST || abort
scp package.json ams-kowedes-com:$LOCATION/_LATEST || abort

sleep 6

# Restart the service
# Make sure package-lock.json, package.json, svelte.config.js are already uploaded
# npm ci --no-audit --no-fund
ssh ams-kowedes-com "source ~/.nvm/nvm.sh && pm2 -s restart stories.evolyn.club && pm2 -s reset stories.evolyn.club && pm2 show stories.evolyn.club"
