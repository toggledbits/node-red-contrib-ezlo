#!/usr/bin/env node

/* Copyright (C) 2021 Patrick H. Rigney, All Rights Reserved
 */
/* jshint esversion:11,node:true */

module.exports = function (RED) {
    "use strict";

    const EzloClient = require( "./lib/ezlo" );

    function isEmpty( s ) {
        return "undefined" === typeof s || null === s || "" === s;
    }

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
        node.debug = !! config.debug;
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

        node.connect = async function() {
            if ( ! node.connectPromise ) {
                node.connectPromise = new Promise( (resolve,reject) => {
                    if ( ! node.api.connected() ) {
                        node.connecting = true;
                        console.log( "starting Ezlo API client" );
                        node.api.start().then( () => {
                            console.log( "Connected to hub!" );
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
                        console.log( "Already connected to hub" );
                        resolve( node.api );
                    }
                });
            }
            return node.connectPromise;
        };

        node.close = async function() {
            if ( node.api.connected() ) {
                try {
                    await node.api.stop();
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

        /* Create the API client instance, but don't connect it yet */
        let opts = { serial: node.serial };
        opts.debug = node.debug;
        if ( "" !== ( node.credentials.username || "" ) ) {
            opts.username = node.credentials.username;
            opts.password = node.credentials.password;
        }
        if ( node.localIP ) {
            opts.endpoint = node.localIP;
        }
        //console.log( 'creating ezlo API client', opts );
        node.api = new EzloClient( opts );
        node.api.on( 'offline', () => {
            setStatusDisconnected( node, true );
        });
        node.api.on( 'online', () => {
            setStatusConnected( node, true );
        });
    }
    RED.nodes.registerType( "ezlo-hub", EzloHubNode, {
        credentials: {
            username: { type: "text" },
            password: { type: "password" },
        }
    });

    // -----------------------------------------------------------------------------------------

    function item_response( node, data ) {
        let msg = {};
        /* Send proper form for configured response type */
        if ( "full" === node.responseType ) {
            msg.payload = data;
        } else if ( "abbr" === node.responseType ) {
            msg.payload = { item: data._id, name: data.name, value: data.value };
        } else {
            msg.payload = data.value;
        }
        console.log(node.id,'sending',msg);
        node.send( msg );
    }

    function EzloItemNode(config) {
        console.log(this.id,"creating with",config);
        RED.nodes.createNode(this, config);
        const node = this;
        node.itemId = config.itemId;
        node.hub = config.hub;
        node.hubNode = RED.nodes.getNode( node.hub );
        node.responseType = config.responseType;
        node.name = node.itemId;

        setStatusDisconnected( node );
        if ( node.hubNode ) {
            node.hubNode.register( node );
            node.hubNode.getAPI().on( 'item-updated', data => {
                console.log(node.id,"handling item-updated",data.name);
                if ( data.deviceName ) {
                    node.name = `${data.deviceName}/${data.name}`;
                } else if ( data.deviceId ) {
                    node.name = `${data.deviceId}/${data.name}`;
                }
                item_response( node, data );
            });
        }

        this.on('input', function (msg) {
            // Set item value
            if ( isEmpty( msg.payload ) ) {
                const data = node.hubNode.getAPI().getItem( node.itemId );
                if ( data ) {
                    item_response( node, data );
                } else {
                    console.error( node.id,"item",node.itemId,"no longer exists" );
                }
            } else {
                node.hubNode.getAPI().setItemValue( node.itemId, msg.payload ).catch( err => {
                    console.error(node.id,"failed item",node.itemId,"set to",msg.payload,":",err);
                });
            }
        });
    }
    RED.nodes.registerType("ezlo item", EzloItemNode, {
    });

    function EzloDeviceNode(config) {
        RED.nodes.createNode(this, config);
        console.log(this,"creating EzloDeviceNoded with",config);
        const node = this;
        node.deviceId = config.deviceId;
        node.hub = config.hub;
        node.hubNode = RED.nodes.getNode( node.hub );
        node.name = node.deviceId;

        setStatusDisconnected( node );
        if ( node.hubNode ) {
            node.hubNode.register( node );
            node.hubNode.getAPI().on( 'device-updated', data => {
                if ( data.deviceName ) {
                    node.name = data.deviceName;
                }
                let msg = { payload: data };
                console.log(node.id,"handling device-updated",data.name,"sending",msg);
                node.send( msg );
            });
        }

        this.on('input', function (msg) {
            // Set item value
            if ( isEmpty( msg.payload ) ) {
                const data = node.hubNode.getAPI().getDevice( node.deviceId );
                if ( data ) {
                    node.send( { payload: data } );
                } else {
                    console.error( node.id,"device",node.deviceId,"no longer exists" );
                }
            } else {
                console.error(node.id,"unrecognized input payload:",msg.payload);
            }
        });
    }
    RED.nodes.registerType("ezlo device", EzloDeviceNode, {
    });

    function send_current_housemode( node, data ) {
        if ( "full" === node.responseType ) {
            let msg =  { payload: { action: "current", current: data } };
            node.send( msg );
        } else if ( "curr" === node.responseType ) {
            node.send( { payload: data } );
        } else if ( "id" === node.responseType ) {
            node.send( { payload: data.id } );
        } else {
            node.send( { payload: data.name } );
        }
    }

    function EzloHousemodeNode(config) {
        RED.nodes.createNode( this, config );
        const node = this;
        node.hub = config.hub;
        node.hubNode = RED.nodes.getNode( node.hub );
        node.responseType = config.responseType;
        node.lastMode = false;
        node.name = null;
        // ??? simple vs full response? simple=current mode only

        setStatusDisconnected( node );
        if ( node.hubNode ) {
            node.hubNode.register( node );
            node.hubNode.getAPI().on( 'mode-changed', data => {
                console.log(node.id,"handling mode changed",data);
                send_current_housemode( node, data );
                node.lastMode = data;
            });
            node.hubNode.getAPI().on( 'mode-changing', data => {
                if ( "full" === node.responseType ) {
                    console.log(node.id,"handling mode changing",data);
                    let msg = { payload: { action: "changing" } };
                    msg.payload.from = node.lastMode;
                    msg.payload.to = data;
                    node.send( msg );
                }
            });
        }

        this.on( 'input', function( msg ) {
            console.log(node.id,"handling input",msg);
            let params;
            if ( "object" === typeof( msg.payload ) ) {
                if ( "cancel" === msg.payload.action ) {
                    node.hubNode.getAPI().send( "hub.modes.cancel_switch", {} ).catch( err => {
                        console.error( node.id, 'attempt to cancel house mode change:', err );
                    });
                    return;
                } else {
                    if ( msg.payload.mode || msg.payload.modeId ) {
                        params = { modeId: String( msg.payload.mode || msg.payload.modeId ) };
                    } else if ( msg.payload.name ) {
                        params = { name: msg.payload.name };
                    }
                }
            } else if ( ! isEmpty( msg.payload ) ) {
                if ( isNaN( msg.payload ) ) {
                    params = { name: msg.payload };
                } else {
                    params = { modeId: String( msg.payload ) }; /* yes, string */
                }
            } else {
                let data = node.hubNode.getAPI().getMode();
                send_current_housemode( node, data );
                node.lastMode = data;
                return;
            }
            node.hubNode.getAPI().send( { api: "2.0", method: "hub.modes.switch" }, params ).catch( err => {
                console.error( node.id,'attempting ezlo house mode change to',msg.payload,':',err );
            });
        });
    }
    RED.nodes.registerType( "ezlo house mode", EzloHousemodeNode, {
    });

    function EzloHubUINode(config) {
        RED.nodes.createNode( this, config );
        const node = this;
        node.hub = config.hub;
        node.hubNode = RED.nodes.getNode( node.hub );
        node.name = node.hubNode.name;

        setStatusDisconnected( node );
        if ( node.hubNode ) {
            node.hubNode.register( node );
            node.hubNode.getAPI().on( 'offline', () => {
                node.send( { payload: { status: 'offline' } } );
            });
            node.hubNode.getAPI().on( 'online', () => {
                node.send( { payload: { status: 'online' } } );
            });
        }

        this.on( 'input', function( msg ) {
            console.log(node.id,"handling input",msg);
            if ( "object" === typeof( msg.payload ) ) {
                if ( msg.payload.method ) {
                    node.hubNode.getAPI().send( msg.payload, msg.payload.params || {} ).then( data => {
                        console.log(node.id,"request",msg.payload,"returned",data);
                        node.send( { payload: { request: msg.payload, result: data.result } } );
                    }).catch( err => {
                        console.error(node.id,"attempted",msg.payload,"result",err);
                        node.send( {
                            payload: {
                                request: msg.payload,
                                error: {
                                    message: err.message,
                                    code: err.code,
                                    reason: err.reason
                                }
                            }
                        });
                    });
                } else {
                    console.error(node.id,"unrecognized action in payload",msg.payload);
                }
            } else if ( ! isEmpty( msg.payload ) ) {
                console.error(node.id,"invalid payload",msg.payload);
            } else {
                node.send( { payload: { status: node.hubNode.getAPI().connected() ? 'online' : 'offline' } } );
            }
        });
    }
    RED.nodes.registerType( "ezlo hub info", EzloHubUINode, {
    });

    RED.httpAdmin.get( "/devicelist/:id", RED.auth.needsPermission( "ezlo.read" ), ( req, res ) => {
        console.log("request for device list for",req.params.id);
        let hubNode = RED.nodes.getNode( req.params.id );
        if ( ! hubNode ) {
            res.status( 404 ).send( "Node not found" );
            return;
        }
        hubNode.connect().then( api => {
            let ans = {};
            ans.devices = api.getAllDevices();
            ans.items = api.getAllItems();
            res.json( ans );
        }).catch( err => {
            res.status( 500 ).send( String( err ) );
        });
    });
};