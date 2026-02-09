import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { X, Edit2, Trash2, Users, Clock, ChevronDown, ChevronUp, Copy, Clipboard, Trash, Undo2, Redo2, LogOut, Save, AlertTriangle, ArchiveRestore } from 'lucide-react';
import { useAuth, signOut } from './Auth';
import { db } from './supabaseClient';

const RosterApp = () => {
  const { user } = useAuth();
  
  const defaultRoles = [
    { id: 'barista', name: 'Barista', code: 'B', color: '#F97316' },
    { id: 'foh', name: 'Front of House', code: 'FOH', color: '#2563EB' },
    { id: 'boh', name: 'Back of House', code: 'BOH', color: '#FB923C' },
    { id: 'chef', name: 'Chef', code: 'C', color: '#EA580C' },
    { id: 'prep', name: 'Prep', code: 'P', color: '#1D4ED8' },
    { id: 'assembler', name: 'Assembler', code: 'A', color: '#3B82F6' },
    { id: 'office', name: 'Office', code: 'O', color: '#8B5CF6' }
  ];

  const [staff, setStaff] = useState([]);
  const [roles, setRoles] = useState(defaultRoles);
  const [schedule, setSchedule] = useState({});
  const [selectedRole, setSelectedRole] = useState(null);
  const [viewMode, setViewMode] = useState(7);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [startHour, setStartHour] = useState(6);
  const [endHour, setEndHour] = useState(17);
  const [showTimeSettings, setShowTimeSettings] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(2);
  const [columnWidth, setColumnWidth] = useState(70);
  const [timeInterval, setTimeInterval] = useState(15);
  const [showTeamMembers, setShowTeamMembers] = useState(true);
  const [staffOrder, setStaffOrder] = useState([]);
  const [draggedStaffId, setDraggedStaffId] = useState(null);
  const [showQuickFillModal, setShowQuickFillModal] = useState(false);
  const [quickFillData, setQuickFillData] = useState(null);
  const [copiedDay, setCopiedDay] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearTarget, setClearTarget] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [scheduleHistory, setScheduleHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [activeView, setActiveView] = useState('roster'); // 'roster', 'analytics', or 'staff-view'
  const [isMobileView, setIsMobileView] = useState(false);

  // Detect mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobileView(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  const [analyticsTab, setAnalyticsTab] = useState('overview');
  const [selectedStaffView, setSelectedStaffView] = useState(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [shiftTemplates, setShiftTemplates] = useState([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateMode, setTemplateMode] = useState(false); // When true, clicking applies template
  const [showRolesModal, setShowRolesModal] = useState(false);
  const [staffSelectionView, setStaffSelectionView] = useState('cards'); // 'cards' or 'list'
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [dailyRevenue, setDailyRevenue] = useState({}); // Keyed by date string YYYY-MM-DD
  const [showRevenueModal, setShowRevenueModal] = useState(false);
  const [revenueEditDate, setRevenueEditDate] = useState(null);
  const [businessSettings, setBusinessSettings] = useState({
    businessName: 'Recess',
    logoUrl: '', // URL for business logo
    operationalHours: {
      monday: { open: '06:30', close: '15:45', closed: false },
      tuesday: { open: '06:30', close: '15:45', closed: false },
      wednesday: { open: '06:30', close: '15:45', closed: false },
      thursday: { open: '06:30', close: '15:45', closed: false },
      friday: { open: '06:30', close: '15:45', closed: false },
      saturday: { open: '07:00', close: '15:15', closed: false },
      sunday: { open: '07:00', close: '15:15', closed: false }
    },
    minStaffCoverage: 2, // Minimum staff per time slot
    peakHours: { start: '12:00', end: '14:00' },
    minPeakStaffCoverage: 3, // Minimum staff during peak hours
    currency: '$',
    timezone: 'Australia/Sydney',
    targetLaborPercentage: 30 // Target labor cost as % of revenue
  });

    const [saving, setSaving] = useState(false);

  // Save queue system to prevent race conditions and data loss
  const saveInProgressRef = useRef(false);
  const pendingSaveRef = useRef(null);
  const lastSavedScheduleRef = useRef(null);

  const executeSave = useCallback(async (userId, scheduleToSave) => {
    if (saveInProgressRef.current) {
      // Queue this save for when the current one finishes
      pendingSaveRef.current = scheduleToSave;
      return;
    }

    saveInProgressRef.current = true;
    setSaving(true);

    try {
      const scheduleSize = Object.keys(scheduleToSave).length;
      if (scheduleSize === 0) {
        console.warn('⚠️ Skipping auto-save: schedule is empty');
        return;
      }

      // Backup to localStorage before saving
      try {
        const backup = {
          schedule: scheduleToSave,
          timestamp: new Date().toISOString(),
          userId,
          scheduleSize
        };
        localStorage.setItem('roster_backup', JSON.stringify(backup));
      } catch (e) {
        console.warn('Failed to backup to localStorage:', e);
      }

      // Compute delta against last saved state for efficient saving
      const lastSaved = lastSavedScheduleRef.current;
      if (lastSaved) {
        await db.saveSchedulesDelta(userId, scheduleToSave, lastSaved);
      } else {
        await db.saveSchedules(userId, scheduleToSave);
      }

      lastSavedScheduleRef.current = scheduleToSave;
      console.log(`✅ Auto-saved ${scheduleSize} schedule slots`);
    } catch (error) {
      console.error('❌ Error saving schedule:', error);
      alert(`Failed to save schedule: ${error.message}`);
    } finally {
      saveInProgressRef.current = false;
      setSaving(false);

      // Process any queued save
      if (pendingSaveRef.current) {
        const nextSave = pendingSaveRef.current;
        pendingSaveRef.current = null;
        executeSave(userId, nextSave);
      }
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      
      try {
        const [staffData, scheduleData, orderData, settingsData, templatesData] = await Promise.all([
          db.getStaff(user.id),
          db.getSchedules(user.id),
          db.getStaffOrder(user.id),
          db.getSettings(user.id),
          db.getTemplates ? db.getTemplates(user.id) : Promise.resolve([])
        ]);
        
        setStaff(staffData);
        
        // Load revenue data for current date range
        const startDate = new Date(currentDate);
        startDate.setDate(startDate.getDate() - 30); // Load 30 days back
        const endDate = new Date(currentDate);
        endDate.setDate(endDate.getDate() + 30); // Load 30 days forward
        
        // Format dates as local YYYY-MM-DD strings
        const formatLocalDate = (date) => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };
        
        const revenueData = await db.getRevenue(
          user.id,
          formatLocalDate(startDate),
          formatLocalDate(endDate)
        );
        setDailyRevenue(revenueData);
        
        // CHECK FOR EMERGENCY RECOVERY: If database is empty but localStorage has backup
        if (Object.keys(scheduleData).length === 0) {
          try {
            const backupStr = localStorage.getItem('roster_backup');
            const promptedKey = 'roster_backup_prompted';
            const alreadyPrompted = sessionStorage.getItem(promptedKey);
            
            if (backupStr && !alreadyPrompted) {
              const backup = JSON.parse(backupStr);
              if (backup.userId === user.id && backup.schedule && Object.keys(backup.schedule).length > 0) {
                sessionStorage.setItem(promptedKey, 'true');
                const backupDate = new Date(backup.timestamp);
                const shouldRestore = window.confirm(
                  `🔄 RECOVERY AVAILABLE\n\n` +
                  `Database is empty, but a backup was found from:\n` +
                  `${backupDate.toLocaleString()}\n\n` +
                  `Backup contains ${backup.scheduleSize} schedule slots.\n\n` +
                  `Do you want to restore from backup?`
                );
                
                if (shouldRestore) {
                  console.log('🔄 Restoring from localStorage backup');
                  setSchedule(backup.schedule);
                  alert('✅ Schedule restored from backup! Click the green SAVE button to save to database.');
                } else {
                  setSchedule(scheduleData);
                }
              } else {
                setSchedule(scheduleData);
              }
            } else {
              setSchedule(scheduleData);
            }
          } catch (e) {
            console.warn('Failed to check localStorage backup:', e);
            setSchedule(scheduleData);
          }
        } else {
          setSchedule(scheduleData);
        }

        // Track initial DB state so delta saves know what changed
        lastSavedScheduleRef.current = scheduleData;

        if (orderData && orderData.length > 0) {
          setStaffOrder(orderData);
        }
        if (templatesData && templatesData.length > 0) {
          setShiftTemplates(templatesData);
        }
        
        if (settingsData) {
          setBusinessSettings({
            businessName: settingsData.business_name,
            logoUrl: settingsData.logo_url || '',
            operationalHours: settingsData.operational_hours,
            minStaffCoverage: settingsData.min_staff_coverage,
            peakHours: settingsData.peak_hours,
            minPeakStaffCoverage: settingsData.min_peak_staff_coverage,
            currency: settingsData.currency,
            timezone: settingsData.timezone
          });
        }
      } catch (error) {
        console.error('Error loading data:', error);
      }
      
      setIsLoaded(true);
      
      // Check if user has completed tutorial (first login detection)
      const tutorialCompleted = localStorage.getItem(`tutorial_completed_${user.id}`);
      if (!tutorialCompleted) {
        // First time user - auto-start tutorial after a brief delay
        setTimeout(() => {
          setShowTutorial(true);
          setTutorialStep(0);
        }, 1500);
      }
    };
    
    loadData();
  }, [user]);

  useEffect(() => {
    if (!isLoaded || !user) return;
    // Staff saving is handled individually in add/update/delete functions
    if (staffOrder.length === 0 && activeStaff.length > 0) {
      setStaffOrder(activeStaff.map(s => s.id));
    }
  }, [activeStaff, isLoaded, user, staffOrder.length]);

  // Reset selected staff when switching away from staff-view
  useEffect(() => {
    if (activeView !== 'staff-view') {
      setSelectedStaffView(null);
    }
  }, [activeView]);

  useEffect(() => {
    if (!isLoaded || !user) return;

    const timeoutId = setTimeout(() => {
      executeSave(user.id, schedule);
    }, 1000); // Debounce 1 second

    return () => clearTimeout(timeoutId);
  }, [schedule, isLoaded, user, executeSave]);

  useEffect(() => {
    if (!isLoaded || !user || staffOrder.length === 0) return;
    
    const saveOrder = async () => {
      try {
        await db.saveStaffOrder(user.id, staffOrder);
      } catch (error) {
        console.error('Error saving staff order:', error);
      }
    };
    
    saveOrder();
  }, [staffOrder, isLoaded, user]);

  useEffect(() => {
    if (!isLoaded || !user) return;
    
    const saveSettings = async () => {
      try {
        await db.saveSettings(user.id, {
          business_name: businessSettings.businessName,
          logo_url: businessSettings.logoUrl,
          operational_hours: businessSettings.operationalHours,
          min_staff_coverage: businessSettings.minStaffCoverage,
          peak_hours: businessSettings.peakHours,
          min_peak_staff_coverage: businessSettings.minPeakStaffCoverage,
          currency: businessSettings.currency,
          timezone: businessSettings.timezone
        });
      } catch (error) {
        console.error('Error saving settings:', error);
      }
    };
    
    const timeoutId = setTimeout(saveSettings, 1000);
    return () => clearTimeout(timeoutId);
  }, [businessSettings, isLoaded, user]);

  // Helper to check if a time slot is within operational hours
  const isWithinOperationalHours = (date, timeSlot) => {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[date.getDay()];
    const daySettings = businessSettings.operationalHours[dayName];
    
    if (daySettings.closed) return false;
    
    return timeSlot >= daySettings.open && timeSlot < daySettings.close;
  };

  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = startHour; hour <= endHour; hour++) {
      for (let min = 0; min < 60; min += timeInterval) {
        if (hour === endHour && min > 0) break;
        slots.push(`${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`);
      }
    }
    return slots;
  };

  const saveToHistory = (currentSchedule) => {
    // Trim any future history and add new state
    const newHistory = scheduleHistory.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(currentSchedule)));
    
    // Keep only last 50 states
    let newIndex = historyIndex + 1;
    if (newHistory.length > 50) {
      newHistory.shift();
      newIndex = 49; // Since we shifted, index should be at the last position
    }
    
    setScheduleHistory(newHistory);
    setHistoryIndex(newIndex);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setSchedule(JSON.parse(JSON.stringify(scheduleHistory[newIndex])));
    }
  };

  const redo = () => {
    if (historyIndex < scheduleHistory.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setSchedule(JSON.parse(JSON.stringify(scheduleHistory[newIndex])));
    }
  };

  // Get all time slots that should be filled for a given time slot
  // This ensures that painting at coarse intervals (1h) fills all finer intervals (15m, 30m)
  const getAllSubIntervals = (timeSlot) => {
    const [hour, minute] = timeSlot.split(':').map(Number);
    const slots = [timeSlot]; // Always include the clicked slot
    
    // Generate all 15-minute intervals within the hour starting from this time slot
    const minutesInHour = [0, 15, 30, 45];
    const startMinuteIndex = minutesInHour.findIndex(m => m === minute);
    
    if (startMinuteIndex !== -1) {
      // Add all intervals from this minute to the next hour mark
      for (let i = startMinuteIndex + 1; i < minutesInHour.length; i++) {
        slots.push(`${hour.toString().padStart(2, '0')}:${minutesInHour[i].toString().padStart(2, '0')}`);
      }
    }
    
    return slots;
  };

  // Template Management Functions
  const createTemplateFromSelection = (dateKey, staffId, startTime, endTime, role) => {
    setShowTemplateModal(true);
    setSelectedTemplate({
      dateKey,
      staffId,
      startTime,
      endTime,
      role
    });
  };

  const saveTemplate = async (templateName) => {
    if (!selectedTemplate || !user) return;

    const newTemplate = {
      id: crypto.randomUUID(),
      name: templateName,
      roleId: selectedTemplate.role.id,
      roleCode: selectedTemplate.role.code,
      roleColor: selectedTemplate.role.color,
      startTime: selectedTemplate.startTime,
      endTime: selectedTemplate.endTime
    };

    try {
      if (db.saveTemplate) {
        await db.saveTemplate(user.id, newTemplate);
      }
      setShiftTemplates([...shiftTemplates, newTemplate]);
      setShowTemplateModal(false);
      setSelectedTemplate(null);
    } catch (error) {
      console.error('Error saving template:', error);
    }
  };

  const deleteTemplate = async (templateId) => {
    try {
      if (db.deleteTemplate) {
        await db.deleteTemplate(templateId);
      }
      setShiftTemplates(shiftTemplates.filter(t => t.id !== templateId));
    } catch (error) {
      console.error('Error deleting template:', error);
    }
  };

  const applyTemplate = (template, dateKey, staffId) => {
    saveToHistory(schedule);
    const newSchedule = { ...schedule };

    // Generate all time slots between start and end time
    const [startHour, startMin] = template.startTime.split(':').map(Number);
    const [endHour, endMin] = template.endTime.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    // Generate slots at current interval
    for (let minutes = startMinutes; minutes < endMinutes; minutes += timeInterval) {
      const hour = Math.floor(minutes / 60);
      const min = minutes % 60;
      const timeSlot = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
      
      const key = getScheduleKey(dateKey, staffId, timeSlot);
      newSchedule[key] = {
        roleId: template.roleId,
        roleCode: template.roleCode,
        roleColor: template.roleColor
      };
    }

    setSchedule(newSchedule);
    setTemplateMode(false);
  };

  const timeSlots = generateTimeSlots();
  const rowHeight = { 1: 12, 2: 24, 3: 36 }[zoomLevel] || 24;

  const generateDates = () => {
    const dates = [];
    const startDate = new Date(currentDate);
    const day = startDate.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    startDate.setDate(startDate.getDate() + diff);
    
    for (let i = 0; i < viewMode; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const dates = generateDates();
  const formatDateKey = (date) => {
    // Use local date, not UTC, to avoid timezone shifting
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const getScheduleKey = (dateKey, staffId, timeSlot) => `${dateKey}|${staffId}|${timeSlot}`;

  const handleMouseDown = (dateKey, staffId, timeSlot) => {
    // Template mode: apply template instead of painting
    if (templateMode && selectedTemplate) {
      applyTemplate(selectedTemplate, dateKey, staffId);
      return;
    }

    if (!selectedRole) return;
    
    setSchedule(prevSchedule => {
      // Save current state to history BEFORE making changes
      saveToHistory(prevSchedule);
      
      const newSchedule = { ...prevSchedule };
      
      if (selectedRole.id === 'eraser') {
        // Eraser: only erase the specific clicked slot
        const key = getScheduleKey(dateKey, staffId, timeSlot);
        delete newSchedule[key];
      } else {
        // Paint: fill all sub-intervals within this time slot
        const slotsToFill = getAllSubIntervals(timeSlot);
        slotsToFill.forEach(slot => {
          const key = getScheduleKey(dateKey, staffId, slot);
          // Only paint if slot doesn't exist or is different role
          if (!newSchedule[key] || newSchedule[key].roleId !== selectedRole.id) {
            newSchedule[key] = { roleId: selectedRole.id, roleCode: selectedRole.code, roleColor: selectedRole.color };
          }
        });
      }
      
      return newSchedule;
    });
    
    setIsDragging(true);
  };

  const handleRightClick = (e, dateKey, staffId, timeSlot) => {
    e.preventDefault();
    
    const key = getScheduleKey(dateKey, staffId, timeSlot);
    const hasShift = !!schedule[key];
    
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      dateKey,
      staffId,
      timeSlot,
      hasShift
    });
  };

  const handleMouseEnter = (dateKey, staffId, timeSlot) => {
    if (!isDragging || !selectedRole) return;
    
    const newSchedule = { ...schedule };
    
    if (selectedRole.id === 'eraser') {
      // Eraser: only erase the specific slot
      const key = getScheduleKey(dateKey, staffId, timeSlot);
      delete newSchedule[key];
    } else {
      // Paint: fill all sub-intervals within this time slot
      const slotsToFill = getAllSubIntervals(timeSlot);
      slotsToFill.forEach(slot => {
        const key = getScheduleKey(dateKey, staffId, slot);
        newSchedule[key] = { roleId: selectedRole.id, roleCode: selectedRole.code, roleColor: selectedRole.color };
      });
    }
    
    setSchedule(newSchedule);
  };

  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false);
    const handleClick = () => setContextMenu(null);
    const handleKeyDown = (e) => {
      // Ctrl+Z or Cmd+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Ctrl+Shift+Z or Ctrl+Y or Cmd+Shift+Z for redo
      if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') || ((e.ctrlKey || e.metaKey) && e.key === 'y')) {
        e.preventDefault();
        redo();
      }
    };
    
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [historyIndex, scheduleHistory]);

  const calculateStaffDayStats = (staffId, dateKey) => {
    const staffMember = staff.find(s => s.id === staffId);
    if (!staffMember) return { hours: 0, cost: 0 };

    // Check if this is a weekend day
    const date = new Date(dateKey);
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    // Use weekend rate if it's a weekend and weekend rate exists, otherwise use regular rate
    const rate = isWeekend && staffMember.weekendRate ? staffMember.weekendRate : staffMember.hourlyRate;

    // Count actual 15-min slots in schedule (not timeSlots array which changes with view)
    let slots = 0;
    Object.keys(schedule).forEach(key => {
      if (key.startsWith(`${dateKey}|${staffId}|`)) {
        slots++;
      }
    });

    // ALWAYS calculate hours based on 15-minute slots (the underlying data structure)
    // regardless of the current view interval (15m/30m/1h)
    const hours = slots * (15 / 60);
    return { hours, cost: hours * rate };
  };

  const calculateStaffWeekStats = (staffId) => {
    let totalHours = 0;
    let totalCost = 0;
    
    dates.forEach(date => {
      const dateKey = formatDateKey(date);
      const dayStats = calculateStaffDayStats(staffId, dateKey);
      totalHours += dayStats.hours;
      totalCost += dayStats.cost;
    });
    
    return { hours: totalHours, cost: totalCost };
  };

  const calculateDayStats = (dateKey) => {
    let totalHours = 0;
    let totalCost = 0;
    activeStaff.forEach(s => {
      const stats = calculateStaffDayStats(s.id, dateKey);
      totalHours += stats.hours;
      totalCost += stats.cost;
    });
    return { totalHours, totalCost };
  };

  const calculateWeekStats = () => {
    let totalHours = 0;
    let totalCost = 0;
    const staffBreakdown = {};
    const roleBreakdown = {};
    const dailyBreakdown = [];
    const peakHourCoverage = {};
    let weekendHours = 0;
    let weekendCost = 0;
    let weekdayHours = 0;
    let weekdayCost = 0;
    let peakHours = 0;
    let peakCost = 0;
    let offPeakHours = 0;
    let offPeakCost = 0;

    activeStaff.forEach(s => {
      staffBreakdown[s.id] = { name: s.name, hours: 0, cost: 0 };
    });

    roles.forEach(r => {
      roleBreakdown[r.id] = { name: r.name, code: r.code, color: r.color, hours: 0, cost: 0 };
    });

    dates.forEach(date => {
      const dateKey = formatDateKey(date);
      const dayStats = calculateDayStats(dateKey);
      totalHours += dayStats.totalHours;
      totalCost += dayStats.totalCost;

      // Check if weekend
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      dailyBreakdown.push({
        date: date,
        dateKey: dateKey,
        hours: dayStats.totalHours,
        cost: dayStats.totalCost,
        isWeekend
      });

      // Calculate per staff and per role
      Object.entries(schedule).forEach(([key, shift]) => {
        const [keyDateKey, keyStaffId, timeSlot] = key.split('|');
        
        // Only process if this entry is for current date
        if (keyDateKey !== dateKey) return;
        
        const s = staff.find(st => st.id === keyStaffId);
        if (!s) return;
        
        const rate = isWeekend && s.weekendRate ? s.weekendRate : s.hourlyRate;
        
        // ALWAYS use 15-minute slots for calculation
        const hours = 15 / 60;
        const cost = hours * rate;
        
        // Weekend vs weekday
        if (isWeekend) {
          weekendHours += hours;
          weekendCost += cost;
        } else {
          weekdayHours += hours;
          weekdayCost += cost;
        }

        // Peak vs off-peak (12pm-2pm is peak)
        const isPeakHour = timeSlot >= '12:00' && timeSlot < '14:00';
        if (isPeakHour) {
          peakHours += hours;
          peakCost += cost;
          
          // Track peak hour coverage
          if (!peakHourCoverage[dateKey]) {
            peakHourCoverage[dateKey] = {};
          }
          if (!peakHourCoverage[dateKey][timeSlot]) {
            peakHourCoverage[dateKey][timeSlot] = 0;
          }
          peakHourCoverage[dateKey][timeSlot]++;
        } else {
          offPeakHours += hours;
          offPeakCost += cost;
        }
        
        staffBreakdown[keyStaffId].hours += hours;
        staffBreakdown[keyStaffId].cost += cost;
        
        if (roleBreakdown[shift.roleId]) {
          roleBreakdown[shift.roleId].hours += hours;
          roleBreakdown[shift.roleId].cost += cost;
        }
      });
    });

    return {
      totalHours,
      totalCost,
      staffBreakdown: Object.values(staffBreakdown).filter(s => s.hours > 0),
      roleBreakdown: Object.values(roleBreakdown).filter(r => r.hours > 0),
      dailyBreakdown,
      peakHourCoverage,
      weekendHours,
      weekendCost,
      weekdayHours,
      weekdayCost,
      peakHours,
      peakCost,
      offPeakHours,
      offPeakCost,
      peakCostPerHour: peakHours > 0 ? peakCost / peakHours : 0,
      offPeakCostPerHour: offPeakHours > 0 ? offPeakCost / offPeakHours : 0
    };
  };

  const StaffModal = () => {
    const [formData, setFormData] = useState(() => {
      if (editingStaff) {
        return {
          name: editingStaff.name || '',
          hourlyRate: editingStaff.hourlyRate || '',
          weekendRate: editingStaff.weekendRate || '',
          employmentType: editingStaff.employmentType || 'FT'
        };
      }
      return { name: '', hourlyRate: '', weekendRate: '', employmentType: 'FT' };
    });

    const handleSave = async () => {
      if (!formData.name || formData.hourlyRate === '' || formData.hourlyRate === null) return;
      
      const hourlyRate = parseFloat(formData.hourlyRate);
      const weekendRate = formData.weekendRate && formData.weekendRate !== '' 
        ? parseFloat(formData.weekendRate) 
        : hourlyRate;
      
      const finalData = {
        name: formData.name,
        hourly_rate: hourlyRate,
        weekend_rate: weekendRate,
        employment_type: formData.employmentType
      };
      
      try {
        if (editingStaff) {
          const updated = await db.updateStaff(editingStaff.id, finalData);
          setStaff(staff.map(s => s.id === editingStaff.id ? {
            id: updated.id,
            name: updated.name,
            hourlyRate: updated.hourly_rate,
            weekendRate: updated.weekend_rate,
            employmentType: updated.employment_type
          } : s));
        } else {
          const created = await db.createStaff(user.id, finalData);
          setStaff([...staff, {
            id: created.id,
            name: created.name,
            hourlyRate: created.hourly_rate,
            weekendRate: created.weekend_rate,
            employmentType: created.employment_type
          }]);
        }
        setShowStaffModal(false);
        setEditingStaff(null);
      } catch (error) {
        console.error('Error saving staff:', error);
        alert('Error saving staff member. Please try again.');
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">{editingStaff ? 'Edit' : 'Add'} Staff</h2>
            <button onClick={() => { setShowStaffModal(false); setEditingStaff(null); }}><X size={24} /></button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input 
                type="text" 
                value={formData.name} 
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} 
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Weekday Hourly Rate ($)</label>
              <input 
                type="number" 
                step="0.01" 
                min="0" 
                value={formData.hourlyRate} 
                onChange={(e) => setFormData(prev => ({ ...prev, hourlyRate: e.target.value }))} 
                className="w-full border rounded px-3 py-2" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Weekend Hourly Rate ($)</label>
              <input 
                type="number" 
                step="0.01" 
                min="0" 
                value={formData.weekendRate || ''} 
                onChange={(e) => setFormData(prev => ({ ...prev, weekendRate: e.target.value }))} 
                placeholder={`${formData.hourlyRate || '0'} (same as weekday)`}
                className="w-full border rounded px-3 py-2" 
              />
              <p className="text-xs text-gray-500 mt-1">Leave blank to use weekday rate</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Employment Type</label>
              <select 
                value={formData.employmentType} 
                onChange={(e) => setFormData(prev => ({ ...prev, employmentType: e.target.value }))} 
                className="w-full border rounded px-3 py-2"
              >
                <option value="FT">Full Time</option>
                <option value="PT">Part Time</option>
                <option value="Casual">Casual</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSave} className="flex-1 bg-blue-600 text-white py-2 rounded">{editingStaff ? 'Update' : 'Add'}</button>
              <button onClick={() => { setShowStaffModal(false); setEditingStaff(null); }} className="px-4 py-2 border rounded">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const TimeSettingsModal = () => {
    const [tempStart, setTempStart] = useState(startHour);
    const [tempEnd, setTempEnd] = useState(endHour);

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Time Range</h2>
            <button onClick={() => setShowTimeSettings(false)}><X size={24} /></button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Start</label>
              <select value={tempStart} onChange={(e) => setTempStart(parseInt(e.target.value))} className="w-full border rounded px-3 py-2">
                {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">End</label>
              <select value={tempEnd} onChange={(e) => setTempEnd(parseInt(e.target.value))} className="w-full border rounded px-3 py-2">
                {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>)}
              </select>
            </div>
            <button onClick={() => { setStartHour(tempStart); setEndHour(tempEnd); setShowTimeSettings(false); }} className="w-full bg-blue-600 text-white py-2 rounded">Apply</button>
          </div>
        </div>
      </div>
    );
  };

  const BusinessSettingsModal = () => {
    const [tempSettings, setTempSettings] = useState(JSON.parse(JSON.stringify(businessSettings)));
    const [activeSettingsTab, setActiveSettingsTab] = useState('hours');

    const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const dayLabels = {
      monday: 'Monday',
      tuesday: 'Tuesday', 
      wednesday: 'Wednesday',
      thursday: 'Thursday',
      friday: 'Friday',
      saturday: 'Saturday',
      sunday: 'Sunday'
    };

    const handleSave = () => {
      setBusinessSettings(tempSettings);
      setShowSettingsModal(false);
    };

    const HoursTab = () => (
      <div className="space-y-4">
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="text-sm font-semibold text-blue-800 mb-2">💡 Operational Hours</div>
          <div className="text-xs text-blue-700">
            Set your business hours for each day. Coverage gaps will only be flagged during these hours.
          </div>
        </div>

        <div className="space-y-3">
          {dayNames.map(day => (
            <div key={day} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <label className="font-semibold text-gray-800 w-28">{dayLabels[day]}</label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tempSettings.operationalHours[day].closed}
                      onChange={(e) => setTempSettings({
                        ...tempSettings,
                        operationalHours: {
                          ...tempSettings.operationalHours,
                          [day]: { ...tempSettings.operationalHours[day], closed: e.target.checked }
                        }
                      })}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-600">Closed</span>
                  </label>
                </div>
              </div>
              
              {!tempSettings.operationalHours[day].closed && (
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-600 mb-1">Opens</label>
                    <input
                      type="time"
                      value={tempSettings.operationalHours[day].open}
                      onChange={(e) => setTempSettings({
                        ...tempSettings,
                        operationalHours: {
                          ...tempSettings.operationalHours,
                          [day]: { ...tempSettings.operationalHours[day], open: e.target.value }
                        }
                      })}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-600 mb-1">Closes</label>
                    <input
                      type="time"
                      value={tempSettings.operationalHours[day].close}
                      onChange={(e) => setTempSettings({
                        ...tempSettings,
                        operationalHours: {
                          ...tempSettings.operationalHours,
                          [day]: { ...tempSettings.operationalHours[day], close: e.target.value }
                        }
                      })}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              const weekdaySettings = tempSettings.operationalHours.monday;
              dayNames.slice(0, 5).forEach(day => {
                tempSettings.operationalHours[day] = { ...weekdaySettings };
              });
              setTempSettings({ ...tempSettings });
            }}
            className="px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-sm font-medium"
          >
            Copy Monday to all weekdays
          </button>
          <button
            onClick={() => {
              const weekendSettings = tempSettings.operationalHours.saturday;
              ['saturday', 'sunday'].forEach(day => {
                tempSettings.operationalHours[day] = { ...weekendSettings };
              });
              setTempSettings({ ...tempSettings });
            }}
            className="px-4 py-2 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded text-sm font-medium"
          >
            Copy Saturday to Sunday
          </button>
        </div>
      </div>
    );

    const CoverageTab = () => (
      <div className="space-y-4">
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="text-sm font-semibold text-blue-800 mb-2">📊 Coverage Requirements</div>
          <div className="text-xs text-blue-700">
            Set minimum staff requirements. The system will alert you when coverage falls below these levels.
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <label className="block text-sm font-semibold text-gray-800 mb-2">
              Minimum Staff Coverage (Regular Hours)
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={tempSettings.minStaffCoverage}
              onChange={(e) => setTempSettings({ ...tempSettings, minStaffCoverage: parseInt(e.target.value) || 1 })}
              className="w-full border rounded px-3 py-2"
            />
            <p className="text-xs text-gray-600 mt-2">
              Minimum number of staff required per time slot during regular hours
            </p>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <label className="block text-sm font-semibold text-gray-800 mb-2">
              Peak Hours Time Range
            </label>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1">
                <label className="block text-xs text-gray-600 mb-1">Start</label>
                <input
                  type="time"
                  value={tempSettings.peakHours.start}
                  onChange={(e) => setTempSettings({
                    ...tempSettings,
                    peakHours: { ...tempSettings.peakHours, start: e.target.value }
                  })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-600 mb-1">End</label>
                <input
                  type="time"
                  value={tempSettings.peakHours.end}
                  onChange={(e) => setTempSettings({
                    ...tempSettings,
                    peakHours: { ...tempSettings.peakHours, end: e.target.value }
                  })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </div>
            <label className="block text-sm font-semibold text-gray-800 mb-2 mt-4">
              Minimum Staff Coverage (Peak Hours)
            </label>
            <input
              type="number"
              min="1"
              max="20"
              value={tempSettings.minPeakStaffCoverage}
              onChange={(e) => setTempSettings({ ...tempSettings, minPeakStaffCoverage: parseInt(e.target.value) || 2 })}
              className="w-full border rounded px-3 py-2"
            />
            <p className="text-xs text-gray-600 mt-2">
              Minimum number of staff required during peak hours (e.g., lunch rush)
            </p>
          </div>
        </div>
      </div>
    );

    const GeneralTab = () => (
      <div className="space-y-4">
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="text-sm font-semibold text-blue-800 mb-2">🏢 Business Information</div>
          <div className="text-xs text-blue-700">
            Customize the app with your business details. This is useful when sharing with other businesses.
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <label className="block text-sm font-semibold text-gray-800 mb-2">
              Business Logo
            </label>
            <div className="space-y-3">
              {tempSettings.logoUrl && (
                <div className="flex items-center justify-center p-4 bg-white rounded-lg border-2 border-gray-200">
                  <img 
                    src={tempSettings.logoUrl} 
                    alt="Business Logo" 
                    className="max-h-24 max-w-full object-contain"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextElementSibling.style.display = 'block';
                    }}
                  />
                  <div style={{ display: 'none' }} className="text-sm text-red-600">
                    Invalid image URL
                  </div>
                </div>
              )}
              <input
                type="text"
                value={tempSettings.logoUrl}
                onChange={(e) => setTempSettings(prev => ({ ...prev, logoUrl: e.target.value }))}
                className="w-full border rounded px-3 py-2"
                placeholder="https://example.com/logo.png"
              />
              <p className="text-xs text-gray-600">
                Enter a URL to your logo image. This will appear in the header and login page.
              </p>
              <p className="text-xs text-gray-500">
                💡 Tip: Upload your logo to a service like Imgur, Cloudinary, or your own website, then paste the direct image URL here.
              </p>
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <label className="block text-sm font-semibold text-gray-800 mb-2">
              Business Name
            </label>
            <input
              type="text"
              value={tempSettings.businessName}
              onChange={(e) => setTempSettings(prev => ({ ...prev, businessName: e.target.value }))}
              className="w-full border rounded px-3 py-2"
              placeholder="Your Business Name"
            />
            <p className="text-xs text-gray-600 mt-2">
              This name appears in the header and exports
            </p>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <label className="block text-sm font-semibold text-gray-800 mb-2">
              Currency Symbol
            </label>
            <input
              type="text"
              value={tempSettings.currency}
              onChange={(e) => setTempSettings(prev => ({ ...prev, currency: e.target.value }))}
              className="w-full border rounded px-3 py-2"
              placeholder="$"
              maxLength="3"
            />
            <p className="text-xs text-gray-600 mt-2">
              Symbol used for all cost displays
            </p>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <label className="block text-sm font-semibold text-gray-800 mb-2">
              Timezone
            </label>
            <select
              value={tempSettings.timezone}
              onChange={(e) => setTempSettings(prev => ({ ...prev, timezone: e.target.value }))}
              className="w-full border rounded px-3 py-2"
            >
              <option value="Australia/Sydney">Australia/Sydney (AEDT)</option>
              <option value="Australia/Melbourne">Australia/Melbourne (AEDT)</option>
              <option value="Australia/Brisbane">Australia/Brisbane (AEST)</option>
              <option value="Australia/Perth">Australia/Perth (AWST)</option>
              <option value="Australia/Adelaide">Australia/Adelaide (ACDT)</option>
              <option value="Pacific/Auckland">New Zealand/Auckland (NZDT)</option>
            </select>
            <p className="text-xs text-gray-600 mt-2">
              Used for date/time displays
            </p>
          </div>
        </div>
      </div>
    );

    const FinancialTab = () => (
      <div className="space-y-4">
        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
          <div className="text-sm font-semibold text-green-800 mb-2">💰 Financial Settings</div>
          <div className="text-xs text-green-700">
            Set your target labor cost percentage and other financial goals. These help track your business performance.
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <label className="block text-sm font-semibold text-gray-800 mb-2">
              Target Labor Cost Percentage
            </label>
            <div className="flex items-center gap-4">
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={tempSettings.targetLaborPercentage || 30}
                onChange={(e) => setTempSettings(prev => ({ 
                  ...prev, 
                  targetLaborPercentage: parseFloat(e.target.value) || 30 
                }))}
                className="w-32 border-2 border-gray-300 rounded-lg px-4 py-2 text-lg font-semibold focus:border-green-500 focus:outline-none"
              />
              <span className="text-2xl font-bold text-gray-700">%</span>
            </div>
            <p className="text-xs text-gray-600 mt-3">
              Your ideal labor cost as a percentage of revenue. Industry standard for hospitality is 25-35%.
            </p>
            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-xs font-semibold text-blue-800 mb-2">💡 Quick Guide:</div>
              <div className="text-xs text-blue-700 space-y-1">
                <div>• <strong>25-30%:</strong> Excellent - Very efficient operation</div>
                <div>• <strong>30-35%:</strong> Good - Industry standard</div>
                <div>• <strong>35-40%:</strong> Acceptable - Room for improvement</div>
                <div>• <strong>40%+:</strong> High - Review scheduling and rates</div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border-2 border-green-200">
            <div className="flex items-start gap-3">
              <div className="text-2xl">📊</div>
              <div>
                <div className="text-sm font-semibold text-gray-800 mb-1">How to Use Labor Percentage Tracking</div>
                <ol className="text-xs text-gray-700 space-y-1 ml-4 list-decimal">
                  <li>Go to Analytics → Revenue tab</li>
                  <li>Enter your daily projected revenue</li>
                  <li>Add any other revenue (delivery, catering, etc.)</li>
                  <li>See your labor cost % automatically calculated</li>
                  <li>Track trends over time to optimize scheduling</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>
    );

    const RolesTab = () => {
      const [editingRole, setEditingRole] = useState(null);
      const [roleForm, setRoleForm] = useState({ name: '', code: '', color: '#3B82F6' });

      const handleAddRole = () => {
        const newRole = {
          id: `role-${Date.now()}`,
          name: roleForm.name,
          code: roleForm.code,
          color: roleForm.color
        };
        
        const updatedRoles = [...roles, newRole];
        setRoles(updatedRoles);
        setTempSettings(prev => ({ ...prev, roles: updatedRoles }));
        setRoleForm({ name: '', code: '', color: '#3B82F6' });
      };

      const handleEditRole = (role) => {
        setEditingRole(role.id);
        setRoleForm({ name: role.name, code: role.code, color: role.color });
      };

      const handleUpdateRole = () => {
        const updatedRoles = roles.map(r =>
          r.id === editingRole
            ? { ...r, name: roleForm.name, code: roleForm.code, color: roleForm.color }
            : r
        );
        setRoles(updatedRoles);
        setTempSettings(prev => ({ ...prev, roles: updatedRoles }));
        setEditingRole(null);
        setRoleForm({ name: '', code: '', color: '#3B82F6' });
      };

      const handleDeleteRole = (roleId) => {
        if (!window.confirm('Delete this role? This cannot be undone.')) return;
        
        const updatedRoles = roles.filter(r => r.id !== roleId);
        setRoles(updatedRoles);
        setTempSettings(prev => ({ ...prev, roles: updatedRoles }));
      };

      const predefinedColors = [
        '#F97316', // Orange
        '#2563EB', // Blue
        '#FB923C', // Light Orange
        '#EA580C', // Dark Orange
        '#1D4ED8', // Dark Blue
        '#3B82F6', // Medium Blue
        '#8B5CF6', // Purple
        '#10B981', // Green
        '#EF4444', // Red
        '#F59E0B', // Amber
        '#EC4899', // Pink
        '#14B8A6'  // Teal
      ];

      return (
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-sm font-semibold text-blue-800 mb-2">🎭 Customize Roles</div>
            <div className="text-xs text-blue-700">
              Add, edit, or remove roles to match your business. Roles appear as buttons when scheduling staff.
            </div>
          </div>

          {/* Add/Edit Role Form */}
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">
              {editingRole ? 'Edit Role' : 'Add New Role'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Role Name</label>
                <input
                  type="text"
                  value={roleForm.name}
                  onChange={(e) => setRoleForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Barista"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Code (1-4 letters)</label>
                <input
                  type="text"
                  value={roleForm.code}
                  onChange={(e) => setRoleForm(prev => ({ ...prev, code: e.target.value.toUpperCase().slice(0, 4) }))}
                  placeholder="e.g., B"
                  maxLength={4}
                  className="w-full px-3 py-2 border rounded-lg text-sm uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={roleForm.color}
                    onChange={(e) => setRoleForm(prev => ({ ...prev, color: e.target.value }))}
                    className="w-12 h-10 rounded cursor-pointer"
                  />
                  <select
                    value={roleForm.color}
                    onChange={(e) => setRoleForm(prev => ({ ...prev, color: e.target.value }))}
                    className="flex-1 px-3 py-2 border rounded-lg text-sm"
                  >
                    {predefinedColors.map(color => (
                      <option key={color} value={color}>
                        {color}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              {editingRole ? (
                <>
                  <button
                    onClick={handleUpdateRole}
                    disabled={!roleForm.name || !roleForm.code}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Update Role
                  </button>
                  <button
                    onClick={() => {
                      setEditingRole(null);
                      setRoleForm({ name: '', code: '', color: '#3B82F6' });
                    }}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={handleAddRole}
                  disabled={!roleForm.name || !roleForm.code}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Role
                </button>
              )}
            </div>
          </div>

          {/* Current Roles List */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-800">Current Roles ({roles.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {roles.map(role => (
                <div
                  key={role.id}
                  className="flex items-center justify-between p-3 bg-white border-2 border-gray-200 rounded-lg hover:border-gray-300 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold shadow-md"
                      style={{ backgroundColor: role.color }}
                    >
                      {role.code}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-800">{role.name}</div>
                      <div className="text-xs text-gray-500">Code: {role.code} · {role.color}</div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEditRole(role)}
                      className="p-2 hover:bg-blue-50 text-blue-600 rounded transition-all"
                      title="Edit role"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteRole(role.id)}
                      className="p-2 hover:bg-red-50 text-red-600 rounded transition-all"
                      title="Delete role"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
            <div className="flex items-start gap-2">
              <span className="text-lg">⚠️</span>
              <div className="text-xs text-amber-800">
                <strong>Note:</strong> Deleting a role will not remove existing schedule entries using that role. They will still display with the original color.
              </div>
            </div>
          </div>
        </div>
      );
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl">
          <div className="bg-gradient-to-r from-blue-600 to-orange-500 px-8 py-6 flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-white">Business Settings</h2>
              <p className="text-blue-50 text-sm mt-1">Configure your operational hours and coverage requirements</p>
            </div>
            <button 
              onClick={() => setShowSettingsModal(false)}
              className="text-white hover:bg-white/20 rounded-full p-2 transition-all"
            >
              <X size={24} />
            </button>
          </div>

          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveSettingsTab('hours')}
              className={`flex-1 px-6 py-4 font-semibold text-sm transition-all ${
                activeSettingsTab === 'hours'
                  ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              🕐 Operational Hours
            </button>
            <button
              onClick={() => setActiveSettingsTab('coverage')}
              className={`flex-1 px-6 py-4 font-semibold text-sm transition-all ${
                activeSettingsTab === 'coverage'
                  ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              📊 Coverage Rules
            </button>
            <button
              onClick={() => setActiveSettingsTab('general')}
              className={`flex-1 px-6 py-4 font-semibold text-sm transition-all ${
                activeSettingsTab === 'general'
                  ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              🏢 General
            </button>
            <button
              onClick={() => setActiveSettingsTab('financial')}
              className={`flex-1 px-6 py-4 font-semibold text-sm transition-all ${
                activeSettingsTab === 'financial'
                  ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              💰 Financial
            </button>
            <button
              onClick={() => setActiveSettingsTab('roles')}
              className={`flex-1 px-6 py-4 font-semibold text-sm transition-all ${
                activeSettingsTab === 'roles'
                  ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              🎭 Roles
            </button>
          </div>
          
          <div className="p-8 overflow-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
            {activeSettingsTab === 'hours' && <HoursTab />}
            {activeSettingsTab === 'coverage' && <CoverageTab />}
            {activeSettingsTab === 'general' && <GeneralTab />}
            {activeSettingsTab === 'financial' && <FinancialTab />}
            {activeSettingsTab === 'roles' && <RolesTab />}
          </div>

          <div className="px-8 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
            <button
              onClick={() => setShowSettingsModal(false)}
              className="px-6 py-2 border-2 border-gray-300 rounded-xl font-semibold hover:bg-gray-100 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-gradient-to-r from-blue-600 to-orange-500 hover:from-blue-500 hover:to-orange-400 text-white rounded-xl font-semibold transition-all shadow-lg"
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    );
  };
 const QuickFillModal = () => {
  // Hooks must be at the top level of the component
  const [endTime, setEndTime] = useState('');

  useEffect(() => {
    if (quickFillData?.startTime) {
      setEndTime(quickFillData.startTime);
    }
  }, [quickFillData]);

  // Early return AFTER hooks
  if (!quickFillData) return null;

  const availableEndTimes = timeSlots.filter(t => t > quickFillData.startTime);

  const handleQuickFill = () => {
    saveToHistory(schedule);

    const newSchedule = { ...schedule };
    const startIdx = timeSlots.indexOf(quickFillData.startTime);
    const endIdx = timeSlots.indexOf(endTime);

    // Fill from start up to (but not including) end time
    for (let i = startIdx; i < endIdx; i++) {
      const key = getScheduleKey(quickFillData.dateKey, quickFillData.staffId, timeSlots[i]);
      newSchedule[key] = {
        roleId: selectedRole.id,
        roleCode: selectedRole.code,
        roleColor: selectedRole.color,
      };
    }

    setSchedule(newSchedule);
    setShowQuickFillModal(false);
    setQuickFillData(null);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Quick Fill Shift</h2>
          <button onClick={() => { setShowQuickFillModal(false); setQuickFillData(null); }}>
            <X size={24} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-blue-50 p-3 rounded">
            <div className="text-sm font-medium">
              Role: <span style={{ backgroundColor: selectedRole.color }} className="px-2 py-1 rounded text-white ml-2">{selectedRole.code}</span>
            </div>
            <div className="text-sm mt-2">Start: <strong>{quickFillData.startTime}</strong></div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">End Time</label>
            <select
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              {availableEndTimes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="flex gap-2">
            <button onClick={handleQuickFill} className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
              Fill Shift
            </button>
            <button onClick={() => { setShowQuickFillModal(false); setQuickFillData(null); }} className="px-4 py-2 border rounded">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
  const deleteStaff = async (staffId) => {
    const staffMember = staff.find(s => s.id === staffId);
    if (!window.confirm(`Archive ${staffMember?.name || 'this staff member'}? They will be removed from the current roster but their historical data will be preserved. You can restore them later from the archived staff list.`)) return;

    try {
      await db.deleteStaff(staffId);
      // Mark as inactive locally - don't remove schedule data
      setStaff(staff.map(s => s.id === staffId ? { ...s, active: false } : s));
      setStaffOrder(staffOrder.filter(id => id !== staffId));
    } catch (error) {
      console.error('Error archiving staff:', error);
      alert('Error archiving staff member. Please try again.');
    }
  };

  const restoreStaff = async (staffId) => {
    try {
      await db.restoreStaff(staffId);
      setStaff(staff.map(s => s.id === staffId ? { ...s, active: true } : s));
      // Add back to staff order
      if (!staffOrder.includes(staffId)) {
        setStaffOrder([...staffOrder, staffId]);
      }
    } catch (error) {
      console.error('Error restoring staff:', error);
      alert('Error restoring staff member. Please try again.');
    }
  };

  const activeStaff = useMemo(() => staff.filter(s => s.active !== false), [staff]);
  const archivedStaff = useMemo(() => staff.filter(s => s.active === false), [staff]);

  const getOrderedStaff = () => {
    if (staffOrder.length === 0) {
      if (activeStaff.length > 0) setStaffOrder(activeStaff.map(s => s.id));
      return activeStaff;
    }
    const ordered = [];
    staffOrder.forEach(id => {
      const s = activeStaff.find(st => st.id === id);
      if (s) ordered.push(s);
    });
    // Add any active staff not in the order (newly added)
    activeStaff.forEach(s => {
      if (!ordered.find(o => o.id === s.id)) {
        ordered.push(s);
      }
    });
    return ordered;
  };

  const orderedStaff = getOrderedStaff();

  const handleStaffDragStart = (staffId) => setDraggedStaffId(staffId);
  
  const handleStaffDragOver = (e, targetStaffId) => {
    e.preventDefault();
    if (!draggedStaffId || draggedStaffId === targetStaffId) return;
    
    const currentOrder = [...staffOrder];
    const dragIdx = currentOrder.indexOf(draggedStaffId);
    const targetIdx = currentOrder.indexOf(targetStaffId);
    
    if (dragIdx === -1 || targetIdx === -1) return;
    
    currentOrder.splice(dragIdx, 1);
    currentOrder.splice(targetIdx, 0, draggedStaffId);
    setStaffOrder(currentOrder);
  };

  const handleStaffDragEnd = () => setDraggedStaffId(null);

  const copyDay = (dateKey) => {
    setCopiedDay(dateKey);
  };

  const pasteDay = (targetDateKey) => {
    if (!copiedDay) return;
    
    saveToHistory(schedule);
    
    const newSchedule = { ...schedule };
    
    staff.forEach(staffMember => {
      timeSlots.forEach(timeSlot => {
        const sourceKey = getScheduleKey(copiedDay, staffMember.id, timeSlot);
        const targetKey = getScheduleKey(targetDateKey, staffMember.id, timeSlot);
        
        if (schedule[sourceKey]) {
          newSchedule[targetKey] = { ...schedule[sourceKey] };
        }
      });
    });
    
    setSchedule(newSchedule);
  };

  const clearDay = (dateKey) => {
    setClearTarget({ type: 'day', dateKey });
    setShowClearModal(true);
  };

  const clearWeek = () => {
    setClearTarget({ type: 'week' });
    setShowClearModal(true);
  };

  const confirmClear = () => {
    saveToHistory(schedule);
    
    const newSchedule = { ...schedule };
    
    if (clearTarget.type === 'day') {
      // Clear specific day
      staff.forEach(staffMember => {
        timeSlots.forEach(timeSlot => {
          const key = getScheduleKey(clearTarget.dateKey, staffMember.id, timeSlot);
          delete newSchedule[key];
        });
      });
    } else if (clearTarget.type === 'week') {
      // Clear entire visible week
      dates.forEach(date => {
        const dateKey = formatDateKey(date);
        staff.forEach(staffMember => {
          timeSlots.forEach(timeSlot => {
            const key = getScheduleKey(dateKey, staffMember.id, timeSlot);
            delete newSchedule[key];
          });
        });
      });
    }
    
    setSchedule(newSchedule);
    setShowClearModal(false);
    setClearTarget(null);
  };

  const deleteShift = () => {
    if (!contextMenu) return;
    
    setSchedule(prevSchedule => {
      // Save current state to history before deleting
      saveToHistory(prevSchedule);
      
      const clickedKey = getScheduleKey(contextMenu.dateKey, contextMenu.staffId, contextMenu.timeSlot);
      const clickedShift = prevSchedule[clickedKey];
      
      if (!clickedShift) {
        return prevSchedule;
      }
      
      const newSchedule = { ...prevSchedule };
      const clickedTimeIdx = timeSlots.indexOf(contextMenu.timeSlot);
      
      // Find the start of this continuous shift block by going backwards
      let shiftStartIdx = clickedTimeIdx;
      while (shiftStartIdx > 0) {
        const prevTimeSlot = timeSlots[shiftStartIdx - 1];
        const prevKey = getScheduleKey(contextMenu.dateKey, contextMenu.staffId, prevTimeSlot);
        const prevShift = prevSchedule[prevKey];
        
        // Stop if no shift or different role
        if (!prevShift || prevShift.roleId !== clickedShift.roleId) {
          break;
        }
        shiftStartIdx--;
      }
      
      // Find the end of this continuous shift block by going forwards
      let shiftEndIdx = clickedTimeIdx;
      while (shiftEndIdx < timeSlots.length - 1) {
        const nextTimeSlot = timeSlots[shiftEndIdx + 1];
        const nextKey = getScheduleKey(contextMenu.dateKey, contextMenu.staffId, nextTimeSlot);
        const nextShift = prevSchedule[nextKey];
        
        // Stop if no shift or different role
        if (!nextShift || nextShift.roleId !== clickedShift.roleId) {
          break;
        }
        shiftEndIdx++;
      }
      
      // Delete all time slots from start to end of this shift
      for (let i = shiftStartIdx; i <= shiftEndIdx; i++) {
        const timeSlot = timeSlots[i];
        const keyToDelete = getScheduleKey(contextMenu.dateKey, contextMenu.staffId, timeSlot);
        delete newSchedule[keyToDelete];
      }
      
      return newSchedule;
    });
    
    setContextMenu(null);
  };

  // Template Creation Modal
  const TemplateModal = () => {
    const [templateName, setTemplateName] = useState('');

    const handleSave = () => {
      if (!templateName.trim()) return;
      saveTemplate(templateName);
      setTemplateName('');
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Save Shift Template</h2>
            <button onClick={() => { setShowTemplateModal(false); setSelectedTemplate(null); }}>
              <X size={24} />
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Template Name</label>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="w-full border rounded px-3 py-2"
                placeholder="e.g., Morning Barista, Lunch Rush"
                autoFocus
              />
            </div>
            {selectedTemplate && (
              <div className="p-3 bg-gray-50 rounded text-sm">
                <div className="font-semibold mb-1">Template Details:</div>
                <div>Role: <span style={{ color: selectedTemplate.role.color }} className="font-bold">{selectedTemplate.role.name}</span></div>
                <div>Time: {selectedTemplate.startTime} - {selectedTemplate.endTime}</div>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={!templateName.trim()}
                className="flex-1 bg-blue-600 text-white py-2 rounded disabled:opacity-50"
              >
                Save Template
              </button>
              <button
                onClick={() => { setShowTemplateModal(false); setSelectedTemplate(null); }}
                className="px-4 py-2 border rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Template Menu/Picker
  const TemplateMenu = () => {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50" onClick={() => setShowTemplateMenu(false)}>
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 flex justify-between items-center">
            <h2 className="text-xl font-bold text-white">Shift Templates</h2>
            <button onClick={() => setShowTemplateMenu(false)} className="text-white hover:bg-white/20 rounded-full p-1">
              <X size={24} />
            </button>
          </div>

          {shiftTemplates.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <div className="text-4xl mb-2">📋</div>
              <p className="mb-2">No templates yet!</p>
              <p className="text-sm">Right-click on a shift to create your first template.</p>
            </div>
          ) : (
            <div className="overflow-auto max-h-[calc(80vh-120px)]">
              <div className="p-4 space-y-2">
                {shiftTemplates.map(template => (
                  <div
                    key={template.id}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedTemplate?.id === template.id && templateMode
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                    }`}
                    onClick={() => {
                      setSelectedTemplate(template);
                      setTemplateMode(true);
                      setShowTemplateMenu(false);
                      setSelectedRole(null); // Disable paint mode
                    }}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-bold text-lg mb-1">{template.name}</div>
                        <div className="flex items-center gap-2 text-sm">
                          <span
                            className="px-2 py-1 rounded text-white font-bold"
                            style={{ backgroundColor: template.roleColor }}
                          >
                            {template.roleCode}
                          </span>
                          <span className="text-gray-600">{template.startTime} - {template.endTime}</span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Delete template "${template.name}"?`)) {
                            deleteTemplate(template.id);
                          }
                        }}
                        className="p-2 hover:bg-red-100 rounded"
                        title="Delete template"
                      >
                        <Trash2 size={16} className="text-red-600" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="px-6 py-4 bg-gray-50 border-t text-sm text-gray-600">
            💡 Click a template to enter apply mode, then click on the roster to place it.
          </div>
        </div>
      </div>
    );
  };

  const ContextMenu = () => {
    if (!contextMenu) return null;
    
    const staffMember = staff.find(s => s.id === contextMenu.staffId);
    
    return (
      <div 
        className="fixed bg-white rounded-lg shadow-2xl border-2 border-gray-200 py-2 z-50 min-w-[200px]"
        style={{ 
          left: `${contextMenu.x}px`, 
          top: `${contextMenu.y}px`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 py-2 border-b border-gray-200">
          <div className="text-xs font-semibold text-gray-500">
            {staffMember?.name}
          </div>
          <div className="text-xs text-gray-400">{contextMenu.timeSlot}</div>
        </div>
        
        {/* Always show delete if there's a shift, regardless of selected role */}
        {contextMenu.hasShift && (
          <button
            onClick={deleteShift}
            className="w-full px-4 py-2 text-left hover:bg-red-50 flex items-center gap-2 text-red-600 font-medium"
          >
            <Trash2 size={16} />
            Delete Shift
          </button>
        )}

        {contextMenu.hasShift && (
          <button
            onClick={() => {
              const key = getScheduleKey(contextMenu.dateKey, contextMenu.staffId, contextMenu.timeSlot);
              const shift = schedule[key];
              if (shift) {
                const role = roles.find(r => r.id === shift.roleId);
                // Find start and end times of continuous shift
                let startTime = contextMenu.timeSlot;
                let endTime = contextMenu.timeSlot;
                
                // Find the earliest start time for this shift
                let currentSlot = contextMenu.timeSlot;
                while (true) {
                  const slotIndex = timeSlots.indexOf(currentSlot);
                  if (slotIndex <= 0) break;
                  const prevSlot = timeSlots[slotIndex - 1];
                  const prevKey = getScheduleKey(contextMenu.dateKey, contextMenu.staffId, prevSlot);
                  if (schedule[prevKey]?.roleId === shift.roleId) {
                    startTime = prevSlot;
                    currentSlot = prevSlot;
                  } else {
                    break;
                  }
                }
                
                // Find the latest end time for this shift
                currentSlot = contextMenu.timeSlot;
                while (true) {
                  const slotIndex = timeSlots.indexOf(currentSlot);
                  if (slotIndex >= timeSlots.length - 1) break;
                  const nextSlot = timeSlots[slotIndex + 1];
                  const nextKey = getScheduleKey(contextMenu.dateKey, contextMenu.staffId, nextSlot);
                  if (schedule[nextKey]?.roleId === shift.roleId) {
                    endTime = nextSlot;
                    currentSlot = nextSlot;
                  } else {
                    break;
                  }
                }
                
                // Add interval to end time to get actual end
                const [endHour, endMin] = endTime.split(':').map(Number);
                const endMinutes = endHour * 60 + endMin + timeInterval;
                const finalEndHour = Math.floor(endMinutes / 60);
                const finalEndMin = endMinutes % 60;
                endTime = `${finalEndHour.toString().padStart(2, '0')}:${finalEndMin.toString().padStart(2, '0')}`;
                
                createTemplateFromSelection(
                  contextMenu.dateKey,
                  contextMenu.staffId,
                  startTime,
                  endTime,
                  role
                );
              }
              setContextMenu(null);
            }}
            className="w-full px-4 py-2 text-left hover:bg-purple-50 flex items-center gap-2 text-purple-600 font-medium"
          >
            <Copy size={16} />
            Save as Template
          </button>
        )}
        
        {selectedRole && selectedRole.id !== 'eraser' && (
          <button
            onClick={() => {
              setQuickFillData({ 
                dateKey: contextMenu.dateKey, 
                staffId: contextMenu.staffId, 
                startTime: contextMenu.timeSlot 
              });
              setShowQuickFillModal(true);
              setContextMenu(null);
            }}
            className="w-full px-4 py-2 text-left hover:bg-blue-50 flex items-center gap-2 text-blue-600 font-medium"
          >
            <Clock size={16} />
            Quick Fill Shift
          </button>
        )}
      </div>
    );
  };

  // Staff Roster View Component - shows individual staff schedules
  const TutorialOverlay = () => {
    if (!showTutorial) return null;

    const tutorialSteps = [
      {
        title: "Welcome to Recess Roster! 👋",
        content: "Let's take a quick tour to get you started. This tutorial will show you how to create your first staff schedule in just a few steps.",
        highlight: null,
        position: "center"
      },
      {
        title: "Step 1: Add Your Staff",
        content: "Click the 'Add Staff' button to add your team members. You'll enter their name, hourly rate, and employment type.",
        highlight: "addStaffButton",
        position: "bottom"
      },
      {
        title: "Step 2: Select a Role",
        content: "Choose a role from the paint mode bar (like Barista, FOH, Chef). This is what you'll assign to staff members.",
        highlight: "paintModeBar",
        position: "bottom"
      },
      {
        title: "Step 3: Paint the Schedule",
        content: "Click and drag on the grid to assign shifts. Each cell represents a time slot. Click once or drag to fill multiple slots!",
        highlight: "scheduleGrid",
        position: "top"
      },
      {
        title: "Undo & Eraser",
        content: "Made a mistake? Press Ctrl+Z to undo, or click the Eraser button to remove shifts.",
        highlight: "undoButtons",
        position: "bottom"
      },
      {
        title: "Auto-Save",
        content: "Your schedule auto-saves every second! Look for the green 'Auto-saved' indicator in the top bar.",
        highlight: "autoSaveIndicator",
        position: "bottom"
      },
      {
        title: "Need Help Anytime?",
        content: "Click the '?' help button in the top right corner to access guides, FAQs, and replay this tutorial.",
        highlight: "helpButton",
        position: "bottom"
      },
      {
        title: "You're All Set! 🎉",
        content: "That's it! Start adding staff and creating your schedule. You can always access help by clicking the '?' button.",
        highlight: null,
        position: "center"
      }
    ];

    const currentStep = tutorialSteps[tutorialStep];
    const isLastStep = tutorialStep === tutorialSteps.length - 1;
    const isFirstStep = tutorialStep === 0;

    const completeTutorial = () => {
      localStorage.setItem(`tutorial_completed_${user.id}`, 'true');
      setShowTutorial(false);
      setTutorialStep(0);
    };

    return (
      <div className="fixed inset-0 z-[100]">
        {/* Semi-transparent overlay */}
        <div className="absolute inset-0 bg-black bg-opacity-60" onClick={completeTutorial} />
        
        {/* Tutorial card */}
        <div className={`absolute ${
          currentStep.position === 'center' 
            ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' 
            : currentStep.position === 'bottom'
            ? 'top-32 left-1/2 -translate-x-1/2'
            : 'bottom-32 left-1/2 -translate-x-1/2'
        } bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg z-[101]`}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-xs font-semibold text-blue-600 mb-1">
                Step {tutorialStep + 1} of {tutorialSteps.length}
              </div>
              <h3 className="text-xl font-bold text-gray-800">{currentStep.title}</h3>
            </div>
            <button
              onClick={completeTutorial}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={24} />
            </button>
          </div>
          
          <p className="text-gray-700 mb-6 leading-relaxed">{currentStep.content}</p>
          
          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
            <div 
              className="bg-gradient-to-r from-blue-600 to-orange-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((tutorialStep + 1) / tutorialSteps.length) * 100}%` }}
            />
          </div>
          
          <div className="flex gap-3">
            {!isFirstStep && (
              <button
                onClick={() => setTutorialStep(tutorialStep - 1)}
                className="px-4 py-2 border-2 border-gray-300 rounded-xl font-semibold hover:bg-gray-100 transition-all"
              >
                Back
              </button>
            )}
            <button
              onClick={() => {
                if (isLastStep) {
                  completeTutorial();
                } else {
                  setTutorialStep(tutorialStep + 1);
                }
              }}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-orange-500 hover:from-blue-500 hover:to-orange-400 text-white rounded-xl font-semibold transition-all shadow-lg"
            >
              {isLastStep ? "Let's Go!" : 'Next'}
            </button>
            <button
              onClick={completeTutorial}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium transition-all"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    );
  };

  const HelpModal = () => {
    const [activeTab, setActiveTab] = useState('quickstart');
    
    if (!showHelpModal) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl">
          <div className="bg-gradient-to-r from-blue-600 to-orange-500 px-8 py-6 flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-white">Help & Support</h2>
              <p className="text-blue-50 text-sm mt-1">Guides, FAQs, and quick tips</p>
            </div>
            <button 
              onClick={() => setShowHelpModal(false)}
              className="text-white hover:bg-white/20 rounded-full p-2 transition-all"
            >
              <X size={24} />
            </button>
          </div>

          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('quickstart')}
              className={`flex-1 px-6 py-4 font-semibold text-sm transition-all ${
                activeTab === 'quickstart'
                  ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              🚀 Quick Start
            </button>
            <button
              onClick={() => setActiveTab('faq')}
              className={`flex-1 px-6 py-4 font-semibold text-sm transition-all ${
                activeTab === 'faq'
                  ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              ❓ FAQ
            </button>
            <button
              onClick={() => setActiveTab('keyboard')}
              className={`flex-1 px-6 py-4 font-semibold text-sm transition-all ${
                activeTab === 'keyboard'
                  ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              ⌨️ Shortcuts
            </button>
          </div>

          <div className="p-8 overflow-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
            {activeTab === 'quickstart' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-600 w-8 h-8 rounded-full flex items-center justify-center font-bold">1</span>
                    Add Your Staff
                  </h3>
                  <p className="text-gray-700 ml-10">Click <strong>"Add Staff"</strong> button → Enter name, hourly rate, and employment type → Save</p>
                </div>

                <div>
                  <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-600 w-8 h-8 rounded-full flex items-center justify-center font-bold">2</span>
                    Select a Role
                  </h3>
                  <p className="text-gray-700 ml-10">Click a role button (B, FOH, C, etc.) in the paint mode bar below the header</p>
                </div>

                <div>
                  <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-600 w-8 h-8 rounded-full flex items-center justify-center font-bold">3</span>
                    Paint the Schedule
                  </h3>
                  <p className="text-gray-700 ml-10">Click and drag on the grid to assign shifts. Each cell = a time slot</p>
                </div>

                <div>
                  <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-600 w-8 h-8 rounded-full flex items-center justify-center font-bold">4</span>
                    Use Eraser or Undo
                  </h3>
                  <p className="text-gray-700 ml-10">Click <strong>Eraser</strong> button and paint to remove shifts, or press <strong>Ctrl+Z</strong> to undo</p>
                </div>

                <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 mt-6">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">✅</span>
                    <div>
                      <h4 className="font-bold text-green-800 mb-1">Auto-Save Enabled</h4>
                      <p className="text-sm text-green-700">Your schedule saves automatically every second. Look for the green "Auto-saved" indicator!</p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowHelpModal(false);
                    setShowTutorial(true);
                    setTutorialStep(0);
                  }}
                  className="w-full mt-4 px-4 py-3 bg-gradient-to-r from-blue-600 to-orange-500 hover:from-blue-500 hover:to-orange-400 text-white rounded-xl font-semibold transition-all"
                >
                  🎓 Replay Tutorial
                </button>
              </div>
            )}

            {activeTab === 'faq' && (
              <div className="space-y-4">
                <details className="bg-gray-50 rounded-lg p-4 cursor-pointer">
                  <summary className="font-semibold text-gray-800">How do I delete a shift?</summary>
                  <p className="mt-2 text-gray-700">Right-click on any shift → Click "Delete Shift". Or use the Eraser button and click the shift.</p>
                </details>

                <details className="bg-gray-50 rounded-lg p-4 cursor-pointer">
                  <summary className="font-semibold text-gray-800">Can I copy shifts between days?</summary>
                  <p className="mt-2 text-gray-700">Yes! Click the copy icon above any day → Click paste icon above another day.</p>
                </details>

                <details className="bg-gray-50 rounded-lg p-4 cursor-pointer">
                  <summary className="font-semibold text-gray-800">How do I change the time intervals?</summary>
                  <p className="mt-2 text-gray-700">Use the buttons in the header: <strong>15m, 30m, 1h</strong>. This only changes the view - all data is stored at 15-minute precision.</p>
                </details>

                <details className="bg-gray-50 rounded-lg p-4 cursor-pointer">
                  <summary className="font-semibold text-gray-800">What if I make a mistake?</summary>
                  <p className="mt-2 text-gray-700">Press <strong>Ctrl+Z</strong> (or Cmd+Z on Mac) to undo. You can undo up to 50 actions!</p>
                </details>

                <details className="bg-gray-50 rounded-lg p-4 cursor-pointer">
                  <summary className="font-semibold text-gray-800">How do I customize roles?</summary>
                  <p className="mt-2 text-gray-700">Go to <strong>Settings → 🎭 Roles</strong> tab. You can add, edit, or delete roles to match your business.</p>
                </details>

                <details className="bg-gray-50 rounded-lg p-4 cursor-pointer">
                  <summary className="font-semibold text-gray-800">How do I track labor costs?</summary>
                  <p className="mt-2 text-gray-700">Go to <strong>Analytics → 💰 Revenue</strong> tab. Enter daily revenue and see your labor cost percentage automatically calculated.</p>
                </details>

                <details className="bg-gray-50 rounded-lg p-4 cursor-pointer">
                  <summary className="font-semibold text-gray-800">Can I export schedules?</summary>
                  <p className="mt-2 text-gray-700">Yes! Click <strong>Export Schedules</strong> button → Select staff member → Copy formatted schedule to clipboard.</p>
                </details>

                <details className="bg-gray-50 rounded-lg p-4 cursor-pointer">
                  <summary className="font-semibold text-gray-800">Is my data safe?</summary>
                  <p className="mt-2 text-gray-700">Yes! Your data is stored in Supabase (enterprise-grade database) with automatic backups. Plus, localStorage backups protect against accidental data loss.</p>
                </details>
              </div>
            )}

            {activeTab === 'keyboard' && (
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-800">Undo</span>
                    <kbd className="px-3 py-1 bg-white border-2 border-gray-300 rounded font-mono text-sm">Ctrl+Z</kbd>
                  </div>
                  <p className="text-sm text-gray-600">Undo last action (up to 50 actions)</p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-800">Redo</span>
                    <kbd className="px-3 py-1 bg-white border-2 border-gray-300 rounded font-mono text-sm">Ctrl+Shift+Z</kbd>
                  </div>
                  <p className="text-sm text-gray-600">Redo previously undone action</p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-800">Save Revenue (inline)</span>
                    <kbd className="px-3 py-1 bg-white border-2 border-gray-300 rounded font-mono text-sm">Enter</kbd>
                  </div>
                  <p className="text-sm text-gray-600">Save when editing revenue cells</p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-800">Cancel Edit</span>
                    <kbd className="px-3 py-1 bg-white border-2 border-gray-300 rounded font-mono text-sm">Escape</kbd>
                  </div>
                  <p className="text-sm text-gray-600">Cancel inline editing without saving</p>
                </div>

                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mt-6">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">💡</span>
                    <div>
                      <h4 className="font-bold text-blue-800 mb-1">Pro Tip</h4>
                      <p className="text-sm text-blue-700">Click and drag to paint multiple shifts at once! Much faster than clicking each cell individually.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="px-8 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
            <p className="text-sm text-gray-600">Need more help? Check the full documentation.</p>
            <button
              onClick={() => setShowHelpModal(false)}
              className="px-6 py-2 bg-gradient-to-r from-blue-600 to-orange-500 text-white rounded-xl font-semibold hover:from-blue-500 hover:to-orange-400 transition-all"
            >
              Got it!
            </button>
          </div>
        </div>
      </div>
    );
  };

  const MobileView = () => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    
    const weekDates = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      return date;
    });

    const getStaffScheduleForDate = (staffId, date) => {
      const dateKey = formatDateKey(date);
      const shifts = [];
      let currentShift = null;

      timeSlots.forEach(slot => {
        const key = getScheduleKey(dateKey, staffId, slot);
        const shift = schedule[key];

        if (shift) {
          if (!currentShift || currentShift.roleId !== shift.roleId) {
            if (currentShift) shifts.push(currentShift);
            currentShift = {
              roleId: shift.roleId,
              roleCode: shift.roleCode,
              roleColor: shift.roleColor,
              startTime: slot,
              endTime: slot
            };
          } else {
            currentShift.endTime = slot;
          }
        } else if (currentShift) {
          shifts.push(currentShift);
          currentShift = null;
        }
      });

      if (currentShift) shifts.push(currentShift);
      return shifts;
    };

    const calculateEndTime = (startTime) => {
      const [hour, min] = startTime.split(':').map(Number);
      const totalMin = hour * 60 + min + timeInterval;
      const endHour = Math.floor(totalMin / 60);
      const endMin = totalMin % 60;
      return `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-orange-50 pb-20">
        {/* Mobile Header */}
        <div className="bg-white border-b-2 border-gray-200 shadow-lg sticky top-0 z-40">
          <div className="px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-2 rounded-xl">
                  <Users size={20} className="text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-800">{businessSettings.businessName}</h1>
                  <p className="text-xs text-gray-500">Mobile View</p>
                </div>
              </div>
              <button 
                onClick={signOut} 
                className="p-2 text-gray-600 hover:text-red-600 rounded-lg transition-all"
              >
                <LogOut size={20} />
              </button>
            </div>

            {/* Mobile Navigation */}
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
              <button
                onClick={() => setActiveView('staff-view')}
                className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeView === 'staff-view'
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                📅 My Schedule
              </button>
              <button
                onClick={() => setShowHelpModal(true)}
                className="flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium bg-purple-100 text-purple-700"
              >
                ❓ Help
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Desktop Notice */}
          <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 mb-4">
            <div className="flex gap-3">
              <span className="text-2xl">💻</span>
              <div>
                <h3 className="font-bold text-amber-800 mb-1">Desktop Recommended</h3>
                <p className="text-sm text-amber-700">
                  This mobile view is optimized for viewing schedules. For editing and full features, please use a desktop or tablet.
                </p>
              </div>
            </div>
          </div>

          {/* This Week Overview */}
          <div className="bg-white rounded-xl shadow-lg p-4 mb-4">
            <h2 className="text-lg font-bold mb-3">This Week</h2>
            <div className="grid grid-cols-7 gap-1">
              {weekDates.map(date => {
                const isToday = formatDateKey(date) === formatDateKey(today);
                const daySchedule = Object.values(schedule).filter(s => {
                  const keys = Object.keys(schedule).filter(key => schedule[key] === s);
                  return keys.some(key => key.startsWith(formatDateKey(date)));
                });
                const hasShifts = daySchedule.length > 0;

                return (
                  <div
                    key={formatDateKey(date)}
                    className={`text-center p-2 rounded-lg ${
                      isToday ? 'bg-blue-100 border-2 border-blue-400' : hasShifts ? 'bg-green-50' : 'bg-gray-50'
                    }`}
                  >
                    <div className="text-xs font-semibold text-gray-600">
                      {date.toLocaleDateString('en-US', { weekday: 'narrow' })}
                    </div>
                    <div className={`text-sm font-bold ${isToday ? 'text-blue-600' : 'text-gray-800'}`}>
                      {date.getDate()}
                    </div>
                    {hasShifts && (
                      <div className="w-1 h-1 bg-green-500 rounded-full mx-auto mt-1"></div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Staff List */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold">Team Schedule</h2>
            {orderedStaff.map(staffMember => {
              const todayShifts = getStaffScheduleForDate(staffMember.id, today);
              const weekStats = calculateStaffWeekStats(staffMember.id);

              return (
                <div key={staffMember.id} className="bg-white rounded-xl shadow-lg overflow-hidden">
                  {/* Staff Header */}
                  <div className="bg-gradient-to-r from-blue-50 to-orange-50 p-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-gray-800">{staffMember.name}</h3>
                        <p className="text-xs text-gray-600">{staffMember.employmentType}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-600">This Week</div>
                        <div className="font-bold text-blue-600">{weekStats.hours.toFixed(1)}h</div>
                      </div>
                    </div>
                  </div>

                  {/* Today's Shifts */}
                  <div className="p-4">
                    <div className="text-xs font-semibold text-gray-500 mb-2">TODAY</div>
                    {todayShifts.length === 0 ? (
                      <div className="text-sm text-gray-400 italic">No shifts scheduled</div>
                    ) : (
                      <div className="space-y-2">
                        {todayShifts.map((shift, idx) => {
                          const role = roles.find(r => r.id === shift.roleId);
                          const endTime = calculateEndTime(shift.endTime);
                          
                          return (
                            <div
                              key={idx}
                              className="flex items-center gap-3 p-3 rounded-lg border-2 border-gray-100"
                              style={{ borderLeftColor: shift.roleColor, borderLeftWidth: '4px' }}
                            >
                              <div
                                className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-md"
                                style={{ backgroundColor: shift.roleColor }}
                              >
                                {shift.roleCode}
                              </div>
                              <div className="flex-1">
                                <div className="font-semibold text-gray-800">{role?.name || shift.roleCode}</div>
                                <div className="text-sm text-gray-600">
                                  {shift.startTime} - {endTime}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Week Overview */}
                  <div className="px-4 pb-4">
                    <div className="text-xs font-semibold text-gray-500 mb-2">THIS WEEK</div>
                    <div className="grid grid-cols-7 gap-1">
                      {weekDates.map(date => {
                        const shifts = getStaffScheduleForDate(staffMember.id, date);
                        const isToday = formatDateKey(date) === formatDateKey(today);
                        
                        return (
                          <div
                            key={formatDateKey(date)}
                            className={`p-2 rounded text-center ${
                              isToday ? 'bg-blue-100 ring-2 ring-blue-400' : 'bg-gray-50'
                            }`}
                          >
                            <div className="text-xs font-medium text-gray-600">
                              {date.toLocaleDateString('en-US', { weekday: 'narrow' })}
                            </div>
                            {shifts.length > 0 ? (
                              <div className="flex flex-col gap-0.5 mt-1">
                                {shifts.slice(0, 2).map((shift, idx) => (
                                  <div
                                    key={idx}
                                    className="h-1 rounded-full"
                                    style={{ backgroundColor: shift.roleColor }}
                                  />
                                ))}
                                {shifts.length > 2 && (
                                  <div className="text-xs text-gray-500">+{shifts.length - 2}</div>
                                )}
                              </div>
                            ) : (
                              <div className="text-xs text-gray-400 mt-1">-</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Stats */}
          <div className="mt-4 bg-white rounded-xl shadow-lg p-4">
            <h3 className="font-bold mb-3">This Week Summary</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="text-xs text-blue-600 font-semibold">TOTAL HOURS</div>
                <div className="text-2xl font-bold text-blue-700">
                  {orderedStaff.reduce((sum, s) => sum + calculateStaffWeekStats(s.id).hours, 0).toFixed(1)}h
                </div>
              </div>
              <div className="bg-green-50 rounded-lg p-3">
                <div className="text-xs text-green-600 font-semibold">TOTAL COST</div>
                <div className="text-2xl font-bold text-green-700">
                  ${orderedStaff.reduce((sum, s) => sum + calculateStaffWeekStats(s.id).cost, 0).toFixed(0)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const RevenueModal = () => {
    const [formData, setFormData] = useState({
      projectedRevenue: '',
      otherRevenue: '',
      notes: ''
    });

    // Load existing data if editing
    useEffect(() => {
      if (revenueEditDate && dailyRevenue[revenueEditDate]) {
        setFormData({
          projectedRevenue: dailyRevenue[revenueEditDate].projectedRevenue || '',
          otherRevenue: dailyRevenue[revenueEditDate].otherRevenue || '',
          notes: dailyRevenue[revenueEditDate].notes || ''
        });
      } else {
        setFormData({ projectedRevenue: '', otherRevenue: '', notes: '' });
      }
    }, [revenueEditDate]);

    const handleSave = async () => {
      if (!revenueEditDate) return;
      
      const revenueData = {
        projectedRevenue: parseFloat(formData.projectedRevenue) || 0,
        otherRevenue: parseFloat(formData.otherRevenue) || 0,
        notes: formData.notes
      };

      try {
        await db.saveRevenue(user.id, revenueEditDate, revenueData);
        
        // Update local state
        setDailyRevenue(prev => ({
          ...prev,
          [revenueEditDate]: revenueData
        }));
        
        setShowRevenueModal(false);
        setRevenueEditDate(null);
      } catch (error) {
        console.error('Error saving revenue:', error);
        alert('Failed to save revenue data');
      }
    };

    const handleDelete = async () => {
      if (!revenueEditDate || !window.confirm('Delete revenue entry for this day?')) return;
      
      try {
        await db.deleteRevenue(user.id, revenueEditDate);
        
        // Update local state
        setDailyRevenue(prev => {
          const updated = { ...prev };
          delete updated[revenueEditDate];
          return updated;
        });
        
        setShowRevenueModal(false);
        setRevenueEditDate(null);
      } catch (error) {
        console.error('Error deleting revenue:', error);
        alert('Failed to delete revenue data');
      }
    };

    const date = revenueEditDate ? new Date(revenueEditDate) : null;
    const totalRevenue = (parseFloat(formData.projectedRevenue) || 0) + (parseFloat(formData.otherRevenue) || 0);

    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-5 flex justify-between items-center rounded-t-2xl">
            <div>
              <h2 className="text-xl font-bold text-white">Revenue Entry</h2>
              <p className="text-green-50 text-sm mt-1">
                {date?.toLocaleDateString('en-AU', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            <button 
              onClick={() => {
                setShowRevenueModal(false);
                setRevenueEditDate(null);
              }}
              className="text-white hover:bg-white/20 rounded-full p-2 transition-all"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-6 space-y-4">
            {/* Projected Revenue */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Projected Revenue
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={formData.projectedRevenue}
                  onChange={(e) => setFormData(prev => ({ ...prev, projectedRevenue: e.target.value }))}
                  className="w-full pl-8 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none text-lg"
                  placeholder="0.00"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Expected sales for this day</p>
            </div>

            {/* Other Revenue */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Other Revenue
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={formData.otherRevenue}
                  onChange={(e) => setFormData(prev => ({ ...prev, otherRevenue: e.target.value }))}
                  className="w-full pl-8 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none text-lg"
                  placeholder="0.00"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Delivery, catering, misc. revenue</p>
            </div>

            {/* Total Revenue Display */}
            {totalRevenue > 0 && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-4">
                <div className="text-sm text-gray-600 mb-1">Total Revenue</div>
                <div className="text-3xl font-bold text-green-600">${totalRevenue.toFixed(2)}</div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none resize-none"
                rows="3"
                placeholder="e.g., Special event, catering order, etc."
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              {revenueEditDate && dailyRevenue[revenueEditDate] && (
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl font-medium transition-all"
                >
                  Delete
                </button>
              )}
              <button
                onClick={() => {
                  setShowRevenueModal(false);
                  setRevenueEditDate(null);
                }}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-xl font-semibold transition-all shadow-lg"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const StaffRosterView = () => {
    // If no staff selected yet, show selection screen
    if (!selectedStaffView) {
      return (
        <div className="p-6">
          <div className="max-w-6xl mx-auto">
            <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Select Staff Member</h2>
                  <p className="text-gray-600">View individual schedules and work summaries</p>
                </div>
                
                {/* View Toggle */}
                <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
                  <button
                    onClick={() => setStaffSelectionView('cards')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      staffSelectionView === 'cards'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                    title="Card view"
                  >
                    <span className="flex items-center gap-2">
                      📇 Cards
                    </span>
                  </button>
                  <button
                    onClick={() => setStaffSelectionView('list')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      staffSelectionView === 'list'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                    title="List view"
                  >
                    <span className="flex items-center gap-2">
                      📋 List
                    </span>
                  </button>
                </div>
              </div>
              
              {/* Card View */}
              {staffSelectionView === 'cards' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {orderedStaff.map(s => {
                    const weekStats = calculateStaffWeekStats(s.id);
                    return (
                      <button
                        key={s.id}
                        onClick={() => setSelectedStaffView(s.id)}
                        className="bg-gradient-to-br from-blue-50 to-orange-50 hover:from-blue-100 hover:to-orange-100 border-2 border-gray-200 hover:border-blue-400 rounded-xl p-6 text-left transition-all shadow-sm hover:shadow-md"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-bold text-lg">{s.name}</h3>
                            <p className="text-sm text-gray-600">{s.employmentType}</p>
                          </div>
                          <div className="bg-white rounded-lg px-3 py-1 text-xs font-semibold text-blue-600 border border-blue-200">
                            ${s.hourlyRate}/hr
                          </div>
                        </div>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">This Week:</span>
                            <span className="font-semibold">{weekStats.hours.toFixed(1)}h</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Est. Pay:</span>
                            <span className="font-semibold text-green-600">${weekStats.cost.toFixed(0)}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              
              {/* List View */}
              {staffSelectionView === 'list' && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b-2 border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Type</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Hourly Rate</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Weekend Rate</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Hours This Week</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Est. Pay</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {orderedStaff.map(s => {
                        const weekStats = calculateStaffWeekStats(s.id);
                        return (
                          <tr key={s.id} className="hover:bg-blue-50 transition-colors">
                            <td className="px-4 py-4">
                              <div className="font-semibold text-gray-800">{s.name}</div>
                            </td>
                            <td className="px-4 py-4">
                              <span className="inline-block px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                                {s.employmentType}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-right font-medium text-gray-700">
                              ${s.hourlyRate.toFixed(2)}/hr
                            </td>
                            <td className="px-4 py-4 text-right font-medium text-gray-700">
                              {s.weekendRate && s.weekendRate !== s.hourlyRate 
                                ? `$${s.weekendRate.toFixed(2)}/hr`
                                : '-'
                              }
                            </td>
                            <td className="px-4 py-4 text-right font-bold text-gray-800">
                              {weekStats.hours.toFixed(1)}h
                            </td>
                            <td className="px-4 py-4 text-right font-bold text-green-600">
                              ${weekStats.cost.toFixed(0)}
                            </td>
                            <td className="px-4 py-4 text-center">
                              <button
                                onClick={() => setSelectedStaffView(s.id)}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all"
                              >
                                View Schedule
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Staff member selected - show their schedule
    const selectedStaff = staff.find(s => s.id === selectedStaffView);
    if (!selectedStaff) {
      setSelectedStaffView(null);
      return null;
    }

    // Get all shifts for this staff member across all dates
    const staffSchedule = {};
    dates.forEach(date => {
      const dateKey = formatDateKey(date);
      const dayShifts = [];
      
      // Group continuous time slots into shifts
      let currentShift = null;
      
      // CRITICAL: Iterate through ALL 15-minute slots, not just timeSlots array
      // Generate all 15-min slots from startHour to endHour
      const all15MinSlots = [];
      for (let h = startHour; h < endHour; h++) {
        for (let m = 0; m < 60; m += 15) {
          all15MinSlots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
        }
      }
      
      all15MinSlots.forEach(slot => {
        const key = getScheduleKey(dateKey, selectedStaffView, slot);
        const shift = schedule[key];
        
        if (shift) {
          if (!currentShift || currentShift.roleId !== shift.roleId || !areConsecutiveSlots(currentShift.endTime, slot)) {
            // Start new shift
            if (currentShift) {
              dayShifts.push(currentShift);
            }
            currentShift = {
              startTime: slot,
              endTime: slot,
              roleId: shift.roleId,
              roleCode: shift.roleCode,
              roleColor: shift.roleColor,
              slotCount: 1
            };
          } else {
            // Extend current shift
            currentShift.endTime = slot;
            currentShift.slotCount++;
          }
        } else {
          // No shift - close current if exists
          if (currentShift) {
            dayShifts.push(currentShift);
            currentShift = null;
          }
        }
      });
      
      // Don't forget last shift
      if (currentShift) {
        dayShifts.push(currentShift);
      }
      
      if (dayShifts.length > 0) {
        staffSchedule[dateKey] = dayShifts;
      }
    });

    // Helper to check if slots are consecutive
    function areConsecutiveSlots(time1, time2) {
      const [h1, m1] = time1.split(':').map(Number);
      const [h2, m2] = time2.split(':').map(Number);
      const min1 = h1 * 60 + m1;
      const min2 = h2 * 60 + m2;
      return min2 - min1 === 15;
    }

    // Calculate end time for display (add 15 min to last slot)
    function getShiftEndTime(endSlot) {
      const [h, m] = endSlot.split(':').map(Number);
      let totalMin = h * 60 + m + 15;
      const endH = Math.floor(totalMin / 60);
      const endM = totalMin % 60;
      return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
    }

    const weekStats = calculateStaffWeekStats(selectedStaffView);
    const isWeekend = (date) => date.getDay() === 0 || date.getDay() === 6;

    return (
      <div className="p-6">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-orange-500 rounded-2xl shadow-lg p-8 mb-6 text-white">
            <button
              onClick={() => setSelectedStaffView(null)}
              className="mb-4 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-all"
            >
              ← Back to Staff List
            </button>
            
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">{selectedStaff.name}</h1>
                <div className="flex gap-4 text-sm opacity-90">
                  <span>{selectedStaff.employmentType}</span>
                  <span>•</span>
                  <span>Weekday: ${selectedStaff.hourlyRate}/hr</span>
                  {selectedStaff.weekendRate && selectedStaff.weekendRate !== selectedStaff.hourlyRate && (
                    <>
                      <span>•</span>
                      <span>Weekend: ${selectedStaff.weekendRate}/hr</span>
                    </>
                  )}
                </div>
              </div>
              
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 text-center">
                <div className="text-3xl font-bold">{weekStats.hours.toFixed(1)}</div>
                <div className="text-sm opacity-90">Hours This Week</div>
                <div className="text-lg font-semibold mt-2">${weekStats.cost.toFixed(0)}</div>
                <div className="text-xs opacity-90">Est. Pay</div>
              </div>
            </div>
          </div>

          {/* Week Summary Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow p-4 border border-gray-200">
              <div className="text-2xl font-bold text-blue-600">{Object.keys(staffSchedule).length}</div>
              <div className="text-sm text-gray-600">Days Scheduled</div>
            </div>
            <div className="bg-white rounded-xl shadow p-4 border border-gray-200">
              <div className="text-2xl font-bold text-green-600">
                {Object.values(staffSchedule).reduce((sum, shifts) => sum + shifts.length, 0)}
              </div>
              <div className="text-sm text-gray-600">Total Shifts</div>
            </div>
            <div className="bg-white rounded-xl shadow p-4 border border-gray-200">
              <div className="text-2xl font-bold text-orange-600">
                {weekStats.hours > 0 
                  ? (weekStats.hours / Object.keys(staffSchedule).length).toFixed(1)
                  : '0.0'}h
              </div>
              <div className="text-sm text-gray-600">Avg Hours/Day</div>
            </div>
            <div className="bg-white rounded-xl shadow p-4 border border-gray-200">
              <div className="text-2xl font-bold text-purple-600">
                {weekStats.hours > 0
                  ? (weekStats.cost / weekStats.hours).toFixed(2)
                  : '0.00'}
              </div>
              <div className="text-sm text-gray-600">Avg Rate/Hour</div>
            </div>
          </div>

          {/* Daily Schedule Cards */}
          <div className="space-y-4">
            {dates.map(date => {
              const dateKey = formatDateKey(date);
              const dayShifts = staffSchedule[dateKey] || [];
              const dayStats = calculateStaffDayStats(selectedStaffView, dateKey);
              const weekend = isWeekend(date);

              return (
                <div 
                  key={dateKey} 
                  className={`bg-white rounded-xl shadow-md border-2 overflow-hidden transition-all ${
                    dayShifts.length > 0 ? 'border-blue-200 hover:shadow-lg' : 'border-gray-200 opacity-60'
                  }`}
                >
                  <div className={`p-4 ${weekend ? 'bg-gradient-to-r from-orange-100 to-yellow-100' : 'bg-gradient-to-r from-blue-50 to-blue-100'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-lg">
                          {date.toLocaleDateString('en-AU', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </h3>
                        {weekend && (
                          <span className="text-xs font-semibold text-orange-600 bg-orange-200 px-2 py-1 rounded-full">
                            Weekend Rate
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-gray-800">{dayStats.hours.toFixed(1)}h</div>
                        <div className="text-sm text-gray-600">${dayStats.cost.toFixed(0)}</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4">
                    {dayShifts.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <Clock size={32} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No shifts scheduled</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {dayShifts.map((shift, idx) => {
                          const duration = (shift.slotCount * 15) / 60;
                          const endTime = getShiftEndTime(shift.endTime);
                          return (
                            <div 
                              key={idx}
                              className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border-l-4"
                              style={{ borderLeftColor: shift.roleColor }}
                            >
                              <div 
                                className="w-16 h-16 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-md"
                                style={{ backgroundColor: shift.roleColor }}
                              >
                                {shift.roleCode}
                              </div>
                              <div className="flex-1">
                                <div className="font-semibold text-gray-800">
                                  {roles.find(r => r.id === shift.roleId)?.name || shift.roleCode}
                                </div>
                                <div className="text-sm text-gray-600 flex items-center gap-2">
                                  <Clock size={14} />
                                  <span className="font-mono">{shift.startTime} - {endTime}</span>
                                  <span className="text-gray-400">•</span>
                                  <span>{duration.toFixed(2)} hours</span>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-bold text-green-600">
                                  ${(duration * (weekend ? selectedStaff.weekendRate || selectedStaff.hourlyRate : selectedStaff.hourlyRate)).toFixed(2)}
                                </div>
                                <div className="text-xs text-gray-500">shift pay</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Export Options */}
          <div className="mt-6 bg-white rounded-xl shadow-md p-6 border border-gray-200">
            <h3 className="font-bold mb-4">Export Options</h3>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  // Generate text format for easy sharing
                  let text = `Schedule for ${selectedStaff.name}\n`;
                  text += `Week of ${dates[0].toLocaleDateString('en-AU')} - ${dates[dates.length-1].toLocaleDateString('en-AU')}\n\n`;
                  
                  dates.forEach(date => {
                    const dateKey = formatDateKey(date);
                    const dayShifts = staffSchedule[dateKey] || [];
                    text += `${date.toLocaleDateString('en-AU', { weekday: 'long', month: 'long', day: 'numeric' })}\n`;
                    
                    if (dayShifts.length === 0) {
                      text += `  No shifts\n`;
                    } else {
                      dayShifts.forEach(shift => {
                        const endTime = getShiftEndTime(shift.endTime);
                        const duration = (shift.slotCount * 15) / 60;
                        text += `  ${shift.startTime} - ${endTime} | ${roles.find(r => r.id === shift.roleId)?.name} (${duration.toFixed(2)}h)\n`;
                      });
                    }
                    text += '\n';
                  });
                  
                  text += `Total: ${weekStats.hours.toFixed(1)} hours | $${weekStats.cost.toFixed(2)}`;
                  
                  navigator.clipboard.writeText(text);
                  alert('Schedule copied to clipboard!');
                }}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all shadow-md hover:shadow-lg"
              >
                📋 Copy as Text
              </button>
              <button
                onClick={() => {
                  // Print-friendly view
                  window.print();
                }}
                className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-all shadow-md hover:shadow-lg"
              >
                🖨️ Print Schedule
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const AnalyticsView = () => {
    const weekStats = calculateWeekStats();

    // Calculate additional insights
    const insights = {
      avgCostPerHour: weekStats.totalHours > 0 ? weekStats.totalCost / weekStats.totalHours : 0,
      mostExpensiveDay: weekStats.dailyBreakdown.reduce((max, day) => day.cost > max.cost ? day : max, weekStats.dailyBreakdown[0] || { cost: 0 }),
      leastExpensiveDay: weekStats.dailyBreakdown.reduce((min, day) => day.cost < min.cost && day.cost > 0 ? day : min, weekStats.dailyBreakdown[0] || { cost: 0 }),
      underStaffedSlots: [],
      overStaffedSlots: [],
      totalShifts: Object.keys(schedule).length,
      avgShiftLength: 0,
      utilizationRate: {},
      coverageGaps: []
    };

    // Calculate staff utilization rates
    staff.forEach(s => {
      const totalPossibleSlots = dates.length * timeSlots.length;
      const scheduledSlots = Object.keys(schedule).filter(key => key.includes(`-${s.id}-`)).length;
      insights.utilizationRate[s.id] = {
        name: s.name,
        rate: (scheduledSlots / totalPossibleSlots) * 100,
        scheduledSlots,
        totalPossibleSlots
      };
    });

    // Find coverage gaps (time slots with 0 or 1 staff) - only during operational hours
    dates.forEach(date => {
      const dateKey = formatDateKey(date);
      timeSlots.forEach(slot => {
        // Skip if outside operational hours
        if (!isWithinOperationalHours(date, slot)) return;
        
        const staffCount = activeStaff.filter(s => {
          const key = getScheduleKey(dateKey, s.id, slot);
          return schedule[key];
        }).length;
        
        const isPeakTime = slot >= businessSettings.peakHours.start && slot < businessSettings.peakHours.end;
        const minRequired = isPeakTime ? businessSettings.minPeakStaffCoverage : businessSettings.minStaffCoverage;
        
        if (staffCount === 0) {
          insights.coverageGaps.push({
            date,
            dateKey,
            slot,
            staffCount,
            severity: 'critical',
            required: minRequired
          });
        } else if (staffCount < minRequired) {
          insights.underStaffedSlots.push({
            date,
            dateKey,
            slot,
            staffCount,
            severity: 'warning',
            required: minRequired
          });
        } else if (staffCount > minRequired + 3) {
          insights.overStaffedSlots.push({
            date,
            dateKey,
            slot,
            staffCount,
            severity: 'info',
            required: minRequired
          });
        }
      });
    });

    // Calculate average shift length
    const allShifts = [];
    dates.forEach(date => {
      const dateKey = formatDateKey(date);
      staff.forEach(s => {
        // Find all continuous blocks of work for this staff on this day
        const daySchedule = Object.keys(schedule)
          .filter(key => key.startsWith(`${dateKey}|${s.id}|`))
          .map(key => key.split('|')[2]) // Extract time slot
          .sort();
        
        if (daySchedule.length === 0) return;
        
        // Group into continuous shifts
        let currentShift = { start: daySchedule[0], slotCount: 1 };
        
        for (let i = 1; i < daySchedule.length; i++) {
          const prevTime = daySchedule[i - 1];
          const currTime = daySchedule[i];
          
          // Check if consecutive (15 min apart)
          const [prevH, prevM] = prevTime.split(':').map(Number);
          const [currH, currM] = currTime.split(':').map(Number);
          const prevMinutes = prevH * 60 + prevM;
          const currMinutes = currH * 60 + currM;
          
          if (currMinutes - prevMinutes === 15) {
            // Continuous
            currentShift.slotCount++;
          } else {
            // Gap - save shift and start new one
            allShifts.push(currentShift.slotCount * 15 / 60);
            currentShift = { start: currTime, slotCount: 1 };
          }
        }
        
        // Save final shift
        allShifts.push(currentShift.slotCount * 15 / 60);
      });
    });
    insights.avgShiftLength = allShifts.length > 0 ? allShifts.reduce((a, b) => a + b, 0) / allShifts.length : 0;

    const OverviewTab = () => (
      <div className="space-y-6">
        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white shadow-lg">
            <div className="text-sm opacity-90 mb-1">Total Week Cost</div>
            <div className="text-3xl font-bold">${weekStats.totalCost.toFixed(0)}</div>
            <div className="text-xs opacity-75 mt-1">{weekStats.totalHours.toFixed(1)} hours</div>
            <div className="text-xs opacity-75">${insights.avgCostPerHour.toFixed(2)}/hr avg</div>
          </div>
          
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-5 text-white shadow-lg">
            <div className="text-sm opacity-90 mb-1">Average Daily</div>
            <div className="text-3xl font-bold">${(weekStats.totalCost / dates.length).toFixed(0)}</div>
            <div className="text-xs opacity-75 mt-1">{(weekStats.totalHours / dates.length).toFixed(1)} hrs/day</div>
            <div className="text-xs opacity-75">{dates.length} days</div>
          </div>
          
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-5 text-white shadow-lg">
            <div className="text-sm opacity-90 mb-1">Active Staff</div>
            <div className="text-3xl font-bold">{weekStats.staffBreakdown.length}</div>
            <div className="text-xs opacity-75 mt-1">of {staff.length} total</div>
            <div className="text-xs opacity-75">{insights.totalShifts} shifts</div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-5 text-white shadow-lg">
            <div className="text-sm opacity-90 mb-1">Avg Shift Length</div>
            <div className="text-3xl font-bold">{insights.avgShiftLength.toFixed(1)}h</div>
            <div className="text-xs opacity-75 mt-1">{allShifts.length} total shifts</div>
            <div className="text-xs opacity-75">{(insights.avgShiftLength * insights.avgCostPerHour).toFixed(0)} avg cost/shift</div>
          </div>
        </div>

        {/* Alerts and Warnings */}
        {(insights.coverageGaps.length > 0 || insights.underStaffedSlots.length > 0 || insights.overStaffedSlots.length > 0) && (
          <div className="bg-white rounded-xl p-6 shadow-lg border-2 border-gray-100">
            <h3 className="text-lg font-bold mb-4 text-gray-800 flex items-center gap-2">
              <span className="text-2xl">⚠️</span>
              Coverage Alerts
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {insights.coverageGaps.length > 0 && (
                <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl">
                  <div className="text-sm font-semibold text-red-800 mb-1">Critical Gaps</div>
                  <div className="text-3xl font-bold text-red-600">{insights.coverageGaps.length}</div>
                  <div className="text-xs text-red-700 mt-1">Time slots with NO staff</div>
                  <div className="text-xs text-red-600 mt-1 font-semibold">During operational hours</div>
                </div>
              )}
              {insights.underStaffedSlots.length > 0 && (
                <div className="p-4 bg-orange-50 border-2 border-orange-200 rounded-xl">
                  <div className="text-sm font-semibold text-orange-800 mb-1">Understaffed</div>
                  <div className="text-3xl font-bold text-orange-600">{insights.underStaffedSlots.length}</div>
                  <div className="text-xs text-orange-700 mt-1">Below minimum coverage</div>
                  <div className="text-xs text-orange-600 mt-1 font-semibold">Min: {businessSettings.minStaffCoverage} ({businessSettings.minPeakStaffCoverage} peak)</div>
                </div>
              )}
              {insights.overStaffedSlots.length > 0 && (
                <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
                  <div className="text-sm font-semibold text-blue-800 mb-1">High Coverage</div>
                  <div className="text-3xl font-bold text-blue-600">{insights.overStaffedSlots.length}</div>
                  <div className="text-xs text-blue-700 mt-1">Well above minimum</div>
                  <div className="text-xs text-blue-600 mt-1 font-semibold">{businessSettings.minStaffCoverage + 4}+ staff scheduled</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Cost Analysis */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Weekend vs Weekday */}
          <div className="bg-white rounded-xl p-6 shadow-lg border-2 border-gray-100">
            <h3 className="text-lg font-bold mb-4 text-gray-800">Weekend vs Weekday</h3>
            <div className="space-y-3">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-sm font-semibold text-blue-800">Weekday</div>
                  <div className="text-2xl font-bold text-blue-600">${weekStats.weekdayCost.toFixed(0)}</div>
                </div>
                <div className="text-xs text-blue-700">{weekStats.weekdayHours.toFixed(1)}h · ${weekStats.weekdayHours > 0 ? (weekStats.weekdayCost / weekStats.weekdayHours).toFixed(2) : 0}/hr</div>
              </div>
              
              <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-sm font-semibold text-orange-800">Weekend</div>
                  <div className="text-2xl font-bold text-orange-600">${weekStats.weekendCost.toFixed(0)}</div>
                </div>
                <div className="text-xs text-orange-700">{weekStats.weekendHours.toFixed(1)}h · ${weekStats.weekendHours > 0 ? (weekStats.weekendCost / weekStats.weekendHours).toFixed(2) : 0}/hr</div>
              </div>

              {weekStats.weekendCost > 0 && weekStats.weekdayCost > 0 && (
                <div className="p-3 bg-gradient-to-r from-blue-50 to-orange-50 rounded-lg text-center border border-gray-200">
                  <div className="text-xs text-gray-600">Weekend premium</div>
                  <div className="text-xl font-bold text-orange-600">
                    +{((weekStats.weekendCost / (weekStats.weekendHours || 1) / (weekStats.weekdayCost / (weekStats.weekdayHours || 1)) - 1) * 100).toFixed(0)}%
                  </div>
                  <div className="text-xs text-gray-600">per hour</div>
                </div>
              )}
            </div>
          </div>

          {/* Peak vs Off-Peak */}
          <div className="bg-white rounded-xl p-6 shadow-lg border-2 border-gray-100">
            <h3 className="text-lg font-bold mb-4 text-gray-800">Peak vs Off-Peak</h3>
            <div className="space-y-3">
              <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-sm font-semibold text-orange-800">Peak (12-2pm)</div>
                  <div className="text-2xl font-bold text-orange-600">${weekStats.peakCost.toFixed(0)}</div>
                </div>
                <div className="text-xs text-orange-700">{weekStats.peakHours.toFixed(1)}h · ${weekStats.peakCostPerHour.toFixed(2)}/hr</div>
              </div>
              
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-sm font-semibold text-gray-800">Off-Peak</div>
                  <div className="text-2xl font-bold text-gray-600">${weekStats.offPeakCost.toFixed(0)}</div>
                </div>
                <div className="text-xs text-gray-700">{weekStats.offPeakHours.toFixed(1)}h · ${weekStats.offPeakCostPerHour.toFixed(2)}/hr</div>
              </div>

              <div className="p-3 bg-orange-50 rounded-lg text-center border border-orange-200">
                <div className="text-xs text-gray-600">Peak hours are</div>
                <div className="text-xl font-bold text-orange-600">
                  {weekStats.totalHours > 0 ? ((weekStats.peakHours / weekStats.totalHours) * 100).toFixed(0) : 0}%
                </div>
                <div className="text-xs text-gray-600">of total hours</div>
              </div>
            </div>
          </div>
        </div>

        {/* Daily Breakdown with Chart */}
        <div className="bg-white rounded-xl p-6 shadow-lg border-2 border-gray-100">
          <h3 className="text-lg font-bold mb-4 text-gray-800">Daily Breakdown</h3>
          <div className="space-y-2">
            {weekStats.dailyBreakdown.map((day) => {
              const isHighest = day.dateKey === insights.mostExpensiveDay?.dateKey;
              const isLowest = day.dateKey === insights.leastExpensiveDay?.dateKey && day.cost > 0;
              
              return (
                <div 
                  key={day.dateKey} 
                  className={`flex items-center gap-4 p-3 rounded-lg transition-all ${
                    isHighest ? 'bg-red-50 border-2 border-red-200' : 
                    isLowest ? 'bg-green-50 border-2 border-green-200' : 
                    'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div className="w-24">
                    <div className="font-semibold text-sm text-gray-800 flex items-center gap-1">
                      {day.date.toLocaleDateString('en-AU', { weekday: 'short' }).toUpperCase()}
                      {isHighest && <span className="text-red-500">📈</span>}
                      {isLowest && <span className="text-green-500">📉</span>}
                    </div>
                    <div className="text-xs text-gray-500">
                      {day.date.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                  <div className="flex-1 flex items-center gap-3">
                    <div className="flex-1 bg-gray-200 rounded-full h-6 overflow-hidden">
                      <div 
                        className={`h-6 rounded-full flex items-center justify-end pr-2 text-xs font-bold text-white transition-all ${
                          isHighest ? 'bg-gradient-to-r from-red-500 to-red-600' :
                          isLowest ? 'bg-gradient-to-r from-green-500 to-green-600' :
                          'bg-gradient-to-r from-blue-500 to-orange-500'
                        }`}
                        style={{ width: `${Math.max(weekStats.totalCost > 0 ? (day.cost / weekStats.totalCost) * 100 : 0, 5)}%` }}
                      >
                        {day.hours.toFixed(1)}h
                      </div>
                    </div>
                    <div className="text-right w-24">
                      <div className="text-lg font-bold text-gray-800">${day.cost.toFixed(0)}</div>
                      <div className="text-xs text-gray-500">
                        {weekStats.totalCost > 0 ? ((day.cost / weekStats.totalCost) * 100).toFixed(0) : 0}%
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );

    const StaffTab = () => {
      const sortedStaff = [...weekStats.staffBreakdown].sort((a, b) => b.cost - a.cost);
      const avgStaffCost = sortedStaff.length > 0 ? weekStats.totalCost / sortedStaff.length : 0;

      return (
        <div className="space-y-6">
          {/* Staff Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-5 shadow-lg border-2 border-gray-100">
              <div className="text-sm text-gray-600 mb-1">Most Expensive Staff</div>
              <div className="text-2xl font-bold text-gray-800">{sortedStaff[0]?.name || 'N/A'}</div>
              <div className="text-sm text-gray-500">${sortedStaff[0]?.cost.toFixed(0) || 0}</div>
            </div>
            
            <div className="bg-white rounded-xl p-5 shadow-lg border-2 border-gray-100">
              <div className="text-sm text-gray-600 mb-1">Most Hours</div>
              <div className="text-2xl font-bold text-gray-800">
                {[...sortedStaff].sort((a, b) => b.hours - a.hours)[0]?.name || 'N/A'}
              </div>
              <div className="text-sm text-gray-500">
                {[...sortedStaff].sort((a, b) => b.hours - a.hours)[0]?.hours.toFixed(1) || 0}h
              </div>
            </div>

            <div className="bg-white rounded-xl p-5 shadow-lg border-2 border-gray-100">
              <div className="text-sm text-gray-600 mb-1">Average Cost/Staff</div>
              <div className="text-2xl font-bold text-gray-800">${avgStaffCost.toFixed(0)}</div>
              <div className="text-sm text-gray-500">{(weekStats.totalHours / sortedStaff.length).toFixed(1)}h avg</div>
            </div>
          </div>

          {/* Staff Utilization */}
          <div className="bg-white rounded-xl p-6 shadow-lg border-2 border-gray-100">
            <h3 className="text-lg font-bold mb-4 text-gray-800">Staff Utilization Rate</h3>
            <div className="space-y-3">
              {Object.values(insights.utilizationRate)
                .sort((a, b) => b.rate - a.rate)
                .map((util) => (
                  <div key={util.name} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold text-gray-800">{util.name}</div>
                      <div className="text-lg font-bold text-blue-600">{util.rate.toFixed(1)}%</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div 
                          className={`h-3 rounded-full transition-all ${
                            util.rate > 75 ? 'bg-gradient-to-r from-red-500 to-red-600' :
                            util.rate > 50 ? 'bg-gradient-to-r from-orange-500 to-orange-600' :
                            util.rate > 25 ? 'bg-gradient-to-r from-blue-500 to-blue-600' :
                            'bg-gradient-to-r from-green-500 to-green-600'
                          }`}
                          style={{ width: `${util.rate}%` }}
                        />
                      </div>
                      <div className="text-xs text-gray-500 w-32 text-right">
                        {util.scheduledSlots} of {util.totalPossibleSlots} slots
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      {util.rate > 75 && '⚠️ High utilization - consider adding breaks'}
                      {util.rate > 50 && util.rate <= 75 && '✅ Good utilization'}
                      {util.rate > 25 && util.rate <= 50 && '📊 Moderate utilization'}
                      {util.rate <= 25 && '💡 Low utilization - could schedule more hours'}
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Staff Cost Breakdown */}
          <div className="bg-white rounded-xl p-6 shadow-lg border-2 border-gray-100">
            <h3 className="text-lg font-bold mb-4 text-gray-800">Staff Cost Breakdown</h3>
            <div className="space-y-2">
              {sortedStaff.map((staffData, idx) => (
                <div key={staffData.name} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="w-8 text-center font-bold text-gray-400">#{idx + 1}</div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-800">{staffData.name}</div>
                    <div className="text-xs text-gray-500">{staffData.hours.toFixed(1)}h · ${staffData.hours > 0 ? (staffData.cost / staffData.hours).toFixed(2) : '0.00'}/hr avg</div>
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-4 overflow-hidden">
                      <div 
                        className="h-4 bg-gradient-to-r from-blue-600 to-blue-400 rounded-full"
                        style={{ width: `${weekStats.totalCost > 0 ? (staffData.cost / weekStats.totalCost) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right w-24">
                    <div className="text-lg font-bold text-gray-800">${staffData.cost.toFixed(0)}</div>
                    <div className="text-xs text-gray-500">{weekStats.totalCost > 0 ? ((staffData.cost / weekStats.totalCost) * 100).toFixed(1) : 0}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    };

    const RolesTab = () => {
      const sortedRoles = [...weekStats.roleBreakdown].sort((a, b) => b.hours - a.hours);

      return (
        <div className="space-y-6">
          {/* Role Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-5 shadow-lg border-2 border-gray-100">
              <div className="text-sm text-gray-600 mb-1">Most Used Role</div>
              <div className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                {sortedRoles[0] && (
                  <>
                    <span 
                      className="px-2 py-1 rounded text-sm text-white font-bold"
                      style={{ backgroundColor: sortedRoles[0].color }}
                    >
                      {sortedRoles[0].code}
                    </span>
                    {sortedRoles[0].name}
                  </>
                )}
              </div>
              <div className="text-sm text-gray-500">{sortedRoles[0]?.hours.toFixed(1) || 0}h</div>
            </div>
            
            <div className="bg-white rounded-xl p-5 shadow-lg border-2 border-gray-100">
              <div className="text-sm text-gray-600 mb-1">Most Expensive Role</div>
              <div className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                {[...sortedRoles].sort((a, b) => b.cost - a.cost)[0] && (
                  <>
                    <span 
                      className="px-2 py-1 rounded text-sm text-white font-bold"
                      style={{ backgroundColor: [...sortedRoles].sort((a, b) => b.cost - a.cost)[0].color }}
                    >
                      {[...sortedRoles].sort((a, b) => b.cost - a.cost)[0].code}
                    </span>
                    {[...sortedRoles].sort((a, b) => b.cost - a.cost)[0].name}
                  </>
                )}
              </div>
              <div className="text-sm text-gray-500">${[...sortedRoles].sort((a, b) => b.cost - a.cost)[0]?.cost.toFixed(0) || 0}</div>
            </div>

            <div className="bg-white rounded-xl p-5 shadow-lg border-2 border-gray-100">
              <div className="text-sm text-gray-600 mb-1">Active Roles</div>
              <div className="text-2xl font-bold text-gray-800">{sortedRoles.length}</div>
              <div className="text-sm text-gray-500">of {roles.length} total</div>
            </div>
          </div>

          {/* Role Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sortedRoles.map((roleData) => {
              const avgCostPerHour = roleData.hours > 0 ? roleData.cost / roleData.hours : 0;
              
              return (
                <div 
                  key={roleData.code} 
                  className="p-5 rounded-xl border-2 transition-all hover:shadow-lg"
                  style={{ 
                    borderColor: roleData.color, 
                    backgroundColor: `${roleData.color}08` 
                  }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div 
                        className="px-3 py-2 rounded-lg font-bold text-white text-lg"
                        style={{ backgroundColor: roleData.color }}
                      >
                        {roleData.code}
                      </div>
                      <div>
                        <div className="font-bold text-gray-800">{roleData.name}</div>
                        <div className="text-xs text-gray-500">{weekStats.totalHours > 0 ? ((roleData.hours / weekStats.totalHours) * 100).toFixed(1) : 0}% of total</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-white rounded-lg">
                      <div className="text-xs text-gray-500 mb-1">Total Cost</div>
                      <div className="text-xl font-bold text-gray-800">${roleData.cost.toFixed(0)}</div>
                    </div>
                    <div className="p-3 bg-white rounded-lg">
                      <div className="text-xs text-gray-500 mb-1">Total Hours</div>
                      <div className="text-xl font-bold text-gray-800">{roleData.hours.toFixed(1)}h</div>
                    </div>
                    <div className="p-3 bg-white rounded-lg col-span-2">
                      <div className="text-xs text-gray-500 mb-1">Average Cost per Hour</div>
                      <div className="text-xl font-bold text-gray-800">${avgCostPerHour.toFixed(2)}/hr</div>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">Share of total costs</span>
                      <span className="font-bold text-gray-800">{weekStats.totalCost > 0 ? ((roleData.cost / weekStats.totalCost) * 100).toFixed(1) : 0}%</span>
                    </div>
                    <div className="mt-2 bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div 
                        className="h-2 rounded-full transition-all"
                        style={{ 
                          width: `${weekStats.totalCost > 0 ? (roleData.cost / weekStats.totalCost) * 100 : 0}%`,
                          backgroundColor: roleData.color
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    };

    const RevenueTab = () => {
      // State for inline editing
      const [editingCell, setEditingCell] = useState(null); // { dateKey, field }
      const [editValue, setEditValue] = useState('');
      const [isSaving, setIsSaving] = useState(false);

      // Calculate daily labor costs and revenue
      const dailyData = dates.map(date => {
        const dateKey = formatDateKey(date);
        const dayStats = calculateDayStats(dateKey);
        const revenueEntry = dailyRevenue[dateKey];
        const totalRevenue = revenueEntry 
          ? (revenueEntry.projectedRevenue || 0) + (revenueEntry.otherRevenue || 0)
          : 0;
        const laborPercentage = totalRevenue > 0 ? (dayStats.totalCost / totalRevenue) * 100 : 0;
        
        return {
          date,
          dateKey,
          laborCost: dayStats.totalCost,
          projectedRevenue: revenueEntry?.projectedRevenue || 0,
          otherRevenue: revenueEntry?.otherRevenue || 0,
          totalRevenue,
          laborPercentage,
          notes: revenueEntry?.notes || '',
          hasRevenue: totalRevenue > 0
        };
      });

      // Week totals
      const weekTotals = dailyData.reduce((acc, day) => ({
        laborCost: acc.laborCost + day.laborCost,
        totalRevenue: acc.totalRevenue + day.totalRevenue,
        daysWithRevenue: acc.daysWithRevenue + (day.hasRevenue ? 1 : 0)
      }), { laborCost: 0, totalRevenue: 0, daysWithRevenue: 0 });

      const weekLaborPercentage = weekTotals.totalRevenue > 0 
        ? (weekTotals.laborCost / weekTotals.totalRevenue) * 100 
        : 0;

      // Helper to get color based on labor %
      const getLaborPercentageColor = (percentage) => {
        if (percentage === 0) return 'gray';
        const target = businessSettings.targetLaborPercentage || 30;
        if (percentage <= target) return 'green';
        if (percentage <= target + 5) return 'yellow';
        if (percentage <= target + 10) return 'orange';
        return 'red';
      };

      const getColorClasses = (color) => {
        const classes = {
          gray: 'bg-gray-100 text-gray-700 border-gray-300',
          green: 'bg-green-100 text-green-700 border-green-300',
          yellow: 'bg-yellow-100 text-yellow-700 border-yellow-300',
          orange: 'bg-orange-100 text-orange-700 border-orange-300',
          red: 'bg-red-100 text-red-700 border-red-300'
        };
        return classes[color] || classes.gray;
      };

      // Inline editing handlers
      const startEdit = (dateKey, field, currentValue) => {
        setEditingCell({ dateKey, field });
        setEditValue(currentValue || '');
      };

      const cancelEdit = () => {
        setEditingCell(null);
        setEditValue('');
      };

      const saveEdit = async (dateKey) => {
        if (isSaving) return;
        
        setIsSaving(true);
        try {
          const existingRevenue = dailyRevenue[dateKey] || { projectedRevenue: 0, otherRevenue: 0, notes: '' };
          
          const updatedRevenue = {
            projectedRevenue: editingCell.field === 'projected' ? parseFloat(editValue) || 0 : existingRevenue.projectedRevenue,
            otherRevenue: editingCell.field === 'other' ? parseFloat(editValue) || 0 : existingRevenue.otherRevenue,
            notes: editingCell.field === 'notes' ? editValue : existingRevenue.notes
          };

          await db.saveRevenue(user.id, dateKey, updatedRevenue);
          
          // Update local state
          setDailyRevenue(prev => ({
            ...prev,
            [dateKey]: updatedRevenue
          }));
          
          setEditingCell(null);
          setEditValue('');
        } catch (error) {
          console.error('Error saving revenue:', error);
          alert('Failed to save. Please try again.');
        } finally {
          setIsSaving(false);
        }
      };

      const handleKeyDown = (e, dateKey) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          saveEdit(dateKey);
        } else if (e.key === 'Escape') {
          cancelEdit();
        }
      };

      const renderEditableCell = (day, field, value) => {
        const isEditing = editingCell?.dateKey === day.dateKey && editingCell?.field === field;
        
        if (isEditing) {
          return (
            <div className="flex items-center gap-1">
              <input
                type={field === 'notes' ? 'text' : 'number'}
                step={field === 'notes' ? undefined : '0.01'}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, day.dateKey)}
                onBlur={() => saveEdit(day.dateKey)}
                autoFocus
                className="w-full px-2 py-1 border-2 border-green-500 rounded text-right font-medium focus:outline-none focus:border-green-600"
                placeholder={field === 'notes' ? 'Add note...' : '0'}
              />
            </div>
          );
        }

        return (
          <div
            onClick={() => startEdit(day.dateKey, field, value)}
            className="cursor-pointer hover:bg-green-50 px-2 py-1 rounded transition-colors"
            title="Click to edit"
          >
            {field === 'notes' 
              ? (value || <span className="text-gray-400 italic text-xs">Click to add note</span>)
              : value > 0 ? `$${value.toFixed(0)}` : <span className="text-gray-400">-</span>
            }
          </div>
        );
      };

      return (
        <div className="space-y-6">
          {/* Week Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white shadow-lg">
              <div className="text-sm opacity-90 mb-1">Total Labor Cost</div>
              <div className="text-3xl font-bold">${weekTotals.laborCost.toFixed(0)}</div>
              <div className="text-xs opacity-75 mt-1">This week</div>
            </div>

            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-5 text-white shadow-lg">
              <div className="text-sm opacity-90 mb-1">Total Revenue</div>
              <div className="text-3xl font-bold">${weekTotals.totalRevenue.toFixed(0)}</div>
              <div className="text-xs opacity-75 mt-1">{weekTotals.daysWithRevenue} days tracked</div>
            </div>

            <div className={`rounded-xl p-5 shadow-lg ${
              weekLaborPercentage === 0 
                ? 'bg-gradient-to-br from-gray-400 to-gray-500 text-white'
                : weekLaborPercentage <= (businessSettings.targetLaborPercentage || 30)
                ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white'
                : weekLaborPercentage <= (businessSettings.targetLaborPercentage || 30) + 10
                ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white'
                : 'bg-gradient-to-br from-red-500 to-red-600 text-white'
            }`}>
              <div className="text-sm opacity-90 mb-1">Labor %</div>
              <div className="text-3xl font-bold">
                {weekLaborPercentage > 0 ? `${weekLaborPercentage.toFixed(1)}%` : 'N/A'}
              </div>
              <div className="text-xs opacity-75 mt-1">
                {weekLaborPercentage > 0 ? 'of revenue' : 'Add revenue data'}
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-5 text-white shadow-lg">
              <div className="text-sm opacity-90 mb-1">Target Labor %</div>
              <div className="text-3xl font-bold">{businessSettings.targetLaborPercentage || 30}%</div>
              <div className="text-xs opacity-75 mt-1">Ideal target</div>
            </div>
          </div>

          {/* Info Card */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="text-2xl">💡</div>
              <div className="flex-1">
                <h4 className="font-semibold text-blue-900 mb-1">Managing Labor Costs</h4>
                <p className="text-sm text-blue-700">
                  Industry standard for hospitality labor costs is typically 25-35% of revenue. <strong>Click any cell in the table below</strong> to enter revenue data and track your labor cost percentage. Changes save automatically.
                </p>
              </div>
            </div>
          </div>

          {/* Daily Breakdown */}
          <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-green-600 px-6 py-4">
              <h3 className="text-xl font-bold text-white">Daily Revenue & Labor Tracking</h3>
              <p className="text-blue-50 text-sm mt-1">Track labor costs as a percentage of revenue</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b-2 border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Projected</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Other</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Total Revenue</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Labor Cost</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Labor %</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {dailyData.map((day) => {
                    const color = getLaborPercentageColor(day.laborPercentage);
                    const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;
                    
                    return (
                      <tr key={day.dateKey} className={`hover:bg-gray-50 ${isWeekend ? 'bg-orange-50/30' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-800">
                            {day.date.toLocaleDateString('en-AU', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </div>
                          {day.notes && !editingCell?.dateKey === day.dateKey && (
                            <div className="text-xs text-gray-500 mt-0.5">{day.notes}</div>
                          )}
                        </td>
                        <td className="px-2 py-3 text-right">
                          {renderEditableCell(day, 'projected', day.projectedRevenue)}
                        </td>
                        <td className="px-2 py-3 text-right">
                          {renderEditableCell(day, 'other', day.otherRevenue)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-gray-800">
                          {day.totalRevenue > 0 ? `$${day.totalRevenue.toFixed(0)}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-blue-600">
                          ${day.laborCost.toFixed(0)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {day.laborPercentage > 0 ? (
                            <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold border-2 ${getColorClasses(color)}`}>
                              {day.laborPercentage.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-gray-400 text-sm">-</span>
                          )}
                        </td>
                        <td className="px-2 py-3">
                          {renderEditableCell(day, 'notes', day.notes)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gradient-to-r from-blue-50 to-green-50 border-t-2 border-gray-300">
                  <tr className="font-bold">
                    <td className="px-4 py-4 text-gray-800">Week Total</td>
                    <td className="px-4 py-4 text-right text-gray-600">-</td>
                    <td className="px-4 py-4 text-right text-gray-600">-</td>
                    <td className="px-4 py-4 text-right text-lg text-gray-800">
                      ${weekTotals.totalRevenue.toFixed(0)}
                    </td>
                    <td className="px-4 py-4 text-right text-lg text-blue-600">
                      ${weekTotals.laborCost.toFixed(0)}
                    </td>
                    <td className="px-4 py-4 text-center">
                      {weekLaborPercentage > 0 ? (
                        <span className={`inline-block px-4 py-1.5 rounded-full text-base font-bold border-2 ${
                          getColorClasses(getLaborPercentageColor(weekLaborPercentage))
                        }`}>
                          {weekLaborPercentage.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Labor Percentage Guide */}
          <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-6">
            <h3 className="text-lg font-bold mb-4 text-gray-800">Understanding Labor Percentage</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <div className="flex-1">
                    <div className="font-semibold text-green-800">Excellent (≤{businessSettings.targetLaborPercentage || 30}%)</div>
                    <div className="text-xs text-green-700">On target or better</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="flex-1">
                    <div className="font-semibold text-yellow-800">Acceptable ({(businessSettings.targetLaborPercentage || 30)}-{(businessSettings.targetLaborPercentage || 30) + 5}%)</div>
                    <div className="text-xs text-yellow-700">Slightly over target</div>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                  <div className="flex-1">
                    <div className="font-semibold text-orange-800">Warning ({(businessSettings.targetLaborPercentage || 30) + 5}-{(businessSettings.targetLaborPercentage || 30) + 10}%)</div>
                    <div className="text-xs text-orange-700">Review scheduling</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="flex-1">
                    <div className="font-semibold text-red-800">Critical (>{(businessSettings.targetLaborPercentage || 30) + 10}%)</div>
                    <div className="text-xs text-red-700">Immediate action needed</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    };

    const CoverageTab = () => {
      return (
        <div className="space-y-6">
          {/* Coverage Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-5 text-white shadow-lg">
              <div className="text-sm opacity-90 mb-1">Critical Gaps</div>
              <div className="text-3xl font-bold">{insights.coverageGaps.length}</div>
              <div className="text-xs opacity-75">No staff scheduled</div>
              <div className="text-xs opacity-90 mt-1">During operational hours</div>
            </div>
            
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-5 text-white shadow-lg">
              <div className="text-sm opacity-90 mb-1">Understaffed</div>
              <div className="text-3xl font-bold">{insights.underStaffedSlots.length}</div>
              <div className="text-xs opacity-75">Below minimum ({businessSettings.minStaffCoverage})</div>
              <div className="text-xs opacity-90 mt-1">Peak min: {businessSettings.minPeakStaffCoverage}</div>
            </div>

            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white shadow-lg">
              <div className="text-sm opacity-90 mb-1">Well Covered</div>
              <div className="text-3xl font-bold">
                {dates.length * timeSlots.length - insights.coverageGaps.length - insights.underStaffedSlots.length}
              </div>
              <div className="text-xs opacity-75">Meets minimum coverage</div>
              <div className="text-xs opacity-90 mt-1">All operational slots</div>
            </div>
          </div>

          {/* Peak Hour Coverage */}
          <div className="bg-white rounded-xl p-6 shadow-lg border-2 border-gray-100">
            <h3 className="text-lg font-bold mb-4 text-gray-800 flex items-center gap-2">
              <span className="bg-orange-100 text-orange-600 px-3 py-1 rounded-lg text-sm font-bold">PEAK</span>
              Peak Hour Coverage (12pm - 2pm)
            </h3>
            <div className="space-y-4">
              {weekStats.dailyBreakdown.map((day) => {
                const peakSlots = weekStats.peakHourCoverage[day.dateKey] || {};
                const peakStaffCounts = Object.values(peakSlots);
                const avgPeakStaff = peakStaffCounts.length > 0 
                  ? (peakStaffCounts.reduce((a, b) => a + b, 0) / peakStaffCounts.length)
                  : 0;
                const maxPeakStaff = peakStaffCounts.length > 0 ? Math.max(...peakStaffCounts) : 0;
                const minPeakStaff = peakStaffCounts.length > 0 ? Math.min(...peakStaffCounts) : 0;
                
                return (
                  <div key={day.dateKey} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="font-bold text-gray-800">
                          {day.date.toLocaleDateString('en-AU', { weekday: 'long' })}
                        </div>
                        <div className="text-sm text-gray-500">
                          {day.date.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-orange-600">
                          {avgPeakStaff.toFixed(1)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {minPeakStaff}-{maxPeakStaff} range
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1 h-16">
                      {timeSlots.filter(t => t >= '12:00' && t < '14:00').map(slot => {
                        const count = peakSlots[slot] || 0;
                        const maxCount = Math.max(6, Math.max(...Object.values(weekStats.peakHourCoverage).flatMap(d => Object.values(d))));
                        const height = (count / maxCount) * 100;
                        
                        return (
                          <div key={slot} className="flex-1 flex flex-col items-center justify-end">
                            <div className={`text-xs font-bold mb-1 ${count === 0 ? 'text-red-600' : count === 1 ? 'text-orange-600' : 'text-gray-600'}`}>
                              {count}
                            </div>
                            <div 
                              className={`w-full rounded-t transition-all ${
                                count === 0 ? 'bg-red-400' :
                                count === 1 ? 'bg-orange-400' :
                                count <= 3 ? 'bg-blue-400' :
                                'bg-green-400'
                              }`}
                              style={{ height: `${Math.max(height, 8)}%` }}
                            />
                            <div className="text-xs text-gray-400 mt-1">{slot.slice(0, 5)}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Critical Gaps Details */}
          {insights.coverageGaps.length > 0 && (
            <div className="bg-white rounded-xl p-6 shadow-lg border-2 border-red-200">
              <h3 className="text-lg font-bold mb-4 text-red-800 flex items-center gap-2">
                <span className="text-2xl">🚨</span>
                Critical Coverage Gaps
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {insights.coverageGaps.slice(0, 50).map((gap, idx) => (
                  <div key={`${gap.dateKey}-${gap.slot}`} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-800">
                          {gap.date.toLocaleDateString('en-AU', { weekday: 'short' })} {gap.date.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}
                        </div>
                        <div className="text-sm text-gray-600">Time: {gap.slot}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-red-600 font-bold">0 / {gap.required}</div>
                      <div className="text-xs text-gray-500">staff</div>
                    </div>
                  </div>
                ))}
              </div>
              {insights.coverageGaps.length > 50 && (
                <div className="mt-3 text-center text-sm text-gray-500">
                  Showing 50 of {insights.coverageGaps.length} gaps
                </div>
              )}
            </div>
          )}
        </div>
      );
    };

    return (
      <div className="p-6">
        {/* Tab Navigation */}
        <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-2 mb-6 flex gap-2 overflow-x-auto">
          <button
            onClick={() => setAnalyticsTab('overview')}
            className={`px-6 py-3 rounded-lg font-semibold text-sm transition-all whitespace-nowrap ${
              analyticsTab === 'overview'
                ? 'bg-gradient-to-r from-blue-600 to-orange-500 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            📊 Overview
          </button>
          <button
            onClick={() => setAnalyticsTab('staff')}
            className={`px-6 py-3 rounded-lg font-semibold text-sm transition-all whitespace-nowrap ${
              analyticsTab === 'staff'
                ? 'bg-gradient-to-r from-blue-600 to-orange-500 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            👥 Staff
          </button>
          <button
            onClick={() => setAnalyticsTab('roles')}
            className={`px-6 py-3 rounded-lg font-semibold text-sm transition-all whitespace-nowrap ${
              analyticsTab === 'roles'
                ? 'bg-gradient-to-r from-blue-600 to-orange-500 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            🎭 Roles
          </button>
          <button
            onClick={() => setAnalyticsTab('coverage')}
            className={`px-6 py-3 rounded-lg font-semibold text-sm transition-all whitespace-nowrap ${
              analyticsTab === 'coverage'
                ? 'bg-gradient-to-r from-blue-600 to-orange-500 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            📍 Coverage
          </button>
          <button
            onClick={() => setAnalyticsTab('revenue')}
            className={`px-6 py-3 rounded-lg font-semibold text-sm transition-all whitespace-nowrap ${
              analyticsTab === 'revenue'
                ? 'bg-gradient-to-r from-blue-600 to-orange-500 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            💰 Revenue
          </button>
        </div>

        {/* Tab Content */}
        {analyticsTab === 'overview' && <OverviewTab />}
        {analyticsTab === 'staff' && <StaffTab />}
        {analyticsTab === 'roles' && <RolesTab />}
        {analyticsTab === 'coverage' && <CoverageTab />}
        {analyticsTab === 'revenue' && <RevenueTab />}
      </div>
    );
  };

  const ClearConfirmModal = () => {
    if (!clearTarget) return null;
    
    const targetDate = clearTarget.type === 'day' 
      ? dates.find(d => formatDateKey(d) === clearTarget.dateKey)
      : null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">Confirm Clear</h2>
            <button onClick={() => { setShowClearModal(false); setClearTarget(null); }}>
              <X size={24} />
            </button>
          </div>
          <div className="mb-6">
            <p className="text-gray-700">
              {clearTarget.type === 'day' 
                ? `Are you sure you want to clear all shifts for ${targetDate?.toLocaleDateString('en-AU', { weekday: 'long', month: 'short', day: 'numeric' })}?`
                : `Are you sure you want to clear all shifts for the entire week (${dates[0]?.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })} - ${dates[dates.length - 1]?.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })})?`
              }
            </p>
            <p className="text-sm text-red-600 mt-2 font-semibold">This action cannot be undone.</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={confirmClear}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg font-semibold transition-all"
            >
              Clear Shifts
            </button>
            <button 
              onClick={() => { setShowClearModal(false); setClearTarget(null); }}
              className="px-6 py-2.5 border-2 border-gray-300 hover:bg-gray-100 rounded-lg font-semibold transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  const exportContextForNextChat = () => {
    const context = {
      appDescription: "Recess - Staff Roster Management Application",
      features: [
        "Drag-and-drop shift scheduling with color-coded roles",
        "Staff management with hourly/weekend rates",
        "Reorderable staff columns via drag-and-drop",
        "Copy/paste entire days",
        "Quick fill shifts with time ranges",
        "Analytics view with hours and cost breakdowns",
        "Undo/redo functionality (up to 50 states)",
        "Peak hour highlighting (12-2pm)",
        "Export schedules to beautifully formatted HTML emails",
        "Context menu for quick actions",
        "Adjustable time intervals (15m/30m/1h)",
        "Zoom levels (S/M/L)",
        "View modes (1D/3D/7D)",
        "localStorage persistence with keys: recess-staff, recess-schedule, recess-staff-order"
      ],
      currentState: {
        staffCount: staff.length,
        staffMembers: staff.map(s => ({
          name: s.name,
          hourlyRate: s.hourlyRate,
          weekendRate: s.weekendRate,
          employmentType: s.employmentType
        })),
        scheduleKeys: Object.keys(schedule).length,
        startHour,
        endHour,
        timeInterval,
        zoomLevel,
        viewMode
      },
      technicalDetails: {
        framework: "React with Hooks",
        styling: "Tailwind CSS utility classes",
        icons: "lucide-react",
        dataStorage: "localStorage (recess-staff, recess-schedule, recess-staff-order)",
        keyFeatures: [
          "Sticky headers with multiple z-index layers",
          "Gradient backgrounds (gray-50 via blue-50 to orange-50)",
          "White header with Recess branding and orange icon",
          "Paint mode toolbar with role buttons",
          "Sophisticated export modal with HTML email generation",
          "ClipboardAPI for HTML copying",
          "Staff order management with drag-and-drop",
          "Context menu on right-click",
          "History management for undo/redo"
        ]
      },
      rebuildInstructions: `To rebuild this app in a new conversation:

1. Upload the roster-app.jsx file
2. Say: "I need you to recreate this artifact that we've been working on (jsx file attached). It's a react artifact. You ran out of messages in our previous chat. Rebuild so that we can continue working on it."
3. Claude will recreate the app with all features intact

The app file location is: /mnt/user-data/uploads/roster-app__1_.jsx (or whatever you name it)

Key things to verify after rebuild:
- White header with "Recess" branding and orange Users icon
- Background: gradient from gray-50 via blue-50 to orange-50
- Paint mode toolbar below main header
- Export modal generates HTML for email
- All buttons have proper gradient styling
- localStorage keys: recess-staff, recess-schedule, recess-staff-order`
    };

    return JSON.stringify(context, null, 2);
  };

  const generateStaffSchedule = (staffMember) => {
    const scheduleByDay = {};
    
    // Initialize all days with empty arrays
    dates.forEach(date => {
      const dateKey = formatDateKey(date);
      scheduleByDay[dateKey] = {
        date: date,
        dateKey: dateKey,
        shifts: []
      };
    });
    
    // For each day, find continuous work blocks from actual schedule
    dates.forEach(date => {
      const dateKey = formatDateKey(date);
      
      // Get all time slots for this staff on this day from actual schedule
      const daySlots = Object.keys(schedule)
        .filter(key => key.startsWith(`${dateKey}|${staffMember.id}|`))
        .map(key => key.split('|')[2])
        .sort();
      
      if (daySlots.length === 0) return;
      
      // Group into continuous shifts
      let currentShift = null;
      
      daySlots.forEach(timeSlot => {
        if (!currentShift) {
          currentShift = {
            date: date,
            dateKey: dateKey,
            startTime: timeSlot,
            endTime: timeSlot
          };
        } else {
          // Check if consecutive (15 min apart)
          const [prevH, prevM] = currentShift.endTime.split(':').map(Number);
          const [currH, currM] = timeSlot.split(':').map(Number);
          const prevMinutes = prevH * 60 + prevM;
          const currMinutes = currH * 60 + currM;
          
          if (currMinutes - prevMinutes === 15) {
            // Continuous - extend shift
            currentShift.endTime = timeSlot;
          } else {
            // Gap - save current shift and start new one
            scheduleByDay[dateKey].shifts.push(currentShift);
            currentShift = {
              date: date,
              dateKey: dateKey,
              startTime: timeSlot,
              endTime: timeSlot
            };
          }
        }
      });
      
      // Save last shift
      if (currentShift) {
        scheduleByDay[dateKey].shifts.push(currentShift);
      }
    });
    
    // Return array of all days (including empty ones)
    return dates.map(date => scheduleByDay[formatDateKey(date)]);
  };

  const ExportModal = () => {
    const [selectedStaffId, setSelectedStaffId] = useState(staff[0]?.id);
    const [copiedStaffId, setCopiedStaffId] = useState(null);
    
    const selectedStaff = staff.find(s => s.id === selectedStaffId);
    const scheduleByDay = selectedStaff ? generateStaffSchedule(selectedStaff) : [];
    
    const totalHours = scheduleByDay.reduce((total, day) => {
      return total + day.shifts.reduce((dayTotal, shift) => {
        // Calculate hours from time difference (15 min slots)
        const [startH, startM] = shift.startTime.split(':').map(Number);
        const [endH, endM] = shift.endTime.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;
        const durationMinutes = endMinutes - startMinutes + 15; // +15 to include end slot
        return dayTotal + (durationMinutes / 60);
      }, 0);
    }, 0);
    
    const copyToClipboard = (staffId) => {
      const staffMember = staff.find(s => s.id === staffId);
      const scheduleByDay = generateStaffSchedule(staffMember);
      
      const weekRange = `${dates[0]?.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })} - ${dates[dates.length - 1]?.toLocaleDateString('en-AU', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      
      let tableHTML = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; max-width: 600px;">
  <div style="background: linear-gradient(135deg, #2563EB 0%, #F97316 100%); padding: 24px; border-radius: 12px 12px 0 0;">
    <h2 style="color: white; margin: 0 0 8px 0; font-size: 24px; font-weight: 700;">Your Weekly Schedule</h2>
    <p style="color: rgba(255,255,255,0.95); margin: 0; font-size: 14px;">${weekRange}</p>
  </div>
  <div style="background: white; padding: 20px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <div style="margin-bottom: 20px; padding: 16px; background: #F1F5F9; border-radius: 8px; border-left: 4px solid #F97316;">
      <div style="font-size: 14px; color: #64748B; margin-bottom: 4px;">Team Member</div>
      <div style="font-size: 20px; font-weight: 700; color: #1E293B;">${staffMember.name}</div>
    </div>
    <table style="width: 100%; border-collapse: separate; border-spacing: 0;">
      <thead>
        <tr style="background: #F8FAFC;">
          <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 600; color: #64748B; text-transform: uppercase; border-bottom: 2px solid #E2E8F0;">Day</th>
          <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 600; color: #64748B; text-transform: uppercase; border-bottom: 2px solid #E2E8F0;">Time</th>
          <th style="padding: 12px; text-align: right; font-size: 12px; font-weight: 600; color: #64748B; text-transform: uppercase; border-bottom: 2px solid #E2E8F0;">Hours</th>
        </tr>
      </thead>
      <tbody>`;

      let totalHours = 0;
      
      scheduleByDay.forEach((day) => {
        if (day.shifts.length === 0) {
          // Show empty day
          tableHTML += `<tr style="border-bottom: 1px solid #F1F5F9;">
          <td style="padding: 14px 12px;">
            <div style="font-weight: 600; color: #1E293B; font-size: 14px;">${day.date.toLocaleDateString('en-AU', { weekday: 'short' }).toUpperCase()}</div>
            <div style="font-size: 12px; color: #64748B;">${day.date.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}</div>
          </td>
          <td style="padding: 14px 12px;"><div style="font-size: 14px; color: #94A3B8; font-style: italic;">Not rostered</div></td>
          <td style="padding: 14px 12px; text-align: right; font-weight: 600; color: #94A3B8; font-size: 14px;">-</td>
        </tr>`;
        } else {
          // Show each shift for this day
          day.shifts.forEach((shift, shiftIdx) => {
            // Calculate hours from time difference
            const [startH, startM] = shift.startTime.split(':').map(Number);
            const [endH, endM] = shift.endTime.split(':').map(Number);
            const startMinutes = startH * 60 + startM;
            const endMinutes = endH * 60 + endM;
            const durationMinutes = endMinutes - startMinutes + 15;
            const hours = (durationMinutes / 60).toFixed(2);
            totalHours += parseFloat(hours);
            
            // Calculate actual end time (add 15 min to last slot)
            const actualEndMinutes = endMinutes + 15;
            const actualEndTime = `${Math.floor(actualEndMinutes / 60).toString().padStart(2, '0')}:${(actualEndMinutes % 60).toString().padStart(2, '0')}`;
            
            tableHTML += `<tr style="border-bottom: 1px solid #F1F5F9;">
            <td style="padding: 14px 12px;">
              <div style="font-weight: 600; color: #1E293B; font-size: 14px;">${shift.date.toLocaleDateString('en-AU', { weekday: 'short' }).toUpperCase()}</div>
              <div style="font-size: 12px; color: #64748B;">${shift.date.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}</div>
            </td>
            <td style="padding: 14px 12px;"><div style="font-size: 14px; color: #1E293B;">${shift.startTime} - ${actualEndTime}</div></td>
            <td style="padding: 14px 12px; text-align: right; font-weight: 600; color: #1E293B; font-size: 14px;">${hours}h</td>
          </tr>`;
          });
        }
      });
      
      tableHTML += `</tbody></table>
    <div style="margin-top: 20px; padding: 16px; background: linear-gradient(135deg, #EFF6FF 0%, #FFF7ED 100%); border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
      <span style="font-size: 16px; font-weight: 600; color: #1E293B;">Total Hours</span>
      <span style="font-size: 24px; font-weight: 700; color: #F97316;">${totalHours.toFixed(2)}h</span>
    </div>
  </div>
</div>`;

      const blob = new Blob([tableHTML], { type: 'text/html' });
      const clipboardItem = new ClipboardItem({ 'text/html': blob });
      
      navigator.clipboard.write([clipboardItem]).then(() => {
        setCopiedStaffId(staffId);
        setTimeout(() => setCopiedStaffId(null), 2000);
      });
    };
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl">
          <div className="bg-gradient-to-r from-blue-600 to-orange-500 px-8 py-6 flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-white">Export Staff Schedules</h2>
              <p className="text-blue-50 text-sm mt-1">Select a team member to view and copy their schedule</p>
            </div>
            <button 
              onClick={() => setShowExportModal(false)}
              className="text-white hover:bg-white/20 rounded-full p-2 transition-all"
            >
              <X size={24} />
            </button>
          </div>
          
          <div className="p-8 overflow-auto" style={{ maxHeight: 'calc(90vh - 100px)' }}>
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-3">Team Member</label>
              <select 
                value={selectedStaffId} 
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-lg focus:border-blue-500 focus:outline-none transition-all"
              >
                {activeStaff.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {selectedStaff && (
              <div>
                <div className="bg-gradient-to-br from-blue-50 to-orange-50 rounded-2xl p-6 mb-6 border-2 border-blue-100">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <div className="text-sm font-medium text-gray-600 mb-1">Viewing schedule for</div>
                      <div className="text-2xl font-bold text-gray-900">{selectedStaff.name}</div>
                      <div className="text-sm text-gray-600 mt-1">
                        {dates[0]?.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })} - {dates[dates.length - 1]?.toLocaleDateString('en-AU', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-600 mb-1">Total Hours</div>
                      <div className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-orange-500 bg-clip-text text-transparent">
                        {totalHours.toFixed(2)}h
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => copyToClipboard(selectedStaffId)}
                    className={`w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-semibold text-lg transition-all shadow-lg ${
                      copiedStaffId === selectedStaffId 
                        ? 'bg-green-500 text-white' 
                        : 'bg-gradient-to-r from-blue-600 to-orange-500 hover:from-blue-500 hover:to-orange-400 text-white'
                    }`}
                  >
                    <Clipboard size={20} />
                    {copiedStaffId === selectedStaffId ? 'Copied to Clipboard!' : 'Copy Schedule for Email'}
                  </button>
                </div>
                
                <div className="bg-white rounded-xl border-2 border-gray-100 overflow-hidden">
                  <div className="bg-gray-50 px-6 py-3 border-b-2 border-gray-100">
                    <h3 className="font-semibold text-gray-800">Schedule Preview</h3>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Day</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Time</th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Hours</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {scheduleByDay.length === 0 ? (
                        <tr>
                          <td colSpan="3" className="px-6 py-12 text-center text-gray-400">
                            No days in current view
                          </td>
                        </tr>
                      ) : (
                        scheduleByDay.map((day, dayIdx) => {
                          if (day.shifts.length === 0) {
                            // Show empty day
                            return (
                              <tr key={`${day.dateKey}-empty`} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4">
                                  <div className="font-semibold text-gray-900">{day.date.toLocaleDateString('en-AU', { weekday: 'short' }).toUpperCase()}</div>
                                  <div className="text-sm text-gray-500">{day.date.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}</div>
                                </td>
                                <td className="px-6 py-4 text-gray-400 italic">Not rostered</td>
                                <td className="px-6 py-4 text-right text-gray-400">-</td>
                              </tr>
                            );
                          } else {
                            // Show each shift for this day
                            return day.shifts.map((shift, shiftIdx) => {
                              // Calculate hours from time difference
                              const [startH, startM] = shift.startTime.split(':').map(Number);
                              const [endH, endM] = shift.endTime.split(':').map(Number);
                              const startMinutes = startH * 60 + startM;
                              const endMinutes = endH * 60 + endM;
                              const durationMinutes = endMinutes - startMinutes + 15;
                              const hours = (durationMinutes / 60).toFixed(2);
                              
                              // Calculate actual end time
                              const actualEndMinutes = endMinutes + 15;
                              const actualEndTime = `${Math.floor(actualEndMinutes / 60).toString().padStart(2, '0')}:${(actualEndMinutes % 60).toString().padStart(2, '0')}`;
                              
                              return (
                                <tr key={`${day.dateKey}-${shiftIdx}`} className="hover:bg-gray-50 transition-colors">
                                  <td className="px-6 py-4">
                                    <div className="font-semibold text-gray-900">{shift.date.toLocaleDateString('en-AU', { weekday: 'short' }).toUpperCase()}</div>
                                    <div className="text-sm text-gray-500">{shift.date.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}</div>
                                  </td>
                                  <td className="px-6 py-4 text-gray-700 font-mono">{shift.startTime} - {actualEndTime}</td>
                                  <td className="px-6 py-4 text-right font-semibold text-gray-900">{hours}h</td>
                                </tr>
                              );
                            });
                          }
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <div className="flex items-start gap-3">
                    <div className="text-blue-600 mt-0.5">💡</div>
                    <div>
                      <div className="font-semibold text-blue-900 mb-1">How to use</div>
                      <div className="text-sm text-blue-800">
                        Click "Copy Schedule for Email" to copy the beautifully formatted schedule. 
                        Then paste it directly into Gmail, Outlook, or any email client. The formatting will be preserved!
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Show mobile view if on mobile device
  if (isMobileView) {
    return (
      <>
        <MobileView />
        <HelpModal />
      </>
    );
  }

  return (

    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-orange-50">
      <div className="bg-white border-b-2 border-gray-200 shadow-lg sticky top-0 z-40 backdrop-blur-sm">
        <div className="px-6 py-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-4">
              {businessSettings.logoUrl ? (
                <div className="bg-white p-2 rounded-xl shadow-lg border-2 border-gray-200">
                  <img 
                    src={businessSettings.logoUrl} 
                    alt={`${businessSettings.businessName} Logo`}
                    className="h-12 w-12 object-contain"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextElementSibling.style.display = 'flex';
                    }}
                  />
                  <div style={{ display: 'none' }} className="bg-gradient-to-br from-orange-500 to-orange-600 p-3 rounded-lg">
                    <Users size={24} className="text-white" />
                  </div>
                </div>
              ) : (
                <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-3 rounded-xl shadow-lg">
                  <Users size={28} className="text-white" />
                </div>
              )}
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-orange-500 bg-clip-text text-transparent tracking-tight">{businessSettings.businessName}</h1>
                <p className="text-sm text-gray-600 mt-0.5">Staff Roster Management</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex gap-1 bg-gray-100 p-1 rounded-lg border border-gray-300">
                <button 
                  onClick={undo} 
                  disabled={historyIndex <= 0}
                  className={`p-2 rounded transition-all ${historyIndex > 0 ? 'hover:bg-gray-200 text-gray-700' : 'text-gray-300 cursor-not-allowed'}`}
                  title="Undo (Ctrl+Z)"
                >
                  <Undo2 size={18} />
                </button>
                <button 
                  onClick={redo} 
                  disabled={historyIndex >= scheduleHistory.length - 1}
                  className={`p-2 rounded transition-all ${historyIndex < scheduleHistory.length - 1 ? 'hover:bg-gray-200 text-gray-700' : 'text-gray-300 cursor-not-allowed'}`}
                  title="Redo (Ctrl+Shift+Z)"
                >
                  <Redo2 size={18} />
                </button>
              </div>
              <button onClick={() => setShowTimeSettings(true)} className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 py-2.5 rounded-xl transition-all shadow-md hover:shadow-lg border border-gray-300">
                <Clock size={18} />
                <span className="font-medium">{startHour.toString().padStart(2, '0')}:00 - {endHour.toString().padStart(2, '0')}:00</span>
              </button>
              <button onClick={() => setShowSettingsModal(true)} className="flex items-center gap-2 bg-purple-100 hover:bg-purple-200 text-purple-700 px-5 py-2.5 rounded-xl transition-all shadow-md hover:shadow-lg border border-purple-300">
                <span className="text-lg">⚙️</span>
                <span className="font-medium">Settings</span>
              </button>
              <button onClick={() => setShowExportModal(true)} className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white px-5 py-2.5 rounded-xl transition-all shadow-md hover:shadow-lg">
                <Clipboard size={18} />
                <span className="font-medium">Export Schedules</span>
              </button>
              <button 
                onClick={() => {
                  setShowTemplateMenu(true);
                  if (templateMode) {
                    setTemplateMode(false);
                    setSelectedTemplate(null);
                  }
                }} 
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all shadow-md hover:shadow-lg ${
                  templateMode 
                    ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white' 
                    : 'bg-purple-100 hover:bg-purple-200 text-purple-700 border border-purple-300'
                }`}
              >
                <Copy size={18} />
                <span className="font-medium">
                  {templateMode ? `Apply: ${selectedTemplate?.name}` : 'Templates'}
                </span>
              </button>
              <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-all ${
                saving 
                  ? 'bg-blue-50 border-blue-500 text-blue-700' 
                  : 'bg-green-50 border-green-500 text-green-700'
              }`}>
                <div className={`w-2 h-2 rounded-full ${saving ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`}></div>
                <span className="text-sm font-semibold">
                  {saving ? 'Saving...' : 'Auto-saved'}
                </span>
                <span className="text-xs opacity-75">
                  {Object.keys(schedule).length} slots
                </span>
              </div>
              <button onClick={() => setShowStaffModal(true)} className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white px-5 py-2.5 rounded-xl transition-all shadow-md hover:shadow-lg">
                <Users size={18} />
                <span className="font-medium">Add Staff</span>
              </button>
              <button 
                onClick={() => setShowHelpModal(true)} 
                className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white px-5 py-2.5 rounded-xl transition-all shadow-md hover:shadow-lg"
                title="Help & Tutorials"
              >
                <span className="text-lg font-bold">?</span>
                <span className="font-medium">Help</span>
              </button>
              <button onClick={signOut} className="flex items-center gap-2 bg-gray-100 hover:bg-red-50 text-gray-700 hover:text-red-600 px-5 py-2.5 rounded-xl transition-all shadow-md hover:shadow-lg border border-gray-300 hover:border-red-300" title="Sign Out">
                <LogOut size={18} />
                <span className="font-medium">Sign Out</span>
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="flex gap-2 bg-gray-100 p-1.5 rounded-xl border border-gray-300 shadow-sm">
              <button 
                onClick={() => setActiveView('roster')} 
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeView === 'roster' ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-200'}`}
              >
                Grid View
              </button>
              <button 
                onClick={() => setActiveView('staff-view')} 
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeView === 'staff-view' ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-200'}`}
              >
                Staff View
              </button>
              <button 
                onClick={() => setActiveView('analytics')} 
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeView === 'analytics' ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-200'}`}
              >
                Analytics
              </button>
            </div>
            <div className="flex gap-2 bg-gray-100 p-1.5 rounded-xl border border-gray-300 shadow-sm">
              {[1, 3, 7].map(m => <button key={m} onClick={() => setViewMode(m)} className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === m ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-200'}`}>{m}D</button>)}
            </div>
            <div className="flex gap-2 bg-gray-100 p-1.5 rounded-xl border border-gray-300 shadow-sm">
              {[15, 30, 60].map(i => <button key={i} onClick={() => setTimeInterval(i)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${timeInterval === i ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-200'}`}>{i === 60 ? '1h' : `${i}m`}</button>)}
            </div>
            <div className="flex gap-2 bg-gray-100 p-1.5 rounded-xl border border-gray-300 shadow-sm">
              <button 
                onClick={() => setColumnWidth(Math.max(60, columnWidth - 10))} 
                className="px-3 py-2 rounded-lg text-sm font-medium transition-all text-gray-700 hover:text-gray-900 hover:bg-gray-200"
                title="Narrow columns"
              >
                ←
              </button>
              <span className="px-3 py-2 text-xs font-semibold text-gray-600 flex items-center">{columnWidth}px</span>
              <button 
                onClick={() => setColumnWidth(Math.min(200, columnWidth + 10))} 
                className="px-3 py-2 rounded-lg text-sm font-medium transition-all text-gray-700 hover:text-gray-900 hover:bg-gray-200"
                title="Widen columns"
              >
                →
              </button>
            </div>
            <div className="flex gap-2 ml-auto">
              <button onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() - 7)))} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg border border-gray-300 transition-all shadow-sm">←</button>
              <span className="text-sm px-4 py-2 bg-white border-2 border-gray-300 rounded-lg text-gray-700 font-medium shadow-sm">{dates[0]?.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })} - {dates[dates.length - 1]?.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}</span>
              <button onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + 7)))} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg border border-gray-300 transition-all shadow-sm">→</button>
              <button onClick={() => setCurrentDate(new Date())} className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white rounded-lg transition-all shadow-md">Today</button>
              <button onClick={clearWeek} className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg border border-red-300 transition-all shadow-sm font-semibold">Clear Week</button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border-b-2 border-gray-200 shadow-md sticky top-[140px] z-30 px-6 py-4 backdrop-blur-sm">
        <div className="flex items-center gap-3 overflow-x-auto">
          {templateMode ? (
            <>
              <span className="text-sm font-semibold text-purple-700 whitespace-nowrap">Template Mode:</span>
              <div className="px-4 py-2.5 rounded-xl border-2 border-purple-600 bg-purple-100 text-purple-700 text-sm font-bold">
                {selectedTemplate?.name} ({selectedTemplate?.startTime} - {selectedTemplate?.endTime})
              </div>
              <button 
                onClick={() => {
                  setTemplateMode(false);
                  setSelectedTemplate(null);
                }} 
                className="px-4 py-2.5 rounded-xl border-2 border-gray-300 text-gray-600 hover:border-red-500 hover:text-red-600 text-sm font-bold transition-all"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">Paint Mode:</span>
              {roles.map(r => <button key={r.id} onClick={() => setSelectedRole(r)} style={{ backgroundColor: selectedRole?.id === r.id ? r.color : 'transparent', color: selectedRole?.id === r.id ? 'white' : r.color, borderColor: r.color }} className="px-4 py-2.5 rounded-xl border-2 text-sm font-bold transition-all hover:scale-105 shadow-sm">{r.code}</button>)}
              <button onClick={() => setSelectedRole({ id: 'eraser', code: 'X', color: '#ef4444' })} className={`px-4 py-2.5 rounded-xl border-2 text-sm font-bold transition-all hover:scale-105 shadow-sm ${selectedRole?.id === 'eraser' ? 'bg-red-600 text-white border-red-600' : 'border-gray-300 text-gray-600 hover:border-red-500'}`}>Eraser</button>
            </>
          )}
        </div>
      </div>

      {activeView === 'analytics' ? (
        <AnalyticsView />
      ) : activeView === 'staff-view' ? (
        <StaffRosterView />
      ) : (
        <div className="p-6">
        {activeStaff.length === 0 && (
          <div className="text-center py-16">
            <div className="bg-white rounded-2xl shadow-lg p-12 max-w-md mx-auto">
              <Users size={48} className="mx-auto text-blue-600 mb-4" />
              <h3 className="text-xl font-bold mb-3">No Staff Yet</h3>
              <button onClick={() => setShowStaffModal(true)} className="bg-blue-600 text-white px-8 py-3 rounded-lg">Add Staff</button>
            </div>
          </div>
        )}

        {staff.length > 0 && (
          <div className="mb-6 bg-white rounded-xl shadow-sm border">
            <button onClick={() => setShowTeamMembers(!showTeamMembers)} className="w-full flex items-center justify-between p-5">
              <h3 className="font-semibold">Team ({activeStaff.length}){archivedStaff.length > 0 && <span className="text-gray-400 font-normal ml-1">· {archivedStaff.length} archived</span>}</h3>
              {showTeamMembers ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
            {showTeamMembers && (
              <div className="px-5 pb-5 space-y-2 border-t pt-4">
                {activeStaff.map(s => (
                  <div key={s.id} className="flex justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <span className="font-semibold">{s.name}</span>
                      <span className="text-sm text-gray-600">
                        ${s.hourlyRate}/hr
                        {s.weekendRate && s.weekendRate !== s.hourlyRate && (
                          <span className="ml-1">· ${s.weekendRate}/hr (weekend)</span>
                        )}
                        {' '}({s.employmentType})
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingStaff(s); setShowStaffModal(true); }} className="p-2 hover:bg-gray-200 rounded"><Edit2 size={16} /></button>
                      <button onClick={() => deleteStaff(s.id)} className="p-2 hover:bg-red-100 rounded" title="Archive staff"><Trash2 size={16} className="text-red-600" /></button>
                    </div>
                  </div>
                ))}
                {archivedStaff.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h4 className="text-sm font-medium text-gray-500 mb-2">Archived Staff</h4>
                    {archivedStaff.map(s => (
                      <div key={s.id} className="flex justify-between p-3 bg-gray-100 rounded-lg opacity-70">
                        <div>
                          <span className="font-semibold text-gray-500">{s.name}</span>
                          <span className="text-sm text-gray-400 ml-2">({s.employmentType})</span>
                        </div>
                        <button onClick={() => restoreStaff(s.id)} className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 rounded" title="Restore staff">
                          <ArchiveRestore size={14} />
                          Restore
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeStaff.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg border overflow-auto" style={{ maxHeight: 'calc(100vh - 400px)' }}>
            <table className="border-collapse table-fixed" style={{ width: `${100 + (orderedStaff.length * dates.length * columnWidth)}px` }}>
              <thead className="sticky top-0 z-30 bg-white">
                <tr className="bg-gray-100 border-b">
                  <th className="border-r-2 p-3 text-left text-sm font-semibold sticky left-0 bg-gray-100 z-40 w-20">Time</th>
                  {dates.map((d, i) => (
                    <th key={formatDateKey(d)} colSpan={orderedStaff.length} className={`p-3 text-center text-sm ${i < dates.length - 1 ? 'border-r-4 border-gray-400' : ''}`}>
                      <div className="font-bold">{d.toLocaleDateString('en-AU', { weekday: 'short' }).toUpperCase()}</div>
                      <div className="text-xs text-gray-600">{d.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}</div>
                      <div className="text-xs text-blue-600">{calculateDayStats(formatDateKey(d)).totalHours.toFixed(2)}h · ${calculateDayStats(formatDateKey(d)).totalCost.toFixed(0)}</div>
                      <div className="flex gap-1 justify-center mt-2">
                        <button
                          onClick={() => copyDay(formatDateKey(d))}
                          className={`p-1 rounded hover:bg-blue-100 ${copiedDay === formatDateKey(d) ? 'bg-blue-200' : ''}`}
                          title="Copy day"
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          onClick={() => pasteDay(formatDateKey(d))}
                          className="p-1 rounded hover:bg-green-100"
                          title="Paste day"
                          disabled={!copiedDay}
                        >
                          <Clipboard size={14} />
                        </button>
                        <button
                          onClick={() => clearDay(formatDateKey(d))}
                          className="p-1 rounded hover:bg-red-100 text-red-600"
                          title="Clear day"
                        >
                          <Trash size={14} />
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
                <tr className="bg-white border-b sticky top-[60px] z-30">
                  <th className="border-r-2 sticky left-0 bg-white z-40 p-2 text-xs w-20">Drag →</th>
                  {dates.map((d, di) => (
                    <React.Fragment key={`s-${formatDateKey(d)}`}>
                      {orderedStaff.map((s, si) => (
                        <th 
                          key={`${formatDateKey(d)}-${s.id}`}
                          className={`border-r p-2 text-xs text-center cursor-move hover:bg-blue-50 ${si === orderedStaff.length - 1 && di < dates.length - 1 ? 'border-r-4 border-gray-400' : ''} ${draggedStaffId === s.id ? 'opacity-50' : ''}`}
                          style={{ width: `${columnWidth}px`, maxWidth: `${columnWidth}px`, minWidth: `${columnWidth}px` }}
                          draggable
                          onDragStart={() => handleStaffDragStart(s.id)}
                          onDragOver={(e) => handleStaffDragOver(e, s.id)}
                          onDragEnd={handleStaffDragEnd}
                        >
                          <div className="truncate">⋮⋮ {s.name.split(' ')[0]}</div>
                        </th>
                      ))}
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timeSlots.map(t => {
                  const isPeakHour = t >= '12:00' && t < '14:00';
                  return (
                    <tr key={t} className={`border-b ${isPeakHour ? 'bg-orange-50' : 'hover:bg-blue-50'}`}>
                      <td className={`border-r-2 p-2 text-xs font-semibold sticky left-0 z-10 w-20 ${isPeakHour ? 'bg-gradient-to-r from-orange-100 to-orange-50 border-l-4 border-l-orange-500' : 'bg-white'}`} style={{ height: `${rowHeight}px`, maxHeight: `${rowHeight}px` }}>
                        <div className="flex items-center justify-center h-full overflow-hidden">
                          <span>{t}</span>
                        </div>
                      </td>
                    {dates.map((d, di) => {
                      const dk = formatDateKey(d);
                      return (
                        <React.Fragment key={`${t}-${dk}`}>
                          {orderedStaff.map((s, si) => {
                            const k = getScheduleKey(dk, s.id, t);
                            const sh = schedule[k];
                            return (
                              <td 
                                key={k}
                                className={`border-r p-0 cursor-pointer ${si === orderedStaff.length - 1 && di < dates.length - 1 ? 'border-r-4 border-gray-400' : ''}`}
                                onMouseDown={() => handleMouseDown(dk, s.id, t)}
                                onMouseEnter={() => handleMouseEnter(dk, s.id, t)}
                                onContextMenu={(e) => handleRightClick(e, dk, s.id, t)}
                                style={{ backgroundColor: sh ? sh.roleColor : 'white', height: `${rowHeight}px`, width: `${columnWidth}px`, maxWidth: `${columnWidth}px`, minWidth: `${columnWidth}px` }}
                              >
                                {sh && <div className="flex items-center justify-center text-white font-bold h-full" style={{ fontSize: zoomLevel === 1 ? '8px' : zoomLevel === 2 ? '10px' : '12px' }}>{sh.roleCode}</div>}
                              </td>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 font-semibold border-t-2">
                  <td className="border-r-2 p-3 text-sm sticky left-0 bg-gray-100 z-20 w-20">Totals</td>
                  {dates.map((d, di) => {
                    const dk = formatDateKey(d);
                    return (
                      <React.Fragment key={`tot-${dk}`}>
                        {orderedStaff.map((s, si) => {
                          const st = calculateStaffDayStats(s.id, dk);
                          return (
                            <td key={`${dk}-${s.id}`} className={`border-r p-1 text-center text-xs ${si === orderedStaff.length - 1 && di < dates.length - 1 ? 'border-r-4 border-gray-400' : ''}`} style={{ width: '120px', maxWidth: '120px', minWidth: '120px' }}>
                              <div>{st.hours.toFixed(1)}h</div>
                              <div>${st.cost.toFixed(0)}</div>
                            </td>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
      )}

      {showStaffModal && <StaffModal key={editingStaff ? editingStaff.id : 'new'} />}
      {showTimeSettings && <TimeSettingsModal />}
      {showSettingsModal && <BusinessSettingsModal />}
      {showQuickFillModal && <QuickFillModal />}
      {showExportModal && <ExportModal />}
      {showClearModal && <ClearConfirmModal />}
      {showTemplateModal && <TemplateModal />}
      {showTemplateMenu && <TemplateMenu />}
      {showRevenueModal && <RevenueModal />}
      <TutorialOverlay />
      <HelpModal />
      <ContextMenu />
    </div>
  );
};
export default RosterApp;