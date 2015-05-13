// This requires neighboring spec files therefore allowing webpack to only
// include this one index.js file in order to bundle all the tests together in
// one bundle.
var testsContext = require.context(".", true, /\.spec$/);
testsContext.keys().forEach(testsContext);
