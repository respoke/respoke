/**
 * Copyright 2009, Drakontas LLC
 * Ilya Braude
 * ilya@drakontas.com
 * 
 * This file provides support for mixin functionality for augmenting
 * strophe's XMPP responses
 * 
 */

Strophe.Util = Strophe.Util || {};
Strophe.Util.isArray = function(obj){
    try{
        return obj && obj.constructor.toString().match(/array/i) != null;
    } catch(e){
        return false;
    }
};
Strophe.Util.parseXML = function(xml){
    var xmlDoc;
    if (window.DOMParser){
        var parser=new DOMParser();
        xmlDoc=parser.parseFromString(xml,"text/xml");
    }
    else { // Internet Explorer
        xmlDoc=Strophe._getIEXmlDom();
        xmlDoc.async="false";
        xmlDoc.loadXML(xml);
    }
    return xmlDoc.firstChild;
};
Strophe.Util.isDOM = function(obj){
    // TODO: make this check comprehensive
    return !!(obj && obj.attributes && obj.tagName);
};


(function (callback) {
var Mixin = {};


var needToWrap = undefined;
/** 
 * Helper class to wrap an IE ActiveX DOM Element
 * with something that we can apply mixins to
 * while keeping the same DOM Element interface
 */
function DOMWrapper(obj){
    if( needToWrap === false
     || !Strophe.Util.isDOM(obj)
     || obj.dom !== undefined){
        return obj;
    } else if(needToWrap === true){
        // continue...
    } else {
        // determine if we need to wrap (should only be done once)
        try {
            obj.___test = "a test";
            delete obj.___test;
            needToWrap = false;
            return obj;
        } catch(e){
            // need to wrap, continue
            needToWrap = true;
        }
    }

    this.dom = obj;

    this._updateWrappedProperties();

    var name;
    for(var m = 0; m < this._methods.length; m++){
        name = this._methods[m];
        this[name] = this.wrapMethod(name);
    }
};

DOMWrapper.prototype = {
    // used to update properties after an opertation that may change them
    _updateWrappedProperties: function(){
        for(var prop = 0; prop < this._properties.length; prop++){
            this[this._properties[prop]] = this.dom[this._properties[prop]];
        }
    },

    // optimized versions of the most commonly used methods (no eval)
    // TODO: benchmark this!
    getElementsByTagName: function(name){
        return this.dom.getElementsByTagName(name);
    },
    getAttribute: function(name){
        return this.dom.getAttribute(name);
    },
    appendChild: function(child){
        var ret = this.dom.appendChild(child);
        this._updateWrappedProperties();
        return ret;
    },

    _properties: [ "attributes", "baseURI", "childNodes", 
                   "firstChild", "lastChild", "localName", 
                   "namespaceURI", "nextSibling", "nodeName", 
                   "nodeType", "nodeValue", "ownerDocument", 
                   "parentNode", "prefix", "previousSibling", 
                   "tagName", "textContent" ],
    
    _methods: [ "appendChild", "cloneNode", "compareDocumentPosition", 
                "getAttribute", "getAttributeNS", "getAttributeNode", 
                "getAttributeNodeNS", "getElementsByTagName", 
                "getElementsByTagNameNS", "getFeature", "getUserData", 
                "hasAttribute", "hasAttributeNS", "hasAttributes", 
                "hasChildNodes", "insertBefore", "isDefaultNamespace", 
                "isEqualNode", "isSameNode", "isSupported", 
                "lookupNamespaceURI", "lookupPrefix", "normalize", 
                "removeAttribute", "removeAttributeNS", "removeAttributeNode", 
                "removeChild", "replaceChild", "setUserData", 
                "setAttribute", "setAttributeNS", "setAttributeNode", 
                "setAttributeNodeNS", "setIdAttribute", "setIdAttributeNS", 
                "setIdAttributeNode" ],

    modifiedRegExp: new RegExp("^(set|remove|insert|append|replace|normalize)"),

    wrapMethod: function(methodName){
        return function(){
            // make another reference to the arguments array so that
            // it's not clobbered inside eval()
            this['args'] = arguments;
            var argslist = "";

            if (arguments.length > 0) {
                for(var i = 0; i < arguments.length-1; i++){
                    argslist += "this['args'][" + i + "], ";
                }
                argslist += "this['args'][" + i + "]";
            }

            // HACK - workaround IE not allowing hasAttribute
            if (methodName == 'hasAttribute') {
                var ret = !!this.dom.getAttribute(this['args'][0]);
            } else {
                var exe = 'this.dom.' + methodName + "(" + argslist + ")";
                var ret = eval(exe);
            }

            if(this.modifiedRegExp.test(methodName)){
                this._updateWrappedProperties();
            }

            return ret;
        }
    }
};


/** 
 * Applies a Mixin list 'mixins' to the (DOM) object 'target'.
 * 'mixins' can be a list or a single mixin object. 
 * Any argument after 'mixins' will be interpreted in the same way
 * as 'mixins'.
 *
 * Returns: 
 *  target
 */
Mixin.apply =  function(target, mixins) {
    if (target) {
        target = new DOMWrapper(target);  // noop for well-behaved browsers

        for(var a = 1; a < arguments.length; a++){
            mixins = arguments[a];

            if(!mixins)
                continue;

            if(!Strophe.Util.isArray(mixins)){
                mixins = [mixins];
            }

            for(var m = 0; m < mixins.length; m++){
                var mixin = mixins[m];
                for (var i in mixin) {
                    if( mixin.hasOwnProperty(i) ){
                        target[i] = mixin[i];
                    }
                }

                //explicitely handle toString for IE compliance
                if(mixin.hasOwnProperty("toString") && 
                   mixin.toString != Object.prototype.toString){
                    target.toString = mixin.toString;
                }
            }
        }
    }

    return target;
};


var Stanza = {
    /***
    Function getTo

    Retrieve the "to" value of the XMPP packet

    Returns: (String) - The "to" value of the XMPP packet 

     */        
    getTo: function() {
        return this.getAttribute("to");
    },

    /***
    Function getFrom

    Retrieve the "from" value of the XMPP packet

    Returns: (String) - The "from" value of the XMPP packet 

     */        
    getFrom: function() {
        return this.getAttribute("from");
    },

    /***
    Function getName

    Retrieve the name the XMPP packet tag

    Returns: (String) - The name of the tag of the XMPP packet 

     */        
    getName: function(){
        return this.tagName;
    },


    /***
    Function getType

    Retrieve the "type" of the XMPP packet

    Returns: (String) - The "type" of the XMPP packet 

     */        
    getType: function() {
        return this.getAttribute("type");
    },

    /***
    Function getId

    Retrieve the id of the XMPP packet

    Returns: (String) - The id of the XMPP packet 

     */
    getId: function() {
        return this.getAttribute("id");
    },


    getExtensionsByNS: function(namespaceURI) {
        namespaceURI = namespaceURI || "";
        return new Strophe.Parser(this).find(namespaceURI + "|x");
    },

    getExtensions: function() {
        return new Strophe.Parser(this).find("x");
    },


    /***
     Function getError

    Retrieves the error returned with the stanza.  The error is
    represented as an object with the following properties: 'code',
    'type', 'condition'.  Code is the code of the error, type is the
    type of the error (limited set, see XMPP-CORE). Condition is the
    child element name of the error element.

    There may also be a 'text' property, if it has been included in the
    error stanza.

    Returns: (Object) - The object representing an error
    */
    getError: function() {
        var errorElem = new Strophe.Parser(this).find("error").get(0);
        if(!errorElem){
            return null;
        }

        var error = {
            code: errorElem.getAttribute("code"),
            type: errorElem.getAttribute("type")
        };

        if( errorElem.childNodes.length > 0 ){
            error.condition = errorElem.childNodes[0].nodeName;
        }
        if( errorElem.childNodes.length > 1 ){
            error.condition_detail = errorElem.childNodes[1].nodeName;
        }

        error.text = new Strophe.Parser(errorElem).find("text").text();

        return error;
    },

    /**
     * Returns a helpful string representation of the error; uses getError().
     * Returns an empty strin if the stanza is not an error stanza.
     */
    getErrorText: function(){
        var e = this.getError();
        if(e){
            var error = e.condition;
            if(e.condition_detail){
                error += " (" + e.condition_detail + ")";
            }
            if(e.text){
                error += ": " + e.text;
            }

            return error;
        } else {
            return "";
        }
    }
};

var Message = Mixin.apply({
    /***
     Function getBody

     Retrieves the body element of the IQ packet

     Returns: (DOMNode) - The XML node of the query element

     */
    getBody: function() {
        return new Strophe.Parser(this).find("body").get(0);
    },


    /***
     * Function getDelay
     * Retreives the legacy specification's 'stamp' attribute from the
     * 'delay' element
     * 
     * Returns null if not found.
     */
    getDelay: function() {
        var delayElem = this.getElementsByTagName('delay');
        if (delayElem.length && delayElem.length > 0){
            return delayElem[0].getAttribute('stamp');
        }
        return undefined;
    },

    getBodyText: function(){
        var bodyElem = this.getElementsByTagName('body');
        if (bodyElem.length && bodyElem.length > 0){
            return Strophe.getText(bodyElem[0]);
        }
        return false;
    }
}, Stanza);


var IQ = Mixin.apply({
    /***
     Function getQuery

     Retrieves the query element of the IQ packet

     Returns: (DOMNode) - The XML node of the query element

     */
    getQuery: function(ns) {
        ns = ns || "";
        return new Strophe.Parser(this).find(ns + "|query").get(0);
    },


    /***
     Function getQueryNS

     Retrieves the namespace value of the query element

     Returns: (String) - The value of the namespace attribute of the query element 

     */
    getQueryNS: function() {
        return new Strophe.Parser(this).find("query").attr("xmlns").get(0) || "";
    }
}, Stanza);


var Presence = Mixin.apply({
    getStatus: function(){
        return this.getStatuses()[0];
    },

    /**
     * Get contents of all status elements as an array
     */
    getStatuses: function(){
        var statuses = new Array();
        Strophe.forEachChild(this, 'status', function(child) {
            statuses.push(Strophe.getText(child));
        });
        return statuses;
    },

    getShow: function(){
        return new Strophe.Parser(this).find("show").text();
    },

    getPriority: function(){
        return new Strophe.Parser(this).find("priority").text();
    },

    getCapsNode: function(){
        var capsElem = new Strophe.Parser(this).find("c");
        if( capsElem ) {
            var node = capsElem.attr("node");
            if( node ) {
                return node.get(0);
            }
        }
        return null;
    }
}, Stanza);


// add default stanza mixins to the Mixin namespace
Mixin.apply(Mixin, {
    Stanza: Stanza,
    Message: Message,
    IQ: IQ,
    Presence: Presence
});

if (callback) {
    callback(Mixin);
}

})(function () {
    window.Strophe.Mixin = arguments[0];
});


/**
 * Add some useful XML/DOM parsing functions modeled after jQuery
 */
(function (callback) {

// our own isArray function
var isArray = function(obj){
    try{
        return obj && obj.constructor.toString().match(/array/i) != null;
    } catch(e){
        return false;
    }
};

var trimArray = function(array){
    for(var i = 0; i < array.length; i++){
        array[i] = array[i].replace(/^\s+|\s+$/g,"");
    }
    return array;
}

var Parser = function(data){
    if(this == window || this == window.Strophe){
        // allow calling without new keyword
        return new Parser(data);
    }

    this.elements = [];
    this.length = 0;

    if(data instanceof Parser){
        var that = this;
        data.each(function(el){
            that.push(el);
        });
    } else {
        data = isArray(data) ? data : [data];
        for(var i = 0; i < data.length; i++){
            this.push(data[i]);
        }
    }
}

var parser_api = {
    get: function(index){
        return this.elements[index];
    },

    eq: function(index){
        return new Parser([this.get(index)]);
    },

    push: function(elem){
        this.elements.push(elem);
        this.length = this.count();
    },

    count: function(){
        return this.elements.length;
    },

    each: function(func){
        if(func){
            for(var p in this.elements){
                if(this.elements.hasOwnProperty(p) && p != 'length'){
                    func(this.elements[p]);
                }
            }
        }

        return this;
    },


    /**
     * Function: find
     *  
     * Finds all children of the elements that match
     * the given selector.
     * 
     * Parameters:
     *  (String)     selector - (Optional) The selector to match. 
     *                          Supported selectors:
     *                          E > F (F is a direct child of E)
     *                          E, F (E or F named element)
     *                          ns|E (elements with name E in namespace ns - namespace is determined by E having an xmlns attribute - from CSS3)
     *                          * (matches all element names)
     *                          
     *                          Selectors can be combined:
     *                          "http://jabber.org/protocol/pubsub|pubsub, event > items > item"
     * 
     *
     * Returns:
     *    A Parser instance (could be empty).
     *
     */
    find: function(selector){
        var elements = [];

        // support the '>' CSS selector
        var hierarchy = [selector];

        if(selector){
            hierarchy = trimArray(selector.split(">"));
        }

        this.each(function(el){
            if(el !== undefined && el !== null){
                var nodeName = hierarchy[0];
                var ns = null;

                // support the ',' CSS OR selector
                var nodes = [nodeName];
                if(nodeName){
                    nodes = trimArray(nodeName.split(","));
                }

                for(var j = 0; j < nodes.length; j++){
                    // support namespace search
                    var node = trimArray((nodes[j] || "").split("|"));
                    if(node.length == 2){ // ns specified
                        nodeName = node[1];
                        ns = node[0];
                    } else {
                        nodeName = node[0];
                        ns = null;
                    }

                    // allow "" and "*" to mean "match any element name"
                    if(nodeName === "" || nodeName === "*"){
                        nodeName = null;
                    }
                    // allow empty ns to mean no ns specified
                    ns = ns == ""? null : ns;

                    Strophe.forEachChild(el, nodeName, function (elem) {
                        if (ns == null || elem.getAttribute("xmlns") == ns ) {

                            // look ahead
                            if(hierarchy[1]){
                                Parser(elem).find(hierarchy.slice(1).join(">")).each(function(elem){
                                    elements.push(elem);
                                });
                            }
                            else {
                                elements.push(elem);
                            }
                        }
                    });
                }
            }
        });

        return new Parser(elements);
    },

    /**
     * Function: filter
     *  
     * Finds all elements that match
     * the given node name and namespace parameters.
     * 
     * Parameters:
     *  (String)     nodeName - (Optional) The node name to match.
     *  (String)     ns       - (Optional) The xmlns to match.
     *  (String)     filter   - (Optional) A custom filter function:
     *                             function(elem){return true/false}
     *
     * Returns:
     *    A Parser instance (could be empty).
     *
     */
    filter: function(nodeName, ns, filterfn){
        var elements = [];
        if(!ns && ns === undefined){
            ns = null;
        }

        filterfn = filterfn || function(e){
            if(e !== undefined && e !== null){
                if (e.nodeType == Strophe.ElementType.NORMAL &&
                    (!nodeName || Strophe.isTagEqual(e, nodeName)) && 
                    (ns == null || e.getAttribute("xmlns") == ns )) {
                    return true;
                }
            }
        }

        this.each(function(e){
            if(filterfn(e))
                elements.push(e);
        });

        return new Parser(elements);
    },


    /**
     * Function: attr
     *  
     * Finds all attribute values of elements that match
     * the given attribute name.
     * 
     * Parameters:
     *  (String)     attrName - The attribute name to match.
     *
     * Returns:
     *    A Parser instance (could be empty).
     *
     */
    attr: function(attrName){
        var result = [];
        this.each(function(e){
            result.push(e.getAttribute(attrName));
        });

        return new Parser(result);
    },

    /**
     * Function: text
     *  
     * Gets the text values of all of the elements concatinated as a single string.
     * Note that this is not recursive.
     *
     * Returns:
     *    A string, empty if no text elements are found.
     */
    text: function(){
        var ret = "";

        this.each(function(elem){
            ret += (Strophe.getText(elem) || "");
        });

        return ret; 
    }
}

for(var i in parser_api){
    if( parser_api.hasOwnProperty(i) ){
        Parser.prototype[i] = parser_api[i];
    }
}


if (callback) {
    callback(Parser);
}

})(function () {
    $sp = window.Strophe.Parser = arguments[0];
});
