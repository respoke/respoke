/*
  Copyright 2010, Drakontas LLC
  Ilya Braude ilya@drakontas.com
*/

Strophe.addConnectionPlugin('roster', {
    /*
     Extend connection object to have plugin name 'roster'.
    */
    _conn: null,

    //The plugin must have the init function.
    init: function(conn) {
        this._conn = conn;
    },


    /** Function: requestRoster
     *
     *  Sends a request to the server to send the roster to the user.
     *
     *  Parameters:
     *    callback - Called with the received roster.  The argument is
     *               the DOM node agumented with a mixin.Roster object.
     *
     *  Returns:
     *    The response handler that is registered with Strophe
     */
    requestRoster: function(callback) {
        var requestId = this._conn.getUniqueId("requestRoster");
    
        //create roster request packet
        var iq = $iq({type:'get', id:requestId})
            .c('query', { xmlns:Strophe.NS.ROSTER });

        var roster = this;
        var callback_wrapper = function(response){
            if( callback ){
                response = Strophe.Mixin.apply(response, roster.mixins.Roster);
                callback(response);
            }
        }
        
        // add a handler that will process the result 
        var handler = this._conn.addHandler(callback_wrapper, null,
                                            'iq', 'result', requestId, null);
        this._conn.send(iq.tree());
        return handler;
    },



    /** Function: subscribe
     *
     *  Sends a subscription request to a user
     *
     *  Parameters:
     *    id - A user id
     *
     *  Returns:
     *    false if malformed jid
     */
    subscribe: function (jid) {
        var pres = $pres({ type: 'subscribe', to: jid });
        this._conn.send(pres.tree());
    },

    subscribed: function (jid) {
        var pres = $pres({ type: 'subscribed', to: jid });
        this._conn.send(pres.tree());
    },

    /** Function: unsubscribe
     *
     *  Dissolves a subscription to a user
     *
     *  Parameters:
     *    user     - A user entity object, jid, or user id
     *
     *  Returns:
     *    false if malformed jid
     */
    unsubscribe: function (jid) {
        var pres = $pres({ type: 'unsubscribe', to: jid });
        this._conn.send(pres.tree());
    },

    unsubscribed: function (jid) {
        var pres = $pres({ type: 'unsubscribed', to: jid });
        this._conn.send(pres.tree());
    },


    /**
     * Register presence handler callbacks by their type.
     * Example:
     *  registerHandlers({
     *     "subscribe": function(pres){ ... },
     *     "subscribed": function(pres){ ... }
     *     "unsubscribe": function(pres){ ... }
     *     "unsubscribed": function(pres){ ... }
     *  }
     *
     * The pres argument to the callbacks is a Strophe.Mixin.Presence object.
     *
     * The function returns handler id that were registered.
     */
    registerHandlers: function (callbacks) {
        var ret = {};
        var roster = this;

        var events = ["subscribe", "subscribed", "unsubscribe", "unsubscribed"];
        for(var event in events){
            type = events[event];

            if(callbacks[type]){
                var callback_wrapper = function(pres){
                    pres = Strophe.Mixin.apply(pres, Strophe.Mixin.Presence);
                    callbacks[type](pres);
                    
                    return true; // keep handler registered
                };
            
                ret[type] =  this._conn.addHandler(callback_wrapper,
                                                   null, 'presence', type,
                                                   null, null);
            }
        }
        return ret;
    },

    mixins: {
        Roster: Strophe.Mixin.apply({
            /**
             * Returns an array of objects each having the following properties:
             *  - jid
             *  - name
             *  - subscription
             *  - groups - an array of specified groups, or an empty array
             */
            getItems: function(){
                var query = new Strophe.Parser(this).find("query").get(0);
                var items = [];

                Strophe.forEachChild(query, "item", function(item){
                    var groups = [];
                    Strophe.forEachChild(item, "group", function(group){
                        groups.push(Strophe.getText(group));
                    });

                    items.push({
                        name: item.getAttribute('name'),
                        jid: item.getAttribute('jid'),
                        subscription: item.getAttribute('subscription'),
                        groups: groups
                    });
                });

                return items;
            }
        }, Strophe.Mixin.IQ)
    }
});