/**
 * OS.js - JavaScript Cloud/Web Desktop Platform
 *
 * Copyright (c) 2011-Present, Anders Evenrud <andersevenrud@gmail.com>
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * @author  Anders Evenrud <andersevenrud@gmail.com>
 * @licence Simplified BSD License
 */

/* eslint-disable no-unused-vars */
const fs = require("fs-extra");
const consola = require("consola");
const pathLib = require("path");
const logger = consola.withTag("Auth");
const nullAdapter = require("./adapters/auth/null");
const TokenStorage = require("./utils/token-storage");
const TokenFactory = require("./utils/token-factory");
/* eslint-enable no-unused-vars */

/**
 * TODO: typedef
 * @typedef {Object} AuthAdapter
 */

/**
 * Authentication User Profile
 * @typedef {Object} AuthUserProfile
 * @property {String} username
 * @property {String} name
 * @property {String[]} groups
 */

/**
 * Authentication Service Options
 * @typedef {Object} AuthOptions
 * @property {AuthAdapter} [adapter]
 * @property {String[]} [requiredGroups]
 * @property {String[]} [denyUsers]
 */

/**
 * Authentication Handler
 */
class Auth {
	/**
	 * Creates a new instance.
	 * @param {Core} core MeeseOS Core instance reference
	 * @param {AuthOptions} [options={}] Service Provider arguments
	 */
	constructor(core, options = {}) {
		const { requiredGroups, denyUsers } = core.configuration.auth;

		/**
		 * @type {Core}
		 */
		this.core = core;

		/**
		 * @type {AuthOptions}
		 */
		this.options = {
			adapter: nullAdapter,
			requiredGroups,
			denyUsers,
			...options,
		};

		/**
		 * @type {AuthAdapter}
		 */
		this.adapter = nullAdapter(core, this.options.config);

		try {
			this.adapter = this.options.adapter(core, this.options.config);
		} catch (e) {
			logger.warn(e);
		}
	}

	/**
	 * Initializes adapter.
	 * @returns {Promise<Boolean>}
	 */
	async init() {
		/**
		 * @type {TokenFactory}
		 */
		this.tokenFactory = this.core.make("meeseOS/token-factory");

		await this.tokenFactory.init();

		/**
		 * @type {TokenStorage}
		 */
		this.storage = this.core.make("meeseOS/token-storage");

		await this.storage.init();

		if (this.adapter.init) {
			return this.adapter.init();
		}

		return true;
	}

	/**
	 * Destroys instance.
	 */
	destroy() {
		if (this.adapter.destroy) {
			this.adapter.destroy();
		}
	}

	/**
	 * Performs a login request.
	 * @param {Request} req HTTP request
	 * @param {Response} res HTTP response
	 * @returns {Promise<undefined>}
	 */
	async login(req, res) {
		let result = {};
		const refreshToken = req.body.refreshToken;

		if (refreshToken) {
			// Decodes the JWT refresh token and returns the user information
			const refreshTokenUser =
			  await this.tokenFactory.refreshToAccessToken(refreshToken);

			if (refreshTokenUser?.accessToken) {
				result.username = refreshTokenUser.username;
				result.groups = refreshTokenUser.groups;
				result.accessToken = refreshTokenUser.accessToken;
			}
		} else {
			// Attempts to log the user in using the adapter
			const standardAuthResult = await this.adapter.login(req, res);

			if (standardAuthResult) {
				result = standardAuthResult;
				result.refreshToken = this.tokenFactory.createRefreshToken(
					standardAuthResult.username,
					standardAuthResult.groups
				);
				result.accessToken = this.tokenFactory.createAccessToken(
					standardAuthResult.username,
					standardAuthResult.groups
				);

				this.storage.create(result.refreshToken);
			}
		}

		if (Object.keys(result).length !== 0) {
			const profile = this.createUserProfile(req.body, result);
			if (profile && this.checkLoginPermissions(profile)) {
				await this.createHomeDirectory(profile);
				req.session.user = profile;
				req.session.save(() => {
					this.core.emit(
						"meeseOS/core:logged-in",
						Object.freeze({ ...req.session, })
					);

					res.status(200).json(profile);
				});

				return;
			}
		}

		res.status(403).json({ error: "Invalid login or permission denied" });
	}

	/**
	 * Performs a logout request.
	 * @param {Request} req HTTP request
	 * @param {Response} res HTTP response
	 * @returns {Promise<undefined>}
	 */
	async logout(req, res) {
		this.core.emit(
			"meeseOS/core:logging-out",
			Object.freeze({ ...req.session, })
		);

		await this.adapter.logout(req, res);

		try {
			req.session.destroy();
		} catch (e) {
			logger.warn(e);
		}

		res.json({});
	}

	/**
	 * Performs a register request.
	 * @param {Request} req HTTP request
	 * @param {Response} res HTTP response
	 * @returns {Promise<undefined>}
	 */
	async register(req, res) {
		if (this.adapter.register) {
			const result = await this.adapter.register(req, res);

			return res.json(result);
		}

		return res.status(403).json({ error: "Registration unavailable" });
	}

	/**
	 * Checks if login is allowed for this user.
	 * @param {AuthUserProfile} profile User profile
	 * @returns {Boolean}
	 */
	checkLoginPermissions(profile) {
		const { requiredGroups, denyUsers } = this.options;

		if (denyUsers.indexOf(profile.username) !== -1) {
			return false;
		}

		if (requiredGroups.length > 0) {
			const passes = requiredGroups.every((name) =>
				profile.groups.indexOf(name) !== -1
			);

			return passes;
		}

		return true;
	}

	/**
	 * Creates user profile object.
	 * @param {Object} fields Input fields
	 * @param {Object} result Login result
	 * @returns {AuthUserProfile|Boolean}
	 */
	createUserProfile(fields, result) {
		const ignores = ["password"];
		const required = ["username"];
		const template = {
			username: fields.username,
			id: fields.username,
			name: fields.username,
			groups: this.core.config("auth.defaultGroups", []),
			refreshToken: fields.refreshToken,
		};

		const mergedArrays = { ...fields, ...result };
		const missing = required.filter((k) => typeof mergedArrays[k] === "undefined");
		if (missing.length) {
			logger.warn("Missing user attributes:", missing);
			return false;
		}

		const values = Object.keys(mergedArrays)
			.filter((key) => ignores.indexOf(key) === -1)
			.reduce((obj, key) => ({ ...obj, [key]: mergedArrays[key] }), {});

		return { ...template, ...values };
	}

	/**
	 * Tries to create home directory for a user.
	 * @param {AuthUserProfile} profile User profile
	 * @returns {Promise<undefined>}
	 */
	async createHomeDirectory(profile) {
		const vfs = this.core.make("meeseOS/vfs");
		const template = this.core.config("vfs.home.template", []);

		if (typeof template === "string") {
			// If the template is a string, it is a path to a directory
			// that should be copied to the user's home directory
			const root = await vfs.realpath("home:/", profile);

			await fs.copy(template, root, { overwrite: false });
		} else if (Array.isArray(template)) {
			await this.createHomeDirectoryFromArray(template, vfs, profile);
		}
	}

	/**
	 * If the template is an array, it is a list of files that should be copied
	 * to the user's home directory.
	 * @param {Object[]} template Array of objects with a specified path,
	 * optionally with specified content but defaulting to an empty string
	 * @param {VFSServiceProvider} vfs An instance of the virtual file system
	 * @param {AuthUserProfile} profile User profile
	 */
	async createHomeDirectoryFromArray(template, vfs, profile) {
		for (const file of template) {
			try {
				const { path, contents = "" } = file;
				const shortcutsFile = await vfs.realpath(`home:/${path}`, profile);
				const dir = pathLib.dirname(shortcutsFile);
				if (!await fs.pathExists(shortcutsFile)) {
					await fs.ensureDir(dir);
					await fs.writeFile(shortcutsFile, contents);
				}
			} catch (e) {
				logger.warn(`There was a problem writing '${file.path}' to the home directory template`);
				logger.error("ERROR:", e);
			}
		}
	}
}

module.exports = Auth;
