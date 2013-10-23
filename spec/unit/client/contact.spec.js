var client = webrtc.Client();
describe("A webrtc.AbstractContact ", function () {
  var contact = webrtc.AbstractContact({
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
    expect(typeof contact.getClass).toBe('function');
  });

  it("extends webrtc.EventEmitter.", function () {
    expect(typeof contact.listen).toBe('function');
    expect(typeof contact.ignore).toBe('function');
    expect(typeof contact.fire).toBe('function');
  });

  it("extends webrtc.AbstractPresentable.", function () {
    expect(typeof contact.getID).toBe('function');
    expect(typeof contact.getName).toBe('function');
    expect(typeof contact.getPresence).toBe('function');
    expect(typeof contact.setPresence).toBe('function');
    expect(typeof contact.canSendAudio).toBe('function');
    expect(typeof contact.canSendVideo).toBe('function');
    expect(typeof contact.callInProgress).toBe('function');
  });

  it("extends webrtc.AbstractEndpoint.", function () {
    expect(typeof contact.startCall).toBe('function');
    expect(typeof contact.stopCall).toBe('function');
    expect(typeof contact.sendMessage).toBe('function');
  });
  /*
   * Make sure there is a className attribute and getClass method on every instance.
   */
  it("has the correct class name.", function () {
    expect(contact.className).not.toBeFalsy();
    expect(contact.getClass()).toBe('webrtc.AbstractContact');
  });

  /*
   * Native methods
   */
  it("contains some important methods.", function () {
    expect(typeof contact.getMessages).toBe('function');
  });

  /*
   * Presence
   */
  it("can set and get presence and fires the correct event.", function () {
    var newPresence = 'xa';

    spyOn(contact, "fire");

    contact.setPresence(newPresence);

    expect(contact.getPresence()).toBe(newPresence);
    expect(contact.fire).toHaveBeenCalledWith('presence', newPresence);
  });

  /*
   * Constructor
   */
  it("saves unexpected developer-specified parameters.", function () {
    expect(contact.gloveColor).toBe('white');
  });

  it("doesn't expose the signaling channel", function () {
    expect(contact.signalingChannel).toBeUndefined();
    expect(contact.getSignalingChannel).toBeUndefined();
  });
});
