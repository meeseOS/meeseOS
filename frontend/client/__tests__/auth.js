import { createInstance } from "meeseOS";
import Auth from "../src/auth.js";
import Core from "../src/core.js";

// TODO: UI

describe("Auth", () => {
	let core;
	let auth;

	beforeAll(() => createInstance().then((c) => (core = c)));
	afterAll(() => core.destroy());

	test("#constructor", () => {
		auth = new Auth(core);
		expect(auth).toBeDefined();
	});

	test("#init", () => {
		return expect(auth.init()).resolves.toBe(true);
	});

	test("#login", () => {
		const cb = jest.fn(() => {});
		auth.show(cb);

		return auth
			.login({
				username: "demo",
				password: "demo",
			})
			.then((result) => {
				expect(cb).toHaveBeenCalled();
				expect(result).toBe(true);
			});
	});

	test("#register", () => {
		return expect(
			auth.register({
				username: "jest",
				password: "jest",
			})
		).resolves.toEqual({ username: "jest" });
	});

	test("#logout", () => {
		return expect(auth.logout()).resolves.toBe(true);
	});

	test("#destroy", () => {
		auth.destroy();
	});

	test("#shutdown", () => {
		const a = new Auth(core);
		a.shutdown(true);
	});

	test("#show - autologin", () => {
		const c = new Core({
			auth: {
				username: "test",
				password: "test",
			},
		});

		const a = new Auth(c);
		return expect(a.show()).resolves.toBe(true);
	});

	test("event: meeseOS/core:logged-in", () => {
		const c = new Core();
		const a = new Auth(c);
		const fn = jest.fn();

		c.on("meeseOS/core:logged-in", fn);

		a.ui.emit("login:post", {
			username: "test",
			password: "test",
		});

		setTimeout(() => expect(fn).toHaveBeenCalled(), 25);
	});

	test("#login - failure", () => {
		const c = new Core();
		const a = new Auth(c, {
			adapter: () => ({
				login: () => Promise.reject("Simulated failure"),
				logout: () => Promise.resolve(null),
			}),
		});

		const fnError = jest.fn();
		const fnStop = jest.fn();

		a.ui.on("login:error", fnError);
		a.ui.on("login:stop", fnStop);

		return a
			.login()
			.then(() => a.logout())
			.then(() => {
				expect(fnError).toHaveBeenCalledWith("Login failed", "Simulated failure");
				expect(fnStop).toHaveBeenCalled();
			});
	});
});
