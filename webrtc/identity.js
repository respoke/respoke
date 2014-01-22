/*global webrtc: false */
/**
 * Create a new XMPPIdentityProvider.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class
 * @constructor
 * @augments webrtc.EventEmitter
 * @classdesc XMPP Identity provider class.
 * @param {object} params Object whose properties will be used to initialize this object and set
 * properties on the class.
 * @returns {webrtc.IdentityProvider}
 */
webrtc.IdentityProvider = function (params) {
    "use strict";
    params = params || {};
    var client = params.client;
    var that = webrtc.EventEmitter(params);
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
     * @param {function} onSuccess
     * @param {function} onError
     * @param {function} onIncomingCall
     * @returns {Promise<webrtc.User>}
     */
    var login = that.publicize('login', function (params) {
        var user = null;
        log.trace("User login");
        log.debug('client is ' + client);

        if (signalingChannel === null) {
            signalingChannel = webrtc.getClient(client).getSignalingChannel();
        }
        if (!signalingChannel.isOpen()) {
            signalingChannel.open();
        }

        var promise = signalingChannel.authenticate(params);
        promise.done(function (user) {
            if (!params.onIncomingCall) {
                log.warn("No onIncomingCall passed to Client.login.");
            } else {
                user.listen('call', params.onIncomingCall);
            }
        }, function () {});
        return promise;
    });

    /**
     * Log an XMPP user out.
     * @memberof! webrtc.IdentityProvider
     * @method webrtc.IdentityProvider.logout
     * @fires webrtc.IdentityProvider#loggedout
     * @param {function} onSuccess
     * @param {function} onError
     * @returns Promise<String>
     */
    var logout = that.publicize('logout', function (params) {
        log.trace("User logout");

        var logoutPromise = signalingChannel.logout(params);

        logoutPromise.done(function successHandler() {
            that.fire("loggedout");
            signalingChannel.close();
            loggedIn = false;
        }, function errorHandler(e) {
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
 * TODO convert this class to an augmented array.
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
     * @param {webrtc.Endpoint} contact A contact to add to the list.
     * @fires webrtc.Contacts#new If the contact doesn't already exist.
     */
    var add = that.publicize('add', function (params) {
        if (params.contact instanceof webrtc.Presentable || !params.contact.getID) {
            throw new Error("Can't add endpoint to list. Wrong type!");
        }
        if (!(params.contact.getID() in contacts)) {
            that.length += 1;
            that.fire('new', params.contact);
            contacts[params.contact.getID()] = params.contact;
        }
    });

    /**
     * Get a contact from the list.
     * @memberof! webrtc.Contacts
     * @method webrtc.Contacts.get
     * @param {string} contactID A contact to get from the list.
     * @returns {webrtc.Endpoint} The endpoint whose getID() function matches the string.
     */
    var get = that.publicize('get', function (params) {
        return contacts[params.contactID];
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

        contacts.forEach(function filterEach(contact, index) {
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
    var remove = that.publicize('remove', function (params) {
        if (contacts.hasOwnProperty(params.contactID)) {
            that.length -= 1;
            that.fire('remove', contacts[params.contactID]);
            contacts[params.contactID] = undefined;
        }
    });

    /**
     * Get a list of contacts.
     * @memberof! webrtc.Contacts
     * @method webrtc.Contacts.getContacts
     * @param {string} sortField An optional contact attribute to sort on.
     * @return {webrtc.Contact[]}
     */
    var getContacts = that.publicize('getContacts', function (params) {
        var values = [];
        params = params || {};
        var sortField = params.sortField || 'id';

        // Make an array of the values of the contacts dict
        contacts.forOwn(function addValue(value, key) {
            values.push(value);
        });
        that.length = values.length;

        values = values.sort(function fieldSorter(a, b) {
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
     * Add a presence message to the presence queue for processing after the contact list has been
     * processed.
     * @memberof! webrtc.Contacts
     * @method webrtc.Contacts.queuePresence
     * @param {object} message An presence message to save.
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
