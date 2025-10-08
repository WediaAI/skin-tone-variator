/* tslint:disable */
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {GoogleGenAI, Modality} from '@google/genai';

// Fix: Define and use AIStudio interface for window.aistudio to resolve type conflict.
// Define the aistudio property on the window object for TypeScript
declare global {
  interface AIStudio {
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

async function openApiKeyDialog() {
  if (window.aistudio?.openSelectKey) {
    await window.aistudio.openSelectKey();
  } else {
    // This provides a fallback for environments where the dialog isn't available
    showStatusError(
      'API key selection is not available. Please configure the API_KEY environment variable.',
    );
  }
}

const statusEl = document.querySelector('#status') as HTMLParagraphElement;
const imageUploadEl = document.querySelector(
  '#image-upload',
) as HTMLInputElement;
const previewContainerEl = document.querySelector(
  '#preview-container',
) as HTMLDivElement;
const originalImageEl = document.querySelector(
  '#original-image',
) as HTMLImageElement;
const generateButton = document.querySelector(
  '#generate-button',
) as HTMLButtonElement;
const outputGalleryEl = document.querySelector(
  '#output-gallery',
) as HTMLDivElement;
const demoButton = document.querySelector(
  '#demo-button',
) as HTMLButtonElement;

const ETHNICITIES = [
  'Noir',
  'Asiatique de l\'Est',
  'Asiatique du Sud',
  'Latino',
  'Moyen-Oriental',
  'Blanc',
];

// --- State Variables ---
let originalImageBase64: string | null = null;
let originalImageMimeType: string | null = null;

// --- API Key Configuration ---
// Clé API Gemini intégrée
const GEMINI_API_KEY = 'AIzaSyABoNqQYClL9LFomFopvHDL4c-fHRePmmI';

// --- Utility Functions ---
function fileToGenerativePart(file: File) {
  return new Promise<{base64: string; mimeType: string}>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        return reject(new Error('Failed to read file as string'));
      }
      const base64 = reader.result.split(',')[1];
      resolve({base64, mimeType: file.type});
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function showStatusError(message: string) {
  statusEl.innerHTML = `<span class="text-red-500">${message}</span>`;
}

function setControlsDisabled(disabled: boolean) {
  generateButton.disabled = disabled;
  imageUploadEl.disabled = disabled;
}

// --- Main Application Logic ---
async function generateSingleVariation(
  apiKey: string,
  ethnicity: string,
  galleryItem: HTMLDivElement,
) {
  const prompt = `Vous êtes un outil d'édition d'images précis. Votre SEULE fonction est de modifier l'ethnicité de la personne dans l'image fournie pour ${ethnicity}. Vous devez respecter strictement les règles suivantes, en traitant l'image originale comme un modèle fixe.
RÈGLES CRITIQUES - LA SORTIE DOIT ÊTRE IDENTIQUE À L'ORIGINAL SAUF POUR L'ETHNICITÉ :
VÊTEMENTS : NE modifiez PAS les vêtements, le tissu, la couleur ou le style de quelque manière que ce soit. Ils doivent être IDENTIQUES.
POSE ET EXPRESSION : La pose de la personne, l'expression faciale et la position du corps DOIVENT rester INCHANGÉES.
ACCESSOIRES ET COIFFURE : NE changez PAS les accessoires (bijoux, lunettes, etc.). Vous pouvez adapter la coiffure de la personne selon l'ethnicité.
ARRIÈRE-PLAN ET ÉCLAIRAGE : L'arrière-plan, le décor et l'éclairage de l'image DOIVENT être IDENTIQUES à l'original.
Votre seule modification concerne le teint de peau et les caractéristiques ethniques de la personne pour représenter avec précision un individu ${ethnicity}. Tous les autres éléments de l'image sont non négociables et doivent être préservés exactement comme dans l'original.`;

  const imgEl = galleryItem.querySelector('img') as HTMLImageElement;
  const loadingIndicator = galleryItem.querySelector('.absolute.inset-0.flex') as HTMLDivElement;
  const statusBadge = galleryItem.querySelector('.absolute.top-4.right-4 div') as HTMLDivElement;
  const progressBar = galleryItem.querySelector('.bg-gradient-to-r') as HTMLDivElement;
  const statusText = galleryItem.querySelector('.text-xs.text-slate-500') as HTMLSpanElement;

  try {
    const ai = new GoogleGenAI({apiKey});
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: originalImageBase64!,
              mimeType: originalImageMimeType!,
            },
          },
          {text: prompt},
        ],
      },
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const base64ImageBytes = part.inlineData.data;
        const imageUrl = `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`;
        imgEl.src = imageUrl;
        imgEl.classList.remove('animate-pulse');
        
        // Masquer l'indicateur de chargement
        if (loadingIndicator) {
          loadingIndicator.style.display = 'none';
        }
        
        // Mettre à jour la barre de progression
        if (progressBar) {
          progressBar.style.width = '100%';
          progressBar.className = 'bg-gradient-to-r from-green-500 to-emerald-600 h-1.5 rounded-full transition-all duration-500';
        }
        
        // Mettre à jour le texte de statut
        if (statusText) {
          statusText.textContent = 'Terminé';
          statusText.className = 'text-xs text-green-600 font-medium';
        }
        
        // Masquer le badge de statut
        if (statusBadge) {
          statusBadge.style.display = 'none';
        }
        
        return;
      }
    }
    throw new Error('Aucune image n\'a été générée pour cette variation.');
  } catch (e) {
    console.error(`Échec de génération de variation pour ${ethnicity}:`, e);
    
    let errorMessage = 'Une erreur inconnue s\'est produite.';
    let isQuotaError = false;
    
    if (e instanceof Error) {
      errorMessage = e.message;
      // Détecter les erreurs de quota
      if (e.message.includes('quota') || e.message.includes('429') || e.message.includes('RESOURCE_EXHAUSTED')) {
        isQuotaError = true;
        errorMessage = 'Quota API dépassé';
      }
    }
    
    // Masquer l'indicateur de chargement
    if (loadingIndicator) {
      loadingIndicator.style.display = 'none';
    }
    
    // Mettre à jour la barre de progression
    if (progressBar) {
      progressBar.style.width = '100%';
      if (isQuotaError) {
        progressBar.className = 'bg-gradient-to-r from-orange-500 to-red-500 h-1.5 rounded-full transition-all duration-500';
      } else {
        progressBar.className = 'bg-gradient-to-r from-red-500 to-red-600 h-1.5 rounded-full transition-all duration-500';
      }
    }
    
    // Mettre à jour le texte de statut
    if (statusText) {
      if (isQuotaError) {
        statusText.textContent = 'Quota dépassé';
        statusText.className = 'text-xs text-orange-600 font-medium';
      } else {
        statusText.textContent = 'Échec';
        statusText.className = 'text-xs text-red-600 font-medium';
      }
    }
    
    // Mettre à jour le badge de statut avec l'erreur
    if (statusBadge) {
      if (isQuotaError) {
        statusBadge.innerHTML = `
          <span class="flex items-center space-x-1">
            <div class="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
            <span>Quota dépassé</span>
          </span>
        `;
        statusBadge.className = 'px-3 py-1.5 bg-orange-50/95 backdrop-blur-sm text-orange-700 text-xs font-semibold rounded-full shadow-lg border border-orange-200/50';
      } else {
        statusBadge.innerHTML = `
          <span class="flex items-center space-x-1">
            <div class="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
            <span>Échec</span>
          </span>
        `;
        statusBadge.className = 'px-3 py-1.5 bg-red-50/95 backdrop-blur-sm text-red-700 text-xs font-semibold rounded-full shadow-lg border border-red-200/50';
      }
    }
    
    imgEl.classList.remove('animate-pulse');
    imgEl.classList.add('opacity-30');
    throw e; // Re-throw to be caught by Promise.allSettled
  }
}

async function generate() {
  // Utiliser la clé API intégrée
  const apiKey = GEMINI_API_KEY;

  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
    showStatusError('Clé API non configurée. Veuillez configurer GEMINI_API_KEY dans le script.');
    return;
  }

  statusEl.innerText = 'Génération des variations...';
  setControlsDisabled(true);
  setupGallery();

  const galleryItems = Array.from(
    outputGalleryEl.children,
  ) as HTMLDivElement[];

  const generationPromises = ETHNICITIES.map((ethnicity, index) =>
    generateSingleVariation(apiKey, ethnicity, galleryItems[index]),
  );

  const results = await Promise.allSettled(generationPromises);
  const successfulGenerations = results.filter(
    r => r.status === 'fulfilled',
  ).length;

  // Vérifier s'il y a des erreurs de quota
  const quotaErrors = results.filter(r => 
    r.status === 'rejected' && 
    r.reason instanceof Error && 
    (r.reason.message.includes('quota') || r.reason.message.includes('429'))
  ).length;

  if (successfulGenerations === ETHNICITIES.length) {
    statusEl.innerText = 'Variations générées avec succès.';
  } else if (quotaErrors > 0) {
    showStatusError(
      `Quota API dépassé. ${successfulGenerations}/${ETHNICITIES.length} variations générées. Attendez 24h ou passez à un plan payant.`
    );
  } else if (successfulGenerations > 0) {
    statusEl.innerText = `Généré ${successfulGenerations}/${ETHNICITIES.length} variations. Certaines ont échoué.`;
  } else {
    showStatusError(
      'Impossible de générer des variations. Vérifiez votre clé API et votre quota.',
    );
  }

  setControlsDisabled(false);
  generateButton.disabled = false; // Re-enable for another run
}

function setupGallery() {
  outputGalleryEl.innerHTML = ''; // Clear previous results
  for (const ethnicity of ETHNICITIES) {
    const galleryItem = document.createElement('div');
    galleryItem.className =
      'group relative bg-white rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-700 transform hover:scale-105 hover:-translate-y-2 border border-slate-200/50 backdrop-blur-sm';
    galleryItem.innerHTML = `
      <!-- Image container avec effet glassmorphism -->
      <div class="aspect-[4/5] relative overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50">
        <img src="" alt="Image générée pour ${ethnicity}" class="w-full h-full object-contain group-hover:scale-110 transition-transform duration-1000 ease-out"/>
        
        <!-- Overlay avec effet de brillance -->
        <div class="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        
        <!-- Indicateur de chargement premium -->
        <div class="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm">
          <div class="text-center">
            <div class="w-16 h-16 bg-gradient-to-br from-slate-600 to-blue-700 rounded-2xl flex items-center justify-center mb-4 mx-auto shadow-lg animate-pulse">
              <svg class="w-8 h-8 text-white animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
            </div>
            <p class="text-slate-600 font-medium text-sm">Génération en cours...</p>
          </div>
        </div>
        
        <!-- Bouton plein écran -->
        <button class="absolute top-3 left-3 w-10 h-10 bg-white/90 fullscreen-btn rounded-full flex items-center justify-center shadow-lg opacity-100 transition-all duration-300 hover:bg-white hover:scale-110" onclick="openFullscreen('${ethnicity.replace(/'/g, "\\'")}')" title="Voir en plein écran">
          <svg class="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path>
          </svg>
        </button>
        
        <!-- Effet de brillance qui traverse -->
        <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
      </div>
      
      <!-- Contenu de la carte -->
      <div class="p-4 bg-white">
        <div class="text-center">
          <h3 class="text-sm font-semibold text-gray-800">${ethnicity}</h3>
        </div>
      </div>
      
      <!-- Badge de statut flottant -->
      <div class="absolute top-4 right-4">
        <div class="px-3 py-1.5 bg-white/95 backdrop-blur-sm text-slate-700 text-xs font-semibold rounded-full shadow-lg border border-slate-200/50">
          <span class="flex items-center space-x-1">
            <div class="w-1.5 h-1.5 bg-slate-400 rounded-full animate-pulse"></div>
            <span>Génération</span>
          </span>
        </div>
      </div>
    `;
    outputGalleryEl.appendChild(galleryItem);
  }
}

// --- Fonction plein écran ---
function openFullscreen(ethnicity: string) {
  console.log('Tentative d ouverture plein ecran pour:', ethnicity);
  console.log('Fonction openFullscreen appelee');
  
  // Trouver l'image correspondante
  const galleryItems = document.querySelectorAll('#output-gallery > div');
  console.log('Nombre d elements de galerie trouves:', galleryItems.length);
  
  let targetImage: HTMLImageElement | null = null;
  
  for (const item of galleryItems) {
    const title = item.querySelector('h3')?.textContent;
    console.log('Titre trouve:', title, 'Recherche:', ethnicity);
    if (title === ethnicity) {
      targetImage = item.querySelector('img') as HTMLImageElement;
      console.log('Image trouvee:', targetImage?.src);
      break;
    }
  }
  
  if (!targetImage || !targetImage.src || targetImage.src === '') {
    console.log('Image non trouvee ou vide');
    alert('Image non disponible ou pas encore generee');
    return;
  }
  
  // Créer le modal plein écran
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 fullscreen-modal';
  modal.innerHTML = `
    <div class="relative max-w-4xl max-h-full w-full h-full flex items-center justify-center">
      <!-- Image en plein écran -->
      <img src="${targetImage.src}" alt="Image générée pour ${ethnicity}" class="max-w-full max-h-full object-contain rounded-lg shadow-2xl"/>
      
      <!-- Bouton fermer -->
      <button class="absolute top-4 right-4 w-12 h-12 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:bg-white hover:scale-110 transition-all duration-300" onclick="closeFullscreen()">
        <svg class="w-6 h-6 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
      
      <!-- Titre de l'image -->
      <div class="absolute bottom-4 left-4 right-4 bg-black/60 backdrop-blur-sm rounded-lg p-4">
        <h3 class="text-white text-xl font-bold mb-1">${ethnicity}</h3>
        <p class="text-white/80 text-sm">Variation de teint de peau générée par IA</p>
      </div>
      
      <!-- Bouton télécharger -->
      <button class="absolute bottom-4 right-4 w-12 h-12 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:bg-white hover:scale-110 transition-all duration-300" onclick="downloadImage('${targetImage.src}', '${ethnicity}')">
        <svg class="w-6 h-6 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
        </svg>
      </button>
    </div>
  `;
  
  // Ajouter le modal au DOM
  document.body.appendChild(modal);
  
  // Fermer avec Escape
  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeFullscreen();
    }
  };
  
  document.addEventListener('keydown', handleKeydown);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeFullscreen();
    }
  });
  
  // Stocker la fonction de nettoyage
  (modal as any).cleanup = () => {
    document.removeEventListener('keydown', handleKeydown);
  };
}

function closeFullscreen() {
  const modal = document.querySelector('.fixed.inset-0.bg-black\\/90');
  if (modal) {
    (modal as any).cleanup?.();
    modal.remove();
  }
}

function downloadImage(imageSrc: string, ethnicity: string) {
  const link = document.createElement('a');
  link.href = imageSrc;
  link.download = `variation-${ethnicity.toLowerCase().replace(/\s+/g, '-')}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Exposer les fonctions globalement
(window as any).openFullscreen = openFullscreen;
(window as any).closeFullscreen = closeFullscreen;
(window as any).downloadImage = downloadImage;

// --- Event Listeners ---
imageUploadEl.addEventListener('change', async () => {
  const file = imageUploadEl.files?.[0];
  if (!file) {
    return;
  }

  statusEl.innerText = 'Traitement de l\'image...';
  try {
    const {base64, mimeType} = await fileToGenerativePart(file);
    originalImageBase64 = base64;
    originalImageMimeType = mimeType;

    originalImageEl.src = `data:${mimeType};base64,${base64}`;
    previewContainerEl.classList.remove('hidden');
    statusEl.innerText = 'Prêt à générer les variations.';
    outputGalleryEl.innerHTML = ''; // Clear gallery on new image upload
    updateGenerateButtonState(); // Mettre à jour l'état du bouton
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Une erreur inconnue s\'est produite';
    showStatusError(`Erreur lors du traitement du fichier : ${message}`);
    console.error(e);
  }
});

generateButton.addEventListener('click', () => {
  if (!originalImageBase64) {
    showStatusError('Veuillez d\'abord télécharger une image.');
    return;
  }
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
    showStatusError('Clé API non configurée. Veuillez configurer GEMINI_API_KEY dans le script.');
    return;
  }
  generate();
});

// Activer le bouton de génération quand une image est uploadée
function updateGenerateButtonState() {
  const hasImage = !!originalImageBase64;
  const hasApiKey = GEMINI_API_KEY && GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY_HERE';
  generateButton.disabled = !(hasImage && hasApiKey);
}

// Initialisation au chargement de la page
function initializeApp() {
  // Vérifier si la clé API est configurée
  if (GEMINI_API_KEY && GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY_HERE') {
    statusEl.innerText = 'Application prête.';
  } else {
    statusEl.innerText = 'Clé API non configurée.';
  }
}

// Lancer l'initialisation quand le DOM est prêt
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

// Mode démo avec des images d'exemple
demoButton.addEventListener('click', () => {
  statusEl.innerText = 'Chargement du mode démo...';
  setupGallery();
  
  // Simuler des images d'exemple (placeholder)
  const galleryItems = Array.from(outputGalleryEl.children) as HTMLDivElement[];
  
  galleryItems.forEach((item, index) => {
    const imgEl = item.querySelector('img') as HTMLImageElement;
    const labelEl = item.querySelector('p') as HTMLParagraphElement;
    
    // Créer une image de démonstration avec un dégradé de couleur
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext('2d')!;
    
    // Créer un dégradé basé sur l'ethnicité
    const colors = [
      '#8B4513', // Noir - brun foncé
      '#F4A460', // Asiatique de l'Est - beige
      '#DEB887', // Asiatique du Sud - brun clair
      '#CD853F', // Latino - brun moyen
      '#D2B48C', // Moyen-Oriental - tan
      '#F5DEB3'  // Blanc - beige clair
    ];
    
    const gradient = ctx.createLinearGradient(0, 0, 200, 200);
    gradient.addColorStop(0, colors[index]);
    gradient.addColorStop(1, '#FFFFFF');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 200, 200);
    
    // Ajouter du texte
    ctx.fillStyle = '#333';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Mode Démo', 100, 100);
    ctx.fillText(ETHNICITIES[index], 100, 120);
    
    imgEl.src = canvas.toDataURL();
    imgEl.classList.remove('animate-pulse');
    labelEl.innerHTML = `<span class="text-blue-500 text-xs">Démo</span>`;
  });
  
  statusEl.innerText = 'Mode démo activé - Images d\'exemple affichées.';
});