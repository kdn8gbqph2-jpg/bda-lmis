import { Map } from 'lucide-react'

export default function MapPage() {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center">
      <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
        <Map className="w-8 h-8 text-blue-500" />
      </div>
      <h2 className="text-xl font-semibold text-slate-800 mb-2">GIS Map</h2>
      <p className="text-slate-500 text-sm max-w-sm">
        Interactive map of colonies, khasras and plots will appear here.
        MapMyIndia integration is under development.
      </p>
    </div>
  )
}
