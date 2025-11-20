class ModuleLoader {
  static async loadModuleScripts(enabledModules) {
    // Load core dependencies first
    const coreScripts = [];

    // Always load BaseModule first (if not already loaded)
    if (!window.BaseModule) {
      coreScripts.push("js/base-module.js");
    }

    // Always load GameManager first (if not already loaded)
    if (!window.GameManager) {
      coreScripts.push("js/game-manager.js");
    }

    // Load core scripts sequentially
    for (const scriptPath of coreScripts) {
      await ModuleLoader.loadScript(scriptPath);
    }

    // Now load module scripts in parallel
    const moduleScriptPromises = [];
    for (const moduleName of enabledModules) {
      const scriptPath = ModuleLoader.getModuleScriptPath(moduleName);
      if (scriptPath) {
        moduleScriptPromises.push(ModuleLoader.loadScript(scriptPath));
      }
    }

    return Promise.all(moduleScriptPromises);
  }

  static getModuleScriptPath(moduleName) {
    const scriptPaths = {
      chat: "js/chat-manager.js",
    };

    return scriptPaths[moduleName] || null;
  }

  static async loadGameModules() {
    const gameScripts = [
      "js/dialog-manager.js",
      "js/wheel-manager.js",
      "js/boxes-manager.js",
    ];

    const loadPromises = gameScripts.map((script) =>
      ModuleLoader.loadScript(script),
    );
    return Promise.all(loadPromises);
  }

  static loadScript(scriptPath) {
    return new Promise((resolve, reject) => {
      // Check if script is already loaded
      const existingScript = document.querySelector(
        `script[src="${scriptPath}"]`,
      );

      if (existingScript) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = scriptPath;
      script.onload = resolve;
      script.onerror = () =>
        reject(new Error(`Failed to load script: ${scriptPath}`));
      document.head.appendChild(script);
    });
  }
}
