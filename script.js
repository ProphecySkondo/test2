let token = '';
let userData = null;
let commands = [];
let botRunning = false;
let botInterval = null;
let processedMessages = new Set();
let globe = null;
let globeScene = null;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let INTERSECTED = null;
let markers = [];

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

// Bot API wrapper with improved error handling
const bot = {
    sendMessage: async function (channelId, content) {
        try {
            const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
                method: 'POST',
                headers: {
                    'Authorization': token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ content: String(content) })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.message || `HTTP ${response.status}`);
            }

            return await response.json();
        } catch (e) {
            logBot(`Failed to send message: ${e.message}`, true);
        }
    }
};

// Analyze token and fetch user info
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

        if (!response.ok) throw new Error('Invalid token - Check your token and try again');

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

// Display user info cards
function displayStats() {
    const grid = document.getElementById('statsGrid');
    const createdDate = new Date(parseInt(userData.id) / 4194304 + 1420070400000);

    grid.innerHTML = `
        <div class="stat-card"><div class="stat-label">Username</div><div class="stat-value">${escapeHtml(userData.username)}#${userData.discriminator}</div></div>
        <div class="stat-card"><div class="stat-label">Email</div><div class="stat-value">${escapeHtml(userData.email || 'Not available')}</div></div>
        <div class="stat-card"><div class="stat-label">User ID</div><div class="stat-value">${userData.id}</div></div>
        <div class="stat-card"><div class="stat-label">Account Created</div><div class="stat-value">${createdDate.toLocaleDateString()}</div></div>
        <div class="stat-card"><div class="stat-label">Phone</div><div class="stat-value">${escapeHtml(userData.phone || 'Not linked')}</div></div>
        <div class="stat-card"><div class="stat-label">Verified</div><div class="stat-value">${userData.verified ? '✓ Yes' : '✗ No'}</div></div>
    `;
}

// Get location data and render list
async function displayLocations() {
    const list = document.getElementById('locationList');
    list.innerHTML = '<div class="loading">Fetching location data...</div>';

    try {
        const ipResponse = await fetch('https://ipapi.co/json/');
        const ipData = await ipResponse.json();

        const location = {
            city: ipData.city || 'Unknown',
            region: ipData.region || 'Unknown',
            country: ipData.country_name || 'Unknown',
            ip: ipData.ip || 'Hidden',
            lat: ipData.latitude || 0,
            lon: ipData.longitude || 0,
            timezone: ipData.timezone || 'Unknown'
        };

        list.innerHTML = `
            <div class="location-item" data-lat="${location.lat}" data-lon="${location.lon}">
                <div class="location-header">
                    <div class="location-city">${location.city}, ${location.region}</div>
                    <div class="location-country">${location.country}</div>
                </div>
                <div class="location-ip">IP: ${location.ip}</div>
                <div class="location-ip">Timezone: ${location.timezone}</div>
                <div class="location-ip"><a href="https://www.google.com/maps?q=${location.lat},${location.lon}" target="_blank">📍 Open in Google Maps</a></div>
            </div>
        `;

        return [location];
    } catch (e) {
        list.innerHTML = '<div class="error">Could not fetch location data</div>';
        return [{ lat: 0, lon: 0 }];
    }
}

// Enhanced 3D globe
function initGlobe() {
    const container = document.getElementById('globeContainer');
    container.innerHTML = '';

    const scene = new THREE.Scene();
    globeScene = scene;
    const camera = new THREE.PerspectiveCamera(70, container.clientWidth / container.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 1);
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const globeGeo = new THREE.SphereGeometry(2, 64, 64);
    const globeMat = new THREE.MeshPhongMaterial({
        color: 0x2563eb,
        emissive: 0x1e3a8a,
        shininess: 50
    });
    globe = new THREE.Mesh(globeGeo, globeMat);
    scene.add(globe);

    camera.position.z = 5;

    // Load and mark location
    displayLocations().then(locations => {
        locations.forEach(loc => {
            const phi = (90 - loc.lat) * (Math.PI / 180);
            const theta = (loc.lon + 180) * (Math.PI / 180);

            const x = -2 * Math.sin(phi) * Math.cos(theta);
            const y = 2 * Math.cos(phi);
            const z = 2 * Math.sin(phi) * Math.sin(theta);

            const marker = new THREE.Mesh(
                new THREE.SphereGeometry(0.08, 16, 16),
                new THREE.MeshBasicMaterial({ color: 0x22c55e })
            );
            marker.position.set(x, y, z);
            marker.userData = loc;
            scene.add(marker);
            markers.push(marker);
        });
    });

    // Animate rotation
    function animate() {
        requestAnimationFrame(animate);
        globe.rotation.y += 0.0012;
        renderer.render(scene, camera);
    }
    animate();

    // Hover detection
    const tooltip = document.createElement('div');
    tooltip.className = 'globe-tooltip';
    tooltip.style.position = 'absolute';
    tooltip.style.padding = '6px 10px';
    tooltip.style.background = 'rgba(0,0,0,0.7)';
    tooltip.style.color = 'white';
    tooltip.style.borderRadius = '6px';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.display = 'none';
    container.appendChild(tooltip);

    renderer.domElement.addEventListener('mousemove', (event) => {
        mouse.x = (event.offsetX / container.clientWidth) * 2 - 1;
        mouse.y = -(event.offsetY / container.clientHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(markers);

        if (intersects.length > 0) {
            const obj = intersects[0].object;
            if (INTERSECTED !== obj) {
                INTERSECTED = obj;
                const data = obj.userData;
                tooltip.innerHTML = `${data.city}, ${data.country}<br><a href="https://www.google.com/maps?q=${data.lat},${data.lon}" target="_blank" style="color:#60a5fa">View on Google Maps</a>`;
                tooltip.style.display = 'block';
            }
            tooltip.style.left = `${event.offsetX + 10}px`;
            tooltip.style.top = `${event.offsetY + 10}px`;
        } else {
            INTERSECTED = null;
            tooltip.style.display = 'none';
        }
    });
}

// Toggle bot
async function toggleBot() {
    const btn = document.getElementById('botToggle');
    const status = document.getElementById('botStatus');

    if (botRunning) {
        clearInterval(botInterval);
        botRunning = false;
        btn.textContent = 'Start Bot';
        status.textContent = 'Bot stopped.';
        logBot('Bot stopped');
        return;
    }

    botRunning = true;
    btn.textContent = 'Stop Bot';
    status.textContent = 'Bot running...';
    logBot('Bot started.');

    processedMessages.clear();
    checkMessages();
    botInterval = setInterval(checkMessages, 2000);
}

// Message checking with better error handling
async function checkMessages() {
    if (!botRunning) return;
    try {
        const res = await fetch('https://discord.com/api/v10/users/@me/channels', {
            headers: { 'Authorization': token }
        });
        if (!res.ok) return;
        const channels = await res.json();

        for (const channel of channels) {
            const msgRes = await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages?limit=10`, {
                headers: { 'Authorization': token }
            });
            if (!msgRes.ok) continue;

            const messages = await msgRes.json();
            for (const message of messages) {
                if (processedMessages.has(message.id) || message.author.id === userData.id) continue;
                processedMessages.add(message.id);

                for (const cmd of commands) {
                    const full = cmd.prefix + cmd.name;
                    if (message.content.startsWith(full)) {
                        const args = message.content.slice(full.length).trim().split(/\s+/);
                        try {
                            await executeCommand(cmd, message, args);
                            logBot(`Executed ${full} from ${message.author.username}`);
                        } catch (err) {
                            logBot(`Error in ${full}: ${err.message}`, true);
                        }
                        break;
                    }
                }
            }
        }
    } catch (err) {
        logBot('Check messages failed: ' + err.message, true);
    }
}

// Execute commands safely
async function executeCommand(cmd, message, args) {
    const fn = new Function('bot', 'message', 'args', 'commands', `
        return (async () => {
            ${cmd.code}
        })();
    `);
    return fn(bot, message, args, commands);
}

// Logging utility
function logBot(msg, isError = false) {
    const logs = document.getElementById('botLogs');
    const div = document.createElement('div');
    div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    div.style.color = isError ? '#ef4444' : '#a1a1aa';
    logs.prepend(div);
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
