
var expect = chai.expect;

var instanceId;
log.setLevel('error');

describe("brightstream.Client", function () {
    var client;
    beforeEach(function () {
        instanceId = brightstream.makeGUID();
        client = brightstream.createClient({
            instanceId: instanceId,
            gloveColor: "white"
        });
    });

    it("extends brightstream.EventEmitter.", function () {
        expect(typeof client.listen).to.equal('function');
        expect(typeof client.ignore).to.equal('function');
        expect(typeof client.fire).to.equal('function');
    });

    it("extends brightstream.Presentable.", function () {
        expect(typeof client.getPresence).to.equal('function');
        expect(typeof client.setPresence).to.equal('function');
    });

    it("has the correct class name.", function () {
        expect(client.className).to.equal('brightstream.Client');
    });

    it("contains some important methods.", function () {
        expect(typeof client.connect).to.equal('function');
        expect(typeof client.disconnect).to.equal('function');
        expect(typeof client.getCall).to.equal('function');
        expect(typeof client.getConnection).to.equal('function');
        expect(typeof client.getEndpoint).to.equal('function');
        expect(typeof client.getEndpoints).to.equal('function');
        expect(typeof client.getGroup).to.equal('function');
        expect(typeof client.getGroups).to.equal('function');
        expect(typeof client.join).to.equal('function');
        expect(typeof client.setOnline).to.equal('function');
        expect(typeof client.setPresence).to.equal('function');
        expect(typeof client.startCall).to.equal('function');
    });

    it("saves unexpected developer-specified parameters.", function () {
        expect(client.gloveColor).to.equal('white');
    });

    it("doesn't expose the signaling channel", function () {
        expect(client.signalingChannel).to.not.exist;
        expect(client.getSignalingChannel).to.not.exist;
    });

    describe("when not connected", function () {
        describe("setPresence()", function () {
            it("tries to set presence and errors because of lack of connection", function (done) {
                var newPresence = 'xa';

                client.setPresence({
                    presence: newPresence,
                    onSuccess: function () {
                        done(new Error("User presence succeeded with no connection!"));
                    },
                    onError: function (err) {
                        expect(err.message).to.contain("no connection");
                        done();
                    }
                });
            });
        });

        describe("connect() 1", function () {
            describe("when called without developmentMode", function () {
                it("throws an error 1", function (done) {
                    client.connect({
                        appId: brightstream.makeGUID(),
                        endpointId: brightstream.makeGUID()
                    }).then(function success() {
                        done(new Error("connect() succeeded with invalid params."));
                    }).catch(function failure(err) {
                        expect(err).to.exist;
                        expect(err.message).to.contain('Must pass');
                        done();
                    });
                });
            });

            describe("when called without appId", function () {
                it("throws an error 2", function (done) {
                    client.connect({
                        developmentMode: true,
                        endpointId: brightstream.makeGUID()
                    }).then(function success() {
                        done(new Error("connect() succeeded with invalid params."));
                    }).catch(function failure(err) {
                        expect(err).to.exist;
                        expect(err.message).to.contain('Must pass');
                        done();
                    });
                });
            });

            describe("when called without endpointId", function () {
                it("throws an error 3", function (done) {
                    client.connect({
                        appId: brightstream.makeGUID(),
                        developmentMode: true
                    }).then(function success() {
                        done(new Error("connect() succeeded with invalid params."));
                    }).catch(function failure(err) {
                        expect(err).to.exist;
                        expect(err.message).to.contain('Must pass');
                        done();
                    });
                });
            });
        });
    });
});
