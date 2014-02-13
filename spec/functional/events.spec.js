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
        helpers.testFixtureBeforeTest({randomUserNames: 2, createContacts: true}, function (d, environment) {
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
         * @event brightstream.Presentable#presence
         * @type {string}
         */
        it("should receive event for brightstream.Presentable#presence on login", function (done) {
            client1.listenOnContactEvent(username2, 'presence', 'contactsPresence').then(function () {
                client2.login(username2, password2).then(function (user) {
                    setTimeout(function () {
                        client1.getValue('contactsPresence').then(function (value) {
                            expect(value).to.equal('available');
                            done();
                        });
                    }, 1000);
                });
            });
        });

        it("should receive event for brightstream.Presentable#presence when sendPresence is called", function (done) {
            client2.setPresence({presence: 'unavailable'}).then(function () {
                setTimeout(function () {
                    client1.getValue('contactsPresence').then(function (value) {
                        expect(value).to.equal('unavailable');
                        done();
                    });
                }, 1000);
            });
        });
    });

    describe("Endpoint Events", function () {

        /*
         * @event brightstream.Endpoint#message:received
         * @type {object}
         */

        it("should receive event for brightstream.Endpoint#message", function (done) {
            client2.listenOnContactEvent(username1, 'message', 'messageReceived').then(function () {
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
         * @event brightstream.Endpoint#signaling:sent
         * @type {object}
         */
        xit("should receive event for brightstream.Endpoint#signaling:sent", function () {

        });

        /*
         * @event brightstream.Endpoint#signaling:received
         * @type {object}
         */
        xit("should receive event for brightstream.Endpoint#signaling:received", function () {

        });
    });

    xdescribe('SignalingChannel Events', function () {
        /**
         * @event brightstream.SignalingChannel#received:offer
         * @type {RTCSessionDescription}
         */
         it("should receive event for brightstream.SignalingChannel#received:offer", function (done) {
            done();
         });

        /**
         * @event brightstream.SignalingChannel#received:answer
         * @type {RTCSessionDescription}
         */
         it("should receive event for brightstream.SignalingChannel#received:answer", function (done) {
            done();
         });

        /**
         * @event brightstream.SignalingChannel#received:candidate
         * @type {RTCIceCandidate}
         */
         it("should receive event for brightstream.SignalingChannel#received:candidate", function (done) {
            done();
         });

        /**
         * @event brightstream.SignalingChannel#received:bye
         */
         it("should receive event for brightstream.SignalingChannel#received:bye", function (done) {
            done();
         });
    });

    xdescribe('MediaSession Events', function () {
    /**
     * @event brightstream.MediaSession#stream:local:received
     * @type {DOM}
     */

    /**
     * @event brightstream.MediaSession#stream:remote:received
     * @type {DOM}
     */

    /**
     * @event brightstream.MediaSession#stream:remote:removed
     * @type {object}
     */

    /**
     * @event brightstream.MediaSession#candidate:local
     * @type {object}
     */

    /**
     * @event brightstream.MediaSession#candidate:remote
     * @type {object}
     */

    /**
     * @event brightstream.MediaSession#sdp:remote:received
     * @type {object}
     */

    /**
     * @event brightstream.MediaSession#sdp:remote:saved
     * @type {object}
     */

    /**
     * @event brightstream.MediaSession#sdp:remote:error
     * @type {object}
     */

    /**
     * @event brightstream.MediaSession#sdp:local:created
     * @type {object}
     */

    /**
     * @event brightstream.MediaSession#sdp:local:saved
     * @type {object}
     */

    /**
     * @event brightstream.MediaSession#sdp:local:error
     * @type {object}
     */

    /**
     * @event brightstream.MediaSession#hangup
     * @type {boolean}
     */

    /**
     * @event brightstream.MediaSession#video:muted
     */

    /**
     * @event brightstream.MediaSession#video:unmuted
     */

    /**
     * @event brightstream.MediaSession#audio:muted
     */

    /**
     * @event brightstream.MediaSession#audio:unmuted
     */
    });

    xdescribe('MediaStream Events', function () {
    /**
     * @event brightstream.MediaStream#video:muted
     */

    /**
     * @event brightstream.MediaStream#video:unmuted
     */

    /**
     * @event brightstream.MediaStream#audio:muted
     */

    /**
     * @event brightstream.MediaStream#audio:unmuted
     */
    });

    after(function (done) {
        driver1.quit();
        driver2.quit();
        helpers.testFixtureAfterTest(driver, done);
    });
});
