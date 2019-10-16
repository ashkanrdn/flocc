const { Agent } = require("../dist/flocc");

const agent = new Agent();
agent.set("x", 12);
agent.set("y", 23);
agent.set("z", () => 41);

it("Correctly gets data associated with an agent.", () => {
  expect(agent.get("x")).toEqual(12);
  expect(agent.get("y")).toEqual(23);
  expect(agent.get("z")).toEqual(41);

  expect(agent.get("w")).toBeNull();

  const { x, y, z } = agent.getData();
  expect([x, y, z]).toEqual([12, 23, 41]);
});

it("Correctly sets new data.", () => {
  agent.set("x", 65);
  expect(agent.get("x")).toEqual(65);

  agent.set({
    x: 100,
    y: false,
    z: () => "asdf"
  });

  expect(agent.get("x")).toEqual(100);
  expect(agent.get("y")).toEqual(false);
  expect(agent.get("z")).toEqual("asdf");

  const { x, y, z } = agent.getData();
  expect([x, y, z]).toEqual([100, false, "asdf"]);
});

it("Correctly retrieves function values that reference other values.", () => {
  agent.set("alias", agt => agt.get("z"));
  expect(agent.get("alias")).toBe("asdf");
  expect(agent.get("alias")).toBe(agent.get("z"));
  agent.set("z", () => 9999);
  expect(agent.get("alias")).toBe(9999);
  expect(agent.get("alias")).toBe(agent.get("z"));
});

it("Retrieves a null value for data that does not exist.", () => {
  expect(agent.get("notfound")).toBeNull();
});

it("Increments and decrements data.", () => {
  const a = new Agent();
  a.set("x", 4);
  a.increment("x");
  expect(a.get("x")).toEqual(5);
  a.decrement("x");
  expect(a.get("x")).toEqual(4);
});

it(`Throws an error if an agent's data tries to call itself.`, () => {
  const a = new Agent();
  const b = new Agent();
  a.set("value", () => b.get("value"));
  b.set("value", () => a.get("value"));
  expect(() => a.get("value")).toThrow();
});
