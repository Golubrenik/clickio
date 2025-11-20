class BoxesManager extends BaseGameModule {
  constructor() {
    super();
    this.game = "boxes";

    this.isWin = false;
    this.clickCount = 0;
    this.maxClicks = 2;
  }

  async validateConfig(config) {
    // Call parent validation first
    if (!super.validateConfig(config)) {
      return false;
    }

    // Boxes-specific validation
    if (!config.boxes) {
      this.log("error", "Boxes configuration missing boxes property");
      return false;
    }

    const boxesConfig = config.boxes;

    if (typeof boxesConfig.enabled !== "boolean") {
      this.log("error", "Boxes enabled property is required (boolean)");
      return false;
    }

    if (!boxesConfig.enabled) {
      this.log("info", "Boxes game is disabled");
      return true; // Valid but disabled
    }

    // Validate box count
    if (boxesConfig.boxCount && typeof boxesConfig.boxCount !== "number") {
      this.log("error", "boxCount must be a number");
      return false;
    }

    if (
      boxesConfig.boxCount &&
      (boxesConfig.boxCount < 3 || boxesConfig.boxCount > 20)
    ) {
      this.log("error", "boxCount must be between 3 and 20");
      return false;
    }

    // Validate images if provided
    if (boxesConfig.images && typeof boxesConfig.images !== "object") {
      this.log("error", "images must be an object");
      return false;
    }

    return true;
  }

  applyDefaults() {
    // Set defaults
    this.config.boxCount = this.config.boxCount || 12;

    this.log("debug", "Applied default configuration values");
  }

  generateHTML() {
    this.container.innerHTML = `
      <div class="boxes-game-container flex flex-col items-center justify-center max-w-6xl mx-auto">
        <div class="game-boxes grid grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-6 max-w-4xl">
          ${Array.from(
            { length: this.config.boxCount },
            (_, i) => `
            <div class="game-box relative cursor-pointer transform transition-all duration-200 hover:scale-105 w-24 h-24 md:w-28 md:h-28 lg:w-32 lg:h-32" data-box-index="${i}">
              <div class="game-box-container relative w-full h-full">
                <!-- Box Front -->
                <div class="game-box-front absolute inset-0 z-30 transition-all duration-500">
                  <img src="${this.config.images.front}" alt="Box" class="w-full h-full object-contain">
                </div>

                <!-- Box Lid -->
                <div class="game-box-lid absolute inset-0 z-20 transition-all duration-1000 transform origin-center" style="transform-style: preserve-3d;">
                  <img src="${this.config.images.lid}" alt="Box Lid" class="w-full h-full object-contain">
                </div>

                <!-- Box Inside -->
                <div class="game-box-inside absolute inset-0 z-10">
                  <img src="${this.config.images.inside}" alt="Box Inside" class="w-full h-full object-contain">
                </div>

                <!-- Product (hidden initially) -->
                <div class="game-box-product absolute inset-0 z-40 opacity-0 transition-all duration-500 flex items-center justify-center">
                  <img src="${this.config.images.product}" alt="Prize" class="w-2/3 h-2/3 object-contain">
                </div>
              </div>
            </div>
          `,
          ).join("")}
        </div>
      </div>
    `;
    this.log("debug", "Boxes HTML structure generated");
  }

  initialize() {
    if (!this.container) {
      this.log("error", "Container not available for initialization");
      return;
    }

    // Add click event listeners to boxes
    const boxes = this.container.querySelectorAll(".game-box");
    boxes.forEach((box) => {
      box.addEventListener("click", (e) => this.handleBoxClick(e));
    });

    this.log("success", "Boxes game initialized and ready to play");
  }

  handleBoxClick(e) {
    const box = e.currentTarget;

    if (box.classList.contains("is-disabled")) {
      this.log("debug", "Box click ignored - box is disabled");
      return;
    }

    // Disable this box
    box.classList.add("is-disabled");
    this.clickCount++;

    this.log(
      "info",
      `Box clicked (click ${this.clickCount}/${this.maxClicks})`,
    );

    // Open the box with animation
    this.openBox(box);

    if (this.isWin) {
      // Disable all boxes
      const allBoxes = this.container.querySelectorAll(".game-box");
      allBoxes.forEach((b) => {
        b.classList.add("is-disabled");
      });

      box.classList.add("is-box-won");
      setTimeout(() => this.showWinMessage(), this.getDuration());
    } else {
      this.isWin = true; // Next click will be win
      box.classList.add("is-box-opened");
      setTimeout(() => this.showTryAgainMessage(), this.getDuration());
    }
  }

  openBox(box) {
    const lid = box.querySelector(".game-box-lid");
    const front = box.querySelector(".game-box-front");
    const inside = box.querySelector(".game-box-inside");
    const product = box.querySelector(".game-box-product");

    // Random direction for lid flying away
    const randomX = (Math.random() - 0.5) * 200; // -100px to 100px
    const randomRotate = (Math.random() - 0.5) * 180; // -90deg to 90deg

    // Animate lid flying away (up and to random side)
    lid.style.transform = `translateY(-120px) translateX(${randomX}px) rotateZ(${randomRotate}deg) scale(0.6)`;
    lid.style.opacity = "0";
    lid.style.transformOrigin = "center";

    // Hide lid completely after animation
    setTimeout(() => {
      lid.style.display = "none";
    }, 1000);

    // Show product if this is a winning box
    if (this.isWin && this.clickCount === 2) {
      setTimeout(() => {
        // Hide box parts when showing prize
        front.style.opacity = "0";
        inside.style.opacity = "0";

        // Show and animate the prize
        product.style.opacity = "1";
        product.style.transform = "translateY(-10px) scale(1.05)"; // Lift up and slightly scale
      }, 600);
    }

    this.log("debug", "Box opened with animation");
  }

  triggerWinConfetti() {
    // Find the winning box
    const winningBox = this.findElement(".game-box.is-box-won");

    if (!winningBox) {
      this.log("warn", "No winning box found for confetti");
      return;
    }

    // Trigger confetti if available (from Canvas Confetti library)
    if (window.confetti) {
      const boxRect = winningBox.getBoundingClientRect();
      const originX = (boxRect.left + boxRect.width / 2) / window.innerWidth;
      const originY = (boxRect.top + boxRect.height / 2) / window.innerHeight;

      this.log("debug", "Triggering confetti from winning box");

      // Multiple confetti bursts for better effect
      window.confetti({
        particleCount: 100,
        spread: 70,
        origin: { x: originX, y: originY },
        colors: ["#4ade80", "#22c55e", "#16a34a", "#15803d", "#166534"],
      });

      // Second burst with different timing
      setTimeout(() => {
        window.confetti({
          particleCount: 80,
          spread: 90,
          origin: { x: originX, y: originY },
          colors: ["#fbbf24", "#f59e0b", "#d97706", "#b45309", "#92400e"],
        });
      }, 300);

      // Third burst for extra celebration
      setTimeout(() => {
        window.confetti({
          particleCount: 60,
          spread: 50,
          origin: { x: originX, y: originY },
          colors: ["#f472b6", "#ec4899", "#db2777", "#be185d", "#9d174d"],
        });
      }, 600);
    } else {
      this.log("warn", "Canvas Confetti library not available");
    }
  }

  reset() {
    this.isWin = false;
    this.clickCount = 0;

    const boxes = this.container?.querySelectorAll(".game-box") || [];
    boxes.forEach((box) => {
      box.classList.remove("is-disabled", "is-box-opened", "is-box-won");

      // Reset animations
      const lid = box.querySelector(".game-box-lid");
      const front = box.querySelector(".game-box-front");
      const inside = box.querySelector(".game-box-inside");
      const product = box.querySelector(".game-box-product");

      if (lid) {
        lid.style.transform =
          "translateY(0) translateX(0) rotateZ(0deg) scale(1)";
        lid.style.opacity = "1";
        lid.style.display = "block";
        lid.style.transformOrigin = "center";
      }
      if (front) {
        front.style.opacity = "1";
      }
      if (inside) {
        inside.style.opacity = "1";
      }
      if (product) {
        product.style.opacity = "0";
        product.style.transform = "translateY(0) scale(1)";
      }
    });

    this.log("info", "Boxes game reset to initial state");
  }

  destroy() {
    try {
      this.log("info", "Destroying boxes game...");

      if (this.container) {
        this.container.innerHTML = "";
      }

      this.isWin = false;
      this.clickCount = 0;
      this.container = null;

      super.destroy();

      this.log("success", "Boxes game destroyed");
    } catch (error) {
      this.log("error", "Error destroying boxes game", error);
    }
  }
}

window.BoxesManager = BoxesManager;
