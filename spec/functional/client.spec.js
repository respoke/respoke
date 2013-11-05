var helpers = require('../util/helpers.js');
var Client = helpers.Client;
var fixtureDriver;

var clientName = 'client1';
var username;
var username2;
var password = 'password';
var env;


describe("fixture setup", function () {
    it("fixture setup", function (done) {
        helpers.testFixtureBeforeTest({randomUserNames: 2}, function (d, environment) {
            fixtureDriver = d;
            env = environment;
            username = env.users[0].username;
            username2 = env.users[1].username;
            done();
        });
    });
});
describe("Connection", function () {
    var driver;
    var client;
    var indexPromise;

    beforeEach(function (done) {
        driver = helpers.webDriver();
        client = new Client(driver, clientName);
        indexPromise = driver.get(process.env['MERCURY_URL'] + '/index.html');
        indexPromise.then(function () {
            client.init(env.appId).then(done);
        });
    });

    afterEach(function (done) {
        driver.quit();
        done();
    });

    it("not connected", function (done) {
        indexPromise.then(function () {
            client.isConnected().then(function (result) {
                expect(result).toBe(false);
                done();
            });
        });
    });

    it("connected", function (done) {
        indexPromise.then(function () {
          client.connect().then(function (){
              client.isConnected().then(function (result) {
                  expect(result).toBe(true);
                  done();
              });
          });
        });
    });

    it("disconnected", function (done) {
        indexPromise.then(function () {
            client.connect().then(function () {
                client.disconnect().then(function () {
                    client.isConnected().then(function (result) {
                        expect(result).toBe(false);
                        done();
                    });
                });
            });
        });
    });
});

describe("Authentication", function () {
    var driver;
    var client;
    var indexPromise;

    beforeEach(function (done) {
        driver = helpers.webDriver();
        client = new Client(driver, clientName);
        indexPromise = driver.get(process.env['MERCURY_URL'] + '/index.html');
        indexPromise.then(function () {
            client.init(env.appId).then( function () {
                client.connect().then(done);
            });
        });
    });

    afterEach(function (done) {
        client.disconnect().then(function () {
            driver.quit();
            done();
        });
    });

    it("not authenticated", function () {
        indexPromise.then(function () {
            client.isLoggedIn().then(function (result) {
                expect(result).toBe(false);
            });
        });
    });

    it("login", function (done) {
        indexPromise.then(function () {
            client.login(username, password).then(function (user) {
                client.isLoggedIn().then(function (result) {
                    expect(result).toBe(true);
                    client.logout().then(function () {
                        done();
                    });
                });
            });
        });
    });

    it("should call error function when given wrong credentials", function (done) {
        indexPromise.then(function () {
            var login = driver.executeAsyncScript("var callback = arguments[arguments.length - 1]; " +
                                                "var userPromise = window['" + clientName + "'].login('" + username + "', 'badpassword'); " +
                                                "userPromise.then(function (user) { }, function (error) { " +
                                                "    callback(error);" +
                                                "});");
            login.then(function (error) {
                expect(error).toBeDefined();
                done();
            });
        });
    });

    it("logout", function (done) {
        indexPromise.then(function () {
            client.login(username, password).then(function (user) {
                client.isLoggedIn().then(function (result) {
                    expect(result).toBe(true);
                    client.logout().then(function () {
                        client.isLoggedIn().then(function (result) {
                            expect(result).toBe(false);
                            done();
                        });
                    });
                });
            });
        });
    });

    it("should login / logout / login", function (done) {
        client.login(username, password).then(function () {
            client.isLoggedIn().then(function (result) {
                expect(result).toBe(true);
                client.logout().then(function () {
                    client.isLoggedIn().then(function (result) {
                        expect(result).toBe(false);
                        client.login(username, password).then(function () {
                            client.isLoggedIn().then(function (result) {
                                expect(result).toBe(true);
                                done();
                            });
                        });
                    })
                });
            });
        });
    });

    xit("should logout twice after login with no side effects", function (done) {
        client.login(username, password).then(function () {
            client.isLoggedIn().then(function (result) {
                expect(result).toBe(true);
                client.logout().then(function () {
                    client.isLoggedIn().then(function (result) {
                        expect(result).toBe(false);
                        client.logout().then(function () {
                            client.isLoggedIn().then(function (result) {
                                expect(result).toBe(false);
                                done();
                            });
                        });
                    });
                });
            });
        });
    });
    it("should login user 1, logout user1, and login user2", function (done) {
        client.login(username, password).then(function () {
            client.isLoggedIn().then(function (result) {
                expect(result).toBe(true);
                client.logout().then(function () {
                    client.isLoggedIn().then(function (result) {
                        expect(result).toBe(false);
                        client.login(username2, password).then(function () {
                            client.isLoggedIn().then(function (result) {
                                expect(result).toBe(true);
                                done();
                            });
                        });
                    });
                });
            });
        });
    });

    it("should login user twice", function (done) {
        client.login(username, password).then(function () {
            client.isLoggedIn().then(function (result) {
                expect(result).toBe(true);
                client.login(username, password).then(function () {
                    client.isLoggedIn().then(function (result) {
                        expect(result).toBe(true);
                        done();
                    });
                });
            });
        });
    });
});


describe("settings", function () {
    var driver;
    var client;
    var indexPromise;

    beforeEach(function (done) {
        driver = helpers.webDriver();
        client = new Client(driver, clientName);
        indexPromise = driver.get(process.env['MERCURY_URL'] + '/index.html');
        indexPromise.then(function () {
            client.init(env.appId).then(function () {
                client.connect().then(function () {
                    client.login(username, password).then(function (user) {
                        done();
                    });
                });
            });
        });
    });

    afterEach(function (done) {
        client.logout().then(function () {
            driver.quit();
            done();
        });
    });

    it("getClientSettings should have appId", function () {
        indexPromise.then(function () {
            client.getClientSettings().then(function (clientSettings) {
                expect(clientSettings.appId).toBeDefined();
                expect(clientSettings.appId).toBe(env.appId);
            });
        });
    });

    it("MediaSettings should have mediaSettings", function () {
        indexPromise.then(function () {
            client.getMediaSettings().then(function (mediaSettings) {
                expect(mediaSettings).toBeDefined();
                expect(mediaSettings.constraints).toBeDefined();
            });
        });
    });

    it("getSignalingChannel should have a signaling channel", function () {
        indexPromise.then(function () {
            client.getSignalingChannel().then(function (signalingChannel) {
                expect(signalingChannel).toBeDefined();
            });
        });
    });
});
describe("fixture teardown", function () {
    it("fixture teardown", function (done) {
        helpers.testFixtureAfterTest(fixtureDriver, done);
    });
});
