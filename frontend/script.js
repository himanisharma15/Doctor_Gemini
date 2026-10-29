const chatEl = document.getElementById('chat');
const inputEl = document.getElementById('input');
const sendBtn = document.getElementById('send');
const userTpl = document.getElementById('message-user');
const geminiTpl = document.getElementById('message-gemini');

function appendMessage(type, text) {
  const tpl = type === 'user' ? userTpl : geminiTpl;
  const node = tpl.content.cloneNode(true);
  node.querySelector('.bubble').textContent = text;
  chatEl.appendChild(node);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function showLoading() {
  const el = document.createElement('div');
  el.className = 'message gemini loading';
  el.innerHTML = `<div class="bubble spinner">Gemini is thinking...</div>`;
  chatEl.appendChild(el);
  chatEl.scrollTop = chatEl.scrollHeight;
  return el;
}

async function sendQuestion() {
  const question = inputEl.value.trim();
  if (!question) return;
  appendMessage('user', question);
  inputEl.value = '';
  inputEl.focus();

  const loadingEl = showLoading();

  try {
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    });

    const data = await res.json();
    if (!res.ok) {
      appendMessage('gemini', 'Error: ' + (data.error || 'Unknown error'));
    } else {
      appendMessage('gemini', data.answer || 'No response');
    }
  } catch (err) {
    appendMessage('gemini', 'Network error: ' + err.message);
  } finally {
    // remove loading element if present
    if (loadingEl && loadingEl.parentNode) loadingEl.parentNode.removeChild(loadingEl);
    chatEl.scrollTop = chatEl.scrollHeight;
  }
}

sendBtn.addEventListener('click', sendQuestion);

inputEl.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    sendQuestion();
  }
});

// Load previous history (optional)
async function loadHistory() {
  try {
    const res = await fetch('/api/history');
    if (!res.ok) return;
    const history = await res.json();
    history.forEach(item => {
      appendMessage('user', item.user);
      appendMessage('gemini', item.gemini);
    });
  } catch (err) {
    console.warn('Could not load history', err);
  }
}

loadHistory();
