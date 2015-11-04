/* global respoke: false, expect: false */
describe("respoke.Call", function () {
    'use strict';
    var expect = chai.expect;
    var Q = respoke.Q;

    describe("when metadata is passed as a param to Call", function () {

        var client;
        var fakeSignalingChannel;
        var fakePeerConnection;

        beforeEach(function () {
            fakeSignalingChannel = {
                getTurnCredentials: sinon.stub().returns(Q()),
                isSendingReport: sinon.stub().returns(false)
            };

            fakePeerConnection = {
                state: {
                    listen: sinon.stub(),
                    dispatch: sinon.stub(),
                    once: sinon.stub()
                },
                listen: sinon.stub()
            };

            client = respoke.createClient({
                instanceId: 'aweltai23jtaowdsviiav'
            });

            sinon.stub(respoke, 'PeerConnection').returns(fakePeerConnection);
        });

        it("attaches the metadata to the returned call", function () {
            var returnedCall = respoke.Call({
                id: 'a3o4;wruadsofijaw',
                instanceId: 'aweltai23jtaowdsviiav',
                metadata: { orderNumber: 'foo' },
                signalingChannel: fakeSignalingChannel
            });

            expect(returnedCall).to.include.property('metadata');
            expect(returnedCall.metadata).to.deep.equal({ orderNumber: 'foo' });
        });
    });
});
