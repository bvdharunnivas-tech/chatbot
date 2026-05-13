// DOM Elements
const sidebar = document.getElementById('sidebar');
const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
const mobileToggleBtn = document.getElementById('mobileToggleBtn');
const newChatBtn = document.getElementById('newChatBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const apiKeyInput = document.getElementById('apiKey');
const userNameInput = document.getElementById('userName');
const themeSelect = document.getElementById('themeSelect');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const messagesContainer = document.getElementById('messages');
const welcomeScreen = document.getElementById('welcomeScreen');
const welcomeText = document.getElementById('welcomeText');
const historyList = document.getElementById('historyList');
const micBtn = document.getElementById('micBtn');
const fileInput = document.getElementById('fileInput');
const attachBtn = document.getElementById('attachBtn');
const filePreviewContainer = document.getElementById('filePreviewContainer');

// Icons for the send button
const sendIcon = document.querySelector('.send-icon');
const stopIcon = document.querySelector('.stop-icon');

// State
let apiKey = localStorage.getItem('gemini_api_key') || '';
let userName = localStorage.getItem('dharun_bot_username') || '';
let currentTheme = localStorage.getItem('dharun_bot_theme') || 'dark';
let chatHistory = [];
let attachedFiles = []; // Stores {id, name, type, data}
let isGenerating = false;
let currentChatId = Date.now().toString();
let allChats = JSON.parse(localStorage.getItem('gemini_chats')) || {};
let abortController = null;
let recognition = null;
let isRecording = false;

// Initialize
function init() {
    // Custom renderer for code blocks to add copy button
    const renderer = new marked.Renderer();
    renderer.code = function(code, language) {
        const id = 'code-' + Math.random().toString(36).substr(2, 9);
        return `
            <div class="code-block-container">
                <div class="code-header">
                    <span>${language || 'code'}</span>
                    <button class="copy-code-btn" onclick="copyCode('${id}', this)">
                        <i class="far fa-copy"></i> Copy code
                    </button>
                </div>
                <pre><code id="${id}" class="language-${language}">${code}</code></pre>
            </div>
        `;
    };

    marked.setOptions({
        renderer: renderer,
        breaks: true,
        highlight: function (code, lang) {
            return code; // Can add highlight.js later if needed
        }
    });

    if (apiKey && apiKeyInput) {
        apiKeyInput.value = apiKey;
    }

    if (userName) {
        userNameInput.value = userName;
        welcomeText.textContent = `Welcome back to Dharun's Ai Chatbot, ${userName}!`;
    }

    themeSelect.value = currentTheme;
    document.documentElement.setAttribute('data-theme', currentTheme);

    updateHistoryList();
    
    // Initialize Speech Recognition
    initSpeechRecognition();
    
    // Check if we need to load a chat
    if (Object.keys(allChats).length > 0) {
        // Find most recent chat
        const sortedChatIds = Object.keys(allChats).sort((a, b) => b - a);
        loadChat(sortedChatIds[0]);
    }
}

// Event Listeners
toggleSidebarBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
});

mobileToggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('mobile-open');
});

newChatBtn.addEventListener('click', createNewChat);

settingsBtn.addEventListener('click', openSettings);
closeSettingsBtn.addEventListener('click', closeSettings);
saveSettingsBtn.addEventListener('click', saveSettings);

settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
        closeSettings();
    }
});

userInput.addEventListener('input', () => {
    // Auto-resize textarea
    userInput.style.height = 'auto';
    userInput.style.height = (userInput.scrollHeight) + 'px';

    // Enable/disable send button
    if ((userInput.value.trim() || attachedFiles.length > 0) && !isGenerating) {
        sendBtn.disabled = false;
    } else {
        sendBtn.disabled = true;
    }
});

userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!sendBtn.disabled) {
            sendMessage();
        }
    }
});

sendBtn.addEventListener('click', () => {
    if (isGenerating) {
        stopGeneration();
    } else {
        sendMessage();
    }
});

micBtn.addEventListener('click', toggleRecording);

attachBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFileSelect);

// Helper function used by welcome screen suggestions
window.setInput = function (text) {
    userInput.value = text;
    userInput.style.height = 'auto';
    userInput.style.height = (userInput.scrollHeight) + 'px';
    sendBtn.disabled = false;
    sendMessage();
};

// Functions
function openSettings() {
    settingsModal.classList.add('active');
    if (apiKeyInput) apiKeyInput.value = apiKey;
    userNameInput.value = userName;
    themeSelect.value = currentTheme;
}

function closeSettings() {
    settingsModal.classList.remove('active');
}

function saveSettings() {
    const key = apiKeyInput ? apiKeyInput.value.trim() : '';
    const name = userNameInput.value.trim();
    const theme = themeSelect.value;

    if (key) {
        apiKey = key;
        localStorage.setItem('gemini_api_key', apiKey);
    }

    userName = name;
    localStorage.setItem('dharun_bot_username', userName);
    if (userName) {
        welcomeText.textContent = `Welcome back to Dharun's Ai Chatbot, ${userName}!`;
    } else {
        welcomeText.textContent = `Welcome to Dharun's Ai Chatbot`;
    }

    currentTheme = theme;
    localStorage.setItem('dharun_bot_theme', currentTheme);
    document.documentElement.setAttribute('data-theme', currentTheme);

    closeSettings();
    if (userInput.value.trim()) {
        sendBtn.disabled = false;
    }
}

function createNewChat() {
    currentChatId = Date.now().toString();
    chatHistory = [];
    messagesContainer.innerHTML = '';
    welcomeScreen.style.display = 'flex';
    if (window.innerWidth <= 768) {
        sidebar.classList.remove('mobile-open');
    }
}

function updateHistoryList() {
    historyList.innerHTML = '';
    const sortedChatIds = Object.keys(allChats).sort((a, b) => b - a);

    sortedChatIds.forEach(id => {
        const chat = allChats[id];
        if (chat.length === 0) return;

        const title = chat[0].parts[0].text.substring(0, 30) + '...';
        const li = document.createElement('li');
        li.className = 'history-item';
        li.innerHTML = `<i class="far fa-comment-alt"></i> <span>${title}</span>`;
        li.addEventListener('click', () => {
            loadChat(id);
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('mobile-open');
            }
        });
        historyList.appendChild(li);
    });
}

function loadChat(id) {
    currentChatId = id;
    chatHistory = allChats[id];
    messagesContainer.innerHTML = '';

    if (chatHistory.length > 0) {
        welcomeScreen.style.display = 'none';
        chatHistory.forEach(msg => {
            renderMessage(msg.role, msg.parts[0].text, false);
        });
    } else {
        welcomeScreen.style.display = 'flex';
    }
}

function saveCurrentChat() {
    if (chatHistory.length > 0) {
        allChats[currentChatId] = chatHistory;
        localStorage.setItem('gemini_chats', JSON.stringify(allChats));
        updateHistoryList();
    }
}

function renderMessage(role, text, isMarkdown = true) {
    const div = document.createElement('div');
    div.className = `message ${role}`;

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    if (role === 'user') {
        avatar.innerHTML = '<i class="fas fa-user"></i>';
    } else {
        avatar.innerHTML = '<i class="fas fa-robot"></i>';
    }

    const content = document.createElement('div');
    content.className = 'message-content';

    if (isMarkdown && role === 'model') {
        content.innerHTML = marked.parse(text);
    } else {
        const p = document.createElement('p');
        p.textContent = text;
        content.appendChild(p);
    }

    div.appendChild(avatar);
    div.appendChild(content);
    
    // Add message footer with actions for model messages
    if (role === 'model' && text !== '...') {
        const footer = document.createElement('div');
        footer.className = 'message-footer';
        footer.id = `footer-${Date.now()}`;
        
        // Hide footer initially if text is empty (streaming)
        if (!text) footer.style.display = 'none';

        const copyBtn = document.createElement('button');
        copyBtn.className = 'action-btn';
        copyBtn.innerHTML = '<i class="far fa-copy"></i> Copy';
        copyBtn.onclick = () => copyToClipboard(text || div.querySelector('.message-content').innerText, copyBtn);
        
        const regenBtn = document.createElement('button');
        regenBtn.className = 'action-btn';
        regenBtn.innerHTML = '<i class="fas fa-redo"></i> Regenerate';
        regenBtn.onclick = () => regenerateLastResponse();
        
        footer.appendChild(copyBtn);
        footer.appendChild(regenBtn);
        content.appendChild(footer);
        div.dataset.footerId = footer.id;
    }
    
    messagesContainer.appendChild(div);

    // Auto scroll to bottom
    const chatContainer = document.getElementById('chatContainer');
    chatContainer.scrollTop = chatContainer.scrollHeight;

    return content;
}

function showTypingIndicator() {
    const div = document.createElement('div');
    div.className = 'message model typing';
    div.id = 'typingIndicator';

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.innerHTML = '<i class="fas fa-robot"></i>';

    const content = document.createElement('div');
    content.className = 'message-content';

    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';

    content.appendChild(indicator);
    div.appendChild(avatar);
    div.appendChild(content);
    messagesContainer.appendChild(div);

    const chatContainer = document.getElementById('chatContainer');
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function hideTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
        indicator.remove();
    }
}

async function sendMessage(overrideText = null) {
    const text = overrideText || userInput.value.trim();
    if (!text && !overrideText) return;

    if (!overrideText) {
        userInput.value = '';
        userInput.style.height = 'auto';
    }
    
    sendBtn.disabled = false;
    toggleSendIcon(true); // Switch to stop icon
    welcomeScreen.style.display = 'none';

    if (!overrideText) {
        renderMessage('user', text, false);
        chatHistory.push({
            role: "user",
            parts: [{ text: text }]
        });
    }

    isGenerating = true;
    showTypingIndicator();
    
    abortController = new AbortController();

    try {
        // Show typing indicator initially
        showTypingIndicator();
        
        const contentElement = renderMessage('model', '', true);
        const typingIndicator = document.getElementById('typingIndicator');
        
        abortController = new AbortController();
        
        let fullResponseText = "";
        
        await callPollinationsAPI(text, attachedFiles, abortController.signal, (chunk) => {
            // Hide indicator on first chunk
            if (typingIndicator) typingIndicator.style.display = 'none';
            
            fullResponseText += chunk;
            contentElement.innerHTML = marked.parse(fullResponseText);
            
            // Auto scroll
            const chatContainer = document.getElementById('chatContainer');
            chatContainer.scrollTop = chatContainer.scrollHeight;
        });

        hideTypingIndicator();
        
        // Show footer and update copy logic after streaming is done
        const messageDiv = contentElement.parentElement;
        const footer = document.getElementById(messageDiv.dataset.footerId);
        if (footer) {
            footer.style.display = 'flex';
            const copyBtn = footer.querySelector('.action-btn');
            copyBtn.onclick = () => copyToClipboard(fullResponseText, copyBtn);
        }

        chatHistory.push({
            role: "model",
            parts: [{ text: fullResponseText }]
        });
        
        clearAttachments();
        saveCurrentChat();

    } catch (error) {
        hideTypingIndicator();
        if (error.name === 'AbortError') {
            renderMessage('model', '_Generation stopped._', true);
        } else {
            renderMessage('model', `**Error:** ${error.message}`, true);
        }
    } finally {
        isGenerating = false;
        toggleSendIcon(false); // Switch back to send icon
        abortController = null;
        if (userInput.value.trim()) {
            sendBtn.disabled = false;
        } else {
            sendBtn.disabled = true;
        }
    }
}

function toggleSendIcon(isWorking) {
    if (isWorking) {
        sendIcon.style.display = 'none';
        stopIcon.style.display = 'block';
        sendBtn.disabled = false;
    } else {
        sendIcon.style.display = 'block';
        stopIcon.style.display = 'none';
    }
}

function stopGeneration() {
    if (abortController) {
        abortController.abort();
    }
}

window.copyCode = function(id, btn) {
    const code = document.getElementById(id).innerText;
    navigator.clipboard.writeText(code).then(() => {
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        setTimeout(() => {
            btn.innerHTML = originalHTML;
        }, 2000);
    });
}

function copyToClipboard(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        btn.classList.add('copy-success');
        setTimeout(() => {
            btn.innerHTML = originalHTML;
            btn.classList.remove('copy-success');
        }, 2000);
    });
}

function regenerateLastResponse() {
    if (isGenerating || chatHistory.length < 2) return;
    
    // Find last user message
    let lastUserMessage = "";
    for (let i = chatHistory.length - 1; i >= 0; i--) {
        if (chatHistory[i].role === 'user') {
            lastUserMessage = chatHistory[i].parts[0].text;
            // Remove everything after this message to "rewind"
            chatHistory = chatHistory.slice(0, i + 1);
            
            // Remove messages from UI
            const messages = messagesContainer.querySelectorAll('.message');
            for (let j = messages.length - 1; j > i; j--) {
                messages[j].remove();
            }
            break;
        }
    }
    
    if (lastUserMessage) {
        sendMessage(lastUserMessage);
    }
}

function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        micBtn.style.display = 'none';
        return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
        isRecording = true;
        micBtn.classList.add('recording');
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        userInput.value += (userInput.value ? ' ' : '') + transcript;
        userInput.dispatchEvent(new Event('input'));
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        stopRecording();
    };

    recognition.onend = () => {
        stopRecording();
    };
}

function toggleRecording() {
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
}

function startRecording() {
    if (recognition) {
        try {
            recognition.start();
        } catch (e) {
            console.error(e);
        }
    }
}

function stopRecording() {
    if (recognition) {
        recognition.stop();
    }
    isRecording = false;
    micBtn.classList.remove('recording');
}

// File Handling Functions
async function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    for (const file of files) {
        if (attachedFiles.length >= 5) {
            alert("You can only attach up to 5 files.");
            break;
        }
        
        const base64 = await readAsBase64(file);
        const fileObj = {
            id: Date.now() + Math.random(),
            name: file.name,
            type: file.type,
            data: base64
        };
        
        attachedFiles.push(fileObj);
        renderFilePreview(fileObj);
    }
    fileInput.value = ''; // Reset input
    sendBtn.disabled = false;
}

function readAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function renderFilePreview(file) {
    const item = document.createElement('div');
    item.className = 'file-preview-item';
    item.dataset.id = file.id;
    
    if (file.type.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = file.data;
        item.appendChild(img);
    } else {
        const icon = document.createElement('i');
        icon.className = 'fas fa-file-alt';
        item.appendChild(icon);
    }
    
    const removeBtn = document.createElement('div');
    removeBtn.className = 'remove-file';
    removeBtn.innerHTML = '<i class="fas fa-times"></i>';
    removeBtn.onclick = () => removeFile(file.id);
    
    item.appendChild(removeBtn);
    filePreviewContainer.appendChild(item);
}

function removeFile(id) {
    attachedFiles = attachedFiles.filter(f => f.id !== id);
    const item = filePreviewContainer.querySelector(`[data-id="${id}"]`);
    if (item) item.remove();
    if (attachedFiles.length === 0 && !userInput.value.trim()) {
        sendBtn.disabled = true;
    }
}

function clearAttachments() {
    attachedFiles = [];
    filePreviewContainer.innerHTML = '';
}

async function callPollinationsAPI(prompt, files, signal, onChunk) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString();
    const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const systemInstruction = `
System Knowledge Cutoff: 2026
Current Date: ${dateStr}
Current Time: ${timeStr}
Bot Persona: You are Dharun's Ai Chatbot, a premium, state-of-the-art AI assistant.
Intelligence Level: Act as a high-end reasoning model with deep local knowledge of Tamil Nadu.
Context: The 2026 Tamil Nadu Legislative Assembly elections have recently concluded.
Key Facts for 2026:
1. K. A. Sengottaiyan is the current MLA of Gobichettipalayam (re-elected in 2026).
2. The current Chief Minister of Tamil Nadu is C. Joseph Vijay (Thalapathy Vijay).
Guidelines: Provide extremely accurate, helpful, and fact-checked information based on the 2026 context provided. Be precise about political representatives and local events.
    `.trim();

    const messages = [
        { role: "system", content: systemInstruction }
    ];

    chatHistory.forEach(msg => {
        const role = msg.role === 'user' ? 'user' : 'assistant';
        messages.push({ role: role, content: msg.parts[0].text });
    });

    const userContent = [];
    userContent.push({ type: "text", text: prompt });
    
    files.forEach(file => {
        if (file.type.startsWith('image/')) {
            userContent.push({
                type: "image_url",
                image_url: { url: file.data }
            });
        } else {
            userContent[0].text += `\n[User attached file: ${file.name}]`;
        }
    });

    messages.push({ role: "user", content: userContent });

    const requestBody = {
        messages: messages,
        model: "openai",
        seed: 42,
        jsonMode: false,
        stream: true // Enable streaming
    };

    const response = await fetch("https://text.pollinations.ai/", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${errorText || response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop(); // Keep the last partial line in the buffer

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || !trimmedLine.startsWith("data: ")) continue;
            
            const data = trimmedLine.substring(6);
            if (data === "[DONE]") continue;
            
            try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content || "";
                if (content) {
                    onChunk(content);
                }
            } catch (e) {
                console.error("Error parsing JSON chunk:", e, data);
            }
        }
    }
}

// Start app
init();
