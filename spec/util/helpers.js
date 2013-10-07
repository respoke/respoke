var fs = require('fs');
var webdriver = require('selenium-webdriver');

function getWebDriver(options) {
    if (!options) {
        options = {timeout: 10000, capabilities: {'browserName': 'chrome','chromeOptions': {"args": ['--incognito']}}};
    }

    var driver = new webdriver.Builder().
                usingServer('http://127.0.0.1:4444/wd/hub').
                withCapabilities(options.capabilities).
                build();
    driver.manage().timeouts().setScriptTimeout(options.timeout);
    return driver;
}

module.exports = {
    Client: function (driver, clientName, baseURL) {

        this.driver = driver;
        this.clientName = clientName;
        this.baseURL = baseURL || 'http://localhost:1337'

        this.init = function (appId) {
            return this.driver.executeScript("window['" + this.clientName + "'] = webrtc.Client({clientSettings: {appId: '" + appId + "', baseURL: '" + this.baseURL + "'}});");
        };
        this.connect = function () {
            return this.driver.executeScript("window['" + this.clientName + "'].connect();");
        };
        this.disconnect = function () {
            return this.driver.executeScript("window['" + this.clientName + "'].disconnect();");
        };
        this.login = function (username, password) {
            return this.driver.executeAsyncScript("var callback = arguments[arguments.length - 1]; " +
                "var userPromise = window['" + this.clientName + "'].login('" + username + "', '" + password + "'); " +
                "userPromise.then(function (user) { " +
                "    window['" + clientName + "']['user'] = user; " +
                "    callback(user);" +
                "});");
        };
        this.logout = function () {
            return this.driver.executeAsyncScript("var callback = arguments[arguments.length - 1]; " +
                 "var logoutPromise = window['" + this.clientName + "'].logout();" +
                 "logoutPromise.then(function () { " +
                 "    callback();" +
                 "});");
        };
        this.isConnected = function () {
            return this.driver.executeScript("return window['" + this.clientName + "'].isConnected();");
        };
        this.isLoggedIn = function () {
            return this.driver.executeScript("return window['" + this.clientName + "'].isLoggedIn();");
        };
        this.getClientSettings = function () {
            return this.driver.executeScript("return window['" + this.clientName + "'].getClientSettings();");
        };
        this.getMediaSettings = function () {
            return this.driver.executeScript("return window['" + this.clientName + "'].getMediaSettings();");
        };
        this.setDefaultMediaSettings = function (mediaSettings) {
            return this.driver.executeScript("window['" + this.clientName + "'].setDefaultMediaSettings(" + mediaSettings + ");");
        };
        this.getSignalingChannel = function () {
            return this.driver.executeScript("return window['" + this.clientName + "'].getSignalingChannel();");
        };
        this.getContacts = function () {
            return this.driver.executeAsyncScript("var callback = arguments[arguments.length - 1]; " +
                    "window['" + this.clientName + "'].user.getContacts().then(function (contactList) { " +
                    "    window['" + this.clientName + "']['contacts'] = contactList;" +
                    "    callback(contactList); " +
                    " });");
        };
        this.listen = function (method, event, varName) {
            return this.driver.executeAsyncScript("var callback = arguments[arguments.length - 1]; " +
                    "window['" + this.clientName + "']." + method + ".listen('" + event + "', function (message) {" +
                    "    window['" + this.clientName + "']['" + varName +"'] = message; " +
                    " }); callback();");
        };
        this.listenOnContactEvent = function (username, event, varName) {
            return this.driver.executeAsyncScript("var callback = arguments[arguments.length - 1]; " +
                    "window['" + this.clientName + "'].user.getContacts().then(function (contactList) { " +
                    "    var contacts = contactList.getContacts(); " +
                    "    for(var i = 0; i < contacts.length; i ++) { " +
                    "         if (contacts[i].username == '" + username + "') { " +
                    "               contacts[i].listen('" + event + "', function (message) {" +
                    "                   window['" + this.clientName + "']['" + varName +"'] = message; " +
                    "               }); " +
                    "         } " +
                    "    } " +
                    "    callback();" +
                    " }); ");
        };
        this.getValue = function (varName) {
            return this.driver.executeScript("return window['" + this.clientName + "']." + varName +";");
        };
        this.setPresence = function (status) {
            return this.driver.executeScript("window['" + this.clientName + "'].user.setPresence('" + status + "');");
        };
        this.getPresence = function () {
            return this.driver.executeScript("return window['" + this.clientName + "'].user.getPresence();");
        };
        this.getDisplayName = function () {
            return this.driver.executeScript("return window['" + this.clientName + "'].user.getDisplayName();");
        };
        this.getUsername = function () {
            return this.driver.executeScript("return window['" + this.clientName + "'].user.getUsername();");
        };
        this.getName = function () {
            return this.driver.executeScript("return window['" + this.clientName + "'].user.getName();");
        };
        this.getID = function () {
            return this.driver.executeScript("return window['" + this.clientName + "'].user.getID();");
        };
        this.canSendAudio = function () {
            return this.driver.executeScript("return window['" + this.clientName + "'].user.canSendAudio();");
        };
        this.canSendVideo = function () {
            return this.driver.executeScript("return window['" + this.clientName + "'].user.canSendVideo();");
        };
        this.hasMedia = function () {
            return this.driver.executeScript("return window['" + this.clientName + "'].user.hasMedia();");
        };
        this.sendMessage = function (username, message) {
            return this.driver.executeAsyncScript("var callback = arguments[arguments.length - 1]; " +
                    "window['" + this.clientName + "'].user.getContacts().then(function (contactList) { " +
                    "    var contacts = contactList.getContacts(); " +
                    "    for(var i = 0; i < contacts.length; i ++) { " +
                    "         if (contacts[i].username == '" + username + "') { " +
                    "               contacts[i].sendMessage('" + message + "'); " +
                    "         } " +
                    "    } " +
                    "    callback(); " +
                    " }); ");
        };
        this.getMessages = function (username) {
            return this.driver.executeAsyncScript("var callback = arguments[arguments.length - 1]; " +
                    " window['" + this.clientName + "'].user.getContacts().then(function (contactList) { " +
                    "    var contacts = contactList.getContacts(); " +
                    "    var contact; " +
                    "    for(var i = 0; i < contacts.length; i ++) { " +
                    "         if (contacts[i].username == '" + username + "') { " +
                    "               contact = contacts[i]; " +
                    "         } " +
                    "    } " +
                    "    var messages = contact.getMessages(); " +
                    "    callback(messages); " +
                    " }); ");
        };

    },

    webDriver: function (options) {
        return getWebDriver();
    },

    testFixtureBeforeTest: function (options, cb) {
        fs.readFile(process.cwd() + '/collective/spec/util/jquery.js', {encoding: 'utf8'}, function (err, data) {
        var jquery = data;
        fs.readFile(process.cwd() + '/collective/spec/util/api_client.js', {encoding: 'utf8'}, function (err, data) {
            var apiClientString = data;
            fs.readFile(process.cwd() + '/collective/spec/util/fixture.js', {encoding: 'utf8'}, function (err, data) {
                var fixtureString = data;
                fixtureString = fixtureString.replace('var fixture', "window['fixture']");
                driver = getWebDriver();
                driver.get('http://localhost:' + process.env.SERVER_PORT + '/test.html').then(function () {
                    driver.executeScript(jquery + "    " + apiClientString + "    " + fixtureString).then(function () {
                            driver.executeAsyncScript("var callback = arguments[arguments.length - 1]; " +
                                    "window['fix'] = window['fixture']('Events Spec', " + JSON.stringify(options) + "); " +
                                    "window['fix'].beforeTest(function (err, env) { " +
                                    "   callback(env); " +
                                    "}); "
                                    ).then(function (environment) {
                                        cb(driver, environment);
                                    });
                        });
                    });
                });
            });
        });
    },

    testFixtureAfterTest: function (driver, cb) {
        driver.executeAsyncScript("var callback = arguments[arguments.length - 1]; " +
            "window['fix'].afterTest(function () { " +
            "    callback(); " +
            "}); ").then(function () {
                driver.quit();
                cb();
            });
    }
}