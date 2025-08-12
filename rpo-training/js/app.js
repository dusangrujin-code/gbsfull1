document.addEventListener('DOMContentLoaded', () => {
    const mainPage = document.getElementById('main-page');
    const sessionContainer = document.getElementById('session-container');
    const headerTitle = document.getElementById('header-title');
    const copyrightYear = document.getElementById('copyright-year');

    const pageTitles = {
        'main-page': 'RPO AI Acceleration Program',
        'session-1-1-page': 'Session 1.1: Prompt Engineering 101',
        'session-1-2-page': 'Session 1.2: AI-Powered Email Lab',
        'session-1-3-page': 'Session 1.3: Success Spotlight & Clinic',
        'session-2-1-page': 'Session 2.1: AI for Advanced Sourcing',
        'session-2-2-page': 'Session 2.2: The Randstad AI Toolkit',
        'session-2-3-page': 'Session 2.3: Responsible AI & Showcase',
        'session-3-1-page': 'Session 3.1: Data Insights in Sheets',
        'session-3-2-page': 'Session 3.2: Building a Knowledge Base',
        'session-4-1-page': 'Session 4.1: Intro to Automation',
        'session-5-1-page': 'Session 5.1: Becoming an AI Champion',
        'session-5-2-page': 'Session 5.2: Capstone Project Showcase',
        'session-6-1-page': 'Session 6.1: Developing an AI Roadmap',
        'session-7-1-page': 'Session 7.1: The ROI of AI in Recruiting'
    };

    function navigateTo(pageId) {
        if (pageId !== 'main-page') {
            sessionStorage.setItem('scrollPosition', window.scrollY);
        }

        // Hide all pages by default
        mainPage.classList.remove('active');
        sessionContainer.classList.remove('active');

        if (pageId === 'main-page') {
            mainPage.classList.add('active');
            sessionContainer.innerHTML = '';
            const savedPosition = sessionStorage.getItem('scrollPosition');
            if (savedPosition) {
                window.scrollTo(0, parseInt(savedPosition, 10));
                sessionStorage.removeItem('scrollPosition');
            }
        } else {
            const sessionPath = pageId.replace('session-', '').replace('-page', '');
            const filePath = `sessions/${sessionPath}.html`;

            fetch(filePath)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.text();
                })
                .then(html => {
                    sessionContainer.innerHTML = html;
                    sessionContainer.classList.add('active');
                    // Re-attach event listeners for any new buttons in the loaded content if necessary
                    const backButton = sessionContainer.querySelector('button');
                    if(backButton) {
                        backButton.onclick = () => navigateTo('main-page');
                    }
                })
                .catch(error => {
                    console.error('Error fetching session content:', error);
                    sessionContainer.innerHTML = '<p class="text-red-500">Error loading content. Please try again later.</p>';
                    sessionContainer.classList.add('active');
                });
        }

        headerTitle.textContent = pageTitles[pageId] || pageTitles['main-page'];
        if (pageId !== 'main-page') {
            window.scrollTo(0, 0);
        }
    }

    // Make navigateTo globally accessible
    window.navigateTo = navigateTo;

    // Set copyright year
    if (copyrightYear) {
        copyrightYear.textContent = new Date().getFullYear();
    }

    // Set up initial page view
    navigateTo('main-page');
});
