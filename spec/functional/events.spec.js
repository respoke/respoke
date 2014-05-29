var username1;
var password1 = 'password';

var username2;
var password2 = 'password';

var helpers = require('../util/helpers.js');
var Client = helpers.Client;
var expect = require('chai').expect;
var driver;
var env;

describe('System Events', function () {

    this.timeout(30000);

    var driver1;
    var client1;
    var client1Name = 'client1';

    var driver2;
    var client2;
    var client2Name = 'client2';

    before(function (done) {
        helpers.testFixtureBeforeTest({randomUserNames: 2, createEndpoints: true}, function (d, environment) {
            driver = d;
            env = environment;
            username1 = env.users[0].username;
            username2 = env.users[1].username;

            driver1 = helpers.webDriver();
            client1 = new Client(driver1, client1Name, env.url);
            driver1.get(process.env['MERCURY_URL'] + '/index.html');
            client1.init(env.appId);
            client1.connect();
            client1.login(username1, password1).then(function () {
                driver2 = helpers.webDriver();
                client2 = new Client(driver2, client2Name, env.url);
                driver2.get(process.env['MERCURY_URL'] + '/index.html');
                client2.init(env.appId);
                client2.connect();
            }).then(done);
        });
    });

    describe("Presentable Events", function () {
        /**
         * @event respoke.Presentable#presence
         * @type {string}
         */
        it("should receive event for respoke.Presentable#presence on login", function (done) {
            client1.listenOnEndpointEvent(username2, 'presence', 'endpointsPresence').then(function () {
                client2.login(username2, password2).then(function (user) {
                    setTimeout(function () {
                        client1.getValue('endpointsPresence').then(function (value) {
                            expect(value).to.equal('available');
                            done();
                        });
                    }, 1000);
                });
            });
        });

        it("should receive event for respoke.Presentable#presence when sendPresence is called", function (done) {
            client2.setPresence({presence: 'unavailable'}).then(function () {
                setTimeout(function () {
                    client1.getValue('endpointsPresence').then(function (value) {
                        expect(value).to.equal('unavailable');
                        done();
                    });
                }, 1000);
            });
        });
    });

    describe("Endpoint Events", function () {

        /*
         * @event respoke.Endpoint#message:received
         * @type {object}
         */

        it("should receive event for respoke.Endpoint#message", function (done) {
            client2.listenOnEndpointEvent(username1, 'message', 'messageReceived').then(function () {
                client1.sendMessage(username2, 'Howdy!').then(function () {
                    setTimeout(function () {
                        client2.getValue('messageReceived.getText()').then(function (value) {
                            expect(value).to.equal('Howdy!');
                            done();
                        });
                    }, 1000);
                });
            });
        });

        /**
         * @event respoke.Endpoint#signaling:sent
         * @type {object}
         */
        xit("should receive event for respoke.Endpoint#signaling:sent", function () {

        });

        /*
         * @event respoke.Endpoint#signaling:received
         * @type {object}
         */
        xit("should receive event for respoke.Endpoint#signaling:received", function () {

        });
    });

    xdescribe('SignalingChannel Events', function () {
        /**
         * @event respoke.SignalingChannel#received:offer
         * @type {RTCSessionDescription}
         */
         it("should receive event for respoke.SignalingChannel#received:offer", function (done) {
            done();
         });

        /**
         * @event respoke.SignalingChannel#received:answer
         * @type {RTCSessionDescription}
         */
         it("should receive event for respoke.SignalingChannel#received:answer", function (done) {
            done();
         });

        /**
         * @event respoke.SignalingChannel#received:candidate
         * @type {RTCIceCandidate}
         */
         it("should receive event for respoke.SignalingChannel#received:candidate", function (done) {
            done();
         });

        /**
         * @event respoke.SignalingChannel#received:bye
         */
         it("should receive event for respoke.SignalingChannel#received:bye", function (done) {
            done();
         });
    });

    xdescribe('MediaSession Events', function () {
    /**
     * @event respoke.MediaSession#stream:local:received
     * @type {DOM}
     */

    /**
     * @event respoke.MediaSession#stream:remote:received
     * @type {DOM}
     */

    /**
     * @event respoke.MediaSession#stream:remote:removed
     * @type {object}
     */

    /**
     * @event respoke.MediaSession#candidate:local
     * @type {object}
     */

    /**
     * @event respoke.MediaSession#candidate:remote
     * @type {object}
     */

    /**
     * @event respoke.MediaSession#sdp:remote:received
     * @type {object}
     */

    /**
     * @event respoke.MediaSession#sdp:remote:saved
     * @type {object}
     */

    /**
     * @event respoke.MediaSession#sdp:remote:error
     * @type {object}
     */

    /**
     * @event respoke.MediaSession#sdp:local:created
     * @type {object}
     */

    /**
     * @event respoke.MediaSession#sdp:local:saved
     * @type {object}
     */

    /**
     * @event respoke.MediaSession#sdp:local:error
     * @type {object}
     */

    /**
     * @event respoke.MediaSession#hangup
     * @type {boolean}
     */

    /**
     * @event respoke.MediaSession#video:muted
     */

    /**
     * @event respoke.MediaSession#video:unmuted
     */

    /**
     * @event respoke.MediaSession#audio:muted
     */

    /**
     * @event respoke.MediaSession#audio:unmuted
     */
    });

    xdescribe('MediaStream Events', function () {
    /**
     * @event respoke.MediaStream#video:muted
     */

    /**
     * @event respoke.MediaStream#video:unmuted
     */

    /**
     * @event respoke.MediaStream#audio:muted
     */

    /**
     * @event respoke.MediaStream#audio:unmuted
     */
    });

    after(function (done) {
        driver1.quit();
        driver2.quit();
        helpers.testFixtureAfterTest(driver, done);
    });
});
