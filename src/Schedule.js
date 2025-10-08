// Ścieżka: src/Schedule.js

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabaseClient';
import FullCalendar from '@fullcalendar/react';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';

function Schedule({ user }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resources, setResources] = useState([]); // Drukarki
  const [events, setEvents] = useState([]); // Zadania druku
  const calendarRef = useRef(null);

  // Funkcja do pobierania danych
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Pobierz drukarki (zasoby dla kalendarza)
      const { data: printersData, error: printersError } = await supabase.from('Printers').select('id, name');
      if (printersError) throw printersError;
      
      const calendarResources = printersData.map(p => ({ id: p.id.toString(), title: p.name }));
      setResources(calendarResources);

      // Pobierz zadania druku (wydarzenia) dla widocznego zakresu dat
      const calendarApi = calendarRef.current.getApi();
      const start = calendarApi.view.activeStart.toISOString();
      const end = calendarApi.view.activeEnd.toISOString();
      
      const { data: jobsData, error: jobsError } = await supabase.functions.invoke(`print-jobs-crud?start=${start}&end=${end}`);
      if (jobsError) throw jobsError;

      const calendarEvents = jobsData.map(job => ({
        id: job.id,
        resourceId: job.printerId.toString(),
        title: `Zamówienie (item #${job.orderItemId.slice(0, 4)})`, // Tytuł bloku
        start: job.plannedStartTime,
        end: job.plannedEndTime,
        backgroundColor: job.color || '#3788d8'
      }));
      setEvents(calendarEvents);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && calendarRef.current) {
      fetchData();
    }
  }, [user, fetchData]);

  // Funkcja obsługująca przeciąganie i upuszczanie zadań
  const handleEventDrop = async (info) => {
    if (!window.confirm("Czy na pewno chcesz przenieść to zadanie?")) {
      info.revert();
      return;
    }

    const { event } = info;
    const updatedJob = {
      plannedStartTime: event.start.toISOString(),
      plannedEndTime: event.end.toISOString(),
      printerId: parseInt(event.getResources()[0].id) // ID nowej drukarki
    };

    try {
      const { error } = await supabase.functions.invoke(`print-jobs-crud/${event.id}`, {
        method: 'PUT',
        body: updatedJob
      });
      if (error) throw error;
      alert("Zadanie pomyślnie zaktualizowane!");
    } catch (err) {
      alert(`Błąd: ${err.message}`);
      info.revert(); // Wycofaj zmianę wizualną w razie błędu
    }
  };
  
  return (
    <div className="list-section full-width">
      <h2>Harmonogram Drukarek</h2>
      {error && <p className="error-message">{error}</p>}
      {loading && <p>Ładowanie harmonogramu...</p>}
      
      <div className="calendar-container">
        <FullCalendar
          ref={calendarRef}
          plugins={[resourceTimelinePlugin]}
          schedulerLicenseKey='GPL-My-Project-Is-Open-Source' // Ważne!
          initialView='resourceTimelineWeek'
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'resourceTimelineDay,resourceTimelineWeek,resourceTimelineMonth'
          }}
          editable={true} // Włącza przeciąganie i upuszczanie
          resources={resources}
          events={events}
          eventDrop={handleEventDrop}
          datesSet={fetchData} // Odśwież dane przy zmianie daty
          resourceAreaHeaderContent="Drukarki"
          height="auto"
        />
      </div>
    </div>
  );
}

export default Schedule;