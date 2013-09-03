var client = webrtc.Client();
describe("A webrtc.AbstractUser ", function () {
  var user = webrtc.AbstractUser({
    "client": client.getID(),
    "name": "Mickey Mouse",
    "id": "JH5K34J5K34J3453K4J53K45",
    "timeLoggedIn": new Date(),
    "loggedIn": true,
    "gloveColor": "white"
  });
  var firedPresence = false;

  /*
   * Inheritance
   */
  it("extends webrtc.Class.", function () {
    expect(typeof user.getClass).toBe('function');
  });

  it("extends webrtc.EventThrower.", function () {
    expect(typeof user.listen).toBe('function');
    expect(typeof user.ignore).toBe('function');
    expect(typeof user.fire).toBe('function');
  });

  it("extends webrtc.AbstractPresentable.", function () {
    expect(typeof user.getID).toBe('function');
    expect(typeof user.getName).toBe('function');
    expect(typeof user.getPresence).toBe('function');
    expect(typeof user.setPresence).toBe('function');
    expect(typeof user.canSendAudio).toBe('function');
    expect(typeof user.canSendVideo).toBe('function');
    expect(typeof user.hasMedia).toBe('function');
  });

  /*
   * Make sure there is a className attribute and getClass method on every instance.
   */
  it("has the correct class name.", function () {
    expect(user.className).not.toBeFalsy();
    expect(user.getClass()).toBe('webrtc.AbstractUser');
  });

  /*
   * Native methods
   */
  it("contains some important methods.", function () {
    expect(typeof user.getUserSession).toBe('function');
    expect(typeof user.getContactList).toBe('function');
    expect(typeof user.setOnline).toBe('function');
  });

  /*
   * Presence
   */
  it("can set and get presence and fires the correct event.", function () {
    var newPresence = 'xa';

    spyOn(user, "fire");

    user.setPresence(newPresence);

    expect(user.getPresence()).toBe(newPresence);
    expect(user.fire).toHaveBeenCalledWith('presence', newPresence);
  });

  /*
   * Constructor
   */
  it("saves unexpected developer-specified parameters.", function () {
    expect(user.gloveColor).toBe('white');
  });

  it("doesn't expose the signaling channel", function () {
    expect(user.signalingChannel).toBeUndefined();
    expect(user.getSignalingChannel).toBeUndefined();
  });

  it("has a user session.", function () {
	var userSession = user.getUserSession();
	expect(userSession).not.toBe(undefined);
	expect(userSession.timeLoggedIn).not.toBe(undefined);
  });
});
