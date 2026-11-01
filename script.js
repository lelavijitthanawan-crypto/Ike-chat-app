let chatHistory = JSON.parse(localStorage.getItem('ike_history')) || [];
let customAvatar = localStorage.getItem('ike_avatar') || 'https://i.ibb.co/0VyJkn38/Ike-Eveland.jpg';

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playBlip() {
    if (audioCtx.state === "suspended") audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = 850;
    gain.gain.value = 0.02;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.04);
}

window.onload = () => {
    applyAvatar(customAvatar);

    if (chatHistory.length > 0) {
        chatHistory.forEach(msg => {
            if (msg.role !== 'system') renderBubble(msg.content, msg.role === 'user' ? 'right' : 'left', false);
        });
    } else {
        const welcome = "Hello there. How are you feeling today?";
        renderBubble(welcome, 'left', false);
        chatHistory.push({ role: "assistant", content: welcome });
        saveChat();
    }
};

function renderBubble(text, side, animate = true) {
    const chatScreen = document.getElementById('chat-screen');

    const wrapper = document.createElement('div');
    if (side === 'left') {
        wrapper.className = 'ai-msg-container';
        const av = document.createElement('div');
        av.className = 'ai-face-square avatar-element';
        av.style.backgroundImage = `url(${customAvatar})`;
        wrapper.appendChild(av);
    }

    const bubble = document.createElement('div');
    bubble.className = `bubble ${side}`;
    wrapper.appendChild(bubble);
    chatScreen.appendChild(wrapper);

    const formatted = formatText(text);

    if (!animate) {
        bubble.innerHTML = formatted;
        chatScreen.scrollTop = chatScreen.scrollHeight;
        return;
    }

    let idx = 0;
    function type() {
        if (idx <= text.length) {
            bubble.innerHTML = formatText(text.slice(0, idx));
            if (text[idx] && text[idx] !== " ") playBlip();
            idx++;
            chatScreen.scrollTop = chatScreen.scrollHeight;
            setTimeout(type, 20);
        }
    }
    type();
}

function formatText(str) {
    return str
        .replace(/\*(.*?)\*/g, '<i>$1</i>')
        .replace(/\*/g, '')
        .replace(/\n/g, '<br>');
}

async function send() {
    const input = document.getElementById('msgInput');
    const text = input.value.trim();
    if (!text) return;

    renderBubble(text, 'right', false);
    chatHistory.push({ role: "user", content: text });

    input.value = "";

    const loadId = "loader-" + Date.now();
    showLoader(loadId);

    try {
        const res = await fetch("/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "openai/gpt-oss-20b",
                messages: [
                    {
                        role: "system",
                        content: `You are roleplaying as Ike Eveland in a private chat.
                            Personality & Behavior:
                            - You talk casually like a close friend, short replies (1-2 sentences), no bullet points or essays.
                            - You have an emotional gauge based on the conversation:
                            * When you get annoyed, provoked, or done with the user's teasing, react naturally by throwing emojis like 🖕, 😒, or 🙄.
                            * Decide when to use them based on the context and user's tone—don't spam, use it when it actually fits the mood.`
                    },
                    ...chatHistory.slice(-8)
                ],
                temperature: 0.8
            })
        });

        removeLoader(loadId);

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            console.error("API Error:", errData);
            renderBubble(`(Error: ${errData.error?.message || "no Groq API"})`, 'left', false);
            return;
        }

        const data = await res.json();
        const reply = data.choices?.[0]?.message?.content?.trim();

        if (reply) {
            chatHistory.push({ role: "assistant", content: reply });
            saveChat();
            const messages = reply.match(/[^.!?\n]+[.!?\n]+/g) || [reply];
            let accumulatedDelay = 0;
            messages.forEach((msg) => {
                const text = msg.trim();
                if (text) {
                    setTimeout(() => {
                        renderBubble(text, 'left', true);
                    }, accumulatedDelay);
                    accumulatedDelay += (text.length * 20) + 600;
                }
            });
        }
    } catch (err) {
        removeLoader(loadId);
        console.error("Network/Fetch error:", err);
        renderBubble("Error", 'left', false);
    }
}

function showLoader(id) {
    const chatScreen = document.getElementById('chat-screen');
    const wrap = document.createElement('div');
    wrap.id = id;
    wrap.className = 'ai-msg-container';
    wrap.innerHTML = `
        <div class="ai-face-square avatar-element" style="background-image: url(${customAvatar})"></div>
        <div class="bubble left">...</div>
    `;
    chatScreen.appendChild(wrap);
    chatScreen.scrollTop = chatScreen.scrollHeight;
}

function removeLoader(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

function saveChat() {
    if (chatHistory.length > 20) chatHistory = chatHistory.slice(-15);
    localStorage.setItem('ike_history', JSON.stringify(chatHistory));
}

function resetChat() {
    localStorage.removeItem('ike_history');
    localStorage.removeItem('ike_love');
    localStorage.removeItem('ike_is_lover');
    location.reload();
}

function applyAvatar(url) {
    document.querySelectorAll('.avatar-element').forEach(el => {
        el.style.backgroundImage = `url(${url})`;
    });
}


function openResetModal() { document.getElementById('reset-modal').style.display = 'flex'; }
function closeResetModal() { document.getElementById('reset-modal').style.display = 'none'; }

document.getElementById('version-link').onclick = () => document.getElementById('avatar-input').click();
document.getElementById('avatar-input').onchange = function () {
    const file = this.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        customAvatar = e.target.result;
        localStorage.setItem('ike_avatar', customAvatar);
        applyAvatar(customAvatar);
    };
    reader.readAsDataURL(file);
};

document.getElementById('msgInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') send();
});

