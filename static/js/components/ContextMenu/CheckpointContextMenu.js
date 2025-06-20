import { BaseContextMenu } from './BaseContextMenu.js';
import { refreshSingleCheckpointMetadata, saveModelMetadata } from '../../api/checkpointApi.js';
import { showToast, getNSFWLevelName } from '../../utils/uiHelpers.js';
import { NSFW_LEVELS } from '../../utils/constants.js';
import { getStorageItem } from '../../utils/storageHelpers.js';

export class CheckpointContextMenu extends BaseContextMenu {
    constructor() {
        super('checkpointContextMenu', '.lora-card');
        this.nsfwSelector = document.getElementById('nsfwLevelSelector');
        
        // Initialize NSFW Level Selector events
        if (this.nsfwSelector) {
            this.initNSFWSelector();
        }
    }
    
    handleMenuAction(action) {
        switch(action) {
            case 'details':
                // Show checkpoint details
                this.currentCard.click();
                break;
            case 'preview':
                // Replace checkpoint preview
                if (this.currentCard.querySelector('.fa-image')) {
                    this.currentCard.querySelector('.fa-image').click();
                }
                break;
            case 'civitai':
                // Open civitai page
                if (this.currentCard.dataset.from_civitai === 'true') {
                    if (this.currentCard.querySelector('.fa-globe')) {
                        this.currentCard.querySelector('.fa-globe').click();
                    }
                } else {
                    showToast('No CivitAI information available', 'info');
                }
                break;
            case 'delete':
                // Delete checkpoint
                if (this.currentCard.querySelector('.fa-trash')) {
                    this.currentCard.querySelector('.fa-trash').click();
                }
                break;
            case 'copyname':
                // Copy checkpoint name
                if (this.currentCard.querySelector('.fa-copy')) {
                    this.currentCard.querySelector('.fa-copy').click();
                }
                break;
            case 'refresh-metadata':
                // Refresh metadata from CivitAI
                refreshSingleCheckpointMetadata(this.currentCard.dataset.filepath);
                break;
            case 'set-nsfw':
                // Set NSFW level
                this.showNSFWLevelSelector(null, null, this.currentCard);
                break;
            case 'move':
                // Move to folder (placeholder)
                showToast('Move to folder feature coming soon', 'info');
                break;
        }
    }

    // NSFW Selector methods
    initNSFWSelector() {
        // Close button
        const closeBtn = this.nsfwSelector.querySelector('.close-nsfw-selector');
        closeBtn.addEventListener('click', () => {
            this.nsfwSelector.style.display = 'none';
        });

        // Level buttons
        const levelButtons = this.nsfwSelector.querySelectorAll('.nsfw-level-btn');
        levelButtons.forEach(btn => {
            btn.addEventListener('click', async () => {
                const level = parseInt(btn.dataset.level);
                const filePath = this.nsfwSelector.dataset.cardPath;
                
                if (!filePath) return;
                
                try {
                    await saveModelMetadata(filePath, { preview_nsfw_level: level });
                    
                    // Update card data
                    const card = document.querySelector(`.lora-card[data-filepath="${filePath}"]`);
                    if (card) {
                        let metaData = {};
                        try {
                            metaData = JSON.parse(card.dataset.meta || '{}');
                        } catch (err) {
                            console.error('Error parsing metadata:', err);
                        }
                        
                        metaData.preview_nsfw_level = level;
                        card.dataset.meta = JSON.stringify(metaData);
                        card.dataset.nsfwLevel = level.toString();
                        
                        // Apply blur effect immediately
                        this.updateCardBlurEffect(card, level);
                    }
                    
                    showToast(`Content rating set to ${getNSFWLevelName(level)}`, 'success');
                    this.nsfwSelector.style.display = 'none';
                } catch (error) {
                    showToast(`Failed to set content rating: ${error.message}`, 'error');
                }
            });
        });
        
        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (this.nsfwSelector.style.display === 'block' && 
                !this.nsfwSelector.contains(e.target) && 
                !e.target.closest('.context-menu-item[data-action="set-nsfw"]')) {
                this.nsfwSelector.style.display = 'none';
            }
        });
    }

    updateCardBlurEffect(card, level) {
        // Get user settings for blur threshold
        const blurThreshold = parseInt(getStorageItem('nsfwBlurLevel') || '4');
        
        // Get card preview container
        const previewContainer = card.querySelector('.card-preview');
        if (!previewContainer) return;
        
        // Get preview media element
        const previewMedia = previewContainer.querySelector('img') || previewContainer.querySelector('video');
        if (!previewMedia) return;
        
        // Check if blur should be applied
        if (level >= blurThreshold) {
            // Add blur class to the preview container
            previewContainer.classList.add('blurred');
            
            // Get or create the NSFW overlay
            let nsfwOverlay = previewContainer.querySelector('.nsfw-overlay');
            if (!nsfwOverlay) {
                // Create new overlay
                nsfwOverlay = document.createElement('div');
                nsfwOverlay.className = 'nsfw-overlay';
                
                // Create and configure the warning content
                const warningContent = document.createElement('div');
                warningContent.className = 'nsfw-warning';
                
                // Determine NSFW warning text based on level
                let nsfwText = "Mature Content";
                if (level >= NSFW_LEVELS.XXX) {
                    nsfwText = "XXX-rated Content";
                } else if (level >= NSFW_LEVELS.X) {
                    nsfwText = "X-rated Content";
                } else if (level >= NSFW_LEVELS.R) {
                    nsfwText = "R-rated Content";
                }
                
                // Add warning text and show button
                warningContent.innerHTML = `
                    <p>${nsfwText}</p>
                    <button class="show-content-btn">Show</button>
                `;
                
                // Add click event to the show button
                const showBtn = warningContent.querySelector('.show-content-btn');
                showBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    previewContainer.classList.remove('blurred');
                    nsfwOverlay.style.display = 'none';
                    
                    // Update toggle button icon if it exists
                    const toggleBtn = card.querySelector('.toggle-blur-btn');
                    if (toggleBtn) {
                        toggleBtn.querySelector('i').className = 'fas fa-eye-slash';
                    }
                });
                
                nsfwOverlay.appendChild(warningContent);
                previewContainer.appendChild(nsfwOverlay);
            } else {
                // Update existing overlay
                const warningText = nsfwOverlay.querySelector('p');
                if (warningText) {
                    let nsfwText = "Mature Content";
                    if (level >= NSFW_LEVELS.XXX) {
                        nsfwText = "XXX-rated Content";
                    } else if (level >= NSFW_LEVELS.X) {
                        nsfwText = "X-rated Content";
                    } else if (level >= NSFW_LEVELS.R) {
                        nsfwText = "R-rated Content";
                    }
                    warningText.textContent = nsfwText;
                }
                nsfwOverlay.style.display = 'flex';
            }
            
            // Get or create the toggle button in the header
            const cardHeader = previewContainer.querySelector('.card-header');
            if (cardHeader) {
                let toggleBtn = cardHeader.querySelector('.toggle-blur-btn');
                
                if (!toggleBtn) {
                    toggleBtn = document.createElement('button');
                    toggleBtn.className = 'toggle-blur-btn';
                    toggleBtn.title = 'Toggle blur';
                    toggleBtn.innerHTML = '<i class="fas fa-eye"></i>';
                    
                    // Add click event to toggle button
                    toggleBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const isBlurred = previewContainer.classList.toggle('blurred');
                        const icon = toggleBtn.querySelector('i');
                        
                        // Update icon and overlay visibility
                        if (isBlurred) {
                            icon.className = 'fas fa-eye';
                            nsfwOverlay.style.display = 'flex';
                        } else {
                            icon.className = 'fas fa-eye-slash';
                            nsfwOverlay.style.display = 'none';
                        }
                    });
                    
                    // Add to the beginning of header
                    cardHeader.insertBefore(toggleBtn, cardHeader.firstChild);
                    
                    // Update base model label class
                    const baseModelLabel = cardHeader.querySelector('.base-model-label');
                    if (baseModelLabel && !baseModelLabel.classList.contains('with-toggle')) {
                        baseModelLabel.classList.add('with-toggle');
                    }
                } else {
                    // Update existing toggle button
                    toggleBtn.querySelector('i').className = 'fas fa-eye';
                }
            }
        } else {
            // Remove blur
            previewContainer.classList.remove('blurred');
            
            // Hide overlay if it exists
            const overlay = previewContainer.querySelector('.nsfw-overlay');
            if (overlay) overlay.style.display = 'none';
            
            // Remove toggle button when content is set to PG or PG13
            const cardHeader = previewContainer.querySelector('.card-header');
            if (cardHeader) {
                const toggleBtn = cardHeader.querySelector('.toggle-blur-btn');
                if (toggleBtn) {
                    // Remove the toggle button completely
                    toggleBtn.remove();
                    
                    // Update base model label class if it exists
                    const baseModelLabel = cardHeader.querySelector('.base-model-label');
                    if (baseModelLabel && baseModelLabel.classList.contains('with-toggle')) {
                        baseModelLabel.classList.remove('with-toggle');
                    }
                }
            }
        }
    }

    showNSFWLevelSelector(x, y, card) {
        const selector = document.getElementById('nsfwLevelSelector');
        const currentLevelEl = document.getElementById('currentNSFWLevel');
        
        // Get current NSFW level
        let currentLevel = 0;
        try {
            const metaData = JSON.parse(card.dataset.meta || '{}');
            currentLevel = metaData.preview_nsfw_level || 0;
            
            // Update if we have no recorded level but have a dataset attribute
            if (!currentLevel && card.dataset.nsfwLevel) {
                currentLevel = parseInt(card.dataset.nsfwLevel) || 0;
            }
        } catch (err) {
            console.error('Error parsing metadata:', err);
        }
        
        currentLevelEl.textContent = getNSFWLevelName(currentLevel);
        
        // Position the selector
        if (x && y) {
            const viewportWidth = document.documentElement.clientWidth;
            const viewportHeight = document.documentElement.clientHeight;
            const selectorRect = selector.getBoundingClientRect();
            
            // Center the selector if no coordinates provided
            let finalX = (viewportWidth - selectorRect.width) / 2;
            let finalY = (viewportHeight - selectorRect.height) / 2;
            
            selector.style.left = `${finalX}px`;
            selector.style.top = `${finalY}px`;
        }
        
        // Highlight current level button
        document.querySelectorAll('.nsfw-level-btn').forEach(btn => {
            if (parseInt(btn.dataset.level) === currentLevel) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        // Store reference to current card
        selector.dataset.cardPath = card.dataset.filepath;
        
        // Show selector
        selector.style.display = 'block';
    }
}