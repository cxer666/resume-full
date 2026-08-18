const API = "http://127.0.0.1:17888";

async function checkServer() {
  const status = document.getElementById("status");
  try {
    const res = await fetch(`${API}/api/resume`, { cache: "no-store" });
    if (!res.ok) throw new Error("not ok");
    const data = await res.json();
    status.className = "ok";
    status.textContent = `本地服务已连接。当前版本：${data.activeVersion || "通用版"}`;
  } catch {
    status.className = "warn";
    status.textContent = "未连接本地服务，请先双击启动脚本。";
  }
}

document.getElementById("openSettings").addEventListener("click", () => {
  chrome.tabs.create({ url: API });
});

document.getElementById("reloadPage").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) chrome.tabs.reload(tab.id);
});

checkServer();
