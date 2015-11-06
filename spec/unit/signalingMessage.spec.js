/* global respoke: false, expect: false */
describe("signalingMessage", function () {
    'use strict';
    var expect = chai.expect;

    describe("when not passed a 'rawMessage' field", function () {

        it("throws if not passed a 'signalType' field", function () {
            expect(function () {
                respoke.SignalingMessage({
                    sessionId: '32579f9b-98d7-46ff-a202-6fdaf649bcde',
                    target: 'call',
                    signalId: 'someSignalId',
                    sessionDescription: { something: 'fancy' },
                    iceCandidates: [ 'ice', 'ice', 'baby'],
                    offering: 'e',
                    callerId: 'h',
                    requesting: 'i',
                    reason: 'j',
                    error: 'k',
                    status: 'l',
                    connectionId: 'm',
                    version: '1.0',
                    finalCandidates: ['a', 'b', 'c'],
                    metadata: { foo: 'bar' }
                });
            }).to.throw();
        });

        it("throws if not passed a 'sessionId' field", function () {
            expect(function () {
                respoke.SignalingMessage({
                    signalType: 'offer',
                    target: 'call',
                    signalId: 'someSignalId',
                    sessionDescription: { something: 'fancy' },
                    iceCandidates: [ 'ice', 'ice', 'baby'],
                    offering: 'e',
                    callerId: 'h',
                    requesting: 'i',
                    reason: 'j',
                    error: 'k',
                    status: 'l',
                    connectionId: 'm',
                    version: '1.0',
                    finalCandidates: ['a', 'b', 'c'],
                    metadata: { foo: 'bar' }
                });
            }).to.throw();
        });

        it("throws if not passed a 'target' field", function () {
            expect(function () {
                respoke.SignalingMessage({
                    signalType: 'offer',
                    sessionId: '32579f9b-98d7-46ff-a202-6fdaf649bcde',
                    signalId: 'someSignalId',
                    sessionDescription: { something: 'fancy' },
                    iceCandidates: [ 'ice', 'ice', 'baby'],
                    offering: 'e',
                    callerId: 'h',
                    requesting: 'i',
                    reason: 'j',
                    error: 'k',
                    status: 'l',
                    connectionId: 'm',
                    version: '1.0',
                    finalCandidates: ['a', 'b', 'c'],
                    metadata: { foo: 'bar' }
                });
            }).to.throw();
        });

        it("throws if not passed a 'signalId' field", function () {
            expect(function () {
                respoke.SignalingMessage({
                    signalType: 'offer',
                    target: 'call',
                    sessionId: '32579f9b-98d7-46ff-a202-6fdaf649bcde',
                    sessionDescription: { something: 'fancy' },
                    iceCandidates: [ 'ice', 'ice', 'baby'],
                    offering: 'e',
                    callerId: 'h',
                    requesting: 'i',
                    reason: 'j',
                    error: 'k',
                    status: 'l',
                    connectionId: 'm',
                    version: '1.0',
                    finalCandidates: ['a', 'b', 'c'],
                    metadata: { foo: 'bar' }
                });
            }).to.throw();
        });

        it("returns an object with all required fields and any optional fields specified", function () {
            var testMessage = {
                signalType: 'offer',
                sessionId: '32579f9b-98d7-46ff-a202-6fdaf649bcde',
                target: 'call',
                signalId: 'someSignalId',
                sessionDescription: { something: 'fancy' },
                iceCandidates: [ 'ice', 'ice', 'baby'],
                offering: 'e',
                callerId: 'h',
                requesting: 'i',
                reason: 'j',
                error: 'k',
                status: 'l',
                connectionId: 'm',
                finalCandidates: ['a', 'b', 'c'],
                metadata: { foo: 'bar' }
            };

            var result = respoke.SignalingMessage(testMessage);

            expect(result).to.include.property('signalType', 'offer');
            expect(result).to.include.property('sessionId', '32579f9b-98d7-46ff-a202-6fdaf649bcde');
            expect(result).to.include.property('target', 'call');
            expect(result).to.include.property('signalId', 'someSignalId');
            expect(result).to.include.property('sessionDescription');
            expect(result.sessionDescription).to.deep.equal({ something: 'fancy' });
            expect(result).to.include.property('iceCandidates');
            expect(result.iceCandidates).to.deep.equal([ 'ice', 'ice', 'baby']);
            expect(result).to.include.property('offering', 'e');
            expect(result).to.include.property('callerId', 'h');
            expect(result).to.include.property('requesting', 'i');
            expect(result).to.include.property('reason', 'j');
            expect(result).to.include.property('error', 'k');
            expect(result).to.include.property('status', 'l');
            expect(result).to.include.property('connectionId', 'm');
            expect(result).to.include.property('version', '1.0');
            expect(result).to.include.property('finalCandidates');
            expect(result.finalCandidates).to.deep.equal(['a', 'b', 'c']);
            expect(result).to.include.property('metadata');
            expect(result.metadata).to.deep.equal({ foo: 'bar' });
        });

        it("appends a version field to the result", function () {
            var testMessage = {
                signalType: 'offer',
                sessionId: '32579f9b-98d7-46ff-a202-6fdaf649bcde',
                target: 'call',
                signalId: 'someSignalId',
                sessionDescription: { something: 'fancy' },
                iceCandidates: [ 'ice', 'ice', 'baby'],
                offering: 'e',
                callerId: 'h',
                requesting: 'i',
                reason: 'j',
                error: 'k',
                status: 'l',
                connectionId: 'm',
                finalCandidates: ['a', 'b', 'c'],
                metadata: { foo: 'bar' }
            };

            var result = respoke.SignalingMessage(testMessage);

            expect(result).to.include.property('version', '1.0');
        });
    });
});
