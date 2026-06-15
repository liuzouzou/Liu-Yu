(function () {
  if (window.location.protocol !== "file:") return;
  if (window.ZHIPU_CHAT_CONFIG?.apiKey) return;

  const SERVER = "http://127.0.0.1:3000";
  const overlay = document.getElementById("fileOpenOverlay");

  function showOverlay() {
    if (overlay) overlay.hidden = false;
    document.body.classList.add("file-open-waiting");
  }

  function hideOverlay() {
    if (overlay) overlay.hidden = true;
    document.body.classList.remove("file-open-waiting");
  }

  async function serverReady() {
    try {
      const res = await fetch(`${SERVER}/health`);
      return res.ok;
    } catch {
      return false;
    }
  }

  async function goToServer() {
    window.location.replace(`${SERVER}/`);
  }

  async function waitForServer() {
    showOverlay();
    for (let i = 0; i < 60; i += 1) {
      if (await serverReady()) {
        hideOverlay();
        await goToServer();
        return;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  (async () => {
    if (await serverReady()) {
      await goToServer();
      return;
    }
    await waitForServer();
  })();
})();
