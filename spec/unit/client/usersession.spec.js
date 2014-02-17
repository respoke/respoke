
var expect = chai.expect;

var client = brightstream.Client();

describe("A brightstream.UserSession ", function () {
    var token = "0IJASDF09ASDF98SA9D8FHSF";
    /*
    * UserSession doesn't use the client id, but this is not true of most classes!
    */
    var userSession = brightstream.UserSession({
        "timeLoggedIn": new Date(),
        "loggedIn": true,
        "token": token,
        "gloveColor": "white"
    });

    /*
    * Inheritance
    */
    it("extends brightstream.Class.", function () {
        expect(typeof userSession.getClass).to.equal('function');
    });

    it("extends brightstream.EventEmitter.", function () {
        expect(typeof userSession.listen).to.equal('function');
        expect(typeof userSession.ignore).to.equal('function');
        expect(typeof userSession.fire).to.equal('function');
    });

    /*
    * Make sure there is a className attribute and getClass method on every instance.
    */
    it("has the correct class name.", function () {
        expect(userSession.className).to.be.ok;
        expect(userSession.getClass()).to.equal('brightstream.UserSession');
    });

    /*
    * Native methods
    */
    it("contains some important methods.", function () {
        expect(typeof userSession.getAuthToken).to.equal('function');
        expect(typeof userSession.isLoggedIn).to.equal('function');
    });

    /*
    * Constructor
    */
    it("saves unexpected developer-specified parameters.", function () {
        expect(userSession.gloveColor).to.equal('white');
    });

    it("doesn't expose the signaling channel", function () {
        expect(userSession.signalingChannel).to.not.exist;
        expect(userSession.getSignalingChannel).to.not.exist;
    });

    it("never changes the auth token", function () {
        expect(token).to.equal(userSession.getAuthToken());
        expect(typeof userSession.isLoggedIn()).to.equal('boolean');
    });
});
