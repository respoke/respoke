var fs = require('fs');
var webdriver = require('selenium-webdriver');
webdriver.promise.controlFlow().on('uncaughtException', function(e) {
    console.error('Unhandled error: ' + e);
});

function getWebDriver(options) {
    var selenium_server_url = process.env["SELENIUM_SERVER_URL"] || "http://127.0.0.1:4444/wd/hub";
    var browserName = process.env["SELENIUM_BROWSER"] || 'chrome';

    if (!options) {
        options = {timeout: 15000, capabilities: {'browserName': browserName,'chromeOptions': {"args": ['--incognito']}}};
    }
    var driver = new webdriver.Builder().
            usingServer(selenium_server_url).
            withCapabilities(options.capabilities).
            build();
    driver.manage().timeouts().setScriptTimeout(options.timeout);

    return driver;
}

module.exports = {
    Client: function (driver, clientName, baseURL) {

        this.driver = driver;
        this.clientName = clientName;
        this.baseURL = baseURL || 'https://testing.digiumlabs.com:1337'

        this.init = function (appId) {
            return this.driver.executeScript("window['" + this.clientName + "'] = brightstream.Client({clientSettings: {appId: '" + appId + "', baseURL: '" + this.baseURL + "'}});");
        };
        this.connect = function () {
            return this.driver.executeScript("window['" + this.clientName + "'].connect();");
        };
        this.disconnect = function () {
            return this.driver.executeScript("window['" + this.clientName + "'].disconnect();");
        };
        this.login = function (username, password) {
            return this.driver.executeAsyncScript("var callback = arguments[arguments.length - 1]; " +
                "var userPromise = window['" + this.clientName + "'].login({username: '" + username + "', password: '" + password + "'}); " +
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
        this.getCallSettings = function () {
            return this.driver.executeScript("return window['" + this.clientName + "'].getCallSettings();");
        };
        this.setDefaultCallSettings = function (callSettings) {
            return this.driver.executeScript("window['" + this.clientName + "'].setDefaultCallSettings(" + JSON.stringify(callSettings) + ");");
        };
        this.getSignalingChannel = function () {
            return this.driver.executeScript("return window['" + this.clientName + "'].getSignalingChannel();");
        };
        this.listen = function (method, event, varName) {
            return this.driver.executeAsyncScript("var callback = arguments[arguments.length - 1]; " +
                    "window['" + this.clientName + "']." + method + ".listen('" + event + "', function (message) {" +
                    "    window['" + this.clientName + "']['" + varName +"'] = message; " +
                    " }); callback();");
        };
        this.getValue = function (varName) {
            return this.driver.executeScript("return window['" + this.clientName + "']." + varName +";");
        };
        this.setPresence = function (params) {
            return this.driver.executeAsyncScript("var callback = arguments[arguments.length - 1]; " +
                    "window['" + this.clientName + "'].user.setPresence({presence: '" + params.presence + "'}).then(function (contactList) { " +
                    "    callback();" +
                    " }); ");
        };
        this.getPresence = function () {
            return this.driver.executeScript("return window['" + this.clientName + "'].user.getPresence();");
        };
        this.getName = function () {
            return this.driver.executeScript("return window['" + this.clientName + "'].user.getName();");
        };
        this.getID = function () {
            return this.driver.executeScript("return window['" + this.clientName + "'].user.getID();");
        };
        this.callInProgress = function () {
            return this.driver.executeScript("return window['" + this.clientName + "'].user.callInProgress();");
        };
        this.sendMessage = function (username, message) {
            return this.driver.executeAsyncScript("var callback = arguments[arguments.length - 1]; " +
                    "window['" + this.clientName + "'].user.getContacts().then(function (contactList) { " +
                    "    var contacts = contactList.getContacts(); " +
                    "    for(var i = 0; i < contacts.length; i ++) { " +
                    "         if (contacts[i].username == '" + username + "') { " +
                    "               contacts[i].sendMessage({message: '" + message + "'}).then(function () {" +
                    "                   callback(); " +
                    "               }); " +
                    "         } " +
                    "    } " +
                    " }); ");
        };
        this.sendEndpointMessage = function (varName, message) {
            return this.driver.executeScript("window['" + this.clientName + "']." + varName + ".sendMessage({message: '" + message + "'});");
        };
        this.getID = function () {
            return this.driver.executeScript("return brightstream.getClient(window['" + this.clientName + "'].getID()).user.getID();")
        };

    },

    webDriver: function (options) {
        return getWebDriver();
    },

    testFixtureBeforeTest: function (options, cb) {
        var seeds_data = fs.readFileSync(__dirname + '/../../../../../collective/lib/seeds_data.js', {encoding: 'utf8'});
        var jquery = fs.readFileSync(__dirname + '/../../../../../collective/assets/js/jquery.js', {encoding: 'utf8'});
        var apiClientString = fs.readFileSync(__dirname + '/../../../../../collective/spec/util/api_client.js', {encoding: 'utf8'});
        var fixtureString = fs.readFileSync(__dirname + '/../../../../../collective/spec/util/fixture.js', {encoding: 'utf8'});
        fixtureString = fixtureString.replace('var fixture', "window['fixture']");
        seeds_data = seeds_data.replace("module.exports.CONFIG = {", "window['config'] = { ");
        seeds_data = seeds_data.concat("; function trudat() { return true; };");
        fixtureString = fixtureString.replace('module.exports.CONFIG', "window['config']");
        driver = getWebDriver();
        driver.get(process.env['MERCURY_URL'] + '/index.html').then(function () {
            driver.executeScript(seeds_data + "   " + jquery + "    " + apiClientString + "    " + fixtureString).then(function () {
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
