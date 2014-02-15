var username1;
var username2;
var username3;
var password = 'password';
var expect = require('chai').expect;
var helpers = require('../util/helpers.js');
var Client = helpers.Client;

var driver;
var env;

describe('Messaging', function () {

    this.timeout(30000);

    var driver1;
    var client1;
    var client1Name = 'client1';

    var driver2;
    var client2;
    var client2Name = 'client2';

    var driver3;
    var client3;
    var client3Name = 'client3';

    before(function (done) {
        helpers.testFixtureBeforeTest({randomUserNames: 3, createEndpoints: true}, function (d, environment) {
            driver = d;
            env = environment;
            username1 = env.users[0].username;
            username2 = env.users[1].username;
            username3 = env.users[2].username;

            driver1 = helpers.webDriver();
            client1 = new Client(driver1, client1Name, env.url);
            driver1.get(process.env['MERCURY_URL'] + '/index.html');
            client1.init(env.appId);
            client1.connect();
            client1.login(username1, password).then(function () {
                driver2 = helpers.webDriver();
                client2 = new Client(driver2, client2Name, env.url);
                driver2.get(process.env['MERCURY_URL'] + '/index.html');
                client2.init(env.appId);
                client2.connect();
                client2.login(username2, password);
            }).then(function () {
                    driver3 = helpers.webDriver();
                    client3 = new Client(driver3, client3Name, env.url);
                    driver3.get(process.env['MERCURY_URL'] + '/index.html');
                    client3.init(env.appId);
                    client3.connect();
                    client3.login(username3, password);
                }).then(function () {
                    done();
                });
        });
    });

    describe("send and receive messages", function () {

        xit("should send message to endpoint", function (done) {
            client1.sendMessage(username2, 'test1').then(function () {
                done();
            });
        });

        it("can send messages to multiple endpoints", function (done) {
            client2.listenOnEndpointEvent(username1, 'message', 'messageReceived').then(function () {
                client3.listenOnEndpointEvent(username1, 'message', 'messageReceived').then(function () {
                    client1.sendMessage(username2, 'testMessage-username1');
                    client1.sendMessage(username3, 'testMessage-username1');
                });
            });

            setTimeout(function () {
                client2.getValue('messageReceived.getText()').then(function (value) {
                    expect(value).to.equal('testMessage-username1');
                    client3.getValue('messageReceived.getText()').then(function (value) {
                        expect(value).to.equal('testMessage-username1');
                        done();
                    });
                });
            }, 1000);

        });
    });

    after(function (done) {
        driver1.quit();
        driver2.quit();
        driver3.quit();
        helpers.testFixtureAfterTest(driver, done);
    });
});
