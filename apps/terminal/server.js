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

const path = require("path");
const os = require("os");
const pty = require("node-pty");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config({
	path: path.resolve(__dirname, "scripts/.env"),
	override: true,
});

const windowsPlatform = os.platform() === "win32";
const connections = {};
let terminals = [];

/**
 * Creates a new Terminal.
 * @param {Core} core MeeseOS Core instance reference
 * @param {WebSocket} ws WebSocket instance
 * @param {Object} [options={}] Options
 * @param {Array} [args=[]] Arguments
 */
const createTerminal = (core, ws, options = {}, args = []) => {
	const hostname = core.config("xterm.hostname", "localhost");
	const username = process.env.USERNAME ?? options.username ?? "root";
	const password = process.env.PASSWORD ?? options.password ?? "toor";
	const sshCommand = `ssh -o StrictHostKeyChecking=no ${username}@${hostname}`;
	let sshPassCommand = `sshpass -p ${password} ${sshCommand}`;

	// If you're on Windows, you have to run `sshpass` from your WSL distro.
	// Make sure you have the sshpass binary installed.
	if (windowsPlatform) sshPassCommand = `wsl -- ${sshPassCommand}`;
	args = [...args, "-c", sshPassCommand];

	// Logs on the server side (CLI), so does not pose a security threat
	console.log("[Xterm]", "Creating terminal...", { options, args });

	const shell = windowsPlatform ? "powershell.exe" : "bash";
	const size = options.size || { cols: 80, rows: 24 };
	const term = pty.spawn(shell, args, {
		cols: size.cols,
		rows: size.rows,
		name: "xterm-color",
		cwd: process.cwd(),
		env: process.env,
	});

	const kill = () => {
		console.log("[Xterm]", "Closing terminal...");
		term.kill();

		const foundIndex = terminals.findIndex((t) => t.pid === term.pid);
		if (foundIndex !== -1) {
			terminals.splice(foundIndex, 1);
		}

		if (connections[options.uuid]) {
			delete connections[options.uuid];
		}
	};

	term.onExit((ev) => {
		try {
			// This is a workaround for ping wrapper
			ws.send(JSON.stringify({ action: "exit", event: ev }));
		} catch (e) {
			console.warn(e);
		}
	});

	term.onData((data) => {
		try {
			// This is a workaround for ping wrapper
			ws.send(JSON.stringify({ content: data }));
		} catch (e) {
			console.warn(e);
		}
	});

	ws.on("message", (data) => {
		// This is a workaround for ping wrapper
		if (typeof data === "string") {
			const message = JSON.parse(data);
			if (message.data) {
				term.write(message.data);
			}
		} else {
			term.write(data);
		}
	});

	ws.on("close", () => kill());

	terminals.push({
		uuid: options.uuid,
		terminal: term,
	});

	return term;
};

/**
 * Creates a new Terminal connection.
 * @param {Core} core MeeseOS Core instance reference
 * @param {WebSocket} ws WebSocket instance
 */
const createConnection = (core, ws) => {
	console.log("[Xterm]", "Creating connection...");
	let pinged = false;

	ws.on("message", (uuid) => {
		if (pinged) return;
		try {
			const term = createTerminal(core, ws, connections[uuid]);
			ws.send(String(term.pid));
			pinged = { uuid, pid: term.pid };
		} catch (e) {
			console.warn(e);
		}
	});
};

/**
 * Add routes for application.
 * @param {Core} core MeeseOS Core instance reference
 * @param {Application} proc MeeseOS Application instance reference
 */
const init = async (core, proc) => {
	const { app } = core;

	app.post(proc.resource("/create"), (req, res) => {
		console.log("[Xterm]", "Requested connection...");

		const username = req.session.user.username;
		const uuid = uuidv4();

		connections[uuid] = {
			options: req.body,
			username,
			uuid,
		};

		res.json({ uuid });
	});

	app.post(proc.resource("/resize"), (req, res) => {
		console.log("[Xterm]", "Requested resize...");

		const { size, pid, uuid } = req.body;
		const { cols, rows } = size;

		const found = terminals.find(
			(iter) => iter.terminal.pid === pid && iter.uuid === uuid
		);

		if (found) {
			found.terminal.resize(cols, rows);
		}

		res.send();
	});

	app.ws(proc.resource("/socket"), (ws, _req) => {
		createConnection(core, ws);
	});
};

/**
 * Destroys the server.
 */
const destroy = () => {
	terminals.forEach((iter) => iter.terminal.kill());
	terminals = [];
};

/**
 * The server module for the application.
 * @param {Core} core The MeeseOS Core instance reference
 * @param {Application} proc The MeeseOS Application instance reference
 * @returns {Object} The server module
 */
module.exports = (core, proc) => ({
	init: () => init(core, proc),
	destroy,
});
