/**
 * Shared category metadata for the public portal.
 *
 * Single source of truth for the 5 colony types — labels, icons, colors,
 * and Tailwind class strings.  Used by the dashboard cards, sidebar nav,
 * and analytics legends.
 */

import {
  Building2, CheckCircle2, AlertCircle, Clock, XCircle,
} from 'lucide-react'

export const CATEGORIES = [
  {
    value:       'bda_scheme',
    label:       'BDA Schemes',
    labelHi:     'बीडीए योजनाएँ',
    description: 'Residential and commercial colonies developed directly by BDA.',
    icon:        Building2,
    color:       'blue',
    accent:      'bg-blue-500',
    tint:        'bg-blue-50',
    border:      'border-slate-200 hover:border-blue-300',
    text:        'text-blue-700',
    badge:       'bg-blue-50 text-blue-700 border border-blue-100',
  },
  {
    value:       'private_approved',
    label:       'Private Approved',
    labelHi:     'निजी अनुमोदित कॉलोनियाँ',
    description: 'Private colonies with formal layout approval from BDA.',
    icon:        CheckCircle2,
    color:       'emerald',
    accent:      'bg-emerald-500',
    tint:        'bg-emerald-50',
    border:      'border-slate-200 hover:border-emerald-300',
    text:        'text-emerald-700',
    badge:       'bg-emerald-50 text-emerald-700 border border-emerald-100',
  },
  {
    value:       'suo_moto',
    label:       'SUO-Moto Cases',
    labelHi:     'स्वतः संज्ञान कॉलोनी प्रकरण',
    description: 'Colonies taken up suo-moto under the Rajasthan UDA Act.',
    icon:        AlertCircle,
    color:       'amber',
    accent:      'bg-amber-500',
    tint:        'bg-amber-50',
    border:      'border-slate-200 hover:border-amber-300',
    text:        'text-amber-700',
    badge:       'bg-amber-50 text-amber-700 border border-amber-100',
  },
  {
    value:       'pending_layout',
    label:       'Pending Layouts',
    labelHi:     'लंबित कॉलोनी लेआउट',
    description: 'Layout plans currently under review or pending decision.',
    icon:        Clock,
    color:       'orange',
    accent:      'bg-orange-500',
    tint:        'bg-orange-50',
    border:      'border-slate-200 hover:border-orange-300',
    text:        'text-orange-700',
    badge:       'bg-orange-50 text-orange-700 border border-orange-100',
  },
  {
    value:       'rejected_layout',
    label:       'Rejected Layouts',
    labelHi:     'अस्वीकृत कॉलोनी लेआउट',
    description: 'Layout plans rejected by BDA. Public rejection reasons available.',
    icon:        XCircle,
    color:       'red',
    accent:      'bg-red-500',
    tint:        'bg-red-50',
    border:      'border-slate-200 hover:border-red-300',
    text:        'text-red-700',
    badge:       'bg-red-50 text-red-700 border border-red-100',
  },
]
