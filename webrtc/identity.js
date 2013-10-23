/**
 * Create a new IdentityProvider.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class webrtc.AbstractIdentityProvider
 * @constructor
 * @augments webrtc.EventEmitter
 * @classdesc Generic Identity provider class.
 * @param {object} params Object whose properties will be used to initialize this object and set
 * properties on the class.
 * @returns {webrtc.IdentityProvider}
 */
/*global webrtc: false */
webrtc.AbstractIdentityProvider = function (params) {
    "use strict";
    params = params || {};
    var client = params.client;
    var that = webrtc.EventEmitter(params);
    delete that.client;
    that.className = 'webrtc.AbstractIdentityProvider';

    var loggedIn = false;

    /**
     * Log a user in.
     * @memberof! webrtc.AbstractIdentityProvider
     * @method webrtc.AbstractIdentityProvider.login
     * @abstract
     * @param {string} username The  user's username.
     * @param {string} password The  user's password.
     * @param {successCallback} onSuccess
     */
    var login = that.publicize('login', function (username, password, onSuccess, onFailure) {
    });

    /**
     * Log a user out.
     * @memberof! webrtc.AbstractIdentityProvider
     * @method webrtc.AbstractIdentityProvider.logout
     * @abstract
     */
    var logout = that.publicize('logout', function () {
        /* Include this in your implementation
        loggedIn = false;
        */
    });

    /**
     * Whether logged in
     * @memberof! webrtc.AbstractIdentityProvider
     * @method webrtc.AbstractIdentityProvider.isLoggedIn
     * @abstract
     * @return {boolean}
     */
    var isLoggedIn = that.publicize('isLoggedIn', function () {
        /* Include this in your implementation
        return loggedIn;
        */
    });

    return that;
}; // End webrtc.AbstractIdentityProvider

/**
 * Create a new XMPPIdentityProvider.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class
 * @constructor
 * @augments webrtc.AbstractIdentityProvider
 * @classdesc XMPP Identity provider class.
 * @param {object} params Object whose properties will be used to initialize this object and set
 * properties on the class.
 * @returns {webrtc.IdentityProvider}
 */
webrtc.IdentityProvider = function (params) {
    "use strict";
    params = params || {};
    var client = params.client;
    var that = webrtc.AbstractIdentityProvider(params);
    delete that.client;
    that.className = 'webrtc.IdentityProvider';

    var signalingChannel = null;
    var loggedIn = false;

    /**
     * Log a user in.
     * @memberof! webrtc.IdentityProvider
     * @method webrtc.IdentityProvider.login
     * @param {string} username The user's username.
     * @param {string} password The user's password.
     * @returns {Promise<webrtc.User>}
     */
    var login = that.publicize('login', function (username, password) {
        var deferred = null;
        var user = null;

        log.trace("User login");
        log.debug('client is ' + client);

        if (signalingChannel === null) {
            signalingChannel = webrtc.getClient(client).getSignalingChannel();
        }
        if (!signalingChannel.isOpen()) {
            signalingChannel.open();
        }
        deferred = Q.defer();
        signalingChannel.authenticate(username, password, function (response, request) {
            if (response.code === 200) {
                user = webrtc.User({
                    'client': client,
                    'username': username,
                    'loggedIn': true
                });
                deferred.resolve(user);
            } else if (response.code === 403) {
                deferred.reject(new Error("Authentication failed."));
            } else {
                deferred.reject(new Error("Unknown error in authentication attempt."));
            }
        });
        return deferred.promise;
    });

    /**
     * Log an XMPP user out.
     * @memberof! webrtc.IdentityProvider
     * @method webrtc.IdentityProvider.logout
     * @fires webrtc.IdentityProvider#loggedout
     * @returns Promise<String>
     */
    var logout = that.publicize('logout', function () {
        log.trace("User logout");

        var logoutPromise = signalingChannel.logout();

        logoutPromise.done(function () {
            that.fire("loggedout");
            signalingChannel.close();
            loggedIn = false;
        }, function (e) {
            throw new Error("Couldn't log out:", e.message);
        });

        return logoutPromise;
    });

    /**
     * Whether logged in
     * @memberof! webrtc.IdentityProvider
     * @method webrtc.IdentityProvider.isLoggedIn
     * @return {boolean}
     */
    var isLoggedIn = that.publicize('isLoggedIn', function () {
        return !!loggedIn;
    });

    return that;
}; // End webrtc.IdentityProvider

/**
 * Create a new Contacts.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class webrtc.Contacts
 * @constructor
 * @augments webrtc.EventEmitter
 * @classdesc Container for User contacts.
 * @param {object} params Object whose properties will be used to initialize this object and set
 * properties on the class.
 * @returns {webrtc.Contacts}
 */
webrtc.Contacts = function (params) {
    "use strict";
    params = params || {};
    var client = params.client;
    var that = webrtc.EventEmitter(params);
    delete that.client;
    that.className = 'webrtc.Contacts';

    that.length = 0;
    var contacts = {};
    var presenceQueue = [];

    /**
     * Add a contact to the list.
     * @memberof! webrtc.Contacts
     * @method webrtc.Contacts.add
     * @param {webrtc.AbstractEndpoint} contact A contact to add to the list.
     * @fires webrtc.Contacts#new If the contact doesn't already exist.
     */
    var add = that.publicize('add', function (contact) {
        if (contact instanceof webrtc.AbstractPresentable || !contact.getID) {
            throw new Error("Can't add endpoint to list. Wrong type!");
        }
        if (!(contact.getID() in contacts)) {
            that.length += 1;
            that.fire('new', contact);
            contacts[contact.getID()] = contact;
        }
    });

    /**
     * Get a contact from the list.
     * @memberof! webrtc.Contacts
     * @method webrtc.Contacts.get
     * @param {string} contactID A contact to get from the list.
     * @returns {webrtc.Endpoint} The endpoint whose getID() function matches the string.
     */
    var get = that.publicize('get', function (contactID) {
        return contacts[contactID];
    });

    /**
     * Filter the contact list on any params, return list of matching contacts.
     * @memberof! webrtc.Contacts
     * @method webrtc.Contacts.filter
     * @param {object} params An object literal with attributes and values to match.
     * @returns {webrtc.Endpoint[]} The endpoints whose attributes match the filter.
     */
    var filter = that.publicize('filter', function (params) {
        var results = [];

        if ('string' === typeof params) {
            params = {'id': params};
        }

        contacts.forEach(function (contact, index) {
            var paramNames = Object.keys(params);
            for (var i = 0; i < paramNames.length; i += 1) {
                if (contact[paramNames[i]] !== params[paramNames[i]]) {
                    return;
                }
            }
            results.push(contact);
        });

        return results;
    });

    /**
     * Remove a contact from the list.
     * @memberof! webrtc.Contacts
     * @method webrtc.Contacts.remove
     * @param {string} contactID A contact to remove from the list.
     * @fires webrtc.Contacts#remove
     */
    var remove = that.publicize('remove', function (contactID) {
        if (contacts.hasOwnProperty(contactID)) {
            that.length -= 1;
            that.fire('remove', contacts[contactID]);
            contacts[contactID] = undefined;
        }
    });

    /**
     * Get a list of contacts.
     * @memberof! webrtc.Contacts
     * @method webrtc.Contacts.getContacts
     * @param {string} sortField An optional contact attribute to sort on.
     * @return {webrtc.Contact[]}
     */
    var getContacts = that.publicize('getContacts', function (sortField) {
        var values = [];
        sortField = sortField || 'id';
        contacts.forOwn(function (value, key) {
            values.push(value);
        });
        that.length = values.length;

        values = values.sort(function (a, b) {
            if (!(sortField in a) || !(sortField in b)) {
                log.warn("sortField doesn't exist in both objects.");
                return 0;
            } else if (webrtc.isNumber(a[sortField]) && webrtc.isNumber(b[sortField])) {
                return a[sortField] - b[sortField];
            } else if (a.toLowerCase && b.toLowerCase) {
                if (a[sortField].toLowerCase() < b[sortField].toLowerCase()) {
                    return -1;
                } else if (a[sortField].toLowerCase() > b[sortField].toLowerCase()) {
                    return 1;
                } else {
                    return 0;
                }
            } else {
                if (a[sortField] < b[sortField]) {
                    return -1;
                } else if (a[sortField] > b[sortField]) {
                    return 1;
                } else {
                    return 0;
                }
            }
        });

        return values;
    });

    /**
     * Add a presence message to the presence queue for processing after the roster has been
     * processed.
     * @memberof! webrtc.Contacts
     * @method webrtc.Contacts.queuePresence
     * @param {object} message An XMPP presence stanza to save.
     */
    var queuePresence = that.publicize('queuePresence', function (message) {
        presenceQueue.push(message);
    });

    /**
     * Process the presence queue.
     * @memberof! webrtc.Contacts
     * @method webrtc.Contacts.processPresenceQueue
     * @fires webrtc.Contacts#presence:update
     */
    var processPresenceQueue = that.publicize('processPresenceQueue', function () {
        for (var i = 0; i <= presenceQueue.length; i += 1) {
            if (presenceQueue[i]) {
                that.fire('presence', presenceQueue[i]);
            }
        }
        presenceQueue = [];
    });

    return that;
}; // End webrtc.Contacts
