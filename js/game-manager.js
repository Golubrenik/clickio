class BaseGameModule extends BaseModule {
  constructor() {
    super();
    this.container = null;
    this.chatManager = null;
    this.game = "";

    this.on("welcome", () => this.welcome());
    this.on("tryAgain", () => this.showTryAgainMessage());
    this.on("win", () => this.showWinMessage());
    this.on("show", () => this.show());
  }

  async welcome() {
    try {
      this.log("info", `Showing ${this.game} game welcome message`);

      const chat = this.getChat();
      if (!chat) {
        throw new Error("ChatManager not available");
      }

      // Show welcome message
      const config = this.getConfig();

      // Modal is inside game object: config.game.modal.welcome
      const welcomeText = config.game?.modal?.welcome;
      this.log("debug", "Welcome text found:", !!welcomeText);

      if (welcomeText) {
        // Ensure typing and message work regardless of game state
        try {
          await chat.putStreamingMessage(welcomeText);
          this.log("debug", "Welcome message sent to chat successfully");
        } catch (msgError) {
          this.log("error", "Failed to send welcome message to chat", msgError);
          throw msgError;
        }
      } else {
        this.log("warn", "No welcome text found in game.modal.welcome config");
      }

      this.log("success", `${this.game} welcome message shown`);
      return "next";
    } catch (error) {
      this.log("error", `Failed to show ${this.game} welcome`, error);
      throw error;
    }
  }

  async show() {
    try {
      this.log("info", `Showing ${this.game} game`);

      this.chatManager = this.getChat();

      if (!this.chatManager) {
        throw new Error("ChatManager not available");
      }

      // Build game configuration from app config
      const appConfig = this.getConfig();
      const config = this.buildGameConfig(appConfig);

      // Create game without welcome message (welcome is now separate step)
      await this.createGame(config, this.chatManager, null);

      this.log("success", `${this.game} game shown successfully`);
      return "next";
    } catch (error) {
      this.log("error", `Failed to show ${this.game} game`, error);
      throw error;
    }
  }

  buildGameConfig(appConfig) {
    if (this.game === "boxes") {
      return {
        boxes: {
          enabled: true,
          boxCount: 12,
          images: {
            front: appConfig.boxes?.front || "./images/boxes/front.png",
            inside: appConfig.boxes?.inside || "./images/boxes/inside.png",
            lid: appConfig.boxes?.lid || "./images/boxes/lid.png",
            product: appConfig.product?.image || "./images/product/product.png",
          },
          attempts: appConfig.game?.attempts || 3,
          winProbability: appConfig.game?.winProbability || 0.7,
        },
      };
    }

    if (this.game === "wheel") {
      return {
        wheel: {
          enabled: true,
          spinDuration: 5,
          images: {
            border: appConfig.wheel?.border || "./images/wheel/border.png",
            center: appConfig.wheel?.center || "./images/wheel/center.png",
            pointer: appConfig.wheel?.pointer || "./images/wheel/pointer.png",
            lose: appConfig.wheel?.lose || "./images/wheel/lose.png",
            retry: appConfig.wheel?.retry || "./images/wheel/retry.png",
            win: appConfig.product?.image || "./images/product/product.png",
          },
          attempts: appConfig.game?.attempts || 3,
          winProbability: appConfig.game?.winProbability || 0.7,
          sectors: [
            {
              type: "win",
              backgroundColor: appConfig.wheel?.colors?.win || "#10b981",
            },
            { type: "retry", backgroundColor: "#f3f4f6" },
            { type: "lose", backgroundColor: "#9ca3af" },
            { type: "retry", backgroundColor: "#f3f4f6" },
            {
              type: "win",
              backgroundColor: appConfig.wheel?.colors?.win || "#10b981",
            },
            { type: "retry", backgroundColor: "#f3f4f6" },
            { type: "lose", backgroundColor: "#9ca3af" },
            { type: "retry", backgroundColor: "#f3f4f6" },
          ],
        },
      };
    }

    return {};
  }

  validateConfig(config) {
    if (!super.validateConfig(config)) {
      return false;
    }

    // Check if game config exists
    if (!config[this.game]) {
      this.log("error", `${this.game} configuration missing`);
      return false;
    }

    return true;
  }

  async createGame(config, chatManager) {
    try {
      this.log("info", `Creating ${this.game} game with config`, config);

      // Store references
      this.chatManager = chatManager;

      // Validate configuration using parent method
      if (!this.validateConfig(config)) {
        throw new Error(`Invalid ${this.game} configuration`);
      }

      this.config = config[this.game];

      await this.createGameContainer();

      // Apply config defaults
      this.applyDefaults();

      this.generateHTML();
      this.initialize();
      this.isInitialized = true;

      // Set game input state (welcome message is now handled separately)
      if (this.chatManager.setGameInputState)
        this.chatManager.setGameInputState(true);

      this.log("success", `Chat ${this.game} game initialized`);
      return true;
    } catch (error) {
      this.log("error", `Chat ${this.game} game initialization failed`, error);
      throw error;
    }
  }

  async createGameContainer() {
    const chat = this.getChat();

    const gameHTML = `
      <div id="${this.game}-game-container" class="${this.game}-game-container">
        <div id="chat-${this.game}-container" class="${this.game}-container">
          <!-- Game will be generated here -->
        </div>
      </div>
    `;

    // Add as bot message with custom HTML
    const messageHTML = `
      <div class="flex items-start gap-1 animate-fade-in">
        <div class="w-8 h-8 bg-white shadow-[0_0_0_1px_#d5e4ff] rounded-full flex items-center justify-center flex-shrink-0">
          ${chat.getBotAvatarHTML()}
        </div>
        <div class="rounded-lg p-3 pt-1 max-w-full">
          ${gameHTML}
        </div>
      </div>
    `;

    await chat.showTyping(-1);
    await chat.putMessage(messageHTML);
    await chat.hideTyping();

    // Get reference to the game container
    this.container = document.querySelector(`#chat-${this.game}-container`);

    if (!this.container) {
      throw new Error(`Failed to create ${this.game} container in chat`);
    }
  }

  async showTryAgainMessage() {
    this.log("info", "Showing try again message in chat");
    const chat = this.getChat();
    const config = this.getConfig();
    const tryAgainText = config.game?.modal?.tryAgain || "Try again!";
    await chat.putStreamingMessage(tryAgainText);
  }

  async showWinMessage() {
    this.log("success", "Showing win message in chat with confetti");
    this.triggerWinConfetti();
    setTimeout(async () => {
      const chat = this.getChat();
      const input = this.getInput();

      const config = this.getConfig();
      const winText = config.game?.modal?.win;
      const btnText = "OK";

      // Show win message without button in HTML
      await chat.putStreamingMessage(winText, { isHTML: true });

      // Use input manager to show the OK button
      if (input) {
        input.setWinMode(btnText, () => this.handleWinComplete());
      }
    }, this.getDuration());
  }

  handleWinComplete() {
    this.log(
      "success",
      "Game win completed, launching prefill or make redirect",
    );

    return this.mainManager.run();
  }
}

window.BaseGameModule = BaseGameModule;
