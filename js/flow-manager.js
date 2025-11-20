class FlowManager {
  constructor(flow) {
    this.flow = flow;
    this.stepIndex = 0;
  }

  next() {
    const step = this.flow.at(this.stepIndex);
    if (!step) {
      return -1;
    }
    this.stepIndex += 1;
    return step;
  }
}
