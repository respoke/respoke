var username1;
var password1 = 'password';

var username2;
var password2 = 'password';

var helpers = require('../util/helpers.js');
var Client = helpers.Client;


var driver;
var testFixture;
var env;

describe('Presence setup', function () {
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
        indexPromise = driver1.get('http://localhost:' + process.env.SERVER_PORT + '/index.html');
        indexPromise.then(function () {
            client1.init(env.appId).then( function () {
                client1.connect().then(function () {
                    client1.login(username1, password1).then(function (user) {
                        driver2 = helpers.webDriver();
                        client2 = new Client(driver2, client2Name, env.url);
                        index2Promise = driver2.get('http://localhost:' + process.env.SERVER_PORT + '/index.html');
                        index2Promise.then(function () {
                            client2.init(env.appId).then( function () {
                                client2.connect().then(function () {
                                    done();
                                });
                            });
                        });
                    });
                });
            });
        });
    });

    describe("Presence", function () {
        //setting presence and getting presence events are tested as part of the
        // events.spec.js

        it("#getPresence", function (done) {
            client1.getPresence().then(function (presence) {
                expect(presence).toBe('available');
                done();
            });
        });

        it("#getDisplayName", function (done) {
            client1.getDisplayName().then(function (name) {
                expect(name).toBe(env.users[0].username);
                done();
            });
        });

        it("#getUsername", function (done) {
            client1.getUsername().then(function (name) {
                expect(name).toBe(env.users[0].username);
                done();
            });
        });

        xit("#getName", function (done) {
            client1.getName().then(function (name) {
                expect(name).toBe(env.users[0].username);
                done();
            });
        });

        xit("#getID", function (done) {
            client1.getID().then(function (id) {
                expect(id).toBe(env.users[0].id);
                done();
            });
        });

        it("#canSendAudio", function (done) {
            client1.canSendAudio().then(function (b) {
                expect(b).toBe(true);
                done();
            });
        });

        it("#canSendVideo", function (done) {
            client1.canSendVideo().then(function (b) {
                expect(b).toBe(true);
                done();
            });
        });

        it("#hasMedia", function (done) {
            client1.hasMedia().then(function (b) {
                expect(b).toBe(false);
                done();
            });
        });
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