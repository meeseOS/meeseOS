import { draggable, droppable } from "../../src/utils/dnd.js";

describe("draggable", () => {
	const el = document.createElement("div");
	const ondragstart = jest.fn();
	const ondragend = jest.fn();
	let dragger;

	test("setup", () => {
		dragger = draggable(el, {
			ondragstart,
			ondragend,
		});

		expect(el.getAttribute("draggable")).toBe("true");
		expect(el.getAttribute("aria-grabbed")).toBe("false");
		expect(el.classList.contains("meeseOS__draggable")).toBe(true);
		expect(typeof dragger.destroy).toBe("function");
	});

	test("dragstart", () => {
		const ev = new Event("dragstart");
		el.dispatchEvent(ev);
		expect(ondragstart).toHaveBeenCalled();
		expect(el.getAttribute("aria-grabbed")).toBe("true");
	});

	test("dragend", () => {
		const ev = new Event("dragend");
		el.dispatchEvent(ev);
		expect(ondragend).toHaveBeenCalled();
		expect(el.getAttribute("aria-grabbed")).toBe("false");
	});

	test("destroy", () => {
		dragger.destroy();
		expect(el.classList.contains("meeseOS__draggable")).toBe(false);
	});
});

describe("droppable", () => {
	const el = document.createElement("div");
	const ondrop = jest.fn();
	const ondragenter = jest.fn();
	const ondragover = jest.fn();
	const ondragleave = jest.fn();
	let dropper;

	test("setup", () => {
		dropper = droppable(el, {
			ondrop,
			ondragenter,
			ondragover,
			ondragleave,
		});

		expect(el.classList.contains("meeseOS__droppable")).toBe(true);
		expect(el.getAttribute("aria-dropeffect")).toBe("move");
		expect(typeof dropper.destroy).toBe("function");
	});

	test("dragenter", () => {
		const ev = new Event("dragenter");
		el.dispatchEvent(ev);
		expect(ondragenter).toHaveBeenCalled();
	});

	// TODO: Find a way to trigger false behavior
	test("dragover", () => {
		const ev = new Event("dragover");
		ev.dataTransfer = {};
		el.dispatchEvent(ev);
		expect(ondragover).toHaveBeenCalled();
		expect(el.classList.contains("meeseOS__drop")).toBe(true);
	});

	test("dragleave", () => {
		const ev = new Event("dragleave");
		el.dispatchEvent(ev);
		expect(ondragleave).toHaveBeenCalled();
	});

	test("drop", () => {
		const data = { test: "with jest" };
		const files = [{ simulate: "file" }];
		const ev = new Event("drop");

		ev.dataTransfer = {
			effect: "move",
			files,
			getData: () => JSON.stringify(data),
		};

		el.dispatchEvent(ev);
		expect(ondrop).toHaveBeenCalledWith(ev, data, files);
	});

	test("destroy", () => {
		dropper.destroy();
		expect(el.classList.contains("meeseOS__droppable")).toBe(false);
	});
});
