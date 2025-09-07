let activeOperations = new Set();
let parametersVisible = false;
let activeDownloads = {};


function updateThemeIcon(theme) {
    const icon = document.getElementById('themeIcon');
    if (icon) {
        switch (theme) {
            case 'light':
                icon.className = 'fas fa-moon text-slate-700 dark:text-carbonated-300';
                icon.innerHTML = '';
                break;
            case 'dark':
                icon.className = 'fas fa-sun text-slate-700 dark:text-carbonated-300';
                icon.innerHTML = '';
                break;
            case 'bw':
                icon.className = 'w-5 h-5 flex items-center justify-center';
                icon.innerHTML = '<img src="/static/favicon.svg" alt="Minimal" class="w-4 h-4" style="width: 16px; height: 16px;">';
                break;
        }
    }
}

function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
}

function cycleTheme() {
    const currentTheme = getCurrentTheme();
    let nextTheme;
    
    switch (currentTheme) {
        case 'light':
            nextTheme = 'dark';
            break;
        case 'dark':
            nextTheme = 'bw';
            break;
        case 'bw':
            nextTheme = 'light';
            break;
        default:
            nextTheme = 'light';
    }
    
    setTheme(nextTheme);
}

function getCurrentTheme() {
    if (document.documentElement.classList.contains('bw-theme')) return 'bw';
    if (document.documentElement.classList.contains('dark')) return 'dark';
    return 'light';
}

function setTheme(theme) {
    // Remove all theme classes
    document.documentElement.classList.remove('dark', 'bw-theme');
    
    // Apply new theme
    switch (theme) {
        case 'dark':
            document.documentElement.classList.add('dark');
            break;
        case 'bw':
            document.documentElement.classList.add('bw-theme');
            break;
        case 'light':
        default:
            // No classes needed for light theme
            break;
    }
    
    updateThemeIcon(theme);
    localStorage.setItem('theme', theme);
}

function showLoading(message) {
    document.getElementById('loadingText').textContent = message;
    document.getElementById('loadingModal').classList.remove('hidden');
    document.getElementById('statusModal').classList.add('hidden');
}

function hideLoading() {
    document.getElementById('loadingModal').classList.add('hidden');
}

function showStatus(message, isSuccess = true) {
    const modal = document.getElementById('statusModal');
    const iconContainer = document.getElementById('statusIconContainer');
    const icon = document.getElementById('statusIcon');
    const title = document.getElementById('statusTitle');
    const text = document.getElementById('statusText');

    text.textContent = message;
    title.textContent = isSuccess ? 'Success' : 'Error';

    if (isSuccess) {
        iconContainer.className = 'w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4';
        icon.className = 'fas fa-check-circle text-green-500 text-3xl';
    } else {
        iconContainer.className = 'w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4';
        icon.className = 'fas fa-exclamation-circle text-red-500 text-3xl';
    }

    hideLoading();
    modal.classList.remove('hidden');

}

function setButtonLoading(button, loading = true) {
    if (loading) {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Loading...';
        button.className = button.className.replace(/text-\w+-600/, 'text-gray-400');
    }
}

function resetButton(button, originalText, originalClass) {
    button.disabled = false;
    button.innerHTML = originalText;
    button.className = originalClass;
}

async function refreshData() {
    await updateModelStatus();
    updateTimestamp();
}

async function refreshModelData() {
    try {
        const response = await fetch('/api/ollama/status');
        const data = await response.json();
        
        // Update model counts and timestamp only
        updateModelCounts(data.available_models?.length || 0, data.loaded_models?.length || 0);
        updateTimestamp();
    } catch (error) {
        console.error('Failed to refresh model data:', error);
    }
}

async function updateModelStatus() {
    try {
        const response = await fetch('/api/ollama/status');
        const data = await response.json();

        // Update connection status
        updateConnectionStatus(data.status, data.error);

        // Update model counts
        updateModelCounts(data.available_models?.length || 0, data.loaded_models?.length || 0);

    } catch (error) {
        console.error('Failed to update model status:', error);
        updateConnectionStatus('error', error.message);
    }
}

function updateConnectionStatus(status, error) {
    const iconElement = document.querySelector('.fas.fa-flask-vial');
    if (!iconElement) {
        console.warn('Status icon element not found - skipping status update');
        return;
    }
    
    const statusElements = {
        icon: iconElement,
        text: document.getElementById('server-status-text'),
        container: iconElement.parentElement
    };
    
    if (!statusElements.text || !statusElements.container) {
        console.warn('Status elements not found');
        return;
    }

    // Update status styling
    const isOnline = status === 'online';
    const isOffline = status === 'offline';

    statusElements.container.className = `p-3 rounded-full ${isOnline ? 'bg-green-500 bg-opacity-20' :
        isOffline ? 'bg-red-500 bg-opacity-20' : 'bg-yellow-500 bg-opacity-20'
        }`;

    statusElements.icon.className = `fas fa-server ${isOnline ? 'text-green-500' :
        isOffline ? 'text-red-500' : 'text-yellow-500'
        } text-xl`;

    statusElements.text.className = `text-lg font-semibold ${isOnline ? 'text-emerald-600 dark:text-emerald-400' :
        isOffline ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
        }`;

    statusElements.text.textContent = status.charAt(0).toUpperCase() + status.slice(1);
}

function updateModelCounts(availableCount, loadedCount) {
    const availableCountEl = document.getElementById('available-models-count');
    const loadedCountEl = document.getElementById('loaded-models-count');

    if (availableCountEl) availableCountEl.textContent = availableCount;
    if (loadedCountEl) loadedCountEl.textContent = loadedCount;
}

function updateTimestamp() {
    const timestampEl = document.querySelector('.text-cyan-600');
    if (timestampEl) {
        const now = new Date();
        timestampEl.textContent = now.toLocaleString('sv-SE').replace('T', ' ');
    }
}

async function pullModel(modelName) {
    // If no model name provided, get it from input
    if (!modelName) {
        modelName = document.getElementById('modelName').value.trim();
        if (!modelName) {
            showStatus('Please enter a model name', false);
            return;
        }
    }
    
    // Check if this model is already being downloaded
    if (activeDownloads[modelName]) {
        showStatus(`${modelName} is already being downloaded`, false);
        return;
    }

    try {
        // Start the download (this will run in background on server)
        fetch('/api/ollama/pull', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: modelName })
        });

        // Add progress bar and start polling immediately
        addProgressBar(modelName);
        startPollingDownload(modelName);
        
        // Clear input if we used it
        if (!arguments.length) {
            document.getElementById('modelName').value = '';
        }

    } catch (error) {
        showStatus(`Error starting download: ${error.message}`, false);
    }
}

function addProgressBar(modelName) {
    const container = document.getElementById('downloadsContainer');
    
    const progressDiv = document.createElement('div');
    progressDiv.id = `download-${modelName}`;
    progressDiv.className = 'p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg transition-colors duration-200';
    
    progressDiv.innerHTML = `
        <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium text-blue-700 dark:text-blue-300">
                <i class="fas fa-download mr-2"></i>${modelName}
            </span>
            <div class="flex items-center space-x-2">
                <span class="progress-percent text-sm font-medium text-blue-700 dark:text-blue-300">0.0%</span>
                <button onclick="cancelDownload('${modelName}')" 
                        class="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-xs">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
        <div class="progress-text text-xs text-blue-600 dark:text-blue-400 mb-2">Preparing to download...</div>
        <div class="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2.5 mb-2">
            <div class="progress-bar bg-blue-600 h-2.5 rounded-full transition-all duration-300" style="width: 0%"></div>
        </div>
        <div class="progress-details text-xs text-blue-600 dark:text-blue-400"></div>
    `;
    
    container.appendChild(progressDiv);
}

function removeProgressBar(modelName) {
    const progressDiv = document.getElementById(`download-${modelName}`);
    if (progressDiv) {
        progressDiv.remove();
    }
}

function updateProgressBar(modelName, text, percent, details = '') {
    const progressDiv = document.getElementById(`download-${modelName}`);
    if (!progressDiv) return;
    
    const progressText = progressDiv.querySelector('.progress-text');
    const progressPercent = progressDiv.querySelector('.progress-percent');
    const progressBar = progressDiv.querySelector('.progress-bar');
    const progressDetails = progressDiv.querySelector('.progress-details');
    
    if (progressText) progressText.textContent = text;
    if (progressPercent) progressPercent.textContent = `${percent.toFixed(1)}%`;
    if (progressBar) progressBar.style.width = `${percent}%`;
    if (progressDetails) progressDetails.textContent = details;
}

function startPollingDownload(modelName) {
    const maxAttempts = 600; // 10 minutes at 1 second intervals
    let attempts = 0;

    const pollInterval = setInterval(async () => {
        try {
            const response = await fetch(`/api/ollama/pull/${encodeURIComponent(modelName)}/progress`);
            const data = await response.json();

            if (data.success && data.progress) {
                const progress = data.progress;
                const percent = progress.percent || 0;
                const status = progress.status || 'downloading';

                let progressText = `Downloading ${modelName}...`;
                if (status === 'pulling manifest') {
                    progressText = 'Pulling manifest...';
                } else if (status === 'downloading') {
                    progressText = 'Downloading...';
                } else if (status === 'verifying sha256 digest') {
                    progressText = 'Verifying...';
                } else if (status === 'starting') {
                    progressText = 'Starting download...';
                }

                let details = '';
                if (progress.completed && progress.total) {
                    const completedMB = (progress.completed / 1024 / 1024).toFixed(1);
                    const totalMB = (progress.total / 1024 / 1024).toFixed(1);
                    details = `${completedMB} MB / ${totalMB} MB`;
                }

                updateProgressBar(modelName, progressText, percent, details);

                if (data.completed || progress.status === 'completed') {
                    clearInterval(pollInterval);
                    delete activeDownloads[modelName];
                    removeProgressBar(modelName);
                    showStatus(`Model ${modelName} pulled successfully!`);
                    return;
                }
            } else if (!data.success && data.error.includes('No active download')) {
                clearInterval(pollInterval);
                delete activeDownloads[modelName];
                removeProgressBar(modelName);
                return;
            }

            attempts++;
            if (attempts >= maxAttempts) {
                clearInterval(pollInterval);
                delete activeDownloads[modelName];
                removeProgressBar(modelName);
                showStatus(`Download timeout for ${modelName} - please check if it completed`, false);
            }
        } catch (error) {
            attempts++;
            if (attempts >= maxAttempts) {
                clearInterval(pollInterval);
                delete activeDownloads[modelName];
                removeProgressBar(modelName);
                showStatus(`Error checking download progress for ${modelName}: ${error.message}`, false);
            }
        }
    }, 1000);
    
    activeDownloads[modelName] = pollInterval;
}

function cancelDownload(modelName) {
    if (activeDownloads[modelName]) {
        clearInterval(activeDownloads[modelName]);
        delete activeDownloads[modelName];
        removeProgressBar(modelName);
        showStatus(`Download of ${modelName} cancelled. Note: Server may still be downloading in background.`, false);
    }
}

async function loadActiveDownloads() {
    try {
        const response = await fetch('/api/ollama/pull/active');
        const data = await response.json();
        
        if (data.success && data.downloads) {
            Object.keys(data.downloads).forEach(modelName => {
                const download = data.downloads[modelName];
                if (download.status !== 'completed' && download.status !== 'error') {
                    addProgressBar(modelName);
                    
                    const percent = download.percent || 0;
                    let text = 'Downloading...';
                    if (download.status === 'pulling manifest') text = 'Pulling manifest...';
                    else if (download.status === 'verifying sha256 digest') text = 'Verifying...';
                    
                    let details = '';
                    if (download.completed && download.total) {
                        const completedMB = (download.completed / 1024 / 1024).toFixed(1);
                        const totalMB = (download.total / 1024 / 1024).toFixed(1);
                        details = `${completedMB} MB / ${totalMB} MB`;
                    }
                    
                    updateProgressBar(modelName, text, percent, details);
                    startPollingDownload(modelName);
                }
            });
        }
    } catch (error) {
    }
}



function toggleParameters() {
    const section = document.getElementById('parameterSection');
    const button = document.getElementById('paramToggleBtn');

    parametersVisible = !parametersVisible;

    if (parametersVisible) {
        section.classList.remove('hidden');
        button.innerHTML = '<i class="fas fa-cog mr-2"></i>Hide Parameters';
    } else {
        section.classList.add('hidden');
        button.innerHTML = '<i class="fas fa-cog mr-2"></i>Show Parameters';
    }
}

function getModelParameters() {
    const parameters = {};

    const num_ctx = parseInt(document.getElementById('num_ctx').value);
    const keep_alive = document.getElementById('keep_alive').value;

    // Only include num_ctx if it's different from default
    if (num_ctx !== 4096) {
        parameters.num_ctx = num_ctx;
    }

    return {
        options: parameters,
        keep_alive: keep_alive
    };
}

function resetToDefaults() {
    document.getElementById('num_ctx').value = 4096;
    document.getElementById('keep_alive').value = '5m';

    showStatus('Loading parameters reset to defaults');
}

function saveParameterPreset() {
    const parameters = getModelParameters();
    localStorage.setItem('ollamaParameters', JSON.stringify(parameters));
    showStatus('Loading parameters saved');
}

function loadParameterPreset() {
    const saved = localStorage.getItem('ollamaParameters');
    if (saved) {
        try {
            const params = JSON.parse(saved);
            if (params.options && params.options.num_ctx !== undefined) {
                document.getElementById('num_ctx').value = params.options.num_ctx;
            }
            if (params.keep_alive !== undefined) {
                document.getElementById('keep_alive').value = params.keep_alive;
            }
        } catch (e) {
            console.warn('Failed to load saved loading parameters:', e);
        }
    }
}

async function loadModel(modelName) {
    if (activeOperations.has(`load-${modelName}`)) {
        return; // Already loading this model
    }

    activeOperations.add(`load-${modelName}`);
    showLoading(`Loading model ${modelName} into memory...`);

    try {
        const modelParams = getModelParameters();
        const payload = {
            name: modelName,
            ...modelParams
        };

        const response = await fetch('/api/ollama/load', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.success) {
            showStatus(`Model ${modelName} loaded into memory successfully!`);
            // Page will refresh when user clicks Close on success modal
        } else {
            showStatus(`Failed to load model: ${data.error}`, false);
        }
    } catch (error) {
        showStatus(`Error loading model: ${error.message}`, false);
    } finally {
        activeOperations.delete(`load-${modelName}`);
    }
}

// Custom confirmation modal
function showConfirmation(title, message, confirmText = 'Confirm', cancelText = 'Cancel') {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        const titleEl = document.getElementById('confirmTitle');
        const messageEl = document.getElementById('confirmMessage');
        const confirmBtn = document.getElementById('confirmOk');
        const cancelBtn = document.getElementById('confirmCancel');

        titleEl.textContent = title;
        messageEl.textContent = message;
        confirmBtn.textContent = confirmText;
        cancelBtn.textContent = cancelText;

        modal.classList.remove('hidden');

        // Handle confirm
        const handleConfirm = () => {
            modal.classList.add('hidden');
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            resolve(true);
        };

        // Handle cancel
        const handleCancel = () => {
            modal.classList.add('hidden');
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            resolve(false);
        };

        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);

        // ESC key support
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                document.removeEventListener('keydown', handleEscape);
                handleCancel();
            }
        };
        document.addEventListener('keydown', handleEscape);
    });
}

async function unloadModel(modelName) {
    const confirmed = await showConfirmation(
        'Unload Model',
        `Are you sure you want to unload ${modelName} from memory?`,
        'Unload',
        'Cancel'
    );

    if (!confirmed) {
        return;
    }

    if (activeOperations.has(`unload-${modelName}`)) {
        return; // Already unloading this model
    }

    activeOperations.add(`unload-${modelName}`);
    showLoading(`Unloading model ${modelName} from memory...`);

    try {
        const response = await fetch('/api/ollama/unload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: modelName })
        });

        const data = await response.json();

        if (data.success) {
            showStatus(`Model ${modelName} unloaded from memory successfully!`);
            // Page will refresh when user clicks Close on success modal
        } else {
            showStatus(`Failed to unload model: ${data.error}`, false);
        }
    } catch (error) {
        showStatus(`Error unloading model: ${error.message}`, false);
    } finally {
        activeOperations.delete(`unload-${modelName}`);
    }
}

async function deleteModel(modelName) {
    // Single confirmation for deletion
    const confirmed = await showConfirmation(
        '⚠️ DANGER: You Pressed Delete',
        `If you continue, ${modelName} will be deleted. If you want to use this model again you'll have to re-pull it.

        This will free up some disk space, though.`,
        'Delete',
        'Cancel'
    );

    if (!confirmed) {
        return;
    }

    if (activeOperations.has(`delete-${modelName}`)) {
        return; // Already deleting this model
    }

    activeOperations.add(`delete-${modelName}`);
    showLoading(`Deleting model ${modelName} permanently...`);

    try {
        const response = await fetch('/api/ollama/delete', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: modelName })
        });

        const data = await response.json();

        if (data.success) {
            showStatus(`Model ${modelName} deleted permanently!`);
            // Page will refresh when user clicks Close on success modal
        } else {
            showStatus(`Failed to delete model: ${data.error}`, false);
        }
    } catch (error) {
        showStatus(`Error deleting model: ${error.message}`, false);
    } finally {
        activeOperations.delete(`delete-${modelName}`);
    }
}

async function showModelDetails(modelName) {
    document.getElementById('modalTitle').textContent = `Model: ${modelName}`;
    document.getElementById('modelModal').classList.remove('hidden');
    document.getElementById('modelModal').classList.add('flex');

    try {
        const response = await fetch(`/api/ollama/model/${encodeURIComponent(modelName)}`);
        const data = await response.json();

        let detailsHtml = '';
        if (data.error) {
            detailsHtml = `<div class="text-red-600">Error: ${data.error}</div>`;
        } else {
            detailsHtml = `<div class="space-y-6">`;

            // Runtime Parameters Section (if model is loaded)
            if (data.runtime_info) {
                detailsHtml += `
                <div class="border-l-4 border-green-500 pl-4">
                    <h4 class="text-lg font-semibold text-green-700 mb-2">
                        <i class="fas fa-play mr-2"></i>Currently Loaded - Runtime Information
                    </h4>
                    <div class="bg-green-100 dark:bg-green-900/30 p-3 rounded text-sm">
                        <div class="grid grid-cols-2 gap-4">
                            <div><strong>Context Length:</strong> ${data.runtime_info.context_length || 'N/A'}</div>
                            <div><strong>VRAM Usage:</strong> ${data.runtime_info.size_vram ? (data.runtime_info.size_vram / 1024 / 1024 / 1024).toFixed(2) + ' GB' : 'N/A'}</div>
                            <div class="col-span-2"><strong>Expires At:</strong> ${data.runtime_info.expires_at ? data.runtime_info.expires_at.replace('T', ' ').substring(0, 19) : 'No expiry'}</div>
                        </div>
                        <p class="text-xs text-green-600 mt-2 italic">
                            <i class="fas fa-info-circle mr-1"></i>
                            These are the current runtime parameters for this loaded model instance.
                        </p>
                    </div>
                </div>`;
            } else {
                detailsHtml += `
                <div class="border-l-4 border-gray-400 pl-4">
                    <h4 class="text-lg font-semibold text-gray-600 mb-2">
                        <i class="fas fa-pause mr-2"></i>Model Status
                    </h4>
                    <div class="bg-gray-100 dark:bg-gray-800/50 p-3 rounded text-sm">
                        <p class="text-gray-700">This model is not currently loaded in memory.</p>
                        <p class="text-xs text-gray-500 mt-1 italic">
                            <i class="fas fa-info-circle mr-1"></i>
                            Load the model to see runtime parameters.
                        </p>
                    </div>
                </div>`;
            }

            // Model Default Parameters Section
            if (data.parameters && data.parameters.trim()) {
                detailsHtml += `
                <div class="border-l-4 border-blue-500 pl-4">
                    <h4 class="text-lg font-semibold text-blue-700 mb-2">
                        <i class="fas fa-cog mr-2"></i>Default Generation Parameters
                    </h4>
                    <div class="bg-blue-100 dark:bg-blue-900/30 p-3 rounded">
                        <pre class="text-xs text-blue-900 whitespace-pre-wrap">${data.parameters}</pre>
                        <p class="text-xs text-blue-600 mt-2 italic">
                            <i class="fas fa-info-circle mr-1"></i>
                            These are the default generation parameters set by the model creator (e.g., temperature, top_k, top_p). They can be overridden per-request when generating text with this model.
                        </p>
                    </div>
                </div>`;
            } else {
                detailsHtml += `
                <div class="border-l-4 border-gray-400 pl-4">
                    <h4 class="text-lg font-semibold text-gray-600 mb-2">
                        <i class="fas fa-cog mr-2"></i>Generation Parameters
                    </h4>
                    <div class="bg-gray-100 dark:bg-gray-800/50 p-3 rounded">
                        <p class="text-sm text-gray-700 dark:text-gray-200">This model has no custom default parameters in its Modelfile.</p>
                        <p class="text-xs text-gray-500 mt-2 italic">
                            <i class="fas fa-info-circle mr-1"></i>
                            You can still set generation parameters (temperature, top_k, top_p, etc.) per-request when generating text.
                        </p>
                    </div>
                </div>`;
            }

            // Modelfile Section
            if (data.modelfile) {
                detailsHtml += `
                <div class="border-l-4 border-purple-500 pl-4">
                    <h4 class="text-lg font-semibold text-purple-700 mb-2">
                        <i class="fas fa-file-code mr-2"></i>Modelfile
                    </h4>
                    <div class="bg-purple-100 dark:bg-purple-900/30 p-3 rounded">
                        <pre class="text-xs text-purple-900 overflow-x-auto whitespace-pre-wrap max-h-60 overflow-y-auto border border-purple-200 p-2 bg-white rounded">${data.modelfile}</pre>
                        <p class="text-xs text-purple-600 mt-2 italic">
                            <i class="fas fa-info-circle mr-1"></i>
                            This is the complete Modelfile with defaults from the model creator. Parameters shown here are the base configuration.
                        </p>
                    </div>
                </div>`;
            }

            // Additional Details Section
            if (data.details) {
                detailsHtml += `
                <div class="border-l-4 border-gray-500 pl-4">
                    <h4 class="text-lg font-semibold text-gray-700 mb-2">
                        <i class="fas fa-info mr-2"></i>Technical Details
                    </h4>
                    <div class="bg-gray-100 dark:bg-gray-800/50 p-3 rounded">
                        <pre class="text-xs text-gray-700 dark:text-gray-200 overflow-x-auto">${JSON.stringify(data.details, null, 2)}</pre>
                    </div>
                </div>`;
            }

            detailsHtml += `</div>`;
        }

        document.getElementById('modelDetails').innerHTML = detailsHtml;
    } catch (error) {
        document.getElementById('modelDetails').innerHTML = `<div class="text-red-600">Error loading model details: ${error.message}</div>`;
    }
}

function closeModal() {
    document.getElementById('modelModal').classList.add('hidden');
    document.getElementById('modelModal').classList.remove('flex');
}

// Enable pull on Enter key
document.addEventListener('DOMContentLoaded', function () {
    // Initialize theme
    initializeTheme();

    // Add theme toggle event listener
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', cycleTheme);
    }

    const modelNameInput = document.getElementById('modelName');
    if (modelNameInput) {
        modelNameInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                pullModel();
            }
        });
    }

    // Initial status update on page load
    updateModelStatus();

    // Auto-update status every 30 seconds (non-disruptive)
    setInterval(async () => {
        // Only update if status icon exists in DOM
        if (document.querySelector('.fas.fa-flask-vial')) {
            await updateModelStatus();
            updateTimestamp();
        }
    }, 30000);

    // Status modal close button event listener
    const statusModalClose = document.getElementById('statusModalClose');
    if (statusModalClose) {
        statusModalClose.addEventListener('click', () => {
            document.getElementById('statusModal').classList.add('hidden');
            window.location.reload();
        });
    }
    

    loadParameterPreset();
    loadActiveDownloads();
});