/**
 * Create a new IdentityProvider.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class webrtc.AbstractIdentityProvider
 * @constructor
 * @augments webrtc.EventThrower
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
    var that = webrtc.EventThrower(params);
    delete that.client;
    that.className = 'webrtc.AbstractIdentityProvider';

    var loggedIn = false;

    /**
     * Log a user in.
     * @memberof! webrtc.AbstractIdentityProvider
     * @method webrtc.AbstractIdentityProvider.login
     * @abstract
     * @param {string} username The  user's username + resource.
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
 * Create a new ContactList.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class webrtc.ContactList
 * @constructor
 * @augments webrtc.EventThrower
 * @classdesc Container for User contacts.
 * @param {object} params Object whose properties will be used to initialize this object and set
 * properties on the class.
 * @returns {webrtc.ContactList}
 */
webrtc.ContactList = function (params) {
    "use strict";
    params = params || {};
    var client = params.client;
    var that = webrtc.EventThrower(params);
    delete that.client;
    that.className = 'webrtc.ContactList';

    that.length = 0;
    var contacts = {};
    var presenceQueue = [];

    /**
     * Add a contact to the list.
     * @memberof! webrtc.ContactList
     * @method webrtc.ContactList.add
     * @param {webrtc.AbstractEndpoint} contact A contact to add to the list.
     * @fires webrtc.ContactList#new If the contact doesn't already exist.
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
     * @memberof! webrtc.ContactList
     * @method webrtc.ContactList.get
     * @param {string} contactID A contact to get from the list.
     * @returns {webrtc.Endpoint} The endpoint whose getID() function matches the string.
     */
    var get = that.publicize('get', function (contactID) {
        return contacts[contactID];
    });

    /**
     * Remove a contact from the list.
     * @memberof! webrtc.ContactList
     * @method webrtc.ContactList.remove
     * @param {string} contactID A contact to remove from the list.
     * @fires webrtc.ContactList#remove
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
     * @memberof! webrtc.ContactList
     * @method webrtc.ContactList.getContacts
     * @param {string} sortField An optional contact attribute to sort on.
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
     * @memberof! webrtc.ContactList
     * @method webrtc.ContactList.queuePresence
     * @param {object} message An XMPP presence stanza to save.
     */
    var queuePresence = that.publicize('queuePresence', function (message) {
        presenceQueue.push(message);
    });

    /**
     * Process the presence queue.
     * @memberof! webrtc.ContactList
     * @method webrtc.ContactList.processPresenceQueue
     * @throws webrtc.ContactList#presence:update
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
}; // End webrtc.ContactList
