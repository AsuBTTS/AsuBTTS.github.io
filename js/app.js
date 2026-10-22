import {
  createIcons, ArrowUpRight, ArrowLeft, Monitor, Gamepad2, Music2, BookOpen,
  FileText, Clapperboard, Coffee, Camera, CodeXml, X, ChevronLeft, ChevronRight,
} from "lucide";

createIcons({
  icons: {
    ArrowUpRight, ArrowLeft, Monitor, Gamepad2, Music2, BookOpen,
    FileText, Clapperboard, Coffee, Camera, CodeXml, X, ChevronLeft, ChevronRight,
  },
});

const year = document.querySelector("#year");

if (year) {
  year.textContent = new Date().getFullYear().toString();
}

const links = Array.from(document.querySelectorAll(".nav-link"));
const localLinks = links.filter((link) => link.getAttribute("href")?.startsWith("#"));

const setActiveLink = (id) => {
  localLinks.forEach((link) => {
    link.classList.toggle("is-active", link.getAttribute("href") === `#${id}`);
    if (link.classList.contains("is-active")) {
      link.setAttribute("aria-current", "location");
    } else {
      link.removeAttribute("aria-current");
    }
  });
};

if (localLinks.length) {
  const sections = localLinks.map((link) => document.getElementById(link.hash.slice(1))).filter(Boolean);
  let scheduled = false;
  const updateNavigation = () => {
    const offset = document.querySelector(".topbar").offsetHeight + 100;
    const current = [...sections].reverse().find((section) => section.getBoundingClientRect().top <= offset);
    setActiveLink(current?.id || "home");
    scheduled = false;
  };
  window.addEventListener("scroll", () => {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(updateNavigation);
    }
  }, { passive: true });
  updateNavigation();
}

const lightbox = document.querySelector(".lightbox");
const imageButtons = Array.from(document.querySelectorAll("[data-lightbox]"));
if (lightbox && imageButtons.length) {
  const preview = lightbox.querySelector("img");
  const caption = lightbox.querySelector("figcaption");
  const counter = lightbox.querySelector(".lightbox-counter");
  let selected = 0;
  let opener = null;
  const showImage = (index) => {
    selected = (index + imageButtons.length) % imageButtons.length;
    const source = imageButtons[selected].querySelector("img");
    preview.src = source.src;
    preview.alt = source.alt;
    caption.textContent = imageButtons[selected].closest("figure").querySelector("figcaption").innerText;
    counter.textContent = `${selected + 1} / ${imageButtons.length}`;
  };
  imageButtons.forEach((button, index) => button.addEventListener("click", () => {
    opener = button;
    showImage(index);
    lightbox.showModal();
    lightbox.querySelector("[data-lightbox-close]").focus();
  }));
  lightbox.querySelector("[data-lightbox-close]").addEventListener("click", () => lightbox.close());
  lightbox.querySelector("[data-lightbox-prev]").addEventListener("click", () => showImage(selected - 1));
  lightbox.querySelector("[data-lightbox-next]").addEventListener("click", () => showImage(selected + 1));
  lightbox.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      showImage(selected + (event.key === "ArrowRight" ? 1 : -1));
    }
  });
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) lightbox.close();
  });
  lightbox.addEventListener("close", () => opener?.focus());
}
