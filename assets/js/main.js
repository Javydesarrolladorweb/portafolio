/* ===================================
   PORTAFOLIO MINIMALISTA - JAVIER SUÁREZ
   JavaScript para animaciones e interacciones
   =================================== */

// ===== DARK MODE TOGGLE =====
const initDarkMode = () => {
    const themeToggle = document.getElementById('theme-toggle');
    const html = document.documentElement;
    const sunIcon = document.getElementById('sun-icon');
    const moonIcon = document.getElementById('moon-icon');

    // Cargar tema guardado
    const currentTheme = localStorage.getItem('theme') || 'light';
    if (currentTheme === 'dark') {
        html.classList.add('dark');
        if (sunIcon) sunIcon.style.display = 'none';
        if (moonIcon) moonIcon.style.display = 'block';
    }

    // Toggle theme
    themeToggle?.addEventListener('click', () => {
        html.classList.toggle('dark');
        const isDark = html.classList.contains('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');

        if (sunIcon && moonIcon) {
            sunIcon.style.display = isDark ? 'none' : 'block';
            moonIcon.style.display = isDark ? 'block' : 'none';
        }
    });
};

// ===== NAVBAR SCROLL EFFECT =====
const initNavbarScroll = () => {
    const navbar = document.getElementById('navbar');
    const navLinks = document.querySelectorAll('.nav-link');

    window.addEventListener('scroll', () => {
        // Add scrolled class
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }

        // Update active nav link
        let current = '';
        const sections = document.querySelectorAll('section[id]');

        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            if (window.scrollY >= sectionTop - 200) {
                current = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href').slice(1) === current) {
                link.classList.add('active');
            }
        });
    });
};

// ===== SCROLL PROGRESS BAR =====
const initScrollProgress = () => {
    const scrollProgress = document.getElementById('scroll-progress');

    window.addEventListener('scroll', () => {
        const winScroll = document.documentElement.scrollTop;
        const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = (winScroll / height) * 100;
        if (scrollProgress) {
            scrollProgress.style.width = scrolled + '%';
        }
    });
};

// ===== SMOOTH SCROLL =====
const initSmoothScroll = () => {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href === '#') return;

            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                const navbarHeight = document.getElementById('navbar').offsetHeight;
                const targetPosition = target.offsetTop - navbarHeight;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });

                // Close mobile menu if open
                const mobileMenu = document.getElementById('mobile-menu');
                if (mobileMenu && mobileMenu.classList.contains('show')) {
                    mobileMenu.classList.remove('show');
                    document.body.classList.remove('overflow-hidden');
                }
            }
        });
    });
};

// ===== INTERSECTION OBSERVER - REVEAL ANIMATIONS =====
const initRevealAnimations = () => {
    const revealElements = document.querySelectorAll('.reveal-element');

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.classList.add('revealed');
                }, index * 100); // Stagger effect
                revealObserver.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    revealElements.forEach(el => {
        revealObserver.observe(el);
    });
};

// ===== ANIMATED COUNTERS =====
const initCounters = () => {
    const animateCounter = (element, target, duration = 2000) => {
        let start = 0;
        const increment = target / (duration / 16);
        const hasPercent = element.textContent.includes('%');
        const hasPlus = element.textContent.includes('+');

        const timer = setInterval(() => {
            start += increment;
            if (start >= target) {
                element.textContent = target + (hasPercent ? '%' : hasPlus ? '+' : '');
                clearInterval(timer);
            } else {
                element.textContent = Math.floor(start) + (hasPercent ? '%' : hasPlus ? '+' : '');
            }
        }, 16);
    };

    const counterObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const counter = entry.target;
                const target = parseInt(counter.dataset.target);
                animateCounter(counter, target);
                counterObserver.unobserve(counter);
            }
        });
    }, { threshold: 0.5 });

    document.querySelectorAll('[data-counter]').forEach(counter => {
        counterObserver.observe(counter);
    });
};

// ===== MOBILE MENU =====
const initMobileMenu = () => {
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');

    const toggleMenu = () => {
        mobileMenu?.classList.toggle('show');
    };

    mobileMenuButton?.addEventListener('click', toggleMenu);

    // Close menu when clicking on a link
    const mobileLinks = mobileMenu?.querySelectorAll('.nav-link');
    mobileLinks?.forEach(link => {
        link.addEventListener('click', () => {
            mobileMenu.classList.remove('show');
        });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (mobileMenu?.classList.contains('show') && 
            !mobileMenu.contains(e.target) && 
            !mobileMenuButton.contains(e.target)) {
            mobileMenu.classList.remove('show');
        }
    });
};

// ===== FORM VALIDATION =====
const initFormValidation = () => {
    const contactForm = document.getElementById('contact-form');

    contactForm?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('name').value.trim();
        const email = document.getElementById('email').value.trim();
        const message = document.getElementById('message').value.trim();

        // Validación básica
        if (!name || !email || !message) {
            showNotification('Por favor completa todos los campos', 'error');
            return;
        }

        // Validar email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showNotification('Por favor ingresa un email válido', 'error');
            return;
        }

        // Simular envío (aquí integrarías con Formspree, EmailJS, etc.)
        showNotification('¡Mensaje enviado! Te contactaré pronto.', 'success');
        contactForm.reset();
    });
};

// ===== NOTIFICATION SYSTEM =====
const showNotification = (message, type = 'info') => {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
    position: fixed;
    top: 100px;
    right: 20px;
    padding: 1rem 1.5rem;
    background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
    color: white;
    border-radius: 0.5rem;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    z-index: 9999;
    animation: slideInRight 0.3s ease-out;
  `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
};

// ===== SCROLL TO TOP BUTTON =====
const initScrollToTop = () => {
    const scrollTopBtn = document.getElementById('scroll-top');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 500) {
            scrollTopBtn?.classList.add('visible');
        } else {
            scrollTopBtn?.classList.remove('visible');
        }
    });

    scrollTopBtn?.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
};

// ===== HERO SUBTITLE STAGGER ANIMATION =====
const initHeroStagger = () => {
    const subtitleWords = document.querySelectorAll('.hero-subtitle span');
    subtitleWords.forEach((word, index) => {
        word.style.animationDelay = `${0.6 + (index * 0.1)}s`;
    });
};

// ===== MARQUEE DUPLICATION =====
const initMarquee = () => {
    const marqueeContent = document.querySelector('.marquee-content');
    if (marqueeContent) {
        const children = Array.from(marqueeContent.children);
        children.forEach(child => {
            const clone = child.cloneNode(true);
            marqueeContent.appendChild(clone);
        });
    }
};

// ===== LAZY LOADING IMAGES =====
const initLazyLoading = () => {
    const images = document.querySelectorAll('img[data-src]');

    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                imageObserver.unobserve(img);
            }
        });
    });

    images.forEach(img => imageObserver.observe(img));
};

// ===== PORTFOLIO HOVER EFFECTS =====
const initPortfolioEffects = () => {
    const portfolioCards = document.querySelectorAll('.portfolio-card');

    portfolioCards.forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-8px)';
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0)';
        });
    });
};

// ===== UPDATE CURRENT YEAR =====
const initCurrentYear = () => {
    const yearElement = document.getElementById('current-year');
    if (yearElement) {
        const currentYear = new Date().getFullYear();
        yearElement.textContent = currentYear;
    }
};

// ===== INITIALIZE ALL =====
const init = () => {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAll);
    } else {
        initAll();
    }
};

const initAll = () => {
    initDarkMode();
    initNavbarScroll();
    initScrollProgress();
    initSmoothScroll();
    initRevealAnimations();
    initCounters();
    initMobileMenu();
    initFormValidation();
    initScrollToTop();
    initHeroStagger();
    initMarquee();
    initLazyLoading();
    initPortfolioEffects();
    initCurrentYear();

    console.log('✨ Portafolio Minimalista cargado correctamente');
};

// Start initialization
init();

// Add notification animations to document
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInRight {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOutRight {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
  
  .overflow-hidden {
    overflow: hidden;
  }
`;
document.head.appendChild(style);
