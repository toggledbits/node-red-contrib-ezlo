#!/usr/bin/env node

/* Copyright (C) 2021 Patrick H. Rigney, All Rights Reserved
 */

module.exports = function (RED) {
    "use strict";

    function start(node, types){
    }

    // -----------------------------------------------------------------------------------------

    function EzloItemNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.itemId = config.itemId;

        this.on('input', function (msg) {
            // Set item value
        });

    }
    RED.nodes.registerType("ezlo-item", EzloItemNode, {
        credentials: {
            username: { type: "text" },
            password: { type: "password" },
        }
    });
};
