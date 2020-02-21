/// <reference path="../renderers/Renderer.d.ts" />
/// <reference path="./EnvironmentOptions.d.ts" />
/// <reference path="./EnvironmentHelper.d.ts" />
/// <reference path="../types/Data.d.ts" />
import { Agent } from "../agents/Agent";
import { Network } from "../helpers/Network";
import shuffle from "../utils/shuffle";
import { KDTree } from "../helpers/KDTree";
import { Terrain } from "../helpers/Terrain";

interface Helpers {
  kdtree: KDTree;
  network: Network;
  terrain: Terrain;
}

export interface TickOptions {
  count?: number;
  randomizeOrder?: boolean;
}

export const defaultTickOptions: TickOptions = {
  count: 1,
  randomizeOrder: false
};

const defaultEnvironmentOptions: EnvironmentOptions = {
  torus: true,
  height: 0,
  width: 0
};

interface MemoValue {
  value: any;
  time: number;
}

/**
 * An environment provides the space and time in which agents interact.
 * Environments, like agents, can store data in key-value pairs
 * that can be updated over time.
 */
class Environment extends Agent {
  /** @member {Agent[]} */
  agents: Array<Agent> = [];
  agentsById: Map<string, Agent> = new Map();
  cache: Map<string, MemoValue> = new Map();
  helpers: Helpers = {
    kdtree: null,
    network: null,
    terrain: null
  };
  /** @member {Renderer[]} */
  renderers: Renderer[] = [];
  opts: EnvironmentOptions;
  width: number;
  height: number;
  time: number = 0;

  constructor(opts: EnvironmentOptions = defaultEnvironmentOptions) {
    super();
    this.opts = Object.assign({}, defaultEnvironmentOptions);
    this.opts = Object.assign(this.opts, opts);
    this.width = this.opts.width;
    this.height = this.opts.height;
  }

  /**
   * Add an agent to the environment. Automatically sets the
   * agent's environment to be this environment.
   * @param {Agent} agent
   */
  addAgent(agent: Agent): void {
    if (!(agent instanceof Agent)) return;
    agent.environment = this;
    this.agents.push(agent);
    this.agentsById.set(agent.id, agent);
  }

  /**
   * Remove an agent from the environment.
   * @param {Agent} agent
   */
  removeAgent(agent: Agent): void {
    agent.environment = null;
    const index = this.agents.indexOf(agent);
    this.agents.splice(index, 1);
    this.agentsById.delete(agent.id);
  }

  /**
   * Remove an agent from the environment by its ID.
   * @param {string} id
   */
  removeAgentById(id: string): void {
    const agent = this.getAgentById(id);
    if (!agent) return;
    this.removeAgent(agent);
  }

  /**
   * Get an array of all the agents in the environment.
   * @return {Agent[]}
   */
  getAgents(): Array<Agent> {
    return this.agents;
  }

  /**
   * Get an agent in the environment by its ID.
   * @param {string} id
   * @returns {Agent|null}
   */
  getAgentById(id: string): Agent | null {
    return this.agentsById.get(id) || null;
  }

  /**
   * Removes all agents from the environment.
   */
  clear(): void {
    while (this.getAgents().length > 0) {
      const a0 = this.getAgents()[0];
      this.removeAgent(a0);
    }
  }

  /**
   * From the parameter passed to .tick, get a structured TickOptions object.
   * @param {number | TickOptions} opts
   */
  _getTickOptions(opts?: number | TickOptions): TickOptions {
    let count: number = 1;
    if (typeof opts === "number") {
      count = opts;
    } else if (!!opts) {
      count = opts.count || 1;
    }
    let randomizeOrder: boolean = false;
    if (
      opts &&
      typeof opts !== "number" &&
      opts.hasOwnProperty("randomizeOrder")
    )
      randomizeOrder = opts.randomizeOrder;

    return { count, randomizeOrder };
  }

  /**
   * Execute all agent rules.
   * @param { boolean } randomizeOrder
   */
  _executeAgentRules(randomizeOrder: boolean): void {
    (randomizeOrder ? shuffle(this.agents) : this.agents).forEach(agent =>
      agent.executeRules()
    );
  }

  /**
   * Execute all enqueued agent rules.
   * @param { boolean } randomizeOrder
   */
  _executeEnqueuedAgentRules(randomizeOrder: boolean): void {
    (randomizeOrder ? shuffle(this.agents) : this.agents).forEach(agent =>
      agent.executeEnqueuedRules()
    );
  }

  /**
   * Moves the environment forward in time,
   * executing all agent's rules sequentially, followed by
   * any enqueued rules (which are removed with every tick).
   * Can take either a number or a configuration object as a parameter.
   * If a number, the environment will tick forward that many times.
   * @param {number | TickOptions} opts
   */
  tick(opts?: number | TickOptions): void {
    const { count, randomizeOrder } = this._getTickOptions(opts);

    this._executeAgentRules(randomizeOrder);

    this._executeEnqueuedAgentRules(randomizeOrder);

    if (this.helpers.kdtree) this.helpers.kdtree.rebalance(this.agents);

    this.time++;

    if (count > 1) {
      this.tick(count - 1);
      return;
    }

    this.renderers.forEach(r => r.render());
  }

  /**
   * Use a helper with this environment.
   * @param {EnvironmentHelper} e
   */
  use(e: EnvironmentHelper) {
    if (e instanceof KDTree) this.helpers.kdtree = e;
    if (e instanceof Network) this.helpers.network = e;
    if (e instanceof Terrain) this.helpers.terrain = e;
  }

  /**
   * Get an array of data associated with agents in the environment by key.
   * Equivalent to calling `environment.getAgents().map(agent => agent.get(key));`
   * Defaults to calculating and storing the result within the same environment tick.
   * If the 2nd parameter is set to `false`, will recalculate and return the result every time.
   * @param {string} key - The key for which to retrieve data.
   * @param {boolean} useCache - Whether or not to cache the result (defaults to true).
   * @return {any[]} Array of data associated with `agent.get(key)` across all agents.
   */
  stat(key: string, useCache: boolean = true): any[] {
    const mapAndFilter = () => {
      const output: any[] = [];
      this.getAgents().forEach(a => {
        if (a.get(key) === null) return;
        output.push(a.get(key));
      });
      return output;
    };
    if (useCache) return this.memo(mapAndFilter);
    return mapAndFilter();
  }

  /**
   * Pass a function to cache and use the return value within the same environment tick.
   * @param {Function} key - The key for which to retrieve data.
   * @return {any} The return value of the function that was passed.
   */
  memo(fn: Function): any {
    const serialized = fn.toString();
    const memoValue = this.cache.get(serialized);
    if (memoValue && this.time === memoValue.time) return memoValue.value;

    // if does not exist in cache or time has elapsed, cache new value
    const data = fn();
    this.cache.set(serialized, { value: data, time: this.time });
    return data;
  }
}

export { Environment };
