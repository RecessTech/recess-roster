import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, LogOut, CheckCircle, XCircle, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth, signOut } from './Auth';
import { supabase } from './supabaseClient';

const StaffApp = () => {
  const { user, profile, staffId } = useAuth();
  
  const [staff, setStaff] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [availability, setAvailability] = useState({});
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('schedule'); // 'schedule' or 'availability'
  const [viewMode, setViewMode] = useState('week'); // 'week' or 'day'

  // Load staff data
  useEffect(() => {
    const loadData = async () => {
      if (!staffId) return;
      
      try {
        // Load staff profile
        const { data: staffData } = await supabase
          .from('staff')
          .select('*')
          .eq('id', staffId)
          .single();
        
        setStaff({
          id: staffData.id,
          name: staffData.name,
          email: staffData.email,
          phone: staffData.phone
        });

        // Load schedule for next 30 days
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 30);
        
        const { data: scheduleData } = await supabase
          .from('schedules')
          .select('*')
          .eq('staff_id', staffId)
          .gte('date_key', formatDate(startDate))
          .lte('date_key', formatDate(endDate))
          .order('date_key', { ascending: true });

        // Group by date
        const groupedSchedule = {};
        (scheduleData || []).forEach(slot => {
          if (!groupedSchedule[slot.date_key]) {
            groupedSchedule[slot.date_key] = [];
          }
          groupedSchedule[slot.date_key].push({
            time: slot.time_slot,
            roleCode: slot.role_code,
            roleColor: slot.role_color
          });
        });

        setSchedule(groupedSchedule);

        // Load availability
        const { data: availData } = await supabase
          .from('staff_availability')
          .select('*')
          .eq('staff_id', staffId)
          .gte('date', formatDate(startDate))
          .lte('date', formatDate(endDate));

        const availObj = {};
        (availData || []).forEach(a => {
          availObj[a.date] = {
            status: a.status,
            startTime: a.start_time,
            endTime: a.end_time,
            notes: a.notes
          };
        });

        setAvailability(availObj);
        setLoading(false);
      } catch (error) {
        console.error('Error loading data:', error);
        setLoading(false);
      }
    };

    loadData();
  }, [staffId]);

  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getWeekDates = () => {
    const dates = [];
    const start = new Date(currentDate);
    start.setDate(start.getDate() - start.getDay()); // Start of week (Sunday)
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const getDayShifts = (dateKey) => {
    const shifts = schedule[dateKey] || [];
    if (shifts.length === 0) return null;

    // Find continuous blocks
    const sorted = shifts.sort((a, b) => a.time.localeCompare(b.time));
    const blocks = [];
    let currentBlock = null;

    sorted.forEach(shift => {
      if (!currentBlock || currentBlock.roleCode !== shift.roleCode) {
        if (currentBlock) blocks.push(currentBlock);
        currentBlock = {
          startTime: shift.time,
          endTime: shift.time,
          roleCode: shift.roleCode,
          roleColor: shift.roleColor
        };
      } else {
        currentBlock.endTime = shift.time;
      }
    });
    if (currentBlock) blocks.push(currentBlock);

    return blocks;
  };

  const setAvailabilityForDate = async (date, status) => {
    const dateKey = formatDate(date);
    
    try {
      const { error } = await supabase
        .from('staff_availability')
        .upsert({
          staff_id: staffId,
          date: dateKey,
          status: status
        }, {
          onConflict: 'staff_id,date'
        });

      if (error) throw error;

      setAvailability(prev => ({
        ...prev,
        [dateKey]: { status }
      }));
    } catch (error) {
      console.error('Error setting availability:', error);
      alert('Failed to update availability');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="w-8 h-8 skeleton rounded-full"></div>
      </div>
    );
  }

  const weekDates = getWeekDates();

  return (
    <div className="min-h-screen bg-surface-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{staff?.name}</h1>
              <p className="text-xs text-gray-500">{user.email}</p>
            </div>
            <button onClick={() => signOut()} className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-red-500">
              <LogOut size={18} />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
            <button
              onClick={() => setActiveView('schedule')}
              className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${
                activeView === 'schedule' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Calendar size={14} className="inline mr-1.5" />
              Schedule
            </button>
            <button
              onClick={() => setActiveView('availability')}
              className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${
                activeView === 'availability' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <CheckCircle size={14} className="inline mr-1.5" />
              Availability
            </button>
          </div>
        </div>
      </div>

      {/* Week Navigation */}
      <div className="bg-white border-b border-gray-100 sticky top-[100px] z-20 px-4 py-2.5 flex items-center justify-between">
        <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d); }} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400">
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-medium text-gray-600">
          {weekDates[0].toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })} – {weekDates[6].toLocaleDateString('en-AU', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
        <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d); }} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {activeView === 'schedule' ? (
          // Schedule View
          <div className="space-y-3">
            {weekDates.map(date => {
              const dateKey = formatDate(date);
              const shifts = getDayShifts(dateKey);
              const isToday = formatDate(new Date()) === dateKey;
              const avail = availability[dateKey];

              return (
                <div key={dateKey} className={`card overflow-hidden ${isToday ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`}>
                  <div className={`px-4 py-2.5 ${isToday ? 'bg-blue-50' : 'bg-gray-50'} border-b border-gray-100`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-gray-700">{date.toLocaleDateString('en-AU', { weekday: 'short' }).toUpperCase()}</span>
                        <span className="text-xs text-gray-400 ml-2">{date.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}</span>
                      </div>
                      {isToday && <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">TODAY</span>}
                    </div>
                  </div>
                  <div className="p-3">
                    {shifts && shifts.length > 0 ? (
                      <div className="space-y-1.5">
                        {shifts.map((block, idx) => (
                          <div key={idx} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: block.roleColor }}>{block.roleCode}</div>
                            <div className="flex items-center gap-1.5 text-sm text-gray-700">
                              <Clock size={13} className="text-gray-400" />
                              <span className="font-medium">{block.startTime} - {block.endTime}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-3 text-xs text-gray-400">
                        {avail?.status === 'unavailable' ? (
                          <div className="flex items-center justify-center gap-1.5"><XCircle size={14} /><span>Unavailable</span></div>
                        ) : 'No shifts'}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // Availability View
          <div className="space-y-3">
            <div className="card p-3 mb-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle size={16} className="text-blue-500 shrink-0 mt-0.5" />
                <div className="text-xs text-gray-600">
                  <p className="font-medium text-gray-700 mb-0.5">Set Your Availability</p>
                  <p>Let your manager know when you can or can't work.</p>
                </div>
              </div>
            </div>

            {weekDates.map(date => {
              const dateKey = formatDate(date);
              const avail = availability[dateKey];
              const shifts = getDayShifts(dateKey);
              const hasShift = shifts && shifts.length > 0;
              const isToday = formatDate(new Date()) === dateKey;
              const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));

              return (
                <div key={dateKey} className={`card overflow-hidden ${isToday ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`}>
                  <div className={`px-4 py-2.5 ${isToday ? 'bg-blue-50' : 'bg-gray-50'} border-b border-gray-100`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-gray-700">{date.toLocaleDateString('en-AU', { weekday: 'short' }).toUpperCase()}</span>
                        <span className="text-xs text-gray-400 ml-2">{date.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}</span>
                      </div>
                      {hasShift && <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">SCHEDULED</span>}
                      {isPast && <span className="text-[10px] font-medium text-gray-400">PAST</span>}
                    </div>
                  </div>
                  <div className="p-3">
                    {isPast ? (
                      <div className="text-center text-xs text-gray-400 py-2">Date has passed</div>
                    ) : (
                      <div className="grid grid-cols-3 gap-1.5">
                        <button onClick={() => setAvailabilityForDate(date, 'available')} className={`py-2.5 px-2 rounded-lg text-xs font-medium transition-colors ${avail?.status === 'available' ? 'bg-green-600 text-white' : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'}`}>
                          <CheckCircle size={14} className="mx-auto mb-0.5" />
                          Available
                        </button>
                        <button onClick={() => setAvailabilityForDate(date, 'prefer_not')} className={`py-2.5 px-2 rounded-lg text-xs font-medium transition-colors ${avail?.status === 'prefer_not' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'}`}>
                          <AlertCircle size={14} className="mx-auto mb-0.5" />
                          Prefer Not
                        </button>
                        <button onClick={() => setAvailabilityForDate(date, 'unavailable')} className={`py-2.5 px-2 rounded-lg text-xs font-medium transition-colors ${avail?.status === 'unavailable' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'}`}>
                          <XCircle size={14} className="mx-auto mb-0.5" />
                          Unavailable
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffApp;
