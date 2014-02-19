var expect = chai.expect;

describe("A brightstream.Presentable ", function () {
    var presentable = brightstream.Presentable({
        "name": "Mickey Mouse",
        "id": "JH5K34J5K34J3453K4J53K45",
        "gloveColor": "white"
    });

    /*
    * Inheritance
    */
    it("extends brightstream.EventEmitter.", function () {
        expect(typeof presentable.listen).to.equal('function');
        expect(typeof presentable.ignore).to.equal('function');
        expect(typeof presentable.fire).to.equal('function');
    });

    /*
    * Make sure there is a className attribute on every instance.
    */
    it("has the correct class name.", function () {
        expect(presentable.className).to.equal('brightstream.Presentable');
    });

    /*
    * Native methods
    */
    it("contains some important methods.", function () {
        expect(typeof presentable.getID).to.equal('function');
        expect(typeof presentable.getName).to.equal('function');
        expect(typeof presentable.getPresence).to.equal('function');
        expect(typeof presentable.setPresence).to.equal('function');
    });

    /*
    * Presence
    */
    it("can set and get presence and fires the correct event.", function () {
        var newPresence = 'xa';

        sinon.spy(presentable, "fire");

        try {
            presentable.setPresence({presence: newPresence});

            expect(presentable.getPresence()).to.equal(newPresence);
            expect(presentable.fire.calledWith('presence')).to.equal(true);
        } finally {
            presentable.fire.restore();
        }
    });

    /*
    * Constructor
    */
    it("saves unexpected developer-specified parameters.", function () {
        expect(presentable.gloveColor).to.equal('white');
    });

    it("doesn't expose the signaling channel", function () {
        expect(presentable.signalingChannel).to.not.exist;
        expect(presentable.getSignalingChannel).to.not.exist;
    });
});
