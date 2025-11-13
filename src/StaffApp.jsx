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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600"></div>
      </div>
    );
  }

  const weekDates = getWeekDates();

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header - Mobile optimized */}
      <div className="bg-gradient-to-r from-blue-600 to-orange-500 text-white sticky top-0 z-30 shadow-lg">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold">{staff?.name}</h1>
              <p className="text-sm opacity-90">{user.email}</p>
            </div>
            <button
              onClick={() => signOut()}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <LogOut size={20} />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveView('schedule')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                activeView === 'schedule'
                  ? 'bg-white text-blue-600 shadow-md'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              <Calendar size={18} className="inline mr-2" />
              My Schedule
            </button>
            <button
              onClick={() => setActiveView('availability')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                activeView === 'availability'
                  ? 'bg-white text-blue-600 shadow-md'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              <CheckCircle size={18} className="inline mr-2" />
              Availability
            </button>
          </div>
        </div>
      </div>

      {/* Week Navigation */}
      <div className="bg-white border-b sticky top-[116px] z-20 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => {
            const newDate = new Date(currentDate);
            newDate.setDate(newDate.getDate() - 7);
            setCurrentDate(newDate);
          }}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <div className="font-semibold text-gray-800">
            {weekDates[0].toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })} - {weekDates[6].toLocaleDateString('en-AU', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
        <button
          onClick={() => {
            const newDate = new Date(currentDate);
            newDate.setDate(newDate.getDate() + 7);
            setCurrentDate(newDate);
          }}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ChevronRight size={20} />
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
                <div
                  key={dateKey}
                  className={`bg-white rounded-xl shadow-sm border-2 overflow-hidden ${
                    isToday ? 'border-blue-500' : 'border-gray-100'
                  }`}
                >
                  <div className={`px-4 py-3 ${isToday ? 'bg-blue-50' : 'bg-gray-50'} border-b`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-gray-800">
                          {date.toLocaleDateString('en-AU', { weekday: 'short' }).toUpperCase()}
                        </div>
                        <div className="text-sm text-gray-600">
                          {date.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                      {isToday && (
                        <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                          TODAY
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-4">
                    {shifts && shifts.length > 0 ? (
                      <div className="space-y-2">
                        {shifts.map((block, idx) => (
                          <div key={idx} className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: `${block.roleColor}20` }}>
                            <div
                              className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold shadow-md flex-shrink-0"
                              style={{ backgroundColor: block.roleColor }}
                            >
                              {block.roleCode}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 text-gray-700 font-medium">
                                <Clock size={16} />
                                <span>{block.startTime} - {block.endTime}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-400">
                        {avail?.status === 'unavailable' ? (
                          <div className="flex items-center justify-center gap-2">
                            <XCircle size={18} />
                            <span>Marked unavailable</span>
                          </div>
                        ) : (
                          <div>No shifts scheduled</div>
                        )}
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
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-semibold mb-1">Set Your Availability</p>
                  <p>Let your manager know when you can or can't work. Tap a day to update.</p>
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
                <div
                  key={dateKey}
                  className={`bg-white rounded-xl shadow-sm border-2 overflow-hidden ${
                    isToday ? 'border-blue-500' : 'border-gray-100'
                  }`}
                >
                  <div className={`px-4 py-3 ${isToday ? 'bg-blue-50' : 'bg-gray-50'} border-b`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-gray-800">
                          {date.toLocaleDateString('en-AU', { weekday: 'short' }).toUpperCase()}
                        </div>
                        <div className="text-sm text-gray-600">
                          {date.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                      {hasShift && (
                        <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full">
                          SCHEDULED
                        </span>
                      )}
                      {isPast && (
                        <span className="bg-gray-200 text-gray-600 text-xs font-bold px-2 py-1 rounded-full">
                          PAST
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-4">
                    {isPast ? (
                      <div className="text-center text-gray-400 py-2">
                        Date has passed
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => setAvailabilityForDate(date, 'available')}
                          className={`py-3 px-2 rounded-lg font-medium transition-all ${
                            avail?.status === 'available'
                              ? 'bg-green-600 text-white shadow-md'
                              : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                          }`}
                        >
                          <CheckCircle size={18} className="mx-auto mb-1" />
                          <div className="text-xs">Available</div>
                        </button>
                        <button
                          onClick={() => setAvailabilityForDate(date, 'prefer_not')}
                          className={`py-3 px-2 rounded-lg font-medium transition-all ${
                            avail?.status === 'prefer_not'
                              ? 'bg-yellow-600 text-white shadow-md'
                              : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border border-yellow-200'
                          }`}
                        >
                          <AlertCircle size={18} className="mx-auto mb-1" />
                          <div className="text-xs">Prefer Not</div>
                        </button>
                        <button
                          onClick={() => setAvailabilityForDate(date, 'unavailable')}
                          className={`py-3 px-2 rounded-lg font-medium transition-all ${
                            avail?.status === 'unavailable'
                              ? 'bg-red-600 text-white shadow-md'
                              : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                          }`}
                        >
                          <XCircle size={18} className="mx-auto mb-1" />
                          <div className="text-xs">Unavailable</div>
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
