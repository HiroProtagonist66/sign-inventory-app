'use client'

import { useEffect, useState } from 'react'
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'
import { Calendar, Filter, Download, TrendingUp, Package, AlertTriangle, CheckCircle } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { getDashboardData, type DashboardData } from '@/lib/dashboard-queries'

interface InventoryDashboardProps {
  userRole: string
}

export default function InventoryDashboard({ userRole }: InventoryDashboardProps) {
  console.log('InventoryDashboard: Component mounting, userRole:', userRole)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 30), 'yyyy-MM-dd'), // Back to 30 days since we confirmed data loads
    end: format(new Date(), 'yyyy-MM-dd')
  })
  const [selectedSite, setSelectedSite] = useState<string>('all')
  const [selectedArea, setSelectedArea] = useState<string>('all')

  useEffect(() => {
    loadDashboardData()
  }, [dateRange, selectedSite, selectedArea])

  const loadDashboardData = async () => {
    try {
      console.log('InventoryDashboard: Starting to load dashboard data...')
      setLoading(true)
      const filters = {
        startDate: startOfDay(new Date(dateRange.start)),
        endDate: endOfDay(new Date(dateRange.end + 'T23:59:59')), // Ensure end of day includes today
        siteId: selectedSite === 'all' ? undefined : selectedSite,
        areaId: selectedArea === 'all' ? undefined : selectedArea
      }
      console.log('InventoryDashboard: Calling getDashboardData with filters:', filters)
      const dashboardData = await getDashboardData(filters)
      console.log('InventoryDashboard: Dashboard data received:', dashboardData)
      setData(dashboardData)
    } catch (error) {
      console.error('InventoryDashboard: Error loading dashboard data:', error)
      toast.error(`Failed to load dashboard data: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const exportToCSV = () => {
    if (!data) return

    const csvContent = [
      ['Inventory Dashboard Export', format(new Date(), 'yyyy-MM-dd HH:mm')],
      [],
      ['Summary Statistics'],
      ['Total Signs', data.summary.totalSigns],
      ['Signs Inventoried', data.summary.signsInventoried],
      ['Present', data.summary.presentSigns],
      ['Missing', data.summary.missingSigns],
      ['Damaged', data.summary.damagedSigns],
      ['Completion Rate', `${data.summary.completionRate}%`],
      [],
      ['Daily Activity'],
      ['Date', 'Sessions', 'Signs Checked'],
      ...data.dailyActivity.map(d => [d.date, d.sessions, d.signsChecked]),
      [],
      ['Site Performance'],
      ['Site', 'Total Signs', 'Inventoried', 'Completion %'],
      ...data.sitePerformance.map(s => [s.site, s.totalSigns, s.inventoried, s.completionRate])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `inventory-dashboard-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
    toast.success('Dashboard data exported')
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard data...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">No data available</p>
      </div>
    )
  }

  const statusColors = {
    present: '#10b981',
    missing: '#ef4444',
    damaged: '#f59e0b'
  }

  const pieData = [
    { name: 'Present', value: data.summary.presentSigns, color: statusColors.present },
    { name: 'Missing', value: data.summary.missingSigns, color: statusColors.missing },
    { name: 'Damaged', value: data.summary.damagedSigns, color: statusColors.damaged }
  ].filter(d => d.value > 0)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Filter className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Site
            </label>
            <select
              value={selectedSite}
              onChange={(e) => setSelectedSite(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Sites</option>
              {data.sites.map(site => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex items-end">
            <button
              onClick={exportToCSV}
              className="w-full bg-green-600 text-white p-2 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Signs</p>
              <p className="text-2xl font-bold text-gray-900">
                {data.summary.totalSigns.toLocaleString()}
              </p>
            </div>
            <Package className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Inventoried</p>
              <p className="text-2xl font-bold text-gray-900">
                {data.summary.signsInventoried.toLocaleString()}
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Missing</p>
              <p className="text-2xl font-bold text-gray-900">
                {data.summary.missingSigns.toLocaleString()}
              </p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Completion</p>
              <p className="text-2xl font-bold text-gray-900">
                {data.summary.completionRate}%
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Status Distribution Pie Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Sign Status Distribution
          </h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              No inventory data for selected period
            </div>
          )}
        </div>

        {/* Daily Activity Line Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Daily Inventory Activity
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.dailyActivity}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tickFormatter={(date) => format(new Date(date), 'MM/dd')}
              />
              <YAxis />
              <Tooltip 
                labelFormatter={(date) => format(new Date(date as string), 'MMM dd, yyyy')}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="signsChecked" 
                stroke="#3b82f6"
                strokeWidth={2}
                name="Signs Checked"
              />
              <Line 
                type="monotone" 
                dataKey="sessions" 
                stroke="#10b981"
                strokeWidth={2}
                name="Sessions"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Site Performance */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Site Performance
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.sitePerformance}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="site" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="inventoried" fill="#3b82f6" name="Inventoried" />
            <Bar dataKey="remaining" fill="#e5e7eb" name="Remaining" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Activity Table */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Recent Inventory Sessions
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Site
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Area
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Signs Checked
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.recentSessions.map((session) => (
                <tr key={session.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {format(new Date(session.created_at), 'MMM dd, yyyy HH:mm')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {session.site_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {session.area_name || 'All Areas'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {session.user_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {session.sign_count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}