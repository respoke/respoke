#!/bin/bash
set -e
platform=$(uname -s)
version=$(git describe)

for f in $(ls build/respoke*.*)
do
    echo "adding version to $f"

    if [ "$platform" = "Darwin" ]; then
        sed -i '' -e "s/NO BUILD NUMBER/$version/" $f
    else
        sed -i "s/NO BUILD NUMBER/$version/" $f
    fi
done
