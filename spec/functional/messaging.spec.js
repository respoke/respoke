var username1;
var password1 = 'password';

var username2;
var password2 = 'password';

var username3;
var password3 = 'password';

var helpers = require('../util/helpers.js');
var Client = helpers.Client;


var driver;
var testFixture;
var env;

describe('Messaging', function () {
    var driver1;
    var client1;
    var client1Name = 'client1';

    var driver2;
    var client2;
    var client2Name = 'client2';

    var driver3;
    var client3;
    var client3Name = 'client3';

    it("fixture setup", function (done) {
        helpers.testFixtureBeforeTest({randomUserNames: 3, createContacts: true}, function (d, environment) {
            driver = d;
            env = environment;
            username1 = env.users[0].username;
            username2 = env.users[1].username;
            username3 = env.users[2].username;
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
                                    client2.login(username2, password2).then(function (user) {
                                        driver3 = helpers.webDriver();
                                        client3 = new Client(driver3, client3Name, env.url);
                                        index3Promise = driver3.get('http://localhost:' + process.env.SERVER_PORT + '/index.html');
                                        index3Promise.then(function () {
                                            client3.init(env.appId).then( function () {
                                                client3.connect().then(function () {
                                                    client3.login(username3, password3).then(function (user) {
                                                        done();
                                                    });
                                                });
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });

    });

    describe("send and receive messages", function () {

        xit("should send message to contact", function (done) {
            client1.sendMessage(username2, 'test1').then(function () {
                client1.getMessages(username2).then(function (messages) {
                    expect(messages).toContain('test1');
                    done();
                });
            });
        });

        it("can send messages to multiple contacts", function (done) {
            client2.listenOnContactEvent(username1, 'message:received', 'messageReceived').then(function () {
                client3.listenOnContactEvent(username1, 'message:received', 'messageReceived').then(function () {
                    client1.sendMessage(username2, 'testMessage-username1').then(function () {
                        client1.sendMessage(username3, 'testMessage-username1').then(function () {
                            setTimeout(function () {
                                client2.getValue('messageReceived.getText()').then(function (value) {
                                    expect(value).toBe('testMessage-username1');
                                    client3.getValue('messageReceived.getText()').then(function (value) {
                                        expect(value).toBe('testMessage-username1');
                                        done();
                                    });
                                });
                            }, 1000);
                        });
                    });
                });
            });
        });
    });

    it("test teardown", function (done) {
        driver1.quit();
        driver2.quit();
        driver3.quit();
        done();
    });

    it("fixture teardown", function (done) {
        helpers.testFixtureAfterTest(driver, done);
    });
});