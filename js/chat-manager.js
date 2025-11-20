class ChatManager extends BaseModule {
  constructor() {
    super();
    this.container = null;
    this.messagesContainer = null;
    this.inputContainer = null;
    this.answers = [];
    this.typingTimeout = null;
    this.dialogManager = null;
    this.gameStarted = false;

    this.on("typing", (ms) => this.typing(ms));
    this.on("clear", () => this.clear());
  }

  async typing(duration) {
    await this.showTyping(duration);
    return "next";
  }

  clear() {
    this.log("info", "Clearing chat messages");
    if (this.messagesContainer) {
      this.messagesContainer.innerHTML = "";
    }

    // Also ensure quick reply buttons are hidden when clearing chat
    this.hideQuickReplyButtons();

    return "next";
  }

  init() {
    this.config = this.mainManager.configuration;

    this.container = this.findElement("#chat-container");
    if (!this.container) {
      this.log("error", "Chat container not found");
      return false;
    }

    // Initialize UI
    this.initializeUI();

    this.isInitialized = true;
    this.log("success", "Chat module initialized successfully");
  }

  async putMessage(messageHTML) {
    this.messagesContainer.insertAdjacentHTML(
      "beforeend",
      this.replaceMacro(messageHTML),
    );

    await this.hideTyping();
  }

  async putTextMessage(message, options = {}) {
    await this.putMessage(this.messageToHTML(message, options));
  }

  messageToHTML(message, options = {}) {
    const { isHTML = false, className = "" } = options;

    return `
      <div class="flex items-start gap-1 animate-fade-in ${className}">
        <div class="w-8 h-8 bg-white shadow-[0_0_0_1px_#d5e4ff] rounded-full flex items-center justify-center flex-shrink-0">
          ${this.getBotAvatarHTML()}
        </div>
        <div class="rounded-lg p-3 pt-1 max-w-full max-sm:w-full ${
          isHTML ? "game-message" : "max-w-xs lg:max-w-md"
        }">
          ${isHTML ? message : `<p class="text-gray-800">${message}</p>`}
        </div>
      </div>
    `;
  }

  /**
   * Sends a message with streaming rendering effect (chunk-based)
   *
   * @param {string|array} messageContent - Message content or array of chunks
   * @param {object} options - Rendering options
   * @param {number} [options.speed] - Rendering speed in ms (default 300)
   * @param {boolean} [options.isHTML] - Whether message contains HTML (default true)
   * @param {string} [options.className] - Additional CSS class
   * @param {boolean} [options.halfWidth] - Whether to use half width (default false)
   * @param {array} [options.chunks] - Ready-made chunks for rendering
   * @param {number} [options.wait] - Wait between chunks in ms
   *
   * @example
   * // Simple usage
   * this.chatManager.putStreamingMessage("Hello! How are you?");
   *
   * // With HTML content
   * this.chatManager.putStreamingMessage(
   *   "<h3>Heading</h3><p>Paragraph text</p><ul><li>List item</li></ul>",
   *   { speed: 100 }
   * );
   *
   * // With ready chunks
   * this.chatManager.putStreamingMessage("", {
   *   chunks: ["Hello!", " How", " are", " you?", "\n\n", "<b>Great!</b>"],
   *   speed: 200
   * });
   */
  async putStreamingMessage(messageContent, options = {}) {
    const {
      speed = 300,
      isHTML = true,
      className = "",
      halfWidth = false,
      chunks = null,
      wait = 0,
    } = options;

    // Create chunks from content if not provided
    const responseChunks =
      chunks || this.createChunks(this.replaceMacro(messageContent));

    // Create container for streaming message
    const messageId = `streaming-msg-${Date.now()}`;
    const messageHTML = `
      <div class="flex items-start gap-1 animate-fade-in mb-4" id="${messageId}">
        <div class="w-8 h-8 bg-white shadow-[0_0_0_1px_#d5e4ff] rounded-full flex items-center justify-center flex-shrink-0">
          ${this.getBotAvatarHTML()}
        </div>
        <div class="rounded-lg p-3 pt-1 ${
          isHTML ? "game-message" : "max-w-xs lg:max-w-md"
        } ${halfWidth ? "max-w-1/2" : "max-w-full"}">
          <div class="streaming-content ${className}" style="position: relative; min-height: 20px;">
            <!-- Chunks will be added here -->
          </div>
        </div>
      </div>
    `;

    await this.putMessage(messageHTML);

    await this.showTyping(-1);
    await this.renderChunks(messageId, responseChunks, speed, wait);
    await this.hideTyping();
  }

  createChunks(content) {
    if (typeof content === "string") {
      return /<[^>]+>/.test(content)
        ? this.createHTMLChunks(content)
        : this.createTextChunks(content);
    }
    return Array.isArray(content) ? content : [content];
  }

  createTextChunks(text) {
    const chunks = [];
    const words = text.split(/(\s+)/);

    let currentChunk = "";
    for (const word of words) {
      if (word.trim() === "") {
        // Add spaces to current chunk
        currentChunk += word;
      } else {
        // If chunk becomes too long, split it
        if (currentChunk.length > 0 && (currentChunk + word).length > 30) {
          chunks.push(currentChunk);
          currentChunk = word;
        } else {
          currentChunk += word;
        }
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk);
    }

    // If only one chunk resulted, split it additionally
    if (chunks.length === 1 && chunks[0].length > 20) {
      return this.splitLongChunk(chunks[0]);
    }

    return chunks.length > 0 ? chunks : [text];
  }

  createHTMLChunks(content) {
    // Simple approach: split by common HTML block elements
    // This preserves HTML structure while creating reasonable chunks

    // First try to split by major block elements
    const blockSeparators = /(<\/(?:h[1-6]|p|div|blockquote|ul|ol)>)/gi;
    const parts = content.split(blockSeparators);

    // Recombine parts to keep opening and closing tags together
    const chunks = [];
    let currentChunk = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentChunk += part;

      // If this part is a closing tag, complete the chunk
      if (/<\/(?:h[1-6]|p|div|blockquote|ul|ol)>/i.test(part)) {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = "";
      }
    }

    // Add any remaining content
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    // If we didn't get good chunks, try sentence-based splitting while preserving HTML
    if (chunks.length <= 1) {
      return this.splitHTMLBySentences(content);
    }

    return chunks.filter((chunk) => chunk.trim() !== "");
  }

  splitHTMLBySentences(content) {
    // Split by sentences but keep HTML tags intact
    const sentences = content.split(/([.!?]+\s+)/);
    const chunks = [];
    let currentChunk = "";

    for (const sentence of sentences) {
      currentChunk += sentence;

      // If we have a sentence ending, create a chunk
      if (/[.!?]+\s*$/.test(sentence) && currentChunk.trim().length > 20) {
        chunks.push(currentChunk.trim());
        currentChunk = "";
      }
    }

    // Add any remaining content
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks.filter((chunk) => chunk.trim() !== "");
  }

  splitLongChunk(chunk) {
    const words = chunk.split(" ");
    const chunks = [];
    let currentChunk = "";

    for (const word of words) {
      if ((currentChunk + " " + word).length > 15 && currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = word;
      } else {
        currentChunk = currentChunk ? currentChunk + " " + word : word;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  async renderChunks(messageId, chunks, speed, wait) {
    const messageElement = this.findElement(`#${messageId}`);
    if (!messageElement) {
      this.log("error", `Message element not found: ${messageId}`);
      return;
    }

    const contentContainer = messageElement.querySelector(".streaming-content");
    if (!contentContainer) {
      this.log("error", "Streaming content container not found");
      return;
    }

    let currentChunkIndex = 0;

    const renderNextChunk = async () => {
      if (currentChunkIndex >= chunks.length) {
        await this.getWait().wait(100);
        const cursor = contentContainer.querySelector(".streaming-cursor");
        if (cursor) cursor.remove();
        return;
      }

      const chunk = chunks[currentChunkIndex];

      // Remove previous cursor
      const oldCursor = contentContainer.querySelector(".streaming-cursor");
      if (oldCursor) oldCursor.remove();

      // Check if chunk contains HTML or is plain text
      const containsHTML = /<[^>]+>/.test(chunk);
      const isBreak = chunk === "\n" || chunk === "\n\n";

      let rendered;

      if (isBreak) {
        const span = document.createElement("span");
        span.className = "content-chunk";
        span.innerHTML = chunk === "\n" ? "<br>" : "<br><br>";
        contentContainer.appendChild(span);
        rendered = span;
      } else if (containsHTML) {
        const hasBlockElements =
          /<(?:h[1-6]|p|div|ul|ol|li|blockquote|pre)/i.test(chunk);

        const wrapper = document.createElement(
          hasBlockElements ? "div" : "span",
        );
        wrapper.className = "content-chunk";
        wrapper.innerHTML = chunk;
        contentContainer.appendChild(wrapper);
        rendered = wrapper;
      } else {
        const span = document.createElement("span");
        span.className = "content-chunk";
        span.textContent = chunk;
        contentContainer.appendChild(span);
        rendered = span;
      }

      if (rendered) {
        await this.getWait().wait(50);
        rendered.classList.add("rendered");
      }

      if (wait) {
        await this.getWait().wait(wait);
      }

      // Add new cursor
      const cursor = document.createElement("span");
      cursor.className = "streaming-cursor";
      cursor.innerHTML = '<span style="animation: blink 1s infinite;">|</span>';
      contentContainer.appendChild(cursor);

      currentChunkIndex++;

      // Scroll to bottom
      this.scrollToBottom();

      // Render next chunk
      await this.getWait().wait(speed);
      return renderNextChunk();
    };

    // Small delay before starting rendering
    await this.getWait().wait(100);
    return renderNextChunk();
  }

  async putUserMessage(message) {
    const messageHTML = `
      <div class="flex items-start gap-3 justify-end animate-fade-in">
        <div class="bg-[#eff6ff] text-gray-800 rounded-[14px] px-[20px] py-[8px] max-w-xs break-words lg:max-w-md">
          <p>${message}</p>
        </div>
      </div>
    `;

    await this.putMessage(messageHTML);
  }

  setDialogManager(dialogManager) {
    this.dialogManager = dialogManager;
  }

  initializeUI() {
    const config = this.getConfig().input || {};

    this.container.innerHTML = `
      <div class="chat-module bg-white h-full flex flex-col">
        <!-- Chat Header -->

        <!-- Messages Container -->
        <div id="chat-messages" class="chat-messages p-4 flex-1 overflow-y-auto space-y-4 min-h-0">
          <!-- Messages will be added here dynamically -->
        </div>

        <!-- Typing Indicator -->
        <div id="typing-indicator" class="typing-indicator px-4 pb-4 flex-shrink-0" style="display: none;">
          <div class="flex items-center gap-2 text-gray-500">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                ${this.getBotAvatarHTML()}
              </div>
              <div class="typing-dots">
                <span>${config.typing || "is typing"}</span>
                <span class="dot">.</span>
                <span class="dot">.</span>
                <span class="dot">.</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Input Container -->
        <div id="chat-input-container" class="chat-input bg-[rgb(243,244,246)] shadow-[0_0_0_0.5px_#dce0e9] p-4 flex-shrink-0 rounded-3xl flex items-center gap-2">
          <div class="flex-1">
           <!-- Text Input Area -->
          <div class="flex gap-2 items-center">
            <input type="text"
                   id="chat-text-input"
                   placeholder="${config.input || "Type your message..."}"
                   class="flex-1 min-w-0 rounded-xl px-3 py-2 focus:outline-none focus:ring-0"
                   disabled>
          </div>
          <!-- Quick Reply Buttons (hidden initially) -->
           <div id="quick-reply-buttons" class="quick-reply-buttons mt-4" style="display: none;"></div>
          </div>
          <div class="flex">
          <button id="send-button"
                    class="bg-blue-500 hover:bg-blue-600 text-white size-[32px] rounded-[999px] transition-colors whitespace-nowrap disabled:hover:bg-[rgb(214,222,232)] disabled:bg-[rgb(214,222,232)] disabled:text-[#fafafa] disabled:cursor-not-allowed"
                    disabled>
              <i class="fa-solid fa-arrow-up"></i>
            </button>
          </div>
        </div>
      </div>
    `;

    this.messagesContainer = this.findElement("#chat-messages");
    this.inputContainer = this.findElement("#chat-input-container");

    this.initializeInputListeners();

    // Ensure quick reply buttons are properly hidden and disabled initially
    this.hideQuickReplyButtons();
    this.disableChatInput();

    this.log("log", "Chat UI initialized");
  }

  initializeInputListeners() {
    const textInput = this.findElement("#chat-text-input");
    const sendButton = this.findElement("#send-button");

    if (textInput && sendButton) {
      // Text input listeners
      textInput.addEventListener("keypress", async (e) => {
        if (e.key === "Enter" && !textInput.disabled) {
          await this.handleSendMessage();
        }
      });

      // Input event listener to manage send button state
      textInput.addEventListener("input", () => {
        this.updateSendButtonState();
      });

      // Send button listener
      sendButton.addEventListener("click", async () => {
        if (!sendButton.disabled) {
          await this.handleSendMessage();
        }
      });

      // Initialize send button state
      this.updateSendButtonState();
    }

    this.log("debug", "Input event listeners initialized");
  }

  updateSendButtonState() {
    const textInput = this.findElement("#chat-text-input");
    const sendButton = this.findElement("#send-button");

    if (!textInput || !sendButton) return;

    const hasText = textInput.value.trim().length > 0;
    const isInputEnabled = !textInput.disabled;

    // Enable send button only if there's text and input is enabled
    if (hasText && isInputEnabled) {
      sendButton.disabled = false;
      sendButton.removeAttribute("disabled");
    } else {
      sendButton.disabled = true;
      sendButton.setAttribute("disabled", "disabled");
    }
  }

  async handleSendMessage() {
    const textInput = this.findElement("#chat-text-input");
    if (!textInput || !textInput.value.trim()) return;

    const message = textInput.value.trim();
    textInput.value = "";

    // Update send button state after clearing input
    this.updateSendButtonState();

    await this.handleAnswer(message);
  }

  async handleAnswer(answer) {
    const questions = this.get("questions");

    if (!questions.isWaitingForAnswer) return;

    questions.isWaitingForAnswer = false;

    const currentQuestion = questions.getCurrentQuestion();
    const currentQuestionIndex = questions.getCurrentQuestionIndex();
    questions.increment();

    // Store answer
    const questionData = {
      questionId: currentQuestion.id,
      questionIndex: currentQuestionIndex,
      question: currentQuestion.question,
      answer: answer,
      timestamp: new Date().toISOString(),
    };

    this.answers.push(questionData);

    // Show user message
    await this.putUserMessage(answer);

    // Disable input during processing
    this.disableChatInput();

    await this.getWait().wait();

    questions.show();

    this.log("log", `Answer recorded: ${answer}`);
  }

  hideQuickReplyButtons() {
    const quickReplyContainer = this.findElement("#quick-reply-buttons");
    const sendButton = this.findElement("#send-button");
    const chatInputContainer = this.findElement("#chat-input-container");

    if (quickReplyContainer) {
      quickReplyContainer.innerHTML = "";
      quickReplyContainer.style.display = "none";
    }
    // Remove mt-auto from send button when quick reply buttons are hidden
    if (sendButton) {
      sendButton.classList.remove("mt-auto");
    }
    // Restore items-center to chat input container for normal layout
    if (chatInputContainer) {
      chatInputContainer.classList.add("items-center");
    }
    this.log("debug", "Quick reply buttons hidden");
  }

  async completeChat() {
    // Disable all input and hide quick reply buttons permanently
    this.disableChatInput();
    this.hideQuickReplyButtons();

    return this.mainManager.run();
  }

  getBotAvatarHTML() {
    const config = this.getConfig();
    const botConfig = config?.bot || {};

    let padding = botConfig.padding ?? true;
    let botImage = "./images/logo/header-logo.png";

    if (botConfig.product) {
      padding = false;
      const productConfig = config.product || {};
      const productImage = productConfig.image || "";
      if (productImage) {
        botImage = productImage;
      }
    }

    return `<img
        src="${botImage}"
        alt="Product"
        class="w-full h-full object-cover rounded-full ${padding ? "p-2" : ""}"
        />`;
  }

  async showTyping(durationOrParams = this.getDuration()) {
    let duration = this.getDuration();

    if (typeof durationOrParams === "object") {
      duration = durationOrParams.duration || this.getDuration();
    } else if (
      typeof durationOrParams === "number" ||
      typeof durationOrParams === "string"
    ) {
      duration = durationOrParams;
    }

    const typingIndicator = this.findElement("#typing-indicator", false);
    if (typingIndicator) {
      typingIndicator.style.display = "block";
      this.scrollToBottom();

      if (duration < 0) {
        return;
      }

      return new Promise((resolve) => {
        setTimeout(() => {
          typingIndicator.style.display = "none";
          resolve();
        }, duration);
      });
    }
  }

  async hideTyping() {
    const typingIndicator = this.findElement("#typing-indicator", false);
    if (typingIndicator) {
      typingIndicator.style.display = "none";
    }
  }

  async scrollToBottom() {
    if (this.messagesContainer) {
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
      await this.getWait().wait(100);
    }
  }

  disableChatInput() {
    const inputField = this.inputContainer.querySelector("textarea");
    const sendButton = this.inputContainer.querySelector("#send-button");
    const answerButtons =
      this.inputContainer.querySelectorAll(".answer-button");
    const quickReplyContainer = this.findElement("#quick-reply-buttons");

    if (inputField) {
      inputField.disabled = true;
      inputField.placeholder =
        this.getConfig().input?.processing || "Processing...";
    }

    if (sendButton) {
      sendButton.disabled = true;
    }

    // Disable answer buttons
    answerButtons.forEach((button) => {
      button.disabled = true;
    });

    // Disable all quick reply buttons
    if (quickReplyContainer) {
      const quickReplyButtons =
        quickReplyContainer.querySelectorAll(".quick-reply-btn");
      quickReplyButtons.forEach((btn) => {
        btn.disabled = true;
        btn.setAttribute("disabled", "disabled");
      });
    }

    // Update send button state based on input content
    this.updateSendButtonState();

    this.log("debug", "Chat input disabled");
  }

  setGameInputState(isGame) {
    const inputField = this.inputContainer.querySelector("textarea");
    const sendButton = this.inputContainer.querySelector("#send-button");
    if (isGame) {
      if (inputField) {
        inputField.disabled = true;
        inputField.placeholder = "";
      }
      if (sendButton) sendButton.disabled = true;
    } else {
      if (inputField) {
        inputField.disabled = false;
        inputField.placeholder =
          this.getConfig().input?.message || "Type your message...";
      }
      if (sendButton) sendButton.disabled = false;
    }

    const quickReplyContainer = this.findElement("#quick-reply-buttons");
    if (quickReplyContainer) {
      const quickReplyBtns =
        quickReplyContainer.querySelectorAll(".quick-reply-btn");
      quickReplyBtns.forEach((btn) => {
        btn.disabled = isGame;
        if (isGame) btn.setAttribute("disabled", "disabled");
        else btn.removeAttribute("disabled");
      });
    }
    this.updateSendButtonState();
  }

  destroy() {
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }

    // Game managers are now handled independently
    this.answers = [];
    this.gameStarted = false;

    if (this.container) {
      this.container.innerHTML = "";
    }

    super.destroy();
  }
}

window.ChatManager = ChatManager;
