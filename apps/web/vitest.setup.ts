/// <reference types="vitest/globals" />
import "@testing-library/jest-dom/vitest";
import { configure } from "@testing-library/react";

// The full suite runs every file in parallel, and under that load a findBy or
// waitFor can take longer than the 1 s default even though nothing is wrong.
configure({ asyncUtilTimeout: 5000 });

if (typeof window !== "undefined") {
  // Sonner shows a toast at opacity 0 until an effect marks it mounted, so a
  // findBy under load can catch it mid-enter and fail toBeVisible. Skip the
  // enter state only; toasts past the visible limit or removed stay hidden.
  const style = document.createElement("style");
  style.textContent =
    "[data-sonner-toast][data-mounted=false]:not([data-visible=false]):not([data-removed=true]){opacity:1}";
  document.head.appendChild(style);

  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => undefined;
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => undefined;
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => undefined;
  }
  if (!window.matchMedia) {
    window.matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    });
  }
}
