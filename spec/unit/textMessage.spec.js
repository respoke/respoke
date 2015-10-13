/* global respoke: false */
describe("textMessage", function () {
    'use strict';
    var expect = chai.expect;

    describe("when passed a 'push' param", function () {

        it("is placed on the returned object", function () {
            var msg = respoke.TextMessage({ push: true });
            expect(msg).to.include.property('push', true);
        });
    });
});
