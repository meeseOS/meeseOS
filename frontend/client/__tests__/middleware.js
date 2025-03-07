import { createInstance } from "meeseOS";
import Middleware from "../src/middleware.js";

describe("Middleware", () => {
	let core;

	beforeAll(() => {
		return createInstance().then((c) => (core = c));
	});

	afterAll(() => core.destroy());

	test("#add", () => {
		const middleware = new Middleware();
		const callback = () => {};

		middleware.add("group", callback);

		expect(middleware.get("group")[0]).toEqual(callback);
	});

	test("#remove", () => {
		const middleware = new Middleware();
		const callback = () => {};

		middleware.add("group", callback);
		middleware.remove("group", callback);

		expect(middleware.get("group").length).toEqual(0);
	});

	test("#clear", () => {
		const middleware = new Middleware();
		const callback = () => {};

		middleware.add("group", callback);
		middleware.clear();

		expect(middleware.get("group").length).toEqual(0);
	});

	test("Should call all callbacks", () => {
		const middleware = new Middleware();

		const firstCallback = jest.fn(() => {});
		const secondCallback = jest.fn(() => {});
		const thirdCallback = jest.fn(() => {});

		middleware.add("group", firstCallback);
		middleware.add("group", secondCallback);
		middleware.add("group", thirdCallback);

		middleware.get("group").forEach((callback) => callback());

		expect(firstCallback).toHaveBeenCalled();
		expect(secondCallback).toHaveBeenCalled();
		expect(thirdCallback).toHaveBeenCalled();
	});

	test("#core middleware", () => {
		const callback = () => {};
		core.middleware("meeseOS/service", callback);

		const middleware = core.make("meeseOS/middleware").get("meeseOS/service");

		expect(middleware[0]).toEqual(callback);
	});
});
