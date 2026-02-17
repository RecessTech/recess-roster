import { createClient } from '@supabase/supabase-js';

// Replace these with your actual Supabase credentials
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database helper functions
export const db = {
  // Staff operations
  async getStaff(userId) {
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Transform snake_case to camelCase
    return (data || []).map(staff => ({
      id: staff.id,
      name: staff.name,
      hourlyRate: staff.hourly_rate,
      weekendRate: staff.weekend_rate,
      employmentType: staff.employment_type,
      active: staff.active !== false // Default to true for existing records without the field
    }));
  },

  async createStaff(userId, staffData) {
    const { data, error } = await supabase
      .from('staff')
      .insert([{ ...staffData, user_id: userId }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateStaff(staffId, staffData) {
    const { data, error } = await supabase
      .from('staff')
      .update(staffData)
      .eq('id', staffId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async deleteStaff(staffId) {
    // Soft-delete: mark as inactive instead of removing
    const { error } = await supabase
      .from('staff')
      .update({ active: false })
      .eq('id', staffId);

    if (error) throw error;
  },

  async restoreStaff(staffId) {
    const { error } = await supabase
      .from('staff')
      .update({ active: true })
      .eq('id', staffId);

    if (error) throw error;
  },

  // Schedule operations
  async getSchedules(userId) {
    console.log('📥 Loading schedules...');

    // Supabase has 1000 row default limit - must paginate
    // CRITICAL: .order() is required for consistent pagination with .range()
    // Without it, rows can shift between pages and be skipped or duplicated
    let allData = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .eq('user_id', userId)
        .order('date_key', { ascending: true })
        .order('staff_id', { ascending: true })
        .order('time_slot', { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) throw error;

      if (data && data.length > 0) {
        allData = allData.concat(data);
        console.log(`📥 Loaded page ${page + 1}: ${data.length} slots (total: ${allData.length})`);
        hasMore = data.length === pageSize;
        page++;
      } else {
        hasMore = false;
      }
    }

    console.log(`✅ Loaded all ${allData.length} schedule slots`);

    // Convert to the format the app expects
    const scheduleObj = {};
    allData.forEach(item => {
      const key = `${item.date_key}|${item.staff_id}|${item.time_slot}`;
      scheduleObj[key] = {
        roleId: item.role_id,
        roleCode: item.role_code,
        roleColor: item.role_color
      };
    });

    return scheduleObj;
  },

  async saveSchedules(userId, scheduleObj) {
    // CRITICAL SAFETY CHECK: Prevent saving empty schedules
    const scheduleArray = Object.entries(scheduleObj).map(([key, value]) => {
      const [dateKey, staffId, timeSlot] = key.split('|');
      return {
        user_id: userId,
        date_key: dateKey,
        staff_id: staffId,
        time_slot: timeSlot,
        role_id: value.roleId,
        role_code: value.roleCode,
        role_color: value.roleColor
      };
    });

    if (scheduleArray.length === 0) {
      console.warn('⚠️ Attempted to save empty schedule - skipping');
      return;
    }

    console.log(`💾 Saving ${scheduleArray.length} schedule slots...`);

    // Get ALL existing schedule keys (paginated with deterministic ordering)
    let existing = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data } = await supabase
        .from('schedules')
        .select('date_key, staff_id, time_slot')
        .eq('user_id', userId)
        .order('date_key', { ascending: true })
        .order('staff_id', { ascending: true })
        .order('time_slot', { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (data && data.length > 0) {
        existing = existing.concat(data);
        hasMore = data.length === pageSize;
        page++;
      } else {
        hasMore = false;
      }
    }

    console.log(`📋 Found ${existing.length} existing slots`);

    // Build set of keys we're keeping
    const newKeys = new Set(
      scheduleArray.map(s => `${s.date_key}|${s.staff_id}|${s.time_slot}`)
    );

    // Find keys to delete (exist in DB but not in new schedule)
    const toDelete = existing.filter(row => {
      const key = `${row.date_key}|${row.staff_id}|${row.time_slot}`;
      return !newKeys.has(key);
    });

    // Batch delete using OR filters (not one-by-one)
    if (toDelete.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < toDelete.length; i += batchSize) {
        const batch = toDelete.slice(i, i + batchSize);
        const conditions = batch.map(row =>
          `and(date_key.eq.${row.date_key},staff_id.eq.${row.staff_id},time_slot.eq.${row.time_slot})`
        );

        const { error } = await supabase
          .from('schedules')
          .delete()
          .eq('user_id', userId)
          .or(conditions.join(','));

        if (error) {
          console.error('❌ Batch delete error:', error);
          throw error;
        }
      }
      console.log(`🗑️ Deleted ${toDelete.length} removed slots`);
    }

    // Batch upserts
    const batchSize = 500;
    let totalUpserted = 0;

    for (let i = 0; i < scheduleArray.length; i += batchSize) {
      const batch = scheduleArray.slice(i, i + batchSize);

      const { error: upsertError } = await supabase
        .from('schedules')
        .upsert(batch, {
          onConflict: 'user_id,date_key,staff_id,time_slot'
        });

      if (upsertError) {
        console.error(`❌ Batch ${Math.floor(i / batchSize) + 1} error:`, upsertError);
        throw upsertError;
      }

      totalUpserted += batch.length;
      console.log(`✅ Batch ${Math.floor(i / batchSize) + 1}: ${batch.length} slots (${totalUpserted}/${scheduleArray.length})`);
    }

    console.log(`✅ Successfully saved all ${scheduleArray.length} slots`);
  },

  // Delta-based save: only upsert/delete what actually changed
  async saveSchedulesDelta(userId, newSchedule, previousSchedule) {
    const toUpsert = [];
    const toDeleteKeys = [];

    // Find added or changed entries
    for (const [key, value] of Object.entries(newSchedule)) {
      const prev = previousSchedule[key];
      if (!prev || prev.roleId !== value.roleId || prev.roleCode !== value.roleCode || prev.roleColor !== value.roleColor) {
        const [dateKey, staffId, timeSlot] = key.split('|');
        toUpsert.push({
          user_id: userId,
          date_key: dateKey,
          staff_id: staffId,
          time_slot: timeSlot,
          role_id: value.roleId,
          role_code: value.roleCode,
          role_color: value.roleColor
        });
      }
    }

    // Find deleted entries
    for (const key of Object.keys(previousSchedule)) {
      if (!newSchedule[key]) {
        toDeleteKeys.push(key);
      }
    }

    if (toUpsert.length === 0 && toDeleteKeys.length === 0) {
      console.log('💤 No changes to save');
      return;
    }

    console.log(`💾 Delta save: ${toUpsert.length} upserts, ${toDeleteKeys.length} deletes`);

    // Batch delete using OR filters (much faster than one-by-one)
    if (toDeleteKeys.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < toDeleteKeys.length; i += batchSize) {
        const batch = toDeleteKeys.slice(i, i + batchSize);
        // Build composite key filter for batch deletion
        const conditions = batch.map(key => {
          const [dateKey, staffId, timeSlot] = key.split('|');
          return `and(date_key.eq.${dateKey},staff_id.eq.${staffId},time_slot.eq.${timeSlot})`;
        });

        const { error } = await supabase
          .from('schedules')
          .delete()
          .eq('user_id', userId)
          .or(conditions.join(','));

        if (error) {
          console.error('❌ Batch delete error:', error);
          throw error;
        }
      }
      console.log(`🗑️ Deleted ${toDeleteKeys.length} removed slots`);
    }

    // Batch upsert
    if (toUpsert.length > 0) {
      const batchSize = 500;
      for (let i = 0; i < toUpsert.length; i += batchSize) {
        const batch = toUpsert.slice(i, i + batchSize);
        const { error } = await supabase
          .from('schedules')
          .upsert(batch, { onConflict: 'user_id,date_key,staff_id,time_slot' });

        if (error) {
          console.error('❌ Batch upsert error:', error);
          throw error;
        }
      }
      console.log(`✅ Upserted ${toUpsert.length} slots`);
    }
  },

  // Settings operations
  async getSettings(userId) {
    const { data, error } = await supabase
      .from('business_settings')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
    return data;
  },

  async saveSettings(userId, settings) {
    // Check if settings exist
    const existing = await this.getSettings(userId);
    
    if (existing) {
      // Update
      const { data, error } = await supabase
        .from('business_settings')
        .update({
          ...settings,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } else {
      // Insert
      const { data, error } = await supabase
        .from('business_settings')
        .insert([{ ...settings, user_id: userId }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    }
  },

  // Staff order operations
  async getStaffOrder(userId) {
    const { data, error } = await supabase
      .from('staff_order')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data?.staff_ids || [];
  },

  async saveStaffOrder(userId, staffIds) {
    const existing = await supabase
      .from('staff_order')
      .select('id')
      .eq('user_id', userId)
      .single();
    
    if (existing.data) {
      // Update
      const { error } = await supabase
        .from('staff_order')
        .update({
          staff_ids: staffIds,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);
      
      if (error) throw error;
    } else {
      // Insert
      const { error } = await supabase
        .from('staff_order')
        .insert([{
          user_id: userId,
          staff_ids: staffIds
        }]);
      
      if (error) throw error;
    }
  },

  // Shift Template operations
  async getTemplates(userId) {
    const { data, error } = await supabase
      .from('shift_templates')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    
    // Convert to the format the app expects
    return (data || []).map(template => ({
      id: template.id,
      name: template.name,
      roleId: template.role_id,
      roleCode: template.role_code,
      roleColor: template.role_color,
      startTime: template.start_time,
      endTime: template.end_time
    }));
  },

  async saveTemplate(userId, template) {
    const { data, error } = await supabase
      .from('shift_templates')
      .insert([{
        id: template.id,
        user_id: userId,
        name: template.name,
        role_id: template.roleId,
        role_code: template.roleCode,
        role_color: template.roleColor,
        start_time: template.startTime,
        end_time: template.endTime
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async deleteTemplate(templateId) {
    const { error } = await supabase
      .from('shift_templates')
      .delete()
      .eq('id', templateId);
    
    if (error) throw error;
  },

  // Revenue tracking operations
  async getRevenue(userId, startDate, endDate) {
    const { data, error } = await supabase
      .from('daily_revenue')
      .select('*')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });
    
    if (error) throw error;
    
    // Convert to object keyed by date
    const revenueByDate = {};
    (data || []).forEach(row => {
      revenueByDate[row.date] = {
        projectedRevenue: row.projected_revenue || 0,
        otherRevenue: row.other_revenue || 0,
        notes: row.notes || ''
      };
    });
    
    return revenueByDate;
  },

  async saveRevenue(userId, date, revenueData) {
    // Check if entry exists
    const { data: existing } = await supabase
      .from('daily_revenue')
      .select('id')
      .eq('user_id', userId)
      .eq('date', date)
      .single();
    
    if (existing) {
      // Update
      const { error } = await supabase
        .from('daily_revenue')
        .update({
          projected_revenue: revenueData.projectedRevenue,
          other_revenue: revenueData.otherRevenue,
          notes: revenueData.notes,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('date', date);
      
      if (error) throw error;
    } else {
      // Insert
      const { error } = await supabase
        .from('daily_revenue')
        .insert([{
          user_id: userId,
          date: date,
          projected_revenue: revenueData.projectedRevenue,
          other_revenue: revenueData.otherRevenue,
          notes: revenueData.notes
        }]);
      
      if (error) throw error;
    }
  },

  async deleteRevenue(userId, date) {
    const { error } = await supabase
      .from('daily_revenue')
      .delete()
      .eq('user_id', userId)
      .eq('date', date);
    
    if (error) throw error;
  },

  // User profile operations
  async getUserProfile(userId) {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  // Availability operations
  async getAvailability(staffId, startDate, endDate) {
    const { data, error } = await supabase
      .from('staff_availability')
      .select('*')
      .eq('staff_id', staffId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });
    
    if (error) throw error;
    return data || [];
  },

  async setAvailability(staffId, date, status, startTime = null, endTime = null, notes = null) {
    const { error } = await supabase
      .from('staff_availability')
      .upsert({
        staff_id: staffId,
        date: date,
        status: status,
        start_time: startTime,
        end_time: endTime,
        notes: notes
      }, {
        onConflict: 'staff_id,date'
      });

    if (error) throw error;
  },

  // ── Packaging Items ─────────────────────────────────────────────────────────

  async getPackagingItems(userId) {
    const { data, error } = await supabase
      .from('packaging_items')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []).map(row => ({
      id: row.id,
      name: row.name,
      sku_code: row.sku_code || '',
      unit: row.unit || 'units',
      reorder_level: row.reorder_level || 0,
      reorder_qty: row.reorder_qty || 0,
      notes: row.notes || '',
      color: row.color || '#6366f1',
      sort_order: row.sort_order || 0,
    }));
  },

  async createPackagingItem(userId, item) {
    const { data, error } = await supabase
      .from('packaging_items')
      .insert([{ ...item, user_id: userId }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updatePackagingItem(itemId, item) {
    const { data, error } = await supabase
      .from('packaging_items')
      .update({ ...item, updated_at: new Date().toISOString() })
      .eq('id', itemId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deletePackagingItem(itemId) {
    const { error } = await supabase
      .from('packaging_items')
      .delete()
      .eq('id', itemId);
    if (error) throw error;
  },

  // ── Packaging Inventory Events (stocktakes + inbound deliveries) ────────────

  async getInventoryEvents(userId) {
    const { data, error } = await supabase
      .from('packaging_inventory')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(row => ({
      id: row.id,
      packaging_item_id: row.packaging_item_id,
      type: row.type,
      date: row.date,
      quantity: row.quantity,
      notes: row.notes || '',
      supplier: row.supplier || '',
      created_at: row.created_at,
    }));
  },

  async addInventoryEvent(userId, event) {
    const { data, error } = await supabase
      .from('packaging_inventory')
      .insert([{ ...event, user_id: userId }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteInventoryEvent(eventId) {
    const { error } = await supabase
      .from('packaging_inventory')
      .delete()
      .eq('id', eventId);
    if (error) throw error;
  },
};
