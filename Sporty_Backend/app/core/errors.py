"""Domain errors safe to surface to API clients.

Raise DomainError (not bare ValueError) for business-rule violations whose
message is written FOR the end user — squad validation, auto-pick pool
problems, etc. The app-level handler in app/main.py returns its str() as a
400 response body.

A bare ValueError is treated as an internal bug: it falls through to the
generic 500 handler (full traceback logged, no message leaked). The previous
global ValueError→400 handler echoed str(exc) to clients for ANY ValueError
raised anywhere in the stack, leaking internals and masking real bugs as
"bad request".
"""


class DomainError(ValueError):
    """Business-rule violation with a client-safe message."""
