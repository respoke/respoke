#!/bin/bash
set -e
# this script is automatically run by npm when issuing the `npm version`
# command, as long as it is referenced as the "version" npm script.

# Stamp the changelog
if [ -f "CHANGELOG.md" ] && $(grep -iq "v.next" CHANGELOG.md); then
    version=$(node -e "console.log(require('./package.json').version)")
    echo "Applying version and date to changelog..."
    sed -i "" -e "s/v\.next/${version} - $(date +"%Y-%m-%d")/" CHANGELOG.md
    git add CHANGELOG.md
fi
