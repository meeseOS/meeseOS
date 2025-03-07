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
 * @license Simplified BSD License
 */

import defaultIcon from "./styles/icon.png";
import logger from "./logger";

/**
 * Tray Icon Data
 * @typedef {Object} TrayEntryData
 * @property {String} [key] Used as internal index for tray entry
 * @property {String} [icon] Icon source
 * @property {String} [title] The title and tooltip
 * @property {Function} [onclick] The callback function for clicks
 * @property {Function} [oncontextmenu] The callback function for contextmenu
 */

/**
 * Tray Icon Entry
 * @typedef {Object} TrayEntry
 * @property {TrayEntryData} entry The given entry data
 * @property {Function} update Updates entry with given data
 * @property {Function} destroy Destroy the entry
 */

/**
 * Tray Handler
 */
export default class Tray {
	/**
	 * Creates the Tray Handler
	 *
	 * @param {Core} core MeeseOS Core instance reference
	 */
	constructor(core) {
		/**
		 * Core instance reference
		 * @type {Core}
		 * @readonly
		 */
		this.core = core;

		/**
		 * All Tray entries
		 * @type {TrayEntry[]}
		 */
		this.entries = [];
	}

	/**
	 * Destroys instance
	 */
	destroy() {
		this.entries = [];
	}

	/**
	 * Creates a new Tray entry
	 * @param {TrayEntryData} options Options
	 * @param {Function} [handler] The callback function for all events
	 * @returns {TrayEntry}
	 */
	create(options, handler) {
		const defaultTitle = "Tray Entry";

		handler = handler || (() => {});

		const entry = {
			key: null,
			icon: defaultIcon,
			title: defaultTitle,
			onclick: handler,
			oncontextmenu: handler,
			handler,
			...options,
		};

		logger.debug("Created new tray entry", entry);

		this.entries.push(entry);

		this.core.emit("meeseOS/tray:create", entry);
		this.core.emit("meeseOS/tray:update", this.entries);

		const obj = {
			entry,
			update: (u) => {
				Object.keys(u).forEach((k) => (entry[k] = u[k]));

				this.core.emit("meeseOS/tray:update", this.entries);
			},
			destroy: () => this.remove(entry),
		};

		return obj;
	}

	/**
	 * Removes a Tray entry
	 * @param {TrayEntry} entry The tray entry
	 */
	remove(entry) {
		const foundIndex = this.entries.findIndex((e) => e === entry);
		if (foundIndex !== -1) {
			this.entries.splice(foundIndex, 1);

			this.core.emit("meeseOS/tray:remove", entry);
			this.core.emit("meeseOS/tray:update", this.entries);
		}
	}

	/**
	 * @returns {TrayEntry[]}
	 */
	list() {
		return this.entries;
	}

	/**
	 * @returns {Boolean}
	 */
	has(key) {
		return this.entries.findIndex((entry) => entry.key === key) !== -1;
	}
}
