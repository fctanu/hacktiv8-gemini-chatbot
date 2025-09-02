// script.js - Frontend logic for Gemini Chatbot (Vanilla JS)

const form = document.getElementById("chat-form");
const input = document.getElementById("user-input");
const chatBox = document.getElementById("chat-box");
const themeToggle = document.getElementById("theme-toggle");

// Conversation history sent to backend each turn
// Roles: 'user' (human), 'model' (Gemini response)
const history = [];

function appendMessage(role, text, opts = {}) {
  const msg = document.createElement("div");
  msg.className = `message ${role === "model" ? "bot" : role}`;
  // Render markdown for both user and model (user sanitized first)
  msg.innerHTML = renderMarkdown(text, { isUser: role === "user" });
  if (opts.placeholder) msg.dataset.placeholder = "true";
  const ts = document.createElement("div");
  ts.className = "timestamp";
  ts.textContent = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  msg.appendChild(ts);
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
  return msg;
}

function setInputEnabled(enabled) {
  input.disabled = !enabled;
  const btn = form.querySelector("button[type=submit]");
  if (btn) btn.disabled = !enabled;
  if (enabled) input.focus();
}

async function sendMessage(userText) {
  history.push({ role: "user", content: userText });
  const thinkingEl = appendMessage("model", "Thinking...", {
    placeholder: true,
  });
  try {
    const resp = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history }),
    });
    let data;
    try {
      data = await resp.json();
    } catch {
      throw new Error("Invalid JSON response");
    }
    if (!resp.ok) throw new Error(data?.error || `HTTP ${resp.status}`);
    const aiText =
      data && typeof data.result === "string" && data.result.trim()
        ? data.result.trim()
        : null;
    if (!aiText) {
      thinkingEl.textContent = "Sorry, no response received.";
      thinkingEl.classList.add("error");
      return;
    }
    thinkingEl.textContent = aiText;
    history.push({ role: "model", content: aiText });
  } catch (err) {
    console.error("Chat request failed:", err);
    thinkingEl.textContent = "Failed to get response from server.";
    thinkingEl.classList.add("error");
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const userText = input.value.trim();
  if (!userText) return;
  appendMessage("user", userText);
  input.value = "";
  setInputEnabled(false);
  await sendMessage(userText);
  setInputEnabled(true);
});

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.shiftKey) {
    e.preventDefault();
  }
});

// Auto-grow textarea height
const textarea = input; // now a textarea
textarea.addEventListener("input", () => {
  textarea.style.height = "auto";
  textarea.style.height = Math.min(textarea.scrollHeight, 180) + "px";
});

function sanitize(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Basic markdown renderer (bold, italics, inline code, code blocks, headings, lists, links)
function renderMarkdown(raw, { isUser = false } = {}) {
  // Sanitize first
  let s = sanitize(raw);
  // Code fences
  s = s.replace(
    /```([\s\S]*?)```/g,
    (_, code) => `<pre><code>${code.replace(/</g, "&lt;")}</code></pre>`
  );
  // Inline code
  s = s.replace(/`([^`]+)`/g, (_, code) => `<code>${code}</code>`);
  // Headings (simple # / ## / ### )
  s = s
    .replace(/^###\s+(.*)$/gm, "<h3>$1</h3>")
    .replace(/^##\s+(.*)$/gm, "<h2>$1</h2>")
    .replace(/^#\s+(.*)$/gm, "<h1>$1</h1>");
  // Bold & italics
  s = s
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/_([^_]+)_/g, "<em>$1</em>");
  // Links [text](url)
  s = s.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  // Unordered lists
  s = s.replace(/^(?:[-*+]\s.+(?:\n|$))+?/gm, (block) => {
    const items = block
      .trim()
      .split(/\n/)
      .map((l) => l.replace(/^[-*+]\s+/, "").trim())
      .map((li) => `<li>${li}</li>`)
      .join("");
    return `<ul>${items}</ul>`;
  });
  // Ordered lists
  s = s.replace(/^(?:\d+\.\s.+(?:\n|$))+?/gm, (block) => {
    const items = block
      .trim()
      .split(/\n/)
      .map((l) => l.replace(/^\d+\.\s+/, "").trim())
      .map((li) => `<li>${li}</li>`)
      .join("");
    return `<ol>${items}</ol>`;
  });
  // Paragraph breaks
  s = s
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/^(.+?)$/gm, (line) =>
      line.startsWith("<") ? line : `<span>${line}</span>`
    );
  s = `<p>${s}</p>`;
  return s;
}

// Theme toggle
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  themeToggle.textContent = theme === "light" ? "🌙" : "☀️";
  themeToggle.classList.toggle("light", theme === "light");
  localStorage.setItem("chat-theme", theme);
}
const storedTheme =
  localStorage.getItem("chat-theme") ||
  (window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark");
applyTheme(storedTheme);
themeToggle.addEventListener("click", () => {
  const current =
    document.documentElement.getAttribute("data-theme") === "light"
      ? "light"
      : "dark";
  applyTheme(current === "light" ? "dark" : "light");
});
