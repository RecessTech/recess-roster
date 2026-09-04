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
      .select('org_id, organisations(id, name, timezone, config, plan, plan_staff_limit, trial_ends_at, stripe_customer_id, stripe_subscription_id, public_token, production_public_token)')
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

  // Rotate the org's public roster-share token (invalidates any previously shared link).
  async regenerateOrgPublicToken(orgId) {
    const { data, error } = await supabase
      .from('organisations')
      .update({ public_token: crypto.randomUUID() })
      .eq('id', orgId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Rotate the org's public production-plan-share token (invalidates any previously shared link).
  async regenerateOrgProductionPublicToken(orgId) {
    const { data, error } = await supabase
      .from('organisations')
      .update({ production_public_token: crypto.randomUUID() })
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

    return (data || []).map(staff => {
      // Normalize employment type to canonical values ('FT', 'PT', 'Casual')
      const rawType = (staff.employment_type || '').toLowerCase().replace(/[-_\s]/g, '');
      const employmentType = rawType.startsWith('full') ? 'FT'
        : rawType.startsWith('part') ? 'PT'
        : rawType === 'ft' ? 'FT'
        : rawType === 'pt' ? 'PT'
        : staff.employment_type || 'Casual';
      return {
        id: staff.id,
        name: staff.name,
        email: staff.email || '',
        publicToken: staff.public_token || null,
        hourlyRate: staff.hourly_rate,
        weekendRate: staff.weekend_rate,
        employmentType,
        active: staff.active !== false
      };
    });
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

  async getSchedules(orgId, startDate, endDate) {
    console.log(`📥 Loading schedules ${startDate} → ${endDate}...`);

    let allData = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from('schedules')
        .select('*')
        .eq('org_id', orgId)
        .order('date_key', { ascending: true })
        .order('staff_id', { ascending: true })
        .order('time_slot', { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (startDate) query = query.gte('date_key', startDate);
      if (endDate)   query = query.lte('date_key', endDate);

      const { data, error } = await query;

      if (error) throw error;

      if (data && data.length > 0) {
        allData = allData.concat(data);
        hasMore = data.length === pageSize;
        page++;
      } else {
        hasMore = false;
      }
    }

    console.log(`✅ Loaded ${allData.length} schedule slots`);

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

    // Derive date window from the keys being saved (avoid reading entire table)
    const dateKeys = [...new Set(scheduleArray.map(s => s.date_key))].sort();
    const windowStart = dateKeys[0];
    const windowEnd = dateKeys[dateKeys.length - 1];

    console.log(`💾 Saving ${scheduleArray.length} slots (${windowStart} → ${windowEnd})...`);

    let existing = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data } = await supabase
        .from('schedules')
        .select('date_key, staff_id, time_slot')
        .eq('org_id', orgId)
        .gte('date_key', windowStart)
        .lte('date_key', windowEnd)
        .order('date_key', { ascending: true })
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
    if (!status) {
      // Clear: delete the row rather than upserting null (status is NOT NULL in DB)
      const { error } = await supabase
        .from('staff_availability')
        .delete()
        .eq('staff_id', staffId)
        .eq('date', date);
      if (error) throw error;
      return;
    }
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

  // ── Stock: Locations ────────────────────────────────────────────────────────

  async getLocations(orgId) {
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .eq('org_id', orgId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async createLocation(orgId, name) {
    const { data, error } = await supabase
      .from('locations')
      .insert([{ org_id: orgId, name }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateLocation(locationId, updates) {
    const { data, error } = await supabase
      .from('locations')
      .update(updates)
      .eq('id', locationId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteLocation(locationId) {
    const { error } = await supabase
      .from('locations')
      .delete()
      .eq('id', locationId);
    if (error) throw error;
  },

  // ── Stock: Items (shared catalog) ───────────────────────────────────────────
  // One item per SKU per org — never duplicated per site. Which site(s)
  // carry it live in stock_item_sites below.

  async getStockItems(orgId) {
    const { data, error } = await supabase
      .from('stock_items')
      .select('*')
      .eq('org_id', orgId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  // Sequential per-org SKU, e.g. "SKU-0007". Not collision-proof under
  // concurrent writers, but this is a low-concurrency admin workflow.
  async _nextSku(orgId) {
    const { data, error } = await supabase
      .from('stock_items')
      .select('sku')
      .eq('org_id', orgId)
      .not('sku', 'is', null);
    if (error) throw error;
    const maxNum = (data || []).reduce((max, row) => {
      const n = parseInt((row.sku || '').replace(/^SKU-/, ''), 10);
      return isNaN(n) ? max : Math.max(max, n);
    }, 0);
    return `SKU-${String(maxNum + 1).padStart(4, '0')}`;
  },

  async createStockItem(orgId, item) {
    const sku = await this._nextSku(orgId);
    const { data, error } = await supabase
      .from('stock_items')
      .insert([{ ...item, org_id: orgId, sku }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateStockItem(itemId, item) {
    const { data, error } = await supabase
      .from('stock_items')
      .update({ ...item, updated_at: new Date().toISOString() })
      .eq('id', itemId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteStockItem(itemId) {
    const { error } = await supabase
      .from('stock_items')
      .delete()
      .eq('id', itemId);
    if (error) throw error;
  },

  // ── Stock: Site assignment ──────────────────────────────────────────────────
  // stock_item_sites says which location(s) carry a given item, and holds
  // that site's own supplier/reference qty — the same SKU can have a
  // different supplier at each site.

  async getStockItemSites(orgId) {
    const { data, error } = await supabase
      .from('stock_item_sites')
      .select('*')
      .eq('org_id', orgId);
    if (error) throw error;
    return data || [];
  },

  // Upserts so re-assigning an already-assigned item just updates its
  // supplier/qty rather than erroring.
  async assignItemToSite(orgId, itemId, locationId, { supplier, supplierCode, referenceOrderQty } = {}) {
    const { data, error } = await supabase
      .from('stock_item_sites')
      .upsert([{
        org_id: orgId,
        item_id: itemId,
        location_id: locationId,
        supplier: supplier || null,
        supplier_code: supplierCode || null,
        reference_order_qty: referenceOrderQty || 0,
        updated_at: new Date().toISOString(),
      }], { onConflict: 'item_id,location_id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async unassignItemFromSite(itemId, locationId) {
    const { error } = await supabase
      .from('stock_item_sites')
      .delete()
      .eq('item_id', itemId)
      .eq('location_id', locationId);
    if (error) throw error;
  },

  async updateSiteItemStatus(siteRowId, status) {
    const { data, error } = await supabase
      .from('stock_item_sites')
      .update({ current_status: status, updated_at: new Date().toISOString() })
      .eq('id', siteRowId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateSiteItemOrderQty(siteRowId, orderQty) {
    const { data, error } = await supabase
      .from('stock_item_sites')
      .update({ order_qty: orderQty, updated_at: new Date().toISOString() })
      .eq('id', siteRowId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateSiteItemOrdered(siteRowId, ordered) {
    const { data, error } = await supabase
      .from('stock_item_sites')
      .update({
        ordered,
        ordered_at: ordered ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', siteRowId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // ── Stock: Order history ────────────────────────────────────────────────────
  // Rows are written only by the nightly archive_and_reset_stock_orders()
  // Postgres function — the app only ever reads this.

  async getStockOrderHistory(orgId) {
    const { data, error } = await supabase
      .from('stock_order_history')
      .select('*')
      .eq('org_id', orgId)
      .order('ordered_date', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  // Bulk import for one site's CSV: matches existing items by name
  // (case-insensitive) within the org so the same ingredient uploaded for
  // two sites becomes two site-assignments on one catalog item, not two
  // separate SKUs. New names are created in one batch insert and every
  // site-assignment is upserted in one batch — not one round trip per row,
  // which is what made large uploads (100+ rows) look like they'd hung.
  async bulkImportStockItems(orgId, locationId, rows) {
    // De-dupe rows sharing a name within the file itself (keep the last),
    // otherwise the same item_id+location_id could appear twice in the
    // batch upsert below, which Postgres rejects.
    const byName = new Map();
    for (const row of rows) byName.set(row.name.trim().toLowerCase(), row);
    const uniqueRows = [...byName.values()];

    const existing = await this.getStockItems(orgId);
    const existingByName = new Map(existing.map(i => [i.name.trim().toLowerCase(), i]));

    const newRows = uniqueRows.filter(r => !existingByName.has(r.name.trim().toLowerCase()));
    let createdItems = [];
    if (newRows.length > 0) {
      const startNum = parseInt((await this._nextSku(orgId)).replace('SKU-', ''), 10);
      const inserts = newRows.map((row, i) => ({
        org_id: orgId,
        name: row.name.trim(),
        category: row.category || null,
        uom: row.uom || 'units',
        sku: `SKU-${String(startNum + i).padStart(4, '0')}`,
        description: row.description || null,
        units_per_carton: row.units_per_carton || row.unitsPerCarton || null,
      }));
      const { data, error } = await supabase.from('stock_items').insert(inserts).select();
      if (error) throw error;
      createdItems = data || [];
    }

    const itemByName = new Map([
      ...existing.map(i => [i.name.trim().toLowerCase(), i]),
      ...createdItems.map(i => [i.name.trim().toLowerCase(), i]),
    ]);

    const assignmentRows = uniqueRows.map(row => ({
      org_id: orgId,
      item_id: itemByName.get(row.name.trim().toLowerCase()).id,
      location_id: locationId,
      supplier: row.supplier || null,
      supplier_code: row.supplierCode || row.supplier_code || null,
      reference_order_qty: row.reference_order_qty || 0,
      updated_at: new Date().toISOString(),
    }));

    const { data: assignments, error: assignError } = await supabase
      .from('stock_item_sites')
      .upsert(assignmentRows, { onConflict: 'item_id,location_id' })
      .select();
    if (assignError) throw assignError;

    return assignments || [];
  },

  // ── Stock: Supplier assignments ─────────────────────────────────────────────
  // Which org member orders each supplier -- powers the "My Suppliers"
  // filter. A convenience view, not access control: everyone can still see
  // everything, RLS is the same is_org_member policy as every other table.

  async getOrgMembersWithEmail(orgId) {
    const { data, error } = await supabase.rpc('get_org_members_with_email', { target_org_id: orgId });
    if (error) throw error;
    return data || [];
  },

  async getSupplierAssignments(orgId) {
    const { data, error } = await supabase
      .from('supplier_assignments')
      .select('*')
      .eq('org_id', orgId);
    if (error) throw error;
    return data || [];
  },

  async setSupplierAssignment(orgId, supplier, userId) {
    const { data, error } = await supabase
      .from('supplier_assignments')
      .upsert([{ org_id: orgId, supplier, user_id: userId, updated_at: new Date().toISOString() }], { onConflict: 'org_id,supplier' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async removeSupplierAssignment(orgId, supplier) {
    const { error } = await supabase
      .from('supplier_assignments')
      .delete()
      .eq('org_id', orgId)
      .eq('supplier', supplier);
    if (error) throw error;
  },

  // ── Production Planning (R-Prod) ────────────────────────────────────────────

  async getProductionSites(orgId) {
    const { data, error } = await supabase
      .from('production_sites')
      .select('*')
      .eq('org_id', orgId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async createProductionSite(orgId, name) {
    const { data, error } = await supabase
      .from('production_sites')
      .insert([{ org_id: orgId, name }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateProductionSite(siteId, updates) {
    const { data, error } = await supabase
      .from('production_sites')
      .update(updates)
      .eq('id', siteId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteProductionSite(siteId) {
    const { error } = await supabase
      .from('production_sites')
      .delete()
      .eq('id', siteId);
    if (error) throw error;
  },

  async getProductionChannels(orgId) {
    const { data, error } = await supabase
      .from('production_channels')
      .select('*')
      .eq('org_id', orgId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async createProductionChannel(orgId, siteId, name) {
    const { data, error } = await supabase
      .from('production_channels')
      .insert([{ org_id: orgId, site_id: siteId, name }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateProductionChannel(channelId, updates) {
    const { data, error } = await supabase
      .from('production_channels')
      .update(updates)
      .eq('id', channelId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteProductionChannel(channelId) {
    const { error } = await supabase
      .from('production_channels')
      .delete()
      .eq('id', channelId);
    if (error) throw error;
  },

  async getProductionItems(orgId) {
    const { data, error } = await supabase
      .from('production_items')
      .select('*')
      .eq('org_id', orgId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async createProductionItem(orgId, item) {
    const { data, error } = await supabase
      .from('production_items')
      .insert([{ ...item, org_id: orgId }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateProductionItem(itemId, updates) {
    const { data, error } = await supabase
      .from('production_items')
      .update(updates)
      .eq('id', itemId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteProductionItem(itemId) {
    const { error } = await supabase
      .from('production_items')
      .delete()
      .eq('id', itemId);
    if (error) throw error;
  },

  async getProductionPlan(orgId, date) {
    const { data, error } = await supabase
      .from('production_plan_entries')
      .select('*')
      .eq('org_id', orgId)
      .eq('plan_date', date);
    if (error) throw error;
    return data || [];
  },

  // Every entry (every site/channel) across a date range — the caller sums
  // across channels itself, since insights are combined-across-sites totals.
  async getProductionPlanRange(orgId, startDate, endDate) {
    const { data, error } = await supabase
      .from('production_plan_entries')
      .select('item_id, channel_id, plan_date, qty')
      .eq('org_id', orgId)
      .gte('plan_date', startDate)
      .lte('plan_date', endDate);
    if (error) throw error;
    return data || [];
  },

  async setProductionPlanQty(orgId, userId, { itemId, channelId, date, qty }) {
    const { data, error } = await supabase
      .from('production_plan_entries')
      .upsert(
        [{
          org_id: orgId,
          item_id: itemId,
          channel_id: channelId,
          plan_date: date,
          qty,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        }],
        { onConflict: 'item_id,channel_id,plan_date' }
      )
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getProductionDayLock(orgId, siteId, date) {
    const { data, error } = await supabase
      .from('production_day_locks')
      .select('*')
      .eq('org_id', orgId)
      .eq('site_id', siteId)
      .eq('plan_date', date)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async setProductionDayLock(orgId, userId, siteId, date) {
    const { data, error } = await supabase
      .from('production_day_locks')
      .upsert(
        [{ org_id: orgId, site_id: siteId, plan_date: date, locked_by: userId, locked_at: new Date().toISOString() }],
        { onConflict: 'site_id,plan_date' }
      )
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async clearProductionDayLock(siteId, date) {
    const { error } = await supabase
      .from('production_day_locks')
      .delete()
      .eq('site_id', siteId)
      .eq('plan_date', date);
    if (error) throw error;
  },

  // ── Recipes & COGS (R-Recipe) ───────────────────────────────────────────────

  async getRecipeComponents(orgId) {
    const { data, error } = await supabase
      .from('recipe_components')
      .select('*')
      .eq('org_id', orgId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async createRecipeComponent(orgId, component) {
    const { data, error } = await supabase
      .from('recipe_components')
      .insert([{ ...component, org_id: orgId }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateRecipeComponent(componentId, updates) {
    const { data, error } = await supabase
      .from('recipe_components')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', componentId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteRecipeComponent(componentId) {
    const { error } = await supabase
      .from('recipe_components')
      .delete()
      .eq('id', componentId);
    if (error) throw error;
  },

  // All component lines for an org in one query — cheap at this scale and
  // avoids N+1 fetches when computing every component's cost at once.
  async getRecipeComponentLines(orgId) {
    const { data, error } = await supabase
      .from('recipe_component_lines')
      .select('*')
      .eq('org_id', orgId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async createRecipeComponentLine(orgId, line) {
    const { data, error } = await supabase
      .from('recipe_component_lines')
      .insert([{ ...line, org_id: orgId }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateRecipeComponentLine(lineId, updates) {
    const { data, error } = await supabase
      .from('recipe_component_lines')
      .update(updates)
      .eq('id', lineId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteRecipeComponentLine(lineId) {
    const { error } = await supabase
      .from('recipe_component_lines')
      .delete()
      .eq('id', lineId);
    if (error) throw error;
  },

  async getRecipeMenuItemLines(orgId) {
    const { data, error } = await supabase
      .from('recipe_menu_item_lines')
      .select('*')
      .eq('org_id', orgId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async createRecipeMenuItemLine(orgId, line) {
    const { data, error } = await supabase
      .from('recipe_menu_item_lines')
      .insert([{ ...line, org_id: orgId }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateRecipeMenuItemLine(lineId, updates) {
    const { data, error } = await supabase
      .from('recipe_menu_item_lines')
      .update(updates)
      .eq('id', lineId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteRecipeMenuItemLine(lineId) {
    const { error } = await supabase
      .from('recipe_menu_item_lines')
      .delete()
      .eq('id', lineId);
    if (error) throw error;
  },

  // ── Crystal Ball: sales history & forecast settings ─────────────────────────

  async getSalesHistory(orgId) {
    let allData = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('sales_history')
        .select('*')
        .eq('org_id', orgId)
        .order('sale_date', { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1);
      if (error) throw error;

      if (data && data.length > 0) {
        allData = allData.concat(data);
        hasMore = data.length === pageSize;
        page++;
      } else {
        hasMore = false;
      }
    }
    return allData;
  },

  // Upserts on (org_id, sale_date, item_id, channel) -- safe to re-run an
  // import that overlaps previously-imported dates.
  async bulkUpsertSalesHistory(orgId, rows) {
    if (rows.length === 0) return [];
    const payload = rows.map(r => ({ ...r, org_id: orgId, channel: r.channel || 'pos' }));
    const { data, error } = await supabase
      .from('sales_history')
      .upsert(payload, { onConflict: 'org_id,sale_date,item_id,channel' })
      .select();
    if (error) throw error;
    return data || [];
  },

  async deleteSalesHistoryRow(rowId) {
    const { error } = await supabase
      .from('sales_history')
      .delete()
      .eq('id', rowId);
    if (error) throw error;
  },

  async getCrystalBallSettings(orgId) {
    const { data, error } = await supabase
      .from('crystal_ball_settings')
      .select('*')
      .eq('org_id', orgId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async upsertCrystalBallSettings(orgId, updates) {
    const { data, error } = await supabase
      .from('crystal_ball_settings')
      .upsert({ ...updates, org_id: orgId, updated_at: new Date().toISOString() }, { onConflict: 'org_id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
