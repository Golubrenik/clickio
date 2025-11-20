class WaitManager extends BaseModule {
  constructor() {
    super();

    this.on("wait", (ms) => this.wait(ms));
  }

  async wait(ms) {
    return new Promise((resolve) =>
      setTimeout(resolve, ms || this.getDuration()),
    ).then(() => "next");
  }
}

window.WaitManager = WaitManager;
