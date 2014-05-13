var expect = chai.expect;

var instanceId = brightstream.makeGUID();
var connectionId = brightstream.makeGUID();
log.setLevel('error');

var client = brightstream.createClient({
    instanceId: instanceId
});

describe("A brightstream.Endpoint", function () {
    var endpoint = client.getEndpoint({
        connectionId: connectionId,
        id: "Mickey Mouse",
        gloveColor: "white"
    });

    /*
    * Inheritance
    */
    it("extends brightstream.EventEmitter.", function () {
        expect(typeof endpoint.listen).to.equal('function');
        expect(typeof endpoint.ignore).to.equal('function');
        expect(typeof endpoint.fire).to.equal('function');
    });

    it("extends brightstream.Presentable.", function () {
        expect(typeof endpoint.getPresence).to.equal('function');
        expect(typeof endpoint.setPresence).to.equal('function');
    });

    /*
    * Make sure there is a className attribute on every instance.
    */
    it("has the correct class name.", function () {
        expect(endpoint.className).to.equal('brightstream.Endpoint');
    });

    /*
    * Native methods
    */
    it("contains some important methods.", function () {
        expect(typeof endpoint.sendMessage).to.equal('function');
        expect(typeof endpoint.resolvePresence).to.equal('function');
        expect(typeof endpoint.startCall).to.equal('function');
        expect(typeof endpoint.startDirectConnection).to.equal('function');
    });

    /*
    * Presence
    */
    it("can set and get presence and fires the correct event.", function () {
        var newPresence = 'xa';

        sinon.spy(endpoint, "fire");
        try {
            endpoint.setPresence({
                presence: newPresence,
                connectionId: connectionId
            });

            expect(endpoint.getPresence()).to.equal(newPresence);
            expect(endpoint.fire.calledWith('presence')).to.equal(true);
        } finally {
            endpoint.fire.restore();
        }

    });

    /*
    * Constructor
    */
    it("saves unexpected developer-specified parameters.", function () {
        expect(endpoint.gloveColor).to.equal('white');
    });

    it("doesn't expose the signaling channel", function () {
        expect(endpoint.signalingChannel).to.not.exist;
        expect(endpoint.getSignalingChannel).to.not.exist;
    });
});
