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

/**
 * Get parent directory.
 * @param {String} path Directory
 * @returns {String} Parent directory
 */
export const parentDirectory = (path) =>
	path
		.replace(/\/$/, "")
		.split("/")
		.filter((item, index, arr) => index < arr.length - 1)
		.join("/")
		.replace(/(\/+)?$/, "/");

/**
 * Joins paths.
 * @param {String[]} args paths
 * @returns {String}
 */
export const pathJoin = (...args) =>
	args
		.map((str, index) => {
			if (index > 0) {
				str = str.replace(/^\/?/, "");
			}
			return str.replace(/\/?$/, "");
		})
		.join("/");

/**
 * Sort by locale string.
 */
const sortString = (k, d) => (a, b) =>
	d === "asc"
		? String(a[k]).localeCompare(b[k])
		: String(b[k]).localeCompare(a[k]);

/**
 * Sort by date.
 */
const sortDate = (k, d) => (a, b) =>
	d === "asc"
		? new Date(a[k]) > new Date(b[k])
		: new Date(b[k]) > new Date(a[k]);

/**
 * Sort by educated guess.
 */
const sortDefault = (k, d) => (a, b) =>
	a[k] < b[k] ? -1 : a[k] > b[k] ? (d === "asc" ? 1 : 0) : d === "asc" ? 0 : 1;

/**
 * Sorts an array of files.
 */
const sortFn = (t) => {
	if (t === "string") {
		return sortString;
	} else if (t === "date") {
		return sortDate;
	}

	return sortDefault;
};

/**
 * Map of sorters from readdir attributes.
 */
const sortMap = {
	size: sortFn("number"),
	mtime: sortFn("date"),
	ctime: sortFn("date"),
	atime: sortFn("date"),
};

/**
 * Creates "special" directory entries.
 * @param {String} path The path to the readdir root
 * @returns {Object[]}
 */
const createSpecials = (path) => {
	const specials = [];
	const stripped = path.replace(/\/+/g, "/").replace(/^(\w+):/, "") ?? "/";

	if (stripped !== "/") {
		specials.push({
			isDirectory: true,
			isFile: false,
			mime: null,
			size: 0,
			stat: {},
			filename: "..",
			path: parentDirectory(path) ?? "/",
		});
	}

	return specials;
};

/**
 * Creates a FileReader (promisified).
 *
 * @param {String} method The method to call
 * @param {ArrayBuffer} ab The ArrayBuffer
 * @param {String} mime The MIME type
 * @returns {Promise}
 */
const createFileReader = (method, ab, mime) =>
	new Promise((resolve, reject) => {
		const b = new Blob([ab], { type: mime });
		const r = new FileReader();
		r.onerror = (e) => reject(e);
		r.onloadend = () => resolve(r.result);
		r[method](b);
	});

/**
 * Converts a number (bytes) into human-readable string.
 * @param {Number} bytes Input
 * @param {Boolean} [si=false] Use SI units
 * @returns {String} The human-readable file size
 */
export const humanFileSize = (bytes, si = false) => {
	if (isNaN(bytes) || typeof bytes !== "number") {
		bytes = 0;
	}

	const thresh = si ? 1000 : 1024;
	const units = si
		? ["kB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]
		: ["KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"];

	if (bytes < thresh) {
		return bytes + " B";
	}

	let unitIndex = -1;
	do {
		bytes /= thresh;
		++unitIndex;
	} while (bytes >= thresh);

	return `${bytes.toFixed(1)} ${units[unitIndex]}`;
};

/**
 * Transforms a readdir result.
 *
 * @param {Object} root The path to the readdir root
 * @param Object[] files An array of readdir results
 * @param {Object} options Options
 * @param {Boolean} [options.showHiddenFiles=false] Show hidden files
 * @param {Function} [options.filter] A filter
 * @param {String} [options.sortBy='filename'] Sort by this attribute
 * @param {String} [options.sortDir='asc'] Sort in this direction
 * @returns {Object[]}
 */
export const transformReaddir = ({ path }, files, options = {}) => {
	options = {
		showHiddenFiles: false,
		sortBy: "filename",
		sortDir: "asc",
		...options,
	};

	let { sortDir, sortBy, filter } = options;
	if (typeof filter !== "function") {
		filter = () => true;
	}

	if (["asc", "desc"].indexOf(sortDir) === -1) {
		sortDir = "asc";
	}

	const filterHidden = options.showHiddenFiles
		? () => true
		: (file) => file.filename.substr(0, 1) !== ".";

	const sorter = sortMap[sortBy] ? sortMap[sortBy] : sortFn("string");

	const modify = (file) => ({
		...file,
		humanSize: humanFileSize(file.size),
	});

	// FIXME: Optimize this to one chain!

	const sortedSpecial = createSpecials(path)
		.sort(sorter(sortBy, sortDir))
		.map(modify);

	const sortedDirectories = files
		.filter((file) => file.isDirectory)
		.sort(sorter(sortBy, sortDir))
		.filter(filterHidden)
		.filter(filter)
		.map(modify);

	const sortedFiles = files
		.filter((file) => !file.isDirectory)
		.sort(sorter(sortBy, sortDir))
		.filter(filterHidden)
		.filter(filter)
		.map(modify);

	return [...sortedSpecial, ...sortedDirectories, ...sortedFiles];
};

/**
 * Transform an ArrayBuffer into a specified type.
 *
 * @param {ArrayBuffer} ab The ArrayBuffer
 * @param {String} mime The MIME type
 * @param {String} type Transform to this type
 * @returns {DOMString|String|Blob|ArrayBuffer}
 */
export const transformArrayBuffer = (ab, mime, type) => {
	if (type === "string") {
		return createFileReader("readAsText", ab, mime);
	} else if (type === "uri") {
		return createFileReader("readAsDataURL", ab, mime);
	} else if (type === "blob") {
		return Promise.resolve(new Blob([ab], { type: mime }));
	}

	return Promise.resolve(ab);
};

/**
 * Gets an icon from file stat.
 * @param {Object} file The file stat object
 * @returns {String|Object}
 */
export const getFileIcon = (map) => {
	const find = (file) => {
		const found = Object.keys(map).find((re) => {
			const regexp = new RegExp(re);
			return regexp.test(file.mime);
		});

		return found ? map[found] : { name: "application-x-executable" };
	};

	return (file) => (file.isDirectory ? { name: "folder" } : find(file));
};

/**
 * Creates a file iter for scandir.
 * @param {Object} stat file stat
 * @returns {Object}
 */
export const createFileIter = (stat) => ({
	isDirectory: false,
	isFile: true,
	mime: "application/octet-stream",
	icon: null,
	size: -1,
	path: null,
	filename: null,
	label: null,
	stat: {},
	id: null,
	parent_id: null,
	...stat,
});

/**
 * Get basename of a file.
 * @param {String} path The path
 * @returns {String}
 */
export const basename = (path) => path.split("/").reverse()[0];

/**
 * Get path of a file.
 * @param {String} path The path
 * @returns {String}
 */
export const pathname = (path) => {
	const split = path.split("/");
	if (split.length === 2) {
		split[1] = "";
	} else {
		split.splice(split.length - 1, 1);
	}

	return split.join("/");
};

/**
 * Gets prefix from a VFS path.
 * @param {String} str Input
 * @returns {String}
 */
export const parseMountpointPrefix = (str) => {
	const re = /^([\w-_]+):+(.*)/;
	const match = String(str).replace(/\+/g, "/").match(re);
	const [prefix] = Array.from(match || []).slice(1);

	return prefix;
};

/**
 * Filters a mountpoint by user groups.
 * @returns {Boolean}
 */
export const filterMountByGroups =
	(userGroups) =>
		(mountGroups, strict = true) =>
			mountGroups instanceof Array
				? mountGroups[strict ? "every" : "some"](
					(g) => userGroups.indexOf(g) !== -1
			  )
				: true;

/**
 * Creates a list of VFS events to simulate server-side
 * file watching.
 * @returns {Object[]}
 */
export const createWatchEvents = (method, args) => {
	const events = [];
	const options = args[args.length - 1] || {};
	const movement = ["move", "rename", "copy"].indexOf(method) !== -1;
	const path = (i) => (typeof i === "string" ? i : i.path);
	const invalid =
		[
			"readdir",
			"download",
			"url",
			"exists",
			"readfile",
			"search",
			"stat",
		].indexOf(method) !== -1;

	if (!invalid) {
		const obj = {
			method,
			source: path(args[0]),
			pid: options.pid,
		};

		let target = args[0];
		if (Array.isArray(args[0])) target = target[0];

		events.push([
			"meeseOS/vfs:directoryChanged",
			{
				...obj,
				path: pathname(path(target)),
			},
		]);

		if (movement) {
			events.push([
				"meeseOS/vfs:directoryChanged",
				{
					...obj,
					path: pathname(path(args[1])),
				},
			]);
		}
	}

	return events;
};
