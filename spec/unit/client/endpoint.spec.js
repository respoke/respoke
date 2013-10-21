var client = webrtc.Client();
describe("A webrtc.AbstractEndpoint ", function () {
  var endpoint = webrtc.AbstractEndpoint({
    "client": client.getID(),
    "name": "Mickey Mouse",
    "id": "JH5K34J5K34J3453K4J53K45",
    "gloveColor": "white"
  });
  var firedPresence = false;

  /*
   * Inheritance
   */
  it("extends webrtc.Class.", function () {
    expect(typeof endpoint.getClass).toBe('function');
  });

  it("extends webrtc.EventEmitter.", function () {
    expect(typeof endpoint.listen).toBe('function');
    expect(typeof endpoint.ignore).toBe('function');
    expect(typeof endpoint.fire).toBe('function');
  });

  it("extends webrtc.AbstractPresentable.", function () {
    expect(typeof endpoint.getID).toBe('function');
    expect(typeof endpoint.getName).toBe('function');
    expect(typeof endpoint.getPresence).toBe('function');
    expect(typeof endpoint.setPresence).toBe('function');
    expect(typeof endpoint.canSendAudio).toBe('function');
    expect(typeof endpoint.canSendVideo).toBe('function');
    expect(typeof endpoint.hasMedia).toBe('function');
  });

  /*
   * Make sure there is a className attribute and getClass method on every instance.
   */
  it("has the correct class name.", function () {
    expect(endpoint.className).not.toBeFalsy();
    expect(endpoint.getClass()).toBe('webrtc.AbstractEndpoint');
  });

  /*
   * Native methods
   */
  it("contains some important methods.", function () {
    expect(typeof endpoint.startMedia).toBe('function');
    expect(typeof endpoint.stopMedia).toBe('function');
    expect(typeof endpoint.sendMessage).toBe('function');
  });

  /*
   * Presence
   */
  it("can set and get presence and fires the correct event.", function () {
    var newPresence = 'xa';

    spyOn(endpoint, "fire");

    endpoint.setPresence(newPresence);

    expect(endpoint.getPresence()).toBe(newPresence);
    expect(endpoint.fire).toHaveBeenCalledWith('presence', newPresence);
  });

  /*
   * Constructor
   */
  it("saves unexpected developer-specified parameters.", function () {
    expect(endpoint.gloveColor).toBe('white');
  });

  it("doesn't expose the signaling channel", function () {
    expect(endpoint.signalingChannel).toBeUndefined();
    expect(endpoint.getSignalingChannel).toBeUndefined();
  });
});
