var mercury = webrtc.Mercury();
describe("A webrtc.UserSession ", function () {
  var token = "0IJASDF09ASDF98SA9D8FHSF";
  var userSession = webrtc.UserSession({
    "timeLoggedIn": new Date(),
    "loggedIn": true,
    "token": token,
    "gloveColor": "white"
  });
  var firedPresence = false;

  /*
   * Inheritance
   */
  it("extends webrtc.Class.", function () {
    expect(typeof userSession.getClass).toBe('function');
  });

  it("extends webrtc.EventThrower.", function () {
    expect(typeof userSession.listen).toBe('function');
    expect(typeof userSession.ignore).toBe('function');
    expect(typeof userSession.fire).toBe('function');
  });

  /*
   * Make sure there is a className attribute and getClass method on every instance.
   */
  it("has the correct class name.", function () {
    expect(userSession.className).not.toBeFalsy();
    expect(userSession.getClass()).toBe('webrtc.UserSession');
  });

  /*
   * Native methods
   */
  it("contains some important methods.", function () {
    expect(typeof userSession.getAuthToken).toBe('function');
    expect(typeof userSession.isLoggedIn).toBe('function');
  });

  /*
   * Constructor
   */
  it("saves unexpected developer-specified parameters.", function () {
    expect(userSession.gloveColor).toBe('white');
  });

  it("doesn't expose the signaling channel", function () {
    expect(userSession.signalingChannel).toBeUndefined();
    expect(userSession.getSignalingChannel).toBeUndefined();
  });

  it("never changes the auth token", function () {
	expect(token).toEqual(userSession.getAuthToken());
	expect(typeof userSession.isLoggedIn()).toBe('boolean');
  });
});
