jsdoc -p -d confluence -t /usr/local/bin/jsdoc/templates/confluence mercury-doc-test.js
./pushdocs.py --username=espiceland --password=password --server=http://localhost:8090/rpc/xmlrpc --files confluence/respoke.MercuryTest -v --debug
