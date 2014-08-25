
var expect = chai.expect;

describe("A respoke.EventEmitter", function () {
    var results = [];
    var eventEmitter = respoke.EventEmitter({
        "gloveColor": "white"
    });

    it("has the correct class name.", function () {
        expect(eventEmitter.className).to.equal('respoke.EventEmitter');
    });

    it("contains some important methods.", function () {
        expect(typeof eventEmitter.listen).to.equal('function');
        expect(typeof eventEmitter.ignore).to.equal('function');
        expect(typeof eventEmitter.fire).to.equal('function');
        expect(typeof eventEmitter.once).to.equal('function');
    });

    it("saves unexpected developer-specified parameters.", function () {
        expect(eventEmitter.gloveColor).to.equal('white');
    });

    it("doesn't expose the signaling channel", function () {
        expect(eventEmitter.signalingChannel).to.not.exist;
        expect(eventEmitter.getSignalingChannel).to.not.exist;
    });

    it("should accept and correctly pass all kinds of arguments.", function () {
        var args = [
            [null],
            [null, "real"],
            [undefined, "real"],
            [1],
            [0],
            [0, 1],
            ["happy", "real"],
            [[1, 2, 3]],
            [[1, 2], [3, 4]],
            [[1, 2], {3: 4}],
            [{1: 2, 3: 4}],
            [{1: 2, 3: 4}, {1: 2, 3: 4}]
        ];

        args.forEach(function (set, setIndex) {
            var argListener = function (thisSet) {
                thisSet.forEach(function (item, itemIndex) {
                    //console.log("comparing " + args[setIndex][itemIndex] + " and " + item);
                    expect(args[setIndex][itemIndex]).to.equal(item);
                });
            }
            eventEmitter.listen('event4', argListener);
            eventEmitter.fire('event4', set);
            eventEmitter.ignore('event4', argListener);
        });
    });

    describe('when firing events', function () {
        beforeEach(function () {
            results = {
                1: 0,
                2: 0,
                3: 0,
                4: 0,
                5: 0,
                6: 0
            };
        });

        it("should handle multiple events, multiple listeners, and call each once.", function () {
            eventEmitter.listen('event1', function () {
                results[1] += 1;
            });
            eventEmitter.listen('event2', function () {
                results[2] += 1;
            });
            eventEmitter.listen('event2', function () {
                results[3] += 1;
            });
            eventEmitter.listen('event3', function () {
                results[4] += 1;
            });
            eventEmitter.listen('event3', function () {
                results[5] += 1;
            });
            eventEmitter.listen('event3', function () {
                results[6] += 1;
            });

            eventEmitter.fire('event2');
            eventEmitter.fire('event3');
            eventEmitter.fire('event1');

            expect(results[1]).to.equal(1);
            expect(results[2]).to.equal(1);
            expect(results[3]).to.equal(1);
            expect(results[4]).to.equal(1);
            expect(results[5]).to.equal(1);
            expect(results[6]).to.equal(1);
        });

        it("should not call any listeners when ignore is used", function () {
            eventEmitter.ignore('event1');
            eventEmitter.ignore('event2');
            eventEmitter.ignore('event3');

            eventEmitter.fire('event2');
            eventEmitter.fire('event3');
            eventEmitter.fire('event1');

            expect(results[1]).to.equal(0);
            expect(results[2]).to.equal(0);
            expect(results[3]).to.equal(0);
            expect(results[4]).to.equal(0);
            expect(results[5]).to.equal(0);
            expect(results[6]).to.equal(0);
        });
    });

    describe("the 'once' method", function () {
        var listener;

        beforeEach(function () {
            listener = sinon.spy();
            eventEmitter.once('onceTest', listener);
            eventEmitter.fire('onceTest');
            eventEmitter.fire('onceTest');
            eventEmitter.fire('onceTest');
        });

        it("fires the method only once", function () {
            expect(listener.called).to.equal(true);
            expect(listener.callCount).to.equal(1);
        });

        it("removes the listener after it fires", function (done) {
            setTimeout(function () {
                var has = eventEmitter.hasListeners('onceTest');
                try {
                    expect(has).to.equal(false);
                    done();
                } catch (err) {
                    done(err);
                }
            }, 2);
        });
    });
});
