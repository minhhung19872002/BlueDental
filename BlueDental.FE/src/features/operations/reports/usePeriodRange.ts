// Moved to src/hooks/ so other features (Công cụ's call history) can share it.
// This re-export keeps the operations screens' imports — and the tests that
// verified them — untouched.
export * from "@/hooks/usePeriodRange";
