let token = '';
let userData = null;
let commands = [];
let botRunning = false;
let botInterval = null;
let processedMessages = new Set();
let globe = null;
let globeScene = null;

// Built-in commands
const builtInCommands = [
    {
        name: 'ping',
        prefix: '!',
        description: 'Check if the bot is responsive',
        code: `bot.sendMessage(message.channel_id, 'Pong! 🏓');`,
        builtin: true
    },
    {
        name: 'help',
        prefix: '!',
        description: 'List all available commands',
        code: `const cmdList = commands.map(c => c.prefix + c.name + ' - ' + c.description).join('\\n');
bot.sendMessage(message.channel_id, '**Available Commands:**\\n' + cmdList);`,
        builtin: true
    },
    {
        name: 'userinfo',
        prefix: '!',
        description: 'Display information about yourself',
        code: `const info = '**Username:** ' + message.author.username + '\\n**ID:** ' + message.author.id + '\\n**Discriminator:** ' + message.author.discriminator;
bot.sendMessage(message.channel_id, info);`,
        builtin: true
    },
    {
        name: 'echo',
        prefix: '!',
        description: 'Repeat what you say',
        code: `if (args.length === 0) {
    bot.sendMessage(message.channel_id, 'Please provide text to echo!');
} else {
    bot.sendMessage(message.channel_id, args.join(' '));
}`,
        builtin: true
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
            const error = await response.json();
            throw new Error('Failed to send message: ' + (error.message || 'Unknown error'));
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
            throw new Error('Invalid token - Check your token and try again');
        }

        userData = await response.json();
        
        document.getElementById('tokenSection').classList.add('hidden');
        document.getElementById('mainSection').classList.remove('hidden');
        
        displayStats();
        await displayLocations();
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
            <div class="stat-value" style="font-size: 1.2rem;">${escapeHtml(userData.username)}#${userData.discriminator}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Email</div>
            <div class="stat-value" style="font-size: 1rem;">${escapeHtml(userData.email || 'Not available')}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">User ID</div>
            <div class="stat-value" style="font-size: 0.9rem;">${userData.id}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Account Created</div>
            <div class="stat-value" style="font-size: 1rem;">${createdDate.toLocaleDateString()}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Phone</div>
            <div class="stat-value" style="font-size: 1rem;">${escapeHtml(userData.phone || 'Not linked')}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Verified</div>
            <div class="stat-value" style="font-size: 1.2rem;">${userData.verified ? '✓ Yes' : '✗ No'}</div>
        </div>
    `;
}

async function displayLocations() {
    // Try to get actual location data
    const list = document.getElementById('locationList');
    list.innerHTML = '<div class="loading">Loading location data...</div>';
    
    try {
        // Get user's approximate location from IP
        const ipResponse = await fetch('https://ipapi.co/json/');
        const ipData = await ipResponse.json();
        
        const locations = [
            { 
                city: ipData.city || 'Unknown', 
                country: ipData.country_name || 'Unknown', 
                ip: ipData.ip || 'Hidden',
                lat: ipData.latitude || 0,
                lon: ipData.longitude || 0,
                region: ipData.region || 'Unknown',
                timezone: ipData.timezone || 'Unknown'
            }
        ];

        list.innerHTML = locations.map(loc => `
            <div class="location-item">
                <div class="location-header">
                    <div>
                        <div class="location-city">${loc.city}, ${loc.region}</div>
                        <div class="location-country">${loc.country}</div>
                    </div>
                </div>
                <div class="location-ip">IP: ${loc.ip}</div>
                <div class="location-ip">Timezone: ${loc.timezone}</div>
                <div class="location-ip">Coordinates: ${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)}</div>
            </div>
        `).join('');

        return locations;
    } catch (error) {
        list.innerHTML = '<div class="error">Could not fetch location data</div>';
        return [{ lat: 0, lon: 0, city: 'Unknown', country: 'Unknown' }];
    }
}

function initGlobe() {
    const container = document.getElementById('globeContainer');
    container.innerHTML = '';
    
    const scene = new THREE.Scene();
    globeScene = scene;
    const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x0a0a0a, 1);
    container.appendChild(renderer.domElement);

    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 2);
    scene.add(ambientLight);

    // Add point light
    const pointLight = new THREE.PointLight(0xffffff, 1, 100);
    pointLight.position.set(5, 5, 5);
    scene.add(pointLight);

    // Create globe with better material
    const geometry = new THREE.SphereGeometry(2, 64, 64);
    const material = new THREE.MeshPhongMaterial({
        color: 0x2563eb,
        wireframe: false,
        transparent: true,
        opacity: 0.8,
        shininess: 100
    });
    globe = new THREE.Mesh(geometry, material);
    scene.add(globe);

    // Add wireframe overlay
    const wireframeGeo = new THREE.SphereGeometry(2.01, 32, 32);
    const wireframeMat = new THREE.MeshBasicMaterial({
        color: 0x60a5fa,
        wireframe: true,
        transparent: true,
        opacity: 0.3
    });
    const wireframe = new THREE.Mesh(wireframeGeo, wireframeMat);
    scene.add(wireframe);

    // Add location markers with glow effect
    displayLocations().then(locations => {
        locations.forEach(loc => {
            // Main marker
            const markerGeometry = new THREE.SphereGeometry(0.08, 16, 16);
            const markerMaterial = new THREE.MeshBasicMaterial({ 
                color: 0x22c55e,
                transparent: true,
                opacity: 1
            });
            const marker = new THREE.Mesh(markerGeometry, markerMaterial);
            
            // Calculate position on sphere
            const phi = (90 - loc.lat) * (Math.PI / 180);
            const theta = (loc.lon + 180) * (Math.PI / 180);
            const radius = 2;
            
            marker.position.x = -radius * Math.sin(phi) * Math.cos(theta);
            marker.position.y = radius * Math.cos(phi);
            marker.position.z = radius * Math.sin(phi) * Math.sin(theta);
            scene.add(marker);

            // Glow effect
            const glowGeometry = new THREE.SphereGeometry(0.15, 16, 16);
            const glowMaterial = new THREE.MeshBasicMaterial({ 
                color: 0x22c55e,
                transparent: true,
                opacity: 0.3
            });
            const glow = new THREE.Mesh(glowGeometry, glowMaterial);
            glow.position.copy(marker.position);
            scene.add(glow);

            // Pulsing animation for markers
            const pulse = () => {
                glow.scale.x = glow.scale.y = glow.scale.z = 1 + Math.sin(Date.now() * 0.003) * 0.3;
            };
            glow.userData.pulse = pulse;
        });
    });

    camera.position.z = 5;

    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let rotationVelocity = { x: 0.001, y: 0.001 };

    // Mouse controls
    renderer.domElement.addEventListener('mousedown', (e) => {
        isDragging = true;
    });

    renderer.domElement.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const deltaX = e.clientX - previousMousePosition.x;
            const deltaY = e.clientY - previousMousePosition.y;
            
            rotationVelocity.x = deltaY * 0.001;
            rotationVelocity.y = deltaX * 0.001;
        }
        previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    renderer.domElement.addEventListener('mouseup', () => {
        isDragging = false;
    });

    // Zoom with mouse wheel
    renderer.domElement.addEventListener('wheel', (e) => {
        e.preventDefault();
        camera.position.z += e.deltaY * 0.01;
        camera.position.z = Math.max(3, Math.min(10, camera.position.z));
    });

    function animate() {
        requestAnimationFrame(animate);
        
        if (!isDragging) {
            globe.rotation.y += rotationVelocity.y * 0.5;
            globe.rotation.x += rotationVelocity.x * 0.5;
            rotationVelocity.x *= 0.95;
            rotationVelocity.y *= 0.95;
        } else {
            globe.rotation.y += rotationVelocity.y;
            globe.rotation.x += rotationVelocity.x;
        }
        
        // Animate glowing markers
        scene.children.forEach(child => {
            if (child.userData.pulse) {
                child.userData.pulse();
            }
        });
        
        renderer.render(scene, camera);
    }
    animate();

    // Handle window resize
    window.addEventListener('resize', () => {
        if (container.offsetWidth > 0) {
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        }
    });
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

    // Check for duplicate commands
    const duplicate = commands.find(cmd => cmd.name === name && cmd.prefix === prefix);
    if (duplicate) {
        errorDiv.textContent = 'A command with this name and prefix already exists';
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
                <div style="flex: 1;">
                    <div class="command-name">${escapeHtml(cmd.prefix)}${escapeHtml(cmd.name)}</div>
                    <div class="command-description">${escapeHtml(cmd.description || 'No description')}</div>
                    ${cmd.builtin ? '<span style="color: #22c55e; font-size: 0.75rem;">Built-in</span>' : ''}
                </div>
                <div class="command-actions">
                    ${cmd.custom ? `
                        <button class="btn btn-secondary" style="padding: 0.5rem 0.75rem;" onclick="editCommand(${index})">Edit</button>
                        <button class="btn btn-danger" style="padding: 0.5rem 0.75rem;" onclick="deleteCommand(${index})">Delete</button>
                    ` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

function editCommand(index) {
    const cmd = commands[index];
    document.getElementById('cmdName').value = cmd.name;
    document.getElementById('cmdPrefix').value = cmd.prefix;
    document.getElementById('cmdDescription').value = cmd.description;
    document.getElementById('cmdCode').value = cmd.code;
    
    deleteCommand(index);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
        processedMessages.clear();
    } else {
        botRunning = true;
        btn.textContent = 'Stop Bot';
        btn.classList.remove('btn-success');
        btn.classList.add('btn-danger');
        status.textContent = 'Bot is running and listening for commands...';
        status.style.color = '#22c55e';
        logBot('Bot started - Listening for commands');
        logBot('Available commands: ' + commands.map(c => c.prefix + c.name).join(', '));
        
        // Clear processed messages when starting
        processedMessages.clear();
        
        // Start polling for messages
        checkMessages(); // Check immediately
        botInterval = setInterval(checkMessages, 1500);
    }
}

async function checkMessages() {
    if (!botRunning) return;
    
    try {
        // Get DM channels
        const channelsResponse = await fetch('https://discord.com/api/v10/users/@me/channels', {
            headers: { 'Authorization': token }
        });
        
        if (!channelsResponse.ok) {
            logBot('Failed to fetch channels', true);
            return;
        }
        
        const channels = await channelsResponse.json();
        
        // Check each channel for new messages
        for (const channel of channels) {
            try {
                const messagesResponse = await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages?limit=10`, {
                    headers: { 'Authorization': token }
                });
                
                if (!messagesResponse.ok) continue;
                
                const messages = await messagesResponse.json();
                
                for (const message of messages) {
                    // Skip if we've already processed this message
                    if (processedMessages.has(message.id)) continue;
                    
                    // Mark as processed
                    processedMessages.add(message.id);
                    
                    // Skip our own messages
                    if (message.author.id === userData.id) continue;
                    
                    // Check if message matches any command
                    for (const cmd of commands) {
                        const fullCommand = cmd.prefix + cmd.name;
                        const messageStart = message.content.trim();
                        
                        // Check if message starts with command (with space or end of string after)
                        if (messageStart === fullCommand || messageStart.startsWith(fullCommand + ' ')) {
                            // Extract arguments
                            const argString = message.content.slice(fullCommand.length).trim();
                            const args = argString ? argString.split(/\s+/) : [];
                            
                            // Execute command
                            try {
                                await executeCommand(cmd, message, args);
                                logBot(`✓ Executed: ${fullCommand} from ${message.author.username}`);
                            } catch (err) {
                                logBot(`✗ Error in ${fullCommand}: ${err.message}`, true);
                            }
                            
                            break;
                        }
                    }
                }
            } catch (err) {
                console.error('Error processing channel:', err);
            }
        }
    } catch (err) {
        logBot(`Error: ${err.message}`, true);
    }
}

async function executeCommand(cmd, message, args) {
    try {
        // Create a safe execution context with proper error handling
        const commandFunc = new Function('bot', 'message', 'args', 'commands', `
            return (async function() {
                ${cmd.code}
            })();
        `);
        await commandFunc(bot, message, args, commands);
    } catch (error) {
        throw new Error(error.message);
    }
}

function logBot(message, isError = false) {
    const logsDiv = document.getElementById('botLogs');
    const logEntry = document.createElement('div');
    logEntry.style.color = isError ? '#ef4444' : '#a1a1aa';
    logEntry.style.fontSize = '0.85rem';
    logEntry.style.marginBottom = '0.5rem';
    logEntry.style.padding = '0.5rem';
    logEntry.style.background = '#27272a';
    logEntry.style.borderRadius = '0.25rem';
    logEntry.style.borderLeft = isError ? '3px solid #ef4444' : '3px solid #22c55e';
    logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logsDiv.insertBefore(logEntry, logsDiv.firstChild);
    
    // Keep only last 50 logs
    while (logsDiv.children.length > 50) {
        logsDiv.removeChild(logsDiv.lastChild);
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
