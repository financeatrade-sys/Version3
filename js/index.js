// =================================================================
// js/index.js - Logic for the Homepage Slider (LTR Compatible)
// =================================================================

function setupHeroSlider() {
    const sliderWrapper = document.querySelector('.slider-wrapper');
    const slides = document.querySelectorAll('.slide');
    const dots = document.querySelectorAll('.control-dot');
    let currentSlide = 0;
    let slideInterval;
    const intervalTime = 6000; // 6 seconds between each slide

    if (slides.length === 0 || !sliderWrapper) return;

    /**
     * Shows the specified slide with animation.
     * @param {number} index - The index of the slide (0-based).
     */
    function showSlide(index) {
        // Ensure index is within range (loops back to 0 if max is reached)
        index = (index + slides.length) % slides.length;
        
        // Calculate the offset percentage. 
        // Negative value (-100%, -200%) moves the wrapper left in LTR.
        const offset = -index * (100 / slides.length); 

        // Apply the transformation to move the wrapper
        sliderWrapper.style.transform = `translateX(${offset}%)`;
        
        // Update dots
        dots.forEach(dot => dot.classList.remove('active'));
        dots[index].classList.add('active');
        
        currentSlide = index;
    }

    /**
     * Advances to the next slide.
     */
    function nextSlide() {
        showSlide(currentSlide + 1);
    }

    /**
     * Starts the automatic slider cycle.
     */
    function startSlider() {
        clearInterval(slideInterval); 
        slideInterval = setInterval(nextSlide, intervalTime);
    }
    
    /**
     * Handles control dot clicks.
     */
    dots.forEach(dot => {
        dot.addEventListener('click', (e) => {
            const targetIndex = parseInt(e.target.dataset.slideTarget) - 1;
            showSlide(targetIndex);
            // Restart timer after user interaction
            startSlider(); 
        });
    });

    // Start on the first slide and begin the timer
    showSlide(currentSlide);
    startSlider();
}


// Run slider logic after DOM content is loaded
document.addEventListener('DOMContentLoaded', () => {
    const currentPath = window.location.pathname.split('/').pop();
    if (currentPath === 'index.html' || currentPath === '') {
        setupHeroSlider();
    }
});