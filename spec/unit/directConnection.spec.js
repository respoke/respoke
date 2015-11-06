/* global respoke: false, expect: false */
describe("respoke.DirectConnection", function () {
    'use strict';
    var expect = chai.expect;

    describe("when metadata is passed as a param", function () {

        it("attaches the metadata to the returned DirectConnection", function () {
            var returnedDirectConnection = respoke.DirectConnection({
                instanceId: 'aweltai23jtaowdsviiav',
                metadata: { orderNumber: 'foo' },
                pc: { listen: sinon.stub() },
                call: { }
            });

            expect(returnedDirectConnection).to.include.property('metadata');
            expect(returnedDirectConnection.metadata).to.deep.equal({ orderNumber: 'foo' });
        });
    });
});
