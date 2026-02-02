# GoalPulse Observability Module
# Centralized Opik integration for LLM tracing

from .opik_client import OpikWrapper, get_opik_client
from .trace_names import TraceNames

__all__ = ["OpikWrapper", "get_opik_client", "TraceNames"]

# Convenience: Get singleton instance for direct use
opik_client = get_opik_client()
