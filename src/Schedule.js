// Ścieżka: src/Schedule.js

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabaseClient';
import FullCalendar from '@fullcalendar/react';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';

function Schedule({ user }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resources, setResources] = useState([]); // Drukarki
  
  const API_BASE_URL = process.env.REACT_APP_SUPABASE_EDGE_FUNCTION_URL;
  const getAuthToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  }, []);

  // Pobieramy tylko drukarki przy pierwszym ładowaniu
  useEffect(() => {
    const fetchResources = async () => {
      setLoading(true);
      try {
        const { data: printersData, error: printersError } = await supabase.from('Printers').select('id, name');
        if (printersError) throw printersError;
        
        const calendarResources = printersData.map(p => ({ id: p.id.toString(), title: p.name }));
        setResources(calendarResources);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchResources();
    }
  }, [user]);

  // Funkcja, która będzie pobierać ZADANIA. Będzie wywoływana przez FullCalendar.
  const fetchEvents = async (fetchInfo, successCallback, failureCallback) => {
    try {
      const token = await getAuthToken();
      if (!token) throw new Error("Sesja wygasła.");

      const start = fetchInfo.start.toISOString();
      const end = fetchInfo.end.toISOString();

      const jobsResponse = await fetch(`${API_BASE_URL}/print-jobs-crud?start=${start}&end=${end}`, {
          headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!jobsResponse.ok) {
        const errData = await jobsResponse.json();
        throw new Error(errData.error || "Błąd pobierania zadań druku");
      }
      
      const jobsData = await jobsResponse.json();
      const calendarEvents = (jobsData || []).map(job => ({
        id: job.id.toString(),
        resourceId: job.printerId.toString(),
        title: `Zamówienie (item #${job.orderItemId.slice(0, 4)})`,
        start: job.plannedStartTime,
        end: job.plannedEndTime,
        backgroundColor: job.color || '#3788d8'
      }));
      
      successCallback(calendarEvents); // Przekazujemy dane do kalendarza

    } catch (err) {
      setError(err.message);
      failureCallback(err); // Informujemy kalendarz o błędzie
    }
  };

  // Funkcja obsługująca przeciąganie i upuszczanie
  const handleEventChange = async (changeInfo) => {
    if (!window.confirm("Czy na pewno chcesz przenieść to zadanie?")) {
      changeInfo.revert();
      return;
    }
    const { event } = changeInfo;
    const updatedJob = {
      plannedStartTime: event.start.toISOString(),
      plannedEndTime: event.end.toISOString(),
      printerId: parseInt(event.getResources()[0].id)
    };

    try {
      const token = await getAuthToken();
      const response = await fetch(`${API_BASE_URL}/print-jobs-crud/${event.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
          body: JSON.stringify(updatedJob)
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Błąd aktualizacji zadania");
      }
      alert("Zadanie pomyślnie zaktualizowane!");
    } catch (err) {
      alert(`Błąd: ${err.message}`);
      changeInfo.revert();
    }
  };
  
  if (loading) {
    return <p>Ładowanie drukarek...</p>;
  }

  return (
    <div className="list-section full-width">
      <h2>Harmonogram Drukarek</h2>
      {error && <p className="error-message">{error}</p>}
      
      <div className="calendar-container">
        <FullCalendar
          plugins={[resourceTimelinePlugin]}
          schedulerLicenseKey='GPL-My-Project-Is-Open-Source'
          initialView='resourceTimelineWeek'
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'resourceTimelineDay,resourceTimelineWeek,resourceTimelineMonth'
          }}
          editable={true}
          resources={resources}
          events={fetchEvents} // <-- KLUCZOWA ZMIANA: Przekazujemy funkcję, a nie stan
          eventChange={handleEventChange} // <-- ZMIANA: Używamy eventChange dla obu operacji (przesuwanie i zmiana rozmiaru)
          resourceAreaHeaderContent="Drukarki"
          height="auto"
        />
      </div>
    </div>
  );
}

export default Schedule;