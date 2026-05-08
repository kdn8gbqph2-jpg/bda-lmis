export const PLOT_STATUS = {
  available:          { label: 'Available',           color: 'bg-slate-100 text-slate-700',   dot: 'bg-slate-400'   },
  allotted_lottery:   { label: 'Allotted (Lottery)',  color: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-500'    },
  allotted_seniority: { label: 'Allotted (Seniority)',color: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500'  },
  ews:                { label: 'EWS',                 color: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-500'   },
  patta_ok:           { label: 'Patta OK',            color: 'bg-green-100 text-green-700',   dot: 'bg-green-500'   },
  patta_missing:      { label: 'Patta Missing',       color: 'bg-red-100 text-red-700',       dot: 'bg-red-500'     },
  cancelled:          { label: 'Cancelled',           color: 'bg-gray-100 text-gray-500',     dot: 'bg-gray-400'    },
}

export const PATTA_STATUS = {
  issued:     { label: 'Issued',     color: 'bg-green-100 text-green-700'  },
  missing:    { label: 'Missing',    color: 'bg-red-100 text-red-700'      },
  cancelled:  { label: 'Cancelled',  color: 'bg-gray-100 text-gray-500'    },
  amended:    { label: 'Amended',    color: 'bg-blue-100 text-blue-700'    },
  superseded: { label: 'Superseded', color: 'bg-orange-100 text-orange-700'},
}

export const getPlotStatus  = (k) => PLOT_STATUS[k]  || { label: k, color: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' }
export const getPattaStatus = (k) => PATTA_STATUS[k] || { label: k, color: 'bg-gray-100 text-gray-600' }
