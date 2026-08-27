// Moved to src/utils/ so other features (Công cụ's call lists) can share it.
// This re-export keeps the operations screens' imports — and the tests that
// verified them — untouched.
export { pagerTotal as operationsTotal } from "@/utils/pagerTotal";
