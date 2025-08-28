'use client'

import { useEffect, useState } from 'react'
import { UserPlus, MapPin, Trash2, Settings, Users } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { 
  getAllUsers, 
  getUserSiteAssignments, 
  assignUserToSite, 
  removeUserFromSite,
  getSites,
  type UserProfile,
  type UserSiteAssignment,
  type Site
} from '@/lib/supabase'

export default function ManagerDashboard() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [assignments, setAssignments] = useState<UserSiteAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<string>('')
  const [selectedSite, setSelectedSite] = useState<string>('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [usersData, sitesData, assignmentsData] = await Promise.all([
        getAllUsers(),
        getSites(),
        getUserSiteAssignments()
      ])
      
      setUsers(usersData)
      setSites(sitesData)
      setAssignments(assignmentsData)
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const handleAssignUser = async () => {
    if (!selectedUser || !selectedSite) {
      toast.error('Please select both user and site')
      return
    }

    try {
      await assignUserToSite(selectedUser, selectedSite)
      toast.success('User assigned to site successfully')
      setSelectedUser('')
      setSelectedSite('')
      loadData() // Refresh data
    } catch (error) {
      console.error('Error assigning user:', error)
      toast.error('Failed to assign user to site')
    }
  }

  const handleRemoveAssignment = async (userId: string, siteId: string) => {
    try {
      await removeUserFromSite(userId, siteId)
      toast.success('Assignment removed successfully')
      loadData() // Refresh data
    } catch (error) {
      console.error('Error removing assignment:', error)
      toast.error('Failed to remove assignment')
    }
  }

  const getInstallers = () => users.filter(user => user.role === 'installer')
  
  const getUserAssignments = (userId: string) => 
    assignments.filter(assignment => assignment.user_id === userId)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded mb-4 w-1/3"></div>
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Settings className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Manager Dashboard</h1>
          </div>
          <p className="text-gray-600">Manage user assignments and site access</p>
        </div>

        {/* Assignment Form */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <UserPlus className="h-5 w-5 text-green-600" />
            <h2 className="text-lg font-semibold text-gray-900">Assign User to Site</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Installer
              </label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose installer...</option>
                {getInstallers().map(user => (
                  <option key={user.id} value={user.id}>
                    {user.full_name || user.email}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Site
              </label>
              <select
                value={selectedSite}
                onChange={(e) => setSelectedSite(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose site...</option>
                {sites.map(site => (
                  <option key={site.id} value={site.id}>
                    {site.name}{site.location ? ` - ${site.location}` : ''}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex items-end">
              <button
                onClick={handleAssignUser}
                disabled={!selectedUser || !selectedSite}
                className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
              >
                Assign User
              </button>
            </div>
          </div>
        </div>

        {/* Users and Assignments */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <Users className="h-5 w-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-900">User Assignments</h2>
          </div>
          
          <div className="space-y-4">
            {getInstallers().map(user => {
              const userAssignments = getUserAssignments(user.id)
              
              return (
                <div key={user.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {user.full_name || user.email}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {userAssignments.length} site{userAssignments.length !== 1 ? 's' : ''} assigned
                      </p>
                    </div>
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                      Installer
                    </span>
                  </div>
                  
                  {userAssignments.length > 0 ? (
                    <div className="space-y-2">
                      {userAssignments.map(assignment => (
                        <div key={assignment.id} className="flex items-center justify-between bg-gray-50 p-3 rounded">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-gray-500" />
                            <span className="text-sm font-medium">
                              {assignment.sites?.name}
                            </span>
                            {assignment.sites?.location && (
                              <span className="text-xs text-gray-500">
                                - {assignment.sites.location}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => handleRemoveAssignment(user.id, assignment.site_id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                            title="Remove assignment"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">
                      No sites assigned to this installer
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {getInstallers().length}
                </p>
                <p className="text-sm text-gray-500">Total Installers</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <MapPin className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {sites.length}
                </p>
                <p className="text-sm text-gray-500">Total Sites</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <UserPlus className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {assignments.length}
                </p>
                <p className="text-sm text-gray-500">Active Assignments</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}