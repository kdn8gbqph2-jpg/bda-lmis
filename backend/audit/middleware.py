import threading

_thread_local = threading.local()


def get_current_user():
    return getattr(_thread_local, 'user', None)


def get_current_request_meta():
    """Returns (ip_address, user_agent) captured from the current request."""
    return (
        getattr(_thread_local, 'ip_address', None),
        getattr(_thread_local, 'user_agent', ''),
    )


class AuditMiddleware:
    """
    Stores the authenticated user + request metadata in thread-local
    storage so that signal handlers can write AuditLog entries without
    needing access to the request object.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Capture user (may be AnonymousUser before auth middleware runs,
        # but AuthenticationMiddleware runs before us so it's always set)
        user = getattr(request, 'user', None)
        if user and user.is_authenticated:
            _thread_local.user = user
        else:
            _thread_local.user = None

        _thread_local.ip_address = self._get_ip(request)
        _thread_local.user_agent = request.META.get('HTTP_USER_AGENT', '')

        try:
            response = self.get_response(request)
        finally:
            # Always clean up — prevents leaking data between requests
            # on the same thread in the development server
            _thread_local.user       = None
            _thread_local.ip_address = None
            _thread_local.user_agent = ''

        return response

    @staticmethod
    def _get_ip(request):
        x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded:
            return x_forwarded.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')
