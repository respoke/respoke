window.respokeTestConfig = {
    baseURL: 'http://testing.digiumlabs.com:3001'
};
respoke.log.setLevel('silent');
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
