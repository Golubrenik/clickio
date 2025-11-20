class BaseModule extends EventEmitter {
  constructor() {
    super();
    this.mainManager = null;
    this.config = null;
    this.isInitialized = false;
    this.actionManager = null;
    this.appManager = null;
    this.moduleName = this.constructor.name
      .replace("Manager", "")
      .toLowerCase();

    this._timeout = 300;
  }

  get(moduleName) {
    return this.mainManager.getModule(moduleName);
  }

  getChat() {
    return this.get("chat");
  }

  getInput() {
    return this.get("input");
  }

  getWait() {
    return this.get("wait");
  }

  getConfig() {
    return this.mainManager.configuration;
  }

  setMainManager(mainManager) {
    this.mainManager = mainManager;
  }

  getDuration() {
    return this.getConfig().sleep || this._timeout;
  }

  async afterStep() {
    await this.getChat().hideTyping();
    await this.getChat().scrollToBottom();
  }

  create(_config) {
    throw new Error(
      `create() method must be implemented by ${this.constructor.name}`,
    );
  }

  validateConfig(config) {
    if (!config) {
      debug(`❌ Configuration is required for ${this.constructor.name}`);
      return false;
    }

    // Check if module is enabled (if enabled property exists)
    const moduleConfig = config[this.moduleName];
    if (
      moduleConfig &&
      Object.hasOwn(moduleConfig, "enabled") &&
      !moduleConfig.enabled
    ) {
      debug(`⚠️ Module ${this.constructor.name} is disabled`);
      return false;
    }

    return true;
  }

  async executeAction(actionConfig, context = {}) {
    if (!this.actionManager) {
      debug(`⚠️ ActionManager not available in ${this.constructor.name}`);
      return;
    }

    // Add module context
    const enrichedContext = {
      ...context,
      sourceModule: this.constructor.name,
      moduleName: this.moduleName,
    };

    return this.actionManager.executeAction(actionConfig, enrichedContext);
  }

  findElement(selector, required = true) {
    const element = document.querySelector(selector);

    if (!element && required) {
      debug(
        `❌ Required element not found: ${selector} in ${this.constructor.name}`,
      );
      return null;
    }

    return element;
  }

  hideElement(elementOrSelector, animate = true) {
    const element =
      typeof elementOrSelector === "string"
        ? document.querySelector(elementOrSelector)
        : elementOrSelector;

    if (!element) return;

    if (animate) {
      element.style.transition = "opacity 0.3s ease-in-out";
      element.style.opacity = "0";
      setTimeout(() => {
        element.style.display = "none";
      }, 300);
    } else {
      element.style.display = "none";
      element.style.opacity = "";
      element.style.transition = "";
    }
  }

  showElement(elementOrSelector, animate = true) {
    const element =
      typeof elementOrSelector === "string"
        ? document.querySelector(elementOrSelector)
        : elementOrSelector;

    if (!element) return;

    if (animate) {
      element.style.transition = "opacity 0.3s ease-in-out";
      element.style.opacity = "0";
      element.style.display = "block";

      requestAnimationFrame(() => {
        element.style.opacity = "1";
      });
    } else {
      element.style.display = "block";
      element.style.opacity = "1";
    }
  }

  destroy() {
    this.config = null;
    this.isInitialized = false;
    this.actionManager = null;
    this.appManager = null;

    debug(`🧹 ${this.constructor.name} destroyed`);
  }

  log(level, message, data = null) {
    const prefix = `[${this.constructor.name}]`;

    switch (level) {
      case "error":
        debug(`❌ ${prefix} ${message}`, data);
        break;
      case "warn":
        debug(`⚠️ ${prefix} ${message}`, data);
        break;
      case "success":
        debug(`✅ ${prefix} ${message}`, data);
        break;
      default:
        debug(`🔸 ${prefix} ${message}`, data);
    }
  }

  replaceMacro(text) {
    const isString = typeof text === "string";
    const replaced = (Array.isArray(text) ? text : [text]).map((text) => {
      return text
        .replaceAll(
          "{product}",
          `<strong>${this.getConfig().product.name}</strong>`,
        )
        .replaceAll(
          "{brand}",
          `<strong>${this.getConfig().brand.name}</strong>`,
        )
        .replaceAll(
          "{old-price}",
          `<span class="text-gray-400 line-through">${
            this.getConfig().price.old
          }</span>`,
        )
        .replaceAll("{old-price-value}", this.getConfig().price.old)
        .replaceAll(
          "{price}",
          `<span class="font-bold" style="color: ${
            this.getConfig().price.color
          };">${this.getConfig().price.new}</span>`,
        )
        .replaceAll("{price-value}", this.getConfig().price.new);
    });

    if (isString) {
      return replaced.at(0);
    }

    return text;
  }
}

window.BaseModule = BaseModule;
