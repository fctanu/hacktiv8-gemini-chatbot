const form = document.getElementById("chat-form");
const input = document.getElementById("user-input");
const chatBox = document.getElementById("chat-box");

// Keep local history so backend can maintain context across turns (roles: user | model)
const history = []; // { role: 'user'|'model', content: string }

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const userMessage = input.value.trim();
  if (!userMessage) return;

  appendMessage("user", userMessage);
  history.push({ role: "user", content: userMessage });
  input.value = "";
  input.disabled = true;

  // Placeholder bot bubble we will update once response arrives
  const placeholder = appendMessage("bot", "Thinking...");

  try {
    const resp = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history }),
    });
    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      placeholder.textContent = errData.error || `Error: ${resp.status}`;
      return;
    }
    const data = await resp.json();
    placeholder.textContent = data.result;
    history.push({ role: "model", content: data.result });
  } catch (err) {
    placeholder.textContent = "Network error";
    console.error(err);
  } finally {
    input.disabled = false;
    input.focus();
  }
});

function appendMessage(sender, text) {
  const msg = document.createElement("div");
  msg.classList.add("message", sender);
  msg.textContent = text;
  chatBox.appendChild(msg);
  // Clear floats after each pair
  const clear = document.createElement("div");
  clear.style.clear = "both";
  chatBox.appendChild(clear);
  chatBox.scrollTop = chatBox.scrollHeight;
  return msg; // so caller can update
}
