"use strict";

var testHelper = require('../test-helper');

var expect = chai.expect;
var respoke = testHelper.respoke;
var Q = respoke.Q;
var textMessage = require('../../respoke/textMessage');

describe("textMessage", function () {

    describe("when passed a 'push' param", function () {

        it("is placed on the returned object", function () {
            var msg = textMessage({
                push: true
            });
            expect(msg).to.include.property('push', true);
        });
    });
});
