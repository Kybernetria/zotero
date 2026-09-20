/*
    ***** BEGIN LICENSE BLOCK *****

    Copyright © 2025 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     http://zotero.org

    This file is part of Zotero.

    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    ***** END LICENSE BLOCK *****
*/

"use strict";

if (!Zotero.Sync) {
	Zotero.Sync = {};
}

const server = Zotero.Sync.Server;
const preference = 'sync.server.url';

function normalizeURL(value) {
	value = (value || '').trim();
	if (!value) {
		return '';
	}

	let url;
	try {
		url = new URL(value);
	}
	catch {
		throw new Error('Sync server URL must be an absolute HTTP or HTTPS URL');
	}

	if (url.protocol != 'http:' && url.protocol != 'https:') {
		throw new Error('Sync server URL must use HTTP or HTTPS');
	}
	if (!url.hostname || url.username || url.password || url.search || url.hash
			|| (url.pathname && url.pathname != '/')) {
		throw new Error('Sync server URL must contain only an origin');
	}

	let hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
	let loopback = hostname == 'localhost' || hostname == '127.0.0.1' || hostname == '::1';
	if (url.protocol == 'http:' && !loopback) {
		throw new Error('HTTPS is required for non-loopback sync servers');
	}

	return url.origin + '/';
}

Object.defineProperties(server, {
	isCustom: {
		get: function () {
			return !!normalizeURL(Zotero.Prefs.get(preference));
		}
	},
	origin: {
		get: function () {
			return normalizeURL(Zotero.Prefs.get(preference));
		}
	},
	apiURL: {
		get: function () {
			return this.origin ? this.origin + 'api/' : '';
		}
	},
	streamingURL: {
		get: function () {
			if (!this.origin) {
				return '';
			}
			let scheme = this.origin.startsWith('https:') ? 'wss:' : 'ws:';
			return scheme + this.origin.substring(this.origin.indexOf(':') + 1) + 'stream/';
		}
	}
});

server.normalizeURL = normalizeURL;

server.setURL = async function (value) {
	let normalized = normalizeURL(value);
	let current = Zotero.Prefs.get(preference);
	if (current == normalized) {
		return normalized;
	}

	// End the old stream and discard in-memory credentials before changing the
	// realm used by the login manager. Stored credentials remain in their old realm.
	if (Zotero.Streamer) {
		await Zotero.Streamer.removeSyncSubscription();
		Zotero.Streamer.apiKey = null;
		Zotero.Streamer._disconnect();
	}
	if (Zotero.Sync.Runner) {
		Zotero.Sync.Runner.apiKey = null;
	}
	if (Zotero.Sync.Data && Zotero.Sync.Data.Local) {
		Zotero.Sync.Data.Local.clearCachedCredentials();
	}
	Zotero.Prefs.set(preference, normalized);
	return normalized;
};
