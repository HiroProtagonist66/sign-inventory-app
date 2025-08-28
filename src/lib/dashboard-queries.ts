import { supabase } from './supabase'
import { format } from 'date-fns'

export interface DashboardFilters {
  startDate: Date
  endDate: Date
  siteId?: string
  areaId?: string
}

export interface DashboardSummary {
  totalSigns: number
  signsInventoried: number
  presentSigns: number
  missingSigns: number
  damagedSigns: number
  completionRate: number
}

export interface DailyActivity {
  date: string
  sessions: number
  signsChecked: number
}

export interface SitePerformance {
  site: string
  siteId: string
  totalSigns: number
  inventoried: number
  remaining: number
  completionRate: number
}

export interface RecentSession {
  id: string
  created_at: string
  site_name: string
  area_name: string | null
  user_name: string
  sign_count: number
}

export interface DashboardData {
  summary: DashboardSummary
  dailyActivity: DailyActivity[]
  sitePerformance: SitePerformance[]
  recentSessions: RecentSession[]
  sites: { id: string; name: string }[]
}

export async function getDashboardData(filters: DashboardFilters): Promise<DashboardData> {
  try {
    // Get all sites for filter dropdown
    const { data: sites } = await supabase
      .from('sites')
      .select('id, name')
      .order('name')

    // First get relevant sessions based on filters
    let sessionsQuery = supabase
      .from('inventory_sessions')
      .select('*')
      .gte('created_at', filters.startDate.toISOString())
      .lte('created_at', filters.endDate.toISOString())

    if (filters.siteId) {
      sessionsQuery = sessionsQuery.eq('site_id', filters.siteId)
    }
    if (filters.areaId) {
      sessionsQuery = sessionsQuery.eq('area_id', filters.areaId)
    }

    const { data: sessions } = await sessionsQuery

    // Get inventory logs for these sessions
    const sessionIds = sessions?.map(s => s.id) || []
    interface InventoryLog {
      id: string
      session_id: string
      sign_id: string
      status: 'present' | 'missing' | 'damaged'
      user_id: string
      created_at: string
    }
    let inventoryLogs: InventoryLog[] = []
    
    if (sessionIds.length > 0) {
      const { data } = await supabase
        .from('inventory_log')
        .select('*')
        .in('session_id', sessionIds)
      
      inventoryLogs = data || []
    }

    // Get total signs count
    let catalogQuery = supabase
      .from('project_sign_catalog')
      .select('id', { count: 'exact' })

    if (filters.siteId) {
      catalogQuery = catalogQuery.eq('site_id', filters.siteId)
    }
    if (filters.areaId) {
      catalogQuery = catalogQuery.eq('area_id', filters.areaId)
    }

    const { count: totalSigns } = await catalogQuery

    // Calculate summary statistics
    const signsInventoried = inventoryLogs.length
    const presentSigns = inventoryLogs.filter(log => log.status === 'present').length
    const missingSigns = inventoryLogs.filter(log => log.status === 'missing').length
    const damagedSigns = inventoryLogs.filter(log => log.status === 'damaged').length
    const completionRate = totalSigns ? Math.round((signsInventoried / totalSigns) * 100) : 0

    const summary: DashboardSummary = {
      totalSigns: totalSigns || 0,
      signsInventoried,
      presentSigns,
      missingSigns,
      damagedSigns,
      completionRate
    }

    // Calculate daily activity
    const dailyActivityMap = new Map<string, { sessions: Set<string>; signs: number }>()
    
    sessions?.forEach(session => {
      const date = format(new Date(session.created_at), 'yyyy-MM-dd')
      const existing = dailyActivityMap.get(date) || { sessions: new Set(), signs: 0 }
      existing.sessions.add(session.id)
      
      // Count signs for this session
      const sessionSigns = inventoryLogs.filter(log => log.session_id === session.id).length
      existing.signs += sessionSigns
      
      dailyActivityMap.set(date, existing)
    })

    const dailyActivity: DailyActivity[] = Array.from(dailyActivityMap.entries())
      .map(([date, data]) => ({
        date,
        sessions: data.sessions.size,
        signsChecked: data.signs
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // Calculate site performance
    const { data: allSites } = await supabase
      .from('sites')
      .select('id, name')

    const sitePerformance: SitePerformance[] = await Promise.all(
      (allSites || []).map(async site => {
        const { count: totalSignsForSite } = await supabase
          .from('project_sign_catalog')
          .select('id', { count: 'exact' })
          .eq('site_id', site.id)

        // Get sessions for this site in date range
        const siteSessions = sessions?.filter(s => s.site_id === site.id) || []
        const siteSessionIds = siteSessions.map(s => s.id)
        const inventoriedForSite = inventoryLogs.filter(log => 
          siteSessionIds.includes(log.session_id)
        ).length

        return {
          site: site.name,
          siteId: site.id,
          totalSigns: totalSignsForSite || 0,
          inventoried: inventoriedForSite,
          remaining: (totalSignsForSite || 0) - inventoriedForSite,
          completionRate: totalSignsForSite ? 
            Math.round((inventoriedForSite / totalSignsForSite) * 100) : 0
        }
      })
    )

    // Get related data for recent sessions
    const recentSessionsData = await Promise.all(
      sessions?.slice(0, 10).map(async session => {
        const [siteData, areaData, userData] = await Promise.all([
          supabase.from('sites').select('name').eq('id', session.site_id).single(),
          session.area_id ? 
            supabase.from('project_areas').select('name').eq('id', session.area_id).single() : 
            Promise.resolve({ data: null }),
          supabase.from('user_profiles').select('email, full_name').eq('id', session.user_id).single()
        ])

        const signCount = inventoryLogs.filter(log => log.session_id === session.id).length

        return {
          id: session.id,
          created_at: session.created_at,
          site_name: siteData.data?.name || 'Unknown',
          area_name: areaData.data?.name || null,
          user_name: userData.data?.full_name || userData.data?.email || 'Unknown',
          sign_count: signCount
        }
      }) || []
    )

    return {
      summary,
      dailyActivity,
      sitePerformance,
      recentSessions: recentSessionsData.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
      sites: sites || []
    }
  } catch (error) {
    console.error('Error fetching dashboard data:', error)
    throw error
  }
}

export async function getSignDetails(signId: string) {
  try {
    // Get sign details
    const { data: sign, error: signError } = await supabase
      .from('project_sign_catalog')
      .select('*')
      .eq('id', signId)
      .single()

    if (signError) throw signError

    // Get related data separately
    const [descData, siteData, areaData, logsData] = await Promise.all([
      sign.sign_type_id ? 
        supabase.from('sign_descriptions').select('*').eq('id', sign.sign_type_id).single() :
        Promise.resolve({ data: null }),
      supabase.from('sites').select('name').eq('id', sign.site_id).single(),
      sign.area_id ?
        supabase.from('project_areas').select('name').eq('id', sign.area_id).single() :
        Promise.resolve({ data: null }),
      supabase.from('inventory_log').select('*').eq('sign_id', signId)
    ])

    // Get user details for each log
    const logsWithUsers = await Promise.all(
      (logsData.data || []).map(async log => {
        const { data: userData } = await supabase
          .from('user_profiles')
          .select('email, full_name')
          .eq('id', log.user_id)
          .single()
        
        return {
          ...log,
          user_profiles: userData
        }
      })
    )

    return {
      ...sign,
      sign_descriptions: descData.data,
      sites: siteData.data,
      project_areas: areaData.data,
      inventory_log: logsWithUsers
    }
  } catch (error) {
    console.error('Error fetching sign details:', error)
    throw error
  }
}