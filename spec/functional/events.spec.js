var username1;
var password1 = 'password';

var username2;
var password2 = 'password';

var helpers = require('../util/helpers.js');
var Client = helpers.Client;


var driver;
var testFixture;
var env;



describe('System Events', function () {
    var driver1;
    var client1;
    var client1Name = 'client1';

    var driver2;
    var client2;
    var client2Name = 'client2';

    it("fixture setup", function (done) {
        helpers.testFixtureBeforeTest({randomUserNames: 2, createContacts: true}, function (d, environment) {
            driver = d;
            env = environment;
            username1 = env.users[0].username;
            username2 = env.users[1].username;
            done();
        });
    });

    it("test setup", function (done) {
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
        }).then(function () {
            done();
        });
    });

    describe("Presentable Events", function () {
        /**
         * @event webrtc.Presentable#presence
         * @type {string}
         */
        it("should receive event for webrtc.Presentable#presence on login", function (done) {
            client1.getContacts();
            client1.listenOnContactEvent(username2, 'presence', 'contactsPresence').then(function () {
                client2.login(username2, password2).then(function (user) {
                    setTimeout(function () {
                        client1.getValue('contactsPresence').then(function (value) {
                            expect(value).toBe('available');
                            done();
                        });
                    }, 1000);
                });
            });
        });

        it("should receive event for webrtc.Presentable#presence when sendPresence is called", function (done) {
            client2.setPresence('unavailable').then(function () {
                setTimeout(function () {
                    client1.getValue('contactsPresence').then(function (value) {
                        expect(value).toBe('unavailable');
                        done();
                    });
                }, 1000);
            });
        });
    });

    describe("Endpoint Events", function () {

        /*
         * @event webrtc.Endpoint#message:received
         * @type {object}
         */

        it("should receive event for webrtc.Endpoint#message", function (done) {
            client2.listenOnContactEvent(username1, 'message', 'messageReceived').then(function () {
                client1.sendMessage(username2, 'Howdy!').then(function () {
                    setTimeout(function () {
                        client2.getValue('messageReceived.getText()').then(function (value) {
                            expect(value).toBe('Howdy!');
                            done();
                        });
                    }, 1000);
                });
            });
        });

        /**
         * @event webrtc.Endpoint#signaling:sent
         * @type {object}
         */
        xit("should receive event for webrtc.Endpoint#signaling:sent", function () {

        });

        /*
         * @event webrtc.Endpoint#signaling:received
         * @type {object}
         */
        xit("should receive event for webrtc.Endpoint#signaling:received", function () {

        });
    });

    xdescribe('SignalingChannel Events', function () {
        /**
         * @event webrtc.SignalingChannel#received:offer
         * @type {RTCSessionDescription}
         */
         it("should receive event for webrtc.SignalingChannel#received:offer", function (done) {
            done();
         });

        /**
         * @event webrtc.SignalingChannel#received:answer
         * @type {RTCSessionDescription}
         */
         it("should receive event for webrtc.SignalingChannel#received:answer", function (done) {
            done();
         });

        /**
         * @event webrtc.SignalingChannel#received:candidate
         * @type {RTCIceCandidate}
         */
         it("should receive event for webrtc.SignalingChannel#received:candidate", function (done) {
            done();
         });

        /**
         * @event webrtc.SignalingChannel#received:bye
         */
         it("should receive event for webrtc.SignalingChannel#received:bye", function (done) {
            done();
         });
    });

    xdescribe('MediaSession Events', function () {
    /**
     * @event webrtc.MediaSession#stream:local:received
     * @type {DOM}
     */

    /**
     * @event webrtc.MediaSession#stream:remote:received
     * @type {DOM}
     */

    /**
     * @event webrtc.MediaSession#stream:remote:removed
     * @type {object}
     */

    /**
     * @event webrtc.MediaSession#candidate:local
     * @type {object}
     */

    /**
     * @event webrtc.MediaSession#candidate:remote
     * @type {object}
     */

    /**
     * @event webrtc.MediaSession#sdp:remote:received
     * @type {object}
     */

    /**
     * @event webrtc.MediaSession#sdp:remote:saved
     * @type {object}
     */

    /**
     * @event webrtc.MediaSession#sdp:remote:error
     * @type {object}
     */

    /**
     * @event webrtc.MediaSession#sdp:local:created
     * @type {object}
     */

    /**
     * @event webrtc.MediaSession#sdp:local:saved
     * @type {object}
     */

    /**
     * @event webrtc.MediaSession#sdp:local:error
     * @type {object}
     */

    /**
     * @event webrtc.MediaSession#hangup
     * @type {boolean}
     */

    /**
     * @event webrtc.MediaSession#video:muted
     */

    /**
     * @event webrtc.MediaSession#video:unmuted
     */

    /**
     * @event webrtc.MediaSession#audio:muted
     */

    /**
     * @event webrtc.MediaSession#audio:unmuted
     */
    });

    xdescribe('MediaStream Events', function () {
    /**
     * @event webrtc.MediaStream#video:muted
     */

    /**
     * @event webrtc.MediaStream#video:unmuted
     */

    /**
     * @event webrtc.MediaStream#audio:muted
     */

    /**
     * @event webrtc.MediaStream#audio:unmuted
     */
    });

    it("test teardown", function (done) {
        driver1.quit();
        driver2.quit();
        done();
    });

    it("fixture teardown", function (done) {
        helpers.testFixtureAfterTest(driver, done);
    });
});