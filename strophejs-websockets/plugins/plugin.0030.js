/*
  Copyright 2009, Drakontas LLC
  Ilya Braude ilya@drakontas.com
*/

Strophe.addConnectionPlugin('disco', {
    /*
     Extend connection object to have plugin name 'disco'.  
    */
    _conn: null,

	//The plugin must have the init function.
	init: function(conn) {

	    this._conn = conn;

	    /*
	      Function used to setup plugin.
	    */
	    
	    /* extend name space 
	     *  NS.DISCO_ITEMS - #items namespace
	     *                  
	     *  NS.DISCO_INFO - #info namespace
	     */
        Strophe.addNamespace('DISCO_ITEMS',
                             "http://jabber.org/protocol/disco#items");
        Strophe.addNamespace('DISCO_INFO',
                             "http://jabber.org/protocol/disco#info");
    },

    /*
        Function: discoverItems
            Send a discovery IQ packet
        
        Parameters:
            service - The owner of the node's jid
            node -  [optional] The name of a node
            call_back - [optional] the call back method
          
        Returns:
            Iq id used to send subscription.
    */
    discoverItems: function(service, node, call_back, mixins) {    
        var id = this._conn.getUniqueId("serviceDisco");
    
        //create discovery packet
        var iq = $iq({to:service, type:'get', id:id});
        
        iq.c('query', { xmlns:Strophe.NS.DISCO_ITEMS });
        if (node){
            iq.attrs({ node:node })
        }
        
        if( call_back ){
            var disco = this;
            var callback_wrapper = function(response){
                response = Strophe.Mixin.apply(response, 
                                               disco.mixins.DiscoItems, 
                                               mixins);
                call_back(response);
            }
            
            this._conn.addHandler(callback_wrapper, null, 'iq', null, id, null);
        }

        this._conn.send(iq.tree());
        return id;
    },

    /**
     * Copy from discoverItems, change DICSO_ITEMS to DISCO_INFO
     */
    discoverInfo: function(service, node, call_back, mixins) {    
        var id = this._conn.getUniqueId("serviceDisco");
    
        //create discovery packet
        var iq = $iq({to:service, type:'get', id:id});
        
        iq.c('query', { xmlns:Strophe.NS.DISCO_INFO });
        if (node){
            iq.attrs({ node:node })
        }
        
        if( call_back ){
            var disco = this;
            var callback_wrapper = function(response){
                response = Strophe.Mixin.apply(response, 
                                               disco.mixins.DiscoItems, 
                                               mixins);
                call_back(response);
            }
            
            this._conn.addHandler(callback_wrapper, null, 'iq', null, id, null);
        }

        this._conn.send(iq.tree());
        return id;
    },
    // mixins initialization is wrapped in a closure so that
    // DiscoItems can be refered to from within itself
    mixins: (function(){
        var DiscoItems = Strophe.Mixin.apply({
            getItems: function(){
                var itemElems = this.getElementsByTagName('item');
                var discoItems = [];

                // shove the items in an array
                if (itemElems != null && itemElems.length > 0){
                    for (var i=0; i < itemElems.length; i++){
                        var item = itemElems[i];

                        var jid = item.getAttribute('jid') || null;
                        var node = item.getAttribute('node') || null;
                        var name = item.getAttribute('name') || null;

                        item = Strophe.Mixin.apply(item, {
                            jid: jid,
                            node: node,
                            name: name,
                            toString: DiscoItems.__item_toString });
                        discoItems.push(item);
                    }
                }

                return discoItems;
            },

            getNode: function(){
                var query = this.getElementsByTagName('query');
                if( query && query.length > 0 ){
                    return query[0].getAttribute("node");
                }
                return null;
            },

            __item_toString: function(){
                // 'this' here is the item element (DOMNode)
                function append(target, content){
                    return target ? target + ", " + content : content;
                }
                var str = "";
                if( this.jid )
                    str = append(str, "jid: " + this.jid);
                if( this.node )
                    str = append(str, "node: " + this.node);
                if( this.name )
                    str = append(str, "name: " + this.name);

                return str;
            }
        }, Strophe.Mixin.IQ);

        return {DiscoItems: DiscoItems};
    })()
});
