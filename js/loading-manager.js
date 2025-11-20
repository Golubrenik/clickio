class LoadingManager extends BaseModule {
  constructor() {
    super();

    this.on("show", () => this.show());
  }

  async show() {
    const chat = this.getChat();
    const loading = this.getConfig().loading || {};
    const lines = Object.values(loading).filter(Boolean);
    await chat.putStreamingMessage(
      lines.map((l) => `<p>${l}</p>`),
      { wait: this.getDuration() },
    );
    return "next";
  }
}

window.LoadingManager = LoadingManager;
