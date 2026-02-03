"""
Centralized Opik client wrapper for GoalPulse observability.
Provides a singleton pattern for Opik client access with graceful degradation.
"""

import os
import logging
from functools import lru_cache
from typing import Optional, Any
from contextlib import contextmanager

logger = logging.getLogger(__name__)

# Thread-local storage for active trace context
import threading
_trace_context = threading.local()


class OpikWrapper:
    """
    Wrapper for Opik client with lazy initialization and graceful fallback.
    If Opik is not configured or unavailable, operations become no-ops.
    """

    def __init__(self):
        self._client = None
        self._enabled = False
        self._initialized = False

    def _initialize(self) -> None:
        """Lazy initialization of Opik client."""
        if self._initialized:
            return

        self._initialized = True

        try:
            import opik

            # Check for Opik API key in environment
            api_key = os.getenv("OPIK_API_KEY")
            workspace = os.getenv("OPIK_WORKSPACE", "goalpulse")

            if not api_key:
                logger.warning(
                    "OPIK_API_KEY not set. Opik observability disabled. "
                    "Set OPIK_API_KEY in .env to enable tracing."
                )
                return

            # Configure Opik
            opik.configure(
                api_key=api_key,
                workspace=workspace,
                use_local=os.getenv("OPIK_USE_LOCAL", "false").lower() == "true",
            )

            self._client = opik.Opik()
            self._enabled = True
            logger.info(f"Opik observability enabled for workspace: {workspace}")

        except ImportError:
            logger.warning("Opik package not installed. Observability disabled.")
        except Exception as e:
            logger.error(f"Failed to initialize Opik: {e}. Observability disabled.")

    @property
    def client(self) -> Optional[object]:
        """Get the Opik client, initializing if needed."""
        self._initialize()
        return self._client

    @property
    def enabled(self) -> bool:
        """Check if Opik is enabled and functioning."""
        self._initialize()
        return self._enabled

    def trace(self, name: str = None, **kwargs):
        """
        Create a trace decorator. Falls back to a no-op if Opik is disabled.
        
        Usage:
            @opik_wrapper.trace(name="my-trace")
            async def my_function():
                ...
        """
        self._initialize()

        if self._enabled:
            import opik
            return opik.track(name=name, **kwargs)
        else:
            # Return a no-op decorator when Opik is disabled
            def noop_decorator(func):
                return func
            return noop_decorator

    @contextmanager
    def trace_context(self, name: str, input_data: dict = None, thread_id: str = None):
        """
        Context manager for explicit trace wrapping with proper nesting.
        
        Usage:
            with opik_client.trace_context("goal-creation-flow", {"user_id": "123"}, thread_id="session-abc") as trace:
                # do work
                trace.set_output({"status": "complete"})
        
        Args:
            name: Name of the trace
            input_data: Input data to log
            thread_id: Optional thread ID to link related traces together (e.g., same conversation)
        
        This ensures spans created inside are properly nested under this trace.
        """
        self._initialize()

        if not self._enabled:
            # Yield a no-op trace object
            yield _NoOpTrace()
            return

        try:
            import opik
            
            # Create trace with Opik client, including thread_id if provided
            trace = self._client.trace(name=name, input=input_data, thread_id=thread_id)
            
            # Store in thread-local for child spans
            old_trace = getattr(_trace_context, 'current_trace', None)
            _trace_context.current_trace = trace
            
            try:
                yield _TraceHandle(trace)
            finally:
                # End trace and restore context
                trace.end()
                _trace_context.current_trace = old_trace
                
        except Exception as e:
            logger.error(f"Error in trace_context: {e}")
            yield _NoOpTrace()

    def log_span(self, name: str, output: dict, input: dict = None) -> None:
        """
        Log a span with the given name, input, and output payload.
        Automatically nests under the current trace context if available.
        
        Usage:
            opik_client.log_span("extract_goal", 
                input={"user_input": message},
                output={"extracted_title": goal_draft["title"]}
            )
        """
        self._initialize()
        
        if not self._enabled:
            return
            
        try:
            current_trace = getattr(_trace_context, 'current_trace', None)
            
            if current_trace:
                # Create span under current trace with input
                span = current_trace.span(name=name, input=input or {})
                span.end(output=output)
            else:
                # Fallback to standalone track (less ideal but works)
                import opik
                opik.track(name=name, capture_output=True)(lambda: output)()
                
        except Exception as e:
            logger.error(f"Error logging span '{name}': {e}")

    def check_health(self) -> dict:
        """
        Health check for Opik integration.
        Returns status information for diagnostics.
        """
        self._initialize()
        return {
            "enabled": self._enabled,
            "initialized": self._initialized,
            "api_key_set": bool(os.getenv("OPIK_API_KEY")),
            "workspace": os.getenv("OPIK_WORKSPACE", "goalpulse"),
        }


class _TraceHandle:
    """Handle for setting trace output and logging nested spans."""
    
    def __init__(self, trace):
        self._trace = trace
    
    def set_output(self, output: dict) -> None:
        """Set the trace output before it ends."""
        try:
            self._trace.update(output=output)
        except Exception as e:
            logger.error(f"Error setting trace output: {e}")
    
    def log_span(self, name: str, input: dict = None, output: dict = None) -> None:
        """Log a span nested under this trace."""
        try:
            span = self._trace.span(name=name, input=input or {})
            span.end(output=output or {})
        except Exception as e:
            logger.error(f"Error logging nested span '{name}': {e}")


class _NoOpTrace:
    """No-op trace handle when Opik is disabled."""
    
    def set_output(self, output: dict) -> None:
        pass
    
    def log_span(self, name: str, input: dict = None, output: dict = None) -> None:
        pass


# Singleton instance
_opik_wrapper: Optional[OpikWrapper] = None


@lru_cache(maxsize=1)
def get_opik_client() -> OpikWrapper:
    """Get the singleton Opik wrapper instance."""
    global _opik_wrapper
    if _opik_wrapper is None:
        _opik_wrapper = OpikWrapper()
    return _opik_wrapper

