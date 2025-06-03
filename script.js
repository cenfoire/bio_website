const DISCORD_USER_ID = '200207310625177602'; 
const LANYARD_WS_URL = 'wss://api.lanyard.rest/socket';

let socket = null;
let heartbeatInterval = null;
let spotifyUpdateInterval = null;
let mouseX = 0;
let mouseY = 0;
let cursorX = 0;
let cursorY = 0;

document.addEventListener('DOMContentLoaded', function() {
    initCustomCursor();
    createFloatingElements();
    connectToLanyard();
    initLinkCopyFeature();
});

function initCustomCursor() {
    const cursor = document.getElementById('cursor');
    const interactiveElements = document.querySelectorAll('a, button, .link-item, .avatar, .spotify-card, .discord-status, .activity-card');
    
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });
    
    function animateCursor() {
        const dx = mouseX - cursorX;
        const dy = mouseY - cursorY;
        
        // Suivi beaucoup plus rapide et fluide
        cursorX += dx * 0.85;
        cursorY += dy * 0.85;
        
        cursor.style.left = cursorX + 'px';
        cursor.style.top = cursorY + 'px';
        
        requestAnimationFrame(animateCursor);
    }
    animateCursor();
    
    document.addEventListener('mousedown', () => {
        cursor.classList.add('click');
    });
    
    document.addEventListener('mouseup', () => {
        cursor.classList.remove('click');
    });
    
    interactiveElements.forEach(el => {
        el.addEventListener('mouseenter', () => {
            cursor.classList.add('hover');
        });
        
        el.addEventListener('mouseleave', () => {
            cursor.classList.remove('hover');
        });
    });
}

function createFloatingElements() {
    const container = document.querySelector('.container');
    
    for (let i = 0; i < 3; i++) {
        const element = document.createElement('div');
        element.style.cssText = `
            position: absolute;
            width: ${Math.random() * 4 + 2}px;
            height: ${Math.random() * 4 + 2}px;
            background: rgba(255, 255, 255, ${Math.random() * 0.1 + 0.05});
            border-radius: 50%;
            pointer-events: none;
            animation: float ${Math.random() * 10 + 15}s linear infinite;
            left: ${Math.random() * 100}%;
            top: ${Math.random() * 100}%;
        `;
        container.appendChild(element);
    }
    
    const style = document.createElement('style');
    style.textContent = `
        @keyframes float {
            0% { transform: translateY(0px) rotate(0deg); opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { transform: translateY(-100vh) rotate(360deg); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}

function initLinkCopyFeature() {
    const copyLinks = document.querySelectorAll('[data-copy]');
    
    copyLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const textToCopy = link.getAttribute('data-copy');
            const type = link.getAttribute('data-type');
            
            navigator.clipboard.writeText(textToCopy).then(() => {
                showCopyNotification(`${type} copied to clipboard`);
            }).catch(() => {
                showCopyNotification('Failed to copy to clipboard');
            });
        });
    });
}

function showCopyNotification(message) {
    // Supprimer les notifications existantes
    const existingNotifications = document.querySelectorAll('.copy-notification');
    existingNotifications.forEach(notif => {
        notif.classList.add('hide');
        setTimeout(() => notif.remove(), 400);
    });
    
    // Créer la nouvelle notification
    const notification = document.createElement('div');
    notification.className = 'copy-notification';
    notification.innerHTML = `<span class="notification-text">${message}</span>`;
    
    document.body.appendChild(notification);
    
    // Déclencher l'animation d'apparition
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Supprimer automatiquement après 3 secondes
    setTimeout(() => {
        notification.classList.add('hide');
        setTimeout(() => {
            notification.parentNode.removeChild(notification);
        }, 400);
    }, 3000);
}

function connectToLanyard() {
    if (socket) {
        socket.close();
    }

    socket = new WebSocket(LANYARD_WS_URL);

    socket.onopen = function() {
        console.log('Connected to Lanyard');
    };

    socket.onmessage = function(event) {
        const data = JSON.parse(event.data);
        
        if (data.op === 1) {
            heartbeatInterval = setInterval(() => {
                if (socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({ op: 3 }));
                }
            }, data.d.heartbeat_interval);
            
            socket.send(JSON.stringify({
                op: 2,
                d: {
                    subscribe_to_id: DISCORD_USER_ID
                }
            }));
        } else if (data.op === 0) {
            updateDiscordStatus(data.d);
        }
    };

    socket.onclose = function() {
        console.log('Disconnected from Lanyard');
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
        }
        if (spotifyUpdateInterval) {
            clearInterval(spotifyUpdateInterval);
        }
        
        setTimeout(connectToLanyard, 5000);
    };

    socket.onerror = function(error) {
        console.error('Lanyard WebSocket error:', error);
    };
}

// Modifier les variables globales pour charger depuis localStorage
let lastActivity = JSON.parse(localStorage.getItem('lastActivity')) || null;
let lastActivityTime = localStorage.getItem('lastActivityTime') || null;

// Modifier la fonction updateDiscordStatus
function updateDiscordStatus(data) {
    const usernameElement = document.getElementById('username');
    const statusElement = document.getElementById('status');
    const statusTextElement = document.getElementById('status-text');
    const discordStatusElement = document.getElementById('discord-status');
    const discordActivityElement = document.getElementById('discord-activity');
    const spotifySection = document.getElementById('spotify-section');

    if (data.discord_user) {
        const displayName = data.discord_user.display_name || data.discord_user.username;
        usernameElement.textContent = displayName;
        
        const avatarElement = document.getElementById('avatar');
        if (data.discord_user.avatar) {
            const avatarUrl = `https://cdn.discordapp.com/avatars/${data.discord_user.id}/${data.discord_user.avatar}.png?size=256`;
            avatarElement.src = avatarUrl;
        }
    }

    statusElement.className = 'status-indicator';
    discordStatusElement.className = 'activity-card discord-status';
    
    if (data.discord_status) {
        statusElement.classList.add(data.discord_status);
        discordStatusElement.classList.add(data.discord_status);
        
        const statusText = {
            'online': 'Online',
            'idle': 'Away',
            'dnd': 'Do Not Disturb',
            'offline': 'Offline'
        };
        
        statusTextElement.textContent = statusText[data.discord_status] || 'Unknown';
    }

    // Vérifier s'il y a une activité actuelle
    if (data.activities && data.activities.length > 0) {
        const activity = data.activities.find(a => a.type !== 4 && a.name !== 'Spotify');
        
        if (activity) {
            // Afficher l'activité actuelle
            displayCurrentActivity(activity, discordActivityElement);
        } else {
            // Pas d'activité actuelle, chercher dans les recent activities
            showRecentActivity(data, discordActivityElement);
        }
    } else {
        // Pas d'activité actuelle, chercher dans les recent activities
        showRecentActivity(data, discordActivityElement);
    }

    if (data.spotify) {
        spotifySection.style.display = 'block';
        updateSpotifyInfo(data.spotify);
        
        if (spotifyUpdateInterval) {
            clearInterval(spotifyUpdateInterval);
        }
        
        spotifyUpdateInterval = setInterval(() => {
            updateSpotifyProgress(data.spotify);
        }, 1000);
    } else {
        spotifySection.style.display = 'none';
        if (spotifyUpdateInterval) {
            clearInterval(spotifyUpdateInterval);
        }
    }
}

// Nouvelle fonction pour afficher l'activité actuelle
// Fonction pour afficher l'activité actuelle - AMÉLIORÉE
function displayCurrentActivity(activity, discordActivityElement) {
    // Sauvegarder l'activité actuelle comme dernière activité
    lastActivity = {
        name: activity.name,
        state: activity.state || activity.details || 'Playing',
        icon: null,
        application_id: activity.application_id,
        assets: activity.assets
    };
    lastActivityTime = Date.now();
    
    discordActivityElement.style.display = 'flex';
    discordActivityElement.classList.remove('last-activity');
    
    const activityIcon = document.getElementById('activity-icon');
    const activityName = document.getElementById('activity-name');
    const activityState = document.getElementById('activity-state');
    
    // Fonction pour sauvegarder l'icône qui fonctionne
    function saveIconAndUpdate(iconUrl) {
        lastActivity.icon = iconUrl;
        localStorage.setItem('lastActivity', JSON.stringify(lastActivity));
        localStorage.setItem('lastActivityTime', lastActivityTime.toString());
    }
    
    // Gestion des icônes avec fallback garanti
    if (activity.assets && activity.assets.large_image && activity.application_id) {
        let iconUrl;
        if (activity.assets.large_image.startsWith('mp:')) {
            iconUrl = `https://media.discordapp.net/${activity.assets.large_image.slice(3)}`;
        } else {
            iconUrl = `https://cdn.discordapp.com/app-assets/${activity.application_id}/${activity.assets.large_image}.png`;
        }
        
        // Tester l'icône
        const img = new Image();
        img.onload = function() {
            activityIcon.src = iconUrl;
            saveIconAndUpdate(iconUrl);
        };
        img.onerror = function() {
            // Fallback vers icône de l'app
            const appIconUrl = `https://cdn.discordapp.com/app-icons/${activity.application_id}/icon.png`;
            const appImg = new Image();
            appImg.onload = function() {
                activityIcon.src = appIconUrl;
                saveIconAndUpdate(appIconUrl);
            };
            appImg.onerror = function() {
                // Icône SVG garantie
                const initials = activity.name.length >= 3 ? activity.name.substring(0, 3).toUpperCase() : activity.name.toUpperCase();
                const svgIcon = `data:image/svg+xml;charset=utf-8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'><rect width='48' height='48' rx='8' fill='%237289da'/><text x='24' y='30' font-family='Arial,sans-serif' font-size='14' font-weight='bold' text-anchor='middle' fill='white'>${initials}</text></svg>`;
                activityIcon.src = svgIcon;
                saveIconAndUpdate(svgIcon);
            };
            appImg.src = appIconUrl;
        };
        img.src = iconUrl;
    } else {
        // Pas d'assets, créer directement l'icône SVG
        const initials = activity.name.length >= 3 ? activity.name.substring(0, 3).toUpperCase() : activity.name.toUpperCase();
        const svgIcon = `data:image/svg+xml;charset=utf-8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'><rect width='48' height='48' rx='8' fill='%237289da'/><text x='24' y='30' font-family='Arial,sans-serif' font-size='14' font-weight='bold' text-anchor='middle' fill='white'>${initials}</text></svg>`;
        activityIcon.src = svgIcon;
        saveIconAndUpdate(svgIcon);
    }
    
    activityName.textContent = activity.name;
    activityState.textContent = activity.state || activity.details || 'Playing';
}

// Nouvelle fonction pour afficher la recent activity de Lanyard
function showRecentActivity(data, discordActivityElement) {
    // Lanyard fournit parfois des données sur les activités récentes
    // Chercher dans les données pour une activité récente
    if (data.kv && data.kv.recent_activity) {
        try {
            const recentActivity = JSON.parse(data.kv.recent_activity);
            displayRecentActivity(recentActivity, discordActivityElement);
            return;
        } catch (e) {
            console.log('Erreur parsing recent activity:', e);
        }
    }
    
    // Si pas de recent activity dans Lanyard, utiliser le système de sauvegarde local
    if (lastActivity && lastActivityTime) {
        displayRecentActivity(lastActivity, discordActivityElement, lastActivityTime);
    } else {
        discordActivityElement.style.display = 'none';
    }
}

// Fonction pour afficher une activité récente
// Fonction pour chercher une image sur Google Images
function searchGoogleImage(gameName, callback) {
    // Utiliser l'API Google Custom Search pour les images
    const query = encodeURIComponent(`${gameName} game logo icon`);
    
    // Sources alternatives pour les images de jeux
    const imageSources = [
        // Recherche d'image directe via proxy
        `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://www.google.com/search?tbm=isch&q=${query}`)}&format=json`,
        // Sources d'images de jeux fiables
        `https://images.igdb.com/igdb/image/upload/t_cover_small/${gameName.toLowerCase().replace(/\s+/g, '-')}.jpg`,
        `https://steamcdn-a.akamaihd.net/steam/apps/search/${gameName.toLowerCase().replace(/\s+/g, '%20')}/header.jpg`,
        // Fallback avec service d'icônes
        `https://api.iconify.design/game-icons:${gameName.toLowerCase().replace(/\s+/g, '-')}.svg`,
        // Logo générique
        `https://logo.clearbit.com/${gameName.toLowerCase().replace(/\s+/g, '')}.com`
    ];
    
    let currentIndex = 0;
    
    function tryNextSource() {
        if (currentIndex >= imageSources.length) {
            // Aucune source n'a fonctionné, créer une icône SVG personnalisée
            const initials = gameName.length >= 3 ? gameName.substring(0, 3).toUpperCase() : gameName.toUpperCase();
            const svgIcon = `data:image/svg+xml;charset=utf-8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'><rect width='48' height='48' rx='8' fill='%237289da'/><text x='24' y='30' font-family='Arial,sans-serif' font-size='14' font-weight='bold' text-anchor='middle' fill='white'>${initials}</text></svg>`;
            callback(svgIcon);
            return;
        }
        
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = function() {
            console.log(`Image trouvée pour ${gameName}: ${imageSources[currentIndex]}`);
            callback(imageSources[currentIndex]);
        };
        
        img.onerror = function() {
            console.log(`Échec de chargement: ${imageSources[currentIndex]}`);
            currentIndex++;
            tryNextSource();
        };
        
        img.src = imageSources[currentIndex];
    }
    
    tryNextSource();
}

// Fonction améliorée pour afficher la dernière activité avec recherche Google
function displayRecentActivity(recentActivity, discordActivityElement, customTime = null) {
    discordActivityElement.style.display = 'flex';
    discordActivityElement.classList.add('last-activity');
    
    const activityIcon = document.getElementById('activity-icon');
    const activityName = document.getElementById('activity-name');
    const activityState = document.getElementById('activity-state');
    
    // Calculer le temps écoulé
    let timeElapsed;
    if (customTime) {
        timeElapsed = Date.now() - customTime;
    } else if (recentActivity.timestamp) {
        timeElapsed = Date.now() - recentActivity.timestamp;
    } else {
        timeElapsed = 0;
    }
    
    const timeString = formatLastActivityTime(timeElapsed);
    
    // Chercher l'icône directement sur Google/sources d'images
    console.log(`Recherche d'icône pour: ${recentActivity.name}`);
    
    // Afficher temporairement une icône de chargement
    const loadingIcon = `data:image/svg+xml;charset=utf-8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'><rect width='48' height='48' rx='8' fill='%23f0f0f0'/><text x='24' y='30' font-family='Arial,sans-serif' font-size='12' font-weight='bold' text-anchor='middle' fill='%23666'>...</text></svg>`;
    activityIcon.src = loadingIcon;
    
    // Chercher l'icône en ligne
    searchGoogleImage(recentActivity.name, function(iconUrl) {
        activityIcon.src = iconUrl;
        
        // Sauvegarder l'icône trouvée pour la prochaine fois
        if (recentActivity && iconUrl) {
            recentActivity.icon = iconUrl;
            localStorage.setItem('lastActivity', JSON.stringify(recentActivity));
        }
    });
    
    // S'assurer que l'icône a les bonnes dimensions
    activityIcon.style.width = '48px';
    activityIcon.style.height = '48px';
    activityIcon.style.borderRadius = '8px';
    activityIcon.style.objectFit = 'cover';
    
    activityName.textContent = `Dernière activité: ${recentActivity.name}`;
    activityState.textContent = `${recentActivity.state || 'Playing'} • ${timeString}`;
}

// Modifier la fonction showLastActivity existante pour utiliser le nouveau système
function showLastActivity() {
    const discordActivityElement = document.getElementById('discord-activity');
    
    // Charger depuis localStorage si les variables sont vides
    if (!lastActivity && localStorage.getItem('lastActivity')) {
        lastActivity = JSON.parse(localStorage.getItem('lastActivity'));
        lastActivityTime = parseInt(localStorage.getItem('lastActivityTime'));
    }
    
    if (lastActivity && lastActivityTime) {
        displayRecentActivity(lastActivity, discordActivityElement, lastActivityTime);
    } else {
        discordActivityElement.style.display = 'none';
    }
}

function updateSpotifyInfo(spotify) {
    const albumCover = document.getElementById('album-cover');
    const spotifyTitle = document.getElementById('spotify-title');
    const spotifyArtist = document.getElementById('spotify-artist');
    
    if (spotify.album_art_url) {
        albumCover.src = spotify.album_art_url;
    }
    
    spotifyTitle.textContent = spotify.song || 'Unknown Track';
    spotifyArtist.textContent = spotify.artist || 'Unknown Artist';
}

function updateSpotifyProgress(spotify) {
    const progressFill = document.getElementById('progress-fill');
    const currentTimeElement = document.getElementById('current-time');
    const totalTimeElement = document.getElementById('total-time');
    
    if (spotify.timestamps) {
        const now = Date.now();
        const start = spotify.timestamps.start;
        const end = spotify.timestamps.end;
        
        const elapsed = now - start;
        const total = end - start;
        const progress = Math.min((elapsed / total) * 100, 100);
        
        progressFill.style.width = progress + '%';
        
        currentTimeElement.textContent = formatTime(elapsed);
        totalTimeElement.textContent = formatTime(total);
    }
}

function formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

window.addEventListener('beforeunload', function() {
    if (socket) {
        socket.close();
    }
    clearInterval(heartbeatInterval);
    clearInterval(spotifyUpdateInterval);
});


function initCopyFunctionality() {
    const copyElements = document.querySelectorAll('[data-copy]');
    
    copyElements.forEach(element => {
        element.addEventListener('click', function(e) {
            e.preventDefault();
            
            const textToCopy = this.getAttribute('data-copy');
            const type = this.getAttribute('data-type');
            
            copyToClipboard(textToCopy, type);
        });
    });
}

function copyToClipboard(text, type) {
    navigator.clipboard.writeText(text).then(function() {
        showCopyNotification(`${type} copié !`, true);
    }).catch(function(err) {
        console.error('Erreur lors de la copie:', err);
        showCopyNotification(`Erreur lors de la copie`, false);
    });
}

function showCopyNotification(message, success) {
    const existingNotifications = document.querySelectorAll('.copy-notification');
    existingNotifications.forEach(notif => {
        notif.classList.add('hide');
        setTimeout(() => notif.remove(), 400);
    });
    
    const notification = document.createElement('div');
    notification.className = `copy-notification ${success ? 'success' : 'error'}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        notification.classList.add('hide');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 400);
    }, 3000);
}


// Nouvelle fonction pour afficher la dernière activité
function showLastActivity() {
    const discordActivityElement = document.getElementById('discord-activity');
    const activityIcon = document.getElementById('activity-icon');
    const activityName = document.getElementById('activity-name');
    const activityState = document.getElementById('activity-state');
    
    if (lastActivity && lastActivityTime) {
        discordActivityElement.style.display = 'flex';
        
        // Calculer le temps écoulé depuis la dernière activité
        const timeElapsed = Date.now() - lastActivityTime;
        const timeString = formatLastActivityTime(timeElapsed);
        
        activityIcon.src = lastActivity.icon || 'https://via.placeholder.com/40';
        activityName.textContent = `Dernière activité: ${lastActivity.name}`;
        activityState.textContent = `${lastActivity.state} • ${timeString}`;
        
        // Ajouter une classe pour styliser différemment
        discordActivityElement.classList.add('last-activity');
    } else {
        discordActivityElement.style.display = 'none';
    }
}

// Fonction pour formater le temps de la dernière activité
function formatLastActivityTime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
        return `il y a ${days} jour${days > 1 ? 's' : ''}`;
    } else if (hours > 0) {
        return `il y a ${hours} heure${hours > 1 ? 's' : ''}`;
    } else if (minutes > 0) {
        return `il y a ${minutes} minute${minutes > 1 ? 's' : ''}`;
    } else {
        return 'il y a quelques secondes';
    }
}

// Fonction pour chercher le logo d'un jeu sur internet
function searchGameLogo(gameName, callback) {
    // Debug: afficher le nom exact reçu
    console.log(`Recherche de logo pour le jeu: "${gameName}"`);
    
    // Normaliser le nom du jeu pour une meilleure recherche
    const normalizedName = gameName.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
    const encodedName = encodeURIComponent(gameName);
    
    const searchSources = [
        // RAWG API - Base de données complète de jeux avec logos précis
        `https://api.rawg.io/api/games?search=${encodedName}&key=YOUR_API_KEY`,
        // SteamGridDB - Logos haute qualité pour les jeux
        `https://www.steamgriddb.com/api/v2/search/autocomplete/${encodedName}`,
        // IGDB avec recherche plus précise
        `https://images.igdb.com/igdb/image/upload/t_logo_med/${normalizedName}.png`,
        // Steam store avec ID de jeu spécifique
        `https://steamcdn-a.akamaihd.net/steam/apps/${getGameSteamId(gameName)}/header.jpg`,
        // Mobygames - Base de données historique
        `https://www.mobygames.com/images/covers/l/${getGameMobyId(gameName)}-front.jpg`,
        // Fallback avec recherche Google Images API
        `https://customsearch.googleapis.com/customsearch/v1?q=${encodedName}+game+logo&searchType=image&key=YOUR_API_KEY`,
        // Logo générique amélioré
        `https://logo.clearbit.com/${normalizedName}.com`,
        // Iconify avec catégorie jeux
        `https://api.iconify.design/game-icons:${normalizedName}.svg`
    ];
    
    // Mapping spécifique pour les jeux populaires
    const gameLogoMap = {
        'grand theft auto v': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Grand_Theft_Auto_V_Logo.svg/1200px-Grand_Theft_Auto_V_Logo.svg.png',
        'gta v': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Grand_Theft_Auto_V_Logo.svg/1200px-Grand_Theft_Auto_V_Logo.svg.png',
        'grand theft auto 5': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Grand_Theft_Auto_V_Logo.svg/1200px-Grand_Theft_Auto_V_Logo.svg.png',
        'gta 5': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Grand_Theft_Auto_V_Logo.svg/1200px-Grand_Theft_Auto_V_Logo.svg.png',
        'gtav': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Grand_Theft_Auto_V_Logo.svg/1200px-Grand_Theft_Auto_V_Logo.svg.png',
        'gta5': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Grand_Theft_Auto_V_Logo.svg/1200px-Grand_Theft_Auto_V_Logo.svg.png',
        'minecraft': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Minecraft_Java_Edition_logo.svg/1200px-Minecraft_Java_Edition_logo.svg.png',
        'fortnite': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Fortnite_F_lettermark_logo.svg/1200px-Fortnite_F_lettermark_logo.svg.png',
        'call of duty': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Call_of_Duty_logo.svg/1200px-Call_of_Duty_logo.svg.png',
        'valorant': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/Valorant_logo.svg/1200px-Valorant_logo.svg.png',
        'league of legends': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/League_of_Legends_logo.svg/1200px-League_of_Legends_logo.svg.png',
        'world of warcraft': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/World_of_Warcraft_logo.svg/1200px-World_of_Warcraft_logo.svg.png',
        'counter-strike': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Counter-Strike_Global_Offensive_logo.svg/1200px-Counter-Strike_Global_Offensive_logo.svg.png'
    };
    
    // Vérifier d'abord le mapping spécifique
    const gameKey = gameName.toLowerCase().trim();
    const normalizedGameKey = gameKey.replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    
    // Essayer plusieurs variantes du nom
    const gameVariants = [
        gameKey,
        normalizedGameKey,
        gameKey.replace(/\s+/g, ''),
        normalizedGameKey.replace(/\s+/g, ''),
        gameKey.replace(/grand theft auto/g, 'gta'),
        gameKey.replace(/grand theft auto v/g, 'gta v'),
        gameKey.replace(/grand theft auto v/g, 'gta 5')
    ];
    
    for (const variant of gameVariants) {
        if (gameLogoMap[variant]) {
            console.log(`Logo trouvé pour: ${gameName} (variante: ${variant})`);
            callback(gameLogoMap[variant]);
            return;
        }
    }
    
    let currentIndex = 0;
    
    function tryNextSource() {
        if (currentIndex >= searchSources.length) {
            // Aucune source n'a fonctionné, utiliser l'icône SVG personnalisée
            const initials = gameName.length >= 3 ? gameName.substring(0, 3).toUpperCase() : gameName.toUpperCase();
            const svgIcon = `data:image/svg+xml;charset=utf-8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'><rect width='48' height='48' rx='8' fill='%23FF6B6B'/><text x='24' y='30' font-family='Arial,sans-serif' font-size='12' font-weight='bold' text-anchor='middle' fill='white'>${initials}</text></svg>`;
            callback(svgIcon);
            return;
        }
        
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = function() {
            callback(searchSources[currentIndex]);
        };
        
        img.onerror = function() {
            currentIndex++;
            tryNextSource();
        };
        
        img.src = searchSources[currentIndex];
    }
    
    tryNextSource();
}

// Fonctions helper pour obtenir les IDs spécifiques
function getGameSteamId(gameName) {
    const steamIds = {
        'grand theft auto v': '271590',
        'gta v': '271590',
        'minecraft': '1172470',
        'fortnite': '1172470',
        'valorant': '1172470'
    };
    return steamIds[gameName.toLowerCase()] || '0';
}

function getGameMobyId(gameName) {
    const mobyIds = {
        'grand theft auto v': '63827',
        'gta v': '63827'
    };
    return mobyIds[gameName.toLowerCase()] || '0';
}
