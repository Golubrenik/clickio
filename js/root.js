window.AppConfig = {};

Promise.resolve(unflatten(window.ThemeConfig))
  .then((configuration) => {
    const configurator = new Configurator(configuration);

    Object.assign(window.AppConfig, {
      configurator,
      sleep: configurator.get("sleep"),
      bot: configurator.get("bot"),
      offer: configurator.get("offer"),
      country: configurator.get("country"),
      product: configurator.get("product"),
      brand: configurator.get("brand"),
      page: {
        title: configurator.get("page.title"),
        favicon: configurator.get("favicon"),
      },
      header: {
        colors: {
          background: configurator.backgroundColor("header.background.color"),
          font: configurator.fontColor("header.font.color"),
          border: configurator.get("header.border.color"),
        },
        logo: configurator.get("header.logo"),
        text: {
          basket: configurator.get("header.basket.text"),
          support: configurator.get("header.support.text"),
        },
        search: {
          text: configurator.get("header.search.text"),
          colors: {
            icon: configurator.backgroundColor("header.search.icon.color"),
            border: configurator.backgroundColor("header.search.border.color"),
          },
        },
      },
      welcome: configurator.get("info"),
      price: {
        old: configurator.get("info.old-price"),
        new: configurator.get("info.new-price"),
        color: configurator.fontColor("new-price.color"),
      },
      buttons: {
        background: configurator.backgroundColor("buttons.background.color"),
        border: configurator.elementsColor("buttons.border.color"),
        font: configurator.fontColor("buttons.font.color"),
      },
      phone: configurator.get("phone"),
      input: configurator.get("input"),
      questions: configurator.get("questions.items", []).map((q, i) => ({
        id: `q${i + 1}`,
        question: q.text,
        buttons: q.buttons,
      })),
      loading: configurator.get("loading"),
      game: {
        boxes: {
          front: configurator.get("boxes.front"),
          inside: configurator.get("boxes.inside"),
          lid: configurator.get("boxes.lid"),
          product: "./images/product/product.png",
        },
        wheel: {
          images: {
            border: configurator.get("wheel.border"),
            center: configurator.get("wheel.center"),
            pointer: configurator.get("wheel.pointer"),
            lose: configurator.get("wheel.lose"),
            retry: configurator.get("wheel.retry"),
            win: configurator.get("product.image"),
          },
          colors: {
            win: configurator.backgroundColor("wheel.win.background.color"),
          },
        },
        modal: {
          welcome: configurator.get("modal.welcome.content"),
          tryAgain: configurator.get("modal.try-again.content"),
          win: configurator.get("modal.win.content"),
        },
      },
      prefill: configurator.get("prefill"),
    });

    debug("🚀 Dispatching app:init event");
    document.dispatchEvent(new CustomEvent("app:init"));
  })
  .catch((error) => {
    debug("❌ Failed to load configuration:", error);
  });

// Listen for app initialization
document.addEventListener("app:init", async () => {
  debug("📱 App initialization event received");

  try {
    const mainManager = new MainManager();
    await mainManager.loadModules();
    await mainManager.run();
    debug("🎉 App is ready!");
  } catch (error) {
    debug(`❌ App initialization failed: ${error.message}`);
  }
});
