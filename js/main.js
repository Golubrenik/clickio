const modules = [
  "header",
  "wait",
  "chat",
  "input",
  "welcome",
  "loading",
  "questions",
  "boxes",
  "prefill",
  "wheel",
  "redirect",
];

class MainManager {
  constructor() {
    this.flow = new FlowManager(window.ThemeFlow);
    this.configuration = window.AppConfig;

    this.modules = new Map();
  }

  async loadModules() {
    await ModuleLoader.loadScript("./js/event-emitter.js");
    await ModuleLoader.loadScript("./js/base-module.js");
    await ModuleLoader.loadScript("./js/game-manager.js");

    for (const _module of modules) {
      await ModuleLoader.loadScript(`./js/${_module}-manager.js`).then(
        () => {
          const moduleClass = `${
            String(_module).charAt(0).toUpperCase() + String(_module).slice(1)
          }Manager`;
          const module = new window[moduleClass]();
          module?.setMainManager?.(this);
          module?.init?.();
          this.modules.set(_module, module);
        },
      );
    }
  }

  getModule(module) {
    return this.modules.get(module);
  }

  async run() {
    const step = this.flow.next();
    if (step === -1) {
      // flow is empty
      return this.finalAction(); // redirect
    }

    const params = this.parseStep(step);

    if (
      params.module === "wait" &&
      params.action &&
      Number.isInteger(+params.action)
    ) {
      await this.getModule("wait").wait(params.action);
      return this.run();
    }

    if (params.module === "wait") {
      return;
    }

    const module = this.modules.get(params.module);
    if (!module) {
      debug(`There is no module ${module}`);
      return;
    }
    const response = await module.emit(params.action, params.payload);

    await this.getModule("chat").afterStep();

    if (response === "next") {
      return this.run();
    }
  }

  parseStep(step) {
    const split = step.split(":");
    return {
      module: split.at(0),
      action: split.at(1),
      payload: split.at(2),
    };
  }

  finalAction() {
    this.getModule("redirect").redirect();
  }
}
