#!/usr/bin/env node

/* Copyright (C) 2021 Patrick H. Rigney, All Rights Reserved
 */
/* jshint esversion:11,node:true */

module.exports = function (RED) {
    "use strict";

    ezlo = require( "./lib/ezlo" );

    function setStatusDisconnected(node, allNodes) {
        if ( allNodes ) {
            for ( const [ id, child ] of Object.entries( node.children ) ) {
                child.status( { fill: "red", shape: "ring", text: "node-red:common.status.disconnected" } );
            }
        } else {
            node.status({ fill: "red", shape: "ring", text: "node-red:common.status.disconnected" });
        }
    }

    function setStatusConnected( node, allNodes ) {
        if( allNodes ) {
            for ( const [ id, child ] of Object.entries( node.children ) ) {
                child.status( { fill: "green", shape: "dot", text: "node-red:common.status.connected" } );
            }
        } else {
            node.status({ fill: "green", shape: "dot", text: "node-red:common.status.connected" });
        }
    }

    // -----------------------------------------------------------------------------------------

    function EzloHubNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        node.name = config.name;
        node.serial = config.serialNumber;
        node.localIP = config.localIP;
        node.autoConnect = config.autoConnect || true;
        node.accessAnonymous = config.accessAnonymous;
        node.connectPromise = false;
        node.children = {};
        node.api = false;
        node.handlers = {};

        node.register = function( ezloNode ) {
            node.children[ ezloNode.id ] = ezloNode;
            if ( 0 !== Object.keys( node.children ) ) {
                if ( node.autoConnect ) {
                    node.connect();
                }
            }
        };

        node.deregister = function( ezloNode ) {
            delete node.children[ ezloNode.id ];
            if ( 0 === Object.keys( node.children ) ) {
                node.close();
            }
        };

        node.connect = function() {
            if ( ! node.connectPromise ) {
                node.connectPromise = new Promise( (resolve,reject) => {
                    if ( ! node.api.connected() ) {
                        node.connecting = true;
                        node.api.start().then( () => {
                            setStatusConnected( node, true );
                            resolve( node.api );
                        }).catch( err => {
                            console.error( err );
                            setStatusDisconnected( node, true );
                            reject( err );
                        }).finally( () => {
                            node.connecting = false;
                        });
                    } else {
                        resolve( node.api );
                    }
                });
            }
            return node.connectPromise;
        };

        node.close = async function() {
            if ( node.api.connected() ) {
                try {
                    await node.api.close();
                } catch ( err ) {
                    console.error( err );
                }
            }
            setStatusDisconnected( node, true );
            node.connectPromise = false;
        };

        node.getAPI = function() {
            return node.api;
        };

        node.setItemValue = function( itemID, value ) {
            node.api.setItemValue( itemID, value );
        };
        
        node.request = function( method, params ) {
            node.api.send( method, params );
        };

        this.on('input', function (msg) {
            // incoming!!!
        });

        /* Create the API client instance, but don't connect it yet */
        let opts = { serial: node.serial };
        if ( node.username ) {
            opts.username = node.username;
            opts.password = node.password;
        }
        if ( node.localIP ) {
            opts.endpoint = node.localIP;
        }
        node.api = new ezlo.EzloClient( opts );
    }
    RED.nodes.registerType( "ezlo-hub", EzloHubNode, {
        credentials: {
            username: { type: "text" },
            password: { type: "password" },
        }
    });

    // -----------------------------------------------------------------------------------------

    function EzloItemNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        node.itemId = config.itemId;
        node.hub = config.hub;
        node.hubNode = RED.nodes.getNode( node.hub );
        
        setStatusDisconnected( node );
        if ( node.hubNode ) {
            node.hubNode.register( node );
            node.hubNode.getAPI().on( 'item-changed', data => {
                node.send( data );
            });
        }
            
        this.on('input', function (msg) {
            // Set item value
            node.hubNode.setItemValue( node.itemId, msg );
        });
    }
    RED.nodes.registerType("ezlo-item", EzloItemNode, {
    });
    
    function EzloHousemodeNode(config) {
        RED.nodes.createNode( this, config );
        const node = this;
        node.hub = config.hub;
        node.hubNode = RED.nodes.getNode( node.hub );
        node.lastMode = false;

        setStatusDisconnected( node );
        if ( node.hubNode ) {
            node.hubNode.register( node );
            node.hubNode.getAPI().on( 'mode-changed', data => {
                data.action = 'changed';
                node.send( data );
                node.lastMode = data;
            });
            node.hubNode.on( 'mode-changing', data => {
                let p = { action: 'changing' };
                p.from = lastMode;
                delete p.from.action;
                p.to = data;
                node.send( p );
            });
        }
        
        this.on( 'input', function( msg ) {
            if ( "object" === typeof( msg.payload ) ) {
                if ( "cancel" === msg.payload.action ) {
                    node.hubNode.send( "hub.modes.cancel_switch", {} );
                } else {
                    var p;
                    if ( msg.payload.mode || msg.payload.modeId ) {
                        p = { modeId: msg.payload.mode || msg.payload.modeId };
                    } else if ( msg.payload.name ) {
                        p = { name: msg.payload.name };
                    }
                    if ( p ) {
                        node.hubNode.send( "hub.modes.switch", p );
                    } else {
                        // ??? flag error in data? 
                    }
                }
            } else if ( msg.payload ) {
                if ( isNaN( msg.payload ) ) {
                    node.hubNode.send( "hub.modes.switch", { name: msg.payload } );
                } else {
                    node.hubNode.send( "hub.modes.switch", { modeId: parseInt( msg.payload ) } );
                }
            } else {
                console.error( "TBD send status" );
            }
        });
    }
    RED.nodes.registerType( "ezlo-housemode", EzloHousemodeNode, {
    });
};
