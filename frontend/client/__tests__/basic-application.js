import { BasicApplication } from "../src/basic-application.js";
import { createInstance } from "meeseOS";
import Application from "../src/application.js";

describe("BasicApplication", () => {
	let core;
	let win;
	let proc;
	let basic;

	beforeAll(() => createInstance().then((c) => (core = c)));
	afterAll(() => core.destroy());

	test("#constructor", () => {
		proc = new Application(core, {
			args: {
				file: {
					path: "test:/foo",
					filename: "foo",
				},
			},
			metadata: {
				title: "Test",
				description: {},
			},
		});
		win = proc.createWindow();
		basic = new BasicApplication(core, proc, win);
		expect(basic).toBeDefined();
	});

	test("#init", () => {
		return expect(basic.init()).resolves.toBe(true);
	});

	test("#createNew", () => {
		const fn = jest.fn();
		basic.once("new-file", fn);
		basic.createNew();
		expect(fn).toHaveBeenCalled();
		expect(proc.args.file).toBe(null);
		expect(win.state.title).toEqual("Test - New File");
	});

	test("#open", () => {
		const fn = jest.fn();
		const file = {
			path: "test:/foo",
			filename: "foo",
		};

		basic.once("open-file", fn);
		basic.open(file);

		expect(fn).toHaveBeenCalled();
		expect(proc.args.file).toEqual(file);
		expect(win.state.title).toEqual(`Test - ${file.filename}`);
	});

	test("#save", () => {
		const fn = jest.fn();
		const file = {
			path: "test:/foo",
			filename: "foo",
		};

		basic.once("save-file", fn);
		basic.save(file);

		expect(fn).toHaveBeenCalled();
		expect(proc.args.file).toEqual(file);
		expect(win.state.title).toEqual(`Test - ${file.filename}`);
	});

	test("#createDialog", () => {
		basic.createSaveDialog();
		basic.createOpenDialog();
	});

	test("#destroy", () => {
		basic.destroy();
	});
});
