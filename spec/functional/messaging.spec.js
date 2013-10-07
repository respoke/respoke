var username1;
var password1 = 'password';

var username2;
var password2 = 'password';

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

    describe("send and receive messages", function () {

        it("should send message to contact", function (done) {
            client1.sendMessage(username2, 'test1').then(function () {
                console.log('sent message***********');
                client1.getMessages(username2).then(function (messages) {
                    console.log("got messages**********")
                    expect(messages).toContain('test1');
                    done();
                });
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