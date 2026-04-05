import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database helper functions
export const db = {

  // ── Org / onboarding ─────────────────────────────────────────────────────────

  // Returns the org record for this user, or null if they have none yet.
  async getOrgForUser(userId) {
    const { data, error } = await supabase
      .from('org_members')
      .select('org_id, organisations(id, name, timezone, config, plan, plan_staff_limit, trial_ends_at, stripe_customer_id, stripe_subscription_id)')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;
    return data.organisations;
  },

  // Update fields on the org record (e.g. config jsonb).
  async updateOrg(orgId, updates) {
    const { data, error } = await supabase
      .from('organisations')
      .update(updates)
      .eq('id', orgId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Create a new org and make this user its owner. Returns the new org record.
  async createOrg(userId, orgName) {
    const { data, error } = await supabase.rpc('create_org_for_user', { org_name: orgName });
    if (error) throw error;
    return data;
  },

  // ── Staff ────────────────────────────────────────────────────────────────────

  async getStaff(orgId) {
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return (data || []).map(staff => ({
      id: staff.id,
      name: staff.name,
      email: staff.email || '',
      publicToken: staff.public_token || null,
      hourlyRate: staff.hourly_rate,
      weekendRate: staff.weekend_rate,
      employmentType: staff.employment_type,
      active: staff.active !== false
    }));
  },

  async createStaff(orgId, userId, staffData) {
    const { data, error } = await supabase
      .from('staff')
      .insert([{ ...staffData, org_id: orgId, user_id: userId }])
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

  // ── Schedules ────────────────────────────────────────────────────────────────

  async getSchedules(orgId) {
    console.log('📥 Loading schedules...');

    let allData = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .eq('org_id', orgId)
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

  async saveSchedules(orgId, userId, scheduleObj) {
    const scheduleArray = Object.entries(scheduleObj).map(([key, value]) => {
      const [dateKey, staffId, timeSlot] = key.split('|');
      return {
        org_id: orgId,
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

    let existing = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data } = await supabase
        .from('schedules')
        .select('date_key, staff_id, time_slot')
        .eq('org_id', orgId)
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

    const newKeys = new Set(
      scheduleArray.map(s => `${s.date_key}|${s.staff_id}|${s.time_slot}`)
    );

    const toDelete = existing.filter(row => {
      const key = `${row.date_key}|${row.staff_id}|${row.time_slot}`;
      return !newKeys.has(key);
    });

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
          .eq('org_id', orgId)
          .or(conditions.join(','));

        if (error) {
          console.error('❌ Batch delete error:', error);
          throw error;
        }
      }
      console.log(`🗑️ Deleted ${toDelete.length} removed slots`);
    }

    const batchSize = 500;
    let totalUpserted = 0;

    for (let i = 0; i < scheduleArray.length; i += batchSize) {
      const batch = scheduleArray.slice(i, i + batchSize);

      const { error: upsertError } = await supabase
        .from('schedules')
        .upsert(batch, {
          onConflict: 'org_id,date_key,staff_id,time_slot'
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

  async saveSchedulesDelta(orgId, userId, newSchedule, previousSchedule) {
    const toUpsert = [];
    const toDeleteKeys = [];

    for (const [key, value] of Object.entries(newSchedule)) {
      const prev = previousSchedule[key];
      if (!prev || prev.roleId !== value.roleId || prev.roleCode !== value.roleCode || prev.roleColor !== value.roleColor) {
        const [dateKey, staffId, timeSlot] = key.split('|');
        toUpsert.push({
          org_id: orgId,
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

    if (toDeleteKeys.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < toDeleteKeys.length; i += batchSize) {
        const batch = toDeleteKeys.slice(i, i + batchSize);
        const conditions = batch.map(key => {
          const [dateKey, staffId, timeSlot] = key.split('|');
          return `and(date_key.eq.${dateKey},staff_id.eq.${staffId},time_slot.eq.${timeSlot})`;
        });

        const { error } = await supabase
          .from('schedules')
          .delete()
          .eq('org_id', orgId)
          .or(conditions.join(','));

        if (error) {
          console.error('❌ Batch delete error:', error);
          throw error;
        }
      }
      console.log(`🗑️ Deleted ${toDeleteKeys.length} removed slots`);
    }

    if (toUpsert.length > 0) {
      const batchSize = 500;
      for (let i = 0; i < toUpsert.length; i += batchSize) {
        const batch = toUpsert.slice(i, i + batchSize);
        const { error } = await supabase
          .from('schedules')
          .upsert(batch, { onConflict: 'org_id,date_key,staff_id,time_slot' });

        if (error) {
          console.error('❌ Batch upsert error:', error);
          throw error;
        }
      }
      console.log(`✅ Upserted ${toUpsert.length} slots`);
    }
  },

  // ── Settings ─────────────────────────────────────────────────────────────────

  async getSettings(orgId) {
    const { data, error } = await supabase
      .from('business_settings')
      .select('*')
      .eq('org_id', orgId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async saveSettings(orgId, userId, settings) {
    const existing = await this.getSettings(orgId);

    if (existing) {
      const { data, error } = await supabase
        .from('business_settings')
        .update({ ...settings, updated_at: new Date().toISOString() })
        .eq('org_id', orgId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase
        .from('business_settings')
        .insert([{ ...settings, org_id: orgId, user_id: userId }])
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  },

  // ── Staff order ───────────────────────────────────────────────────────────────

  async getStaffOrder(orgId) {
    const { data, error } = await supabase
      .from('staff_order')
      .select('*')
      .eq('org_id', orgId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data?.staff_ids || [];
  },

  async saveStaffOrder(orgId, userId, staffIds) {
    const existing = await supabase
      .from('staff_order')
      .select('id')
      .eq('org_id', orgId)
      .single();

    if (existing.data) {
      const { error } = await supabase
        .from('staff_order')
        .update({ staff_ids: staffIds, updated_at: new Date().toISOString() })
        .eq('org_id', orgId);

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('staff_order')
        .insert([{ org_id: orgId, user_id: userId, staff_ids: staffIds }]);

      if (error) throw error;
    }
  },

  // ── Shift templates ───────────────────────────────────────────────────────────

  async getTemplates(orgId) {
    const { data, error } = await supabase
      .from('shift_templates')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true });

    if (error) throw error;

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

  async saveTemplate(orgId, userId, template) {
    const { data, error } = await supabase
      .from('shift_templates')
      .insert([{
        id: template.id,
        org_id: orgId,
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

  // ── Revenue ───────────────────────────────────────────────────────────────────

  async getRevenue(orgId, startDate, endDate) {
    const { data, error } = await supabase
      .from('daily_revenue')
      .select('*')
      .eq('org_id', orgId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (error) throw error;

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

  async saveRevenue(orgId, userId, date, revenueData) {
    const { data: existing } = await supabase
      .from('daily_revenue')
      .select('id')
      .eq('org_id', orgId)
      .eq('date', date)
      .single();

    if (existing) {
      const { error } = await supabase
        .from('daily_revenue')
        .update({
          projected_revenue: revenueData.projectedRevenue,
          other_revenue: revenueData.otherRevenue,
          notes: revenueData.notes,
          updated_at: new Date().toISOString()
        })
        .eq('org_id', orgId)
        .eq('date', date);

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('daily_revenue')
        .insert([{
          org_id: orgId,
          user_id: userId,
          date: date,
          projected_revenue: revenueData.projectedRevenue,
          other_revenue: revenueData.otherRevenue,
          notes: revenueData.notes
        }]);

      if (error) throw error;
    }
  },

  async deleteRevenue(orgId, date) {
    const { error } = await supabase
      .from('daily_revenue')
      .delete()
      .eq('org_id', orgId)
      .eq('date', date);

    if (error) throw error;
  },

  // ── User profile ──────────────────────────────────────────────────────────────

  async getUserProfile(userId) {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  // ── Availability ──────────────────────────────────────────────────────────────

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

  async setAvailability(orgId, staffId, date, status, startTime = null, endTime = null, notes = null) {
    const { error } = await supabase
      .from('staff_availability')
      .upsert({
        org_id: orgId,
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

  // ── Packaging Items ───────────────────────────────────────────────────────────

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

  // ── Packaging Inventory ───────────────────────────────────────────────────────

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

  // ── Published weeks ───────────────────────────────────────────────────────────

  async getPublishedWeeks(orgId) {
    const { data, error } = await supabase
      .from('published_weeks')
      .select('week_start')
      .eq('org_id', orgId);
    if (error) throw error;
    return (data || []).map(r => r.week_start); // array of 'YYYY-MM-DD' strings
  },

  async publishWeek(orgId, userId, weekStart) {
    const { error } = await supabase
      .from('published_weeks')
      .upsert({ org_id: orgId, week_start: weekStart, published_by: userId, published_at: new Date().toISOString() }, { onConflict: 'org_id,week_start' });
    if (error) throw error;
  },

  // ── Shift swap requests ───────────────────────────────────────────────────────

  async getSwapRequests(orgId, startDate, endDate) {
    const { data, error } = await supabase
      .from('shift_swap_requests')
      .select('date_key, staff_id, time_slot, status')
      .eq('org_id', orgId)
      .eq('status', 'open')
      .gte('date_key', startDate)
      .lte('date_key', endDate);
    if (error) throw error;
    return data || [];
  },

  async createSwapRequest(orgId, dateKey, staffId, timeSlot) {
    const { error } = await supabase
      .from('shift_swap_requests')
      .upsert({ org_id: orgId, date_key: dateKey, staff_id: staffId, time_slot: timeSlot, status: 'open' },
        { onConflict: 'org_id,date_key,staff_id,time_slot', ignoreDuplicates: false });
    if (error) throw error;
  },

  async resolveSwapRequest(orgId, dateKey, staffId) {
    const { error } = await supabase
      .from('shift_swap_requests')
      .update({ status: 'filled' })
      .eq('org_id', orgId)
      .eq('date_key', dateKey)
      .eq('staff_id', staffId)
      .eq('status', 'open');
    if (error) throw error;
  },

  async cancelSwapRequest(orgId, dateKey, staffId) {
    const { error } = await supabase
      .from('shift_swap_requests')
      .delete()
      .eq('org_id', orgId)
      .eq('date_key', dateKey)
      .eq('staff_id', staffId);
    if (error) throw error;
  },

  async unpublishWeek(orgId, weekStart) {
    const { error } = await supabase
      .from('published_weeks')
      .delete()
      .eq('org_id', orgId)
      .eq('week_start', weekStart);
    if (error) throw error;
  },

  // ── Ordering: Distributors ────────────────────────────────────────────────────

  async getOrderingDistributors(userId) {
    const { data, error } = await supabase
      .from('ordering_distributors')
      .select('*')
      .eq('user_id', userId)
      .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async createOrderingDistributor(userId, name) {
    const { data, error } = await supabase
      .from('ordering_distributors')
      .insert([{ user_id: userId, name }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteOrderingDistributor(distributorId) {
    const { error } = await supabase
      .from('ordering_distributors')
      .delete()
      .eq('id', distributorId);
    if (error) throw error;
  },

  // ── Ordering: Items ───────────────────────────────────────────────────────────

  async getOrderingItems(userId) {
    const { data, error } = await supabase
      .from('ordering_items')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data || []).map(row => ({
      id:                row.id,
      sku:               row.sku,
      default_qty:       row.default_qty,
      uom:               row.uom,
      distributor_id:    row.distributor_id,
      sort_order:        row.sort_order,
      current_status:    row.current_status || 'in_stock',
      current_qty:       row.current_qty,
      status_updated_at: row.status_updated_at,
      created_at:        row.created_at,
    }));
  },

  async createOrderingItem(userId, item) {
    const { data, error } = await supabase
      .from('ordering_items')
      .insert([{ ...item, user_id: userId }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async bulkCreateOrderingItems(userId, items) {
    const rows = items.map(item => ({ ...item, user_id: userId }));
    const { error } = await supabase
      .from('ordering_items')
      .insert(rows);
    if (error) throw error;
  },

  async updateOrderingItem(itemId, updates) {
    const { data, error } = await supabase
      .from('ordering_items')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', itemId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateOrderingItemStatus(itemId, status) {
    const { error } = await supabase
      .from('ordering_items')
      .update({ current_status: status, status_updated_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', itemId);
    if (error) throw error;
  },

  async updateOrderingItemQty(itemId, qty) {
    const { error } = await supabase
      .from('ordering_items')
      .update({ current_qty: qty, updated_at: new Date().toISOString() })
      .eq('id', itemId);
    if (error) throw error;
  },

  async deleteOrderingItem(itemId) {
    const { error } = await supabase
      .from('ordering_items')
      .delete()
      .eq('id', itemId);
    if (error) throw error;
  },

  // ── Ordering: Order History ───────────────────────────────────────────────────

  async getOrderHistory(userId) {
    const { data, error } = await supabase
      .from('order_history')
      .select('*')
      .eq('user_id', userId)
      .order('placed_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async createOrderHistoryRecord(userId, record) {
    const { data, error } = await supabase
      .from('order_history')
      .insert([{ ...record, user_id: userId }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
