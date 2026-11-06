import React from "react";

interface ErrorBoundaryProps {
  /** Where the error is logged from, e.g. "chat". */
  name: string;
  /** Shown instead of the children; `reset` renders them again. */
  fallback: (reset: () => void) => React.ReactNode;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  failed: boolean;
}

/**
 * Keeps a render error in one part of the screen (the chat dock, a widget)
 * from blanking the whole page: that part shows its fallback, the rest keeps
 * working.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    console.error(`[BlueDental] Lỗi hiển thị (${this.props.name}):`, error);
  }

  private readonly reset = () => this.setState({ failed: false });

  render(): React.ReactNode {
    return this.state.failed ? this.props.fallback(this.reset) : this.props.children;
  }
}
