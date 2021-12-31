# Ezlo nodes for *Node-RED*
[![Platform](https://img.shields.io/badge/platform-Node--RED-red)](https://nodered.org)
![License](https://img.shields.io/github/license/toggledbits/node-red-contrib-ezlo)
[![NPM](https://img.shields.io/npm/v/node-red-contrib-ezlo?logo=npm)](https://www.npmjs.org/package/node-red-contrib-ezlo)
[![Open Issues](https://img.shields.io/github/issues-raw/toggledbits/node-red-contrib-ezlo.svg)](https://github.com/toggledbits/node-red-contrib-ezlo/issues)
[![Closed Issues](https://img.shields.io/github/issues-closed-raw/toggledbits/node-red-contrib-ezlo.svg)](https://github.com/toggledbits/node-red-contrib-ezlo/issues?q=is%3Aissue+is%3Aclosed)
<!--
[![Known Vulnerabilities](https://snyk.io/test/npm/node-red-contrib-ezlo/badge.svg)](https://snyk.io/test/npm/node-red-contrib-ezlo)
[![Downloads](https://img.shields.io/npm/dm/node-red-contrib-ezlo.svg)](https://www.npmjs.com/package/node-red-contrib-ezlo)
[![Total Downloads](https://img.shields.io/npm/dt/node-red-contrib-ezlo.svg)](https://www.npmjs.com/package/node-red-contrib-ezlo)
[![Package Quality](http://npm.packagequality.com/shield/node-red-contrib-ezlo.png)](http://packagequality.com/#?package=node-red-contrib-ezlo)
![Build](https://img.shields.io/github/workflow/status/toggledbits/node-red-contrib-ezlo/Node.js%20CI?event=push)
-->

This package provides *Node-RED* nodes for controlling devices connected to Ezlo hubs via their API. It can connect to the hub locally, or through Ezlo's cloud relay (the latter is the only optional available for older generation Atom and PlugHub hubs).

I try to be responsive to questions and [issues](https://github.com/toggledbits/node-red-contrib-ezlo/issues), so please feel free to reach out. If you find these nodes useful, please [make a donation](#donations-fuel-this-project} to support my efforts!

![image](https://user-images.githubusercontent.com/19241798/147771403-578cabd4-9628-41e3-a13f-ebec834be3e4.png)

## Installing/Updating

Installing or updating these nodes should be as simple as:

        npm i -g node-red-contrib-ezlo

## Nodes

### `ezlo item` node

The *ezlo item* node is probably the node you will use the most. On Ezlo hubs, *devices* have *items*, and items are the containers for state on the device. For example, when a switch device is turned on, its `switch` item's value will go from *false* to *true*. A dimmer changing from 25% to 100% will have its `dimmer` item's value change from 25 to 100.

The *ezlo item* node will send to its output every change to the item's value reported by the hub. You can choose one of three different output formats for the payload:

* Simple &mdash; (default) the item's value is sent as-is, as the entire payload. A dimmer value, for example, will have a payload that is just a number from 0 to 100.
* Abbreviated &mdash; the value is sent as a small object with keys `id`, `name`, and `value`; the `id` and `name` are the unique identifier and item name, respectively.
* Full &mdash; the entire Ezlo item structure, as provided by the Ezlo API, is sent unmodified/unfiltered.

Controlling a device on Ezlo hubs is most often done by setting the value of an item. For example, if we want our dimmer device to go from 100% back to 25%, we would set the device's `dimmer` item value to 25. So the *ezlo item* node will accept a value at its input, and will attempt to set that value on the item. The value must be of the type required by the Ezlo API for the item type (the node will convert strings to numbers and strings to boolean if that's required).

To set up an *ezlo item* node, you either need to know the item's ID, or pick it from the device and item menus. The menus will populate once the hub is selected. Choose the device, then the item, and the `Item ID` and `Description` fields will be populated automatically.

If you send no payload or an empty payload to an *ezlo item* node, it will echo the current value of the item (in the form chosen) at its output.

### `ezlo device` node

The *ezlo device* node maps to an Ezlo device and provides the non-state information about the device (e.g. its name, whether battery-powered, it's reachability, etc.).

The output of this node is the unfiltered, unmodified Ezlo device structure.

The input of the node will accept a no-payload (or empty payload) message and in response will send the device information to the output. Any other payload currently logs an error and produces nothing on the output.

Like the *ezlo item* node, you need to provide the device ID, and the easiest way to get that is to use the menu of devices to pick it. The menu will populate once the hub has been selected. Selecting a device from the menu will populate the `Device ID` and `Description` fields.

### `ezlo house mode` node

The *ezlo house mode* node provides information about the current (and pending, optionally) house mode, and can change the house mode.

The output of the node can be in one of four forms (you choose one):

* Current only, name (string) &mdash; the output sends the current house mode name only as a string when it changes;
* Current only, ID (number) &mdash; the output sends the current house mode ID only as a number when it changes;
* Current only, ID and name (object) &mdash; the output sends the current house mode ID and name in an object of the form: `{ "id": 1, "name": "Home" }`
* Current and Pending (objects) &mdash; when the house mode change starts, an object with the current and pending modes is sent to the output:

        {
            "action": "changing",
            "from": {
                "id": 1, "name": "Home"
            },
            "to": {
                "id": 2, "name": "Away"
            }
        }

  When a house mode change completes (or is cancelled), an object of this form is sent to the output:

        {
            "action": "current",
            "current": {
                "id": 1, "name": "Away"
            }
        }

The input of the *ezlo house mode* node accepts either a numeric house mode ID or string mode name as its payload, and will initiate a change with the hub to the given mode. If the payload is an object of the form `{ "action": "cancel" }`, the node will attempt to cancel any pending house mode change. If there no payload (or an empty payload) presented on a message to the input, the node will respond by sending the current mode to the output (in the form configured).

### `ezlo hub` node

The *ezlo hub* node provides basic up/down information about the hub by sending objects to the output containing a `status` key with value `online` or `offline`.

        { "status": "online" }

At the input, if a message has no payload, the current online/offline state will be reported at the output. If the message has a payload with the key `method` defined, the node will send the payload to the hub as an API request; the optional `params` key can be included to include any required parameters as defined by the Ezlo API. It is thus possible to run pretty much any API action. The result of the action will be presented at the output in the following form:

        {
            "request": { ...repeats the request input... }
            "result": { ...contains the result from the hub... }
            "error": { ...contains error info from the hub... }
        }

The `result` key will contain an object that contains the body of the hub's response to the action, if it succeeded. If it failed, the `result` key will not be present, and the `error` key will be present with the `message`, `code` and `reason` given by the hub.

## Hub Connections

**Quick Start/TLDR:** Provide the serial number of your hub, and the username and password of an Ezlo account for the hub. Also provide the hub's (stable) IP address, if it has one and you know it. Bob's your uncle.

When configuring any of the above nodes, you will need to specify the hub. This is a configuration node that represents a connection to your Ezlo hub(s). There are three ways to connect to the hub:

1. Via the Ezlo Cloud Relay: Ezlo hubs maintain a persistent tunnel to the Ezlo service cloud. The node can connect to the Ezlo cloud and access the hub's API by exchanging data over the connection to the cloud, which proxies/relays the data to/from the hub over the tunnel. This works in all circumstances (as long as there is Internet access for the hub and Ezlo's cloud services are up and connected).
2. Via the local API WebSocket, with authentication: using a *local access token*, a connection to the hub's local API WebSocket may be possible. The access token is obtained from the Ezlo cloud services, so Internet/cloud access is still required, but the token is long-lived and reconnections without re-authentication are possible within the token's lifetime. The local API WebSocket is not available on older Atom and PlugHub models (only cloud relay is allowed/possible).
3. Via the local API WebSocket, without authentication: to eliminate the Internet/cloud dependency, you can configure the hub for *offline anonymous access*, but this comes with a trade-off to the hub's security (and again, this is not available on some hub models). This is the best option for reliability of your home automation, but only you can judge if it's an acceptable risk.

For cloud relay access, which is the simplest and quickest way to get started, you only need to configure the serial number and an Ezlo account username and password. It is recommended that you create an additional user account to keep *Node-RED*'s access separate from your master Ezlo account credentials. New users can be created using their mobile app. This is generally the least desirable way to connect to the hub, however, as it is heavily dependent on the uptime of your Internet access and the Ezlo cloud services, and adds latency to every data exchange/command. Unfortunately, for older Atom and PlugHub models, this is also the only option available (and for this reason, these models are a poor choice for any serious home automation, in the author's opinion).

For authenticated local access, you need to provide the serial number, Ezlo account username and password, and the `Local IP Address` of the hub. Your hub *must* use a static IP address or DHCP reservation so that the address never changes. Although it is still necessary for the node to connect to the cloud to refresh the access token, these requests are fewer and farther between, and the local access to the API reduces latency of data and actions considerably.

For unauthenticated local access, you first need to be aware that you are removing a layer of security from your hub and allowing any device on your network to connect to it without authentication. An infected computer or device on your network could therefore access the hub and control it and every device it controls. This is a trade-off that must be made if you deem the risk of Internet-access or cloud dependency greater than the risk of unauthorized local access to your hub. To enable anonymous access, you will first need to have authenticated access either via Ezlo's cloud relay (without `Local IP Address`) or locally (with `Local IP Address`). Then, you can either [set it through the Ezlo API yourself manually](https://api.ezlo.com/hub/local_mode/index.html#hubofflineanonymous_accessenabledset), or let the hub configuration node do it by setting the `Offline Anonymous Access` field under *Options* to `Enable Anonymous Access`. Then save and deploy. The node will reconnect to the hub, set the flag, and then reboot the hub. When the hub comes back, it will reconnect, but still using authenticated access. At this point, you can remove the `username` from the hub configuration node, and this is the signal to the hub configuration node to connect anonymously. You can leave the `password` field set in case you need it later. If you later decide to disable anonymous access and return to full authentication, all you need to do is restore the `username` value and set the `Offline Anonymous Access` option to `Disable Anonymous Access`.

## Issues

Please report issues or questions on the [Github repository for the project](https://github.com/toggledbits/node-red-contrib-ezlo/issues). Since this is my first effort for *Node-RED*, I'm interested in any feedback any of you may have, particular experienced NR node developers.

You can also find me in the [Node-RED forum](https://discourse.nodered.org/) as [@toggledbits](https://discourse.nodered.org/u/toggledbits/summary), and I'm happy to answer questions there, but if you're reporting a bug, please do so at Github issues (linked above) to help keep me organized.

**Known Issue:** Ezlo hubs on recent firmware issue an error (bad parameters) when you attempt to change the house mode to the already active mode, rather than ignoring the call. This is a logged error only and produces no other output (i.e. nothing at the node's output), so it's benign. Just be aware of it if you see it in the logs.

**Known Issue:** Some versions of Ezlo firmware will refuse to open connections after a hub reboot for a couple of minutes. It will eventually recover, but it's an Ezlo firmware issue and there's nothing I can do about it.

## Donations Fuel This Project!

<a target="blank" href="https://blockchain.com/eth/address/0x604AEE87ca9099471492bC6580002E7dC880050B"><img src="https://img.shields.io/badge/Donate-Ethereum-blue.svg"/></a>
<a target="blank" href="https://blockchain.com/btc/address/1KHq3LGf1F9GMSnZ658ht873n3GuX4tsVF"><img src="https://img.shields.io/badge/Donate-Bitcoin-green.svg"/></a>
<a target="blank" href="https://www.toggledbits.com/donate"><img src="https://img.shields.io/badge/Donate-PayPal-blueviolet.svg"/></a>

<a target="_blank" href="https://www.buymeacoffee.com/toggledbits"><img src="https://cdn.buymeacoffee.com/buttons/default-orange.png" alt="Buy Me A Dram" height="41" width="174"></a>

## Release Notes

Please see the [CHANGELOG](/CHANGELOG.md) file.

## Author

My name is Patrick Rigney, and I've been an active developer in the IoT space for about 8 years. My background is in EECS. I'm a current independent developer of integrations and tools for Vera, Ezlo, Hubitat, Home Assistant, and now, *Node-RED*. One of my biggest independent projects is [Reactor](https://reactor.toggledbits.com), a code-less automation engine for people who find even *Node-RED* too daunting.

## License

node-red-contrib-ezlo (c) 2021 by Patrick H. Rigney, All Rights Reserved

Offered under the MIT License. Please see the [LICENSE](/LICENSE.md) file.
