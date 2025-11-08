let token = '';
let userData = null;
let commands = [];
let botRunning = false;
let botInterval = null;
let lastMessageId = null;

// Built-in commands
const builtInCommands = [
    {
        name: 'ping',
        prefix: '!',
        description: 'Check if the bot is responsive',
        code: `bot.sendMessage(message.channel_id, 'Pong! 🏓');`
    },
    {
        name: 'help',
        prefix: '!',
        description: 'List all available commands',
        code: `const cmdList = commands.map(c => c.prefix + c.name + ' - ' + c.description).join('\\n');
bot.sendMessage(message.channel_id, 'Available Commands:\\n' + cmdList);`
    },
    {
        name: 'userinfo',
        prefix: '!',
        description: 'Display information about yourself',
        code: `const info = 'Username: ' + message.author.username + '\\nID: ' + message.author.id + '\\nDiscriminator: ' + message.author.discriminator;
bot.sendMessage(message.channel_id, info);`
    }
];

// Load commands from built-ins
commands = [...builtInCommands];

// Bot API wrapper
const bot = {
    sendMessage: async function(channelId, content) {
        const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content: String(content) })
        });
        if (!response.ok) {
            throw new Error('Failed to send message');
        }
        return await response.json();
    },
    editMessage: async function(channelId, messageId, content) {
        const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content: String(content) })
        });
        if (!response.ok) {
            throw new Error('Failed to edit message');
        }
        return await response.json();
    },
    deleteMessage: async function(channelId, messageId) {
        const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`, {
            method: 'DELETE',
            headers: { 'Authorization': token }
        });
        if (!response.ok) {
            throw new Error('Failed to delete message');
        }
    }
};

async function analyzeToken() {
    token = document.getElementById('tokenInput').value.trim();
    const errorDiv = document.getElementById('tokenError');
    
    if (!token) {
        errorDiv.textContent = 'Please enter a token';
        errorDiv.classList.remove('hidden');
        return;
    }

    errorDiv.classList.add('hidden');

    try {
        const response = await fetch('https://discord.com/api/v10/users/@me', {
            headers: { 'Authorization': token }
        });

        if (!response.ok) {
            throw new Error('Invalid token');
        }

        userData = await response.json();
        
        document.getElementById('tokenSection').classList.add('hidden');
        document.getElementById('mainSection').classList.remove('hidden');
        
        displayStats();
        displayLocations();
        displayCommands();
        initGlobe();
    } catch (err) {
        errorDiv.textContent = err.message;
        errorDiv.classList.remove('hidden');
    }
}

function displayStats() {
    const grid = document.getElementById('statsGrid');
    const createdDate = new Date(parseInt(userData.id) / 4194304 + 1420070400000);
    
    grid.innerHTML = `
        <div class="stat-card">
            <div class="stat-label">Username</div>
            <div class="stat-value" style="font-size: 1.2rem;">${escapeHtml(userData.username)}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">User ID</div>
            <div class="stat-value" style="font-size: 1rem;">${userData.id}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Account Created</div>
            <div class="stat-value" style="font-size: 1rem;">${createdDate.toLocaleDateString()}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Verified</div>
            <div class="stat-value" style="font-size: 1.2rem;">${userData.verified ? '✓' : '✗'}</div>
        </div>
    `;
}

function displayLocations() {
    // Simulated location data (Discord doesn't provide this via API)
    const locations = [
        { city: 'Norfolk', country: 'United States', ip: '192.168.1.1', lat: 36.8508, lon: -76.2859 },
        { city: 'New York', country: 'United States', ip: '192.168.1.2', lat: 40.7128, lon: -74.0060 }
    ];

    const list = document.getElementById('locationList');
    list.innerHTML = locations.map(loc => `
        <div class="location-item">
            <div class="location-header">
                <div>
                    <div class="location-city">${loc.city}</div>
                    <div class="location-country">${loc.country}</div>
                </div>
            </div>
            <div class="location-ip">IP: ${loc.ip}</div>
        </div>
    `).join('');
}

function initGlobe() {
    const container = document.getElementById('globeContainer');
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x27272a);
    container.appendChild(renderer.domElement);

    // Create globe
    const geometry = new THREE.SphereGeometry(2, 32, 32);
    const material = new THREE.MeshBasicMaterial({
        color: 0x3f3f46,
        wireframe: true
    });
    const globe = new THREE.Mesh(geometry, material);
    scene.add(globe);

    // Add location markers
    const markerGeometry = new THREE.SphereGeometry(0.05, 16, 16);
    const markerMaterial = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    
    const locations = [
        { lat: 36.8508, lon: -76.2859 }, // Norfolk
        { lat: 40.7128, lon: -74.0060 }  // New York
    ];

    locations.forEach(loc => {
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        const phi = (90 - loc.lat) * (Math.PI / 180);
        const theta = (loc.lon + 180) * (Math.PI / 180);
        marker.position.x = -2 * Math.sin(phi) * Math.cos(theta);
        marker.position.y = 2 * Math.cos(phi);
        marker.position.z = 2 * Math.sin(phi) * Math.sin(theta);
        scene.add(marker);
    });

    camera.position.z = 5;

    function animate() {
        requestAnimationFrame(animate);
        globe.rotation.y += 0.002;
        renderer.render(scene, camera);
    }
    animate();
}

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    document.getElementById('activityTab').classList.add('hidden');
    document.getElementById('commandsTab').classList.add('hidden');
    document.getElementById('docsTab').classList.add('hidden');

    if (tab === 'activity') document.getElementById('activityTab').classList.remove('hidden');
    if (tab === 'commands') document.getElementById('commandsTab').classList.remove('hidden');
    if (tab === 'docs') document.getElementById('docsTab').classList.remove('hidden');
}

function addCommand() {
    const name = document.getElementById('cmdName').value.trim();
    const prefix = document.getElementById('cmdPrefix').value.trim();
    const description = document.getElementById('cmdDescription').value.trim();
    const code = document.getElementById('cmdCode').value.trim();
    const errorDiv = document.getElementById('commandError');
    const successDiv = document.getElementById('commandSuccess');

    errorDiv.classList.add('hidden');
    successDiv.classList.add('hidden');

    if (!name || !prefix || !code) {
        errorDiv.textContent = 'Please fill in all required fields';
        errorDiv.classList.remove('hidden');
        return;
    }

    commands.push({ name, prefix, description, code, custom: true });
    
    document.getElementById('cmdName').value = '';
    document.getElementById('cmdPrefix').value = '';
    document.getElementById('cmdDescription').value = '';
    document.getElementById('cmdCode').value = '';

    successDiv.textContent = 'Command added successfully!';
    successDiv.classList.remove('hidden');

    displayCommands();
}

function displayCommands() {
    const list = document.getElementById('commandList');
    
    if (commands.length === 0) {
        list.innerHTML = '<div class="loading">No commands yet</div>';
        return;
    }

    list.innerHTML = commands.map((cmd, index) => `
        <div class="command-item">
            <div class="command-header">
                <div>
                    <div class="command-name">${escapeHtml(cmd.prefix)}${escapeHtml(cmd.name)}</div>
                    <div class="command-description">${escapeHtml(cmd.description || 'No description')}</div>
                </div>
                <div class="command-actions">
                    ${cmd.custom ? `<button class="btn btn-danger" style="padding: 0.5rem 0.75rem;" onclick="deleteCommand(${index})">Delete</button>` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

function deleteCommand(index) {
    commands.splice(index, 1);
    displayCommands();
}

async function toggleBot() {
    const btn = document.getElementById('botToggle');
    const status = document.getElementById('botStatus');

    if (botRunning) {
        clearInterval(botInterval);
        botRunning = false;
        btn.textContent = 'Start Bot';
        btn.classList.remove('btn-danger');
        btn.classList.add('btn-success');
        status.textContent = 'Bot is stopped';
        status.style.color = '#71717a';
        logBot('Bot stopped');
    } else {
        botRunning = true;
        btn.textContent = 'Stop Bot';
        btn.classList.remove('btn-success');
        btn.classList.add('btn-danger');
        status.textContent = 'Bot is running...';
        status.style.color = '#22c55e';
        logBot('Bot started - listening for commands');
        
        // Start polling for messages
        botInterval = setInterval(checkMessages, 2000);
    }
}

async function checkMessages() {
    try {
        // Get DM channels
        const channelsResponse = await fetch('https://discord.com/api/v10/users/@me/channels', {
            headers: { 'Authorization': token }
        });
        
        if (!channelsResponse.ok) return;
        
        const channels = await channelsResponse.json();
        
        // Check each channel for new messages
        for (const channel of channels) {
            const messagesResponse = await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages?limit=5`, {
                headers: { 'Authorization': token }
            });
            
            if (!messagesResponse.ok) continue;
            
            const messages = await messagesResponse.json();
            
            for (const message of messages) {
                // Skip if we've already processed this message
                if (lastMessageId && message.id <= lastMessageId) continue;
                
                // Skip our own messages
                if (message.author.id === userData.id) continue;
                
                // Check if message matches any command
                for (const cmd of commands) {
                    if (message.content.startsWith(cmd.prefix + cmd.name)) {
                        // Extract arguments
                        const args = message.content.slice((cmd.prefix + cmd.name).length).trim().split(/\s+/).filter(arg => arg.length > 0);
                        
                        // Execute command
                        try {
                            await executeCommand(cmd, message, args);
                            logBot(`Executed: ${cmd.prefix}${cmd.name} in ${channel.id}`);
                        } catch (err) {
                            logBot(`Error executing ${cmd.prefix}${cmd.name}: ${err.message}`, true);
                        }
                        
                        break;
                    }
                }
            }
            
            // Update last message ID
            if (messages.length > 0) {
                lastMessageId = messages[0].id;
            }
        }
    } catch (err) {
        logBot(`Error checking messages: ${err.message}`, true);
    }
}

async function executeCommand(cmd, message, args) {
    // Create a safe execution context
    const commandFunc = new Function('bot', 'message', 'args', 'commands', cmd.code);
    await commandFunc(bot, message, args, commands);
}

function logBot(message, isError = false) {
    const logsDiv = document.getElementById('botLogs');
    const logEntry = document.createElement('div');
    logEntry.style.color = isError ? '#ef4444' : '#a1a1aa';
    logEntry.style.fontSize = '0.85rem';
    logEntry.style.marginBottom = '0.5rem';
    logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logsDiv.appendChild(logEntry);
    logsDiv.scrollTop = logsDiv.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}