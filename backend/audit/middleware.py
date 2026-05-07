class AuditMiddleware:
    """
    Attaches request metadata to the thread so signal handlers
    can log IP and user-agent without needing the request object.
    Will be wired to model signals once models are implemented.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        return self.get_response(request)
