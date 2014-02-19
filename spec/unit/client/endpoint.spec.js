var expect = chai.expect;

var client = brightstream.Client();

describe("A brightstream.Endpoint", function () {
    var endpoint = brightstream.Endpoint({
        "client": client.getID(),
        "name": "Mickey Mouse",
        "id": "JH5K34J5K34J3453K4J53K45",
        "gloveColor": "white"
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
        expect(typeof endpoint.getID).to.equal('function');
        expect(typeof endpoint.getName).to.equal('function');
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
        expect(typeof endpoint.sendSignal).to.equal('function');
        expect(typeof endpoint.resolvePresence).to.equal('function');
        expect(typeof endpoint.call).to.equal('function');
    });

    /*
    * Presence
    */
    it("can set and get presence and fires the correct event.", function () {
        var newPresence = 'xa';

        sinon.spy(endpoint, "fire");
        try {
            endpoint.setPresence({presence: newPresence});

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
