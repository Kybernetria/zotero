/* global assert, describe, it, beforeEach, afterEach, sinon: false */

"use strict";

describe("Zotero.Sync.Server", function () {
	var oldURL, oldAPIURL, oldStorageProtocol;

	beforeEach(function () {
		oldURL = Zotero.Prefs.get('sync.server.url');
		oldAPIURL = Zotero.Prefs.get('api.url');
		oldStorageProtocol = Zotero.Prefs.get('sync.storage.protocol');
		Zotero.Prefs.set('sync.server.url', '');
	});

	afterEach(function () {
		Zotero.Prefs.set('sync.server.url', oldURL || '');
		if (oldAPIURL) {
			Zotero.Prefs.set('api.url', oldAPIURL);
		}
		else {
			Zotero.Prefs.clear('api.url');
		}
		Zotero.Prefs.set('sync.storage.protocol', oldStorageProtocol);
	});

	it("should normalize origins and reject unsafe URLs", function () {
		assert.equal(
			Zotero.Sync.Server.normalizeURL('https://example.com'),
			'https://example.com/'
		);
		assert.equal(
			Zotero.Sync.Server.normalizeURL('http://127.0.0.1:8080'),
			'http://127.0.0.1:8080/'
		);
		assert.throws(
			() => Zotero.Sync.Server.normalizeURL('http://example.com'),
			/HTTPS is required/
		);
		assert.throws(
			() => Zotero.Sync.Server.normalizeURL('https://user:password@example.com'),
			/only an origin/
		);
		assert.throws(
			() => Zotero.Sync.Server.normalizeURL('https://example.com/path'),
			/only an origin/
		);
		assert.throws(
			() => Zotero.Sync.Server.normalizeURL('https://example.com/?token=secret'),
			/only an origin/
		);
	});

	it("should derive API and streaming endpoints", function () {
		Zotero.Prefs.set('sync.server.url', 'https://sync.example/');
		assert.isTrue(Zotero.Sync.Server.isCustom);
		assert.equal(Zotero.Sync.Server.origin, 'https://sync.example/');
		assert.equal(Zotero.Sync.Server.apiURL, 'https://sync.example/api/');
		assert.equal(Zotero.Sync.Server.streamingURL, 'wss://sync.example/stream/');
	});

	it("should prefer the custom server over legacy endpoint preferences", function () {
		Zotero.Prefs.set('sync.server.url', 'https://sync.example');
		Zotero.Prefs.set('api.url', 'https://legacy.example/');
		let runner = new Zotero.Sync.Runner_Module;
		assert.equal(runner.baseURL, 'https://sync.example/api/');

		let testRunner = new Zotero.Sync.Runner_Module({ baseURL: 'http://test.example/' });
		assert.equal(testRunner.baseURL, 'http://test.example/');

		let oldStreamerURL = Zotero.Streamer.url;
		Zotero.Streamer.url = 'wss://legacy.example/';
		try {
			assert.equal(Zotero.Streamer._getURL(), 'wss://sync.example/stream/');
		}
		finally {
			Zotero.Streamer.url = oldStreamerURL;
		}
	});

	it("should scope login realms and avoid ZFS for custom servers", function () {
		Zotero.Prefs.set('sync.server.url', 'https://sync.example');
		assert.include(
			Zotero.Sync.Data.Local._getLoginManagerRealm(),
			'https://sync.example/api/'
		);

		let libraryGet = sinon.stub(Zotero.Libraries, 'get').returns({libraryType: 'group'});
		try {
			assert.equal(
				Zotero.Sync.Storage.Local.getModeForLibrary(1),
				'webdav'
			);
			assert.isFalse(Zotero.Sync.Storage.Local.getEnabledForLibrary(1));
		}
		finally {
			libraryGet.restore();
		}

		Zotero.Prefs.set('sync.server.url', '');
		assert.equal(
			Zotero.Sync.Data.Local._getLoginManagerRealm(),
			'Zotero Web API (encrypted)'
		);
	});
});
