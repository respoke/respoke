#!/bin/bash
set -e
branch_name=$(git rev-parse --abbrev-ref HEAD | sed "s#/#-#g")

if [[ ! "$branch_name" =~ ^v[0-9]+ ]]; then
    echo "Not building a deprecated version. Skipping docs versioning..."
    exit 0;
fi

echo "Building a deprecated version. Moving docs to versioned directory..."
mv .docs/site/js-library .docs/site/js-library-$branch_name
