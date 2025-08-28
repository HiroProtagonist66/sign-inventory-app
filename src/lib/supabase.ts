import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

export type Site = {
  id: string
  name: string
  location?: string
  created_at: string
}

export type ProjectArea = {
  id: string
  site_id: string
  area_name: string
  created_at: string
}

export type ProjectSignCatalog = {
  id: string
  site_id: string
  sign_number: string
  sign_description_id?: string
  side_a_message?: string
  side_b_message?: string
  original_csv_notes?: string
  original_csv_level_no?: string
  original_csv_location_plan?: string
  created_at: string
  // Joined fields from sign_descriptions
  description?: string
  sign_type_code?: string
}

export type InventorySession = {
  id: string
  site_id: string
  user_id?: string
  session_name?: string
  created_at: string
}

export type InventoryLogRecord = {
  id: string
  session_id: string
  site_id: string
  user_id?: string
  inventory_type: 'present' | 'missing' | 'damaged'
  sign_number: string
  sign_description_id?: string
  quantity: number
  notes?: string
  created_at: string
}

export async function getSites() {
  const { data, error } = await supabase
    .from('sites')
    .select('*')
    .order('name')
  
  if (error) throw error
  return data as Site[]
}

export async function getProjectAreas(siteId: string) {
  const { data, error } = await supabase
    .from('project_areas')
    .select('*')
    .eq('site_id', siteId)
    .order('area_name')
  
  if (error) throw error
  
  
  return data as ProjectArea[]
}

export async function getProjectSignCatalog(siteId: string, areaName?: string, sortBy: 'sign_number' | 'sign_type_code' | 'description' = 'sign_number') {
  // Get all signs
  let query = supabase
    .from('project_sign_catalog')
    .select('*')
    .eq('site_id', siteId)
  
  // If area is selected, filter by original_csv_level_no containing the area name
  if (areaName && areaName !== 'ALL') {
    query = query.ilike('original_csv_level_no', `%${areaName}%`)
  }
  
  const { data: signData, error: signError } = await query.order('sign_number')
  
  if (signError) {
    console.error('Supabase error:', signError)
    throw signError
  }
  
  // Fetch ALL sign descriptions first (since the table is small)
  console.log('Attempting to fetch sign_descriptions...')
  const { data: allDescriptions, error: descError } = await supabase
    .from('sign_descriptions')
    .select('*')
  
  if (descError) {
    console.error('Error fetching sign_descriptions:', descError)
    console.error('Error details:', JSON.stringify(descError))
  }
  
  console.log('sign_descriptions query result:', {
    success: !descError,
    rowCount: allDescriptions?.length || 0,
    firstRow: allDescriptions?.[0] || null,
    error: descError
  })
  
  // Create lookup map from ALL descriptions
  const descriptionMap = allDescriptions?.reduce((acc, desc) => {
    acc[desc.id] = desc
    return acc
  }, {} as Record<string, { id: string; sign_type_code: string; description?: string; created_at: string }>) || {}
  
  console.log(`Loaded ${allDescriptions?.length || 0} total sign descriptions`)
  
  // Map signs with their descriptions
  const processedData = signData?.map(sign => {
    const signDesc = descriptionMap[sign.sign_description_id]
    
    if (sign.sign_description_id && !signDesc) {
      console.log(`Missing description for sign ${sign.sign_number}, ID: ${sign.sign_description_id}`)
    }
    
    return {
      ...sign,
      description: signDesc?.description || '',
      sign_type_code: signDesc?.sign_type_code || '',
    }
  })
  
  // Apply client-side sorting
  if (processedData && sortBy !== 'sign_number') {
    processedData.sort((a, b) => {
      if (sortBy === 'description') {
        return (a.description || '').localeCompare(b.description || '')
      } else if (sortBy === 'sign_type_code') {
        return (a.sign_type_code || '').localeCompare(b.sign_type_code || '')
      }
      return 0
    })
  }
  
  const withDescriptions = processedData?.filter(s => s.description).length || 0
  console.log(`${withDescriptions} of ${processedData?.length || 0} signs have descriptions`)
  
  return processedData as ProjectSignCatalog[]
}

export async function createInventorySession(siteId: string, sessionName?: string) {
  const { data: userData, error: authError } = await supabase.auth.getUser()
  
  // If there's no authenticated user, pass null for user_id
  const userId = userData?.user?.id || null
  
  const { data, error } = await supabase
    .from('inventory_sessions')
    .insert({
      site_id: siteId,
      session_name: sessionName || `Session ${new Date().toISOString()}`,
      user_id: userId
    })
    .select()
    .single()
  
  if (error) {
    console.error('Error creating inventory session:', error)
    console.error('Error details:', JSON.stringify(error))
    throw new Error(`Failed to create inventory session: ${error.message || 'Unknown error'}`)
  }
  return data as InventorySession
}

export async function createInventoryLogRecords(records: Omit<InventoryLogRecord, 'id' | 'created_at'>[]) {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData?.user?.id || null
  
  const recordsWithUser = records.map(record => ({
    ...record,
    user_id: userId
  }))
  
  const { data, error } = await supabase
    .from('inventory_log')
    .insert(recordsWithUser)
    .select()
  
  if (error) {
    console.error('Error creating inventory log records:', error)
    console.error('Error details:', JSON.stringify(error))
    throw new Error(`Failed to create inventory log records: ${error.message || 'Unknown error'}`)
  }
  return data as InventoryLogRecord[]
}

// User Profiles and Roles
export interface UserProfile {
  id: string
  email: string
  full_name: string | null
  role: 'manager' | 'installer'
  created_at: string
  updated_at: string
}

export interface UserSiteAssignment {
  id: string
  user_id: string
  site_id: string
  assigned_by: string
  assigned_at: string
  user_profiles?: UserProfile
  sites?: Site
}

export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData?.user) return null

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userData.user.id)
    .single()

  if (error) {
    console.error('Error fetching user profile:', error)
    return null
  }
  return data as UserProfile
}

export async function getAllUsers(): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .order('created_at')

  if (error) {
    console.error('Error fetching users:', error)
    throw new Error(`Failed to fetch users: ${error.message}`)
  }
  return data as UserProfile[]
}

export async function updateUserRole(userId: string, role: 'manager' | 'installer'): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (error) {
    console.error('Error updating user role:', error)
    throw new Error(`Failed to update user role: ${error.message}`)
  }
}

export async function assignUserToSite(userId: string, siteId: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser()
  const assignedBy = userData?.user?.id

  if (!assignedBy) {
    throw new Error('Must be logged in to assign users')
  }

  const { error } = await supabase
    .from('user_site_assignments')
    .insert({
      user_id: userId,
      site_id: siteId,
      assigned_by: assignedBy
    })

  if (error) {
    console.error('Error assigning user to site:', error)
    throw new Error(`Failed to assign user to site: ${error.message}`)
  }
}

export async function removeUserFromSite(userId: string, siteId: string): Promise<void> {
  const { error } = await supabase
    .from('user_site_assignments')
    .delete()
    .eq('user_id', userId)
    .eq('site_id', siteId)

  if (error) {
    console.error('Error removing user from site:', error)
    throw new Error(`Failed to remove user from site: ${error.message}`)
  }
}

export async function getUserSiteAssignments(userId?: string): Promise<UserSiteAssignment[]> {
  let query = supabase
    .from('user_site_assignments')
    .select('*')

  if (userId) {
    query = query.eq('user_id', userId)
  }

  const { data: assignments, error } = await query.order('assigned_at', { ascending: false })

  if (error) {
    console.error('Error fetching user site assignments:', error)
    throw new Error(`Failed to fetch assignments: ${error.message}`)
  }
  
  if (!assignments || assignments.length === 0) {
    return []
  }

  // Fetch all related users and sites
  const userIds = [...new Set(assignments.map(a => a.user_id))]
  const siteIds = [...new Set(assignments.map(a => a.site_id))]

  const [usersResult, sitesResult] = await Promise.all([
    supabase.from('user_profiles').select('*').in('id', userIds),
    supabase.from('sites').select('*').in('id', siteIds)
  ])

  const usersMap = new Map(usersResult.data?.map(u => [u.id, u]) || [])
  const sitesMap = new Map(sitesResult.data?.map(s => [s.id, s]) || [])

  // Combine the data
  return assignments.map(assignment => ({
    ...assignment,
    user_profiles: usersMap.get(assignment.user_id),
    sites: sitesMap.get(assignment.site_id)
  })) as UserSiteAssignment[]
}

export async function getAssignedSites(): Promise<Site[]> {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData?.user) return []

  // Get user profile to check role
  const userProfile = await getCurrentUserProfile()
  if (!userProfile) return []

  // If user is manager, return all sites
  if (userProfile.role === 'manager') {
    return getSites()
  }

  // If installer, get assigned site IDs first, then fetch site details
  const { data: assignments, error: assignmentError } = await supabase
    .from('user_site_assignments')
    .select('site_id')
    .eq('user_id', userData.user.id)

  if (assignmentError) {
    console.error('Error fetching user assignments:', assignmentError)
    throw new Error(`Failed to fetch assignments: ${assignmentError.message}`)
  }

  if (!assignments || assignments.length === 0) {
    return []
  }

  // Get the actual site details
  const siteIds = assignments.map(a => a.site_id)
  const { data: sites, error: sitesError } = await supabase
    .from('sites')
    .select('*')
    .in('id', siteIds)

  if (sitesError) {
    console.error('Error fetching assigned sites:', sitesError)
    throw new Error(`Failed to fetch assigned sites: ${sitesError.message}`)
  }

  return sites || []
}