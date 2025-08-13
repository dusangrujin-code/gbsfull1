// --- App State ---
let focusPoints = [];
let progressState = {};
let currentDeck = [];
let currentIndex = 0;
let categoryCounts = {};

// --- DOM Elements ---
const cardOfTheDayContainer = document.getElementById('card-of-the-day-container');
const cardContainer = document.getElementById('card-container');
const categoryFiltersContainer = document.getElementById('category-filters');
const cardNavigation = document.getElementById('card-navigation');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const cardCounter = document.getElementById('card-counter');

// --- State Management ---
function initializeData(focusPointsData) {
    focusPoints = focusPointsData.map((point, index) => ({ ...point, id: `fp-${index}` }));

    categoryCounts = focusPoints.reduce((acc, point) => {
        acc[point.category] = (acc[point.category] || 0) + 1;
        return acc;
    }, {});
    categoryCounts['All'] = focusPoints.length;

    const savedProgress = localStorage.getItem('sourcingFocusProgress');
    if (savedProgress) {
        progressState = JSON.parse(savedProgress);
    } else {
        focusPoints.forEach(point => {
            progressState[point.id] = Array(point.actions.length).fill(false);
        });
    }
}

function saveProgress() {
    localStorage.setItem('sourcingFocusProgress', JSON.stringify(progressState));
}

// --- Card Creation & UI Updates ---
function createCard(point) {
    const pointId = point.id;
    const cardElement = document.createElement('div');
    cardElement.className = 'card w-full bg-white p-6 rounded-xl shadow-lg border border-gray-200';
    cardElement.dataset.pointId = pointId;

    const actionsHtml = point.actions.map((action, index) => {
        const isChecked = progressState[pointId] ? progressState[pointId][index] : false;
        return `
            <li class="action-item rounded-lg ${isChecked ? 'completed' : ''}">
                <label for="action-${pointId}-${index}" class="flex items-center p-3 cursor-pointer">
                    <input id="action-${pointId}-${index}" type="checkbox"
                           class="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                           ${isChecked ? 'checked' : ''}
                           onchange="handleCheckboxChange(this, '${pointId}', ${index})">
                    <span class="ml-3 text-gray-700">${action}</span>
                </label>
            </li>
        `;
    }).join('');

    cardElement.innerHTML = `
        <div>
            <div class="flex justify-between items-center mb-3">
                <span class="text-sm font-semibold text-indigo-600">${point.category}</span>
                <span class="progress-text text-sm font-medium text-gray-500"></span>
            </div>
            <div class="progress-bar w-full bg-gray-200 rounded-full h-2.5 mb-4">
                <div class="progress-bar-inner bg-green-500 h-2.5 rounded-full" style="width: 0%"></div>
            </div>
            <h3 class="text-lg md:text-xl font-bold text-gray-800">${point.title}</h3>
            <p class="text-gray-500 italic my-2 text-sm md:text-base">"${point.quote}"</p>
        </div>
        <div>
            <p class="font-semibold mb-2 text-gray-700">Action Items:</p>
            <ul class="space-y-2">${actionsHtml}</ul>
            <div class="completion-banner hidden mt-4 p-4 bg-green-100 border-l-4 border-green-500 rounded-r-lg">
                <div class="flex">
                    <div class="py-1">
                        <svg class="h-6 w-6 text-green-500 mr-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div>
                        <p class="font-bold text-green-800">All Actions Completed!</p>
                        <p class="text-sm text-green-700">✨ Fantastic work! You've mastered this focus. ✨</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    return cardElement;
}

function updateProgressUI(pointId) {
    const cards = document.querySelectorAll(`.card[data-point-id="${pointId}"]`);
    if (cards.length === 0) return;

    const progress = progressState[pointId] || [];
    const completedCount = progress.filter(Boolean).length;
    const totalCount = progress.length;
    const percentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

    cards.forEach(card => {
        card.querySelector('.progress-bar-inner').style.width = `${percentage}%`;
        card.querySelector('.progress-text').textContent = `${completedCount} / ${totalCount} Completed`;

        const completionBanner = card.querySelector('.completion-banner');
        if (percentage === 100) {
            completionBanner.classList.remove('hidden');
        } else {
            completionBanner.classList.add('hidden');
        }
    });
}

window.handleCheckboxChange = (checkbox, pointId, actionIndex) => {
    if (!progressState[pointId]) {
         progressState[pointId] = Array(checkbox.closest('ul').children.length).fill(false);
    }
    progressState[pointId][actionIndex] = checkbox.checked;

    const cardElements = document.querySelectorAll(`.card[data-point-id="${pointId}"] .action-item`);
    cardElements.forEach(item => {
        const label = item.querySelector('label');
        if (label && label.getAttribute('for') === `action-${pointId}-${actionIndex}`) {
            item.classList.toggle('completed', checkbox.checked);
        }
    });

    updateProgressUI(pointId);
    saveProgress();
};

// --- Card of the Day Logic ---
function renderCardOfTheDay() {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 0);
    const diff = now - startOfYear;
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);

    const cardIndex = dayOfYear % focusPoints.length;
    const dailyPoint = focusPoints[cardIndex];

    if (dailyPoint) {
        const card = createCard(dailyPoint);
        cardOfTheDayContainer.innerHTML = '';
        cardOfTheDayContainer.appendChild(card);
        updateProgressUI(dailyPoint.id);
    }
}

// --- Deck Management for Library ---
function loadDeck(category = 'All') {
    currentDeck = (category === 'All') ? [...focusPoints] : focusPoints.filter(p => p.category === category);
    currentIndex = 0;
    showCardInLibrary(currentIndex);
    updateActiveFilterButton(category);
}

function showCardInLibrary(index) {
    cardContainer.innerHTML = '';

    if (!currentDeck || currentDeck.length === 0) {
        cardContainer.innerHTML = `<div class="text-center text-gray-500 p-8 bg-white rounded-xl shadow-md"><h3>No items in this category.</h3></div>`;
        cardNavigation.style.display = 'none';
        return;
    }

    cardNavigation.style.display = 'flex';

    const point = currentDeck[index];
    const card = createCard(point);
    cardContainer.appendChild(card);
    updateProgressUI(point.id);

    cardCounter.textContent = `${index + 1} / ${currentDeck.length}`;
    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === currentDeck.length - 1;
}

// --- Filter Buttons ---
function populateFilters() {
    const categories = ['All', ...new Set(focusPoints.map(p => p.category))];
    categories.forEach(category => {
        const button = document.createElement('button');
        const count = categoryCounts[category] || 0;
        button.textContent = `${category} (${count})`;
        button.className = 'filter-button px-3 py-1.5 text-sm font-medium rounded-full bg-white text-gray-700 shadow-sm hover:bg-gray-200 transition-colors';
        button.dataset.category = category;
        button.addEventListener('click', () => loadDeck(category));
        categoryFiltersContainer.appendChild(button);
    });
}

function updateActiveFilterButton(activeCategory) {
    document.querySelectorAll('.filter-button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.category === activeCategory);
    });
}

// --- Initial Load & Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    fetch('../../data/daily-focus.json')
        .then(response => response.json())
        .then(data => {
            initializeData(data);
            renderCardOfTheDay();
            populateFilters();
            loadDeck('All');
        })
        .catch(error => console.error('Error fetching focus points:', error));

    prevBtn.addEventListener('click', () => {
        if (currentIndex > 0) {
            currentIndex--;
            showCardInLibrary(currentIndex);
        }
    });

    nextBtn.addEventListener('click', () => {
        if (currentIndex < currentDeck.length - 1) {
            currentIndex++;
            showCardInLibrary(currentIndex);
        }
    });
});
