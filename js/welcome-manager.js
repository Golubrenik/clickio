class WelcomeManager extends BaseModule {
  constructor() {
    super();

    this.on("show", () => this.show());
  }

  _config() {
    return this.getConfig().welcome || {};
  }

  async show() {
    const chat = this.getChat();

    const welcomeHTML = this.renderWelcomeMessage();

    await chat.putStreamingMessage(welcomeHTML, {
      isHTML: true,
      halfWidth: false,
    });

    return "next";
  }

  renderWelcomeMessage() {
    const productConfig = this.getConfig().product || {};
    const productName = productConfig.name;
    const productImage = "./images/product/product.png";
    const title = this._config().title || "";
    const subtitle = this._config().subtitle || "";
    const description = this._config().description || "";
    const attention = this._config().attention || "";

    return `
      <div class="welcome-message-container">
        <h1 class="text-2xl font-bold text-gray-900 mb-4 mt-0 [&>strong]:font-bold">${title}</h1>

        <p class="text-gray-700 leading-relaxed mb-4">
          ${subtitle}
        </p>

        <div class="flex justify-center mb-6 py-4">
          <img src="${productImage}" alt="${productName}" class="max-w-full h-auto object-contain" style="max-height: 200px;">
        </div>

        <p class="text-gray-700 leading-relaxed mb-4">
          ${description}
        </p>

        <p class="text-gray-700 leading-relaxed mb-4">
          ${attention}
        </p>
      </div>
    `;
  }
}

window.WelcomeManager = WelcomeManager;
