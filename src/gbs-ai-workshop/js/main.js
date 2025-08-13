import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- GLOBAL STATE ---
let db, auth, userId, userPromptsUnsubscribe, appId;
let userLibrary = []; // Local cache of user's prompts
let currentScenarioCategory = null;
let currentScenarioIndex = 0;
let currentDayEventIndex = 0;

// --- DATA PLACEHOLDERS ---
// This data will be loaded from a JSON file.
let prompts = [];
let scenarios = {};
let caseStudies = {};
let myDayEvents = [];
let opportunityData = {};
let opportunityDetailsData = {};

// --- FIREBASE & DATA INITIALIZATION ---
async function loadDataAndInit() {
    try {
        const response = await fetch('../../data/gbs-workshop-data.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        // Assign loaded data to the placeholders
        prompts = data.prompts;
        scenarios = data.scenarios;
        caseStudies = data.caseStudies;
        myDayEvents = data.myDayEvents;
        opportunityData = data.opportunityData;
        opportunityDetailsData = data.opportunityDetailsData;

        // Now that data is loaded, initialize the rest of the app
        await initFirebase();
        updateSectionVisibility();
        displayPrompts('All');
        initializeChart();

    } catch (error) {
        console.error("Could not load initial data:", error);
        // Handle the error appropriately, maybe show a message to the user
    }
}

async function initFirebase() {
    appId = typeof __app_id !== 'undefined' ? __app_id : 'gbs-gemini-training';
    const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;

    if (!firebaseConfig) {
        console.error("Firebase config not found.");
        return;
    }

    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);

    onAuthStateChanged(auth, user => {
        if (user) {
            userId = user.uid;
            console.log("User is signed in with UID:", userId);
            loadUserLibrary();
        } else {
            console.log("User is signed out.");
            if (userPromptsUnsubscribe) userPromptsUnsubscribe();
        }
    });

    try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
        } else {
            await signInAnonymously(auth);
        }
    } catch (error) {
        console.error("Authentication failed:", error);
    }
}

// --- DATA HANDLING (FIRESTORE) ---
function loadUserLibrary() {
    if (!userId) return;
    const promptsCollectionPath = `/artifacts/${appId}/users/${userId}/prompts`;
    const q = query(collection(db, promptsCollectionPath));

    userPromptsUnsubscribe = onSnapshot(q, (querySnapshot) => {
        userLibrary = [];
        querySnapshot.forEach((doc) => {
            userLibrary.push({ id: doc.id, ...doc.data() });
        });
        console.log("User library loaded/updated:", userLibrary);
        renderMyLibrary();
        displayPrompts('All'); // Re-render main library to update favorite statuses
    });
}

async function addPromptToLibrary(promptData) {
    if (!userId) return;
    const promptsCollectionPath = `/artifacts/${appId}/users/${userId}/prompts`;
    try {
        await addDoc(collection(db, promptsCollectionPath), promptData);
        console.log("Prompt added to library");
    } catch (e) {
        console.error("Error adding document: ", e);
    }
}

async function removePromptFromLibrary(promptId) {
    if (!userId) return;
    const docPath = `/artifacts/${appId}/users/${userId}/prompts/${promptId}`;
    try {
        await deleteDoc(doc(db, docPath));
        console.log("Prompt removed from library");
    } catch(e) {
        console.error("Error removing document: ", e);
    }
}

// --- RENDER FUNCTIONS ---
function renderMyLibrary() {
    const customList = document.getElementById('my-custom-prompts-list');
    const favoriteList = document.getElementById('my-favorite-prompts-list');
    const noCustomMsg = document.getElementById('no-custom-prompts');
    const noFavoriteMsg = document.getElementById('no-favorite-prompts');

    if (!customList) return; // Exit if not on the right page

    customList.innerHTML = '';
    favoriteList.innerHTML = '';

    const customPrompts = userLibrary.filter(p => p.type === 'custom');
    const favoritePrompts = userLibrary.filter(p => p.type === 'favorite');

    // Render Custom Prompts
    if (customPrompts.length > 0) {
        noCustomMsg.classList.add('hidden');
        customList.classList.remove('hidden');
        customPrompts.forEach(prompt => {
            const card = createPromptCard(prompt, true);
            customList.appendChild(card);
        });
    } else {
        noCustomMsg.classList.remove('hidden');
        customList.classList.add('hidden');
    }

    // Render Favorite Prompts
    if (favoritePrompts.length > 0) {
        noFavoriteMsg.classList.add('hidden');
        favoriteList.classList.remove('hidden');
        favoritePrompts.forEach(prompt => {
            const originalPrompt = prompts.find(p => p.id === prompt.originalId);
            if (originalPrompt) {
               const card = createPromptCard({ ...originalPrompt, libraryId: prompt.id }, true);
               favoriteList.appendChild(card);
            }
        });
    } else {
        noFavoriteMsg.classList.remove('hidden');
        favoriteList.classList.add('hidden');
    }
}

const promptLibraryEl = document.getElementById('prompt-library');
function displayPrompts(filter) {
    if (!promptLibraryEl) return;
    promptLibraryEl.innerHTML = '';
    const filteredPrompts = (filter === 'All') ? prompts : prompts.filter(p => p.category === filter);

    filteredPrompts.forEach(prompt => {
        const card = createPromptCard(prompt, false);
        promptLibraryEl.appendChild(card);
    });
}

function createPromptCard(prompt, isMyLibrary) {
    const card = document.createElement('div');
    card.className = 'prompt-card bg-white p-6 rounded-lg shadow-sm';

    const isFavorited = userLibrary.some(p => p.type === 'favorite' && p.originalId === prompt.id);

    let buttonsHtml = '';
    if (isMyLibrary) {
        if (prompt.type === 'custom') { // It's a custom prompt in the library
            buttonsHtml = `<button data-id="${prompt.id}" class="remove-custom-btn text-red-500 hover:text-red-700 text-xs font-semibold">Remove</button>`;
        } else { // It's a favorited prompt in the library
            buttonsHtml = `<button data-id="${prompt.libraryId}" class="unfavorite-btn text-red-500 hover:text-red-700 text-xs font-semibold">Unfavorite</button>`;
        }
    } else { // It's in the main library
        buttonsHtml = `
            <svg data-id="${prompt.id}" class="favorite-btn h-6 w-6 ${isFavorited ? 'favorited' : ''}" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
            </svg>
        `;
    }

    card.innerHTML = `
        <div>
            <h4 class="font-bold text-lg mb-2 text-[#4A90E2]">${prompt.title}</h4>
            <p class="text-gray-600 text-sm">${prompt.content}</p>
        </div>
        <div class="mt-4 pt-4 border-t border-gray-100 flex justify-end items-center">
            ${buttonsHtml}
        </div>
    `;
    return card;
}


// --- EVENT LISTENERS ---
document.addEventListener('click', (e) => {
    // Favorite button in main library
    if (e.target.closest('.favorite-btn')) {
        const btn = e.target.closest('.favorite-btn');
        const promptId = btn.dataset.id;
        const existingFavorite = userLibrary.find(p => p.type === 'favorite' && p.originalId === promptId);

        if (existingFavorite) {
            removePromptFromLibrary(existingFavorite.id);
        } else {
            addPromptToLibrary({ type: 'favorite', originalId: promptId });
        }
    }
    // Unfavorite button in my library
    if (e.target.matches('.unfavorite-btn')) {
        removePromptFromLibrary(e.target.dataset.id);
    }
    // Remove custom button in my library
    if (e.target.matches('.remove-custom-btn')) {
        removePromptFromLibrary(e.target.dataset.id);
    }
});

const promptFilterBtns = document.querySelectorAll('.prompt-filter-btn');
promptFilterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        promptFilterBtns.forEach(b => {
            b.classList.remove('active', 'bg-[#4A90E2]', 'text-white');
            b.classList.add('bg-white', 'text-gray-700');
        });
        btn.classList.add('active', 'bg-[#4A90E2]', 'text-white');
        btn.classList.remove('bg-white', 'text-gray-700');
        displayPrompts(btn.textContent);
    });
});

const sections = document.querySelectorAll('.page-section');
const navLinks = document.querySelectorAll('.nav-link');

function updateSectionVisibility() {
    const hash = window.location.hash;
    const path = window.location.pathname.split('/').pop().replace('.html', '');
    let targetId;

    if (hash) {
        targetId = hash;
    } else if (path && path !== 'index' && path !== '') {
        targetId = '#' + path;
    } else {
        targetId = '#why';
    }

    const toolHashes = ['#what', '#builder', '#my-library', '#simulator', '#reverse-prompt', '#my-day'];
    const toolsDropdownBtn = document.getElementById('tools-dropdown-btn');

    sections.forEach(section => {
        const isVisible = '#' + section.id === targetId;
        section.classList.toggle('hidden', !isVisible);
        if (isVisible) {
            section.classList.add('fade-in');
            // Initialize content for the visible section
            if (section.id === 'case-studies' && !section.dataset.initialized) {
                initializeCaseStudies();
                section.dataset.initialized = 'true';
            }
            if (section.id === 'simulator' && !section.dataset.initialized) {
                 displaySimulatorCategoryMenu();
                section.dataset.initialized = 'true';
            }
             if (section.id === 'my-day' && !section.dataset.initialized) {
                loadDayEvent(0);
                section.dataset.initialized = 'true';
            }
        }
    });

    navLinks.forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === targetId);
    });

    if (toolsDropdownBtn) {
        toolsDropdownBtn.classList.toggle('active', toolHashes.includes(targetId));
    }
}

window.addEventListener('hashchange', updateSectionVisibility);


// --- Dropdown Menu Logic ---
const toolsDropdown = document.getElementById('tools-dropdown');
if (toolsDropdown) {
    const btn = document.getElementById('tools-dropdown-btn');
    const menu = document.getElementById('tools-dropdown-menu');
    btn.addEventListener('click', () => {
        const isHidden = menu.classList.contains('hidden');
        if (isHidden) {
            menu.classList.remove('hidden', 'opacity-0', 'scale-95');
            menu.classList.add('opacity-100', 'scale-100');
        } else {
            menu.classList.add('opacity-0', 'scale-95');
            setTimeout(() => menu.classList.add('hidden'), 100); // Wait for transition
        }
    });
    // Close dropdown when clicking outside
    window.addEventListener('click', (e) => {
        if (!toolsDropdown.contains(e.target)) {
            menu.classList.add('opacity-0', 'scale-95');
            setTimeout(() => menu.classList.add('hidden'), 100);
        }
    });
     // Close dropdown when an item is clicked
    menu.addEventListener('click', () => {
         menu.classList.add('opacity-0', 'scale-95');
         setTimeout(() => menu.classList.add('hidden'), 100);
    });
}

// --- Chart and Slider Logic ---
function initializeChart() {
    const ctx = document.getElementById('opportunityChart')?.getContext('2d');
    if (ctx) {
        const myChart = new Chart(ctx, {
            type: 'doughnut',
            data: opportunityData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { padding: 20, font: { size: 14 } }
                    },
                    tooltip: {
                        enabled: true,
                        backgroundColor: '#4A4A4A',
                        titleFont: { size: 16, weight: 'bold' },
                        bodyFont: { size: 14 },
                        padding: 12
                    }
                },
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const i = elements[0].index;
                        const category = opportunityData.labels[i];
                        const details = opportunityDetailsData[category];

                        document.getElementById('opportunity-intro').classList.add('hidden');
                        const detailsContainer = document.getElementById('opportunity-details');
                        detailsContainer.classList.remove('hidden');
                        detailsContainer.classList.add('fade-in');

                        document.getElementById('opportunity-title').textContent = details.title;
                        document.getElementById('opportunity-description').textContent = details.description;
                        const examplesList = document.getElementById('opportunity-examples');
                        examplesList.innerHTML = '';
                        details.examples.forEach(ex => {
                            const li = document.createElement('li');
                            li.textContent = ex;
                            examplesList.appendChild(li);
                        });
                    }
                }
            }
        });

        const sliders = {
            repetitive: document.getElementById('repetitiveSlider'),
            research: document.getElementById('researchSlider'),
            reactive: document.getElementById('reactiveSlider'),
            reporting: document.getElementById('reportingSlider')
        };
        const values = {
            repetitive: document.getElementById('repetitiveValue'),
            research: document.getElementById('researchValue'),
            reactive: document.getElementById('reactiveValue'),
            reporting: document.getElementById('reportingValue')
        };
        const totalPercentageEl = document.getElementById('totalPercentage');

        function updateChartAndValues() {
            const newValues = [
                parseInt(sliders.repetitive.value),
                parseInt(sliders.research.value),
                parseInt(sliders.reactive.value),
                parseInt(sliders.reporting.value)
            ];
            myChart.data.datasets[0].data = newValues;
            myChart.update();
            values.repetitive.textContent = `${newValues[0]}%`;
            values.research.textContent = `${newValues[1]}%`;
            values.reactive.textContent = `${newValues[2]}%`;
            values.reporting.textContent = `${newValues[3]}%`;
            const total = newValues.reduce((sum, val) => sum + val, 0);
            totalPercentageEl.textContent = `${total}%`;
            totalPercentageEl.classList.toggle('text-red-500', total !== 100);
            totalPercentageEl.classList.toggle('text-green-600', total === 100);
        }

        for (const key in sliders) {
            if (sliders[key]) sliders[key].addEventListener('input', updateChartAndValues);
        }
        updateChartAndValues();
    }
}

// --- Prompt Builder Logic ---
const generatePromptBtn = document.getElementById('generatePromptBtn');
const saveToLibraryBtn = document.getElementById('saveToLibraryBtn');

if (generatePromptBtn) {
    generatePromptBtn.addEventListener('click', () => {
        const goal = document.getElementById('promptGoal').value;
        const audience = document.getElementById('promptAudience').value;
        const tone = document.getElementById('promptTone').value;
        const format = document.getElementById('promptFormat').value;
        const context = document.getElementById('promptContext').value.trim();

        if (!context) {
            console.warn('Please provide some context for your prompt.');
            return;
        }

        let promptText = `Act as an expert GBS Manager. Your task is to ${goal.toLowerCase()}. The audience is ${audience.toLowerCase()}. The tone of the response should be ${tone.toLowerCase()} and the output must be in the format of ${format.toLowerCase()}.\n\nBased on these requirements, please process the following context:\n\n---\n${context}\n---`;

        document.getElementById('generatedPromptOutput').textContent = promptText;
        document.getElementById('generatedPromptContainer').classList.remove('hidden');
    });
}

if (saveToLibraryBtn) {
    saveToLibraryBtn.addEventListener('click', () => {
        const content = document.getElementById('generatedPromptOutput').textContent;
        const title = document.getElementById('promptGoal').value; // Use goal as title

        if (content) {
            const newPrompt = {
                type: 'custom',
                title: `Custom: ${title}`,
                content: content,
                createdAt: new Date().toISOString()
            };
            addPromptToLibrary(newPrompt);
            saveToLibraryBtn.textContent = 'Saved!';
            setTimeout(() => { saveToLibraryBtn.textContent = 'Save'; }, 2000);
        }
    });
}

const copyPromptBtn = document.getElementById('copyPromptBtn');
if(copyPromptBtn) {
    copyPromptBtn.addEventListener('click', () => {
        const textToCopy = document.getElementById('generatedPromptOutput').textContent;
        navigator.clipboard.writeText(textToCopy).then(() => {
            copyPromptBtn.textContent = 'Copied!';
            setTimeout(() => { copyPromptBtn.textContent = 'Copy'; }, 2000);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
        });
    });
}

// --- Reverse Prompt Logic ---
const generateReversePromptBtn = document.getElementById('generateReversePromptBtn');
if (generateReversePromptBtn) {
    generateReversePromptBtn.addEventListener('click', async () => {
        const input_text = document.getElementById('reversePromptInput').value;
        const spinner = document.getElementById('reverse-prompt-spinner');
        const outputContainer = document.getElementById('reverse-prompt-output-container');
        const errorContainer = document.getElementById('reverse-prompt-error');

        if (!input_text.trim()) {
            errorContainer.textContent = 'Please paste some text to analyze.';
            errorContainer.classList.remove('hidden');
            return;
        }

        spinner.classList.remove('hidden');
        outputContainer.classList.add('hidden');
        errorContainer.classList.add('hidden');

        const meta_prompt = `You are an expert in prompt engineering. Analyze the following text and generate a high-quality, effective prompt that could have been used to create it. Break down your reasoning, explaining why the prompt you created is effective. The prompt should be structured to include: 1. A clear persona (e.g., 'Act as a...'). 2. A specific task or goal. 3. Instructions on tone and format if they can be inferred from the text. Return your response as a JSON object with two keys: "generated_prompt" and "explanation".\n\nText to analyze:\n---\n${input_text}\n---`;

        try {
            const apiKey = ""; // TODO: Add your Google AI API key here
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
            const payload = { contents: [{ role: "user", parts: [{ text: meta_prompt }] }] };

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }

            const result = await response.json();

            if (result.candidates && result.candidates[0].content.parts[0].text) {
                const responseText = result.candidates[0].content.parts[0].text;
                const cleanedText = responseText.replace(/```json|```/g, '').trim();
                const parsedJson = JSON.parse(cleanedText);

                document.getElementById('reverse-prompt-output').textContent = parsedJson.generated_prompt;
                document.getElementById('reverse-prompt-explanation').textContent = parsedJson.explanation;
                outputContainer.classList.remove('hidden');
            } else {
                throw new Error("Invalid response structure from API.");
            }
        } catch (error) {
            console.error("Reverse prompt generation failed:", error);
            errorContainer.textContent = "Sorry, something went wrong while generating the prompt. Please try again.";
            errorContainer.classList.remove('hidden');
        } finally {
            spinner.classList.add('hidden');
        }
    });
}

// --- Scenario Simulator Logic ---
const simulatorContainer = document.getElementById('simulator-container');

function displaySimulatorCategoryMenu() {
    if (!simulatorContainer) return;
    let categoryHtml = Object.keys(scenarios).map(category => `
        <div class="category-option p-6 rounded-lg cursor-pointer text-center" data-category="${category}">
            <h3 class="font-bold text-xl text-[#4A90E2]">${category}</h3>
        </div>
    `).join('');

    simulatorContainer.innerHTML = `
        <h3 class="text-2xl font-bold text-center mb-6">Choose a Scenario Category</h3>
        <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">${categoryHtml}</div>
    `;
}

function loadScenario() {
    if (!simulatorContainer || !currentScenarioCategory) return;

    const scenario = scenarios[currentScenarioCategory][currentScenarioIndex];

    if (!scenario) {
        simulatorContainer.innerHTML = `
            <p class="text-center text-gray-600 text-xl">You've completed all scenarios in this category!</p>
            <div class="mt-6 text-center">
                <button id="backToCategoriesBtn" class="bg-gray-600 text-white font-bold py-2 px-6 rounded-full hover:bg-gray-700 transition-colors">Back to Categories</button>
            </div>
        `;
        return;
    }

    let optionsHtml = scenario.prompts.map((p, i) => `
        <div class="scenario-option p-4 rounded-lg cursor-pointer" data-index="${i}">
            <p class="font-semibold">${p.text}</p>
            <div class="feedback mt-2 text-sm hidden"></div>
        </div>
    `).join('');

    simulatorContainer.innerHTML = `
         <div class="flex justify-between items-center mb-4">
            <h3 class="text-2xl font-bold text-[#4A90E2]">${scenario.title}</h3>
            <button id="backToCategoriesBtn" class="text-sm text-gray-500 hover:text-gray-800">&larr; Back to Categories</button>
        </div>
        <p class="text-gray-600 mb-6">${scenario.problem}</p>
        <div class="space-y-4">${optionsHtml}</div>
        <div class="mt-6 text-right">
            <button id="nextScenarioBtn" class="hidden bg-[#4A90E2] text-white font-bold py-2 px-6 rounded-full hover:bg-blue-600 transition-colors">Next Scenario</button>
        </div>
    `;
}

if (simulatorContainer) {
    simulatorContainer.addEventListener('click', e => {
        // Category selection
        const categoryEl = e.target.closest('.category-option');
        if (categoryEl) {
            currentScenarioCategory = categoryEl.dataset.category;
            currentScenarioIndex = 0;
            loadScenario();
            return;
        }

        // Go back to category menu
        if (e.target.id === 'backToCategoriesBtn') {
            currentScenarioCategory = null;
            displaySimulatorCategoryMenu();
            return;
        }

        // Prompt option selection
        const optionEl = e.target.closest('.scenario-option');
        if (optionEl && !optionEl.classList.contains('selected')) {
            const selectedIndex = parseInt(optionEl.dataset.index);
            const scenario = scenarios[currentScenarioCategory][currentScenarioIndex];
            const selectedPrompt = scenario.prompts[selectedIndex];

            // Disable further clicks
            const allOptions = simulatorContainer.querySelectorAll('.scenario-option');
            allOptions.forEach(opt => opt.classList.add('selected')); // Mark all as selected to prevent re-clicks

            // Show feedback
            const feedbackEl = optionEl.querySelector('.feedback');
            feedbackEl.textContent = selectedPrompt.feedback;
            feedbackEl.classList.remove('hidden');

            if (selectedPrompt.isCorrect) {
                optionEl.classList.add('correct');
            } else {
                optionEl.classList.add('incorrect');
                // Highlight the correct one
                const correctIndex = scenario.prompts.findIndex(p => p.isCorrect);
                simulatorContainer.querySelector(`.scenario-option[data-index='${correctIndex}']`).classList.add('correct');
            }

            document.getElementById('nextScenarioBtn').classList.remove('hidden');
        }

        // Next scenario button
        if (e.target.id === 'nextScenarioBtn') {
            currentScenarioIndex++;
            loadScenario();
        }
    });
}

// --- Case Study Logic ---
const caseStudyContainer = document.getElementById('case-study-container');

function initializeCaseStudies() {
    if (!caseStudyContainer) return;
    const caseStudyTabs = document.createElement('nav');
    caseStudyTabs.id = 'case-study-tabs';
    caseStudyTabs.className = '-mb-px flex space-x-8';
    caseStudyTabs.setAttribute('aria-label', 'Tabs');

    const caseStudyContent = document.createElement('div');
    caseStudyContent.id = 'case-study-content';
    caseStudyContent.className = 'mt-8';

    caseStudyContainer.innerHTML = '';
    caseStudyContainer.appendChild(caseStudyTabs);
    caseStudyContainer.appendChild(caseStudyContent);

    const categories = Object.keys(caseStudies);

    caseStudyTabs.innerHTML = categories.map((category, index) => `
        <button class="case-study-tab ${index === 0 ? 'active' : ''}" data-category="${category}">${category}</button>
    `).join('');

    loadCaseStudy(categories[0]);

    caseStudyTabs.addEventListener('click', e => {
        if (e.target.matches('.case-study-tab')) {
            const category = e.target.dataset.category;
            document.querySelectorAll('.case-study-tab').forEach(tab => tab.classList.remove('active'));
            e.target.classList.add('active');
            loadCaseStudy(category);
        }
    });
}

function loadCaseStudy(category) {
    const caseStudyContent = document.getElementById('case-study-content');
    if (!caseStudyContent) return;
    const studySteps = caseStudies[category];
    let stepsHtml = studySteps.map((step, index) => `
        <div class="timeline-step bg-white p-6 rounded-lg shadow-sm">
            <h4 class="font-bold text-lg text-[#4A90E2] mb-2">Step ${index + 1}: ${step.title}</h4>
            <p class="text-sm text-gray-500 italic mb-4">${step.description}</p>
            <div class="code-block text-xs">${step.prompt}</div>
        </div>
        ${index < studySteps.length - 1 ? '<div class="timeline-connector"></div>' : ''}
    `).join('');

    caseStudyContent.innerHTML = `<div class="timeline-container">${stepsHtml}</div>`;
}

// --- "My Day with AI" Logic ---
const myDayContainer = document.getElementById('my-day-container');

function loadDayEvent(index) {
    if (!myDayContainer) return;

    if (index >= myDayEvents.length) {
        myDayContainer.innerHTML = `
            <p class="text-center text-gray-600 text-2xl font-bold">You've completed your day!</p>
            <p class="text-center text-gray-500 mt-4">You've seen how a few smart prompts can save hours of work. You're ready to start integrating AI into your real workflow.</p>
            <div class="mt-6 text-center">
                <button id="restartDayBtn" class="bg-gray-600 text-white font-bold py-2 px-6 rounded-full hover:bg-gray-700 transition-colors">Start Day Over</button>
            </div>
        `;
        return;
    }

    const event = myDayEvents[index];
    let optionsHtml = event.options.map((opt, i) => `
        <div class="scenario-option p-4 rounded-lg cursor-pointer" data-index="${i}">
            <p class="font-semibold">${opt.text}</p>
            <div class="feedback mt-2 text-sm hidden p-4 bg-green-100 text-green-800 rounded-lg"></div>
        </div>
    `).join('');

    myDayContainer.innerHTML = `
         <div class="mb-4">
            <span class="inline-block bg-gray-200 rounded-full px-3 py-1 text-sm font-semibold text-gray-700">${event.time}</span>
         </div>
        <p class="text-gray-600 mb-6 text-lg">${event.task}</p>
        <div class="space-y-4">${optionsHtml}</div>
        <div class="mt-6 text-right">
            <button id="nextDayEventBtn" class="hidden bg-[#4A90E2] text-white font-bold py-2 px-6 rounded-full hover:bg-blue-600 transition-colors">Continue Day &rarr;</button>
        </div>
    `;
}

if(myDayContainer) {
    myDayContainer.addEventListener('click', e => {
        const optionEl = e.target.closest('.scenario-option');
        if (optionEl && !optionEl.classList.contains('selected')) {
            const selectedIndex = parseInt(optionEl.dataset.index);
            const event = myDayEvents[currentDayEventIndex];
            const selectedOption = event.options[selectedIndex];

            const allOptions = myDayContainer.querySelectorAll('.scenario-option');
            allOptions.forEach(opt => opt.classList.add('selected'));

            const feedbackEl = optionEl.querySelector('.feedback');
            feedbackEl.textContent = selectedOption.outcome;
            feedbackEl.classList.remove('hidden');
            optionEl.classList.add('correct');

            document.getElementById('nextDayEventBtn').classList.remove('hidden');
        }

        if (e.target.id === 'nextDayEventBtn') {
            currentDayEventIndex++;
            loadDayEvent(currentDayEventIndex);
        }

        if (e.target.id === 'restartDayBtn') {
            currentDayEventIndex = 0;
            loadDayEvent(currentDayEventIndex);
        }
    });
}

// --- Animated Subtitle Logic ---
const animatedSubtitleEl = document.getElementById('animated-subtitle');
if (animatedSubtitleEl) {
    const subtitles = [
        "Automate Tedious Reports...",
        "Summarize Long Meetings...",
        "Draft Professional Emails..."
    ];
    let subtitleIndex = 0;

    function cycleSubtitles() {
        // Fade out the current text
        animatedSubtitleEl.classList.remove('subtitle-animate-in');
        animatedSubtitleEl.classList.add('subtitle-animate-out');

        // After the fade-out is done, change the text and fade it in
        setTimeout(() => {
            subtitleIndex = (subtitleIndex + 1) % subtitles.length;
            animatedSubtitleEl.textContent = subtitles[subtitleIndex];
            animatedSubtitleEl.classList.remove('subtitle-animate-out');
            animatedSubtitleEl.classList.add('subtitle-animate-in');
        }, 500); // Match the animation duration
    }

    // Initial setup
    animatedSubtitleEl.textContent = subtitles[0];
    animatedSubtitleEl.classList.add('subtitle-animate-in');

    // Start the cycle
    setInterval(cycleSubtitles, 4000); // Change text every 4 seconds
}


// --- INITIAL LOAD ---
document.addEventListener('DOMContentLoaded', () => {
    loadDataAndInit();
});
