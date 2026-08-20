// ===== TRADEVAULT GLOBAL JAVASCRIPT =====

// Dark Mode Toggle
function initDarkMode() {
  const savedTheme = localStorage.getItem("tradevault_theme");
  
  if (savedTheme === "dark") {
    document.documentElement.classList.add("dark");
    document.body.classList.add("dark");
  } else if (savedTheme === "light") {
    document.documentElement.classList.remove("dark");
    document.body.classList.remove("dark");
  } else {
    // Default: check system preference
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      document.documentElement.classList.add("dark");
      document.body.classList.add("dark");
    }
  }
}

function toggleDarkMode() {
  const isDark = document.documentElement.classList.contains("dark");
  
  if (isDark) {
    document.documentElement.classList.remove("dark");
    document.body.classList.remove("dark");
    localStorage.setItem("tradevault_theme", "light");
  } else {
    document.documentElement.classList.add("dark");
    document.body.classList.add("dark");
    localStorage.setItem("tradevault_theme", "dark");
  }
}

// Add gradient background animation
function addGradientAnimation() {
  const elements = document.querySelectorAll(".gradient-animated");
  
  elements.forEach((el) => {
    el.style.background = "linear-gradient(-45deg, #1c69e3, #783ff5, #448bff, #00b9a2)";
    el.style.backgroundSize = "400% 400%";
    el.style.animation = "gradientShift 10s ease infinite";
  });
}

// Add hover effects
function addHoverEffects() {
  const cards = document.querySelectorAll(".card");
  
  cards.forEach((card) => {
    card.addEventListener("mouseenter", () => {
      card.style.transform = "translateY(-4px)";
      card.style.boxShadow = "0 10px 25px rgba(0,0,0,0.15)";
    });
    
    card.addEventListener("mouseleave", () => {
      card.style.transform = "translateY(0)";
      card.style.boxShadow = "none";
    });
  });
}

// Add counter animation
function animateCounters() {
  const counters = document.querySelectorAll(".counter");
  
  counters.forEach((counter) => {
    const target = parseInt(counter.textContent || "0", 10);
    const duration = 2000;
    const step = Math.max(1, Math.floor(target / 60));
    let current = 0;
    
    const updateCounter = () => {
      current += step;
      if (current >= target) {
        counter.textContent = target.toLocaleString();
      } else {
        counter.textContent = current.toLocaleString();
        requestAnimationFrame(updateCounter);
      }
    };
    
    updateCounter();
  });
}

// Mobile menu toggle
function toggleMobileMenu() {
  const menu = document.querySelector(".mobile-menu");
  if (menu) {
    menu.classList.toggle("open");
  }
}

// Initialize all
document.addEventListener("DOMContentLoaded", () => {
  initDarkMode();
  addGradientAnimation();
  addHoverEffects();
  animateCounters();
});

// Export for use in React components
window.toggleDarkMode = toggleDarkMode;
window.toggleMobileMenu = toggleMobileMenu;