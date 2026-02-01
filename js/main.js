/**
 * Stuff Company - Main JavaScript
 * Handles cycling tagline animation and other interactive features
 */

(function() {
    'use strict';

    // Tagline words to cycle through
    const taglineWords = [
        'video',
        'websites',
        'design',
        'data',
        'print',
        'fabrication',
        'lasers',
        'wood',
        'stuff'
    ];

    let currentIndex = 0;
    let taglineElement = null;

    /**
     * Initialize the cycling tagline
     */
    function initTagline() {
        taglineElement = document.querySelector('.tagline-word');

        if (!taglineElement) {
            return;
        }

        // Start cycling every 2 seconds
        setInterval(cycleTagline, 2000);
    }

    /**
     * Cycle to the next tagline word with fade effect
     */
    function cycleTagline() {
        if (!taglineElement) return;

        // Fade out
        taglineElement.style.opacity = '0';

        setTimeout(function() {
            // Update text
            currentIndex = (currentIndex + 1) % taglineWords.length;
            taglineElement.textContent = taglineWords[currentIndex];

            // Fade in
            taglineElement.style.opacity = '1';
        }, 300);
    }

    /**
     * Lazy load YouTube videos when they come into view
     */
    function initLazyVideos() {
        const videoContainers = document.querySelectorAll('.video-container[data-video-id]');

        if ('IntersectionObserver' in window) {
            const videoObserver = new IntersectionObserver(function(entries, observer) {
                entries.forEach(function(entry) {
                    if (entry.isIntersecting) {
                        const container = entry.target;
                        const videoId = container.dataset.videoId;

                        if (videoId) {
                            const iframe = document.createElement('iframe');
                            iframe.src = 'https://www.youtube.com/embed/' + videoId;
                            iframe.title = 'YouTube video player';
                            iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
                            iframe.allowFullscreen = true;

                            container.appendChild(iframe);
                            observer.unobserve(container);
                        }
                    }
                });
            }, {
                rootMargin: '100px'
            });

            videoContainers.forEach(function(container) {
                videoObserver.observe(container);
            });
        } else {
            // Fallback for browsers without IntersectionObserver
            videoContainers.forEach(function(container) {
                const videoId = container.dataset.videoId;
                if (videoId) {
                    const iframe = document.createElement('iframe');
                    iframe.src = 'https://www.youtube.com/embed/' + videoId;
                    iframe.title = 'YouTube video player';
                    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
                    iframe.allowFullscreen = true;
                    container.appendChild(iframe);
                }
            });
        }
    }

    /**
     * Handle contact form submission
     */
    function initContactForm() {
        const form = document.querySelector('.contact-form');

        if (!form) return;

        form.addEventListener('submit', function(e) {
            // Form uses mailto: so we don't prevent default
            // Just do basic validation
            const name = form.querySelector('[name="name"]');
            const email = form.querySelector('[name="email"]');
            const message = form.querySelector('[name="message"]');

            if (name && !name.value.trim()) {
                e.preventDefault();
                alert('Please enter your name.');
                name.focus();
                return;
            }

            if (email && !email.value.trim()) {
                e.preventDefault();
                alert('Please enter your email.');
                email.focus();
                return;
            }

            if (message && !message.value.trim()) {
                e.preventDefault();
                alert('Please enter a message.');
                message.focus();
                return;
            }
        });
    }

    /**
     * Smooth scroll for anchor links
     */
    function initSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
            anchor.addEventListener('click', function(e) {
                const targetId = this.getAttribute('href');
                if (targetId === '#') return;

                const target = document.querySelector(targetId);
                if (target) {
                    e.preventDefault();
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
    }

    /**
     * Initialize all features when DOM is ready
     */
    function init() {
        initTagline();
        initLazyVideos();
        initContactForm();
        initSmoothScroll();
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
