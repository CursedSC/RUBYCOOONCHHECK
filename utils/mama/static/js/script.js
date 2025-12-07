/**
 * RubyCon Rules Page - JavaScript
 * Обработка анимаций и взаимодействий
 */

// Константы
const SCROLL_THRESHOLD = 300;
const ANIMATION_DELAY = 200;
const OBSERVER_THRESHOLD = 0.1;

/**
 * Инициализация при загрузке DOM
 */
document.addEventListener('DOMContentLoaded', () => {
    playWelcomeSound();
    initAnimations();
    initScrollEvents();
    initHeaderAnimation();
    initParallaxEffect();
    initRuleAnimations();
    initDiscordAnimation();
});

/**
 * Воспроизведение приветственного звука
 */
function playWelcomeSound() {
    const sound = document.getElementById('welcomeSound');
    if (sound) {
        // Устанавливаем громкость (0.0 - 1.0)
        sound.volume = 0.5;
        
        // Пробуем воспроизвести звук
        const playPromise = sound.play();
        
        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    console.log('Звук успешно воспроизведен');
                })
                .catch(error => {
                    console.log('Автовоспроизведение заблокировано браузером:', error);
                    // Добавляем возможность воспроизведения по клику
                    document.body.addEventListener('click', () => {
                        sound.play().catch(e => console.log('Ошибка воспроизведения:', e));
                    }, { once: true });
                });
        }
    }
}

/**
 * Инициализация анимаций появления элементов
 */
function initAnimations() {
    const observerOptions = {
        threshold: OBSERVER_THRESHOLD,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateElement(entry.target);
            }
        });
    }, observerOptions);

    // Применяем анимацию к секциям
    const sections = document.querySelectorAll('.rules-section, .discord-end-section, .footer');
    sections.forEach(section => {
        prepareForAnimation(section);
        observer.observe(section);
    });
}

/**
 * Подготовка элемента к анимации
 */
function prepareForAnimation(element) {
    element.style.opacity = '0';
    element.style.transform = 'translateY(50px)';
    element.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
}

/**
 * Анимация появления элемента
 */
function animateElement(element) {
    setTimeout(() => {
        element.style.opacity = '1';
        element.style.transform = 'translateY(0)';
    }, 100);
}

/**
 * Анимация хедера
 */
function initHeaderAnimation() {
    const header = document.querySelector('.header');
    if (!header) return;

    header.style.opacity = '0';
    header.style.transform = 'translateY(-50px) scale(0.95)';
    header.style.transition = 'opacity 1s ease, transform 1s ease';

    setTimeout(() => {
        header.style.opacity = '1';
        header.style.transform = 'translateY(0) scale(1)';
    }, ANIMATION_DELAY);
}

/**
 * Инициализация событий скролла
 */
function initScrollEvents() {
    const supportButton = document.querySelector('.support-button');
    if (!supportButton) return;

    window.addEventListener('scroll', () => {
        toggleSupportButton(supportButton);
    });
}

/**
 * Показ/скрытие кнопки поддержки при скролле
 */
function toggleSupportButton(button) {
    const shouldShow = window.scrollY > SCROLL_THRESHOLD;
    button.style.display = shouldShow ? 'flex' : 'none';
}

/**
 * Параллакс эффект для фона
 */
function initParallaxEffect() {
    const background = document.querySelector('.bg-image');
    if (!background) return;

    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        const parallax = scrolled * 0.5;
        background.style.transform = `translateY(${parallax}px) scale(1.1)`;
    });
}

/**
 * Анимация для правил при наведении
 */
function initRuleAnimations() {
    const rules = document.querySelectorAll('.rule-item');
    
    rules.forEach(rule => {
        rule.addEventListener('mouseenter', () => {
            const number = rule.querySelector('.rule-number');
            if (number) {
                number.style.transform = 'scale(1.3)';
                number.style.transition = 'transform 0.3s ease';
            }
        });

        rule.addEventListener('mouseleave', () => {
            const number = rule.querySelector('.rule-number');
            if (number) {
                number.style.transform = 'scale(1)';
            }
        });
    });
}

/**
 * Дополнительные анимации для Discord секции
 */
function initDiscordAnimation() {
    const discordSection = document.querySelector('.discord-end-section');
    if (!discordSection) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const icon = discordSection.querySelector('.discord-end-icon');
                const title = discordSection.querySelector('.discord-end-title');
                const button = discordSection.querySelector('.discord-end-button');

                if (icon) {
                    setTimeout(() => {
                        icon.style.animation = 'discordIconFloat 3s ease-in-out infinite, iconEntrance 1s ease forwards';
                    }, 100);
                }

                if (title) {
                    setTimeout(() => {
                        title.style.opacity = '1';
                        title.style.transform = 'translateY(0)';
                    }, 300);
                }

                if (button) {
                    setTimeout(() => {
                        button.style.opacity = '1';
                        button.style.transform = 'translateY(0)';
                    }, 500);
                }
            }
        });
    }, { threshold: 0.3 });

    observer.observe(discordSection);
}

/**
 * Переключение показа наказания для правила
 * @param {HTMLElement} element - Элемент правила
 */
function togglePunishment(element) {
    const isActive = element.classList.contains('active');
    const punishmentInfo = element.querySelector('.punishment-info');

    if (isActive) {
        // Закрываем текущий пункт
        element.classList.remove('active');
        if (punishmentInfo) {
            punishmentInfo.style.maxHeight = '0';
        }
    } else {
        // Закрываем все другие пункты
        closeAllRules();
        // Открываем текущий пункт
        element.classList.add('active');
        if (punishmentInfo) {
            punishmentInfo.style.maxHeight = punishmentInfo.scrollHeight + 'px';
        }
    }
}

/**
 * Закрытие всех открытых правил
 */
function closeAllRules() {
    const rules = document.querySelectorAll('.rule-item');
    rules.forEach(item => {
        item.classList.remove('active');
        const punishmentInfo = item.querySelector('.punishment-info');
        if (punishmentInfo) {
            punishmentInfo.style.maxHeight = '0';
        }
    });
}

/**
 * Открытие Discord для поддержки
 */
function openSupport() {
    window.open('https://discord.com/channels/1381454652234530866/1382012908824825979', '_blank');
}


// Добавляем CSS анимацию для входа иконки Discord
const style = document.createElement('style');
style.textContent = `
    @keyframes iconEntrance {
        from {
            transform: scale(0);
            opacity: 0;
        }
        to {
            transform: scale(1);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);
// В конец файла добавьте или обновите:

// Показываем кнопки при скролле
window.addEventListener('scroll', function() {
    const supportButton = document.querySelector('.support-button');
    const forumButton = document.querySelector('.forum-button');
    
    if (window.scrollY > 300) {
        if (supportButton) {
            supportButton.style.display = 'flex';
        }
        if (forumButton) {
            forumButton.style.display = 'flex';
        }
    } else {
        if (supportButton) {
            supportButton.style.display = 'none';
        }
        if (forumButton) {
            forumButton.style.display = 'none';
        }
    }
});

// Экспорт функций для глобального использования
window.togglePunishment = togglePunishment;
window.openSupport = openSupport;
