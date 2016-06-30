'use strict';

const Bluebird = require('bluebird');
const debug = require('debug')('slambda:Container');

class Stack {
  constructor(id, exec) {
    this.id = id;
    this.exec = exec;
    this.promises = [];
    this.inputs = [];
  }

  queue(id, args) {
    debug(`#run() ID: ${id}`);
    this.inputs.push({ id, arguments: args });
    return new Bluebird((resolve, reject) => {
      this.promises.push({ resolve, reject });
    });
  }

  flush() {
    debug(`#flush() ${this.inputs.length} queued calls`);
    let inputs = this.inputs;
    let promises = this.promises;
    this.inputs = [];
    this.promises = [];
    this.exec(this.id, inputs)
      .then(outputs =>
        outputs.map((output, idx) => {
          promises[idx].resolve(output);
        })
      )
  }
}

module.exports = class Batch {
  constructor(executor, manual) {
    debug('constructor');
    this.stacks = {};
    this.executor = executor;
    this.manual = manual;

    this.flushing = false;
  }

  run(containerId, id, args) {
    debug(`#run() ID: ${id}`);
    if (!this.manual) this.auto();
    let stack = this.stacks[containerId];
    if (!stack) stack = this.stacks[containerId] = new Stack(containerId, this.executor);
    return stack.queue(id, args);
  }

  auto() {
    if (this.flushing) return;

    debug(`#auto() Setting up nextTick flush`);
    process.nextTick(() => this.flush());
    this.flushing = true;
  }

  flush() {
    debug(`#flush() ${this.inputs.length} queued calls`);

    this.flushing = false;
    Object.keys(this.stacks)
      .map(key => this.stacks[key].flush());
  }
}
