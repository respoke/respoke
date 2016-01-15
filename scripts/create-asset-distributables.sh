#!/bin/sh
branch_name=$(git rev-parse --abbrev-ref HEAD)
full_version=$(git describe)
major_version=$(echo $full_version | sed "s/v\([0-9]*\)\..*/v\1/")
mkdir -p "build/$full_version"
mkdir -p "build/$major_version"

for f in $(ls build/respoke*.*)
do
    full_destination=$(echo $f | sed "s/respoke/$full_version\/respoke/")
    major_destination=$(echo $f | sed "s/respoke/$major_version\/respoke/")
    echo "copying '$f' to '$major_destination'"
    cp $f $major_destination

    if [ "$branch_name" = "$major_version" ]; then
        echo "moving '$f' to '$full_destination'"
        mv $f $full_destination
    else
        echo "copying '$f' to '$full_destination'"
        cp $f $full_destination
    fi
done

