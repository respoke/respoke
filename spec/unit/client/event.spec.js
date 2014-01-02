
var expect = chai.expect;

describe("A webrtc.EventEmitter ", function () {
    var eventThrower = webrtc.EventEmitter({
        "gloveColor": "white"
    });

    /*
    * Inheritance
    */
    it("extends webrtc.Class.", function () {
        expect(typeof eventThrower.getClass).to.equal('function');
    });

    /*
    * Make sure there is a className attribute and getClass method on every instance.
    */
    it("has the correct class name.", function () {
        expect(eventThrower.className).to.be.ok;
        expect(eventThrower.getClass()).to.equal('webrtc.EventEmitter');
    });

    /*
    * Native methods
    */
    it("contains some important methods.", function () {
        expect(typeof eventThrower.listen).to.equal('function');
        expect(typeof eventThrower.ignore).to.equal('function');
        expect(typeof eventThrower.fire).to.equal('function');
    });

    /*
    * Constructor
    */
    it("saves unexpected developer-specified parameters.", function () {
        expect(eventThrower.gloveColor).to.equal('white');
    });

    it("doesn't expose the signaling channel", function () {
        expect(eventThrower.signalingChannel).to.not.exist;
        expect(eventThrower.getSignalingChannel).to.not.exist;
    });

    /*
    * Function
    */
    describe("listen, fire, and ignore", function () {
        var results;

        beforeEach(function(){
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
            eventThrower.listen('event1', function () {
                results[1] += 1;
            });
            eventThrower.listen('event2', function () {
                results[2] += 1;
            });
            eventThrower.listen('event2', function () {
                results[3] += 1;
            });
            eventThrower.listen('event3', function () {
                results[4] += 1;
            });
            eventThrower.listen('event3', function () {
                results[5] += 1;
            });
            eventThrower.listen('event3', function () {
                results[6] += 1;
            });

            eventThrower.fire('event2');
            eventThrower.fire('event3');
            eventThrower.fire('event1');

            expect(results[1]).to.equal(1);
            expect(results[2]).to.equal(1);
            expect(results[3]).to.equal(1);
            expect(results[4]).to.equal(1);
            expect(results[5]).to.equal(1);
            expect(results[6]).to.equal(1);
        });

        it("should honor requests to ignore events", function () {
            eventThrower.ignore('event1');
            eventThrower.ignore('event2');
            eventThrower.ignore('event3');

            eventThrower.fire('event2');
            eventThrower.fire('event3');
            eventThrower.fire('event1');

            expect(results[1]).to.equal(0);
            expect(results[2]).to.equal(0);
            expect(results[3]).to.equal(0);
            expect(results[4]).to.equal(0);
            expect(results[5]).to.equal(0);
            expect(results[6]).to.equal(0);
        });
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

        args.forOwn(function (set, setIndex) {
            var argListener = function (thisSet) {
                thisSet.forOwn(function (item, itemIndex) {
                    //console.log("comparing " + args[setIndex][itemIndex] + " and " + item);
                    expect(args[setIndex][itemIndex]).to.equal(item);
                });
            }
            eventThrower.listen('event4', argListener);
            eventThrower.fire('event4', set);
            eventThrower.ignore('event4', argListener);
        });
    });
});
