describe("A webrtc.AbstractPresentable ", function () {
  var presentable = webrtc.AbstractPresentable({
    "name": "Mickey Mouse",
    "id": "JH5K34J5K34J3453K4J53K45",
    "gloveColor": "white"
  });
  var firedPresence = false;

  /*
   * Inheritance
   */
  it("extends webrtc.Class.", function () {
    expect(typeof presentable.getClass).toBe('function');
  });

  it("extends webrtc.EventEmitter.", function () {
    expect(typeof presentable.listen).toBe('function');
    expect(typeof presentable.ignore).toBe('function');
    expect(typeof presentable.fire).toBe('function');
  });

  /*
   * Make sure there is a className attribute and getClass method on every instance.
   */
  it("has the correct class name.", function () {
    expect(presentable.className).not.toBeFalsy();
    expect(presentable.getClass()).toBe('webrtc.AbstractPresentable');
  });

  /*
   * Native methods
   */
  it("contains some important methods.", function () {
    expect(typeof presentable.getID).toBe('function');
    expect(typeof presentable.getName).toBe('function');
    expect(typeof presentable.getPresence).toBe('function');
    expect(typeof presentable.setPresence).toBe('function');
    expect(typeof presentable.canSendAudio).toBe('function');
    expect(typeof presentable.canSendVideo).toBe('function');
    expect(typeof presentable.hasMedia).toBe('function');
  });

  /*
   * Presence
   */
  it("can set and get presence and fires the correct event.", function () {
    var newPresence = 'xa';

    spyOn(presentable, "fire");

    presentable.setPresence(newPresence);

    expect(presentable.getPresence()).toBe(newPresence);
    expect(presentable.fire).toHaveBeenCalledWith('presence', newPresence);
  });

  /*
   * Constructor
   */
  it("saves unexpected developer-specified parameters.", function () {
    expect(presentable.gloveColor).toBe('white');
  });

  it("doesn't expose the signaling channel", function () {
    expect(presentable.signalingChannel).toBeUndefined();
    expect(presentable.getSignalingChannel).toBeUndefined();
  });
});
