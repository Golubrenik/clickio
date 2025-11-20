class WheelManager extends BaseGameModule {
  constructor() {
    super();
    this.game = "wheel";

    this.wheel = null;
    this.currentRotation = 0;
    this.isSpinning = false;
    this.sectorAngle = 45; // 360 / 8 sectors
    this.spinCount = 0;
    this.maxSpins = 2;
  }

  applyDefaults() {
    // Set defaults
    this.config.spinDuration = this.config.spinDuration || 5;
    this.config.sectors = this.config.sectors || [
      { type: "win", backgroundColor: "#10b981" },
      { type: "retry", backgroundColor: "#f3f4f6" },
      { type: "lose", backgroundColor: "#9ca3af" },
      { type: "retry", backgroundColor: "#f3f4f6" },
      { type: "win", backgroundColor: "#10b981" },
      { type: "retry", backgroundColor: "#f3f4f6" },
      { type: "lose", backgroundColor: "#9ca3af" },
      { type: "retry", backgroundColor: "#f3f4f6" },
    ];

    this.log("debug", "Applied default configuration values");
  }

  async validateConfig(config) {
    // Call parent validation first
    if (!super.validateConfig(config)) {
      return false;
    }

    // Wheel-specific validation
    if (!config.wheel) {
      this.log("error", "Wheel configuration missing wheel property");
      return false;
    }

    const wheelConfig = config.wheel;

    if (typeof wheelConfig.enabled !== "boolean") {
      this.log("error", "Wheel enabled property is required (boolean)");
      return false;
    }

    if (!wheelConfig.enabled) {
      this.log("info", "Wheel is disabled");
      return true; // Valid but disabled
    }

    if (
      typeof wheelConfig.spinDuration !== "number" ||
      wheelConfig.spinDuration <= 0
    ) {
      this.log("error", "Wheel spinDuration must be a positive number");
      return false;
    }

    if (!wheelConfig.sectors || !Array.isArray(wheelConfig.sectors)) {
      this.log("error", "Wheel sectors array is required");
      return false;
    }

    if (wheelConfig.sectors.length !== 8) {
      this.log("error", "Wheel must have exactly 8 sectors");
      return false;
    }

    // Validate each sector
    for (const [index, sector] of wheelConfig.sectors.entries()) {
      if (!sector.type || !["win", "retry", "lose"].includes(sector.type)) {
        this.log(
          "error",
          `Sector ${index} must have type: win, retry, or lose`,
        );
        return false;
      }
    }

    return true;
  }

  generateHTML() {
    const { sectors, images } = this.config;

    this.container.innerHTML = `
      <div class="wheel-wrapper">
        <div id="wheel" class="wheel">
          ${sectors
            .map(
              (sector, index) => `
            <div
              class="sector sector-${index} ${sector.type}"
              style="background-color: ${
                sector.backgroundColor ||
                this.getDefaultSectorColor(sector.type)
              };"
            >
              <div class="sector-content">
                <img
                  src="${
                    sector.image || this.getDefaultSectorImage(sector.type)
                  }"
                  alt="${sector.type}"
                  class="sector-icon"
                />
              </div>
            </div>
          `,
            )
            .join("")}
        </div>

        ${
          images?.border
            ? `
          <div class="wheel-border">
            <img src="${images.border}" alt="border"/>
          </div>
        `
            : ""
        }

        <div class="wheel-center">
          ${
            images?.pointer
              ? `
            <img
              id="wheel-center-pointer"
              src="${images.pointer}"
              alt="pointer"
            />
          `
              : ""
          }

          ${
            images?.center
              ? `
            <img
              id="wheel-center-center"
              src="${images.center}"
              alt="center"
            />
          `
              : ""
          }
        </div>

        <div id="wheel-center-product">
          ${
            images?.product
              ? `
            <img
              src="${images.product}"
              alt="product"
            />
          `
              : ""
          }
        </div>
      </div>
    `;

    this.log("debug", "Wheel HTML structure generated");
  }

  getDefaultSectorColor(type) {
    const colors = {
      win: "#4ade80", // green
      retry: "#f3f4f6", // gray
      lose: "#9ca3af", // darker gray
    };
    return colors[type] || "#f3f4f6";
  }

  getDefaultSectorImage(type) {
    return this.config.images[type] || "";
  }

  initialize() {
    this.wheel = this.findElement("#wheel");
    if (!this.wheel) {
      this.log("error", "Wheel element not found after HTML generation");
      return;
    }

    // Set animation duration
    this.wheel.style.setProperty(
      "--animation-duration",
      `${this.config.spinDuration}s`,
    );

    // Add click event listener
    this.wheel.addEventListener("click", () => this.spin());

    this.log("success", "Wheel initialized and ready to spin");
  }

  spin() {
    if (this.isSpinning || this.spinCount >= this.maxSpins) {
      this.log("warn", "Cannot spin - wheel is spinning or max spins reached");
      return;
    }

    this.isSpinning = true;
    this.wheel.classList.add("spinning");
    this.spinCount++;

    this.log(
      "info",
      `Spinning wheel (attempt ${this.spinCount}/${this.maxSpins})`,
    );

    // Determine target sector based on spin count
    let targetSector;
    if (this.spinCount === 1) {
      targetSector = this.findSectorByType("retry"); // First spin = retry
    } else if (this.spinCount === 2) {
      targetSector = this.findSectorByType("win"); // Second spin = win
    }

    const targetAngle = this.calculateAngleForSector(targetSector);
    let relativeRotation = targetAngle - this.currentRotation;

    // Normalize rotation to the shortest path
    if (relativeRotation > 180) {
      relativeRotation -= 360;
    } else if (relativeRotation < -180) {
      relativeRotation += 360;
    }

    // Add multiple full rotations for dramatic effect
    const totalRotation = relativeRotation + 4 * 360;
    const newTotalRotation = this.currentRotation + totalRotation;

    // Apply rotation
    this.wheel.style.setProperty("--rotation", `${newTotalRotation}deg`);
    this.wheel.classList.add("wheel-spinning");

    // Handle spin completion
    setTimeout(() => {
      this.isSpinning = false;
      this.wheel.classList.remove("spinning", "wheel-spinning");
      this.currentRotation = newTotalRotation % 360;
      this.wheel.style.transform = `rotate(${-22.5 + this.currentRotation}deg)`;

      this.handleSpinResult();
    }, this.config.spinDuration * 1000);
  }

  findSectorByType(type) {
    const sectorIndex = this.config.sectors.findIndex(
      (sector) => sector.type === type,
    );
    return sectorIndex !== -1 ? sectorIndex : 0;
  }

  calculateAngleForSector(targetSector) {
    const sectorCenter = targetSector * this.sectorAngle + this.sectorAngle / 2;
    return (360 - sectorCenter + this.sectorAngle / 2) % 360;
  }

  handleSpinResult() {
    if (this.spinCount === 1) {
      // First spin - show try again message
      this.showTryAgainMessage();
    } else if (this.spinCount === 2) {
      // Second spin - show win with confetti
      this.showWinResult();
    }
  }

  showWinResult() {
    this.log("success", "Showing win result");

    // Show product in center
    const productElement = this.findElement("#wheel-center-product");
    if (productElement) {
      this.showElement(productElement);
    }

    // Trigger confetti if available
    if (window.confetti) {
      const wheelRect = this.wheel.getBoundingClientRect();
      window.confetti({
        particleCount: 100,
        spread: 70,
        origin: {
          x:
            wheelRect.left / window.innerWidth +
            wheelRect.width / 2 / window.innerWidth,
          y:
            wheelRect.top / window.innerHeight +
            wheelRect.height / 2 / window.innerHeight,
        },
      });
      this.log("debug", "Confetti triggered");
    } else {
      this.log("warn", "Confetti library not available");
    }

    // Show win message after delay
    setTimeout(
      () => {
        this.showWinMessage();
      },
      (this.config.spinDuration - 3) * 1000,
    );
  }

  triggerWinConfetti() {
    // Find the wheel center
    const wheelCenter = this.findElement("#wheel-center-product");

    if (!wheelCenter) {
      this.log("warn", "No wheel center found for confetti");
      return;
    }

    // Trigger confetti if available (from Canvas Confetti library)
    if (window.confetti) {
      const centerRect = wheelCenter.getBoundingClientRect();
      const originX =
        (centerRect.left + centerRect.width / 2) / window.innerWidth;
      const originY =
        (centerRect.top + centerRect.height / 2) / window.innerHeight;

      this.log("debug", "Triggering confetti from wheel center");

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
    this.spinCount = 0;
    this.currentRotation = 0;
    this.isSpinning = false;

    if (this.wheel) {
      this.wheel.style.transform = "rotate(-22.5deg)";
      this.wheel.classList.remove("spinning", "wheel-spinning");
    }

    // Hide product
    const productElement = this.findElement("#wheel-center-product");
    if (productElement) {
      this.hideElement(productElement);
    }

    this.log("info", "Wheel reset to initial state");
  }

  destroy() {
    try {
      this.log("info", "Destroying wheel...");

      if (this.wheel) {
        this.wheel.removeEventListener("click", this.spin);
      }

      this.wheel = null;
      this.currentRotation = 0;
      this.isSpinning = false;
      this.spinCount = 0;
      this.container = null;

      super.destroy();

      this.log("success", "Wheel destroyed");
    } catch (error) {
      this.log("error", "Error destroying wheel", error);
    }
  }
}

window.WheelManager = WheelManager;
