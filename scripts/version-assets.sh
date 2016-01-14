#!/bin/sh
full_version=`git describe`
major_version=`echo $full_version | sed -e"s/v\([0-9]*\)\..*/v\1/"
mkdir -p "build/$full_version"
mkdir -p "build/$major_version"

for f in `ls build/respoke*.*`
do
    echo "Processing $f"
    full_destination=`echo $f | sed -e"s/respoke/$full_version\/respoke/"`
    major_destination=`echo $f | sed -e"s/respoke/$major_version\/respoke/"`
    sed -ri "s/NO BUILD NUMBER/$version/" $f
    cp $f $full_destination
    cp $f $major_destination
done

