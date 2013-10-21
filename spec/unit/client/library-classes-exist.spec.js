describe("The webrtc namespace", function() {
  it("contains all the library's classes.", function() {
    expect(typeof webrtc).toBe('object');
    expect(typeof webrtc.Class).toBe('function');
    expect(typeof webrtc.AbstractContact).toBe('function');
    expect(typeof webrtc.ContactList).toBe('function');
    expect(typeof webrtc.AbstractEndpoint).toBe('function');
    expect(typeof webrtc.EventEmitter).toBe('function');
    expect(typeof webrtc.AbstractIdentityProvider).toBe('function');
    expect(typeof webrtc.MediaSession).toBe('function');
    expect(typeof webrtc.MediaStream).toBe('function');
    expect(typeof webrtc.Client).toBe('function');
    expect(typeof webrtc.AbstractPresentable).toBe('function');
    expect(typeof webrtc.AbstractUser).toBe('function');
    expect(typeof webrtc.UserSession).toBe('function');
    expect(typeof webrtc.TextMessage).toBe('function');
    expect(typeof webrtc.Contact).toBe('function');
    expect(typeof webrtc.Endpoint).toBe('function');
    expect(typeof webrtc.IdentityProvider).toBe('function');
    expect(typeof webrtc.PresenceMessage).toBe('function');
    expect(typeof webrtc.Presentable).toBe('function');
    expect(typeof webrtc.SignalingChannel).toBe('function');
    expect(typeof webrtc.SignalingMessage).toBe('function');
    expect(typeof webrtc.User).toBe('function');
  });
});
