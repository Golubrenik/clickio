class HeaderManager extends BaseModule {
  async init() {
    try {
      this.log("info", "Initializing header from configuration");

      this.initializePageTitle();
      this.initializeFavicon();
      this.initializeHeader();

      this.log("success", "Header initialized successfully");
      return "next";
    } catch (error) {
      this.log("error", "Failed to initialize header", error);
      throw error;
    }
  }

  initializePageTitle() {
    const config = this.getConfig().page || {};
    const title = config.title || "";

    const div = document.createElement("div");
    div.innerHTML = this.replaceMacro(title);

    document.title = div.textContent;

    this.log("debug", "Page title set", { title: document.title });
  }

  initializeFavicon() {
    const config = this.getConfig().page || {};
    const favicon = config.favicon;

    if (!favicon) {
      return;
    }

    let faviconLink =
      document.querySelector("link[rel='icon']") ||
      document.querySelector("link[rel='shortcut icon']");

    if (!faviconLink) {
      faviconLink = document.createElement("link");
      faviconLink.rel = "icon";
      document.head.appendChild(faviconLink);
    }

    faviconLink.href = favicon;

    this.log("debug", "Favicon set", { favicon });
  }

  initializeHeader() {
    const header = document.querySelector("header");

    if (!header) {
      this.log("warn", "Header element not found");
      return;
    }

    this.applyHeaderStyles(header);
    this.updateHeaderContent(header);

    this.log("debug", "Header content and styles updated");
  }

  applyHeaderStyles(header) {
    const config = this.getConfig().header || {};
    const headerBgColor = config.colors.background;
    const headerFontColor = config.colors.font;
    const headerBorderColor = config.colors.border;

    if (headerBgColor) {
      header.style.backgroundColor = headerBgColor;
      header.classList.remove("bg-black");
      this.log("debug", "Header background color applied", {
        color: headerBgColor,
      });
    }

    if (headerFontColor) {
      header.style.color = headerFontColor;
      this.log("debug", "Header font color applied", {
        color: headerFontColor,
      });
    }

    if (headerBorderColor) {
      header.style.borderBottomWidth = "1px";
      header.style.borderBottomStyle = "solid";
      header.style.borderBottomColor = headerBorderColor;
      this.log("debug", "Header border color applied", {
        color: headerBorderColor,
      });
    }
  }

  updateHeaderContent(header) {
    const config = this.getConfig();

    this.updateLogo(header, config);
  }

  updateLogo(header, config) {
    const logo = header.querySelector("img");
    const logoSrc = config.header?.logo;

    if (logo && logoSrc) {
      logo.src = logoSrc;
      this.log("debug", "Logo updated", { src: logoSrc });
    }
  }
}

window.HeaderManager = HeaderManager;
