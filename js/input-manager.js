class InputManager extends BaseModule {
  constructor() {
    super();
    this.container = null;
    this.currentMode = "chat"; // chat, form, question, win
    this.currentFormType = null; // personal, shipping
    this.currentFormHandler = null;
    this.currentQuestionHandler = null;
    this.currentWinHandler = null;
  }

  _config() {
    return this.getConfig().input || {};
  }

  async init() {
    try {
      this.log("info", "Initializing InputManager");

      this.container = this.findElement("#chat-input-container");
      if (!this.container) {
        throw new Error("Input container not found");
      }

      this.log("success", "InputManager initialized successfully");
      return true;
    } catch (error) {
      this.log("error", "Failed to initialize InputManager", error);
      throw error;
    }
  }

  // Switch to chat mode (normal text input)
  setChatMode() {
    if (this.currentMode === "chat") return;

    this.currentMode = "chat";
    this.currentFormType = null;
    this.currentFormHandler = null;
    this.currentQuestionHandler = null;
    this.currentWinHandler = null;

    const { buttons } = this.getConfig();
    const buttonStyle = `background: ${buttons.background}; color: ${buttons.font}; border-color: ${buttons.border};`;

    this.container.innerHTML = `
      <div class="flex-1">
        <div class="flex gap-2 items-center">
          <textarea
                 id="chat-text-input"
                 placeholder="${this._config().message}"
                 style="resize: none;"
                 rows="2"
                 class="min-w-0 w-full rounded-xl px-3 pt-2 focus:outline-none focus:ring-0"></textarea>
        </div>
      </div>
      <div class="flex">
        <button id="send-button"
                style="${buttonStyle}"
                class="size-[32px] rounded-[999px] transition-colors whitespace-nowrap disabled:hover:bg-[rgb(214,222,232)] disabled:bg-[rgb(214,222,232)] disabled:text-[#fafafa] disabled:cursor-not-allowed"
                disabled>
          <i class="fa-solid fa-arrow-up"></i>
        </button>
      </div>
    `;

    this.initializeChatListeners();
    this.log("debug", "Switched to chat mode");
  }

  // Switch to form mode (with submit button for specific form)
  setFormMode(formType, submitHandler) {
    if (this.currentMode === "form" && this.currentFormType === formType)
      return;

    this.currentMode = "form";
    this.currentFormType = formType;
    this.currentFormHandler = submitHandler;
    this.currentQuestionHandler = null;

    const buttonText = this.getSubmitButtonText(formType);
    const buttonIcon = this.getSubmitButtonIcon(formType);

    const { buttons } = this.getConfig();

    this.container.classList.add("flex-col");
    this.container.innerHTML = `
      <div class="">
        <div class="text-gray-600 pl-3">
          ${this.getFormInstructions(formType)}
        </div>
      </div>
      <div class="flex w-full">
        <button id="form-submit-button"
                style="background: ${buttons.background}; color: ${
                  buttons.font
                }; border-color: ${buttons.border};"
                class="w-full py-3 px-4 rounded-xl border transition-colors font-medium">
          <i class="${buttonIcon}"></i>
          ${buttonText}
        </button>
      </div>
    `;

    this.initializeFormListeners();
    this.log("debug", `Switched to form mode: ${formType}`);
  }

  // Switch to question mode (with quick reply buttons)
  async setQuestionMode(buttons = [], colors = {}, answerHandler = null) {
    this.currentMode = "question";
    this.currentFormType = null;
    this.currentFormHandler = null;
    this.currentQuestionHandler = answerHandler;

    const defaultColors = {
      background: "#f3f4f6",
      font: "#374151",
      border: "#d1d5db",
    };

    const buttonColors = { ...defaultColors, ...colors };

    const quickReplyHTML =
      buttons.length > 0
        ? this.generateQuickReplyHTML(buttons, buttonColors)
        : "";

    const buttonStyle = `background: ${buttonColors.background}; color: ${buttonColors.font}; border-color: ${buttonColors.border};`;

    this.container.innerHTML = `
      <div class="flex-1">
        <div class="flex gap-2 items-center">
          <textarea
                 id="chat-text-input"
                 placeholder="${this._config().answer}"
                 style="resize: none;"
                 rows="2"
                 class="min-w-0 w-full rounded-xl px-3 pt-2 focus:outline-none focus:ring-0"></textarea>
        </div>
        ${quickReplyHTML}
      </div>
      <div class="flex" style="align-self: flex-end;">
        <button id="send-button"
                style="${buttonStyle}"
                class="text-white size-[32px] rounded-[999px] transition-colors whitespace-nowrap disabled:hover:bg-[rgb(214,222,232)] disabled:bg-[rgb(214,222,232)] disabled:text-[#fafafa] disabled:cursor-not-allowed mt-auto">
          <i class="fa-solid fa-arrow-up"></i>
        </button>
      </div>
    `;

    await this.showQuickReplyButtons();

    this.initializeQuestionListeners();
    this.log(
      "debug",
      `Switched to question mode with ${buttons.length} buttons`,
    );
  }

  // Switch to win mode (with single OK/Continue button)
  setWinMode(buttonText = "OK", winHandler = null) {
    this.currentMode = "win";
    this.currentFormType = null;
    this.currentFormHandler = null;
    this.currentQuestionHandler = null;
    this.currentWinHandler = winHandler;

    const { buttons } = this.getConfig();

    this.container.innerHTML = `
      <div class="flex w-full">
        <button id="win-continue-button"
                style="background: ${buttons.background}; color: ${buttons.font}; border-color: ${buttons.border};"
                class="w-full py-3 px-4 rounded-xl border transition-colors font-medium">
          <i class="fa-solid fa-check-circle"></i>
          ${buttonText}
        </button>
      </div>
    `;

    this.initializeWinListeners();
    this.log("debug", `Switched to win mode with button: ${buttonText}`);
  }

  getSubmitButtonText(formType) {
    switch (formType) {
      case "personal":
        return this.getConfig().prefill?.buttons?.personal || "";
      case "shipping":
        return this.getConfig().prefill?.buttons?.shipping || "";
      default:
        return this.getConfig().prefill?.buttons?.default || "";
    }
  }

  getSubmitButtonIcon(formType) {
    switch (formType) {
      case "personal":
        return "fa-solid fa-user-check";
      case "shipping":
        return "fa-solid fa-truck";
      default:
        return "fa-solid fa-check";
    }
  }

  getFormInstructions(formType) {
    switch (formType) {
      case "personal":
        return this.getConfig().prefill?.placeholder?.personal || "";
      case "shipping":
        return this.getConfig().prefill?.placeholder?.shipping || "";
      default:
        return "";
    }
  }

  initializeChatListeners() {
    const textInput = this.findElement("#chat-text-input");
    const sendButton = this.findElement("#send-button");

    if (textInput && sendButton) {
      // Text input listeners
      textInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter" && !textInput.disabled) {
          this.handleChatSend();
        }
      });

      // Input event listener to manage send button state
      textInput.addEventListener("input", () => {
        this.updateSendButtonState();
      });

      // Send button listener
      sendButton.addEventListener("click", () => {
        if (!sendButton.disabled) {
          this.handleChatSend();
        }
      });

      this.updateSendButtonState();
    }

    this.log("debug", "Chat input listeners initialized");
  }

  initializeQuestionListeners() {
    const textInput = this.findElement("#chat-text-input");
    const sendButton = this.findElement("#send-button");
    const quickReplyButtons =
      this.container.querySelectorAll(".quick-reply-btn");

    if (textInput && sendButton) {
      // Text input listeners
      textInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter" && !textInput.disabled) {
          e.preventDefault();

          if (! textInput.value.trim()) return;

          this.handleQuestionAnswer(textInput.value);
        }
      });

      // Input event listener to manage send button state
      textInput.addEventListener("input", () => {
        this.updateSendButtonState();
      });

      // Send button listener
      sendButton.addEventListener("click", () => {
        if (!sendButton.disabled) {
          this.handleQuestionAnswer(textInput.value);
        }
      });

      this.updateSendButtonState();
    }

    // Quick reply button listeners
    quickReplyButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!btn.disabled) {
          this.handleQuestionAnswer(btn.textContent);
        }
      });
    });

    this.log("debug", "Question input listeners initialized");
  }

  initializeFormListeners() {
    const submitButton = this.findElement("#form-submit-button");

    if (submitButton) {
      submitButton.addEventListener("click", () => {
        this.handleFormSubmit();
      });
    }

    this.log("debug", "Form input listeners initialized");
  }

  initializeWinListeners() {
    const winButton = this.findElement("#win-continue-button");

    if (winButton) {
      winButton.addEventListener("click", () => {
        this.handleWinContinue();
      });
    }

    this.log("debug", "Win input listeners initialized");
  }

  generateQuickReplyHTML(buttons, colors) {
    const buttonsHTML = buttons
      .map(
        (button) => `
          <button
            type="button"
            class="quick-reply-btn text-sm min-h-[28px] min-w-[72px] px-2 rounded-[14px] transition-colors border"
            style="background: ${colors.background}; color: ${colors.font}; border-color: ${colors.border};">
            ${button}
          </button>
    `,
      )
      .join("");

    return `
      <div class="quick-reply-buttons mt-3 sm:mt-0">
        <div class="flex flex-wrap gap-2">
          ${buttonsHTML}
        </div>
      </div>
    `;
  }

  async showQuickReplyButtons() {
    const buttons = document.querySelector(".quick-reply-buttons");
    if (buttons) {
      await this.getWait().wait(100);
      buttons.classList.add("shown");
    }
  }

  handleChatSend() {
    const chat = this.getChat();
    if (chat?.handleSendMessage) {
      chat.handleSendMessage();
    }
  }

  handleFormSubmit() {
    if (this.currentFormHandler) {
      this.currentFormHandler();
    } else {
      this.log("warn", "No form handler set for submit");
    }
  }

  handleQuestionAnswer(answer) {
    if (this.currentQuestionHandler) {
      this.currentQuestionHandler(answer);
    } else {
      const chat = this.getChat();
      if (chat?.handleAnswer) {
        chat.handleAnswer(answer);
      }
    }
  }

  handleWinContinue() {
    if (this.currentWinHandler) {
      this.currentWinHandler();
    } else {
      this.log("warn", "No win handler set for continue");
    }
  }

  updateSendButtonState() {
    const textInput = this.findElement("#chat-text-input");
    const sendButton = this.findElement("#send-button");

    if (textInput && sendButton) {
      const hasText = textInput.value.trim().length > 0;
      sendButton.disabled = !hasText || textInput.disabled;
    }
  }

  // Enable/disable input
  enableInput() {
    if (this.currentMode === "chat" || this.currentMode === "question") {
      const textInput = this.findElement("#chat-text-input");
      const sendButton = this.findElement("#send-button");
      const quickReplyButtons =
        this.container.querySelectorAll(".quick-reply-btn");

      if (textInput) {
        textInput.disabled = false;
      }
      if (sendButton) {
        sendButton.disabled = false;
      }

      // Enable quick reply buttons
      quickReplyButtons.forEach((btn) => {
        btn.disabled = false;
        btn.removeAttribute("disabled");
      });

      this.updateSendButtonState();
    }
    // Form and win modes don't have disabled state, buttons are always available
    this.log("debug", "Input enabled");
  }

  disableInput() {
    if (this.currentMode === "chat" || this.currentMode === "question") {
      const textInput = this.findElement("#chat-text-input");
      const sendButton = this.findElement("#send-button");
      const quickReplyButtons =
        this.container.querySelectorAll(".quick-reply-btn");

      if (textInput) {
        textInput.disabled = true;
      }
      if (sendButton) {
        sendButton.disabled = true;
      }

      // Disable quick reply buttons
      quickReplyButtons.forEach((btn) => {
        btn.disabled = true;
        btn.setAttribute("disabled", "disabled");
      });
    }
    // Form and win modes are not affected by disable
    this.log("debug", "Input disabled");
  }

  destroy() {
    try {
      this.currentFormHandler = null;
      this.currentWinHandler = null;
      this.log("success", "InputManager destroyed");
    } catch (error) {
      this.log("error", "Error destroying InputManager", error);
    }
  }
}

window.InputManager = InputManager;
