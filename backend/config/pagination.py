"""
Project-wide pagination class.

PageNumberPagination over CursorPagination because the frontend tables
need to render "page X of Y" controls and a total count — both unavailable
in cursor-mode responses. Page size is client-overridable via ?page_size=
up to a sane cap.
"""

from rest_framework.pagination import PageNumberPagination


class StandardPageNumberPagination(PageNumberPagination):
    page_size             = 50
    page_size_query_param = 'page_size'
    max_page_size         = 500
