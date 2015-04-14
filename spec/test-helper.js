'use strict';

var config = require('./test-config.json');

// TODO: Replace this with something that is _not_ global.
// this is used in the respoke setup so it must come before requiring it
window.skipErrorReporting = true;

var respoke = require('../');
// TODO: require respoke-stats

respoke.log.setLevel('silent');

module.exports = {
    config: config,
    respoke: respoke
};

window.doneOnceBuilder = function (done) {
    var called = false;
    return function (err) {
        if (!called) {
            called = true;
            done(err);
        }
    };
};

// build a function which calls the done callback according to the following rules:
//   1. immediately if there is an error passed to it
//   2. when the function has been called $num times.
window.doneCountBuilder = function (num, done) {
    return (function () {
        var called = false;
        var count = 0;
        if (!num || num < 0) {
            throw new Error('First argument must be a positive integer.');
        }

        return function (err) {
            if (called === true) {
                return;
            }

            count += 1;
            if (count === num || err) {
                called = true;
                done(err);
            }
        };
    })();
};
