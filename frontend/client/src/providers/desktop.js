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

import { ServiceProvider } from "@meese-os/common";
import Desktop from "../desktop";

/**
 * Desktop Service Contract
 * @typedef {Object} DeskopProviderContract
 * @property {Function} setKeyboardContext
 * @property {Function} openContextMenu
 * @property {Function} addContextMenuEntries
 * @property {Function} applySettings
 * @property {Function} createDropContextMenu
 * @property {Function} getRect
 */

/**
 * MeeseOS Desktop Service Provider
 */
export default class DesktopServiceProvider extends ServiceProvider {
	/**
	 * Create new instance.
	 * @param {Core} core MeeseOS Core instance reference
	 * @param {Object} [options={}] Arguments
	 */
	constructor(core, options = {}) {
		super(core, options);

		/**
		 * @type {Desktop}
		 * @readonly
		 */
		this.desktop = new Desktop(this.core, this.options);
	}

	/**
	 * Get a list of services this provider registers.
	 * @returns {String[]}
	 */
	static provides() {
		return ["meeseOS/desktop"];
	}

	/**
	 * Initializes desktop.
	 * @returns {Promise<undefined>}
	 */
	init() {
		this.desktop.init();

		this.core.singleton("meeseOS/desktop", () => this.createDesktopContract());

		this.core.on("meeseOS/core:started", () => {
			this.desktop.applySettings();
		});
	}

	/**
	 * Destroys instance.
	 */
	destroy() {
		this.desktop = this.desktop.destroy();
	}

	/**
	 * Starts desktop.
	 * @returns {Promise<undefined>}
	 */
	start() {
		this.desktop.start();
	}

	/**
	 * @returns {DeskopProviderContract}
	 */
	createDesktopContract() {
		return {
			setKeyboardContext: (ctx) => this.desktop.setKeyboardContext(ctx),
			openContextMenu: (ev) => this.desktop.onContextMenu(ev),
			addContextMenuEntries: (entries) => this.desktop.addContextMenu(entries),
			applySettings: (settings) => this.desktop.applySettings(settings),
			createDropContextMenu: (data) => this.desktop.createDropContextMenu(data),
			getRect: () => this.desktop.getRect(),
		};
	}
}
