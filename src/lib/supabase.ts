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