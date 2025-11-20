class QuestionsManager extends BaseModule {
  constructor() {
    super();
    this.currentQuestionIndex = 0;
    this.currentQuestion = null;
    this.isWaitingForAnswer = false;

    this.on("show", () => this.show());
  }

  increment() {
    this.currentQuestionIndex += 1;
  }

  getCurrentQuestionIndex() {
    return this.currentQuestionIndex;
  }

  getCurrentQuestion() {
    return this.currentQuestion;
  }

  async show() {
    const chat = this.getChat();
    const input = this.getInput();

    if (this.currentQuestionIndex >= this.getConfig().questions.length) {
      chat.completeChat();
      if (input) {
        input.setChatMode();
      }
      return;
    }

    const question = this.getConfig().questions[this.currentQuestionIndex];
    this.currentQuestion = question;

    await chat.putStreamingMessage(question.question);

    if (input) {
      input.enableInput();
      await input.setQuestionMode(
        question.buttons || [],
        this.getConfig().buttons,
        (answer) => this.handleAnswer(answer),
      );
    }

    this.isWaitingForAnswer = true;
    return "wait";
  }

  async handleAnswer(answer) {
    try {
      this.log("info", `Question answered: ${answer}`);

      const chat = this.getChat();
      const input = this.getInput();

      await input.setQuestionMode([]);

      await chat.putUserMessage(answer);

      if (input) {
        input.disableInput();
      } else {
        chat.disableChatInput();
      }

      this.isWaitingForAnswer = false;
      this.increment();

      await this.show();
    } catch (error) {
      this.log("error", "Failed to handle question answer", error);
    }
  }
}

window.QuestionsManager = QuestionsManager;
