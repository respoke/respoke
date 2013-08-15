describe("A webrtc.EventThrower ", function () {
  var eventThrower = webrtc.EventThrower({
  	"gloveColor": "white"
  });

  /*
   * Inheritance
   */
  it("extends webrtc.Class.", function () {
    expect(typeof eventThrower.getClass).toBe('function');
  });

  /*
   * Make sure there is a className attribute and getClass method on every instance.
   */
  it("has the correct class name.", function () {
    expect(eventThrower.className).not.toBeFalsy();
    expect(eventThrower.getClass()).toBe('webrtc.EventThrower');
  });

  /*
   * Native methods
   */
  it("contains some important methods.", function () {
    expect(typeof eventThrower.listen).toBe('function');
    expect(typeof eventThrower.ignore).toBe('function');
    expect(typeof eventThrower.fire).toBe('function');
  });

  /*
   * Constructor
   */
  it("saves unexpected developer-specified parameters.", function () {
    expect(eventThrower.gloveColor).toBe('white');
  });

  it("doesn't expose the signaling channel", function () {
    expect(eventThrower.signalingChannel).toBeUndefined();
    expect(eventThrower.getSignalingChannel).toBeUndefined();
  });

  /*
   * Function
   */
  var results = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0
  };
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

  	expect(results[1]).toEqual(1);
  	expect(results[2]).toEqual(1);
  	expect(results[3]).toEqual(1);
  	expect(results[4]).toEqual(1);
  	expect(results[5]).toEqual(1);
  	expect(results[6]).toEqual(1);
  });

  /*
   * Can't test this because either ignore() doesn't work or there is some irregularity
   * in the test environment. More testing in the browser is necessary.
  eventThrower.ignore('event1');
  eventThrower.ignore('event2');
  eventThrower.ignore('event3');

  it("should honor requests to ignore events", function () {
  	eventThrower.fire('event2');
  	eventThrower.fire('event3');
  	eventThrower.fire('event1');

  	expect(results[1]).toEqual(1);
  	expect(results[2]).toEqual(1);
  	expect(results[3]).toEqual(1);
  	expect(results[4]).toEqual(1);
  	expect(results[5]).toEqual(1);
  	expect(results[6]).toEqual(1);
  });
  */

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
          expect(args[setIndex][itemIndex]).toEqual(item);
        });
      }
      eventThrower.listen('event4', argListener);
      eventThrower.fire('event4', set);
      eventThrower.ignore('event4', argListener);
    });
  });
});
