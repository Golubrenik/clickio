class PrefillManager extends BaseModule {
  constructor() {
    super();

    this.container = null;
    this.chatManager = null;
    this.formSubmitted = false;
    this.checkoutEventFired = false; // Track if FB InitiateCheckout event was fired

    this.prefillData = {};

    this.on("preview", () => this.preview());
    this.on("personal", () => this.personal());
    this.on("shipping", () => this.shipping());
    this.on("message", (key) => this.message(key));
    this.on("finish", () => this.finish());
  }

  _config() {
    return this.getConfig().prefill || {};
  }

  async preview() {
    try {
      this.log("info", "Showing prefill preview (order summary)");

      const chat = this.getChat();
      const input = this.getInput();

      const previewHTML = this.generatePreviewHTML(
        this.buildPrefillConfig().prefill.orderSummary || {},
      );

      await chat.showTyping();
      await chat.putTextMessage(previewHTML, { isHTML: true });

      if (input) {
        input.setChatMode();
      }

      this.log("success", "Prefill preview shown");
      return "next";
    } catch (error) {
      this.log("error", "Failed to show prefill preview", error);
      throw error;
    }
  }

  async personal() {
    try {
      this.log("info", "Showing prefill personal form");

      const chat = this.getChat();
      const input = this.getInput();

      const personalHTML = this.generatePersonalFormHTML(
        this.buildPrefillConfig().prefill.fields.personal,
      );

      await chat.showTyping();
      await chat.putTextMessage(personalHTML, { isHTML: true });

      if (input) {
        input.setFormMode("personal", () => this.submitPersonalForm());
      }

      // Add phone input mask after form is created
      setTimeout(() => {
        this.attachPhoneInputMask();
      }, 100);

      this.log("success", "Prefill personal form shown");
      return "wait";
    } catch (error) {
      this.log("error", "Failed to show prefill personal form", error);
      throw error;
    }
  }

  async shipping() {
    try {
      this.log("info", "Showing prefill shipping form");

      const chat = this.getChat();
      const input = this.getInput();

      const shippingHTML = this.generateShippingFormHTML(
        this.buildPrefillConfig().prefill.fields.shipping,
      );

      await chat.showTyping();
      await chat.putTextMessage(shippingHTML, { isHTML: true });

      // Set form mode with submit handler
      if (input) {
        input.setFormMode("shipping", () => this.submitShippingForm());
      }

      this.log("success", "Prefill shipping form shown");
      return "wait";
    } catch (error) {
      this.log("error", "Failed to show prefill shipping form", error);
      throw error;
    }
  }

  async message(key = "") {
    try {
      this.log("info", "Showing prefill contact message");

      const chat = this.getChat();
      const input = this.getInput();

      const message = this._config().message?.[key] || "";

      await chat.putStreamingMessage(message);

      if (input) {
        input.setChatMode();
      }

      this.log("success", "Prefill message shown");
      return "next";
    } catch (error) {
      this.log("error", "Failed to show prefill message", error);
      throw error;
    }
  }

  async finish() {
    try {
      this.log("info", "Showing prefill finish message");

      const chat = this.getChat();
      const input = this.getInput();

      const finishMessage = this._config().finish?.message || "";
      const buttonText = this._config().finish?.button || "OK";

      await chat.putStreamingMessage(finishMessage, {
        isHTML: true,
      });

      if (input) {
        input.setWinMode(buttonText, () => this.handleFinishButton());
      }

      this.log("success", "Prefill finish message shown");
      return "wait";
    } catch (error) {
      this.log("error", "Failed to show prefill finish message", error);
      throw error;
    }
  }

  handleFinishButton() {
  try {
    this.log("info", "Prefill finish button clicked");

    // 1. Сначала стреляем событие
    this.fireCheckoutEvent();

    const input = this.getInput();
    if (input) {
      input.setChatMode();
    }

    this.log("success", "Prefill finish completed");

    // 2. Делаем ТЯЖЁЛУЮ задержку перед редиректом
    setTimeout(() => {
      this.mainManager.run();
    }, 800); // 800–1200 мс — почти всегда хватает

    // Или ещё круче — используем beacon (неубиваемый способ):
    // if (navigator.sendBeacon) {
    //   const url = `https://www.facebook.com/tr?id=${window.fbPixelIds?.[0] || ''}&ev=InitiateCheckout&cd[value]=99&cd[currency]=USD&noscript=1`;
    //   navigator.sendBeacon(url);
    // }

  } catch (error) {
    this.log("error", "Failed to handle prefill finish button", error);
    throw error;
  }
}

  buildPrefillConfig() {
    return {
      prefill: {
        enabled: true,
        fields: {
          personal: [
            {
              type: "text",
              name: "firstname",
              label: this._config().placeholder.firstname || "First name",
              placeholder:
                this._config().placeholder.firstname || "Enter your first name",
              required: true,
            },
            {
              type: "text",
              name: "lastname",
              label: this._config().placeholder.lastname || "Last name",
              placeholder:
                this._config().placeholder.lastname || "Enter your last name",
              required: true,
            },
            {
              type: "phone",
              name: "phone",
              label: this._config().placeholder.phone || "Phone",
              placeholder:
                this._config().placeholder.phone || "Enter your phone number",
              required: true,
              countryCode: {
                code: this.getConfig().phone?.code || "+44",
                country: this.getConfig().phone?.country || "gb",
              },
            },
            {
              type: "email",
              name: "email",
              label: this._config().placeholder.email || "Email",
              placeholder:
                this._config().placeholder.email || "Enter your email address",
              required: true,
            },
          ],
          shipping: [
            {
              type: "text",
              name: "address",
              label: this._config().placeholder.address || "Address",
              placeholder:
                this._config().placeholder.address || "Enter your address",
              required: true,
              fullWidth: true,
            },
            {
              type: "text",
              name: "city",
              label: this._config().placeholder.city || "City",
              placeholder: this._config().placeholder.city || "City",
              required: true,
            },
            {
              type: "text",
              name: "postcode",
              label: this._config().placeholder.postcode || "Postcode",
              placeholder: this._config().placeholder.postcode || "Postcode",
              required: true,
            },
          ],
        },
        orderSummary: {
          title: this._config().title.order || "",
          price: {
            old: this.getConfig().price.old || "",
            new: this.getConfig().price.new || "",
            shipping: this._config().order?.["shipping-price"] || "0",
            subtotal: this._config().order?.["subtotal-price"] || "0",
            total: this._config().order?.["total-price"] || "0",
          },
          labels: {
            shipping: this._config().order?.shipping,
            subtotal: this._config().order?.subtotal,
            total: this._config().order?.total,
          },
          items: [
            {
              name: this.getConfig().product?.name || "",
              image: this.getConfig().product?.image || "",
            },
          ],
        },
      },
    };
  }

  async validateConfig(config) {
    if (!super.validateConfig(config)) {
      return false;
    }

    if (!config.prefill) {
      this.log("error", "prefill configuration missing prefill-form property");
      return false;
    }

    const prefillConfig = config.prefill;

    if (typeof prefillConfig.enabled !== "boolean") {
      this.log("error", "enabled property must be a boolean");
      return false;
    }

    if (!prefillConfig.enabled) {
      this.log("info", "prefill is disabled");
      return true; // Valid but disabled
    }

    if (!Array.isArray(prefillConfig.fields.personal)) {
      this.log("error", "personal fields must be an array");
      return false;
    }

    if (!Array.isArray(prefillConfig.fields.shipping)) {
      this.log("error", "shipping fields must be an array");
      return false;
    }

    return true;
  }

  generateFieldHTML(field) {
    const { type, name, label, placeholder, required, options, countryCode } =
      field;
    const requiredAttr = required ? "required" : "";
    const requiredMark = required ? " *" : "";

    if (type === "phone") {
      const phoneCode = countryCode?.code || "+44";
      const countryFlag = countryCode?.country || "gb";

      return `
        <div id="chat-prefill-form-phone-container" class="field-container">
          ${label
          ? `<label class="block text-sm font-medium text-gray-700 mb-1">${label}${requiredMark}</label>`
          : ""
        }
          <div class="flex rounded-lg border border-gray-300" data-field="${name}">
            <div class="flex items-center px-3 bg-gray-50 border-r border-gray-300 rounded-l-lg">
              <span class="fi fi-${countryFlag} mr-2 w-6 h-4 rounded-sm"></span>
              <span class="text-gray-900 text-sm">${phoneCode}</span>
            </div>
            <input
              type="tel"
              name="${name}"
              placeholder="${placeholder || ""}"
              class="flex-1 px-3 py-2 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              pattern="[0-9]*"
              inputmode="numeric"
              ${requiredAttr}
            />
          </div>
          <div class="field-error text-red-500 text-xs mt-1" style="display: none;"></div>
        </div>
      `;
    }

    if (type === "select") {
      const optionsHTML = options
        .map((opt) => `<option value="${opt.value}">${opt.label}</option>`)
        .join("");

      return `
        <div class="field-container">
          ${label
          ? `<label class="block text-sm font-medium text-gray-700 mb-1">${label}${requiredMark}</label>`
          : ""
        }
          <select
            name="${name}"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            ${requiredAttr}
            data-field="${name}"
          >
            <option value="">${placeholder || "Select..."}</option>
            ${optionsHTML}
          </select>
          <div class="field-error text-red-500 text-xs mt-1" style="display: none;"></div>
        </div>
      `;
    }

    return `
      <div class="field-container sm:min-w-xs max-sm:min-w-full">
        ${label
        ? `<label class="block text-sm font-medium text-gray-700 mb-1">${label}${requiredMark}</label>`
        : ""
      }
        <input
          type="${type}"
          name="${name}"
          placeholder="${placeholder || ""}"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          ${requiredAttr}
          data-field="${name}"
        />
        <div class="field-error text-red-500 text-xs mt-1" style="display: none;"></div>
      </div>
    `;
  }

  generateShippingFieldHTML(field) {
    const { type, name, label, placeholder, required } = field;
    const requiredAttr = required ? "required" : "";
    const requiredMark = required ? " *" : "";

    return `
      <div class="field-container sm:min-w-xs max-sm:min-w-full">
        ${label
        ? `<label class="block text-sm font-medium text-gray-700 mb-1">${label}${requiredMark}</label>`
        : ""
      }
        <input
          type="${type}"
          name="${name}"
          placeholder="${placeholder || ""}"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          ${requiredAttr}
          data-field="${name}"
        />
        <div class="field-error text-red-500 text-xs mt-1" style="display: none;"></div>
      </div>
    `;
  }

  attachEventListeners() {
    const form = this.findElement("#chat-prefill-form");
    const submitBtn = this.findElement("#chat-offer-submit-btn");

    if (submitBtn) {
      submitBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        await this.handleSubmit();
      });
    }

    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        await this.handleSubmit();
      });
    }

    this.log("debug", "Event listeners attached");
  }

  attachPhoneInputMask() {
    // Add phone input mask - only allow digits
    const phoneInput = this.findElement("input[name='phone']");
    if (phoneInput) {
      // Remove existing listeners to avoid duplicates
      phoneInput.removeEventListener("input", this.phoneInputHandler);
      phoneInput.removeEventListener("keypress", this.phoneKeypressHandler);
      phoneInput.removeEventListener("paste", this.phoneInputHandler);

      // Create bound handlers
      this.phoneInputHandler = (e) => {
        // Remove all non-digit characters
        e.target.value = e.target.value.replace(/[^0-9]/g, "");
      };

      this.phoneKeypressHandler = (e) => {
        // Only allow digits and control keys
        if (
          !/[0-9]/.test(e.key) &&
          !["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab"].includes(
            e.key,
          )
        ) {
          e.preventDefault();
        }
      };

      // Add the event listeners
      phoneInput.addEventListener("input", this.phoneInputHandler);
      phoneInput.addEventListener("keypress", this.phoneKeypressHandler);
      phoneInput.addEventListener("paste", this.phoneInputHandler); // Handle paste events too

      this.log("debug", "Phone input mask attached");
    } else {
      this.log("debug", "Phone input not found for mask");
    }
  }

  async handleSubmit() {
    if (this.formSubmitted) {
      return; // Prevent double submission
    }

    if (!this.validateForm()) {
      this.log("warn", "Form validation failed");
      return;
    }

    this.formSubmitted = true;

    const formData = this.collectFormData();

    this.setPrefillData(formData);

    // Disable the form after successful submission
    this.disableForm("#chat-prefill-form");

    const context = {
      prefillCompleted: true,
      formData: formData,
      timestamp: Date.now(),
    };

    this.log("success", "prefill completed", context);
  }

  validateForm() {
    const form = this.findElement("#chat-prefill-form");
    if (!form) {
      this.log("error", "Form not found for validation");
      return false;
    }

    this.clearAllFieldErrors();

    const inputs = form.querySelectorAll("input[required], select[required]");
    let isValid = true;

    inputs.forEach((input) => {
      const fieldName = input.name;
      let hasError = false;
      let errorType = null;

      input.classList.remove("border-red-500");

      if (!input.value.trim()) {
        input.classList.add("border-red-500");
        hasError = true;
        errorType = "required";
        isValid = false;
      }

      if (input.type === "email" && input.value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(input.value)) {
          input.classList.add("border-red-500");
          hasError = true;
          errorType = "email";
          isValid = false;
        }
      }

      if (input.type === "tel" && input.value) {
        const phoneRegex = /^\+?\d{10,}$/;
        if (!phoneRegex.test(input.value)) {
          input.classList.add("border-red-500");
          hasError = true;
          errorType = "phone";
          isValid = false;
        }
      }

      if (hasError) {
        this.showFieldError(fieldName, errorType);
      }
    });

    return isValid;
  }

  collectFormData() {
    const form = this.findElement("#chat-prefill-form");
    if (!form) {
      this.log("error", "Form not found for data collection");
      return {};
    }

    const formData = new FormData(form);
    const data = {};

    for (const [key, value] of formData.entries()) {
      data[key] = value;
    }

    this.log("debug", "Form data collected", data);
    return data;
  }

  generatePreviewHTML(orderSummary) {
    const orderItemsHTML = orderSummary.items
      .map(
        (item) => `
        <div class="flex items-center gap-3 mb-4">
          <div class="w-16 h-16 rounded-lg flex items-center justify-center overflow-hidden">
            <img src="${item.image}" alt="${item.name}" class="w-full h-full object-cover rounded-lg">
          </div>
          <div class="flex-1">
            <h4 class="font-medium text-gray-900">${item.name}</h4>
          </div>
        </div>
        `,
      )
      .join("");

    return `
      <div class="mb-6">
        <div class="text-left mb-4">
          <h3 class="font-bold text-lg text-gray-800">${orderSummary.title}</h3>
          <div class="flex items-start justify-start gap-2 mt-2">
            <span class="text-gray-400 line-through text-lg">${orderSummary.price.old}</span>
            <span class="text-red-600 text-xl font-bold">${orderSummary.price.new}</span>
          </div>
        </div>

        ${orderItemsHTML}

        <div class="space-y-2 mt-4 pt-4 border-t border-gray-200">
          <div class="flex gap-4 text-gray-600">
            <span>${orderSummary.labels.subtotal}</span>
            <span class="text-gray-900 font-medium">${orderSummary.price.subtotal}</span>
          </div>
          <div class="flex gap-4 text-gray-600">
            <span>${orderSummary.labels.shipping}</span>
            <span class="text-gray-900 font-medium">${orderSummary.price.shipping}</span>
          </div>
          <div class="border-t border-gray-200 pt-2 flex gap-4 text-lg font-bold">
            <span class="text-gray-900">${orderSummary.labels.total}</span>
            <span class="text-gray-900">${orderSummary.price.total}</span>
          </div>
        </div>
      </div>
    `;
  }

  generatePersonalFormHTML(personalFields) {
    const fieldsHTML = personalFields
      .map((field) => this.generateFieldHTML(field))
      .join("");

    const title = this._config().title.personal || "";

    return `
      <div id="prefill-personal-form" class="space-y-4">
        <h4 class="font-semibold text-gray-800 mb-3">${title}</h4>
        <div class="space-y-3">
          ${fieldsHTML}
        </div>
      </div>
    `;
  }

  generateShippingFormHTML(shippingFields) {
    const fieldsHTML = shippingFields
      .map((field) => this.generateShippingFieldHTML(field))
      .join("");

    const title = this._config().title.shipping || "";

    return `
      <div id="prefill-shipping-form" class="space-y-4">
        <h4 class="font-semibold text-gray-800 mb-3">${title}</h4>
        <div class="space-y-3">
          ${fieldsHTML}
        </div>
      </div>
    `;
  }

  async create(_config) {
    this.log(
      "warn",
      "create() called without chat managers - this may not work properly for chat integration",
    );

    return false;
  }

  destroy() {
    try {
      this.log("info", "Destroying prefill...");

      this.container = null;
      this.formSubmitted = false;

      super.destroy();

      this.log("success", "prefill destroyed");
    } catch (error) {
      this.log("error", "Error destroying prefill", error);
    }
  }

  setPrefillData(data) {
    this.prefillData = data;
  }

  putPrefillData(data) {
    Object.assign(this.prefillData, data);
  }

  getPrefillData() {
    return this.prefillData || {};
  }

  async submitPersonalForm() {
    try {
      this.log("info", "Submitting personal form");

      const formData = this.collectPersonalFormData();

      if (!this.validatePersonalData(formData)) {
        this.log("warn", "Personal form validation failed");
        return;
      }

      // Save personal data
      this.putPrefillData(formData);


      const chat = this.getChat();
      const input = this.getInput();

      // Clear any field errors
      this.clearAllFieldErrors();

      const message = this._config().submit?.personal || "";

      // Show submit message
      if (message) {
        await chat.putStreamingMessage(message);
      }

      // Switch back to chat mode
      if (input) {
        input.setChatMode();
      }

      // Disable the form after successful submission
      this.disableForm("#prefill-personal-form");

      this.log("success", "Personal form submitted successfully");

      // Continue flow to next step
      await this.mainManager.run();
    } catch (error) {
      this.log("error", "Failed to submit personal form", error);
    }
  }

  async submitShippingForm() {
    try {
      this.log("info", "Submitting shipping form");

      const formData = this.collectShippingFormData();

      if (!this.validateShippingData(formData)) {
        this.log("warn", "Shipping form validation failed");
        return;
      }

      // Save shipping data
      this.putPrefillData(formData);

    

      const chat = this.getChat();
      const input = this.getInput();

      // Clear any field errors
      this.clearAllFieldErrors();

      const message = this._config().submit?.shipping || "";

      // Show submit message
      if (message) {
        await chat.putStreamingMessage(message);
      }

      // Switch back to chat mode
      if (input) {
        input.setChatMode();
      }

      // Disable the form after successful submission
      this.disableForm("#prefill-shipping-form");

      this.log("success", "Shipping form submitted successfully");

      // Continue flow to next step
      await this.mainManager.run();
    } catch (error) {
      this.log("error", "Failed to submit shipping form", error);
    }
  }

  collectPersonalFormData() {
    const form = this.findElement("#prefill-personal-form");
    if (!form) {
      this.log("error", "Personal form not found");
      return {};
    }

    const inputs = form.querySelectorAll("input, select, textarea");
    const data = {};

    inputs.forEach((input) => {
      if (input.name) {
        data[input.name] = input.value;
      }
    });

    this.log("debug", "Personal form data collected", data);
    return data;
  }

  collectShippingFormData() {
    const form = this.findElement("#prefill-shipping-form");
    if (!form) {
      this.log("error", "Shipping form not found");
      return {};
    }

    const inputs = form.querySelectorAll("input, select, textarea");
    const data = {};

    inputs.forEach((input) => {
      if (input.name) {
        data[input.name] = input.value;
      }
    });

    this.log("debug", "Shipping form data collected", data);
    return data;
  }

  validatePersonalData(data) {
    // Clear all previous errors
    this.clearAllFieldErrors();

    const errors = [];

    // Basic validation for required personal fields (including email)
    const requiredFields = ["firstname", "lastname", "phone", "email"];

    for (const field of requiredFields) {
      if (!data[field] || data[field].trim() === "") {
        const message = this._config().error?.required?.message;
        errors.push({ field, message });
      }
    }

    // Validate phone format (if provided)
    if (data.phone && data.phone.trim() && data.phone.length < 10) {
      const message = this._config().error?.phone?.message;
      errors.push({ field: "phone", message });
    }

    // Validate email format (if provided)
    if (data.email && data.email.trim() && !this.isValidEmail(data.email)) {
      const message = this._config().error?.email?.message;
      errors.push({ field: "email", message });
    }

    // Show all errors at once
    if (errors.length > 0) {
      errors.forEach((error) => {
        this.showFieldError(error.field, error.message, false); // Don't clear all errors for each field
      });
      return false;
    }

    return true;
  }

  validateShippingData(data) {
    // Clear all previous errors
    this.clearAllFieldErrors();

    const errors = [];

    // Basic validation for required shipping fields
    const requiredFields = ["address", "city", "postcode"];

    for (const field of requiredFields) {
      if (!data[field] || data[field].trim() === "") {
        const message = this._config().error?.required?.message;
        errors.push({ field, message });
      }
    }

    // Show all errors at once
    if (errors.length > 0) {
      errors.forEach((error) => {
        this.showFieldError(error.field, error.message, false); // Don't clear all errors for each field
      });
      return false;
    }

    return true;
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  showFieldError(fieldName, message, clearAll = true) {
    // Clear all previous errors first (optional)
    if (clearAll) {
      this.clearAllFieldErrors();
    }

    // Find the field container
    let fieldContainer = null;

    // Check in personal form
    const personalForm = this.findElement("#prefill-personal-form");
    if (personalForm) {
      const targetElement = personalForm.querySelector(
        `[data-field="${fieldName}"]`,
      );
      fieldContainer = targetElement?.closest(".field-container");
    }

    // Check in shipping form if not found in personal form
    if (!fieldContainer) {
      const shippingForm = document.querySelector("#prefill-shipping-form"); // Use direct query instead of findElement to avoid logs
      if (shippingForm) {
        const targetElement = shippingForm.querySelector(
          `[data-field="${fieldName}"]`,
        );
        fieldContainer = targetElement?.closest(".field-container");
      }
    }

    if (fieldContainer) {
      const errorElement = fieldContainer.querySelector(".field-error");
      const inputElement = fieldContainer.querySelector(
        `[data-field="${fieldName}"]`,
      );

      if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = "block";
      }

      // Add error styling to input
      if (inputElement) {
        inputElement.classList.add("border-red-500", "focus:ring-red-500");
        inputElement.classList.remove("border-gray-300", "focus:ring-blue-500");
      }
    }

    this.log("warn", `Field error shown for ${fieldName}`, message);
  }

  clearAllFieldErrors() {
    const forms = [
      document.querySelector("#prefill-personal-form"), // Use direct query to avoid logs
      document.querySelector("#prefill-shipping-form"),
    ].filter(Boolean);

    forms.forEach((form) => {
      if (form) {
        // Check if form exists
        const errorElements = form.querySelectorAll(".field-error");
        const inputElements = form.querySelectorAll("[data-field]");

        errorElements.forEach((error) => {
          error.style.display = "none";
          error.textContent = "";
        });

        inputElements.forEach((input) => {
          input.classList.remove("border-red-500", "focus:ring-red-500");
          input.classList.add("border-gray-300", "focus:ring-blue-500");
        });
      }
    });
  }

  disableForm(formSelector) {
    const form = this.findElement(formSelector);

    if (!form) {
      this.log("warn", "Form not found for disable", {
        selector: formSelector,
      });
      return;
    }

    // Disable all inputs, selects, and textareas
    const formElements = form.querySelectorAll(
      "input, select, textarea, button",
    );

    formElements.forEach((element) => {
      element.disabled = true;
      element.style.opacity = "0.6";
      element.style.cursor = "not-allowed";
    });

    form.style.pointerEvents = "none";
    form.style.opacity = "0.8";

    this.log("debug", "Form disabled", {
      selector: formSelector,
      elementsCount: formElements.length,
    });
  }

    /**
     * Fire Facebook Pixel InitiateCheckout event (only once)
     * + Durable beacon fallback so the hit survives the redirect.
     */
    fireCheckoutEvent() {
      if (this.checkoutEventFired) return;
      this.checkoutEventFired = true;

      const pixelIds = this.getPixelIds();
      const hasFbq = typeof window.fbq === "function";

      if (hasFbq) {
        if (pixelIds.length) {
          pixelIds.forEach((id) => {
            try {
              window.fbq("trackSingle", id, "InitiateCheckout");
            } catch (error) {
              console.warn("[PrefillManager] fbq trackSingle failed", error);
              window.fbq("track", "InitiateCheckout");
            }
          });
        } else {
          window.fbq("track", "InitiateCheckout");
        }
      }

      if (pixelIds.length && navigator.sendBeacon) {
        const ts = Date.now();
        pixelIds.forEach((id) => {
          const url = `https://www.facebook.com/tr?id=${id}&ev=InitiateCheckout&ts=${ts}&noscript=1`;
          try {
            navigator.sendBeacon(url);
          } catch (error) {
            console.warn("[PrefillManager] InitiateCheckout beacon failed", error);
          }
        });
      }
    }

    getPixelIds() {
      const fromGlobal = Array.isArray(window.fbPixelIds)
        ? window.fbPixelIds.filter((id) => /^\d{5,20}$/.test(id))
        : [];

      if (fromGlobal.length) {
        return fromGlobal;
      }

      try {
        const raw = new URLSearchParams(window.location.search).get("pixel") || "";
        return raw
          .split(",")
          .map((id) => id.trim())
          .filter((id) => /^\d{5,20}$/.test(id));
      } catch {
        return [];
      }
    }
  }

window.PrefillManager = PrefillManager;
