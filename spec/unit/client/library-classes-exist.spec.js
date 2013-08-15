describe("The JavaScript execution environment", function() {
  it("contains all the library's classes.", function() {
    expect(typeof webrtc).toBe('object');
    expect(typeof webrtc.Class).toBe('function');
    expect(typeof webrtc.Contact).toBe('function');
    expect(typeof webrtc.ContactList).toBe('function');
    expect(typeof webrtc.Endpoint).toBe('function');
    expect(typeof webrtc.EventThrower).toBe('function');
    expect(typeof webrtc.IdentityProvider).toBe('function');
    expect(typeof webrtc.MediaSession).toBe('function');
    expect(typeof webrtc.MediaStream).toBe('function');
    expect(typeof webrtc.Mercury).toBe('function');
    expect(typeof webrtc.Message).toBe('function');
    expect(typeof webrtc.Presentable).toBe('function');
    expect(typeof webrtc.SignalingChannel).toBe('function');
    expect(typeof webrtc.User).toBe('function');
    expect(typeof webrtc.UserSession).toBe('function');
    expect(typeof webrtc.XMPPChatMessage).toBe('function');
    expect(typeof webrtc.XMPPContact).toBe('function');
    expect(typeof webrtc.XMPPEndpoint).toBe('function');
    expect(typeof webrtc.XMPPIdentityProvider).toBe('function');
    expect(typeof webrtc.XMPPPresenceMessage).toBe('function');
    expect(typeof webrtc.XMPPPresentable).toBe('function');
    expect(typeof webrtc.XMPPSignalingChannel).toBe('function');
    expect(typeof webrtc.XMPPSignalingMessage).toBe('function');
    expect(typeof webrtc.XMPPUser).toBe('function');
  });
});
