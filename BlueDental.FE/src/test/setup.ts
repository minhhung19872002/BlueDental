import "@testing-library/jest-dom";

// jsdom implements no scrolling at all, so Element.scrollTo is missing and any
// component that scrolls a selection into view throws instead of rendering.
// Real browsers all have it; this only fills the gap in the test environment.
if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = () => {};
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
