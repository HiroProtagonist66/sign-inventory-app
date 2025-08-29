'use client'

import { useEffect, useState } from 'react'
import { UserPlus, MapPin, Trash2, Settings, Users, CheckSquare, Square } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { 
  getAllUsers, 
  getUserSiteAssignments, 
  assignUserToSite, 
  removeUserFromSite,
  getSites,
  updateUserRole,
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
  const [selectedSites, setSelectedSites] = useState<string[]>([])
  const [changingRole, setChangingRole] = useState<string | null>(null)

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
    if (!selectedUser || selectedSites.length === 0) {
      toast.error('Please select both user and at least one site')
      return
    }

    try {
      // Assign user to multiple sites
      const assignmentPromises = selectedSites.map(siteId => 
        assignUserToSite(selectedUser, siteId)
      )
      
      await Promise.all(assignmentPromises)
      toast.success(`User assigned to ${selectedSites.length} site${selectedSites.length > 1 ? 's' : ''} successfully`)
      setSelectedUser('')
      setSelectedSites([])
      loadData() // Refresh data
    } catch (error) {
      console.error('Error assigning user:', error)
      toast.error('Failed to assign user to sites')
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

  const handleRoleChange = async (userId: string, newRole: 'manager' | 'installer' | 'project_manager') => {
    setChangingRole(userId)
    try {
      await updateUserRole(userId, newRole)
      toast.success(`Role updated to ${newRole.replace('_', ' ')}`)
      loadData() // Refresh data
    } catch (error) {
      console.error('Error updating role:', error)
      toast.error('Failed to update user role')
    } finally {
      setChangingRole(null)
    }
  }

  const getInstallers = () => users.filter(user => user.role === 'installer')
  
  const getNonManagers = () => users.filter(user => user.role !== 'manager')
  
  const getUserAssignments = (userId: string) => 
    assignments.filter(assignment => assignment.user_id === userId)

  const toggleSiteSelection = (siteId: string) => {
    setSelectedSites(prev => 
      prev.includes(siteId) 
        ? prev.filter(id => id !== siteId)
        : [...prev, siteId]
    )
  }

  const clearSiteSelection = () => {
    setSelectedSites([])
  }

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
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select User
              </label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose user...</option>
                {getNonManagers().map(user => (
                  <option key={user.id} value={user.id}>
                    {user.full_name || user.email} ({user.role.replace('_', ' ')})
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Select Sites ({selectedSites.length} selected)
                </label>
                {selectedSites.length > 0 && (
                  <button
                    onClick={clearSiteSelection}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Clear all
                  </button>
                )}
              </div>
              <div className="border border-gray-300 rounded-lg max-h-48 overflow-y-auto">
                {sites.length === 0 ? (
                  <div className="p-3 text-gray-500 text-sm">No sites available</div>
                ) : (
                  sites.map(site => (
                    <div 
                      key={site.id}
                      className="flex items-center p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                    >
                      <button
                        onClick={() => toggleSiteSelection(site.id)}
                        className="flex items-center gap-3 flex-1 text-left"
                      >
                        {selectedSites.includes(site.id) ? (
                          <CheckSquare className="h-5 w-5 text-blue-600 flex-shrink-0" />
                        ) : (
                          <Square className="h-5 w-5 text-gray-400 flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 truncate">
                            {site.name}
                          </div>
                          {site.location && (
                            <div className="text-sm text-gray-500 truncate">
                              {site.location}
                            </div>
                          )}
                        </div>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
            
            <div className="flex flex-col gap-2">
              <div className="flex-1"></div>
              <button
                onClick={handleAssignUser}
                disabled={!selectedUser || selectedSites.length === 0}
                className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
              >
                Assign to {selectedSites.length} Site{selectedSites.length !== 1 ? 's' : ''}
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
            {getNonManagers().map(user => {
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
                    <div className="flex items-center gap-2">
                      {changingRole === user.id ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                      ) : (
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value as 'installer' | 'project_manager')}
                          className="px-2 py-1 text-xs border border-gray-200 rounded-full bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={changingRole !== null}
                        >
                          <option value="installer">Installer</option>
                          <option value="project_manager">Project Manager</option>
                        </select>
                      )}
                    </div>
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
                  {users.length}
                </p>
                <p className="text-sm text-gray-500">Total Users</p>
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