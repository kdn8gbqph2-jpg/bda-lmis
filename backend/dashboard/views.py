from django.core.cache import cache
from django.db.models import Count, Q, Sum
from django.db.models.functions import ExtractYear
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from colonies.models import Colony


class DashboardStatsView(APIView):
    """
    GET /api/dashboard/stats/

    Global KPIs:
      total_colonies, total_plots, total_pattas,
      pattas_issued, pattas_missing, pattas_cancelled,
      total_documents, regulation_files_present, regulation_files_missing
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        cache_key = 'dashboard:stats'
        cached    = cache.get(cache_key)
        if cached:
            return Response(cached)

        data = {
            'total_colonies':   Colony.objects.count(),
            'approved_layouts': Colony.objects.filter(
                layout_approval_date__isnull=False,
            ).count(),
        }

        try:
            from plots.models import Plot
            data['total_plots'] = Plot.objects.count()
        except Exception:
            data['total_plots'] = None

        try:
            from pattas.models import Patta
            pqs = Patta.objects.values('status').annotate(count=Count('id'))
            patta_map = {row['status']: row['count'] for row in pqs}
            data.update({
                'total_pattas':      sum(patta_map.values()),
                'pattas_issued':     patta_map.get('issued',     0),
                'pattas_missing':    patta_map.get('missing',    0),
                'pattas_cancelled':  patta_map.get('cancelled',  0),
                'pattas_amended':    patta_map.get('amended',    0),
                'pattas_superseded': patta_map.get('superseded', 0),
                'regulation_files_present': Patta.objects.filter(
                    regulation_file_present=True
                ).count(),
                'regulation_files_missing': Patta.objects.filter(
                    regulation_file_present=False
                ).count(),
            })
        except Exception:
            data['total_pattas'] = None

        try:
            from documents.models import Document
            data.update({
                'total_documents':      Document.objects.count(),
                'documents_verified':   Document.objects.filter(status='verified').count(),
                'documents_uploaded':   Document.objects.filter(status='uploaded').count(),
            })
        except Exception:
            data['total_documents'] = None

        cache.set(cache_key, data, 60 * 5)  # 5 min TTL
        return Response(data)


class ColonyProgressView(APIView):
    """
    GET /api/dashboard/colony-progress/

    Per-colony breakdown:
    [{colony_id, colony_name, zone, total_plots, pattas_issued,
      regulation_present, regulation_missing, regulation_not_recorded}]

    Sorted by colony name. Cached 10 min.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        cache_key = 'dashboard:colony-progress'
        cached    = cache.get(cache_key)
        if cached:
            return Response(cached)

        rows = []

        try:
            from plots.models import Plot
            from pattas.models import Patta

            colonies = Colony.objects.order_by('name')
            for colony in colonies:
                total_plots     = Plot.objects.filter(colony=colony).count()
                pattas_issued   = Patta.objects.filter(colony=colony, status='issued').count()
                reg_present     = Patta.objects.filter(colony=colony, regulation_file_present=True).count()
                reg_missing     = Patta.objects.filter(colony=colony, regulation_file_present=False).count()
                reg_not_rec     = Patta.objects.filter(colony=colony, regulation_file_present__isnull=True).count()

                rows.append({
                    'colony_id':              colony.id,
                    'colony_name':            colony.name,
                    'zone':                   colony.zone,
                    'total_plots':            total_plots,
                    'pattas_issued':          pattas_issued,
                    'regulation_present':     reg_present,
                    'regulation_missing':     reg_missing,
                    'regulation_not_recorded': reg_not_rec,
                })
        except Exception:
            # plots/pattas not yet migrated
            rows = [
                {
                    'colony_id':   c.id,
                    'colony_name': c.name,
                    'zone':        c.zone,
                }
                for c in Colony.objects.order_by('name')
            ]

        cache.set(cache_key, rows, 60 * 10)
        return Response(rows)


class ChartsView(APIView):
    """
    GET /api/dashboard/charts/

    Aggregate datasets for the dashboard's amCharts visualisations:

    - colony_type_distribution: [{value, label, count}, ...] for a donut
      across the 5 colony_type categories.
    - pattas_by_year:           [{year, count}, ...] for a column chart
      of pattas issued by issue_date year.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        cache_key = 'dashboard:charts'
        cached    = cache.get(cache_key)
        if cached:
            return Response(cached)

        from colonies.models import COLONY_TYPE_CHOICES
        type_labels = dict(COLONY_TYPE_CHOICES)
        type_counts = dict(
            Colony.objects.values_list('colony_type').annotate(c=Count('id'))
        )
        colony_type_distribution = [
            {
                'value': value,
                'label': type_labels.get(value, value),
                'count': type_counts.get(value, 0),
            }
            for value, _label in COLONY_TYPE_CHOICES
        ]

        pattas_by_year = []
        try:
            from pattas.models import Patta
            rows = (
                Patta.objects
                .filter(issue_date__isnull=False, status='issued')
                .annotate(year=ExtractYear('issue_date'))
                .values('year')
                .annotate(count=Count('id'))
                .order_by('year')
            )
            pattas_by_year = [
                {'year': int(r['year']), 'count': r['count']}
                for r in rows if r['year']
            ]
        except Exception:
            pass

        data = {
            'colony_type_distribution': colony_type_distribution,
            'pattas_by_year':           pattas_by_year,
        }
        cache.set(cache_key, data, 60 * 10)
        return Response(data)


class ZoneBreakdownView(APIView):
    """
    GET /api/dashboard/zone-breakdown/

    Aggregate by zone:
    [{zone, colony_count, total_residential_plots, total_commercial_plots}]
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        cache_key = 'dashboard:zone-breakdown'
        cached    = cache.get(cache_key)
        if cached:
            return Response(cached)

        rows = (
            Colony.objects
            .values('zone')
            .annotate(
                colony_count=Count('id'),
                total_residential_plots=Sum('total_residential_plots'),
                total_commercial_plots=Sum('total_commercial_plots'),
            )
            .order_by('zone')
        )

        data = list(rows)
        cache.set(cache_key, data, 60 * 10)
        return Response(data)
